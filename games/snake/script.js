import { showHelp } from '../../shared/help.js';
import { ensureAudio, beep, startAmbient, closeAudio } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements } from '../../shared/dom.js';
import { setupCanvas } from '../../shared/display.js';
import { createGameLoop } from '../../shared/loop.js';
import {
  updateShake,
  getShakeOffset,
  roundRect,
  spawnParticles,
  updateParticles,
  drawParticles,
  drawGlow,
  feedbackBundle,
  triggerSquash,
  updateSquashes,
  clearSquashes,
} from '../../shared/effects.js';

injectCommonElements();

document.documentElement.dataset.theme = localStorage.getItem('arcadehub_theme') || 'dark';
/* ============================================================
   SNAKE 2D — Arcade Hub
   Canvas 2D, sin dependencias externas.
   JS organizado: constantes → estado → canvas → sonido → partículas
   → entrada → overlay → lógica → física → render → bucle
   ============================================================ */

// ============================================================
// CONSTANTES
// ============================================================
const COLS = 20;
const ROWS = 16;
const CELL_SIZE = 28; // tamaño lógico de cada celda
const COURT_W = COLS * CELL_SIZE;
const COURT_H = ROWS * CELL_SIZE;
const COURT_PADDING = 20;

const MOVE_INTERVAL_BASE = 160; // ms entre movimientos (nivel 1)
const MOVE_INTERVAL_MIN = 60; // ms mínimo (máxima velocidad)
const SPEED_LEVELS = 10; // cada cuántos puntos sube velocidad

const START_LENGTH = 3;

// Direcciones
const DIR = {
  NONE: { dx: 0, dz: 0 },
  UP: { dx: 0, dz: -1 },
  DOWN: { dx: 0, dz: 1 },
  LEFT: { dx: -1, dz: 0 },
  RIGHT: { dx: 1, dz: 0 },
};

// ============================================================
// ESTADO
// ============================================================
const state = {
  running: false,
  gameOver: false,
  paused: false,
  score: 0,
  best: Number(localStorage.getItem('snake2d_best') || 0),
  speedLevel: 1,
};

// Snake: array de { x, z } en coordenadas de grid
let snake = [];
const food = { x: 0, z: 0 };
let direction = DIR.NONE;
let nextDirection = DIR.NONE;
let moveTimer = 0;

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
function playEatSound() {
  feedbackBundle('medium', snake[0].x, snake[0].y, {
    color: '#6ee7b7',
    onBeep: () => beep({ freq: 440, freqEnd: 660, duration: 0.08, type: 'triangle', volume: 0.18 }),
  });
}
function playTurnSound() {
  beep({ freq: 260, freqEnd: 310, duration: 0.04, type: 'sine', volume: 0.08 });
}
function playDeathSound() {
  feedbackBundle('large', snake[0].x, snake[0].y, {
    color: '#ff4444',
    noFlash: true,
    onBeep: () => beep({ freq: 300, freqEnd: 60, duration: 0.5, type: 'sawtooth', volume: 0.2 }),
  });
}
function playPauseSound() {
  beep({ freq: 300, freqEnd: 400, duration: 0.06, type: 'square', volume: 0.1 });
}

// ============================================================
// PARTÍCULAS
// ============================================================
// ============================================================
// ENTRADA: TECLADO
// ============================================================
const keys = {};

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;

  let dir = null;
  if (['ArrowUp', 'KeyW'].includes(e.code)) {
    e.preventDefault();
    dir = DIR.UP;
  } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
    e.preventDefault();
    dir = DIR.DOWN;
  } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
    e.preventDefault();
    dir = DIR.LEFT;
  } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
    e.preventDefault();
    dir = DIR.RIGHT;
  } else if (e.code === 'Space' || e.code === 'KeyP') {
    e.preventDefault();
    togglePause();
    return;
  } else if (e.code === 'KeyR' && !state.running) {
    e.preventDefault();
    startGame();
    return;
  }

  if (dir) {
    if (!state.running) {
      startGame();
      setDirection(dir); // apply first input direction
    } else if (state.running && !state.gameOver) {
      setDirection(dir);
    }
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

// ============================================================
// ENTRADA: TÁCTIL
// ============================================================
function bindDirectionButton(btn, dir) {
  btn.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      btn.classList.add('is-pressed');
      if (!state.running) {
        startGame();
        setDirection(dir); // apply first input direction
      } else if (state.running && !state.gameOver) {
        setDirection(dir);
      }
    },
    { passive: false },
  );
  btn.addEventListener(
    'touchend',
    (e) => {
      e.preventDefault();
      btn.classList.remove('is-pressed');
    },
    { passive: false },
  );
  btn.addEventListener('touchcancel', () => {
    btn.classList.remove('is-pressed');
  });
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (!state.running) {
      startGame();
      setDirection(dir);
    } else if (state.running && !state.gameOver) {
      setDirection(dir);
    }
  });
}

bindDirectionButton(document.getElementById('btnUp'), DIR.UP);
bindDirectionButton(document.getElementById('btnDown'), DIR.DOWN);
bindDirectionButton(document.getElementById('btnLeft'), DIR.LEFT);
bindDirectionButton(document.getElementById('btnRight'), DIR.RIGHT);

const btnPause = document.getElementById('btnPause');
btnPause.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    btnPause.classList.add('is-pressed');
    togglePause();
  },
  { passive: false },
);
btnPause.addEventListener(
  'touchend',
  (e) => {
    e.preventDefault();
    btnPause.classList.remove('is-pressed');
  },
  { passive: false },
);
btnPause.addEventListener('touchcancel', () => {
  btnPause.classList.remove('is-pressed');
});
btnPause.addEventListener('mousedown', (e) => {
  e.preventDefault();
  togglePause();
});

// ============================================================
// ENTRADA: GAMEPAD
// ============================================================
let gamepadIndex = null;
let prevStart = false;
let prevPause = false;

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
  if (!gp) return;

  // D-pad
  const dpadUp = !!gp.buttons[12]?.pressed;
  const dpadDown = !!gp.buttons[13]?.pressed;
  const dpadLeft = !!gp.buttons[14]?.pressed;
  const dpadRight = !!gp.buttons[15]?.pressed;

  // Stick
  const stickX = gp.axes[0] ?? 0;
  const stickY = gp.axes[1] ?? 0;

  let dir = null;
  if (dpadUp || (stickY < -0.4 && Math.abs(stickX) < 0.6)) dir = DIR.UP;
  else if (dpadDown || (stickY > 0.4 && Math.abs(stickX) < 0.6)) dir = DIR.DOWN;
  else if (dpadLeft || (stickX < -0.4 && Math.abs(stickY) < 0.6)) dir = DIR.LEFT;
  else if (dpadRight || (stickX > 0.4 && Math.abs(stickY) < 0.6)) dir = DIR.RIGHT;

  if (dir) {
    if (!state.running) {
      startGame();
      setDirection(dir); // apply first input direction
    } else if (state.running && !state.gameOver) {
      setDirection(dir);
    }
  }

  // Start / action button
  const startHeld = !!gp.buttons[9]?.pressed;
  if (startHeld && !prevStart) {
    if (!state.running) startGame();
    else togglePause();
  }
  prevStart = startHeld;

  // Select / back = pause
  const selectHeld = !!gp.buttons[8]?.pressed;
  if (selectHeld && !prevPause) {
    togglePause();
  }
  prevPause = selectHeld;
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
function setDirection(dir) {
  // No permitir reversa instantánea
  if (direction === DIR.UP && dir === DIR.DOWN) return;
  if (direction === DIR.DOWN && dir === DIR.UP) return;
  if (direction === DIR.LEFT && dir === DIR.RIGHT) return;
  if (direction === DIR.RIGHT && dir === DIR.LEFT) return;
  nextDirection = dir;
  playTurnSound();
}

function spawnFood() {
  // Encontrar una celda vacía
  const occupied = new Set(snake.map((s) => `${s.x},${s.z}`));
  const freeCells = [];
  for (let x = 0; x < COLS; x++) {
    for (let z = 0; z < ROWS; z++) {
      if (!occupied.has(`${x},${z}`)) {
        freeCells.push({ x, z });
      }
    }
  }
  if (freeCells.length === 0) return false; // ganaste!
  const cell = freeCells[Math.floor(Math.random() * freeCells.length)];
  food.x = cell.x;
  food.z = cell.z;
  return true;
}

function initSnake() {
  snake = [];
  const startX = Math.floor(COLS / 2);
  const startZ = Math.floor(ROWS / 2);
  for (let i = 0; i < START_LENGTH; i++) {
    snake.push({ x: startX - i, z: startZ });
  }
}

function getMoveInterval() {
  const progress = Math.min(state.score / SPEED_LEVELS, 9);
  const interval = MOVE_INTERVAL_BASE - progress * ((MOVE_INTERVAL_BASE - MOVE_INTERVAL_MIN) / 9);
  return Math.max(MOVE_INTERVAL_MIN, interval);
}

function getSpeedLevel() {
  return Math.min(Math.floor(state.score / SPEED_LEVELS) + 1, 10);
}

function resetGame() {
  state.score = 0;
  state.gameOver = false;
  state.paused = false;
  state.speedLevel = 1;
  direction = DIR.RIGHT;
  nextDirection = DIR.RIGHT;
  moveTimer = 0;
  finalScoreEl.style.display = 'none';
  initSnake();
  spawnFood();
  updateHUD();
}

function startGame() {
  clearSquashes();
  ensureAudio();
  startAmbient();
  if (state.best >= 10) achievements.unlock('snake_decathlon');
  resetGame();
  state.running = true;
  achievements.incrementPlays('snake');
  overlay.classList.add('hidden');
  document.addEventListener('keydown', trapTab);
  say('Snake: comenzó la partida. Comé la comida para crecer.');
}

function togglePause() {
  if (!state.running || state.gameOver) return;
  state.paused = !state.paused;
  playPauseSound();
  if (state.paused) {
    overlayText.textContent = '⏸ PAUSA';
    finalScoreEl.style.display = 'none';
    hintEl.innerHTML = `<kbd>Espacio</kbd> / <kbd>P</kbd> / botón para continuar`;
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

function endGame() {
  state.running = false;
  state.gameOver = true;

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('snake2d_best', String(state.best));
  }

  playDeathSound();

  // Death particles along the snake
  for (const seg of snake) {
    spawnParticles(seg.x * CELL_SIZE + CELL_SIZE / 2, seg.z * CELL_SIZE + CELL_SIZE / 2);
  }

  overlayText.textContent = '¡Game Over! 💀';
  finalScoreEl.style.display = 'block';
  finalScoreEl.textContent = `Puntos: ${state.score} · Más largo: ${state.score + START_LENGTH} · Mejor: ${state.best}`;
  hintEl.innerHTML = `<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> / tocar para empezar  ·  <kbd>R</kbd> reiniciar`;
  overlay.classList.remove('hidden');
  document.removeEventListener('keydown', trapTab);
  say('Snake: juego terminado.');
  updateHUD();
}

// ============================================================
// FÍSICA / ACTUALIZACIÓN
// ============================================================
function updateGame(dt) {
  if (!state.running || state.gameOver || state.paused) return;

  moveTimer += dt * 1000;

  if (moveTimer >= getMoveInterval()) {
    moveTimer -= getMoveInterval();
    moveSnake();
  }
}

function moveSnake() {
  direction = nextDirection;
  if (direction === DIR.NONE) return;

  const head = snake[0];
  const newHead = {
    x: head.x + direction.dx,
    z: head.z + direction.dz,
  };

  // ¿Colisión con pared?
  if (newHead.x < 0 || newHead.x >= COLS || newHead.z < 0 || newHead.z >= ROWS) {
    endGame();
    return;
  }

  // ¿Colisión con sí mismo? (excepto la cola que se va a mover)
  for (let i = 0; i < snake.length - 1; i++) {
    if (snake[i].x === newHead.x && snake[i].z === newHead.z) {
      endGame();
      return;
    }
  }

  snake.unshift(newHead);

  // ¿Comió comida?
  if (newHead.x === food.x && newHead.z === food.z) {
    state.score += 1;
    state.speedLevel = getSpeedLevel();
    playEatSound();
    spawnParticles(
      food.x * CELL_SIZE + CELL_SIZE / 2,
      food.z * CELL_SIZE + CELL_SIZE / 2,
      '#6ee7b7',
      12,
      { speed: 120, life: 0.5 },
    );
    if (!spawnFood()) {
      // Ganaste (llenaste el tablero) — raro, pero manejarlo
      endGame();
      return;
    }
    updateHUD();
  } else {
    snake.pop(); // no crece, quita la cola
  }
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
  const cs = CELL_SIZE * s; // tamaño de celda escalado

  // --- Fondo de cancha ---
  const grad = ctx.createRadialGradient(
    ox + cw / 2,
    oy + ch / 2,
    0,
    ox + cw / 2,
    oy + ch / 2,
    cw * 0.7,
  );
  grad.addColorStop(0, '#0d1a14');
  grad.addColorStop(1, '#0a0a14');
  ctx.fillStyle = grad;
  ctx.fillRect(ox, oy, cw, ch);

  // --- Grid tenue ---
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 0.5 * s;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(ox + x * cs, oy);
    ctx.lineTo(ox + x * cs, oy + ch);
    ctx.stroke();
  }
  for (let z = 0; z <= ROWS; z++) {
    ctx.beginPath();
    ctx.moveTo(ox, oy + z * cs);
    ctx.lineTo(ox + cw, oy + z * cs);
    ctx.stroke();
  }

  // --- Borde glow ---
  ctx.shadowColor = 'rgba(110,231,183,0.1)';
  ctx.shadowBlur = 20;
  ctx.strokeStyle = 'rgba(110,231,183,0.2)';
  ctx.lineWidth = 1.5 * s;
  ctx.strokeRect(ox, oy, cw, ch);
  ctx.shadowBlur = 0;

  // --- Comida ---
  const fx = ox + food.x * cs + cs / 2;
  const fy = oy + food.z * cs + cs / 2;
  const fr = cs * 0.4;

  // Sombra comida
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.arc(fx + 2 * s, fy + 2 * s, fr, 0, Math.PI * 2);
  ctx.fill();

  // Pulso de la comida
  const pulse = 1 + Math.sin(Date.now() / 200) * 0.1;

  ctx.shadowColor = 'rgba(255,77,77,0.5)';
  ctx.shadowBlur = 16 * s;
  const fgrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr * pulse);
  fgrad.addColorStop(0, '#ff9999');
  fgrad.addColorStop(0.6, '#ff4444');
  fgrad.addColorStop(1, '#cc2222');
  ctx.fillStyle = fgrad;
  ctx.beginPath();
  ctx.arc(fx, fy, fr * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // --- Serpiente ---
  for (let i = snake.length - 1; i >= 0; i--) {
    const seg = snake[i];
    const sx = ox + seg.x * cs;
    const sz = oy + seg.z * cs;
    const t = i / Math.max(snake.length - 1, 1);
    const intensity = 1 - t * 0.5;

    // Color: cabeza más brillante, cola más tenue
    const r = Math.round(110 * intensity);
    const g = Math.round(231 * intensity);
    const b = Math.round(183 * intensity);
    const color = `rgb(${r},${g},${b})`;

    const cellPad = 1 * s;
    const cellSize = cs - cellPad * 2;
    const cx = sx + cellPad;
    const cy = sz + cellPad;

    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    roundRect(ctx, cx + 1.5 * s, cy + 1.5 * s, cellSize, cellSize, 3 * s);
    ctx.fill();

    // Cuerpo con glow
    const glowColor = i === 0 ? 'rgba(110,231,183,0.15)' : 'rgba(110,231,183,0.06)';
    ctx.fillStyle = color;
    roundRect(ctx, cx, cy, cellSize, cellSize, 3 * s);
    ctx.fill();
    drawGlow(ctx, cx + cellSize / 2, cy + cellSize / 2, cellSize * 0.5, glowColor, 0.06, 2.5);

    // Ojos en la cabeza
    if (i === 0) {
      const eyeR = 2 * s;
      const eyeOff = 3 * s;
      ctx.fillStyle = '#ffffff';
      let ex1, ez1, ex2, ez2;
      const half = cs / 2;
      if (direction.dx === 1) {
        // derecha
        ex1 = sx + cs - eyeOff;
        ez1 = sz + half - eyeOff;
        ex2 = sx + cs - eyeOff;
        ez2 = sz + half + eyeOff;
      } else if (direction.dx === -1) {
        // izquierda
        ex1 = sx + eyeOff;
        ez1 = sz + half - eyeOff;
        ex2 = sx + eyeOff;
        ez2 = sz + half + eyeOff;
      } else if (direction.dz === -1) {
        // arriba
        ex1 = sx + half - eyeOff;
        ez1 = sz + eyeOff;
        ex2 = sx + half + eyeOff;
        ez2 = sz + eyeOff;
      } else {
        // abajo o quieto
        ex1 = sx + half - eyeOff;
        ez1 = sz + cs - eyeOff;
        ex2 = sx + half + eyeOff;
        ez2 = sz + cs - eyeOff;
      }
      ctx.beginPath();
      ctx.arc(ex1, ez1, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex2, ez2, eyeR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Partículas ---
  drawParticles(ctx, offX, offY, scale);

  // --- Overlay de pausa (en-canvas) ---
  if (state.paused && state.running) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(ox, oy, cw, ch);
    ctx.fillStyle = '#fff';
    ctx.font = `${28 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏸ PAUSA', ox + cw / 2, oy + ch / 2);
  }

  ctx.restore();
}

// ============================================================
// HUD
// ============================================================
const scoreValueEl = document.getElementById('scoreValue');
const bestValueEl = document.getElementById('bestValue');
const speedValueEl = document.getElementById('speedValue');

function updateHUD() {
  scoreValueEl.textContent = String(state.score);
  bestValueEl.textContent = String(state.best);
  speedValueEl.textContent = String(state.speedLevel);
}

// ============================================================
// BUCLE PRINCIPAL
// ============================================================
const loop = createGameLoop((dt) => {
  pollGamepad();
  updateShake(dt);

  if (state.running && !state.gameOver && !state.paused) {
    updateGame(dt);
  }

  updateSquashes(dt);
  updateParticles(dt);
  draw();
});

// State init
initSnake();
spawnFood();
updateHUD();

function cleanup() {
  loop.stop();
  document.removeEventListener('keydown', trapTab);
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
document.getElementById('helpBtn')?.addEventListener('click', () => showHelp('snake'));
