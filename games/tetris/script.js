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
  clearParticles,
} from '../../shared/effects.js';
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
  CS = 28;
const CW = COLS * CS,
  CH = ROWS * CS;
const CPAD = 10;

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
const DAS_DELAY = 0.17; // Delayed Auto Shift
const DAS_RATE = 0.05;

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
  best: Number(localStorage.getItem('tetris2d_best') || 0),
};

// Grid: 0 = empty, else color string
let grid = [];

// Current piece
let piece = null; // { name, blocks:[[x,y],...], color, x, y }
let nextPiece = null;
let dropTimer = 0;
let dasTimer = 0;
let dasDir = 0; // -1 left, 1 right, 0 none
let lockTimer = 0;

// ============================================================
// CANVAS
// ============================================================
const canvas = document.getElementById('gc'),
  ctx = canvas.getContext('2d');
let canvasW = 0,
  canvasH = 0,
  scale = 1,
  offX = 0,
  offY = 0;
function resize() {
  canvasW = window.innerWidth;
  canvasH = window.innerHeight;
  canvas.width = canvasW;
  canvas.height = canvasH;
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
  triggerShake(2);
}
function playClear(count) {
  triggerShake(3);
  beep({
    freq: 500 + count * 100,
    freqEnd: 800 + count * 100,
    duration: 0.15,
    type: 'triangle',
    volume: 0.14,
  });
}
function playGameOver() {
  triggerShake(6);
  beep({ freq: 400, freqEnd: 40, duration: 0.5, type: 'sawtooth', volume: 0.2 });
}

// ============================================================
// ============================================================
// TETROMINÓS
// ============================================================
function getDropInterval() {
  return Math.max(0.05, 1 - (state.level - 1) * 0.08);
}

function randomPiece() {
  const n = PIECE_NAMES[Math.floor(Math.random() * PIECE_NAMES.length)];
  const p = PIECES[n];
  return {
    name: n,
    blocks: p.blocks.map((b) => [...b]),
    color: p.color,
    x: Math.floor((COLS - 4) / 2),
    y: 0,
  };
}

function rotateBlocks(blocks) {
  // Rotate 90° clockwise around center
  const cx = 1.5,
    cy = 1.5;
  return blocks.map(([bx, by]) => [Math.round(cx + (by - cy)), Math.round(cy - (bx - cx))]);
}

function collides(blocks, px, py) {
  for (const [bx, by] of blocks) {
    const gx = px + bx,
      gy = py + by;
    if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
    if (gy >= 0 && grid[gy][gx] !== 0) return true;
  }
  return false;
}

function lockPiece() {
  if (!piece) return;
  for (const [bx, by] of piece.blocks) {
    const gx = piece.x + bx,
      gy = piece.y + by;
    if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
      grid[gy][gx] = piece.color;
    }
  }
  playDrop();
  clearLines();
  spawnPiece();
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (grid[r].every((c) => c !== 0)) {
      grid.splice(r, 1);
      grid.unshift(new Array(COLS).fill(0));
      cleared++;
      r++; // re-check this row
    }
  }
  if (cleared > 0) {
    state.lines += cleared;
    state.level = Math.floor(state.lines / LEVEL_LINES) + 1;
    state.score += (SCORE_TABLE[cleared] || cleared * 200) * state.level;
    playClear(cleared);
    // Particles
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] !== 0 && r < 3) {
          spawnParticles(c * CS + CS / 2, r * CS + CS / 2, grid[r][c], 3, {
            spd: 60,
            life: 0.3,
            sm: 1.5,
            smx: 3,
          });
        }
      }
    }
    updateHUD();
  }
}

function spawnPiece() {
  piece = nextPiece || randomPiece();
  piece.x = Math.floor((COLS - 4) / 2);
  piece.y = 0;
  nextPiece = randomPiece();
  dropTimer = 0;
  lockTimer = 0;

  if (collides(piece.blocks, piece.x, piece.y)) {
    endGame();
  }
}

function movePiece(dx, dy) {
  if (!piece || state.gameOver || state.paused) return false;
  if (!collides(piece.blocks, piece.x + dx, piece.y + dy)) {
    piece.x += dx;
    piece.y += dy;
    if (dy === 0) playMove();
    return true;
  }
  return false;
}

function rotatePiece() {
  if (!piece || state.gameOver || state.paused) return;
  const newBlocks = rotateBlocks(piece.blocks);
  // Try basic rotation
  if (!collides(newBlocks, piece.x, piece.y)) {
    piece.blocks = newBlocks;
    playRotate();
    return;
  }
  // Wall kicks
  for (const kick of [
    [-1, 0],
    [1, 0],
    [-2, 0],
    [2, 0],
    [0, -1],
    [-1, -1],
    [1, -1],
  ]) {
    if (!collides(newBlocks, piece.x + kick[0], piece.y + kick[1])) {
      piece.blocks = newBlocks;
      piece.x += kick[0];
      piece.y += kick[1];
      playRotate();
      return;
    }
  }
}

function hardDrop() {
  if (!piece || state.gameOver || state.paused) return;
  let dist = 0;
  while (!collides(piece.blocks, piece.x, piece.y + 1)) {
    piece.y++;
    dist++;
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
bTouch('bDrop', () => {
  if (!state.running) startGame();
  else if (!state.gameOver) hardDrop();
});

document.getElementById('gc').addEventListener('pointerdown', () => {
  if (!state.running) startGame();
});
document.getElementById('overlay').addEventListener('click', () => {
  if (!state.running) startGame();
});

// Gamepad
let gamepadIndex = null,
  prevGamepad = { rot: false, start: false };
window.addEventListener('gamepadconnected', (e) => (gamepadIndex = e.gamepad.index));
window.addEventListener('gamepaddisconnected', (e) => {
  if (gamepadIndex === e.gamepad.index) gamepadIndex = null;
});
function pollGamepad() {
  if (!navigator.getGamepads) return;
  const pads = navigator.getGamepads();
  const gp = (gamepadIndex !== null ? pads[gamepadIndex] : null) || pads[0];
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
  for (let r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(0));
  nextPiece = randomPiece();
  piece = null;
  dropTimer = 0;
  dasTimer = 0;
  dasDir = 0;
  document.getElementById('fs').style.display = 'none';
  spawnPiece();
  updateHUD();
}

function startGame() {
  ensureAudio();
  startAmbient();
  if (state.best >= 500) achievements.unlock('tetris_fivehundo');
  resetGame();
  state.running = true;
  achievements.incrementPlays('tetris');
  document.getElementById('overlay').classList.add('hidden');
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
    localStorage.setItem('tetris2d_best', String(state.best));
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

  // Lock delay
  if (!collides(piece.blocks, piece.x, piece.y + 1)) {
    lockTimer = 0;
  }

  // Gravity
  const interval = getDropInterval() / (input.down ? 10 : 1);
  if (dropTimer >= interval) {
    dropTimer = 0;
    if (!collides(piece.blocks, piece.x, piece.y + 1)) {
      piece.y++;
    } else {
      lockTimer += interval;
      if (lockTimer >= 0.5) {
        lockPiece();
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
  ctx.shadowColor = 'rgba(110,198,255,0.08)';
  ctx.shadowBlur = 15;
  ctx.strokeStyle = 'rgba(110,198,255,0.15)';
  ctx.lineWidth = 1.5 * s;
  ctx.strokeRect(cx, cy, gridW, gridH);
  ctx.shadowBlur = 0;

  // Placed blocks
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== 0) drawBlock(cx + c * CS * s, cy + r * CS * s, CS * s, grid[r][c], s);
    }

  // Ghost piece
  if (piece && !state.gameOver) {
    const gy = getGhostY();
    ctx.globalAlpha = 0.15;
    for (const [bx, by] of piece.blocks) {
      const gx = piece.x + bx,
        gy2 = gy + by;
      if (gy2 >= 0) drawBlock(cx + gx * CS * s, cy + gy2 * CS * s, CS * s, piece.color, s);
    }
    ctx.globalAlpha = 1;
  }

  // Current piece
  if (piece && !state.gameOver) {
    for (const [bx, by] of piece.blocks) {
      const gx = piece.x + bx,
        gy = piece.y + by;
      if (gy >= 0) drawBlock(cx + gx * CS * s, cy + gy * CS * s, CS * s, piece.color, s);
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
  ctx.shadowColor = color;
  ctx.shadowBlur = 6 * s;
  ctx.fillStyle = color;
  roundRect(ctx, x + pad, y + pad, size - pad * 2, size - pad * 2, 2 * s);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(ctx, x + pad + 2 * s, y + pad + 2 * s, size - pad * 4, size * 0.3, 1.5 * s);
  ctx.fill();
}

// ============================================================
// HUD
// ============================================================
const scoreEl = document.getElementById('sc'),
  linesEl = document.getElementById('ln');
const levelEl = document.getElementById('lv'),
  bestEl = document.getElementById('bst');
function updateHUD() {
  scoreEl.textContent = String(state.score);
  linesEl.textContent = String(state.lines);
  levelEl.textContent = String(state.level);
  bestEl.textContent = String(state.best);
}

// ============================================================
// MAIN LOOP
// ============================================================
let animFrameId = null;
let lastTime = 0;
function tick(t) {
  const dt = Math.min((t - lastTime) / 1000, 0.05);
  lastTime = t;
  pollGamepad();
  updateShake(dt);
  if (state.running && !state.gameOver && !state.paused) updateGame(dt);
  updateParticles(dt);
  draw();
  animFrameId = requestAnimationFrame(tick);
}

resetGame();
updateHUD();

function cleanup() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
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
  window.location.href = '../../index.html';
});
document.getElementById('fsBtn')?.addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  else document.exitFullscreen().catch(() => {});
});
// Help button
document.getElementById('helpBtn')?.addEventListener('click', () => showHelp('tetris'));
