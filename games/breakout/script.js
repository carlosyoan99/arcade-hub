import { showHelp } from '../../shared/help.js';
import { ensureAudio, beep, startAmbient, closeAudio } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements } from '../../shared/dom.js';
import { setupCanvas } from '../../shared/display.js';
import {
  triggerShake,
  updateShake,
  getShakeOffset,
  roundRect,
  spawnParticles,
  updateParticles,
  drawParticles,
} from '../../shared/effects.js';

injectCommonElements();
document.documentElement.dataset.theme = localStorage.getItem('arcadehub_theme') || 'dark';
/* ============================================================
   BREAKOUT 2D — Arcade Hub
   Canvas 2D, sin dependencias externas.
   JS organizado: constantes → estado → canvas → sonido → partículas
   → entrada → overlay → lógica → física → render → bucle
   ============================================================ */

// ============================================================
// CONSTANTES
// ============================================================
const COURT_W = 700; // ancho lógico
const COURT_H = 500; // alto lógico
const PADDLE_HALF_W = 45; // media anchura de la paleta
const PADDLE_WIDTH = 10; // grosor de la paleta (en eje Z)
const PADDLE_Z = COURT_H - 28; // posición Z de la paleta
const PADDLE_SPEED = 380;
const LOSE_Z = COURT_H + 15; // si la pelota pasa esto, se pierde vida

const BALL_RADIUS = 6;
const BALL_LAUNCH_SPEED_BASE = 290;
const BALL_MAX_SPEED = 700;
const BALL_HIT_GROWTH = 1.01;
const LEVEL_SPEED_GROWTH = 1.08;

const START_LIVES = 3;

const BRICK_ROWS = 5;
const BRICK_COLS = 9;
const BRICK_W = 64;
const BRICK_H = 22;
const BRICK_GAP = 6;
const BRICK_TOP = 40; // distancia desde el borde superior

const ROW_COLORS = ['#ff6b6b', '#ffa76b', '#ffe066', '#6ee7b7', '#6ec6ff'];
const ROW_POINTS = [50, 40, 30, 20, 10];
const ROW_GLOW_COLORS = [
  'rgba(255,107,107,0.4)',
  'rgba(255,167,107,0.4)',
  'rgba(255,224,102,0.4)',
  'rgba(110,231,183,0.4)',
  'rgba(110,198,255,0.4)',
];

const COURT_PADDING = 20;

// ============================================================
// ESTADO
// ============================================================
const state = {
  running: false,
  gameOver: false,
  waitingToLaunch: true,
  score: 0,
  lives: START_LIVES,
  level: 1,
  best: Number(localStorage.getItem('breakout2d_best') || 0),
  ballSpeed: BALL_LAUNCH_SPEED_BASE,
};

// Paleta
const paddle = { x: COURT_W / 2, z: PADDLE_Z };

// Pelota
const ball = { x: 0, z: 0, vx: 0, vz: 0, prevX: 0, prevZ: 0 };

// Ladrillos: array de { x, z, w, h, points, color, glowColor, alive }
let bricks = [];

// ============================================================
// CANVAS SETUP
// ============================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const {
  w: canvasW,
  h: canvasH,
  s: scale,
  x: offX,
  y: offY,
} = setupCanvas(canvas, ctx, COURT_W, COURT_H, COURT_PADDING);

// ============================================================
// SONIDO (usando shared/audio.js)
// ============================================================
function playWallBounce() {
  beep({ freq: 260, freqEnd: 300, duration: 0.05, type: 'sine', volume: 0.1 });
  triggerShake(1);
}
function playPaddleHit() {
  beep({ freq: 340, freqEnd: 440, duration: 0.07, type: 'square', volume: 0.16 });
  triggerShake(2);
}
function playBrickBreak(points) {
  beep({
    freq: 500 + points * 4,
    freqEnd: 800 + points * 4,
    duration: 0.08,
    type: 'triangle',
    volume: 0.16,
  });
  triggerShake(1.5);
}
function playLaunchSound() {
  beep({ freq: 300, freqEnd: 500, duration: 0.1, type: 'square', volume: 0.14 });
}
function playLifeLostSound() {
  beep({ freq: 260, freqEnd: 90, duration: 0.35, type: 'sawtooth', volume: 0.2 });
  triggerShake(5);
}
function playLevelClearFanfare() {
  triggerShake(4);
  [660, 880, 1100].forEach((freq, i) => {
    setTimeout(() => beep({ freq, duration: 0.1, type: 'triangle', volume: 0.16 }), i * 90);
  });
}
function playGameOverTone() {
  triggerShake(6);
  [440, 330, 220, 110].forEach((freq, i) => {
    setTimeout(() => beep({ freq, duration: 0.2, type: 'sawtooth', volume: 0.18 }), i * 140);
  });
}

// ============================================================
// ENTRADA: TECLADO
// ============================================================
const keys = { left: false, right: false };

window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'KeyA'].includes(e.code)) {
    e.preventDefault();
    keys.left = true;
  }
  if (['ArrowRight', 'KeyD'].includes(e.code)) {
    e.preventDefault();
    keys.right = true;
  }
  if (e.code === 'Space') {
    e.preventDefault();
    if (!state.running) startGame();
    else if (state.waitingToLaunch) launchBall();
  }
  if (e.code === 'KeyR') {
    e.preventDefault();
    if (!state.running) startGame();
  }
});
window.addEventListener('keyup', (e) => {
  if (['ArrowLeft', 'KeyA'].includes(e.code)) keys.left = false;
  if (['ArrowRight', 'KeyD'].includes(e.code)) keys.right = false;
});

// ============================================================
// ENTRADA: TÁCTIL
// ============================================================
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

const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
const btnLaunch = document.getElementById('btnLaunch');

bindHoldButton(
  btnLeft,
  () => {
    keys.left = true;
  },
  () => {
    keys.left = false;
  },
);
bindHoldButton(
  btnRight,
  () => {
    keys.right = true;
  },
  () => {
    keys.right = false;
  },
);

btnLaunch.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    btnLaunch.classList.add('is-pressed');
    if (!state.running) startGame();
    else if (state.waitingToLaunch) launchBall();
  },
  { passive: false },
);
btnLaunch.addEventListener(
  'touchend',
  (e) => {
    e.preventDefault();
    btnLaunch.classList.remove('is-pressed');
  },
  { passive: false },
);
btnLaunch.addEventListener('touchcancel', () => {
  btnLaunch.classList.remove('is-pressed');
});
btnLaunch.addEventListener('mousedown', (e) => {
  e.preventDefault();
  if (!state.running) startGame();
  else if (state.waitingToLaunch) launchBall();
});

// ============================================================
// ENTRADA: GAMEPAD
// ============================================================
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

  const stick = gp.axes[0] ?? 0;
  gamepadAxis = Math.abs(stick) > 0.15 ? stick : 0;

  const dpadLeft = !!gp.buttons[14]?.pressed;
  const dpadRight = !!gp.buttons[15]?.pressed;
  if (dpadLeft) gamepadAxis = -1;
  if (dpadRight) gamepadAxis = 1;

  const startHeld = !!(gp.buttons[9]?.pressed || gp.buttons[0]?.pressed);
  if (startHeld && !prevStart) {
    if (!state.running) startGame();
    else if (state.waitingToLaunch) launchBall();
  }
  prevStart = startHeld;
}

// ============================================================
// OVERLAY
// ============================================================
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlayText');
const hintEl = document.getElementById('hintEl');
const finalScoreEl = document.getElementById('finalScore');
const announce = document.getElementById('announce');

function say(msg) {
  if (announce) announce.textContent = msg;
}
function trapTab(e) {
  if (e.key === 'Tab') e.preventDefault();
}

overlay.addEventListener('click', () => {
  if (!state.running) startGame();
});

// ============================================================
// LÓGICA DEL JUEGO
// ============================================================
function buildBricks() {
  bricks = [];
  const rowWidth = BRICK_COLS * BRICK_W + (BRICK_COLS - 1) * BRICK_GAP;
  const startX = (COURT_W - rowWidth) / 2 + BRICK_W / 2;
  const startZ = BRICK_TOP + BRICK_H / 2;

  for (let row = 0; row < BRICK_ROWS; row++) {
    for (let col = 0; col < BRICK_COLS; col++) {
      bricks.push({
        x: startX + col * (BRICK_W + BRICK_GAP),
        z: startZ + row * (BRICK_H + BRICK_GAP),
        w: BRICK_W,
        h: BRICK_H,
        halfW: BRICK_W / 2,
        halfH: BRICK_H / 2,
        points: ROW_POINTS[row],
        color: ROW_COLORS[row],
        glowColor: ROW_GLOW_COLORS[row],
        alive: true,
      });
    }
  }
}

function parkBallOnPaddle() {
  ball.x = paddle.x;
  ball.z = paddle.z - 18;
  ball.vx = 0;
  ball.vz = 0;
  state.waitingToLaunch = true;
}

function launchBall() {
  if (!state.running || state.gameOver || !state.waitingToLaunch) return;
  state.waitingToLaunch = false;
  const angle = (Math.random() - 0.5) * 0.6;
  ball.vx = Math.sin(angle);
  ball.vz = -Math.cos(angle);
  const len = Math.hypot(ball.vx, ball.vz) || 1;
  ball.vx /= len;
  ball.vz /= len;
  playLaunchSound();
}

function resetGame() {
  state.score = 0;
  state.lives = START_LIVES;
  state.level = 1;
  state.ballSpeed = BALL_LAUNCH_SPEED_BASE;
  state.gameOver = false;
  paddle.x = COURT_W / 2;
  finalScoreEl.style.display = 'none';
  buildBricks();
  parkBallOnPaddle();
  updateHUD();
}

function startGame() {
  ensureAudio();
  startAmbient();
  if (state.best >= 1000) achievements.unlock('breakout_thousand');
  resetGame();
  state.running = true;
  achievements.incrementPlays('breakout');
  overlay.classList.add('hidden');
  document.addEventListener('keydown', trapTab);
  say('Breakout: comenzó la partida. Rompé todos los ladrillos.');
}

function nextLevel() {
  state.level += 1;
  state.ballSpeed = Math.min(BALL_MAX_SPEED, state.ballSpeed * LEVEL_SPEED_GROWTH);
  playLevelClearFanfare();
  buildBricks();
  parkBallOnPaddle();
}

function loseLife() {
  state.lives -= 1;
  updateHUD();
  if (state.lives <= 0) {
    endGame();
    return;
  }
  playLifeLostSound();
  spawnParticles(ball.x, paddle.z, '#ff6b6b', 14, {
    spd: 160,
    life: 0.5,
    gravity: true,
    friction: 0.97,
  });
  parkBallOnPaddle();
}

function endGame() {
  state.running = false;
  state.gameOver = true;

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('breakout2d_best', String(state.best));
  }

  playGameOverTone();
  spawnParticles(ball.x, ball.z, '#ff6b6b', 20, {
    spd: 150,
    life: 0.65,
    sm: 2.5,
    smx: 5.5,
    gravity: -350,
    friction: 0.97,
  });

  overlayText.textContent = '¡Juego terminado!';
  finalScoreEl.style.display = 'block';
  finalScoreEl.textContent = `Puntos: ${state.score} · Nivel: ${state.level} · Mejor: ${state.best}`;
  hintEl.innerHTML = `<kbd>Espacio</kbd> / tocar para reintentar  ·  <kbd>R</kbd> reiniciar`;
  overlay.classList.remove('hidden');
  document.removeEventListener('keydown', trapTab);
  say('Breakout: juego terminado.');
  updateHUD();
}

// ============================================================
// FÍSICA / ACTUALIZACIÓN
// ============================================================
function updatePaddle(dt) {
  let dir = 0;
  if (keys.left) dir -= 1;
  if (keys.right) dir += 1;
  if (gamepadAxis !== 0) dir = Math.sign(gamepadAxis);

  paddle.x += dir * PADDLE_SPEED * dt;
  const bound = PADDLE_HALF_W + BALL_RADIUS;
  paddle.x = Math.max(bound, Math.min(COURT_W - bound, paddle.x));

  if (state.waitingToLaunch) {
    ball.x = paddle.x;
  }
}

function updateBall(dt) {
  if (state.waitingToLaunch) return;

  // Anti-tunneling
  const maxStep = state.ballSpeed * dt;
  const minThickness = Math.min(BRICK_H, BRICK_W, PADDLE_WIDTH);
  if (maxStep > minThickness * 0.4) {
    const steps = Math.ceil(maxStep / (minThickness * 0.3));
    const subDt = dt / steps;
    for (let i = 0; i < steps; i++) {
      if (state.gameOver) return;
      if (updateBallStep(subDt)) return;
    }
  } else {
    updateBallStep(dt);
  }
}

// Devuelve true si debe cortarse el frame
function updateBallStep(dt) {
  ball.prevX = ball.x;
  ball.prevZ = ball.z;
  ball.x += ball.vx * state.ballSpeed * dt;
  ball.z += ball.vz * state.ballSpeed * dt;

  // Rebote en pared izquierda
  if (ball.x - BALL_RADIUS < 0) {
    ball.x = BALL_RADIUS;
    ball.vx *= -1;
    playWallBounce();
    spawnParticles(0, ball.z, '#7a5cff', 4, { spd: 80, life: 0.3, friction: 0.97 });
  }

  // Rebote en pared derecha
  if (ball.x + BALL_RADIUS > COURT_W) {
    ball.x = COURT_W - BALL_RADIUS;
    ball.vx *= -1;
    playWallBounce();
    spawnParticles(COURT_W, ball.z, '#7a5cff', 4, { spd: 80, life: 0.3, friction: 0.97 });
  }

  // Rebote en pared superior
  if (ball.z - BALL_RADIUS < 0) {
    ball.z = BALL_RADIUS;
    ball.vz *= -1;
    playWallBounce();
    spawnParticles(ball.x, 0, '#7a5cff', 4, { spd: 80, life: 0.3, friction: 0.97 });
  }

  // Colisión con la paleta
  if (
    ball.vz > 0 &&
    ball.z + BALL_RADIUS >= paddle.z - PADDLE_WIDTH / 2 &&
    ball.z + BALL_RADIUS < paddle.z + PADDLE_WIDTH &&
    Math.abs(ball.x - paddle.x) <= PADDLE_HALF_W + BALL_RADIUS
  ) {
    const offset = (ball.x - paddle.x) / PADDLE_HALF_W;
    const angle = offset * 0.7;
    ball.vx = Math.sin(angle);
    ball.vz = -Math.cos(angle);
    const len = Math.hypot(ball.vx, ball.vz) || 1;
    ball.vx /= len;
    ball.vz /= len;
    state.ballSpeed = Math.min(BALL_MAX_SPEED, state.ballSpeed * BALL_HIT_GROWTH);
    playPaddleHit();
    spawnParticles(ball.x, paddle.z - 4, '#6ec6ff', 6, { spd: 100, life: 0.35, friction: 0.97 });
  }

  // Colisión con ladrillos
  for (let i = 0; i < bricks.length; i++) {
    const b = bricks[i];
    if (!b.alive) continue;

    const withinX = Math.abs(ball.x - b.x) <= b.halfW + BALL_RADIUS;
    const withinZ = Math.abs(ball.z - b.z) <= b.halfH + BALL_RADIUS;

    if (withinX && withinZ) {
      // Determinar eje de rebote usando posición previa
      const wasWithinXPrev = Math.abs(ball.prevX - b.x) <= b.halfW + BALL_RADIUS;
      if (wasWithinXPrev) {
        ball.vz *= -1; // golpe por arriba/abajo
      } else {
        ball.vx *= -1; // golpe por un costado
      }

      b.alive = false;
      state.score += b.points;
      playBrickBreak(b.points);
      spawnParticles(b.x, b.z, b.color, 10);
      updateHUD();

      if (bricks.every((br) => !br.alive)) {
        nextLevel();
        return true;
      }
      break;
    }
  }

  // ¿Se perdió la pelota?
  if (ball.z > LOSE_Z) {
    loseLife();
    return true;
  }

  return false;
}

// ============================================================
// RENDER
// ============================================================
function draw() {
  ctx.clearRect(0, 0, canvasW, canvasH);

  const so = getShakeOffset();
  ctx.save();
  ctx.translate(so.x, so.y);

  const s = scale;
  const ox = offX;
  const oy = offY;
  const cw = COURT_W * s;
  const ch = COURT_H * s;

  // --- Fondo de cancha ---
  const grad = ctx.createRadialGradient(
    ox + cw / 2,
    oy + ch / 2,
    0,
    ox + cw / 2,
    oy + ch / 2,
    cw * 0.8,
  );
  grad.addColorStop(0, '#1a1030');
  grad.addColorStop(1, '#0a0a14');
  ctx.fillStyle = grad;
  ctx.fillRect(ox, oy, cw, ch);

  // --- Borde glow ---
  ctx.shadowColor = 'rgba(122,92,255,0.15)';
  ctx.shadowBlur = 20;
  ctx.strokeStyle = 'rgba(122,92,255,0.2)';
  ctx.lineWidth = 1.5 * s;
  ctx.strokeRect(ox, oy, cw, ch);
  ctx.shadowBlur = 0;

  // --- Ladrillos ---
  for (const b of bricks) {
    if (!b.alive) continue;
    drawBrick(ox + b.x * s, oy + b.z * s, b.w * s, b.h * s, b.color, b.glowColor);
  }

  // --- Paleta ---
  drawPaddle(
    ox + paddle.x * s,
    oy + paddle.z * s,
    PADDLE_HALF_W * 2 * s,
    PADDLE_WIDTH * s,
    '#6ec6ff',
  );

  // --- Pelota ---
  if (state.running || !state.gameOver) {
    drawBall(ox + ball.x * s, oy + ball.z * s, BALL_RADIUS * s);
  }

  // --- Partículas ---
  drawParticles(ctx, offX, offY, scale);

  ctx.restore();
}

function drawBrick(x, y, w, h, color, glowColor) {
  const hw = w / 2;
  const hh = h / 2;

  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, x - hw + 2 * scale, y - hh + 2 * scale, w, h, 3 * scale);
  ctx.fill();

  // Cuerpo
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 10 * scale;
  ctx.fillStyle = color;
  roundRect(ctx, x - hw, y - hh, w, h, 3 * scale);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Brillo superior
  const grad = ctx.createLinearGradient(x, y - hh, x, y + hh);
  grad.addColorStop(0, 'rgba(255,255,255,0.25)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  roundRect(ctx, x - hw, y - hh, w, h, 3 * scale);
  ctx.fill();
}

function drawPaddle(x, y, width, height, color) {
  const hw = width / 2;
  const hh = height / 2;

  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 8 * scale;
  roundRect(ctx, x - hw + 3 * scale, y - hh + 3 * scale, width, height, 5 * scale);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Cuerpo glow
  ctx.shadowColor = color;
  ctx.shadowBlur = 14 * scale;
  ctx.fillStyle = color;
  roundRect(ctx, x - hw, y - hh, width, height, 5 * scale);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Brillo central
  const grad = ctx.createLinearGradient(x - hw, y, x + hw, y);
  grad.addColorStop(0, 'rgba(255,255,255,0.0)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.2)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.3)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  roundRect(
    ctx,
    x - hw + width * 0.2,
    y - hh + 4 * scale,
    width * 0.6,
    height - 8 * scale,
    3 * scale,
  );
  ctx.fill();

  // Extremos redondeados pequeños
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(
    ctx,
    x - hw + 2 * scale,
    y - hh + 2 * scale,
    width * 0.25,
    height - 4 * scale,
    3 * scale,
  );
  ctx.fill();
  roundRect(
    ctx,
    x + hw - width * 0.25 - 2 * scale,
    y - hh + 2 * scale,
    width * 0.25,
    height - 4 * scale,
    3 * scale,
  );
  ctx.fill();
}

function drawBall(x, y, r) {
  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.arc(x + 3 * scale, y + 3 * scale, r, 0, Math.PI * 2);
  ctx.fill();

  // Glow exterior
  ctx.shadowColor = '#ffdca0';
  ctx.shadowBlur = 20 * scale;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Brillo interior
  const bg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(0.5, '#fff5e0');
  bg.addColorStop(1, '#ffdca0');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ============================================================
// HUD
// ============================================================
const scoreValueEl = document.getElementById('scoreValue');
const livesValueEl = document.getElementById('livesValue');
const bestValueEl = document.getElementById('bestValue');
const levelDisplayEl = document.getElementById('levelDisplay');

function updateHUD() {
  scoreValueEl.textContent = String(state.score);
  livesValueEl.textContent =
    '●'.repeat(Math.max(0, state.lives)) + '○'.repeat(Math.max(0, START_LIVES - state.lives));
  bestValueEl.textContent = String(state.best);
  levelDisplayEl.textContent = String(state.level);
}

// ============================================================
// BUCLE PRINCIPAL
// ============================================================
let animFrameId = null;
let lastTime = 0;

function tick(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  pollGamepad();
  updateShake(dt);

  if (state.running && !state.gameOver) {
    updatePaddle(dt);
    updateBall(dt);
  }

  updateParticles(dt);
  draw();
  animFrameId = requestAnimationFrame(tick);
}

// State init
paddle.x = COURT_W / 2;
paddle.z = PADDLE_Z;
buildBricks();
parkBallOnPaddle();
updateHUD();

function cleanup() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  document.removeEventListener('keydown', trapTab);
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
document.getElementById('helpBtn')?.addEventListener('click', () => showHelp('breakout'));
