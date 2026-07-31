import { showHelp } from '../../shared/help.js';
import { ensureAudio, beep, startAmbient, stopAmbient, closeAudio } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements } from '../../shared/dom.js';
import { setupCanvas } from '../../shared/display.js';
import { createGameLoop } from '../../shared/loop.js';
import { createGamepad, bindHoldButton } from '../../shared/input.js';
import {
  updateShake,
  getShakeOffset,
  roundRect,
  spawnParticles,
  updateParticles,
  drawParticles,
  feedbackBundle,
  triggerSquash,
  updateSquashes,
  drawWithSquash,
  clearSquashes,
} from '../../shared/effects.js';

injectCommonElements();

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
const ball = { x: 0, z: 0, vx: 0, vz: 0, speed: BALL_BASE_SPEED, squashIdx: -1 };

// CANVAS SETUP
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const {
  w: canvasW,
  h: canvasH,
  s: scale,
  x: offX,
  y: offY,
} = setupCanvas(canvas, ctx, COURT_W, COURT_H, COURT_PADDING);

// SONIDOS DEL JUEGO
function playPaddleHit() {
  ball.squashIdx = triggerSquash(0.18, 0.6, 1.5);
  feedbackBundle('medium', ball.x, ball.y, {
    color: '#6ee7b7',
    onBeep: (f, d, t, v) => beep({ freq: f, duration: d, type: t, volume: v }),
  });
}
function playWallBounce() {
  ball.squashIdx = triggerSquash(0.12, 0.7, 1.3);
  beep({ freq: 220, freqEnd: 260, duration: 0.05, type: 'sine', volume: 0.1 });
}
function playScoreSound(playerScored) {
  const color = playerScored ? '#6ee7b7' : '#ff8a65';
  feedbackBundle('large', COURT_W / 2, COURT_H / 2, {
    color,
    onBeep: (f, d, t, v) =>
      beep({
        freq: playerScored ? 500 : 220,
        freqEnd: playerScored ? 780 : 120,
        duration: d,
        type: t,
        volume: v,
      }),
    noFlash: true,
  });
}
function playWinFanfare() {
  feedbackBundle('large', COURT_W / 2, COURT_H / 2, {
    color: '#6ee7b7',
    noFlash: false,
    onBeep: () => {},
  });
  [660, 880, 1100, 1320].forEach((freq, i) => {
    setTimeout(() => beep({ freq, duration: 0.12, type: 'triangle', volume: 0.18 }), i * 100);
  });
}
function playLoseTone() {
  feedbackBundle('large', ball.x, ball.y, {
    color: '#ff8a65',
    noFlash: true,
    onBeep: () => {},
  });
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
const gamepad = createGamepad();
let prevStart = false;
let gamepadAxis = 0;

function pollGamepad() {
  const gp = gamepad.pad;
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
  ball.y = COURT_H / 2;
  ball.speed = BALL_BASE_SPEED;
  const dir = towardPlayer ? -1 : 1;
  const angle = (Math.random() - 0.5) * 0.7;
  ball.vx = Math.cos(angle) * dir;
  ball.vy = Math.sin(angle);
  const len = Math.hypot(ball.vx, ball.vy) || 1;
  ball.vx /= len;
  ball.vy /= len;
}
function resetGame() {
  clearSquashes();
  state.playerScore = 0;
  state.aiScore = 0;
  state.gameOver = false;
  playerPaddle.y = COURT_H / 2;
  aiPaddle.y = COURT_H / 2;
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
    spawnParticles(ball.x, ball.y, '#6ee7b7', 24);
    if (state.wins >= 5) achievements.unlock('pong_win_streak');
  } else {
    playLoseTone();
    spawnParticles(ball.x, ball.y, '#ff8a65', 24);
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
  playerPaddle.y += dir * PADDLE_SPEED * dt;
  playerPaddle.y = Math.max(PADDLE_HALF_LEN, Math.min(COURT_H - PADDLE_HALF_LEN, playerPaddle.y));
  playerPaddle.x = PADDLE_X_OFFSET + PADDLE_WIDTH / 2;
}
function updateAiPaddle(dt) {
  const target = ball.vx > 0 ? ball.y : COURT_H / 2 + (ball.y - COURT_H / 2) * 0.3;
  const diff = target - aiPaddle.y;
  aiPaddle.y = Math.max(
    PADDLE_HALF_LEN,
    Math.min(
      COURT_H - PADDLE_HALF_LEN,
      aiPaddle.y + Math.max(-AI_SPEED * dt, Math.min(AI_SPEED * dt, diff)),
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
  ball.y += ball.vy * ball.speed * dt;
  if (ball.y - BALL_RADIUS < 0) {
    ball.y = BALL_RADIUS;
    ball.vy *= -1;
    playWallBounce();
    spawnParticles(ball.x, 0, '#5568ff', 5);
  } else if (ball.y + BALL_RADIUS > COURT_H) {
    ball.y = COURT_H - BALL_RADIUS;
    ball.vy *= -1;
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
    if (Math.abs(ball.y - playerPaddle.y) <= PADDLE_HALF_LEN + BALL_RADIUS) {
      bounceOffPaddle(playerPaddle, 1);
      playPaddleHit();
      spawnParticles(pLx + PADDLE_WIDTH / 2, ball.y, '#6ee7b7', 8);
    }
  }
  if (
    ball.vx > 0 &&
    ball.x + BALL_RADIUS >= pRx - PADDLE_WIDTH / 2 &&
    ball.x + BALL_RADIUS < pRx + PADDLE_WIDTH + 4
  ) {
    if (Math.abs(ball.y - aiPaddle.y) <= PADDLE_HALF_LEN + BALL_RADIUS) {
      bounceOffPaddle(aiPaddle, -1);
      playPaddleHit();
      spawnParticles(pRx - PADDLE_WIDTH / 2, ball.y, '#ff8a65', 8);
    }
  }
  if (ball.x < -BALL_RADIUS * 2) {
    state.aiScore += 1;
    playScoreSound(false);
    spawnParticles(0, ball.y, '#ff8a65', 14);
    updateHUD();
    if (state.aiScore >= WIN_SCORE) {
      endGame(false);
      return;
    }
    serveBall(true);
  } else if (ball.x > COURT_W + BALL_RADIUS * 2) {
    state.playerScore += 1;
    playScoreSound(true);
    spawnParticles(COURT_W, ball.y, '#6ee7b7', 14);
    updateHUD();
    if (state.playerScore >= WIN_SCORE) {
      endGame(true);
      return;
    }
    serveBall(false);
  }
}
function bounceOffPaddle(paddle, xDir) {
  const offset = (ball.y - paddle.y) / PADDLE_HALF_LEN;
  const angle = offset * 0.6;
  ball.speed = Math.min(BALL_MAX_SPEED, ball.speed * BALL_SPEED_GROWTH);
  ball.vx = Math.cos(angle) * xDir;
  ball.vy = Math.sin(angle) + offset * 0.3;
  const len = Math.hypot(ball.vx, ball.vy) || 1;
  ball.vx /= len;
  ball.vy /= len;
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
    oy + playerPaddle.y * s,
    PADDLE_HALF_LEN * 2 * s,
    PADDLE_WIDTH * s,
    '#6ee7b7',
  );
  drawPaddle(
    ox + aiPaddle.x * s,
    oy + aiPaddle.y * s,
    PADDLE_HALF_LEN * 2 * s,
    PADDLE_WIDTH * s,
    '#ff8a65',
  );
  drawBall(ox + ball.x * s, oy + ball.y * s, BALL_RADIUS * s);
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
  const drawFn = (ctx, rad) => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(x + 3 * scale, y + 3 * scale, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = '#8de8ff';
    ctx.shadowBlur = 24 * scale;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    const bg = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 0, x, y, rad);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(0.5, '#c8f0ff');
    bg.addColorStop(1, '#8de8ff');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  };
  drawWithSquash(ctx, x, y, r, ball.squashIdx, drawFn);
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
const loop = createGameLoop((dt) => {
  pollGamepad();
  updateShake(dt);
  if (state.running && !state.gameOver) {
    updatePlayerPaddle(dt);
    updateAiPaddle(dt);
    updateBall(dt);
  }
  updateSquashes(dt);
  updateParticles(dt);
  draw();
});
playerPaddle.x = PADDLE_X_OFFSET + PADDLE_WIDTH / 2;
playerPaddle.y = COURT_H / 2;
aiPaddle.x = COURT_W - PADDLE_X_OFFSET - PADDLE_WIDTH / 2;
aiPaddle.y = COURT_H / 2;
ball.x = COURT_W / 2;
ball.y = COURT_H / 2;
updateHUD();

function cleanup() {
  loop.stop();
  document.removeEventListener('keydown', trapTab);
  stopAmbient();
  closeAudio();
}
window.addEventListener('beforeunload', cleanup);
window.addEventListener('pagehide', cleanup);
document.getElementById('loading').classList.add('hidden');
loop.start();

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
