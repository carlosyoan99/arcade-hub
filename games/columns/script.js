import { ensureAudio, beep, startAmbient } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements, setHint } from '../../shared/dom.js';
import { startMusic } from '../../shared/music.js';
import { setupCanvas } from '../../shared/display.js';
import { setupGameShell } from '../../shared/shell.js';
import { loadBest, saveBest } from '../../shared/scores.js';
import { createGameLoop } from '../../shared/loop.js';
import { createGamepad, onKey, onKeyup, cleanupAll } from '../../shared/input.js';
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

const shell = setupGameShell('columns');

/* ============================================================
   COLUMNS — Arcade Hub
   Puzzle game: match 3+ gems of the same color.
   Canvas 2D, sin dependencias externas.
   ============================================================ */

// ── CONSTANTES ──
const COLS = 6;
const ROWS = 13;
const CELL = 32;
const GEM_COLORS = ['#ff2d78', '#00f0ff', '#ffb800', '#39ff14', '#c084fc', '#ff5e7a'];
const BOARD_W = COLS * CELL;
const BOARD_H = ROWS * CELL;
const BOARD_PAD = 24;
const TOTAL_W = BOARD_W + CELL * 4 + BOARD_PAD * 2;
const TOTAL_H = BOARD_H + BOARD_PAD * 2;
const DROP_SPEED_BASE = 600;
const DROP_SPEED_MIN = 80;
const DROP_ACCEL = 15;
const LOCK_DELAY = 80;
const MATCH_MIN = 3;
const FLASH_DURATION = 0.5;
const LEVEL_GEMS = 25;

// Special gems (power-ups)
const SPECIAL = { FLASH: 6, LIGHTNING: 7, POISON: 8 };
const SPECIAL_COLORS = {
  [SPECIAL.FLASH]: '#e8e8ff',
  [SPECIAL.LIGHTNING]: '#ffe066',
  [SPECIAL.POISON]: '#c084fc',
};
const SPECIAL_GLYPH = { [SPECIAL.FLASH]: '✦', [SPECIAL.LIGHTNING]: '⚡', [SPECIAL.POISON]: '☠' };

// ── ESTADO ──
const state = {
  running: false,
  gameOver: false,
  paused: false,
  score: 0,
  best: loadBest('columns2d'),
  level: 1,
  gemsCleared: 0,
  chainsThisMove: 0,
};

// Board: 2D array [row][col] = color index | -1 = empty
let board = [];
// Current piece: { col, row, gems: [top, mid, bottom] (color indices), rotation }
let piece = null;
let dropTimer = 0;
let softDropping = false;
let lockTimer = 0;
let flashing = [];
let flashTimer = 0;
let pendingClear = false;

// ── CANVAS SETUP ──
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const {
  w: canvasW,
  h: canvasH,
  s: scale,
  x: offX,
  y: offY,
} = setupCanvas(canvas, ctx, TOTAL_W, TOTAL_H, BOARD_PAD);

// ── SONIDO ──
function playMoveSound() {
  beep({ freq: 300, duration: 0.03, type: 'sine', volume: 0.1 });
}
function playRotateSound() {
  beep({ freq: 400, freqEnd: 500, duration: 0.04, type: 'triangle', volume: 0.12 });
}
function playDropSound() {
  beep({ freq: 200, freqEnd: 100, duration: 0.08, type: 'square', volume: 0.15 });
}
function playClearSound(chain) {
  const freq = 400 + chain * 100;
  beep({ freq, freqEnd: freq + 200, duration: 0.12, type: 'triangle', volume: 0.2 });
}
function playGameOverSound() {
  beep({ freq: 300, freqEnd: 60, duration: 0.5, type: 'sawtooth', volume: 0.2 });
}

// ── BOARD HELPERS ──
function createBoard() {
  board = [];
  for (let r = 0; r < ROWS; r++) {
    board.push(new Array(COLS).fill(-1));
  }
}

function isOccupied(row, col) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true;
  return board[row][col] !== -1;
}

function placePiece() {
  if (!piece) return;
  for (let i = 0; i < 3; i++) {
    const r = piece.row + i;
    const c = piece.col;
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      board[r][c] = piece.gems[i];
    }
  }
}

function getDropSpeed() {
  return Math.max(DROP_SPEED_MIN, DROP_SPEED_BASE - (state.level - 1) * DROP_ACCEL);
}

// ── MATCHING ──
function findMatches() {
  const matched = new Set();

  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - MATCH_MIN; c++) {
      const color = board[r][c];
      if (color === -1) continue;
      let len = 1;
      while (c + len < COLS && board[r][c + len] === color) len++;
      if (len >= MATCH_MIN) {
        for (let i = 0; i < len; i++) matched.add(`${r},${c + i}`);
      }
    }
  }

  // Vertical
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - MATCH_MIN; r++) {
      const color = board[r][c];
      if (color === -1) continue;
      let len = 1;
      while (r + len < ROWS && board[r + len][c] === color) len++;
      if (len >= MATCH_MIN) {
        for (let i = 0; i < len; i++) matched.add(`${r + i},${c}`);
      }
    }
  }

  // Diagonal (↘)
  for (let r = 0; r <= ROWS - MATCH_MIN; r++) {
    for (let c = 0; c <= COLS - MATCH_MIN; c++) {
      const color = board[r][c];
      if (color === -1) continue;
      let len = 1;
      while (r + len < ROWS && c + len < COLS && board[r + len][c + len] === color) len++;
      if (len >= MATCH_MIN) {
        for (let i = 0; i < len; i++) matched.add(`${r + i},${c + i}`);
      }
    }
  }

  // Diagonal (↙)
  for (let r = 0; r <= ROWS - MATCH_MIN; r++) {
    for (let c = MATCH_MIN - 1; c < COLS; c++) {
      const color = board[r][c];
      if (color === -1) continue;
      let len = 1;
      while (r + len < ROWS && c - len >= 0 && board[r + len][c - len] === color) len++;
      if (len >= MATCH_MIN) {
        for (let i = 0; i < len; i++) matched.add(`${r + i},${c - i}`);
      }
    }
  }

  return matched;
}

function clearMatches(matched) {
  let cleared = 0;
  for (const key of matched) {
    const [r, c] = key.split(',').map(Number);
    if (board[r][c] !== -1) {
      // Particle effect
      const color =
        board[r][c] >= SPECIAL.FLASH ? SPECIAL_COLORS[board[r][c]] : GEM_COLORS[board[r][c]];
      const px = offX + (c + 0.5) * CELL * scale;
      const py = offY + (r + 0.5) * CELL * scale;
      spawnParticles(px, py, 4, color, { speed: 80, life: 0.4 });
      board[r][c] = -1;
      cleared++;
    }
  }
  return cleared;
}

function applyGravity() {
  let moved = false;
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][c] !== -1) {
        if (write !== r) {
          board[write][c] = board[r][c];
          board[r][c] = -1;
          moved = true;
        }
        write--;
      }
    }
  }
  return moved;
}

// ── SCORING ──
function scoreClear(count, chain) {
  const base = count * 10;
  const chainBonus = chain > 1 ? chain * 20 : 0;
  const levelBonus = state.level * 5;
  return base + chainBonus + levelBonus;
}

// ── PIECE ──
function spawnPiece() {
  const gems = [
    Math.floor(Math.random() * GEM_COLORS.length),
    Math.floor(Math.random() * GEM_COLORS.length),
    Math.floor(Math.random() * GEM_COLORS.length),
  ];
  piece = {
    col: Math.floor(COLS / 2) - 1,
    row: -1,
    gems,
  };
  // Check if spawn position is blocked
  if (isOccupied(0, piece.col) || isOccupied(1, piece.col) || isOccupied(2, piece.col)) {
    endGame();
  }
}

function rotatePiece() {
  if (!piece) return;
  const temp = piece.gems[0];
  piece.gems[0] = piece.gems[1];
  piece.gems[1] = piece.gems[2];
  piece.gems[2] = temp;
  playRotateSound();
}

function movePiece(dx) {
  if (!piece) return;
  const newCol = piece.col + dx;
  if (newCol < 0 || newCol >= COLS) return;
  if (
    isOccupied(piece.row, newCol) ||
    isOccupied(piece.row + 1, newCol) ||
    isOccupied(piece.row + 2, newCol)
  )
    return;
  piece.col = newCol;
  playMoveSound();
}

function canDrop() {
  if (!piece) return false;
  const nextRow = piece.row + 1;
  return !isOccupied(nextRow + 2, piece.col);
}

function dropPiece() {
  if (!piece) return;
  piece.row++;
}

function hardDrop() {
  if (!piece) return;
  while (canDrop()) {
    piece.row++;
  }
  lockPiece();
  playDropSound();
}

function lockPiece() {
  placePiece();
  piece = null;
  lockTimer = 0;
  state.chainsThisMove = 0;
  checkAndClear();
}

function checkAndClear() {
  const matched = findMatches();
  if (matched.size > 0) {
    pendingClear = true;
    flashing = [...matched];
    flashTimer = FLASH_DURATION;
  } else {
    spawnPiece();
  }
}

function applyPowerEffects(matched) {
  const neighborDeltas = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  const colorCounts = {};
  let best = -1;
  let bestN = 0;
  for (const key of matched) {
    const [r, c] = key.split(',').map(Number);
    const v = board[r][c];
    if (v >= 0 && v <= GEM_COLORS.length - 1) {
      colorCounts[v] = (colorCounts[v] || 0) + 1;
      if (colorCounts[v] > bestN) {
        bestN = colorCounts[v];
        best = v;
      }
    }
  }
  const matchColor = best >= 0 ? best : Math.floor(Math.random() * GEM_COLORS.length);
  let poisoned = false;
  for (const key of [...matched]) {
    const [r, c] = key.split(',').map(Number);
    const v = board[r][c];
    if (v === SPECIAL.FLASH) {
      for (const [dr, dc] of neighborDeltas) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        const nv = board[nr][nc];
        if (nv >= 0 && nv <= GEM_COLORS.length - 1) {
          board[nr][nc] = matchColor;
          matched.add(`${nr},${nc}`);
        }
      }
    } else if (v === SPECIAL.LIGHTNING) {
      for (let cc = 0; cc < COLS; cc++) {
        if (board[r][cc] !== -1) matched.add(`${r},${cc}`);
      }
    } else if (v === SPECIAL.POISON) {
      poisoned = true;
    }
  }
  if (poisoned) {
    for (let pr = 0; pr < ROWS; pr++) {
      for (let pc = 0; pc < COLS; pc++) {
        if (board[pr][pc] >= 0 && board[pr][pc] <= GEM_COLORS.length - 1) {
          board[pr][pc] = Math.floor(Math.random() * GEM_COLORS.length);
        }
      }
    }
  }
}

function maybeSpawnPowerGem() {
  const p = Math.min(0.35, 0.12 + Math.max(0, state.chainsThisMove - 1) * 0.1);
  if (Math.random() >= p) return;
  const type = [SPECIAL.FLASH, SPECIAL.LIGHTNING, SPECIAL.POISON][Math.floor(Math.random() * 3)];
  const col = Math.floor(Math.random() * COLS);
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === -1) {
      board[r][col] = type;
      return;
    }
  }
}

function checkColorCollector() {
  const present = new Set();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = board[r][c];
      if (v >= 0 && v <= GEM_COLORS.length - 1) present.add(v);
    }
  }
  if (present.size >= GEM_COLORS.length) achievements.unlock('color_collector');
}

function processClear() {
  const matched = new Set(flashing);
  applyPowerEffects(matched);
  const count = clearMatches(matched);
  if (count > 0) {
    state.chainsThisMove++;
    const chain = state.chainsThisMove;
    const points = scoreClear(count, chain);
    state.score += points;
    state.gemsCleared += count;
    playClearSound(chain);
    feedbackBundle('medium', TOTAL_W / 2, TOTAL_H / 2, {
      color: GEM_COLORS[0],
    });
    // Level up every 25 gems cleared
    state.level = Math.floor(state.gemsCleared / LEVEL_GEMS) + 1;
    if (state.chainsThisMove >= 3) achievements.unlock('chain_master');
    checkColorCollector();
  }
  flashing = [];
  flashTimer = 0;
  pendingClear = false;
  applyGravity();
  // Check for cascading matches
  const nextMatched = findMatches();
  if (nextMatched.size > 0) {
    pendingClear = true;
    flashing = [...nextMatched];
    flashTimer = FLASH_DURATION;
  } else {
    maybeSpawnPowerGem();
    spawnPiece();
  }
}

// ── GAME FLOW ──
function startGame() {
  ensureAudio();
  createBoard();
  state.score = 0;
  state.level = 1;
  state.gemsCleared = 0;
  state.running = true;
  state.gameOver = false;
  state.paused = false;
  dropTimer = 0;
  softDropping = false;
  pendingClear = false;
  flashing = [];
  clearSquashes();
  startAmbient();
  startMusic('columns');
  shell.enableTabTrap();
  spawnPiece();
  overlay.classList.add('hidden');
  say('Columns — ¡Empezó!');
}

function endGame() {
  state.gameOver = true;
  state.running = false;
  shell.disableTabTrap();
  playGameOverSound();
  if (state.score > state.best) {
    state.best = state.score;
    saveBest('columns2d', state.best);
  }
  if (state.level >= 50) achievements.unlock('marathon');
  finalScoreEl.textContent = `Puntos: ${state.score}`;
  finalScoreEl.style.display = '';
  overlayText.textContent = '¡Juego terminado!';
  setHint(hintEl, '{R} reiniciar &nbsp;·&nbsp; {Espacio} / tap para jugar de nuevo');
  overlay.classList.remove('hidden');
  say(`Juego terminado. Puntos: ${state.score}. Mejor: ${state.best}`);
}

function togglePause() {
  if (!state.running || state.gameOver) return;
  state.paused = !state.paused;
  if (state.paused) {
    say('Pausa');
  } else {
    say('Reanudado');
  }
}

// ── ENTRADA: TECLADO ──
onKey((e) => {
  if (e.code === 'KeyR' && (state.gameOver || !state.running)) {
    e.preventDefault();
    startGame();
    return;
  }
  if (e.code === 'Space' || e.code === 'KeyP') {
    e.preventDefault();
    if (!state.running) {
      startGame();
    } else {
      togglePause();
    }
    return;
  }
  if (!state.running || state.gameOver || state.paused) return;

  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    e.preventDefault();
    movePiece(-1);
  } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    movePiece(1);
  } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    rotatePiece();
  } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    e.preventDefault();
    softDropping = true;
  } else if (e.code === 'Space') {
    e.preventDefault();
    hardDrop();
  }
});

onKeyup((e) => {
  if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    softDropping = false;
  }
});

// ── ENTRADA: TÁCTIL ──
function bindBtn(id, onDown, onUp) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      btn.classList.add('is-pressed');
      onDown();
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
  btn.addEventListener('touchcancel', () => btn.classList.remove('is-pressed'));
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    onDown();
  });
  btn.addEventListener('mouseup', () => onUp?.());
}

bindBtn('btnLeft', () => {
  if (!state.running) startGame();
  else movePiece(-1);
});
bindBtn('btnRight', () => {
  if (!state.running) startGame();
  else movePiece(1);
});
bindBtn('btnUp', () => {
  if (!state.running) startGame();
  else rotatePiece();
});
bindBtn(
  'btnDown',
  () => {
    if (!state.running) startGame();
    else {
      softDropping = true;
    }
  },
  () => {
    softDropping = false;
  },
);
bindBtn('btnDrop', () => {
  if (!state.running) startGame();
  else hardDrop();
});

// ── ENTRADA: GAMEPAD ──
const gamepad = createGamepad();
let prevStart = false;
let prevA = false;

function pollGamepad() {
  const gp = gamepad.pad;
  if (!gp) return;

  const dpadLeft = !!gp.buttons[14]?.pressed;
  const dpadRight = !!gp.buttons[15]?.pressed;
  const dpadUp = !!gp.buttons[12]?.pressed;
  const dpadDown = !!gp.buttons[13]?.pressed;
  const stickX = gp.axes[0] ?? 0;

  if (dpadLeft || stickX < -0.4) movePiece(-1);
  else if (dpadRight || stickX > 0.4) movePiece(1);

  if (dpadUp) rotatePiece();
  if (dpadDown) softDropping = true;
  else softDropping = false;

  const startHeld = !!gp.buttons[9]?.pressed;
  if (startHeld && !prevStart) {
    if (!state.running) startGame();
    else togglePause();
  }
  prevStart = startHeld;

  const aHeld = !!gp.buttons[0]?.pressed;
  if (aHeld && !prevA) hardDrop();
  prevA = aHeld;
}

// ── OVERLAY ──
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

// ── UPDATE ──
function updateGame(dt) {
  if (pendingClear) {
    flashTimer -= dt;
    if (flashTimer <= 0) {
      processClear();
    }
    return;
  }

  if (!piece) return;

  const speed = softDropping ? getDropSpeed() * 0.2 : getDropSpeed();
  dropTimer += dt * 1000;

  if (dropTimer >= speed) {
    dropTimer = 0;
    if (canDrop()) {
      dropPiece();
    } else {
      lockTimer += speed;
      if (lockTimer >= LOCK_DELAY) {
        lockPiece();
      }
    }
  }
}

// ── RENDER ──
function drawGem(gx, gy, colorIdx, s, alpha = null) {
  const pad = 2 * s;
  const size = CELL * s - pad * 2;
  if (alpha !== null) ctx.globalAlpha = alpha;
  if (colorIdx >= SPECIAL.FLASH) {
    ctx.fillStyle = SPECIAL_COLORS[colorIdx];
    ctx.beginPath();
    ctx.roundRect(gx + pad, gy + pad, size, size, 4 * s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5 * s;
    ctx.strokeRect(gx + pad, gy + pad, size, size);
    ctx.fillStyle = '#0a0a1a';
    ctx.font = `${size * 0.55}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(SPECIAL_GLYPH[colorIdx], gx + size * 0.5 + pad, gy + size * 0.5 + pad);
  } else {
    ctx.fillStyle = GEM_COLORS[colorIdx];
    ctx.beginPath();
    ctx.roundRect(gx + pad, gy + pad, size, size, 4 * s);
    ctx.fill();
    drawGlow(
      ctx,
      gx + CELL * s * 0.5,
      gy + CELL * s * 0.5,
      size * 0.4,
      GEM_COLORS[colorIdx],
      0.12,
      2,
    );
  }
  if (alpha !== null) ctx.globalAlpha = 1;
}

function draw() {
  ctx.save();
  ctx.clearRect(0, 0, canvasW, canvasH);

  // Dark background
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, canvasW, canvasH);

  const ox = offX;
  const oy = offY;
  const s = scale;

  // Board background
  ctx.fillStyle = 'rgba(20, 20, 40, 0.8)';
  ctx.fillRect(ox, oy, BOARD_W * s, BOARD_H * s);

  // Board grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(ox + c * CELL * s, oy);
    ctx.lineTo(ox + c * CELL * s, oy + BOARD_H * s);
    ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(ox, oy + r * CELL * s);
    ctx.lineTo(ox + BOARD_W * s, oy + r * CELL * s);
    ctx.stroke();
  }

  // Board border
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 2 * s;
  ctx.strokeRect(ox, oy, BOARD_W * s, BOARD_H * s);

  // Draw gems on board
  const isFlashing = (r, c) => flashing.includes(`${r},${c}`);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const color = board[r][c];
      if (color === -1) continue;

      const flash = isFlashing(r, c);
      if (flash && Math.floor(flashTimer * 10) % 2 === 0) continue;

      drawGem(ox + c * CELL * s, oy + r * CELL * s, color, s);
    }
  }

  // Draw current piece
  if (piece) {
    for (let i = 0; i < 3; i++) {
      const r = piece.row + i;
      const c = piece.col;
      if (r < 0 || r >= ROWS) continue;

      drawGem(ox + c * CELL * s, oy + r * CELL * s, piece.gems[i], s, 1);
    }

    // Ghost piece (preview landing position)
    let ghostRow = piece.row;
    while (ghostRow + 2 < ROWS && !isOccupied(ghostRow + 3, piece.col)) {
      ghostRow++;
    }
    if (ghostRow !== piece.row) {
      ctx.globalAlpha = 0.25;
      for (let i = 0; i < 3; i++) {
        const r = ghostRow + i;
        const c = piece.col;
        if (r < 0 || r >= ROWS) continue;

        drawGem(ox + c * CELL * s, oy + r * CELL * s, piece.gems[i], s);
      }
      ctx.globalAlpha = 1;
    }
  }

  // ── Next piece preview ──
  const previewX = ox + BOARD_W * s + CELL * s;
  const previewY = oy + CELL * s;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(previewX, previewY, CELL * s * 2, CELL * s * 3.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(previewX, previewY, CELL * s * 2, CELL * s * 3.5);

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `${10 * s}px 'Courier New', monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('SIGUIENTE', previewX + CELL * s, previewY - 4 * s);

  // ── Particles ──
  drawParticles(ctx, offX, offY, scale);

  // ── Pause overlay ──
  if (state.paused && state.running) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(ox, oy, BOARD_W * s, BOARD_H * s);
    ctx.fillStyle = '#fff';
    ctx.font = `${28 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏸ PAUSA', ox + BOARD_W * s * 0.5, oy + BOARD_H * s * 0.5);
  }

  ctx.restore();
}

// ── HUD ──
const scoreValueEl = document.getElementById('scoreValue');
const bestValueEl = document.getElementById('bestValue');
const levelValueEl = document.getElementById('levelValue');

function updateHUD() {
  scoreValueEl.textContent = String(state.score);
  bestValueEl.textContent = String(state.best);
  levelValueEl.textContent = String(state.level);
  checkColorCollector();
}

// ── BUCLE PRINCIPAL ──
const loop = createGameLoop((dt) => {
  pollGamepad();
  updateShake(dt);

  if (state.running && !state.gameOver && !state.paused) {
    updateGame(dt);
  }

  updateSquashes(dt);
  updateParticles(dt);
  updateHUD();
  draw();
});

// State init
createBoard();
updateHUD();

shell.onCleanup(() => {
  cleanupAll();
  loop.stop();
});
document.getElementById('loading').classList.add('hidden');
loop.start();
