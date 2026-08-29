import { ensureAudio, beep, startAmbient } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements } from '../../shared/dom.js';
import { startMusic, stopMusic } from '../../shared/music.js';
import { setupCanvas } from '../../shared/display.js';
import { setupGameShell } from '../../shared/shell.js';
import { loadBest, saveBest } from '../../shared/scores.js';
import { createGameLoop } from '../../shared/loop.js';
import { createGamepad } from '../../shared/input.js';
import {
  updateShake,
  spawnParticles,
  updateParticles,
  drawParticles,
  drawGlow,
  feedbackBundle,
  updateSquashes,
  clearSquashes,
} from '../../shared/effects.js';

injectCommonElements();
const shell = setupGameShell('puyo-puyo');

const COLS = 6;
const ROWS = 12;
const CELL = 28;
const COLORS = ['#ff2d78', '#00f0ff', '#ffb800', '#39ff14'];
const BOARD_W = COLS * CELL;
const BOARD_H = ROWS * CELL;
const BOARD_PAD = 20;
const TOTAL_W = BOARD_W * 2 + CELL * 6 + BOARD_PAD * 2;
const TOTAL_H = BOARD_H + BOARD_PAD * 2;
const DROP_SPEED_BASE = 500;
const DROP_ACCEL = 10;
const GARBAGE_DELAY = 2.0;

const state = {
  running: false,
  gameOver: false,
  paused: false,
  score: 0,
  best: loadBest('puyoPuyo'),
  level: 1,
  maxChain: 0,
};

let board = [];
let piece = null;
let dropTimer = 0;
let softDrop = false;
let lockTimer = 0;
let flashing = [];
let flashTimer = 0;
let pendingClear = false;
let garbageQueue = 0;
let garbageTimer = 0;
// CPU
let cpuBoard = [];
let cpuPiece = null;
let cpuDropTimer = 0;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const { w: cW, h: cH, s: sc, x: ox, y: oy } = setupCanvas(canvas, ctx, TOTAL_W, TOTAL_H, BOARD_PAD);

function sfx(f, e, d, t, v) {
  beep({ freq: f, freqEnd: e, duration: d, type: t, volume: v });
}
function moveSfx() {
  sfx(300, 200, 0.03, 'sine', 0.08);
}
function rotateSfx() {
  sfx(400, 500, 0.04, 'triangle', 0.1);
}
function dropSfx() {
  sfx(200, 100, 0.08, 'square', 0.12);
}
function clearSfx(chain) {
  sfx(400 + chain * 100, 600 + chain * 100, 0.12, 'triangle', 0.18);
}
function garbageSfx() {
  sfx(150, 80, 0.15, 'sawtooth', 0.15);
}

function createEmptyBoard() {
  const b = [];
  for (let r = 0; r < ROWS; r++) b.push(new Array(COLS).fill(-1));
  return b;
}

function isOccupied(b, r, c) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
  return b[r][c] !== -1;
}

function spawnPiece() {
  const c1 = Math.floor(Math.random() * COLORS.length);
  const c2 = Math.floor(Math.random() * COLORS.length);
  return { col: Math.floor(COLS / 2) - 1, row: -1, gems: [c1, c2] };
}

function rotatePiece(p) {
  const t = p.gems[0];
  p.gems[0] = p.gems[1];
  p.gems[1] = t;
}

function movePiece(p, dx) {
  const nc = p.col + dx;
  if (nc < 0 || nc >= COLS) return;
  if (isOccupied(board, p.row, nc) || isOccupied(board, p.row + 1, nc)) return;
  p.col = nc;
  moveSfx();
}

function canDrop(b, p) {
  return !isOccupied(b, p.row + 2, p.col);
}

function placePiece(b, p) {
  for (let i = 0; i < 2; i++) {
    const r = p.row + i;
    if (r >= 0 && r < ROWS) b[r][p.col] = p.gems[i];
  }
}

function findMatches(b) {
  const matched = new Set();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const color = b[r][c];
      if (color === -1) continue;
      let len = 1;
      while (c + len < COLS && b[r][c + len] === color) len++;
      if (len >= 4) for (let i = 0; i < len; i++) matched.add(`${r},${c + i}`);
    }
  }
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      const color = b[r][c];
      if (color === -1) continue;
      let len = 1;
      while (r + len < ROWS && b[r + len][c] === color) len++;
      if (len >= 4) for (let i = 0; i < len; i++) matched.add(`${r + i},${c}`);
    }
  }
  return matched;
}

function clearMatches(b, matched) {
  let cleared = 0;
  for (const key of matched) {
    const [r, c] = key.split(',').map(Number);
    if (b[r][c] !== -1) {
      const px = ox + (c + 0.5) * CELL * sc;
      const py = oy + (r + 0.5) * CELL * sc;
      spawnParticles(px, py, 4, COLORS[b[r][c]], { speed: 80, life: 0.3 });
      b[r][c] = -1;
      cleared++;
    }
  }
  return cleared;
}

function applyGravity(b) {
  let moved = false;
  for (let c = 0; c < COLS; c++) {
    let w = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (b[r][c] !== -1) {
        if (w !== r) {
          b[w][c] = b[r][c];
          b[r][c] = -1;
          moved = true;
        }
        w--;
      }
    }
  }
  return moved;
}

function addGarbage(count) {
  for (let i = 0; i < count; i++) {
    const c = Math.floor(Math.random() * COLS);
    for (let r = ROWS - 1; r > 0; r--) {
      if (board[r][c] === -1 && board[r - 1][c] !== -1) {
        board[r][c] = -2; // garbage marker
        break;
      }
    }
  }
}

function scoreClear(count, chain) {
  return count * 10 + (chain > 1 ? chain * 30 : 0) + state.level * 5;
}

// CPU AI
function cpuThink() {
  if (!cpuPiece) return;
  let bestCol = cpuPiece.col;
  let bestScore = -1;
  for (let c = 0; c < COLS; c++) {
    const testBoard = cpuBoard.map((r) => [...r]);
    const tp = { ...cpuPiece, col: c, row: -1 };
    while (!isOccupied(testBoard, tp.row + 2, tp.col)) tp.row++;
    placePiece(testBoard, tp);
    const m = findMatches(testBoard);
    const score = m.size;
    if (score > bestScore) {
      bestScore = score;
      bestCol = c;
    }
  }
  cpuPiece.col = bestCol;
}

function cpuUpdate(dt) {
  if (!state.running || state.gameOver || state.paused) return;
  if (!cpuPiece) {
    cpuPiece = spawnPiece(cpuBoard);
    cpuDropTimer = 0;
    cpuThink();
  }
  cpuDropTimer += dt * 1000;
  if (cpuDropTimer >= DROP_SPEED_BASE - (state.level - 1) * DROP_ACCEL) {
    cpuDropTimer = 0;
    if (!isOccupied(cpuBoard, cpuPiece.row + 2, cpuPiece.col)) {
      cpuPiece.row++;
    } else {
      placePiece(cpuBoard, cpuPiece);
      const matched = findMatches(cpuBoard);
      if (matched.size > 0) {
        const count = clearMatches(cpuBoard, matched);
        const chain = Math.floor(count / 4);
        garbageQueue += chain * 2;
        applyGravity(cpuBoard);
      }
      cpuPiece = null;
    }
  }
}

function startGame() {
  ensureAudio();
  board = createEmptyBoard();
  cpuBoard = createEmptyBoard();
  state.score = 0;
  state.level = 1;
  state.maxChain = 0;
  state.running = true;
  state.gameOver = false;
  state.paused = false;
  piece = spawnPiece();
  cpuPiece = null;
  dropTimer = 0;
  softDrop = false;
  lockTimer = 0;
  pendingClear = false;
  flashing = [];
  garbageQueue = 0;
  garbageTimer = 0;
  clearSquashes();
  startAmbient();
  startMusic('puyo-puyo');
  shell.enableTabTrap();
  overlay.classList.add('hidden');
  say('Puyo Puyo — ¡Cadenas!');
}

function endGame() {
  state.gameOver = true;
  state.running = false;
  shell.disableTabTrap();
  stopMusic();
  sfx(300, 40, 0.5, 'sawtooth', 0.2);
  if (state.score > state.best) {
    state.best = state.score;
    saveBest('puyoPuyo', state.best);
  }
  achievements.unlock('puyo_first_game');
  if (state.score >= 1000) achievements.unlock('puyo_high_scorer');
  if (state.maxChain >= 4) achievements.unlock('puyo_chain_master');
  finalScoreEl.textContent = `Puntos: ${state.score}`;
  finalScoreEl.style.display = '';
  overlayText.textContent = '¡Juego terminado!';
  hintEl.innerHTML = '<kbd>R</kbd> reiniciar · <kbd>Espacio</kbd> / tap para jugar de nuevo';
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (!state.running || state.gameOver) return;
  state.paused = !state.paused;
}

const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyR' && (state.gameOver || !state.running)) {
    e.preventDefault();
    startGame();
    return;
  }
  if (e.code === 'Space' || e.code === 'KeyP') {
    e.preventDefault();
    if (!state.running) startGame();
    else togglePause();
    return;
  }
  if (!state.running || state.gameOver || state.paused || !piece) return;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    e.preventDefault();
    movePiece(piece, -1);
  }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    movePiece(piece, 1);
  }
  if (e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    rotatePiece(piece);
    rotateSfx();
  }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    e.preventDefault();
    softDrop = true;
  }
  if (e.code === 'Space') {
    e.preventDefault();
    hardDrop();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowDown' || e.code === 'KeyS') softDrop = false;
});

function hardDrop() {
  if (!piece) return;
  while (canDrop(board, piece)) piece.row++;
  lockPiece();
  dropSfx();
}

function lockPiece() {
  placePiece(board, piece);
  piece = null;
  lockTimer = 0;
  checkAndClear();
}

let chainCount = 0;
function checkAndClear() {
  const matched = findMatches(board);
  if (matched.size > 0) {
    pendingClear = true;
    flashing = [...matched];
    flashTimer = 0.35;
    chainCount++;
  } else {
    if (chainCount > 0) {
      const garbage = chainCount * 2;
      garbageQueue += garbage;
      garbageTimer = GARBAGE_DELAY;
      state.maxChain = Math.max(state.maxChain, chainCount);
    }
    chainCount = 0;
    // Apply pending garbage
    if (garbageQueue > 0 && garbageTimer <= 0) {
      addGarbage(garbageQueue);
      garbageQueue = 0;
      garbageSfx();
    }
    piece = spawnPiece();
    if (isOccupied(board, 0, piece.col) || isOccupied(board, 1, piece.col)) endGame();
  }
}

function processClear() {
  const matched = new Set(flashing);
  const count = clearMatches(board, matched);
  if (count > 0) {
    const pts = scoreClear(count, chainCount);
    state.score += pts;
    clearSfx(chainCount);
    feedbackBundle('medium', TOTAL_W / 2, TOTAL_H / 2, { color: COLORS[0] });
  }
  flashing = [];
  flashTimer = 0;
  pendingClear = false;
  applyGravity(board);
  const next = findMatches(board);
  if (next.size > 0) {
    pendingClear = true;
    flashing = [...next];
    flashTimer = 0.35;
    chainCount++;
  } else {
    if (chainCount > 0) {
      garbageQueue += chainCount * 2;
      garbageTimer = GARBAGE_DELAY;
      state.maxChain = Math.max(state.maxChain, chainCount);
    }
    chainCount = 0;
    if (garbageQueue > 0 && garbageTimer <= 0) {
      addGarbage(garbageQueue);
      garbageQueue = 0;
      garbageSfx();
    }
    piece = spawnPiece();
    if (isOccupied(board, 0, piece.col) || isOccupied(board, 1, piece.col)) endGame();
  }
}

function bindTouch(id, fn, onUp) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      btn.classList.add('is-pressed');
      if (!state.running) startGame();
      fn();
    },
    { passive: false },
  );
  btn.addEventListener(
    'touchend',
    (e) => {
      e.preventDefault();
      btn.classList.remove('is-pressed');
      onUp?.();
    },
    { passive: false },
  );
  btn.addEventListener('touchcancel', () => {
    btn.classList.remove('is-pressed');
    onUp?.();
  });
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (!state.running) startGame();
    fn();
  });
  btn.addEventListener('mouseup', () => onUp?.());
}
bindTouch('btnLeft', () => piece && movePiece(piece, -1));
bindTouch('btnRight', () => piece && movePiece(piece, 1));
bindTouch('btnUp', () => {
  piece && rotatePiece(piece);
  rotateSfx();
});
bindTouch(
  'btnDown',
  () => {
    softDrop = true;
  },
  () => {
    softDrop = false;
  },
);
bindTouch('btnDrop', () => {
  if (piece) hardDrop();
});

const gamepad = createGamepad();
let prevStart = false;
function pollGamepad() {
  const gp = gamepad.pad;
  if (!gp) return;
  if (!!gp.buttons[14]?.pressed && piece) movePiece(piece, -1);
  if (!!gp.buttons[15]?.pressed && piece) movePiece(piece, 1);
  if (!!gp.buttons[12]?.pressed && piece) {
    rotatePiece(piece);
    rotateSfx();
  }
  if (gp.buttons[13]?.pressed) softDrop = true;
  else softDrop = false;
  if (!!gp.buttons[0]?.pressed && piece) hardDrop();
  const sH = !!gp.buttons[9]?.pressed;
  if (sH && !prevStart) {
    if (!state.running) startGame();
    else togglePause();
  }
  prevStart = sH;
}

const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlayText');
const hintEl = document.getElementById('hintEl');
const finalScoreEl = document.getElementById('finalScore');
const announce = document.getElementById('announce');
function say(msg) {
  if (announce) announce.textContent = msg;
}
overlay.addEventListener('click', () => {
  if (!state.running) startGame();
});

function updateGame(dt) {
  cpuUpdate(dt);
  garbageTimer -= dt;

  if (pendingClear) {
    flashTimer -= dt;
    if (flashTimer <= 0) processClear();
    return;
  }
  if (!piece) return;
  const speed = softDrop
    ? (DROP_SPEED_BASE - (state.level - 1) * DROP_ACCEL) * 0.15
    : DROP_SPEED_BASE - (state.level - 1) * DROP_ACCEL;
  dropTimer += dt * 1000;
  if (dropTimer >= speed) {
    dropTimer = 0;
    if (canDrop(board, piece)) {
      piece.row++;
    } else {
      lockTimer += speed;
      if (lockTimer >= 60) lockPiece();
    }
  }
  state.level = Math.floor(state.score / 200) + 1;
}

function drawBoard(b, offsetX, label) {
  const bx = ox + offsetX * sc;
  const by = oy;

  ctx.fillStyle = 'rgba(20,20,40,0.8)';
  ctx.fillRect(bx, by, BOARD_W * sc, BOARD_H * sc);

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(bx + c * CELL * sc, by);
    ctx.lineTo(bx + c * CELL * sc, by + BOARD_H * sc);
    ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(bx, by + r * CELL * sc);
    ctx.lineTo(bx + BOARD_W * sc, by + r * CELL * sc);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 2 * sc;
  ctx.strokeRect(bx, by, BOARD_W * sc, BOARD_H * sc);

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = `${10 * sc}px 'Courier New', monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(label, bx + BOARD_W * sc * 0.5, by - 6 * sc);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const color = b[r][c];
      if (color === -1) continue;
      if (flashing.includes(`${r},${c}`) && Math.floor(flashTimer * 10) % 2 === 0) continue;
      const gx = bx + c * CELL * sc;
      const gy = by + r * CELL * sc;
      const pad = 2 * sc;
      const sz = CELL * sc - pad * 2;
      ctx.fillStyle = COLORS[color];
      ctx.beginPath();
      ctx.arc(gx + CELL * sc * 0.5, gy + CELL * sc * 0.5, sz * 0.45, 0, Math.PI * 2);
      ctx.fill();
      drawGlow(ctx, gx + CELL * sc * 0.5, gy + CELL * sc * 0.5, sz * 0.3, COLORS[color], 0.1, 2);
    }
  }
}

function draw() {
  ctx.save();
  ctx.clearRect(0, 0, cW, cH);
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, cW, cH);

  drawBoard(board, BOARD_PAD, 'JUGADOR');
  drawBoard(cpuBoard, BOARD_PAD + BOARD_W + CELL * 4, 'CPU');

  if (piece) {
    const bx = ox + BOARD_PAD * sc;
    for (let i = 0; i < 2; i++) {
      const r = piece.row + i;
      if (r < 0) continue;
      const gx = bx + piece.col * CELL * sc;
      const gy = oy + r * CELL * sc;
      const pad = 2 * sc;
      const sz = CELL * sc - pad * 2;
      ctx.fillStyle = COLORS[piece.gems[i]];
      ctx.beginPath();
      ctx.arc(gx + CELL * sc * 0.5, gy + CELL * sc * 0.5, sz * 0.45, 0, Math.PI * 2);
      ctx.fill();
      drawGlow(
        ctx,
        gx + CELL * sc * 0.5,
        gy + CELL * sc * 0.5,
        sz * 0.3,
        COLORS[piece.gems[i]],
        0.15,
        2.5,
      );
    }
  }

  drawParticles(ctx, ox, oy, sc);

  if (state.paused && state.running) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(ox, oy, TOTAL_W * sc, TOTAL_H * sc);
    ctx.fillStyle = '#fff';
    ctx.font = `${28 * sc}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏸ PAUSA', ox + TOTAL_W * sc * 0.5, oy + TOTAL_H * sc * 0.5);
  }
  ctx.restore();
}

const scoreEl = document.getElementById('scoreValue');
const bestEl = document.getElementById('bestValue');
const chainEl = document.getElementById('chainValue');
function updateHUD() {
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(state.best);
  chainEl.textContent = String(state.maxChain);
}

const loop = createGameLoop((dt) => {
  pollGamepad();
  updateShake(dt);
  if (state.running && !state.gameOver && !state.paused) updateGame(dt);
  updateSquashes(dt);
  updateParticles(dt);
  updateHUD();
  draw();
});

updateHUD();
shell.onCleanup(() => loop.stop());
document.getElementById('loading').classList.add('hidden');
loop.start();
