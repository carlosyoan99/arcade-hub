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
  spawnParticles,
  updateParticles,
  drawParticles,
  clearParticles,
  drawGlow,
  feedbackBundle,
} from '../../shared/effects.js';

injectCommonElements();

const shell = setupGameShell('bomberman');

/* ============================================================
   BOMBERMAN — Arcade Hub
   Maze action: place bombs, break bricks, clear enemies → door.
   Canvas 2D, sin dependencias externas.
   ============================================================ */

// ── CONSTANTES ──
const COLS = 13;
const ROWS = 11;
const CELL = 44;
const BOARD_W = COLS * CELL;
const BOARD_H = ROWS * CELL;
const PAD = 18;
const TOTAL_W = BOARD_W + PAD * 2;
const TOTAL_H = BOARD_H + PAD * 2;

const EMPTY = 0;
const BRICK = 1;
const SOLID = 2;

const MOVE_SPEED = 5.2;
const BOMB_TIME = 2.5;
const BLAST_TTL = 0.38;
const RESPAWN_TIME = 1.2;
const INVINCIBLE_TIME = 2.2;
const BRICK_DROP_CHANCE = 0.55;
const PICKUP_CHANCE = 0.35;
const MAX_LIVES = 3;

const PLAYER_START = { r: 9, c: 1 };
const ENEMY_SPAWNS = [
  { r: 1, c: 1 },
  { r: 1, c: 11 },
  { r: 9, c: 11 },
];
const DOOR_CELL = { r: 8, c: 5 };

// ── ESTADO ──
const state = {
  running: false,
  gameOver: false,
  paused: false,
  score: 0,
  best: loadBest('bomberman2d'),
  level: 1,
  lives: MAX_LIVES,
};

const player = {
  col: PLAYER_START.c,
  row: PLAYER_START.r,
  moving: false,
  t: 0,
  dir: { dr: 0, dc: 0 },
  inv: 0,
  alive: true,
  maxBombs: 1,
  range: 2,
  speed: 1,
  detonator: false,
  collected: new Set(),
};

let grid = [];
let bombs = [];
let blasts = [];
let enemies = [];
let pickups = [];
let doorActive = false;
let damageThisLevel = false;
let deadTimer = 0;

// Input: pila de direcciones activas (última presionada gana)
const heldDirs = [];

// ── CANVAS SETUP ──
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const {
  w: canvasW,
  h: canvasH,
  s: scale,
  x: offX,
  y: offY,
} = setupCanvas(canvas, ctx, TOTAL_W, TOTAL_H, PAD);

// ── SONIDO ──
function playMoveSound() {
  beep({ freq: 220, duration: 0.025, type: 'sine', volume: 0.05 });
}
function playPlaceSound() {
  beep({ freq: 160, freqEnd: 90, duration: 0.1, type: 'square', volume: 0.18 });
}
function playBoomSound() {
  beep({ freq: 120, freqEnd: 40, duration: 0.28, type: 'sawtooth', volume: 0.22 });
}
function playKillSound(nth) {
  const freq = 500 + nth * 60;
  beep({ freq, freqEnd: freq * 2, duration: 0.12, type: 'triangle', volume: 0.2 });
}
function playPickupSound() {
  beep({ freq: 700, freqEnd: 1100, duration: 0.09, type: 'triangle', volume: 0.18 });
}
function playDeathSound() {
  beep({ freq: 400, freqEnd: 80, duration: 0.4, type: 'sawtooth', volume: 0.2 });
}
function playLevelSound() {
  beep({ freq: 400, freqEnd: 800, duration: 0.2, type: 'triangle', volume: 0.2 });
}
function playGameOverSound() {
  beep({ freq: 300, freqEnd: 60, duration: 0.5, type: 'sawtooth', volume: 0.2 });
}

// ── MAZE ──
const isSolidPattern = (r, c) =>
  r % 2 === 0 && c % 2 === 0 && r > 0 && r < ROWS - 1 && c > 0 && c < COLS - 1;

const keepOpen = (r, c) => {
  // Esquinas de spawn + su vecindario quedan sin muros
  const zone = (sr, sc) => Math.abs(r - sr) <= 1 && Math.abs(c - sc) <= 1;
  return ENEMY_SPAWNS.some((p) => zone(p.r, p.c)) || zone(PLAYER_START.r, PLAYER_START.c);
};

function generateMaze() {
  grid = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      let cell = EMPTY;
      if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) cell = SOLID;
      else if (isSolidPattern(r, c)) cell = SOLID;
      else if (!keepOpen(r, c) && Math.random() < BRICK_DROP_CHANCE) cell = BRICK;
      row.push(cell);
    }
    grid.push(row);
  }
  grid[DOOR_CELL.r][DOOR_CELL.c] = BRICK;
}

const isWalkable = (r, c) =>
  r >= 0 && r < ROWS && c >= 0 && c < COLS && grid[r][c] === EMPTY && !hasBomb(r, c);

const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

function hasBomb(r, c) {
  return bombs.some((b) => b.row === r && b.col === c);
}

function hasPickup(r, c) {
  return pickups.some((p) => p.row === r && p.col === c);
}

// ── ENEMIGOS ──
function spawnEnemies() {
  const count = Math.min(2 + Math.floor((state.level - 1) / 2), 6);
  enemies = [];
  for (let i = 0; i < count; i++) {
    const spawn = ENEMY_SPAWNS[i % ENEMY_SPAWNS.length];
    enemies.push({
      col: spawn.c,
      row: spawn.r,
      moving: false,
      t: 0,
      dir: { dr: 0, dc: 1 },
      speed: 0.55 + Math.random() * 0.15,
      type: i % 2 === 0 ? 'balloon' : 'oneal',
      dead: false,
      prevDir: { dr: 0, dc: 1 },
    });
  }
}

function enemyWalkable(r, c) {
  return isWalkable(r, c);
}

const DIRS = [
  { dr: -1, dc: 0 },
  { dr: 1, dc: 0 },
  { dr: 0, dc: -1 },
  { dr: 0, dc: 1 },
];

function pickEnemyDir(e) {
  const options = DIRS.filter(
    (d) =>
      !(d.dr === -e.prevDir.dr && d.dc === -e.prevDir.dc) &&
      enemyWalkable(e.row + d.dr, e.col + d.dc),
  );
  if (options.length === 0) {
    return DIRS.find((d) => enemyWalkable(e.row + d.dr, e.col + d.dc)) || { dr: 0, dc: 0 };
  }
  if (e.type === 'oneal') {
    let best = options[0];
    let bestDist = Infinity;
    for (const d of options) {
      const dist = Math.abs(player.row - (e.row + d.dr)) + Math.abs(player.col - (e.col + d.dc));
      if (dist < bestDist) {
        best = d;
        bestDist = dist;
      }
    }
    return best;
  }
  return options[Math.floor(Math.random() * options.length)];
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.moving) {
      e.t += e.speed * MOVE_SPEED * dt;
      if (e.t >= 1) {
        e.col += e.dir.dc;
        e.row += e.dir.dr;
        e.t = 0;
        e.moving = false;
        e.prevDir = { ...e.dir };
        // Choque contra el jugador
        if (e.row === player.row && e.col === player.col) {
          killPlayer();
        }
      }
    } else {
      const d = pickEnemyDir(e);
      if (d.dr === 0 && d.dc === 0) continue;
      e.dir = d;
      e.moving = true;
      e.t = 0;
    }
  }
}

// ── BOMBAS ──
function placeBomb() {
  if (!state.running || state.gameOver || state.paused || !player.alive) return;
  const r = Math.round(player.row);
  const c = Math.round(player.col);
  if (bombs.length >= player.maxBombs) {
    // Con detonador, el botón de bomba detona las colocadas
    if (player.detonator && bombs.length > 0) {
      detonateAll();
    }
    return;
  }
  if (grid[r][c] !== EMPTY || hasBomb(r, c)) return;
  bombs.push({
    row: r,
    col: c,
    timer: player.detonator ? Infinity : BOMB_TIME,
    range: player.range,
  });
  playPlaceSound();
}

function detonateAll() {
  for (const b of bombs) b.timer = 0;
}

function explode(bomb) {
  const cells = new Set([`${bomb.row},${bomb.col}`]);
  for (const d of DIRS) {
    for (let i = 1; i <= bomb.range; i++) {
      const r = bomb.row + d.dr * i;
      const c = bomb.col + d.dc * i;
      if (!inBounds(r, c) || grid[r][c] === SOLID) break;
      cells.add(`${r},${c}`);
      if (grid[r][c] === BRICK) break;
    }
  }
  for (const key of cells) {
    const [r, c] = key.split(',').map(Number);
    blasts.push({ row: r, col: c, ttl: BLAST_TTL });
  }
  playBoomSound();

  // Cadena: otras bombas alcanzadas explotan al instante
  for (const other of bombs) {
    if (other !== bomb && cells.has(`${other.row},${other.col}`)) {
      other.timer = Math.min(other.timer, 0);
    }
  }

  // Daño a muros
  let drops = 0;
  for (const key of cells) {
    const [r, c] = key.split(',').map(Number);
    if (grid[r][c] === BRICK) {
      grid[r][c] = EMPTY;
      const px = (c + 0.5) * CELL;
      const py = (r + 0.5) * CELL;
      spawnParticles(px, py, 5, '#ff8a65', { spd: 90, life: 0.5 });
      let dropRoll = 0;
      if (r === DOOR_CELL.r && c === DOOR_CELL.c) {
        dropRoll = 1; // nunca drop natural bajo la puerta
      } else {
        dropRoll = Math.random();
      }
      if (!state.gameOver && dropRoll < PICKUP_CHANCE && drops < 3 && !hasPickup(r, c)) {
        pickups.push({ row: r, col: c, type: randomPickup() });
        drops++;
      }
    }
  }

  // Daño a enemigos
  const killed = enemies.filter((e) => !e.dead && cells.has(`${e.row},${e.col}`));
  let nth = 0;
  for (const e of killed) {
    e.dead = true;
    state.score += 100 + state.level * 10;
    const px = (e.col + 0.5) * CELL;
    const py = (e.row + 0.5) * CELL;
    feedbackBundle('medium', px, py, { color: '#ff2d78' });
    playKillSound(nth++);
    achievements.unlock('bomberman_first_kill');
  }

  // Daño al jugador
  const playerKey = `${Math.round(player.row)},${Math.round(player.col)}`;
  if (player.alive && player.inv <= 0 && cells.has(playerKey)) {
    killPlayer();
  }
}

function randomPickup() {
  const r = Math.random();
  if (r < 0.22) return 'bomb';
  if (r < 0.44) return 'fire';
  if (r < 0.62) return 'speed';
  if (r < 0.81) return 'full';
  return 'detonator';
}

function updateBombs(dt) {
  if (!player.detonator) {
    for (const b of bombs) if (b.timer < Infinity) b.timer -= dt;
  }
  for (const b of bombs.slice()) {
    if (b.timer <= 0) explode(b);
  }
  bombs = bombs.filter((b) => b.timer > 0);
}

function updateBlasts(dt) {
  for (const bl of blasts) bl.ttl -= dt;
  blasts = blasts.filter((b) => b.ttl > 0);
}

// ── POWER-UPS ──
const PICKUP_LABEL = {
  bomb: '+1',
  fire: '+2',
  speed: 'SPD',
  full: 'FULL',
  detonator: 'DET',
};
const PICKUP_COLOR = {
  bomb: '#00f0ff',
  fire: '#ffb800',
  speed: '#39ff14',
  full: '#c084fc',
  detonator: '#ff2d78',
};

function applyPickup(type) {
  player.collected.add(type);
  if (type === 'bomb') player.maxBombs = Math.min(player.maxBombs + 1, 8);
  else if (type === 'fire') player.range = Math.min(player.range + 2, 8);
  else if (type === 'speed') player.speed = Math.min(player.speed + 0.35, 1.8);
  else if (type === 'full') player.range = 8;
  else if (type === 'detonator') player.detonator = true;
  playPickupSound();
  if (
    player.collected.has('bomb') &&
    player.collected.has('fire') &&
    player.collected.has('speed') &&
    player.collected.has('full') &&
    player.collected.has('detonator')
  ) {
    achievements.unlock('bomberman_power_collector');
  }
}

function collectPickups() {
  const pr = Math.round(player.row);
  const pc = Math.round(player.col);
  const idx = pickups.findIndex((p) => p.row === pr && p.col === pc);
  if (idx === -1) return;
  applyPickup(pickups[idx].type);
  pickups.splice(idx, 1);
}

// ── PUERTA ──
function checkDoor() {
  if (!doorActive) return;
  if (Math.round(player.row) === DOOR_CELL.r && Math.round(player.col) === DOOR_CELL.c) {
    nextLevel();
  }
}

// ── JUGADOR ──
function killPlayer() {
  if (!player.alive || player.inv > 0) return;
  player.alive = false;
  damageThisLevel = true;
  deadTimer = RESPAWN_TIME;
  playDeathSound();
  spawnParticles((player.col + 0.5) * CELL, (player.row + 0.5) * CELL, 12, '#00f0ff', {
    spd: 120,
    life: 0.6,
  });
  state.lives--;
  if (state.lives <= 0) {
    endGame();
  }
}

function respawnPlayer() {
  player.row = PLAYER_START.r;
  player.col = PLAYER_START.c;
  player.moving = false;
  player.t = 0;
  player.alive = true;
  player.inv = INVINCIBLE_TIME;
}

// ── MOVIMIENTO ──
function addDir(dr, dc) {
  const exists = heldDirs.some((d) => d.dr === dr && d.dc === dc);
  if (!exists) heldDirs.push({ dr, dc });
}

function removeDir(dr, dc) {
  const idx = heldDirs.findIndex((d) => d.dr === dr && d.dc === dc);
  if (idx !== -1) heldDirs.splice(idx, 1);
}

function currentDir() {
  return heldDirs[heldDirs.length - 1] || null;
}

function updatePlayer(dt) {
  if (!player.alive) return;
  if (player.inv > 0) player.inv -= dt;

  const dir = currentDir();
  if (player.moving) {
    // Si se pidió otra dirección a medias del salto, cancelar y girar
    if (dir && (dir.dr !== player.dir.dr || dir.dc !== player.dir.dc) && player.t < 0.5) {
      player.moving = false;
      player.t = 0;
    } else {
      const step = MOVE_SPEED * player.speed * dt;
      player.t += step;
      if (player.t >= 1) {
        player.col += player.dir.dc;
        player.row += player.dir.dr;
        player.t = 0;
        player.moving = false;
        collectPickups();
        if (grid[Math.round(player.row)][Math.round(player.col)] === EMPTY) {
          playMoveSound();
        }
        checkDoor();
      }
    }
  }
  if (!player.moving && dir) {
    const nc = player.col + dir.dc;
    const nr = player.row + dir.dr;
    if (isWalkable(nr, nc)) {
      player.dir = { ...dir };
      player.moving = true;
      player.t = 0;
    }
  }
  collectPickups();
}

// ── FLUJO DE NIVEL ──
function nextLevel() {
  if (!damageThisLevel) achievements.unlock('bomberman_speed_demon');
  state.level++;
  playLevelSound();
  const bonus = state.level * 500;
  state.score += bonus;
  generateMaze();
  spawnEnemies();
  bombs = [];
  blasts = [];
  pickups = [];
  doorActive = false;
  player.row = PLAYER_START.r;
  player.col = PLAYER_START.c;
  player.moving = false;
  player.t = 0;
  player.alive = true;
  player.inv = 1.5;
  damageThisLevel = false;
  say(`¡Nivel ${state.level}!`);
  feedbackBundle('medium', (COLS * CELL) / 2, (ROWS * CELL) / 2, { color: '#39ff14' });
}

function startGame() {
  ensureAudio();
  state.score = 0;
  state.level = 1;
  state.lives = MAX_LIVES;
  state.running = true;
  state.gameOver = false;
  state.paused = false;
  player.maxBombs = 1;
  player.range = 2;
  player.speed = 1;
  player.detonator = false;
  player.collected = new Set();
  player.alive = true;
  player.inv = 1.5;
  damageThisLevel = false;
  bombs = [];
  blasts = [];
  pickups = [];
  generateMaze();
  spawnEnemies();
  doorActive = false;
  clearParticles();
  startAmbient();
  startMusic('bomberman');
  shell.enableTabTrap();
  overlay.style.display = 'none';
  say('Bomberman — ¡Empezó!');
}

function endGame() {
  state.gameOver = true;
  state.running = false;
  shell.disableTabTrap();
  stopMusic();
  playGameOverSound();
  if (state.score > state.best) {
    state.best = state.score;
    saveBest('bomberman2d', state.best);
  }
  finalScoreEl.textContent = `Puntos: ${state.score}`;
  finalScoreEl.style.display = '';
  overlayText.textContent = '¡Juego terminado!';
  hintEl.innerHTML =
    '<kbd>R</kbd> reiniciar &nbsp;·&nbsp; <kbd>Espacio</kbd> / tap para jugar de nuevo';
  overlay.style.display = '';
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
const codeToDir = {
  ArrowUp: { dr: -1, dc: 0 },
  KeyW: { dr: -1, dc: 0 },
  ArrowDown: { dr: 1, dc: 0 },
  KeyS: { dr: 1, dc: 0 },
  ArrowLeft: { dr: 0, dc: -1 },
  KeyA: { dr: 0, dc: -1 },
  ArrowRight: { dr: 0, dc: 1 },
  KeyD: { dr: 0, dc: 1 },
};

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && (state.gameOver || !state.running)) {
    e.preventDefault();
    startGame();
    return;
  }
  if (e.code === 'Space' || e.code === 'KeyP') {
    e.preventDefault();
    if (!state.running) {
      startGame();
    } else if (e.code === 'KeyP') {
      togglePause();
    } else if (state.running && !state.gameOver && !state.paused) {
      placeBomb();
    }
    return;
  }
  if (!state.running || state.gameOver || state.paused) return;
  const dir = codeToDir[e.code];
  if (dir) {
    e.preventDefault();
    addDir(dir.dr, dir.dc);
  }
});

window.addEventListener('keyup', (e) => {
  const dir = codeToDir[e.code];
  if (dir) removeDir(dir.dr, dir.dc);
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

bindBtn(
  'btnUp',
  () => {
    if (!state.running) startGame();
    else addDir(-1, 0);
  },
  () => {
    removeDir(-1, 0);
  },
);
bindBtn(
  'btnDown',
  () => {
    if (!state.running) startGame();
    else addDir(1, 0);
  },
  () => {
    removeDir(1, 0);
  },
);
bindBtn(
  'btnLeft',
  () => {
    if (!state.running) startGame();
    else addDir(0, -1);
  },
  () => {
    removeDir(0, -1);
  },
);
bindBtn(
  'btnRight',
  () => {
    if (!state.running) startGame();
    else addDir(0, 1);
  },
  () => {
    removeDir(0, 1);
  },
);
bindBtn('btnBomb', () => {
  if (!state.running) startGame();
  else placeBomb();
});

// ── ENTRADA: GAMEPAD ──
const gamepad = createGamepad();
let prevStart = false;
let prevA = false;
const padDirs = new Set();

function pollGamepad() {
  const gp = gamepad.pad;
  if (!gp) return;

  let dir = null;
  const dx = gp.axes[0] ?? 0;
  const dy = gp.axes[1] ?? 0;
  if (gp.buttons[14]?.pressed || dy < -0.4) dir = { dr: -1, dc: 0 };
  else if (gp.buttons[13]?.pressed || dy > 0.4) dir = { dr: 1, dc: 0 };
  else if (gp.buttons[15]?.pressed || dx > 0.4) dir = { dr: 0, dc: 1 };
  else if (gp.buttons[12]?.pressed || dx < -0.4) dir = { dr: 0, dc: -1 };

  if (dir) {
    const key = `${dir.dr},${dir.dc}`;
    if (!padDirs.has(key)) {
      addDir(dir.dr, dir.dc);
      padDirs.add(key);
    }
  } else {
    for (const key of padDirs) {
      const [dr, dc] = key.split(',').map(Number);
      removeDir(dr, dc);
    }
    padDirs.clear();
  }

  const startHeld = !!gp.buttons[9]?.pressed;
  if (startHeld && !prevStart) {
    if (!state.running) startGame();
    else togglePause();
  }
  prevStart = startHeld;

  const aHeld = !!gp.buttons[0]?.pressed;
  if (aHeld && !prevA) placeBomb();
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
  if (!player.alive) {
    deadTimer -= dt;
    if (deadTimer <= 0) respawnPlayer();
    updateEnemies(dt);
    updateBombs(dt);
    updateBlasts(dt);
    if (enemies.every((e) => e.dead)) doorActive = true;
    return;
  }
  updatePlayer(dt);
  updateEnemies(dt);
  updateBombs(dt);
  updateBlasts(dt);
  if (enemies.every((e) => e.dead)) doorActive = true;
  if (doorActive) checkDoor();
}

// ── RENDER ──
function draw() {
  ctx.save();
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, canvasW, canvasH);

  const ox = offX;
  const oy = offY;
  const s = scale;
  const pad = CELL * 0.12;

  // Fondo del laberinto
  ctx.fillStyle = 'rgba(16, 18, 36, 0.9)';
  ctx.fillRect(ox, oy, BOARD_W * s, BOARD_H * s);

  // ── Celdas: empedrado ──
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === EMPTY) continue;
      const x = ox + c * CELL * s;
      const y = oy + r * CELL * s;

      if (grid[r][c] === SOLID) {
        ctx.fillStyle = '#141630';
        ctx.beginPath();
        ctx.roundRect(x + pad / 2, y + pad / 2, CELL * s - pad, CELL * s - pad, 6 * s);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,240,255,0.25)';
        ctx.lineWidth = 1.5 * s;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(0,240,255,0.08)';
        ctx.lineWidth = 1 * s;
        ctx.strokeRect(x + CELL * s * 0.18, y + CELL * s * 0.18, CELL * s * 0.64, CELL * s * 0.64);
      } else if (grid[r][c] === BRICK) {
        ctx.fillStyle = '#5a2233';
        ctx.beginPath();
        ctx.roundRect(x + pad / 2, y + pad / 2, CELL * s - pad, CELL * s - pad, 5 * s);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,138,101,0.6)';
        ctx.lineWidth = 1.6 * s;
        ctx.stroke();
        // patrón de ladrillo
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.moveTo(x + CELL * s * 0.5, y + pad / 2);
        ctx.lineTo(x + CELL * s * 0.5, y + CELL * s - pad / 2);
        ctx.moveTo(x + pad / 2, y + CELL * s * 0.5);
        ctx.lineTo(x + CELL * s - pad / 2, y + CELL * s * 0.5);
        ctx.stroke();
        drawGlow(ctx, x + CELL * s * 0.5, y + CELL * s * 0.5, CELL * s * 0.28, '#ff8a65', 0.08);
      }
    }
  }

  // ── Puerta ──
  if (doorActive || grid[DOOR_CELL.r][DOOR_CELL.c] !== BRICK) {
    const x = ox + DOOR_CELL.c * CELL * s;
    const y = oy + DOOR_CELL.r * CELL * s;
    ctx.fillStyle = doorActive ? '#39ff14' : 'rgba(57,255,20,0.25)';
    ctx.globalAlpha = doorActive ? 0.85 : 0.35;
    ctx.beginPath();
    ctx.roundRect(x + CELL * s * 0.2, y + CELL * s * 0.15, CELL * s * 0.6, CELL * s * 0.7, 4 * s);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (doorActive) {
      drawGlow(ctx, x + CELL * s * 0.5, y + CELL * s * 0.5, CELL * s * 0.5, '#39ff14', 0.2);
    }
  }

  // ── Bonus ──
  for (const p of pickups) {
    const x = ox + (p.col + 0.5) * CELL * s;
    const y = oy + (p.row + 0.5) * CELL * s;
    const color = PICKUP_COLOR[p.type];
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const px = x + Math.cos(ang) * CELL * s * 0.3;
      const py = y + Math.sin(ang) * CELL * s * 0.3;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    drawGlow(ctx, x, y, CELL * s * 0.42, color, 0.25);
    ctx.fillStyle = '#0a0a1a';
    ctx.font = `bold ${9 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(PICKUP_LABEL[p.type], x, y + 1 * s);
  }

  // ── Bombas ──
  for (const b of bombs) {
    const x = ox + (b.col + 0.5) * CELL * s;
    const y = oy + (b.row + 0.5) * CELL * s;
    const pulse = 0.8 + 0.2 * Math.sin(performance.now() / 120);
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x, y, 10 * s * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffb800';
    ctx.lineWidth = 2 * s;
    ctx.stroke();
    drawGlow(ctx, x, y, 13 * s, '#ffb800', 0.4);
    // mecha
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(x, y - 10 * s * pulse);
    ctx.lineTo(x + 4 * s, y - 16 * s * pulse);
    ctx.stroke();
  }

  // ── Explosiones ──
  for (const bl of blasts) {
    const x = ox + (bl.col + 0.5) * CELL * s;
    const y = oy + (bl.row + 0.5) * CELL * s;
    const frac = bl.ttl / BLAST_TTL;
    const r = CELL * s * 0.34 * (1 + (1 - frac) * 0.6);
    ctx.globalAlpha = frac;
    ctx.fillStyle = '#ffb800';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ── Jugador ──
  if (player.alive) {
    const blink = player.inv > 0 && Math.floor(player.inv * 8) % 2 === 0;
    const x = ox + player.col * CELL * s + CELL * s * 0.5;
    const y = oy + player.row * CELL * s + CELL * s * 0.5;
    if (!blink) {
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(x, y, 12 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e6fdff';
      ctx.lineWidth = 2.5 * s;
      ctx.stroke();
      drawGlow(ctx, x, y, 15 * s, '#00f0ff', 0.35);
      // ojos
      const look = player.dir;
      const eox = look.dc * 3 * s;
      const eoy = look.dr * 3 * s;
      ctx.fillStyle = '#0a0a1a';
      ctx.beginPath();
      ctx.arc(x - 4 * s + eox, y - 3 * s + eoy, 2.6 * s, 0, Math.PI * 2);
      ctx.arc(x + 4 * s + eox, y - 3 * s + eoy, 2.6 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Enemigos ──
  for (const e of enemies) {
    if (e.dead) continue;
    const x = ox + e.col * CELL * s + CELL * s * 0.5;
    const y = oy + e.row * CELL * s + CELL * s * 0.5;
    if (e.type === 'balloon') {
      ctx.fillStyle = '#ff2d78';
      ctx.beginPath();
      ctx.arc(x, y, 10 * s, 0, Math.PI * 2);
      ctx.fill();
      drawGlow(ctx, x, y, 13 * s, '#ff2d78', 0.3);
      ctx.fillStyle = '#0a0a1a';
      ctx.beginPath();
      ctx.arc(x - 2.8 * s, y - 1.5 * s, 2.4 * s, 0, Math.PI * 2);
      ctx.arc(x + 2.8 * s, y - 1.5 * s, 2.4 * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#ffb800';
      ctx.beginPath();
      ctx.roundRect(x - 8 * s, y - 8 * s, 16 * s, 16 * s, 4 * s);
      ctx.fill();
      drawGlow(ctx, x, y, 13 * s, '#ffb800', 0.3);
      ctx.fillStyle = '#0a0a1a';
      ctx.beginPath();
      ctx.arc(x - 2.8 * s, y - 1.5 * s, 2.4 * s, 0, Math.PI * 2);
      ctx.arc(x + 2.8 * s, y - 1.5 * s, 2.4 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Partículas ──
  drawParticles(ctx, offX, offY, scale);

  // ── Pausa ──
  if (state.paused && state.running) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(ox, oy, BOARD_W * s, BOARD_H * s);
    ctx.fillStyle = '#fff';
    ctx.font = `${26 * s}px 'Courier New', monospace`;
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
const livesValueEl = document.getElementById('livesValue');

function updateHUD() {
  scoreValueEl.textContent = String(state.score);
  bestValueEl.textContent = String(state.best);
  levelValueEl.textContent = String(state.level);
  livesValueEl.textContent = String(Math.max(state.lives, 0));
}

// ── BUCLE PRINCIPAL ──
const loop = createGameLoop((dt) => {
  pollGamepad();

  if (state.running && !state.gameOver && !state.paused) {
    updateGame(dt);
  }

  updateParticles(dt);
  updateHUD();
  draw();
});

// Estado inicial
generateMaze();
spawnEnemies();
updateHUD();

shell.onCleanup(() => loop.stop());
document.getElementById('loading').classList.add('hidden');
loop.start();
