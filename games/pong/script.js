import { showHelp } from '../../shared/help.js';
import { ensureAudio, beep, startAmbient, stopAmbient, closeAudio } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import {
  triggerShake,
  updateShake,
  getShakeOffset,
  roundRect,
  spawnParticles,
  updateParticles,
  drawParticles,
} from '../../shared/effects.js';

document.documentElement.dataset.theme = localStorage.getItem('arcadehub_theme') || 'dark';

/* ============================================================
   PONG 2D — Arcade Hub
   Canvas 2D, sin dependencias externas.
   ============================================================ */

// CONSTANTES
const WIN_SCORE = 7;
const COURT_W = 700;
const COURT_H = 500;
const PADDLE_HALF_LEN = 50;
const PADDLE_WIDTH = 10;
const PADDLE_X_OFFSET = 25;
const PADDLE_SPEED = 400;
const AI_SPEED = 320;
const BALL_RADIUS = 7;
const BALL_BASE_SPEED = 290;
const BALL_MAX_SPEED = 700;
const BALL_SPEED_GROWTH = 1.045;
const COURT_PADDING = 20;

// ESTADO
const state = {
  running: false,
  gameOver: false,
  playerScore: 0,
  aiScore: 0,
  wins: Number(localStorage.getItem('pong2d_wins') || 0),
};
const playerPaddle = { x: 0, z: 0 };
const aiPaddle = { x: 0, z: 0 };
const ball = { x: 0, z: 0, vx: 0, vz: 0, speed: BALL_BASE_SPEED };

// CANVAS SETUP
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
let canvasW = 0,
  canvasH = 0;
let scale = 1;
let offX = 0,
  offY = 0;

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvasW = window.innerWidth;
  canvasH = window.innerHeight;
  canvas.width = canvasW * dpr;
  canvas.height = canvasH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const scaleX = (canvasW - COURT_PADDING * 2) / COURT_W;
  const scaleY = (canvasH - COURT_PADDING * 2) / COURT_H;
  scale = Math.min(scaleX, scaleY);
  offX = (canvasW - COURT_W * scale) / 2;
  offY = (canvasH - COURT_H * scale) / 2;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// SONIDOS DEL JUEGO
function playPaddleHit() {
  beep({ freq: 340, freqEnd: 440, duration: 0.07, type: 'square', volume: 0.16 });
  triggerShake(2);
}
function playWallBounce() {
  beep({ freq: 220, freqEnd: 260, duration: 0.05, type: 'sine', volume: 0.1 });
  triggerShake(1.2);
}
function playScoreSound(playerScored) {
  beep({
    freq: playerScored ? 500 : 220,
    freqEnd: playerScored ? 780 : 120,
    duration: 0.28,
    type: 'sawtooth',
    volume: 0.18,
  });
  triggerShake(5);
}
function playWinFanfare() {
  triggerShake(8);
  [660, 880, 1100, 1320].forEach((freq, i) => {
    setTimeout(() => beep({ freq, duration: 0.12, type: 'triangle', volume: 0.18 }), i * 100);
  });
}
function playLoseTone() {
  triggerShake(6);
  [440, 330, 220].forEach((freq, i) => {
    setTimeout(() => beep({ freq, duration: 0.18, type: 'sawtooth', volume: 0.16 }), i * 130);
  });
}

// ENTRADA
const keys = { up: false, down: false };
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'KeyW'].includes(e.code)) {
    e.preventDefault();
    keys.up = true;
  }
  if (['ArrowDown', 'KeyS'].includes(e.code)) {
    e.preventDefault();
    keys.down = true;
  }
  if (e.code === 'Space') {
    e.preventDefault();
    if (!state.running) startGame();
  }
  if (e.code === 'KeyR') {
    e.preventDefault();
    if (!state.running) startGame();
  }
});
window.addEventListener('keyup', (e) => {
  if (['ArrowUp', 'KeyW'].includes(e.code)) keys.up = false;
  if (['ArrowDown', 'KeyS'].includes(e.code)) keys.down = false;
});

function bindHoldButton(btn, onDown, onUp) {
  btn.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      onDown();
      btn.classList.add('is-pressed');
    },
    { passive: false },
  );
  btn.addEventListener(
    'touchend',
    (e) => {
      e.preventDefault();
      onUp();
      btn.classList.remove('is-pressed');
    },
    { passive: false },
  );
  btn.addEventListener('touchcancel', () => {
    onUp();
    btn.classList.remove('is-pressed');
  });
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    onDown();
  });
  btn.addEventListener('mouseup', () => {
    onUp();
  });
  btn.addEventListener('mouseleave', () => {
    onUp();
  });
}
bindHoldButton(
  document.getElementById('btnUp'),
  () => {
    keys.up = true;
  },
  () => {
    keys.up = false;
  },
);
bindHoldButton(
  document.getElementById('btnDown'),
  () => {
    keys.down = true;
  },
  () => {
    keys.down = false;
  },
);

// GAMEPAD
let gamepadIndex = null;
let prevStart = false;
let gamepadAxis = 0;
window.addEventListener('gamepadconnected', (e) => {
  gamepadIndex = e.gamepad.index;
});
window.addEventListener('gamepaddisconnected', (e) => {
  if (gamepadIndex === e.gamepad.index) gamepadIndex = null;
});
function pollGamepad() {
  if (!navigator.getGamepads) return;
  const pads = navigator.getGamepads();
  const gp = (gamepadIndex !== null ? pads[gamepadIndex] : null) || pads[0];
  if (!gp) {
    gamepadAxis = 0;
    return;
  }
  const stick = gp.axes[1] ?? 0;
  gamepadAxis = Math.abs(stick) > 0.15 ? stick : 0;
  if (gp.buttons[12]?.pressed) gamepadAxis = -1;
  if (gp.buttons[13]?.pressed) gamepadAxis = 1;
  const startHeld = !!(gp.buttons[9]?.pressed || gp.buttons[0]?.pressed);
  if (startHeld && !prevStart && !state.running) startGame();
  prevStart = startHeld;
}

// OVERLAY
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlayText');
const hintEl = document.getElementById('hintEl');
const finalScoreEl = document.getElementById('finalScore');
const announce = document.getElementById('announce');
overlay.addEventListener('click', () => {
  if (!state.running) startGame();
});

// ── Anuncio accesible (screen reader) ──
function say(msg) {
  if (announce) announce.textContent = msg;
}
function trapTab(e) {
  if (e.key === 'Tab') e.preventDefault();
}

// LÓGICA
function serveBall(towardPlayer) {
  ball.x = COURT_W / 2;
  ball.z = COURT_H / 2;
  ball.speed = BALL_BASE_SPEED;
  const dir = towardPlayer ? -1 : 1;
  const angle = (Math.random() - 0.5) * 0.7;
  ball.vx = Math.cos(angle) * dir;
  ball.vz = Math.sin(angle);
  const len = Math.hypot(ball.vx, ball.vz) || 1;
  ball.vx /= len;
  ball.vz /= len;
}
function resetGame() {
  state.playerScore = 0;
  state.aiScore = 0;
  state.gameOver = false;
  playerPaddle.z = COURT_H / 2;
  aiPaddle.z = COURT_H / 2;
  finalScoreEl.style.display = 'none';
  serveBall(Math.random() > 0.5);
  updateHUD();
}
function startGame() {
  ensureAudio();
  startAmbient();
  resetGame();
  state.running = true;
  achievements.incrementPlays('pong');
  overlay.classList.add('hidden');
  document.addEventListener('keydown', trapTab);
  if (state.wins >= 1) achievements.unlock('pong_first_win');
  say('Pong: comenzó la partida. Primero en llegar a 7 puntos gana.');
}
function endGame(playerWon) {
  stopAmbient();
  state.running = false;
  state.gameOver = true;
  if (playerWon) {
    state.wins += 1;
    localStorage.setItem('pong2d_wins', String(state.wins));
    playWinFanfare();
    spawnParticles(ball.x, ball.z, '#6ee7b7', 24);
    if (state.wins >= 5) achievements.unlock('pong_win_streak');
  } else {
    playLoseTone();
    spawnParticles(ball.x, ball.z, '#ff8a65', 24);
  }
  overlayText.textContent = playerWon ? '¡Ganaste! 🏆' : 'Perdiste 💀';
  finalScoreEl.style.display = 'block';
  finalScoreEl.textContent = `${state.playerScore} - ${state.aiScore} · Victorias: ${state.wins}`;
  document.removeEventListener('keydown', trapTab);
  hintEl.innerHTML = `<kbd>Espacio</kbd> / tocar para reintentar  ·  <kbd>R</kbd> reiniciar`;
  overlay.classList.remove('hidden');
  if (playerWon) say('Pong: ganaste la partida.');
  else say('Pong: perdiste la partida.');
  updateHUD();
}

// FÍSICA
function updatePlayerPaddle(dt) {
  let dir = 0;
  if (keys.up) dir -= 1;
  if (keys.down) dir += 1;
  if (gamepadAxis !== 0) dir = Math.sign(gamepadAxis);
  playerPaddle.z += dir * PADDLE_SPEED * dt;
  playerPaddle.z = Math.max(PADDLE_HALF_LEN, Math.min(COURT_H - PADDLE_HALF_LEN, playerPaddle.z));
  playerPaddle.x = PADDLE_X_OFFSET + PADDLE_WIDTH / 2;
}
function updateAiPaddle(dt) {
  const target = ball.vx > 0 ? ball.z : COURT_H / 2 + (ball.z - COURT_H / 2) * 0.3;
  const diff = target - aiPaddle.z;
  aiPaddle.z = Math.max(
    PADDLE_HALF_LEN,
    Math.min(
      COURT_H - PADDLE_HALF_LEN,
      aiPaddle.z + Math.max(-AI_SPEED * dt, Math.min(AI_SPEED * dt, diff)),
    ),
  );
  aiPaddle.x = COURT_W - PADDLE_X_OFFSET - PADDLE_WIDTH / 2;
}
function updateBall(dt) {
  const maxStep = ball.speed * dt;
  if (maxStep > PADDLE_WIDTH * 0.5) {
    const steps = Math.ceil(maxStep / (PADDLE_WIDTH * 0.4));
    const subDt = dt / steps;
    for (let i = 0; i < steps; i++) {
      if (state.gameOver) return;
      updateBallSub(subDt);
    }
  } else {
    updateBallSub(dt);
  }
}
function updateBallSub(dt) {
  ball.x += ball.vx * ball.speed * dt;
  ball.z += ball.vz * ball.speed * dt;
  if (ball.z - BALL_RADIUS < 0) {
    ball.z = BALL_RADIUS;
    ball.vz *= -1;
    playWallBounce();
    spawnParticles(ball.x, 0, '#5568ff', 5);
  } else if (ball.z + BALL_RADIUS > COURT_H) {
    ball.z = COURT_H - BALL_RADIUS;
    ball.vz *= -1;
    playWallBounce();
    spawnParticles(ball.x, COURT_H, '#5568ff', 5);
  }
  const pLx = playerPaddle.x,
    pRx = aiPaddle.x;
  if (
    ball.vx < 0 &&
    ball.x - BALL_RADIUS <= pLx + PADDLE_WIDTH / 2 &&
    ball.x - BALL_RADIUS > pLx - PADDLE_WIDTH - 4
  ) {
    if (Math.abs(ball.z - playerPaddle.z) <= PADDLE_HALF_LEN + BALL_RADIUS) {
      bounceOffPaddle(playerPaddle, 1);
      playPaddleHit();
      spawnParticles(pLx + PADDLE_WIDTH / 2, ball.z, '#6ee7b7', 8);
    }
  }
  if (
    ball.vx > 0 &&
    ball.x + BALL_RADIUS >= pRx - PADDLE_WIDTH / 2 &&
    ball.x + BALL_RADIUS < pRx + PADDLE_WIDTH + 4
  ) {
    if (Math.abs(ball.z - aiPaddle.z) <= PADDLE_HALF_LEN + BALL_RADIUS) {
      bounceOffPaddle(aiPaddle, -1);
      playPaddleHit();
      spawnParticles(pRx - PADDLE_WIDTH / 2, ball.z, '#ff8a65', 8);
    }
  }
  if (ball.x < -BALL_RADIUS * 2) {
    state.aiScore += 1;
    playScoreSound(false);
    spawnParticles(0, ball.z, '#ff8a65', 14);
    updateHUD();
    if (state.aiScore >= WIN_SCORE) {
      endGame(false);
      return;
    }
    serveBall(true);
  } else if (ball.x > COURT_W + BALL_RADIUS * 2) {
    state.playerScore += 1;
    playScoreSound(true);
    spawnParticles(COURT_W, ball.z, '#6ee7b7', 14);
    updateHUD();
    if (state.playerScore >= WIN_SCORE) {
      endGame(true);
      return;
    }
    serveBall(false);
  }
}
function bounceOffPaddle(paddle, xDir) {
  const offset = (ball.z - paddle.z) / PADDLE_HALF_LEN;
  const angle = offset * 0.6;
  ball.speed = Math.min(BALL_MAX_SPEED, ball.speed * BALL_SPEED_GROWTH);
  ball.vx = Math.cos(angle) * xDir;
  ball.vz = Math.sin(angle) + offset * 0.3;
  const len = Math.hypot(ball.vx, ball.vz) || 1;
  ball.vx /= len;
  ball.vz /= len;
}

// RENDER
function draw() {
  ctx.clearRect(0, 0, canvasW, canvasH);
  const so = getShakeOffset();
  ctx.save();
  ctx.translate(so.x, so.y);
  const s = scale,
    ox = offX,
    oy = offY,
    cw = COURT_W * s,
    ch = COURT_H * s;
  const grad = ctx.createRadialGradient(
    ox + cw / 2,
    oy + ch / 2,
    0,
    ox + cw / 2,
    oy + ch / 2,
    cw * 0.8,
  );
  grad.addColorStop(0, '#14142a');
  grad.addColorStop(1, '#0a0a14');
  ctx.fillStyle = grad;
  ctx.fillRect(ox, oy, cw, ch);
  ctx.shadowColor = 'rgba(85,104,255,0.15)';
  ctx.shadowBlur = 20;
  ctx.strokeStyle = 'rgba(85,104,255,0.25)';
  ctx.lineWidth = 1.5 * s;
  ctx.strokeRect(ox, oy, cw, ch);
  ctx.shadowBlur = 0;
  ctx.setLineDash([6 * s, 8 * s]);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(ox + cw / 2, oy);
  ctx.lineTo(ox + cw / 2, oy + ch);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.arc(ox + cw / 2, oy + ch / 2, 40 * s, 0, Math.PI * 2);
  ctx.stroke();
  drawPaddle(
    ox + playerPaddle.x * s,
    oy + playerPaddle.z * s,
    PADDLE_HALF_LEN * 2 * s,
    PADDLE_WIDTH * s,
    '#6ee7b7',
  );
  drawPaddle(
    ox + aiPaddle.x * s,
    oy + aiPaddle.z * s,
    PADDLE_HALF_LEN * 2 * s,
    PADDLE_WIDTH * s,
    '#ff8a65',
  );
  drawBall(ox + ball.x * s, oy + ball.z * s, BALL_RADIUS * s);
  drawParticles(ctx, offX, offY, scale);
  ctx.restore();
}
function drawPaddle(x, y, h, w, color) {
  const hw = w / 2,
    hh = h / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 8 * scale;
  roundRect(ctx, x - hw + 3 * scale, y - hh + 3 * scale, w, h, 4 * scale);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12 * scale;
  ctx.fillStyle = color;
  roundRect(ctx, x - hw, y - hh, w, h, 4 * scale);
  ctx.fill();
  ctx.shadowBlur = 0;
  const g = ctx.createLinearGradient(x - hw, y, x + hw, y);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.25)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  g.addColorStop(0.7, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  roundRect(ctx, x - hw + w * 0.2, y - hh + 4 * scale, w * 0.6, h - 8 * scale, 2 * scale);
  ctx.fill();
}
function drawBall(x, y, r) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.arc(x + 3 * scale, y + 3 * scale, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = '#8de8ff';
  ctx.shadowBlur = 24 * scale;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  const bg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(0.5, '#c8f0ff');
  bg.addColorStop(1, '#8de8ff');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// HUD
const playerScoreEl = document.getElementById('playerScore');
const aiScoreEl = document.getElementById('aiScore');
const winsDisplayEl = document.getElementById('winsDisplay');
function updateHUD() {
  playerScoreEl.textContent = String(state.playerScore);
  aiScoreEl.textContent = String(state.aiScore);
  winsDisplayEl.textContent = String(state.wins);
}

// BUCLE PRINCIPAL
let animFrameId = null;
let lastTime = 0;
function tick(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  pollGamepad();
  updateShake(dt);
  if (state.running && !state.gameOver) {
    updatePlayerPaddle(dt);
    updateAiPaddle(dt);
    updateBall(dt);
  }
  updateParticles(dt);
  draw();
  animFrameId = requestAnimationFrame(tick);
}
playerPaddle.x = PADDLE_X_OFFSET + PADDLE_WIDTH / 2;
playerPaddle.z = COURT_H / 2;
aiPaddle.x = COURT_W - PADDLE_X_OFFSET - PADDLE_WIDTH / 2;
aiPaddle.z = COURT_H / 2;
ball.x = COURT_W / 2;
ball.z = COURT_H / 2;
updateHUD();

function cleanup() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  document.removeEventListener('keydown', trapTab);
  stopAmbient();
  closeAudio();
}
window.addEventListener('beforeunload', cleanup);
window.addEventListener('pagehide', cleanup);
document.getElementById('loading').classList.add('hidden');
animFrameId = requestAnimationFrame((t) => {
  lastTime = t;
  tick(t);
});

// Game Bar
document.getElementById('hubBtn')?.addEventListener('click', () => {
  if (window.self !== window.top) {
    window.top.location.hash = '';
  } else {
    window.location.href = '../../index.html';
  }
});
document.getElementById('fsBtn')?.addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  else document.exitFullscreen().catch(() => {});
});
// Help button
document.getElementById('helpBtn')?.addEventListener('click', () => showHelp('pong'));
