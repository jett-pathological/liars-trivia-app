let timer = 30;
let interval = null;
let preCountdown = null;

function setTimerText(val) {
  const text = document.getElementById("timerText");
  const bg = document.getElementById("timerTextBg");
  if (text) text.textContent = val;
  if (bg) bg.textContent = val;
}

function startTimer() {
  clearInterval(interval);
  clearInterval(preCountdown);
  const bar = document.getElementById("timerBar");
  const text = document.getElementById("timerTextBg");
  if (!text) return;
  playCountdown();

  let count = 3;
  text.classList.remove("pulse");
  bar.style.width = "100%";
  setTimerText(count);

  preCountdown = setInterval(() => {
    count--;
    if (count > 0) {
      setTimerText(count);
    } else if (count === 0) {
      setTimerText("GO!");
    } else {
      clearInterval(preCountdown);
      timer = 30;
      updateTimerDisplay();
      interval = setInterval(() => {
        timer--;
        updateTimerDisplay();
        if (timer <= 0) clearInterval(interval);
      }, 1000);
    }
  }, 1000);
}

function resetTimer() {
  clearInterval(interval);
  clearInterval(preCountdown);
  timer = 30;
  const bar = document.getElementById("timerBar");
  const text = document.getElementById("timerTextBg");
  setTimerText("30 SECONDS");
  if (bar) { bar.style.width = "100%"; }
  if (text) { text.classList.remove("pulse"); text.style.opacity = "1";}
}

function updateTimerDisplay() {
  const bar = document.getElementById("timerBar");
  const text = document.getElementById("timerTextBg");
  const container = document.getElementById("timerBarContainer");
  if (!bar || container.style.opacity === "0") return;

  const percent = Math.max(0, (timer / 30) * 100);
  bar.style.width = percent + "%";
  setTimerText(timer > 0 ? timer : "0");

  if (timer <= 5 && timer > 0.5) {
    text.classList.add("pulse");
  } else {
    text.classList.remove("pulse");
  }

  if (timer <= 0) {
    text.style.opacity = "0.5";
    setTimerText("0 SECONDS");
    playAlarm();
  }
}

function playCountdown() {
  var audio = new Audio('audio/countdown.mp3');
  audio.play();
}

function playAlarm() {
  var audio = new Audio('audio/alarm.mp3');
  audio.play();
}