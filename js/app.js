let slides = [];
let current = 0;
let questionCount = 0;       // total number of question slides (regular + bonus)
let weeklyVersion = null;
let bwMode = false;
let promoInterval = null;
let answersMode = false;   // show answer option cards on question slides
let answersCount = 4;      // how many answer cards to show
let showPromos = true;     // whether promo slides are included
let showTutorials = true;  // whether tutorial slides are shown
let showBonusPromo = true; // show the IG bonus promo tutorial even when tutorials are off
let intermissionOn = false; // whether intermission slide is shown
let intermissionAfterRound = 3; // number of questions before intermission
const questionBank = {};   // keyed by category, loaded on demand
const answersBank = {};    // keyed by category, first-column answers only

// ── Keyboard shortcuts config ──────────────────────────────────
const DEFAULT_SHORTCUTS = {
  nextSlide:      { key: 'ArrowRight', label: '➡', action: 'Next Slide' },
  prevSlide:      { key: 'ArrowLeft',  label: '⬅', action: 'Previous Slide' },
  revealQuestion: { key: 'q',          label: 'Q', action: 'Reveal Question' },
  revealAnswer:   { key: 'a',          label: 'A', action: 'Reveal Answer' },
  startTimer:     { key: ' ',          label: 'SPACE', action: 'Start Timer' },
  resetTimer:     { key: 'r',          label: 'R', action: 'Reset Timer' },
  decisionOverlay:{ key: 'd',          label: 'D', action: 'Decision Overlay' },
  showAnswerCards:{ key: 's',          label: 'S', action: 'Show/Hide Answer Cards' },
  toggleCards:    { key: '1–9',        label: '1–9', action: 'Toggle Card Used' },
};
let shortcuts = JSON.parse(JSON.stringify(DEFAULT_SHORTCUTS));
let shortcutEditing = false;
let capturingKey = null; // action key currently capturing

// ── Category colours (must match CSS) ───────────────────────
const CAT_COLOURS = {
  People: '#FCB415',
  Places: '#5CC2E6',
  Things: '#E94E67',
};

// ── Progress bar config ──────────────────────────────────────
function getProgressSteps() {
  const steps = [];
  let regIdx = 0;
  let bonIdx = 0;
  slides.forEach(s => {
    if (s.type !== 'question') return;
    if (s.isBonus) {
      bonIdx++;
      steps.push({ label: s.label, display: "★", bonus: true });
    } else {
      regIdx++;
      steps.push({ label: s.label, display: String(regIdx), bonus: false });
    }
  });
  return steps;
}

// ── Assign Slide Labels ──────────────────────────────────────
function assignSlideLabels() {
  let regCount = 0;
  let bonCount = 0;
  slides.forEach(s => {
    if (s.type !== 'question') return;
    if (s.isBonus) {
      bonCount++;
      s.label = 'Bonus Question ' + bonCount;
    } else {
      regCount++;
      s.label = 'Round ' + regCount;
    }
  });
}

// ── Data loading ─────────────────────────────────────────────
async function loadWeeklyQuestions() {
  const res = await fetch("data/weekly.csv");
  const text = await res.text();
  return parseWeeklyCSV(text);
}

function parseWeeklyCSV(text) {
  const rows = parseCSVWithHeaders(text);
  const result = {};
  for (const row of rows) {
    if (row.label && row.category && row.question) {
      const answerOptions = [];
      for (let i = 1; i <= 8; i++) {
        const val = row[`answer_option_${i}`];
        if (val != null) answerOptions.push(val);
      }
      result[row.label] = {
        category: row.category,
        question: row.question,
        answer: row.answer || "",
        answerOptions,
      };
    }
  }
  return result;
}

function getWeeklyHash(obj) { return JSON.stringify(obj); }

// ── Question bank (CSV) ──────────────────────────────────────
function parseCSV(text) {
  const rows = [];
  let i = 0;
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM
  while (i < text.length) {
    const cols = [];
    while (i < text.length && text[i] !== '\n') {
      if (text[i] === '"') {
        i++;
        let val = '';
        while (i < text.length) {
          if (text[i] === '"' && text[i + 1] === '"') { val += '"'; i += 2; }
          else if (text[i] === '"') { i++; break; }
          else { val += text[i++]; }
        }
        cols.push(val.replace(/\n/g, ' ').trim());
      } else {
        let val = '';
        while (i < text.length && text[i] !== ',' && text[i] !== '\n') val += text[i++];
        cols.push(val.trim());
      }
      if (text[i] === ',') i++;
    }
    if (text[i] === '\n') i++;
    if (cols.length >= 2 && cols[0]) rows.push({ question: cols[0], answer: cols[1] });
  }
  return rows;
}

function parseCSVWithHeaders(text) {
  const rows = [];
  let i = 0;
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM

  // Parse header row
  const headers = [];
  while (i < text.length && text[i] !== '\n') {
    if (text[i] === '"') {
      i++;
      let val = '';
      while (i < text.length) {
        if (text[i] === '"' && text[i + 1] === '"') { val += '"'; i += 2; }
        else if (text[i] === '"') { i++; break; }
        else { val += text[i++]; }
      }
      headers.push(val.trim());
    } else {
      let val = '';
      while (i < text.length && text[i] !== ',' && text[i] !== '\n') val += text[i++];
      headers.push(val.trim());
    }
    if (text[i] === ',') i++;
  }
  if (text[i] === '\n') i++;

  // Parse data rows
  while (i < text.length) {
    const cols = [];
    while (i < text.length && text[i] !== '\n') {
      if (text[i] === '"') {
        i++;
        let val = '';
        while (i < text.length) {
          if (text[i] === '"' && text[i + 1] === '"') { val += '"'; i += 2; }
          else if (text[i] === '"') { i++; break; }
          else { val += text[i++]; }
        }
        cols.push(val.replace(/\n/g, ' ').trim());
      } else {
        let val = '';
        while (i < text.length && text[i] !== ',' && text[i] !== '\n') val += text[i++];
        cols.push(val.trim());
      }
      if (text[i] === ',') i++;
    }
    if (text[i] === '\n') i++;

    // Build row object from headers
    if (cols.length >= 2 && cols[0]) {
      const row = {};
      headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });
      rows.push(row);
    }
  }
  return rows;
}

async function loadQuestionBank(category) {
  if (questionBank[category]) return questionBank[category];
  const fileMap = { People: 'people_questions', Places: 'places_questions', Things: 'things_questions' };
  const file = fileMap[category];
  if (!file) return [];
  try {
    const res = await fetch(`data/${file}.csv`);
    const text = await res.text();
    questionBank[category] = parseCSV(text);
  } catch (e) {
    questionBank[category] = [];
  }
  return questionBank[category];
}

// ── Answer options bank (first column of answers CSV) ───────
async function loadAnswersBank(category) {
  if (answersBank[category]) return answersBank[category];
  const fileMap = { People: 'people_answers', Places: 'places_answers', Things: 'things_answers' };
  const file = fileMap[category];
  if (!file) return [];
  try {
    const res = await fetch(`data/${file}.csv`);
    const text = await res.text();
    // Parse only first column
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const answers = [];
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      let val;
      if (line.startsWith('"')) {
        const end = line.indexOf('"', 1);
        val = line.slice(1, end === -1 ? undefined : end).replace(/\n/g, ' ').trim();
      } else {
        val = line.split(',')[0].trim();
      }
      if (val) answers.push(val);
    }
    answersBank[category] = answers;
  } catch (e) {
    answersBank[category] = [];
  }
  return answersBank[category];
}

function pickAnswerOptions(category, count) {
  const bank = answersBank[category] || [];
  if (!bank.length) return [];
  const shuffled = [...bank].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

async function randomiseQuestion(slideIndex) {
  const slide = slides[slideIndex];
  if (!slide || slide.type !== 'question') return;
  const bank = await loadQuestionBank(slide.category);
  if (!bank.length) return;
  // Avoid repeating questions already used in other rounds
  const usedQuestions = slides
    .filter((s, i) => s.type === 'question' && i !== slideIndex && s.question)
    .map(s => s.question);
  const available = bank.filter(q => !usedQuestions.includes(q.question));
  const pool = available.length ? available : bank;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  slide.question = pick.question;
  slide.answer = pick.answer;
  localStorage.setItem('triviaData', JSON.stringify(slides));
  buildEditor(slides);
}

async function randomiseAnswerOptions(slideIndex) {
  const slide = slides[slideIndex];
  if (!slide || slide.type !== 'question') return;
  const bank = await loadAnswersBank(slide.category);
  if (!bank.length) return;
  // Exclude the real answer from the pool
  const realAnswer = (slide.answer || '').toLowerCase().trim();
  const pool = bank.filter(a => a.toLowerCase().trim() !== realAnswer);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  slide.answerOptions = shuffled.slice(0, answersCount);
  localStorage.setItem('triviaData', JSON.stringify(slides));
  buildEditor(slides);
}

function buildSlides() {
  return [
    { type: "title", text: "Welcome to Liar's Trivia!", img: "lt_logo_motion" },
    { type: "intro", text: "Pathological is a trivia game, but… You don't have to know the right answer!" },
    { type: "tutorial", text: "Your answer sheet looks like this:", img: "tutorial_sheet" },
    { type: "tutorial", text: "Pick the answer you like and have 30 seconds to justify it.", img: "tutorial_sheet2" },
    { type: "tutorial", text: "The best two answers can either Make Peace or go Double or Nothing!", img: "tutorial_decision" },
    { type: "tutorial", text: "Go to @pathologicalgame on Instagram for bonus question sneak peeks.", img: "tutorial_ig" },
  ];
}


async function loadTriviaData() {
  const stored = localStorage.getItem("triviaData");
  const storedHash = localStorage.getItem("weeklyHash");
  const weeklyQuestions = await loadWeeklyQuestions();
  const currentHash = getWeeklyHash(weeklyQuestions);

  if (storedHash && storedHash !== currentHash) {
    document.getElementById("updateNotice").style.display = "block";
  }
  weeklyVersion = currentHash;

  if (stored) {
    const parsed = JSON.parse(stored);
    parsed.forEach(s => {
      if (s.type === 'question' && s.isBonus === undefined) s.isBonus = false;
    });
    return parsed;
  }

  // Parse weekly.json dynamically — extract all question entries
  const framework = buildSlides();
  const questions = [];
  const closing = [
    { type: "promo", text: "Visit pathologicalgame.com!", img: "promo2" },
    { type: "score", text: "Tallying scores..." },
    { type: "title", text: "Thanks for playing!", img: "lt_logo_motion" },
  ];

  for (const [label, data] of Object.entries(weeklyQuestions)) {
    if (data && typeof data === 'object' && data.question) {
      questions.push({
        type: "question",
        label: label,
        category: data.category || "",
        question: data.question,
        answer: data.answer || "",
        answerOptions: data.answerOptions || [],
        isBonus: label.toLowerCase().includes("bonus"),
      });
    }
  }

  const all = [...framework, ...questions, ...closing];
  const slidesArr = showPromos ? all : all.filter(s => s.type !== "promo");
  assignSlideLabels();
  localStorage.setItem("triviaData", JSON.stringify(slidesArr));
  localStorage.setItem("weeklyHash", currentHash);
  return slidesArr;
}


// ── Editor ───────────────────────────────────────────────────
function buildEditor(slides) {
  const editor = document.getElementById("editorFields");
  // Remove old question rows and intermission row but keep the header
  editor.querySelectorAll(".qrow, .intermission-row").forEach(el => el.remove());

  const totalQuestions = slides.filter(s => s.type === "question").length;
  // Clamp intermission position
  if (intermissionAfterRound < 1) intermissionAfterRound = 1;
  if (intermissionAfterRound >= totalQuestions) intermissionAfterRound = totalQuestions - 1;
  if (totalQuestions < 2) intermissionOn = false;

  let questionNum = 0;

  slides.forEach((slide, i) => {
    if (slide.type !== "question") return;
    questionNum++;
    const catClass = { People: "cat-people", Places: "cat-places", Things: "cat-things" }[slide.category] || "";
    const roundNum = slides.filter((s, j) => s.type === 'question' && !s.isBonus && j <= i).length;
    const bonusNum = slides.filter((s, j) => s.type === 'question' && j <= i).length;
    const displayNum = slide.isBonus ? bonusNum : roundNum;

    const row = document.createElement("div");
    row.className = "qrow";
    row.dataset.index = i;
    const opts = slide.answerOptions || [];
    const aoSection = answersMode ? `
      <div class="qrow-ao-section">
        <div class="qrow-ao-header">
          <span class="qrow-ao-title">Answer Options</span>
          <button class="qrow-ao-randall" data-randao="${i}" title="Randomise all answer options">🎲 Randomise</button>
        </div>
        ${Array.from({ length: answersCount }, (_, k) => `
          <div class="qrow-aorow">
            <span class="qrow-ao-label">${k + 1}</span>
            <input class="qrow-ao-input" value="${(opts[k] || '').replace(/"/g, '&quot;')}" data-ao="${i}" data-aoidx="${k}" placeholder="Answer option ${k + 1}…">
          </div>
        `).join('')}
      </div>` : '';

    row.innerHTML = `
      <div class="qrow-main">
        <button class="qrow-bonus-toggle ${slide.isBonus ? 'bonus-active' : ''}" data-bonus="${i}" title="Toggle regular/bonus">
          <span class="bonus-number">${displayNum}</span>
          <span class="bonus-star">${'★'}</span>
        </button>
        <select class="qrow-cat ${catClass}" data-c="${i}">
          <option value="People"  ${slide.category === "People" ? "selected" : ""}>People</option>
          <option value="Places"  ${slide.category === "Places" ? "selected" : ""}>Places</option>
          <option value="Things"  ${slide.category === "Things" ? "selected" : ""}>Things</option>
        </select>
        <input class="qrow-question" value="${slide.question.replace(/"/g, '&quot;')}" data-q="${i}" placeholder="Question…">
        <button class="qrow-rand" data-rand="${i}" title="Randomise question">🎲</button>
        <button class="qrow-toggle" data-toggle="${i}">▼</button>
      </div>
      <div class="qrow-answer hidden">
        <input value="${slide.answer.replace(/"/g, '&quot;')}" data-a="${i}" placeholder="Answer…">
      </div>
      ${aoSection}
    `;
    editor.appendChild(row);

    // Insert intermission divider after the Nth question
    if (intermissionOn && questionNum === intermissionAfterRound) {
      const interRow = document.createElement("div");
      interRow.className = "intermission-row";
      interRow.innerHTML = `
        <div class="intermission-line"></div>
        <button class="intermission-arrow" id="interUp" ${intermissionAfterRound <= 1 ? 'disabled' : ''}>▲</button>
        <button class="intermission-toggle intermission-on">Intermission: ON</button>
        <button class="intermission-arrow" id="interDown" ${intermissionAfterRound >= totalQuestions - 1 ? 'disabled' : ''}>▼</button>
        <div class="intermission-line"></div>
      `;
      editor.appendChild(interRow);
    }
  });

  // If intermission is off but there are enough questions, show a dimmed divider at current position
  if (!intermissionOn && totalQuestions >= 2) {
    const lastQIdx = intermissionAfterRound;
    // Find the last qrow before position
    let inserted = false;
    let qNum = 0;
    editor.querySelectorAll(".qrow").forEach(qrow => {
      qNum++;
      if (qNum === lastQIdx && !inserted) {
        const interRow = document.createElement("div");
        interRow.className = "intermission-row";
        interRow.innerHTML = `
          <div class="intermission-line"></div>
          <button class="intermission-arrow" id="interUp" disabled>▲</button>
          <button class="intermission-toggle">Intermission: OFF</button>
          <button class="intermission-arrow" id="interDown" disabled>▼</button>
          <div class="intermission-line"></div>
        `;
        qrow.parentNode.insertBefore(interRow, qrow.nextSibling);
        inserted = true;
      }
    });
  }

  // Category pill colour on change
  editor.querySelectorAll(".qrow-cat").forEach(sel => {
    sel.addEventListener("change", () => {
      sel.className = "qrow-cat " + ({ People: "cat-people", Places: "cat-places", Things: "cat-things" }[sel.value] || "");
    });
  });

  // Toggle answer row
  editor.querySelectorAll(".qrow-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = btn.dataset.toggle;
      const ansRow = editor.querySelector(`.qrow[data-index="${idx}"] .qrow-answer`);
      const isOpen = !ansRow.classList.contains("hidden");
      ansRow.classList.toggle("hidden", isOpen);
      btn.textContent = isOpen ? "▼" : "▲";
    });
  });

  // Randomise question button
  editor.querySelectorAll(".qrow-rand").forEach(btn => {
    btn.addEventListener("click", async () => {
      readEditorChanges(slides);
      btn.textContent = "⏳";
      btn.disabled = true;
      await randomiseQuestion(parseInt(btn.dataset.rand));
    });
  });

  // Randomise answer options button
  editor.querySelectorAll(".qrow-ao-randall").forEach(btn => {
    btn.addEventListener("click", async () => {
      readEditorChanges(slides);
      btn.textContent = "⏳";
      btn.disabled = true;
      await randomiseAnswerOptions(parseInt(btn.dataset.randao));
    });
  });

  editor.querySelectorAll(".qrow-bonus-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.bonus);
      readEditorChanges(slides);
      slides[idx].isBonus = !slides[idx].isBonus;
      assignSlideLabels();
      localStorage.setItem('triviaData', JSON.stringify(slides));
      buildProgressBar();
      buildEditor(slides);
    });
  });

  // Intermission toggle
  const interToggle = editor.querySelector(".intermission-toggle");
  if (interToggle) {
    interToggle.addEventListener("click", () => {
      intermissionOn = !intermissionOn;
      localStorage.setItem('intermissionOn', intermissionOn);
      buildEditor(slides);
    });
  }

  // Intermission up arrow
  const interUp = editor.querySelector("#interUp");
  if (interUp) {
    interUp.addEventListener("click", () => {
      if (intermissionAfterRound > 1) {
        intermissionAfterRound--;
        localStorage.setItem('intermissionAfterRound', intermissionAfterRound);
        buildEditor(slides);
      }
    });
  }

  // Intermission down arrow
  const interDown = editor.querySelector("#interDown");
  if (interDown) {
    interDown.addEventListener("click", () => {
      const total = slides.filter(s => s.type === "question").length;
      if (intermissionAfterRound < total - 1) {
        intermissionAfterRound++;
        localStorage.setItem('intermissionAfterRound', intermissionAfterRound);
        buildEditor(slides);
      }
    });
  }
}

function readEditorChanges(slides) {
  document.querySelectorAll("[data-c]").forEach(el => { slides[el.dataset.c].category = el.value; });
  document.querySelectorAll("[data-q]").forEach(el => { slides[el.dataset.q].question = el.value; });
  document.querySelectorAll("[data-a]").forEach(el => { slides[el.dataset.a].answer = el.value; });
  // Read answer option inputs back into slide.answerOptions
  document.querySelectorAll("[data-ao]").forEach(el => {
    const si = parseInt(el.dataset.ao);
    const ki = parseInt(el.dataset.aoidx);
    if (!slides[si].answerOptions) slides[si].answerOptions = [];
    slides[si].answerOptions[ki] = el.value;
  });
  localStorage.setItem("triviaData", JSON.stringify(slides));
}

// ── Progress Bar ─────────────────────────────────────────────
function buildProgressBar() {
  let bar = document.getElementById("progressBar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "progressBar";
    const pres = document.getElementById("presentation");
    pres.insertBefore(bar, document.getElementById("slide"));
  }
  bar.innerHTML = "";

  getProgressSteps().forEach((step, idx) => {
    const item = document.createElement("div");
    item.className = "prog-item" + (step.bonus ? " bonus" : "");
    item.dataset.step = idx;
    item.innerHTML = `
      <div class="prog-badge"></div>
      <span class="prog-item-number">${step.display}</span>
    `;
    item.addEventListener("click", () => {
      // Find the slide index for this step
      let qCount = 0;
      for (let i = 0; i < slides.length; i++) {
        if (slides[i].type !== "question") continue;
        qCount++;
        if (qCount === idx + 1) {
          current = i;
          showSlide();
          break;
        }
      }
    });
    bar.appendChild(item);
  });
}

function updateProgressBar(slide) {
  const bar = document.getElementById("progressBar");
  if (!bar) return;

  const isQuestion = slide && slide.type === "question";
  bar.classList.toggle("hidden", !isQuestion);

  document.querySelectorAll(".prog-item").forEach(el => {
    el.classList.remove("active", "done");
  });

  if (!isQuestion) return;

  const stepIdx = getProgressSteps().findIndex(s => s.label === slide.label);
  if (stepIdx === -1) return;

  const bgColour = CAT_COLOURS[slide.category] || '#5CC2E6';

  document.querySelectorAll(".prog-item").forEach((el, idx) => {
    const numEl = el.querySelector(".prog-item-number");
    if (idx < stepIdx) {
      el.classList.add("done");
      if (numEl) numEl.style.color = "#ffffff";
    }
    if (idx === stepIdx) {
      el.classList.add("active");
      if (numEl) numEl.style.color = bwMode ? "#000000" : bgColour;
    }
    if (idx > stepIdx) {
      if (numEl) numEl.style.color = bwMode ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.45)";
    }
  });
}

// ── Background colour ─────────────────────────────────────────
function setCategoryBackground(slide) {
  const pres = document.getElementById("presentation");
  pres.classList.remove("cat-people", "cat-places", "cat-things");
  if (slide && slide.type === "question") {
    const map = { People: "cat-people", Places: "cat-places", Things: "cat-things" };
    if (map[slide.category]) pres.classList.add(map[slide.category]);
  }
}

// ── Slide Rendering ──────────────────────────────────────────
// ── Answer options ───────────────────────────────────────────
async function getAnswerOptionsForSlide(slide) {
  if (!slide || slide.type !== 'question') return [];

  // Use editor-set options first
  let picks = (slide.answerOptions || []).filter(Boolean);

  // Fall back to random options if empty
  if (!picks.length) {
    const bank = await loadAnswersBank(slide.category);
    const realAnswer = (slide.answer || '').toLowerCase().trim();
    const pool = bank.filter(a => a.toLowerCase().trim() !== realAnswer);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    picks = shuffled.slice(0, Math.max(1, answersCount));
  }

  return picks;
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randomQuestionFrame() {
  const cols = 5;
  const rows = 30;
  const total = cols * rows;
  const frame = Math.floor(Math.random() * total);
  const col = frame % cols;
  const row = Math.floor(frame / cols);
  return { frame, col, row };
}

const SPRITE_COLS = 5;
const SPRITE_ROWS = 30;
const SPRITE_TOTAL = SPRITE_COLS * SPRITE_ROWS;

function frameToCoords(frame) {
  return {
    col: frame % SPRITE_COLS,
    row: Math.floor(frame / SPRITE_COLS)
  };
}

function setSpriteFrame(el, frame) {
  const wrapped = ((frame % SPRITE_TOTAL) + SPRITE_TOTAL) % SPRITE_TOTAL;
  const { col, row } = frameToCoords(wrapped);
  el.style.setProperty('--sprite-col', col);
  el.style.setProperty('--sprite-row', row);
}

function adaptAnswerCardsLayout() {
  const grid = document.getElementById('answerCards');
  const qWrap = document.getElementById('questionWrap');
  const qText = document.getElementById('questionText');
  const slide = document.getElementById('slide');
  if (!grid || !qWrap || !qText || !slide) return;

  const cardCount = grid.querySelectorAll('.answer-card').length;
  if (cardCount <= 5) {
    grid.style.gridTemplateColumns = `repeat(${cardCount}, minmax(14rem, 1fr))`;
  } else {
    grid.style.gridTemplateColumns = 'repeat(2, minmax(14rem, 1fr))';
  }

  requestAnimationFrame(() => {
    const slideH = slide.clientHeight;
    const qH = qText.getBoundingClientRect().height;
    const gap = parseFloat(getComputedStyle(qWrap).gap) || 32;
    const cardsH = slideH * 0.55;

    const totalNeeded = qH + cardsH + gap;

    if (totalNeeded > slideH && slideH > 0) {
      const scale = Math.max(0.5, slideH / totalNeeded);
      qText.style.fontSize = `clamp(18px, ${6 * scale}vw, ${80 * scale}px)`;
      qWrap.style.setProperty('--scale', scale);
    } else {
      qText.style.fontSize = '';
      qWrap.style.setProperty('--scale', 1);
    }
  });
}

function startCardSpriteAnimations() {
  const sprites = document.querySelectorAll('.answer-card-sprite');

  sprites.forEach(sprite => {
    const startFrame = Math.floor(Math.random() * SPRITE_TOTAL);
    const fps = 24 + Math.random() * 6; // slightly varied per card
    let frame = startFrame;

    setSpriteFrame(sprite, frame);

    if (sprite._spriteInterval) clearInterval(sprite._spriteInterval);

    sprite._spriteInterval = setInterval(() => {
      frame = (frame + 1) % SPRITE_TOTAL;
      setSpriteFrame(sprite, frame);
    }, 1000 / fps);
  });
}

function buildAnswerCardsMarkup(options) {
  if (!options.length) return '';

  return `
    <div id="answerCards" class="answer-cards-grid">
      ${options.map((text, idx) => {
    const rot = rand(-2, 2).toFixed(2);
    const driftX = rand(-8, 8).toFixed(2);
    const driftY = rand(-6, 6).toFixed(2);
    const dur = rand(3.8, 6.5).toFixed(2);
    const delay = rand(0, 2.5).toFixed(2);
    const frame = randomQuestionFrame();

    return `
          <div 
            class="answer-card" 
            data-idx="${idx}"
            data-rot="${rot}"
            style="
              --card-rot:${rot}deg;
              --float-x:${driftX}px;
              --float-y:${driftY}px;
              --float-dur:${dur}s;
              --float-delay:${delay}s;
              --card-stagger:${idx};
              --sprite-col:${frame.col};
              --sprite-row:${frame.row};
            "
          >
            <div class="answer-card-inner">
              <div class="answer-card-face answer-card-front">
                <div class="answer-card-sprite"></div>
              </div>
              <div class="answer-card-face answer-card-back">
                <span class="answer-card-text">${text}</span>
              </div>
            </div>
          </div>
        `;
  }).join('')}
    </div>
  `;
}

function toggleAnswerCard(n) {
  const cards = document.querySelectorAll('.answer-card');
  if (n < 1 || n > cards.length) return;

  const card = cards[n - 1];

  // If card is revealed, toggle "used" opacity instead of flipping
  if (card.classList.contains("flipped")) {
    card.classList.toggle("used");
  } else {
    card.classList.toggle("flipped");
  }
}

function toggleAllAnswerCards() {
  const cards = document.querySelectorAll('.answer-card');
  if (!cards.length) return;

  const allFlipped = [...cards].every(card => card.classList.contains("flipped"));

  cards.forEach(card => {
    card.classList.remove("used"); // reset dimming when mass flipping
    if (allFlipped) {
      card.classList.remove("flipped");
    } else {
      card.classList.add("flipped");
    }
  });
}

function clearAnswerOptions() {
  const el = document.getElementById('answerCards');
  if (el) el.remove();
}

async function renderSlide(slide) {
  const container = document.getElementById("slide");
  const timerBarContainer = document.getElementById("timerBarContainer");
  const timerText = document.getElementById("timerText");
  const bgColour = CAT_COLOURS[slide.category] || '#5CC2E6';
  if (!slide) return;

  if (promoInterval) { clearInterval(promoInterval); promoInterval = null; }
  clearAnswerOptions();
  stopCardSpriteAnimations();

  timerBarContainer.style.opacity = slide.type === "question" ? "1" : "0";
  timerText.style.color = bwMode ? "#000000" : bgColour;

  if (slide.type === "title" || slide.type === "end") {
    container.className = "full-height";

    // LIARS TRIVIA TITLE SCREEN
    container.innerHTML = `
    <div class="title-frame">
        <img src="img/${slide.img}.gif" alt="" class="title-img" onerror="this.style.display='none'">
    </div>
    `;

    //COMEDY SHOW TITLE SCREEN
    // container.innerHTML = `
    // <div class="title-frame">
    //   <div class="logo-frame">
    //     <h1 class="title-text">PATH</h1>
    //     <div class="title-gif-wrapper">
    //       <img class="title-gif" src="img/question.gif" alt="">
    //     </div>
    //     <h1 class="title-text">GICAL</h1>
    //     </div>
    //     <h2 class="subtitle-text">THE COMEDY GAME SHOW</h2>
    // </div>
    // `;

  } else if (slide.type === "intro" || slide.type === "end") {
    container.className = "full-height";
    container.innerHTML = `
    <h1 class="tutorial-text">
      ${slide.text}
    </h1>
    `;

  } else if (slide.type === "tutorial" || slide.type === "end") {
    container.className = "full-height";
    container.innerHTML = `
    <h1 class="tutorial-text">
      ${slide.text}
    </h1>
    <div class="tutorial-frame">
        <img src="img/${slide.img}.png" alt="" class="tutorial-img" onerror="this.style.display='none'">
    </div>
    `;

  } else if (slide.type === "score") {
    container.className = "full-height";
    container.innerHTML = `
      <div class="score-header">
        <img class="score-gif" src="img/question.gif" alt="">
        <h1 class="tutorial-text">${slide.text}</h1>
      </div>
      <div class="promo-frame">
        <img id="promoImg" src="img/endpromo1.png" alt="" class="promo-img" onerror="this.style.display='none'">
      </div>
    `;
    const promoImages = ["img/endpromo1.png", "img/endpromo2.png", "img/endpromo3.png"];
    let promoIndex = 0;
    promoInterval = setInterval(() => {
      promoIndex = (promoIndex + 1) % promoImages.length;
      const el = document.getElementById("promoImg");
      if (!el) return;
      el.style.opacity = "0";
      setTimeout(() => {
        el.src = promoImages[promoIndex];
        el.style.display = "";
        el.onerror = () => { el.style.display = "none"; };
        el.style.opacity = "1";
      }, 800);
    }, 8000);

  } else if (slide.type === "promo") {
    container.className = "full-height";
    container.innerHTML = `
      <div class="promo-frame">
        <img src="img/${slide.img}.png" alt="" class="promo-img" onerror="this.style.display='none'">
      </div>
      <h1 class="promo">${slide.text}</h1>
    `;

  } else if (slide.type === "intermission") {
    container.className = "full-height";
    container.innerHTML = `
      <div class="score-header">
        <img class="score-gif" src="img/question.gif" alt="">
        <h1 class="tutorial-text">${slide.text}</h1>
      </div>
      <div class="promo-frame">
        <img id="promoImg" src="img/endpromo1.png" alt="" class="promo-img" onerror="this.style.display='none'">
      </div>
    `;
    const promoImages = ["img/endpromo1.png", "img/endpromo2.png", "img/endpromo3.png"];
    let promoIndex = 0;
    promoInterval = setInterval(() => {
      promoIndex = (promoIndex + 1) % promoImages.length;
      const el = document.getElementById("promoImg");
      if (!el) return;
      el.style.opacity = "0";
      setTimeout(() => {
        el.src = promoImages[promoIndex];
        el.style.display = "";
        el.onerror = () => { el.style.display = "none"; };
        el.style.opacity = "1";
      }, 800);
    }, 8000);

  } else if (slide.type === "question") {
    container.className = "";
    const catSymbols = {
      People: '<img src="img/people_badge.svg" alt="People">',
      Places: '<img src="img/places_badge.svg" alt="Places">',
      Things: '<img src="img/things_badge.svg" alt="Things">',
    };
    const symbol = catSymbols[slide.category] || "";

    let answerCardsHTML = '';
    if (answersMode) {
      const options = await getAnswerOptionsForSlide(slide);
      answerCardsHTML = buildAnswerCardsMarkup(options);
    }

    container.innerHTML = `
      ${!answersMode ? `<div class="cat-pill">
        <span class="cat-pill-icon">${symbol}</span>
        <span class="cat-pill-label">${slide.category} Question</span>
      </div>` : ''}

      <div id="questionWrap" class="${answersMode ? 'question-wrap-with-cards' : ''}">
        <h1 id="questionText" class="${!answersMode ? 'blurred' : ''}">${slide.question}</h1>
        ${!answersMode ? '<img id="slideGif" src="img/question.gif" alt="">' : ''}
        ${answerCardsHTML}
      </div>

      <div id="answer" style="${answersMode ? 'display:none' : 'opacity:0'}">${slide.answer}</div>
    `;
    resetTimer();
    container.querySelectorAll('.answer-card').forEach((card, idx) => {
      card.addEventListener('click', () => {
        toggleAnswerCard(idx + 1);
      });
    });

    startCardSpriteAnimations();
    adaptAnswerCardsLayout();
  }

  setCategoryBackground(slide);
  updateProgressBar(slide);

  requestAnimationFrame(() => {
    container.classList.remove('slide-enter');
    void container.offsetWidth; // restart animation
    container.classList.add('slide-enter');

    const qWrap = document.getElementById('questionWrap');
    if (qWrap) {
      qWrap.classList.remove('question-animate');
      void qWrap.offsetWidth;
      qWrap.classList.add('question-animate');
    }
  });
}

async function showSlide(direction = 0) {
  if (!slides || slides.length === 0) return;
  if (current < 0) current = 0;
  if (current >= slides.length) current = slides.length - 1;
  // Skip promo slides when promos are disabled
  if (!showPromos && slides[current].type === 'promo') {
    current += direction >= 0 ? 1 : -1;
    showSlide(direction);
    return;
  }
  await renderSlide(slides[current]);
}

function revealQuestion() {
  const q = document.getElementById("questionText");
  if (q) {
    q.classList.remove("blurred");
    q.style.transform = "translateY(0)";
    q.style.opacity = "1";
  }

  const gif = document.getElementById("slideGif");
  if (gif) {
    gif.style.opacity = "0";
    gif.style.pointerEvents = "none";
  }
}

function stopCardSpriteAnimations() {
  document.querySelectorAll('.answer-card-sprite').forEach(sprite => {
    if (sprite._spriteInterval) {
      clearInterval(sprite._spriteInterval);
      sprite._spriteInterval = null;
    }
  });
}

// ── Answers mode ─────────────────────────────────────────────
function toggleAnswersMode(on) {
  answersMode = on;
  clearAnswerOptions();
}

function updateAnswersCount(val) {
  answersCount = Math.max(1, Math.min(8, parseInt(val) || 4));
  clearAnswerOptions();
}

// ── Promo toggle ──────────────────────────────────────────────
function toggleShowPromos(on) {
  showPromos = on;
}

// ── B&W Mode ──────────────────────────────────────────────────
function toggleBWMode() {
  bwMode = !bwMode;
  document.body.classList.toggle("bw-mode", bwMode);
  if (slides[current]) updateProgressBar(slides[current]);
}

// ── Fullscreen ────────────────────────────────────────────────
function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
}

// ── Keyboard shortcuts ────────────────────────────────────────
function displayKeyName(key) {
  if (key === ' ') return 'SPACE';
  if (key === 'ArrowRight') return '➡';
  if (key === 'ArrowLeft') return '⬅';
  if (key === 'ArrowUp') return '⬆';
  if (key === 'ArrowDown') return '⬇';
  return key.toUpperCase();
}

function buildShortcutList() {
  const list = document.getElementById('shortcutList');
  list.innerHTML = '';
  for (const [action, cfg] of Object.entries(shortcuts)) {
    if (action === 'toggleCards') continue; // special: 1–9
    const li = document.createElement('li');
    const keyClass = shortcutEditing ? 'shortcut-key clickable' : 'shortcut-key';
    const capturingClass = capturingKey === action ? ' capturing' : '';
    li.innerHTML = `
      <span class="shortcut-action">${cfg.action}</span>
      <span class="${keyClass}${capturingClass}" data-action="${action}">${displayKeyName(cfg.key)}</span>
    `;
    list.appendChild(li);
  }
  // Always show the 1–9 row (non-editable)
  const li9 = document.createElement('li');
  li9.innerHTML = `
    <span class="shortcut-action">Toggle Card Used</span>
    <span class="shortcut-key">1–9</span>
  `;
  list.appendChild(li9);

  // Wire up click-to-capture in edit mode
  if (shortcutEditing) {
    list.querySelectorAll('.shortcut-key.clickable').forEach(el => {
      el.addEventListener('click', () => {
        const action = el.dataset.action;
        if (capturingKey === action) {
          capturingKey = null;
        } else {
          capturingKey = action;
        }
        buildShortcutList();
      });
    });
  }
}

function toggleShortcutEdit() {
  shortcutEditing = !shortcutEditing;
  capturingKey = null;
  const btn = document.getElementById('shortcutEditBtn');
  const resetBtn = document.getElementById('shortcutResetBtn');
  btn.textContent = shortcutEditing ? 'Done' : 'Edit';
  resetBtn.classList.toggle('visible', shortcutEditing);
  buildShortcutList();
}

function resetShortcuts() {
  shortcuts = JSON.parse(JSON.stringify(DEFAULT_SHORTCUTS));
  capturingKey = null;
  localStorage.setItem('shortcuts', JSON.stringify(shortcuts));
  buildShortcutList();
}

function saveShortcuts() {
  localStorage.setItem('shortcuts', JSON.stringify(shortcuts));
}

// ── Filter slides per display toggles ─────────────────────────
function getVisibleSlides() {
  return slides.filter(s => {
    if (s.type !== 'tutorial') return true;
    if (s.text && s.text.toLowerCase().includes('bonus question sneak peeks'))
      return showTutorials || showBonusPromo;
    return showTutorials;
  });
}

// ── Build presentation slides (with intermission if enabled) ──
function buildPresentationSlides() {
  const base = [...slides];
  if (!intermissionOn) return base;

  const questions = base.filter(s => s.type === "question");
  // Find the index in base of the question after which the intermission goes
  let qCount = 0;
  for (let i = 0; i < base.length; i++) {
    if (base[i].type === "question") {
      qCount++;
      if (qCount === intermissionAfterRound) {
        const intermission = { type: "intermission", text: "Intermission Break" };
        const result = [...base];
        result.splice(i + 1, 0, intermission);
        return result;
      }
    }
  }
  return base;
}

// ── Boot ──────────────────────────────────────────────────────
async function startApp() {
  slides = await loadTriviaData();
  questionCount = slides.filter(s => s.type === 'question').length;

  answersMode = localStorage.getItem('answerOptionsMode') === 'true';
  answersCount = parseInt(localStorage.getItem('answerOptionCount') || '4');
  showPromos = localStorage.getItem('showPromos') !== 'false';
  showTutorials = localStorage.getItem('showTutorials') !== 'false';
  showBonusPromo = localStorage.getItem('showBonusPromo') !== 'false';
  bwMode = localStorage.getItem('bwMode') === 'true';
  intermissionOn = localStorage.getItem('intermissionOn') === 'true';
  intermissionAfterRound = parseInt(localStorage.getItem('intermissionAfterRound') || '0');
  if (intermissionAfterRound < 1) intermissionAfterRound = Math.max(1, Math.floor(questionCount / 2));
  const storedShortcuts = localStorage.getItem('shortcuts');
  if (storedShortcuts) {
    try { shortcuts = JSON.parse(storedShortcuts); } catch(e) {}
  }
  document.body.classList.toggle("bw-mode", bwMode);

  buildEditor(slides);
  buildProgressBar();
  buildShortcutList();

  const aoToggle = document.getElementById('toggleAnswerOptions');
  const promoToggle = document.getElementById('togglePromos');
  const bwToggle = document.getElementById('toggleBWMode');
  const countVal = document.getElementById('answerCountVal');
  const qCountVal = document.getElementById('questionCountVal');
  const answerCountRow = document.getElementById('answerCountRow');

  if (aoToggle) aoToggle.checked = answersMode;
  if (promoToggle) promoToggle.checked = showPromos;
  if (bwToggle) bwToggle.checked = bwMode;
  if (countVal) countVal.textContent = answersCount;
  if (qCountVal) qCountVal.textContent = questionCount;
  if (answerCountRow) answerCountRow.classList.toggle('visible', answersMode);

  const tutToggle = document.getElementById('toggleTutorials');
  const bonusPromoToggle = document.getElementById('toggleBonusPromo');
  const bonusPromoRow = document.getElementById('bonusPromoRow');
  if (tutToggle) tutToggle.checked = showTutorials;
  if (bonusPromoToggle) bonusPromoToggle.checked = showBonusPromo;
  if (bonusPromoRow) bonusPromoRow.style.display = showTutorials ? 'none' : '';
}


startApp();

// ── Shortcut edit/reset buttons ────────────────────────────────
document.getElementById("shortcutEditBtn").addEventListener("click", toggleShortcutEdit);
document.getElementById("shortcutResetBtn").addEventListener("click", resetShortcuts);

// ── Auto-save on editor input (debounced) ─────────────────────
let _autoSaveTimer = null;
document.getElementById("editorFields").addEventListener("input", () => {
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(() => readEditorChanges(slides), 300);
});
document.getElementById("editorFields").addEventListener("change", () => {
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(() => readEditorChanges(slides), 100);
});

// ── Sidebar control wiring ────────────────────────────────────
document.getElementById("toggleAnswerOptions").addEventListener("change", e => {
  toggleAnswersMode(e.target.checked);
  localStorage.setItem('answerOptionsMode', answersMode);
  document.getElementById('answerCountRow').classList.toggle('visible', answersMode);
  readEditorChanges(slides);
  buildEditor(slides);
});

document.getElementById("toggleBWMode").addEventListener("change", e => {
  bwMode = e.target.checked;
  document.body.classList.toggle("bw-mode", bwMode);
  localStorage.setItem('bwMode', bwMode);
  if (slides[current]) updateProgressBar(slides[current]);
});

document.getElementById("answerCountMinus").addEventListener("click", () => {
  const val = Math.max(1, answersCount - 1);
  answersCount = val;
  localStorage.setItem('answerOptionCount', answersCount);
  document.getElementById("answerCountVal").textContent = val;
  clearAnswerOptions();
  if (answersMode) { readEditorChanges(slides); buildEditor(slides); }
});

document.getElementById("answerCountPlus").addEventListener("click", () => {
  const val = Math.min(8, answersCount + 1);
  answersCount = val;
  localStorage.setItem('answerOptionCount', answersCount);
  document.getElementById("answerCountVal").textContent = val;
  clearAnswerOptions();
  if (answersMode) { readEditorChanges(slides); buildEditor(slides); }
});

document.getElementById("questionCountMinus").addEventListener("click", () => {
  const val = Math.max(0, questionCount - 1);
  questionCount = val;
  document.getElementById("questionCountVal").textContent = val;
  readEditorChanges(slides);
  // Rebuild complete slides: framework + questions + closing
  const framework = buildSlides();
  const questions = [];
  const oldQuestions = slides.filter(s => s.type === 'question');
  for (let i = 0; i < questionCount; i++) {
    if (i < oldQuestions.length) {
      questions.push(oldQuestions[i]);
    } else {
      questions.push({ type: "question", category: "", question: "", answer: "", answerOptions: [], isBonus: false });
    }
  }
  const closing = [
    { type: "promo", text: "Visit pathologicalgame.com!", img: "promo2" },
    { type: "score", text: "Tallying scores..." },
    { type: "title", text: "Thanks for playing!", img: "lt_logo_motion" },
  ];
  const all = [...framework, ...questions, ...closing];
  slides = showPromos ? all : all.filter(s => s.type !== "promo");
  assignSlideLabels();
  localStorage.setItem('triviaData', JSON.stringify(slides));
  buildProgressBar();
  buildEditor(slides);
});

document.getElementById("questionCountPlus").addEventListener("click", () => {
  const val = Math.min(20, questionCount + 1);
  questionCount = val;
  document.getElementById("questionCountVal").textContent = val;
  readEditorChanges(slides);
  const framework = buildSlides();
  const questions = [];
  const oldQuestions = slides.filter(s => s.type === 'question');
  for (let i = 0; i < questionCount; i++) {
    if (i < oldQuestions.length) {
      questions.push(oldQuestions[i]);
    } else {
      questions.push({ type: "question", category: "", question: "", answer: "", answerOptions: [], isBonus: false });
    }
  }
  const closing = [
    { type: "promo", text: "Visit pathologicalgame.com!", img: "promo2" },
    { type: "score", text: "Tallying scores..." },
    { type: "title", text: "Thanks for playing!", img: "lt_logo_motion" },
  ];
  const all = [...framework, ...questions, ...closing];
  slides = showPromos ? all : all.filter(s => s.type !== "promo");
  assignSlideLabels();
  localStorage.setItem('triviaData', JSON.stringify(slides));
  buildProgressBar();
  buildEditor(slides);
});

document.getElementById("togglePromos").addEventListener("change", e => {
  toggleShowPromos(e.target.checked);
  localStorage.setItem('showPromos', showPromos);
});

document.getElementById("toggleTutorials").addEventListener("change", e => {
  showTutorials = e.target.checked;
  localStorage.setItem('showTutorials', showTutorials);
  document.getElementById('bonusPromoRow').style.display = showTutorials ? 'none' : '';
});

document.getElementById("toggleBonusPromo").addEventListener("change", e => {
  showBonusPromo = e.target.checked;
  localStorage.setItem('showBonusPromo', showBonusPromo);
});

// ── Button handlers ───────────────────────────────────────────
document.getElementById("startTrivia").onclick = () => {
  readEditorChanges(slides);
  // Filter out hidden slides per display toggles
  const filtered = getVisibleSlides();
  slides.length = 0;
  slides.push(...filtered);
  document.getElementById("editor").style.display = "none";
  document.getElementById("presentation").style.display = "block";
  // Rebuild progress bar to match filtered slide count
  buildProgressBar();
  // Build presentation slides with intermission if enabled
  const presSlides = buildPresentationSlides();
  slides.length = 0;
  slides.push(...presSlides);
  current = 0;
  showSlide();
};

document.getElementById("resetWeekly").onclick = () => {
  localStorage.removeItem("triviaData");
  localStorage.removeItem("weeklyHash");
  location.reload();
};

// ── Save Questions as CSV ────────────────────────────────────
document.getElementById("saveQuestionsBtn").onclick = () => {
  readEditorChanges(slides);
  const questionSlides = slides.filter(s => s.type === 'question');
  const emptyIdx = questionSlides.findIndex(s => !(s.question || '').trim());
  if (emptyIdx !== -1) {
    alert(`Question ${emptyIdx + 1} is empty. Please fill in all questions before saving.`);
    return;
  }
  let csv = 'label,category,question,answer,answer_option_1,answer_option_2,answer_option_3,answer_option_4,answer_option_5,answer_option_6,answer_option_7,answer_option_8\n';
  questionSlides.forEach(s => {
    const label = (s.label || '').replace(/"/g, '""');
    const category = (s.category || '').replace(/"/g, '""');
    const question = (s.question || '').replace(/"/g, '""');
    const answer = (s.answer || '').replace(/"/g, '""');
    const opts = s.answerOptions || [];
    const ao = Array.from({ length: 8 }, (_, i) => (opts[i] || '').replace(/"/g, '""'));
    csv += `"${label}","${category}","${question}","${answer}",${ao.map(v => `"${v}"`).join()}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'weekly.csv';
  a.click();
  URL.revokeObjectURL(url);
};

// ── Upload Questions from CSV ────────────────────────────────
document.getElementById("uploadQuestionsBtn").onclick = () => {
  document.getElementById("uploadQuestionsInput").click();
};

document.getElementById("uploadQuestionsInput").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (evt) => {
    const text = evt.target.result;
    const parsed = parseWeeklyCSV(text);
    // Convert to slides format
    const framework = buildSlides();
    const questions = [];
    const closing = [
      { type: "promo", text: "Visit pathologicalgame.com!", img: "promo2" },
      { type: "score", text: "Tallying scores..." },
      { type: "title", text: "Thanks for playing!", img: "lt_logo_motion" },
    ];
    for (const [label, data] of Object.entries(parsed)) {
      if (data && typeof data === 'object' && data.question) {
        questions.push({
          type: "question",
          label: label,
          category: data.category || "",
          question: data.question,
          answer: data.answer || "",
          answerOptions: data.answerOptions || [],
          isBonus: label.toLowerCase().includes("bonus"),
        });
      }
    }
    const all = [...framework, ...questions, ...closing];
    slides = showPromos ? all : all.filter(s => s.type !== "promo");
    questionCount = slides.filter(s => s.type === 'question').length;
    document.getElementById("questionCountVal").textContent = questionCount;
    assignSlideLabels();
    localStorage.setItem("triviaData", JSON.stringify(slides));
    buildProgressBar();
    buildEditor(slides);
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById("fullscreenBtn").onclick = toggleFullscreen;

let decisionActive = false;
let savedSlideHTML = '';

function toggleDecisionOverlay() {
  const slide = slides[current];
  if (!slide || slide.type !== "question" || slide.isBonus) return;
  const slideEl = document.getElementById('slide');
  const timerContainer = document.getElementById("timerBarContainer");

  if (decisionActive) {
    dismissDecision();
    return;
  }

  decisionActive = true;
  savedSlideHTML = slideEl.innerHTML;
  timerContainer.style.opacity = '0';

  slideEl.innerHTML = `
    <div class="decision-slide">
      <p class="decision-subtitle">Top 2 answers, would you like to:</p>
      <div class="decision-choices">
        <span class="decision-choice" id="makePeaceBtn">
          Make<br>Peace
          <span class="decision-points">1 point each</span>
        </span>
        <span class="decision-choice" id="doubleBtn">
          Double<br>or<br>Nothing
          <span class="decision-points">2 points to winner</span>
        </span>
      </div>
      <img class="decision-gif" src="img/decision.gif" alt="">
    </div>
  `;

  document.getElementById("makePeaceBtn").addEventListener("click", () => {
    dismissDecision();
    current++;
    showSlide();
  });
  document.getElementById("doubleBtn").addEventListener("click", () => {
    dismissDecision();
  });
}

function dismissDecision() {
  const slideEl = document.getElementById('slide');
  const timerContainer = document.getElementById("timerBarContainer");
  decisionActive = false;
  slideEl.innerHTML = savedSlideHTML;
  timerContainer.style.opacity = '1';
  startCardSpriteAnimations();
  const clickHandlers = slideEl.querySelectorAll('.answer-card');
  clickHandlers.forEach((card, idx) => {
    card.addEventListener('click', () => toggleAnswerCard(idx + 1));
  });
}

// ── Keyboard ──────────────────────────────────────────────────
document.addEventListener("keydown", e => {
  // If capturing a shortcut key in the editor
  if (capturingKey && document.getElementById("editor").style.display !== "none") {
    e.preventDefault();
    shortcuts[capturingKey].key = e.key;
    capturingKey = null;
    saveShortcuts();
    buildShortcutList();
    return;
  }

  if (document.getElementById("presentation").style.display === "none") return;

  const key = e.key;
  if (key === shortcuts.nextSlide.key) { current++; showSlide(1); }
  else if (key === shortcuts.prevSlide.key) { current--; showSlide(-1); }
  else if (key === shortcuts.startTimer.key) { e.preventDefault(); startTimer(); }
  else if (key.toLowerCase() === shortcuts.resetTimer.key) resetTimer();
  else if (key.toLowerCase() === shortcuts.revealQuestion.key) revealQuestion();
  else if (key.toLowerCase() === shortcuts.revealAnswer.key) {
    const ans = document.getElementById("answer");
    if (ans) ans.style.opacity = "1";
  }
  else if (key.toLowerCase() === shortcuts.decisionOverlay.key) toggleDecisionOverlay();
  else if (key.toLowerCase() === shortcuts.showAnswerCards.key && answersMode) toggleAllAnswerCards();
  else {
    const num = parseInt(key);
    if (!isNaN(num) && num >= 1 && num <= 9) {
      toggleAnswerCard(num);
    }
  }
});

document.getElementById("backBtn").onclick = () => {
  document.getElementById("presentation").style.display = "none";
  document.getElementById("editor").style.display = "block";
  // Reload slides from saved state (presentation mutated the array)
  const stored = localStorage.getItem("triviaData");
  if (stored) {
    slides.length = 0;
    slides.push(...JSON.parse(stored));
  }
  buildEditor(slides);
  resetTimer();
};

document.getElementById("fullscreenBtnPresentation").onclick = toggleFullscreen;

// ── Timer click → start/reset ─────────────────────────────────
document.getElementById("timerBarContainer").addEventListener("click", () => {
  if (interval || preCountdown) {
    resetTimer();
  } else {
    startTimer();
  }
});

// ── Side nav buttons ──────────────────────────────────────────
document.getElementById("slideLeftBtn").addEventListener("click", () => {
  current--;
  showSlide(-1);
});
document.getElementById("slideRightBtn").addEventListener("click", () => {
  current++;
  showSlide(1);
});

// ── Cursor idle — hide nav buttons and cursor after 2s ───────
let cursorTimer = null;
const pres = document.getElementById("presentation");

document.addEventListener("mousemove", () => {
  pres.classList.add("cursor-active");
  pres.style.cursor = "";
  clearTimeout(cursorTimer);
  cursorTimer = setTimeout(() => {
    pres.classList.remove("cursor-active");
    pres.style.cursor = "none";
  }, 2000);
});