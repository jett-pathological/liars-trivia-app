let slides = [];
let current = 0;
let weeklyVersion = null;
let bwMode = false;
let promoInterval = null;
let answersMode = false;   // show answer option cards on question slides
let answersCount = 4;      // how many answer cards to show
let showPromos = true;     // whether promo slides are included
const questionBank = {};   // keyed by category, loaded on demand
const answersBank = {};    // keyed by category, first-column answers only

// ── Category colours (must match CSS) ───────────────────────
const CAT_COLOURS = {
  People: '#FCB415',
  Places: '#5CC2E6',
  Things: '#E94E67',
};

// ── Progress bar config ──────────────────────────────────────
const PROGRESS_STEPS = [
  { label: "Round 1", display: "1", bonus: false },
  { label: "Round 2", display: "2", bonus: false },
  { label: "Round 3", display: "3", bonus: false },
  { label: "Bonus Question 1", display: "★", bonus: true },
  { label: "Round 4", display: "4", bonus: false },
  { label: "Round 5", display: "5", bonus: false },
  { label: "Round 6", display: "6", bonus: false },
  { label: "Bonus Question 2", display: "★", bonus: true },
];

// ── Data loading ─────────────────────────────────────────────
async function loadWeeklyQuestions() {
  const res = await fetch("data/weekly.json");
  return res.json();
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
  const all = [
    //LIARS TRIVIA
    { type: "title", text: "Welcome to Liar's Trivia!", img: "lt_logo_motion" },
    { type: "intro", text: "Pathological is a trivia game, but… You don't have to know the right answer!" },
    { type: "tutorial", text: "Your answer sheet looks like this:", img: "tutorial_sheet" },
    { type: "tutorial", text: "Pick the answer you like and have 30 seconds to justify it.", img: "tutorial_sheet2" },
    { type: "tutorial", text: "The best two answers can either Make Peace or go Double or Nothing!", img: "tutorial_decision" },
    { type: "tutorial", text: "Go to @pathologicalgame on Instagram for bonus question sneak peeks.", img: "tutorial_ig" },
    { type: "question", label: "Round 1" },
    { type: "question", label: "Round 2" },
    { type: "question", label: "Round 3" },
    // { type: "promo", text: "Check out our board game PATHOLOGICAL!", img: "promo1" },
    // { type: "bonusIntro" },
    { type: "question", label: "Bonus Question 1" },
    { type: "score", text: "INTERMISSION! Grab yourself a drink while you wait." },
    { type: "question", label: "Round 4" },
    { type: "question", label: "Round 5" },
    { type: "question", label: "Round 6" },
    { type: "promo", text: "Visit pathologicalgame.com!", img: "promo2" },
    // { type: "bonusIntro" },
    { type: "question", label: "Bonus Question 2" },
    // { type: "score", text: "Thank you for coming!" },
    { type: "score", text: "Tallying scores..." },
    { type: "title", text: "Thanks for playing!", img: "lt_logo_motion" },
  ];
  return showPromos ? all : all.filter(s => s.type !== "promo");
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

  if (stored) return JSON.parse(stored);

  const slidesArr = buildSlides();
  slidesArr.forEach(slide => {
    if (slide.type === "question") {
      const q = weeklyQuestions[slide.label];
      slide.category = q?.category || "";
      slide.question = q?.question || "";
      slide.answer = q?.answer || "";
      slide.answerOptions = []; // pre-filled via editor
    }
  });
  localStorage.setItem("triviaData", JSON.stringify(slidesArr));
  localStorage.setItem("weeklyHash", currentHash);
  return slidesArr;
}

// ── Editor ───────────────────────────────────────────────────
function buildEditor(slides) {
  const editor = document.getElementById("editorFields");
  editor.innerHTML = "";

  slides.forEach((slide, i) => {
    if (slide.type !== "question") return;
    const isBonus = slide.label.toLowerCase().includes("bonus");
    const catClass = { People: "cat-people", Places: "cat-places", Things: "cat-things" }[slide.category] || "";
    const shortLabel = slide.label.replace("Round ", "R").replace("Bonus Question ", "★");

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
        <span class="qrow-label">${shortLabel}</span>
        <select class="qrow-cat ${catClass}" data-c="${i}">
          <option value="People"  ${slide.category === "People" ? "selected" : ""}>People</option>
          <option value="Places"  ${slide.category === "Places" ? "selected" : ""}>Places</option>
          <option value="Things"  ${slide.category === "Things" ? "selected" : ""}>Things</option>
        </select>
        <input class="qrow-question" value="${slide.question.replace(/"/g, '&quot;')}" data-q="${i}" placeholder="Question…">
        ${!isBonus ? `<button class="qrow-rand" data-rand="${i}" title="Randomise question">🎲</button>` : ''}
        <button class="qrow-toggle" data-toggle="${i}">▼</button>
      </div>
      <div class="qrow-answer hidden">
        <input value="${slide.answer.replace(/"/g, '&quot;')}" data-a="${i}" placeholder="Answer…">
      </div>
      ${aoSection}
    `;
    editor.appendChild(row);
  });

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

  PROGRESS_STEPS.forEach((step, idx) => {
    const item = document.createElement("div");
    item.className = "prog-item" + (step.bonus ? " bonus" : "");
    item.dataset.step = idx;
    item.innerHTML = `
      <div class="prog-badge"></div>
      <span class="prog-item-number">${step.display}</span>
    `;
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

  const stepIdx = PROGRESS_STEPS.findIndex(s => s.label === slide.label);
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

      <div id="answer" style="opacity:0">${slide.answer}</div>
    `;
    resetTimer();
    container.querySelectorAll('.answer-card').forEach((card, idx) => {
      card.addEventListener('click', () => {
        toggleAnswerCard(idx + 1);
      });
    });

    startCardSpriteAnimations();
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
  answersCount = Math.max(1, Math.min(9, parseInt(val) || 4));
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
  const btn = document.getElementById("bwToggleBtn");
  btn.classList.toggle("active", bwMode);
  btn.textContent = bwMode ? "🎨 Colour Mode" : "⬛ B&W Mode";
  if (slides[current]) updateProgressBar(slides[current]);
}

// ── Fullscreen ────────────────────────────────────────────────
function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
}

// ── Boot ──────────────────────────────────────────────────────
async function startApp() {
  slides = await loadTriviaData();
  buildEditor(slides);
  buildProgressBar();

  // ── Load persisted settings ──────────────────────────────
  answersMode = localStorage.getItem('answerOptionsMode') === 'true';
  answersCount = parseInt(localStorage.getItem('answerOptionCount') || '4');
  showPromos = localStorage.getItem('showPromos') !== 'false';

  const aoToggle = document.getElementById('toggleAnswerOptions');
  const promoToggle = document.getElementById('togglePromos');
  const countVal = document.getElementById('answerCountVal');

  if (aoToggle) aoToggle.checked = answersMode;
  if (promoToggle) promoToggle.checked = showPromos;
  if (countVal) countVal.textContent = answersCount;

  const headerActions = document.getElementById("editorHeaderActions");
  const bwBtn = document.createElement("button");
  bwBtn.id = "bwToggleBtn";
  bwBtn.textContent = "⬛ B&W Mode";
  bwBtn.onclick = toggleBWMode;
  headerActions.insertBefore(bwBtn, headerActions.firstChild);
}

startApp();

// ── Sidebar control wiring ────────────────────────────────────
document.getElementById("toggleAnswerOptions").addEventListener("change", e => {
  toggleAnswersMode(e.target.checked);
  localStorage.setItem('answerOptionsMode', answersMode);
  readEditorChanges(slides);
  buildEditor(slides);
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
  const val = Math.min(9, answersCount + 1);
  answersCount = val;
  localStorage.setItem('answerOptionCount', answersCount);
  document.getElementById("answerCountVal").textContent = val;
  clearAnswerOptions();
  if (answersMode) { readEditorChanges(slides); buildEditor(slides); }
});

document.getElementById("togglePromos").addEventListener("change", e => {
  toggleShowPromos(e.target.checked);
  localStorage.setItem('showPromos', showPromos);
});

// ── Button handlers ───────────────────────────────────────────
document.getElementById("startTrivia").onclick = () => {
  readEditorChanges(slides);
  document.getElementById("editor").style.display = "none";
  document.getElementById("presentation").style.display = "block";
  current = 0;
  showSlide();
};

document.getElementById("resetWeekly").onclick = () => {
  localStorage.removeItem("triviaData");
  localStorage.removeItem("weeklyHash");
  location.reload();
};

document.getElementById("fullscreenBtn").onclick = toggleFullscreen;

function toggleDecisionOverlay() {
  const slide = slides[current];
  const overlay = document.getElementById("decisionOverlay");
  if (!slide || !overlay) return;
  if (slide.type === "question" && !slide.label.toLowerCase().includes("bonus")) {
    overlay.style.display = overlay.style.display === "none" ? "flex" : "none";
  }
}

document.getElementById("makePeaceBtn").onclick = () => {
  document.getElementById("decisionOverlay").style.display = "none";
  current++;
  showSlide();
};

document.getElementById("doubleBtn").onclick = () => {
  document.getElementById("decisionOverlay").style.display = "none";
};

// ── Keyboard ──────────────────────────────────────────────────
document.addEventListener("keydown", e => {
  if (document.getElementById("presentation").style.display === "none") return;
  if (e.key === "ArrowRight") { current++; showSlide(1); }
  if (e.key === "ArrowLeft") { current--; showSlide(-1); }
  if (e.key === " ") { e.preventDefault(); startTimer(); }
  if (e.key.toLowerCase() === "r") resetTimer();
  if (e.key.toLowerCase() === "q") revealQuestion();
  if (e.key.toLowerCase() === "a") {
    const ans = document.getElementById("answer");
    if (ans) ans.style.opacity = "1";
  }
  if (e.key.toLowerCase() === "d") toggleDecisionOverlay();
  if (e.key.toLowerCase() === "s" && answersMode) toggleAllAnswerCards();
  const num = parseInt(e.key);
  if (!isNaN(num) && num >= 1 && num <= 9) {
    toggleAnswerCard(num);
  }
});

document.getElementById("backBtn").onclick = () => {
  document.getElementById("presentation").style.display = "none";
  document.getElementById("editor").style.display = "block";
  resetTimer();
};

document.getElementById("fullscreenBtnPresentation").onclick = toggleFullscreen;

// ── Cursor idle — hide nav buttons after 2s of no movement ───
let cursorTimer = null;
const pres = document.getElementById("presentation");

document.addEventListener("mousemove", () => {
  pres.classList.add("cursor-active");
  clearTimeout(cursorTimer);
  cursorTimer = setTimeout(() => {
    pres.classList.remove("cursor-active");
  }, 2000);
});