import { ensureAudio, beep, startAmbient } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements } from '../../shared/dom.js';
import { startMusic } from '../../shared/music.js';
import { createGameLoop } from '../../shared/loop.js';
import { setupGameShell } from '../../shared/shell.js';
import { loadBest, saveBest } from '../../shared/scores.js';
import { createGamepad } from '../../shared/input.js';
import {
  updateShake,
  getShakeOffset,
  roundRect,
  spawnParticles,
  updateParticles,
  drawParticles,
  fillWithGlow,
  strokeWithGlow,
  feedbackBundle,
  updateSquashes,
  clearSquashes,
} from '../../shared/effects.js';

injectCommonElements();

const shell = setupGameShell('tetris');

/* ============================================================
   TETRIS 2D — Arcade Hub
   Canvas 2D, sin dependencias externas.
   7 piezas (I,O,T,S,Z,J,L), rotación, ghost piece, niveles.
   ============================================================ */

// ============================================================
// CONSTANTES
// ============================================================
const COLS = 10,
  ROWS = 20,
  HIDDEN_ROWS = 2, // filas ocultas arriba del visible
  TOTAL_ROWS = ROWS + HIDDEN_ROWS,
  CS = 28;
const CW = COLS * CS,
  CH = ROWS * CS; // solo las visibles en el canvas
const CPAD = 10;
const BASE_DROP_SPEED = 1;
const SPEED_PER_LEVEL = 0.08;
const MIN_DROP_SPEED = 0.05;

const PIECES = {
  I: {
    blocks: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
    color: '#44ddff',
  },
  O: {
    blocks: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    color: '#ffe066',
  },
  T: {
    blocks: [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    color: '#aa44ff',
  },
  S: {
    blocks: [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
    ],
    color: '#44ff66',
  },
  Z: {
    blocks: [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
    color: '#ff4444',
  },
  J: {
    blocks: [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    color: '#4488ff',
  },
  L: {
    blocks: [
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    color: '#ff8844',
  },
};
const PIECE_NAMES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

const LEVEL_LINES = 10;
const SCORE_TABLE = [0, 100, 300, 500, 800];
const TSPIN_SCORE = [0, 400, 800, 1200, 1600]; // single, double, triple, tetris
const TSPIN_MINI_SCORE = [0, 100, 200, 400];
const B2B_BONUS = 1.5;
const DAS_DELAY = 0.17; // Delayed Auto Shift
const DAS_RATE = 0.05;

// ============================================================
// SRS — Super Rotation System (Tetris Guideline)
// Bounding box por pieza + tablas de wall kicks oficiales.
// dy en coords de pantalla (+ = abajo).
// ============================================================
const PIECE_BOX = { I: 4, O: 2, T: 3, S: 3, Z: 3, J: 3, L: 3 };
const SRS_KICKS = {
  JLSTZ: {
    '0>1': [
      [0, 0],
      [-1, 0],
      [-1, -1],
      [0, 2],
      [-1, 2],
    ],
    '1>0': [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, -2],
      [1, -2],
    ],
    '1>2': [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, -2],
      [1, -2],
    ],
    '2>1': [
      [0, 0],
      [-1, 0],
      [-1, -1],
      [0, 2],
      [-1, 2],
    ],
    '2>3': [
      [0, 0],
      [1, 0],
      [1, -1],
      [0, 2],
      [1, 2],
    ],
    '3>2': [
      [0, 0],
      [-1, 0],
      [-1, 1],
      [0, -2],
      [-1, -2],
    ],
    '3>0': [
      [0, 0],
      [-1, 0],
      [-1, 1],
      [0, -2],
      [-1, -2],
    ],
    '0>3': [
      [0, 0],
      [1, 0],
      [1, -1],
      [0, 2],
      [1, 2],
    ],
  },
  I: {
    '0>1': [
      [0, 0],
      [-2, 0],
      [1, 0],
      [-2, 1],
      [1, -2],
    ],
    '1>0': [
      [0, 0],
      [2, 0],
      [-1, 0],
      [2, -1],
      [-1, 2],
    ],
    '1>2': [
      [0, 0],
      [-1, 0],
      [2, 0],
      [-1, -2],
      [2, 1],
    ],
    '2>1': [
      [0, 0],
      [1, 0],
      [-2, 0],
      [1, 2],
      [-2, -1],
    ],
    '2>3': [
      [0, 0],
      [2, 0],
      [-1, 0],
      [2, -1],
      [-1, 2],
    ],
    '3>2': [
      [0, 0],
      [-2, 0],
      [1, 0],
      [-2, 1],
      [1, -2],
    ],
    '3>0': [
      [0, 0],
      [1, 0],
      [-2, 0],
      [1, 2],
      [-2, -1],
    ],
    '0>3': [
      [0, 0],
      [-1, 0],
      [2, 0],
      [-1, -2],
      [2, 1],
    ],
  },
};

// ============================================================
// ESTADO
// ============================================================
const state = {
  running: false,
  gameOver: false,
  paused: false,
  score: 0,
  lines: 0,
  level: 1,
  best: loadBest('tetris2d'),
};

// Grid: 0 = empty, else color string
let grid = [];

// Current piece
let piece = null; // { name, blocks:[[x,y],...], color, x, y, rot }
let nextPiece = null;
let holdName = null; // nombre de la pieza guardada (null = vacía)
let canHold = true; // un uso por pieza hasta bloquear la siguiente
let dropTimer = 0;
let lastMoveWasRotation = false; // T-Spin detection
let backToBack = 0; // consecutive T-Spins/Tetrises (0 = no B2B)
let tspinType = 0; // 0=none, 1=mini, 2=full
let dasTimer = 0;
let dasDir = 0; // -1 left, 1 right, 0 none
let lockTimer = 0;
let lockResets = 0;
const MAX_LOCK_RESETS = 15;
const LOCK_DELAY = 0.5; // seconds wall-clock

// 7-bag randomizer
let pieceBag = [];
function randomPieceName() {
  if (pieceBag.length === 0) {
    pieceBag = [...PIECE_NAMES];
    // Fisher-Yates shuffle
    for (let i = pieceBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieceBag[i], pieceBag[j]] = [pieceBag[j], pieceBag[i]];
    }
  }
  return pieceBag.pop();
}

// ============================================================
// CANVAS
// ============================================================
const canvas = document.getElementById('gameCanvas'),
  ctx = canvas.getContext('2d', { alpha: false });
let canvasW = 0,
  canvasH = 0,
  scale = 1,
  offX = 0,
  offY = 0;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvasW = window.innerWidth;
  canvasH = window.innerHeight;
  canvas.width = canvasW * dpr;
  canvas.height = canvasH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const previewW = CS * 6,
    totalW = CW + previewW + CS * 2;
  const sx = (canvasW - CPAD * 2) / totalW,
    sy = (canvasH - CPAD * 2) / CH;
  scale = Math.min(sx, sy);
  const totalW_scaled = totalW * scale;
  offX = (canvasW - totalW_scaled) / 2;
  offY = (canvasH - CH * scale) / 2;
}
window.addEventListener('resize', resize);
resize();

// ============================================================
// SONIDO (usando shared/audio.js)
function playMove() {
  beep({ freq: 200, freqEnd: 240, duration: 0.03, type: 'sine', volume: 0.04 });
}
function playRotate() {
  beep({ freq: 300, freqEnd: 400, duration: 0.04, type: 'square', volume: 0.06 });
}
function playDrop() {
  beep({ freq: 150, freqEnd: 80, duration: 0.08, type: 'square', volume: 0.1 });
}
function playClear(count) {
  beep({
    freq: 500 + count * 100,
    freqEnd: 800 + count * 100,
    duration: 0.15,
    type: 'triangle',
    volume: 0.14,
  });
}
function playGameOver() {
  feedbackBundle('large', CW / 2, CH / 2, {
    color: '#ff4444',
    noFlash: true,
    onBeep: () => beep({ freq: 400, freqEnd: 40, duration: 0.5, type: 'sawtooth', volume: 0.2 }),
  });
}
function playHold() {
  beep({ freq: 500, freqEnd: 300, duration: 0.06, type: 'triangle', volume: 0.08 });
}

// ============================================================
// ============================================================
// TETROMINÓS
// ============================================================
function getDropInterval() {
  return Math.max(MIN_DROP_SPEED, BASE_DROP_SPEED - (state.level - 1) * SPEED_PER_LEVEL);
}

function randomPiece() {
  const n = randomPieceName();
  const p = PIECES[n];
  return {
    name: n,
    blocks: p.blocks.map((b) => [...b]),
    color: p.color,
    x: Math.floor((COLS - 4) / 2),
    y: 0,
    rot: 0,
  };
}

// SRS: rotación horaria dentro del bounding box de la pieza
function rotateCW(blocks, size) {
  return blocks.map(([x, y]) => [size - 1 - y, x]);
}

function blocksForRot(name, rot) {
  let b = PIECES[name].blocks.map((v) => [...v]);
  for (let i = 0; i < rot; i++) b = rotateCW(b, PIECE_BOX[name]);
  return b;
}

function collides(blocks, px, py) {
  for (const [bx, by] of blocks) {
    const gx = px + bx,
      gy = py + by;
    if (gx < 0 || gx >= COLS || gy >= TOTAL_ROWS) return true;
    if (gy >= 0 && grid[gy] && grid[gy][gx] !== 0) return true;
  }
  return false;
}

function lockPiece() {
  if (!piece) return;
  for (const [bx, by] of piece.blocks) {
    const gx = piece.x + bx,
      gy = piece.y + by;
    if (gy >= 0 && gy < TOTAL_ROWS && gx >= 0 && gx < COLS) {
      grid[gy][gx] = piece.color;
    }
  }
  tspinType = detectTSpin();
  playDrop();
  clearLines();
  lastMoveWasRotation = false;
  canHold = true;
  spawnPiece();
}

function clearLines() {
  let cleared = 0;
  for (let r = TOTAL_ROWS - 1; r >= 0; r--) {
    if (grid[r].every((c) => c !== 0)) {
      grid.splice(r, 1);
      grid.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared > 0) {
    state.lines += cleared;
    state.level = Math.floor(state.lines / LEVEL_LINES) + 1;
    const isSpecialClear = tspinType > 0 || cleared === 4;
    if (isSpecialClear) {
      backToBack++;
    } else {
      backToBack = 0;
    }
    let pts = 0;
    if (tspinType === 2) {
      pts = TSPIN_SCORE[cleared] || 0;
    } else if (tspinType === 1) {
      pts = TSPIN_MINI_SCORE[cleared] || 0;
    } else {
      pts = SCORE_TABLE[cleared] || cleared * 200;
    }
    pts *= state.level;
    if (backToBack > 1) {
      pts = Math.floor(pts * B2B_BONUS);
    }
    state.score += pts;
    playClear(cleared);
    // T-Spin announcements
    if (tspinType === 2 && cleared > 0) {
      const names = ['', 'T-Spin Single', 'T-Spin Double', 'T-Spin Triple'];
      say(names[cleared] || 'T-Spin');
    } else if (tspinType === 1 && cleared > 0) {
      say('T-Spin Mini');
    } else if (cleared === 4) {
      say('Tetris!');
      achievements.unlock('tetris_tetris');
    }
    if (state.lines >= 100) achievements.unlock('tetris_century');
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] !== 0 && r < HIDDEN_ROWS + 3) {
          spawnParticles(c * CS + CS / 2, (r - HIDDEN_ROWS) * CS + CS / 2, grid[r][c], 3, {
            spd: 60,
            life: 0.3,
            sm: 1.5,
            smx: 3,
          });
        }
      }
    }
    updateHUD();
  } else {
    tspinType = 0;
  }
}

function spawnFromName(name) {
  const p = PIECES[name];
  piece = {
    name,
    blocks: p.blocks.map((b) => [...b]),
    color: p.color,
    x: Math.floor((COLS - 4) / 2),
    y: 0,
    rot: 0,
  };
  dropTimer = 0;
  lockTimer = 0;
  lockResets = 0;
  if (collides(piece.blocks, piece.x, piece.y)) endGame();
}

function spawnPiece() {
  piece = nextPiece || randomPiece();
  piece.x = Math.floor((COLS - 4) / 2);
  piece.y = 0;
  piece.rot = 0;
  nextPiece = randomPiece();
  dropTimer = 0;
  lockTimer = 0;
  lockResets = 0;

  if (collides(piece.blocks, piece.x, piece.y)) {
    endGame();
  }
}

function movePiece(dx, dy) {
  if (!piece || state.gameOver || state.paused) return false;
  if (!collides(piece.blocks, piece.x + dx, piece.y + dy)) {
    piece.x += dx;
    piece.y += dy;
    lastMoveWasRotation = false;
    if (dy === 0 && collides(piece.blocks, piece.x, piece.y + 1)) {
      lockTimer = 0;
      lockResets++;
    }
    if (dy === 0) playMove();
    return true;
  }
  return false;
}

function rotatePiece(dir = 1) {
  if (!piece || state.gameOver || state.paused || piece.name === 'O') return false;
  const newRot = (piece.rot + dir + 4) % 4;
  const newBlocks = blocksForRot(piece.name, newRot);
  const kicks = SRS_KICKS[piece.name === 'I' ? 'I' : 'JLSTZ'][`${piece.rot}>${newRot}`];
  for (const [kx, ky] of kicks) {
    if (!collides(newBlocks, piece.x + kx, piece.y + ky)) {
      piece.blocks = newBlocks;
      piece.rot = newRot;
      piece.x += kx;
      piece.y += ky;
      lastMoveWasRotation = true;
      // Lock reset: rotation on ground counts as a reset
      if (collides(piece.blocks, piece.x, piece.y + 1)) {
        lockTimer = 0;
        lockResets++;
      }
      playRotate();
      return true;
    }
  }
  return false;
}

function isCellFilled(gx, gy) {
  if (gx < 0 || gx >= COLS || gy < 0 || gy >= TOTAL_ROWS) return true;
  return gy >= 0 && grid[gy] && grid[gy][gx] !== 0;
}

function detectTSpin() {
  if (!piece || piece.name !== 'T' || !lastMoveWasRotation) return 0;
  // T-piece center is always at (1,1) in local coords
  const cx = piece.x + 1;
  const cy = piece.y + 1;
  // Check4 corners of the T bounding box
  const corners = [
    isCellFilled(cx - 1, cy - 1), // top-left
    isCellFilled(cx + 1, cy - 1), // top-right
    isCellFilled(cx - 1, cy + 1), // bottom-left
    isCellFilled(cx + 1, cy + 1), // bottom-right
  ];
  const filledCount = corners.filter(Boolean).length;
  if (filledCount < 3) return 0;
  // Mini T-Spin: only front2 corners filled (top for rot0/2, sides for rot1/3)
  const frontCorners = [corners[(piece.rot * 2) % 4], corners[(piece.rot * 2 + 1) % 4]];
  if (frontCorners.every(Boolean) && !corners[(piece.rot * 2 + 2) % 4]) {
    return 1; // mini
  }
  return 2; // full
}

function holdSwap() {
  if (!piece || !canHold || state.gameOver || state.paused) return;
  const current = piece.name;
  const saved = holdName;
  holdName = current;
  canHold = false;
  playHold();
  say(`Hold: guardaste ${current}${saved ? `, sale ${saved}` : ''}`);
  if (saved === null) spawnPiece();
  else spawnFromName(saved);
}

function hardDrop() {
  if (!piece || state.gameOver || state.paused) return;
  let dist = 0;
  while (!collides(piece.blocks, piece.x, piece.y + 1)) {
    piece.y++;
    dist++;
    lastMoveWasRotation = false;
  }
  state.score += dist * 2;
  lockPiece();
  updateHUD();
}

function getGhostY() {
  if (!piece) return 0;
  let gy = piece.y;
  while (!collides(piece.blocks, piece.x, gy + 1)) gy++;
  return gy;
}

// ============================================================
// INPUT
// ============================================================
const input = { left: false, right: false, down: false, rot: false, drop: false };

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    e.preventDefault();
    if (!state.running) startGame();
    else if (!state.gameOver) {
      input.left = true;
      movePiece(-1, 0);
      dasDir = -1;
      dasTimer = 0;
    }
  } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    if (!state.running) startGame();
    else if (!state.gameOver) {
      input.right = true;
      movePiece(1, 0);
      dasDir = 1;
      dasTimer = 0;
    }
  } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    e.preventDefault();
    if (!state.gameOver && state.running) {
      input.down = true;
      playMove();
    }
  } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    if (!state.running) startGame();
    else rotatePiece();
  } else if (e.code === 'KeyZ') {
    e.preventDefault();
    if (!state.running) startGame();
    else rotatePiece(-1);
  } else if (e.code === 'KeyC' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    e.preventDefault();
    if (!state.running) startGame();
    else holdSwap();
  } else if (e.code === 'Space') {
    e.preventDefault();
    if (!state.running) startGame();
    else if (!state.gameOver) hardDrop();
  } else if (e.code === 'KeyP') {
    e.preventDefault();
    togglePause();
  } else if (e.code === 'KeyR' && !state.running) {
    e.preventDefault();
    startGame();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    input.left = false;
    if (dasDir === -1) dasDir = 0;
  }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    input.right = false;
    if (dasDir === 1) dasDir = 0;
  }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    input.down = false;
  }
});

// Touch
function bTouch(id, cb) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      el.classList.add('is-pressed');
      cb();
    },
    { passive: false },
  );
  el.addEventListener(
    'touchend',
    (e) => {
      e.preventDefault();
      el.classList.remove('is-pressed');
    },
    { passive: false },
  );
  el.addEventListener('touchcancel', () => el.classList.remove('is-pressed'));
}
bTouch('bL', () => {
  if (!state.running) startGame();
  else if (!state.gameOver) movePiece(-1, 0);
});
bTouch('bR', () => {
  if (!state.running) startGame();
  else if (!state.gameOver) movePiece(1, 0);
});
bTouch('bRot', () => {
  if (!state.running) startGame();
  else if (!state.gameOver) rotatePiece();
});
bTouch('bHold', () => {
  if (!state.running) startGame();
  else if (!state.gameOver) holdSwap();
});
bTouch('bDrop', () => {
  if (!state.running) startGame();
  else if (!state.gameOver) hardDrop();
});

canvas.addEventListener('pointerdown', () => {
  if (!state.running) startGame();
});
const announce = document.getElementById('announce');
function say(msg) {
  if (announce) announce.textContent = msg;
}

document.getElementById('overlay').addEventListener('click', () => {
  if (!state.running) startGame();
});

// Gamepad
const gamepad = createGamepad();
const prevGamepad = { rot: false, hold: false, start: false };

function pollGamepad() {
  const gp = gamepad.pad;
  if (!gp) return;
  const ax = gp.axes[0] ?? 0,
    ay = gp.axes[1] ?? 0;
  if (ax < -0.5 && !state.gameOver) {
    if (!state.running) startGame();
    else if (input.left !== true) {
      input.left = true;
      movePiece(-1, 0);
      dasDir = -1;
      dasTimer = 0;
    }
  } else if (input.left && ax > -0.3) input.left = false;
  if (ax > 0.5 && !state.gameOver) {
    if (!state.running) startGame();
    else if (input.right !== true) {
      input.right = true;
      movePiece(1, 0);
      dasDir = 1;
      dasTimer = 0;
    }
  } else if (input.right && ax < 0.3) input.right = false;
  if (ay > 0.5) {
    if (!input.down) {
      input.down = true;
      if (!state.gameOver && state.running) playMove();
    }
  } else input.down = false;
  const rH = !!(gp.buttons[0]?.pressed || gp.buttons[2]?.pressed || gp.buttons[3]?.pressed);
  if (rH && !prevGamepad.rot && !state.gameOver) {
    if (!state.running) startGame();
    else rotatePiece();
  }
  prevGamepad.rot = rH;
  const sH = !!gp.buttons[9]?.pressed;
  if (sH && !prevGamepad.start && !state.running) startGame();
  prevGamepad.start = sH;
  // LB guarda/cambia la pieza (hold)
  const hH = !!gp.buttons[4]?.pressed;
  if (hH && !prevGamepad.hold && !state.gameOver) {
    if (!state.running) startGame();
    else holdSwap();
  }
  prevGamepad.hold = hH;
  if (gp.buttons[1]?.pressed && !state.gameOver) hardDrop(); // B button for hard drop
}

// ============================================================
// GAME FLOW
// ============================================================
function resetGame() {
  state.score = 0;
  state.lines = 0;
  state.level = 1;
  state.gameOver = false;
  state.paused = false;
  grid = [];
  for (let r = 0; r < TOTAL_ROWS; r++) grid.push(new Array(COLS).fill(0));
  nextPiece = randomPiece();
  piece = null;
  holdName = null;
  canHold = true;
  dropTimer = 0;
  dasTimer = 0;
  dasDir = 0;
  lastMoveWasRotation = false;
  backToBack = 0;
  tspinType = 0;
  document.getElementById('fs').style.display = 'none';
  spawnPiece();
  updateHUD();
}

function startGame() {
  clearSquashes();
  ensureAudio();
  startAmbient();
  startMusic('tetris');
  if (state.best >= 500) achievements.unlock('tetris_fivehundo');
  resetGame();
  state.running = true;
  achievements.incrementPlays('tetris');
  document.getElementById('overlay').classList.add('hidden');
  shell.enableTabTrap();
  say('Tetris: comenzó la partida. Completá líneas para sumar puntos.');
}

function togglePause() {
  if (!state.running || state.gameOver) return;
  state.paused = !state.paused;
  const ot = document.getElementById('ot'),
    fs = document.getElementById('fs'),
    he = document.getElementById('he');
  if (state.paused) {
    ot.textContent = '⏸ PAUSA';
    fs.style.display = 'none';
    he.innerHTML = `<kbd>P</kbd> para continuar`;
    document.getElementById('overlay').classList.remove('hidden');
  } else document.getElementById('overlay').classList.add('hidden');
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  playGameOver();
  if (state.score > state.best) {
    state.best = state.score;
    saveBest('tetris2d', state.best);
    if (state.best >= 500) achievements.unlock('tetris_fivehundo');
  }
  const ot = document.getElementById('ot'),
    fs = document.getElementById('fs'),
    he = document.getElementById('he');
  ot.textContent = '💀 ¡Game Over!';
  fs.style.display = 'block';
  fs.textContent = `Puntaje: ${state.score} · Líneas: ${state.lines} · Récord: ${state.best}`;
  he.innerHTML = `<kbd>←</kbd><kbd>→</kbd> / tocar para empezar · <kbd>R</kbd> reiniciar`;
  document.getElementById('overlay').classList.remove('hidden');
  shell.disableTabTrap();
  say('Tetris: game over.');
  updateHUD();
}

// ============================================================
// GAME UPDATE
// ============================================================
function updateGame(dt) {
  if (!state.running || state.gameOver || state.paused || !piece) return;

  // DAS (auto-repeat)
  if (dasDir !== 0) {
    dasTimer += dt;
    if (dasTimer > DAS_DELAY) {
      dasTimer -= DAS_RATE;
      if (dasTimer > DAS_DELAY) dasTimer = DAS_DELAY;
      movePiece(dasDir, 0);
    }
  } else dasTimer = 0;

  // Soft drop
  if (input.down) {
    dropTimer += dt * 10;
  } else {
    dropTimer += dt;
  }

  // Lock delay: 0.5s wall-clock, max 15 resets
  if (!collides(piece.blocks, piece.x, piece.y + 1)) {
    lockTimer = 0;
    lockResets = 0;
  } else {
    lockTimer += dt;
    if (lockTimer >= LOCK_DELAY || lockResets >= MAX_LOCK_RESETS) {
      lockPiece();
    }
  }

  // Gravity
  const interval = getDropInterval() / (input.down ? 10 : 1);
  if (dropTimer >= interval) {
    dropTimer = 0;
    if (!collides(piece.blocks, piece.x, piece.y + 1)) {
      piece.y++;
      // Soft drop scoring: 1 point per cell (original Tetris)
      if (input.down) {
        state.score += 1;
        updateHUD();
      }
    }
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
  const s = scale,
    cx = offX,
    cy = offY;

  const gridW = COLS * CS * s;
  const gridH = ROWS * CS * s;

  // Background
  ctx.fillStyle = '#0d0d14';
  ctx.fillRect(cx, cy, gridW, gridH);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 0.5 * s;
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * CS * s);
    ctx.lineTo(cx + gridW, cy + r * CS * s);
    ctx.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(cx + c * CS * s, cy);
    ctx.lineTo(cx + c * CS * s, cy + gridH);
    ctx.stroke();
  }

  // Border
  strokeWithGlow(
    ctx,
    () => ctx.strokeRect(cx, cy, gridW, gridH),
    'rgba(110,198,255,0.15)',
    1.5 * s,
    0.5,
    4,
  );

  // Placed blocks
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== 0)
        drawBlock(cx + c * CS * s, cy + (r - HIDDEN_ROWS) * CS * s, CS * s, grid[r][c], s);
    }

  // Ghost piece
  if (piece && !state.gameOver) {
    const gy = getGhostY();
    ctx.globalAlpha = 0.15;
    for (const [bx, by] of piece.blocks) {
      const gx = piece.x + bx,
        gy2 = gy + by;
      if (gy2 >= HIDDEN_ROWS)
        drawBlock(cx + gx * CS * s, cy + (gy2 - HIDDEN_ROWS) * CS * s, CS * s, piece.color, s);
    }
    ctx.globalAlpha = 1;
  }

  // Current piece
  if (piece && !state.gameOver) {
    for (const [bx, by] of piece.blocks) {
      const gx = piece.x + bx,
        gy = piece.y + by;
      if (gy >= HIDDEN_ROWS)
        drawBlock(cx + gx * CS * s, cy + (gy - HIDDEN_ROWS) * CS * s, CS * s, piece.color, s);
    }
  }

  // Next piece preview
  const previewX = cx + gridW + CS * s;
  const previewY = cy + CS * s;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1 * s;
  roundRect(ctx, previewX, previewY, CS * 5 * s, CS * 5 * s, 4 * s);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = `${10 * s}px 'Courier New',monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('PRÓXIMO', previewX + CS * 2.5 * s, previewY + 4 * s);

  if (nextPiece) {
    const offsetX =
      previewX +
      CS * 2.5 * s -
      (nextPiece.name === 'I' ? CS * 2 * s : nextPiece.name === 'O' ? CS * s : CS * 1.5 * s);
    const offsetY = previewY + CS * 2.5 * s - CS * s;
    ctx.globalAlpha = 0.8;
    for (const [bx, by] of nextPiece.blocks) {
      drawBlock(offsetX + bx * CS * s, offsetY + by * CS * s, CS * s, nextPiece.color, s);
    }
    ctx.globalAlpha = 1;
  }

  // Hold piece preview
  const holdY = previewY + CS * 6 * s;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1 * s;
  roundRect(ctx, previewX, holdY, CS * 5 * s, CS * 5 * s, 4 * s);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = `${10 * s}px 'Courier New',monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('GUARDADA', previewX + CS * 2.5 * s, holdY + 4 * s);

  if (holdName) {
    const hp = PIECES[holdName];
    const offsetX =
      previewX +
      CS * 2.5 * s -
      (holdName === 'I' ? CS * 2 * s : holdName === 'O' ? CS * s : CS * 1.5 * s);
    const offsetY = holdY + CS * 2.5 * s - CS * s;
    ctx.globalAlpha = canHold ? 0.8 : 0.35; // atenuada cuando el hold ya se usó
    for (const [bx, by] of hp.blocks) {
      drawBlock(offsetX + bx * CS * s, offsetY + by * CS * s, CS * s, hp.color, s);
    }
    ctx.globalAlpha = 1;
  }

  // Particles
  drawParticles(ctx, offX, offY, scale);

  // Pause overlay
  if (state.paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(cx, cy, gridW, gridH);
    ctx.fillStyle = '#fff';
    ctx.font = `${24 * s}px 'Courier New',monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏸ PAUSA', cx + gridW / 2, cy + gridH / 2);
  }

  ctx.restore();
}

function drawBlock(x, y, size, color, s) {
  const pad = 1 * s;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  roundRect(ctx, x + pad + 2 * s, y + pad + 2 * s, size - pad * 2, size - pad * 2, 2 * s);
  ctx.fill();
  // Block
  fillWithGlow(
    ctx,
    () => roundRect(ctx, x + pad, y + pad, size - pad * 2, size - pad * 2, 2 * s),
    color,
    0.4,
    3 * s,
  );
  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(ctx, x + pad + 2 * s, y + pad + 2 * s, size - pad * 4, size * 0.3, 1.5 * s);
  ctx.fill();
}

// ============================================================
// HUD
// ============================================================
const scoreEl = document.getElementById('scoreValue'),
  linesEl = document.getElementById('linesValue');
const levelEl = document.getElementById('levelValue'),
  bestEl = document.getElementById('bestValue');
function updateHUD() {
  scoreEl.textContent = String(state.score);
  linesEl.textContent = String(state.lines);
  levelEl.textContent = backToBack > 1 ? `${state.level} B2B` : String(state.level);
  bestEl.textContent = String(state.best);
}

// ============================================================
// MAIN LOOP
// ============================================================
const loop = createGameLoop((dt) => {
  pollGamepad();
  updateShake(dt);
  if (state.running && !state.gameOver && !state.paused) updateGame(dt);
  updateSquashes(dt);
  updateParticles(dt);
  draw();
});

resetGame();
updateHUD();

shell.onCleanup(() => loop.stop());
document.getElementById('loading').classList.add('hidden');
loop.start();
