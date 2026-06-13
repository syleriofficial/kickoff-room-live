const cfg = window.WATCHALONG_CONFIG;
const presets = window.MATCH_PRESETS || [];
const stateKey = "watchalong-live-state";
const channel = "BroadcastChannel" in window ? new BroadcastChannel("watchalong-control") : null;
let homeScore = 0;
let awayScore = 0;
let seconds = Math.max(0, Number(cfg.match.startMinute || 0) * 60);
let clockTimer = null;
let audioCtx = null;
let hype = Number(cfg.panels.hypePercent || 50);
let liveState = {
  presetId: cfg.match.presetId || "bra-mar",
  home: cfg.match.home,
  away: cfg.match.away,
  homeShort: cfg.match.homeShort,
  awayShort: cfg.match.awayShort,
  homeColor: cfg.match.homeColor,
  awayColor: cfg.match.awayColor,
  homeScore,
  awayScore,
  seconds,
  hype,
  topic: cfg.panels.topic,
  keyBattle: cfg.panels.keyBattle,
  gamePulse: cfg.panels.gamePulse,
  chatMission: cfg.panels.chatMission,
  momentumHome: cfg.panels.momentumHome,
  momentumAway: cfg.panels.momentumAway,
  shotsHome: cfg.panels.shotsHome,
  shotsAway: cfg.panels.shotsAway,
  possessionHome: cfg.panels.possessionHome,
  possessionAway: cfg.panels.possessionAway
};

function byId(id) {
  return document.getElementById(id);
}

function text(id, value) {
  byId(id).textContent = value;
}

function two(n) {
  return String(n).padStart(2, "0");
}

function renderClock() {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  text("match-clock", `${two(mins)}:${two(secs)}`);
}

function render() {
  text("competition", cfg.match.competition);
  text("subtitle", cfg.match.subtitle);
  text("strip-home", liveState.homeShort);
  text("strip-away", liveState.awayShort);
  text("home-name", liveState.home);
  text("away-name", liveState.away);
  text("period", cfg.match.period);
  text("topic", liveState.topic);
  text("key-battle", liveState.keyBattle);
  text("game-pulse", liveState.gamePulse);
  text("chat-mission", liveState.chatMission);
  text("poll-question", cfg.panels.pollQuestion);
  text("poll-home", liveState.pollHome || cfg.panels.pollHome);
  text("poll-draw", cfg.panels.pollDraw);
  text("poll-away", liveState.pollAway || cfg.panels.pollAway);
  text("mom-home-label", liveState.homeShort);
  text("mom-away-label", liveState.awayShort);
  text("shots", `${liveState.shotsHome}-${liveState.shotsAway}`);
  text("possession", `${liveState.possessionHome}-${liveState.possessionAway}`);
  text("host-name", cfg.host.name);
  text("host-tag", cfg.host.tag);
  text("home-score", homeScore);
  text("away-score", awayScore);
  byId("home-swatch").style.background = liveState.homeColor;
  byId("away-swatch").style.background = liveState.awayColor;
  byId("mom-home").style.width = `${liveState.momentumHome}%`;
  byId("mom-away").style.width = `${liveState.momentumAway}%`;
  byId("hype-number").textContent = `${hype}%`;
  byId("hype-fill").style.width = `${hype}%`;
  byId("ticker").textContent = cfg.panels.ticker.join("  /  ");
  renderClock();
}

function applyPreset(presetId) {
  const preset = presets.find((item) => item.id === presetId);
  if (!preset) return;
  pauseClock();
  liveState = {
    ...liveState,
    ...preset,
    presetId,
    homeScore: 0,
    awayScore: 0,
    seconds: 0,
    hype: 55,
    momentumHome: 50,
    momentumAway: 50,
    shotsHome: 0,
    shotsAway: 0,
    possessionHome: 50,
    possessionAway: 50
  };
  homeScore = 0;
  awayScore = 0;
  seconds = 0;
  hype = 55;
  saveState();
  render();
}

function saveState() {
  liveState = { ...liveState, homeScore, awayScore, seconds, hype };
  localStorage.setItem(stateKey, JSON.stringify(liveState));
  channel?.postMessage(liveState);
}

function applyState(nextState) {
  liveState = { ...liveState, ...nextState };
  homeScore = Number(liveState.homeScore || 0);
  awayScore = Number(liveState.awayScore || 0);
  seconds = Number(liveState.seconds || 0);
  hype = Number(liveState.hype || 0);
  render();
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(stateKey) || "null");
    if (stored) applyState(stored);
  } catch {
    render();
  }
}

function startClock() {
  if (clockTimer) return;
  clockTimer = setInterval(() => {
    seconds += 1;
    renderClock();
  }, 1000);
}

function pauseClock() {
  clearInterval(clockTimer);
  clockTimer = null;
}

function beep(freq, duration, gain, delay = 0) {
  if (!cfg.audio.enabled) return;
  audioCtx ||= new AudioContext();
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  amp.gain.value = 0.0001;
  osc.connect(amp).connect(audioCtx.destination);
  const t = audioCtx.currentTime + delay;
  amp.gain.exponentialRampToValueAtTime(Math.max(0.001, gain * cfg.audio.volume), t + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function goalSfx() {
  beep(392, 0.18, 0.5, 0);
  beep(523.25, 0.18, 0.5, 0.18);
  beep(659.25, 0.34, 0.48, 0.36);
}

const actions = {
  applyPreset,
  homeGoal() {
    homeScore += 1;
    saveState();
    render();
    goalSfx();
  },
  awayGoal() {
    awayScore += 1;
    saveState();
    render();
    goalSfx();
  },
  resetScore() {
    homeScore = 0;
    awayScore = 0;
    saveState();
    render();
  },
  hypeUp() {
    hype = Math.min(100, hype + 5);
    saveState();
    render();
    beep(740, 0.09, 0.25);
  },
  hypeDown() {
    hype = Math.max(0, hype - 5);
    saveState();
    render();
  },
  startClock,
  pauseClock,
  sfxGoal: goalSfx
};

document.addEventListener("click", (event) => {
  const action = event.target.dataset.action;
  if (action && actions[action]) actions[action]();
});

byId("minus").addEventListener("click", () => {
  seconds = Math.max(0, seconds - 60);
  saveState();
  renderClock();
});

byId("plus").addEventListener("click", () => {
  seconds += 60;
  saveState();
  renderClock();
});

document.addEventListener("keydown", (event) => {
  if (event.key === " ") startClock();
  if (event.key.toLowerCase() === "p") pauseClock();
  if (event.key.toLowerCase() === "h") actions.homeGoal();
  if (event.key.toLowerCase() === "a") actions.awayGoal();
  if (event.key.toLowerCase() === "r") actions.resetScore();
  if (event.key.toLowerCase() === "u") actions.hypeUp();
  if (event.key.toLowerCase() === "j") actions.hypeDown();
});

window.addEventListener("storage", (event) => {
  if (event.key === stateKey && event.newValue) {
    applyState(JSON.parse(event.newValue));
  }
});

channel?.addEventListener("message", (event) => applyState(event.data));

loadState();
render();
