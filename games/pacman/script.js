import { showHelp } from '../../shared/help.js';
import { ensureAudio, beep, closeAudio } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import {
  triggerShake,
  updateShake,
  getShakeOffset,
  spawnParticles,
  updateParticles,
  drawParticles,
} from '../../shared/effects.js';
/* ============================================================
   PAC-MAN 2D — Arcade Hub
   Canvas 2D, sin dependencias externas.
   Laberinto clásico con 4 fantasmas (IA diferenciada),
   power pellets, scoring, lives.
   ============================================================ */

// ============================================================
// CONSTANTES
// ============================================================
const COLS = 28,
  ROWS = 31,
  CS = 18;
const CW = COLS * CS,
  CH = ROWS * CS;
const CPAD = 10;
const START_LIVES = 3;
const SCORE_DOT = 10,
  SCORE_PELLET = 50;
const SCORE_GHOST = [200, 400, 800, 1600];
const FRIGHT_TIME = 7;
const GHOST_SPEED = 80,
  GHOST_FRIGHT_SPEED = 50,
  GHOST_HOME_SPEED = 120;
const PAC_SPEED = 120;
// const DOT_COUNT = 244; // total dots in level (including pellets)

// Directions
const D = {
  NONE: { dx: 0, dy: 0 },
  UP: { dx: 0, dy: -1 },
  DOWN: { dx: 0, dy: 1 },
  LEFT: { dx: -1, dy: 0 },
  RIGHT: { dx: 1, dy: 0 },
};

// Maze: W=wall, .=dot, o=power pellet, ' '=empty, G=ghost gate, g=ghost spawn
// prettier-ignore
const MAZE_DATA = [
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWW",
  "W............WW............W",
  "WoWWW.WWWW..WW..WWWW.WWWWoW",
  "W.WWW.WWWW..WW..WWWW.WWW.WW",
  "W..........................W",
  "W.WWW.WW.WWWWWWWW.WW.WWW.WW",
  "W.WWW.WW.WWWWWWWW.WW.WWW.WW",
  "W....WW...WWWWWWWW...WW....W",
  "WWWW.WWWW.WWWWWWWW.WWWW.WWWW",
  "WWWW.WWWW.WWWWWWWW.WWWW.WWWW",
  "WWWW....WW......WW....WWWWWW",
  "WWWW.WW.WWWW  WWWW.WW.WWWWWW",
  "WWWW.WW.WWWW  WWWW.WW.WWWWWW",
  "WWWW....WWW    WWW....WWWWWW",
  "WWWW.WW.WWWWGGWWWW.WW.WWWWWW",
  "WWWW.WW.WWWWGGWWWW.WW.WWWWWW",
  "WWWW....WWWGGGGWWW....WWWWWW",
  "WWWW.WW.WWWWWWWWWW.WW.WWWWWW",
  "WWWW.WW.WWWWWWWWWW.WW.WWWWWW",
  "WWWW....WW......WW....WWWWWW",
  "WWWW.WWWWWWW..WWWWWWW.WWWWWW",
  "WWWW.WWWWWWW..WWWWWWW.WWWWWW",
  "W............WW............W",
  "WoWWW.WWWW..WW..WWWW.WWWWoW",
  "W.WWW.WWWW..WW..WWWW.WWW.WW",
  "W...WW....WWWWWW....WW...WW",
  "WWW.WW.WW.WWWWWW.WW.WW.WWWW",
  "WWW.WW.WW.WWWWWW.WW.WW.WWWW",
  "W....WW...WWWWWW...WW....WW",
  "W.WWWWWWWW..WW..WWWWWWWW.WW",
  "W.WWWWWWWW..WW..WWWWWWWW.WW",
  "W..........................W",
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWW",
];

// ============================================================
// ESTADO
// ============================================================
const state = {
  running: false,
  gameOver: false,
  paused: false,
  score: 0,
  lives: START_LIVES,
  best: Number(localStorage.getItem('pacman2d_best') || 0),
  frightened: 0, // timer for fright mode
  dotsLeft: 0,
  ghostCombo: 0,
};

// ============================================================
// CANVAS
// ============================================================
const canvas = document.getElementById('gameCanvas'),
  ctx = canvas.getContext('2d');
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
  const sx = (canvasW - CPAD * 2) / CW,
    sy = (canvasH - CPAD * 2) / CH;
  scale = Math.min(sx, sy);
  offX = (canvasW - CW * scale) / 2;
  offY = (canvasH - CH * scale) / 2;
}
window.addEventListener('resize', resize);
resize();

// SONIDO (usando shared/audio.js)
function playDot() {
  beep({ freq: 400, freqEnd: 500, duration: 0.04, type: 'square', volume: 0.06 });
}
function playPellet() {
  beep({ freq: 300, freqEnd: 800, duration: 0.15, type: 'square', volume: 0.12 });
}
function playGhost() {
  beep({ freq: 800, freqEnd: 1600, duration: 0.08, type: 'triangle', volume: 0.16 });
  triggerShake(3);
}
function playDeath() {
  triggerShake(6);
  beep({ freq: 400, freqEnd: 50, duration: 0.5, type: 'sawtooth', volume: 0.2 });
}
function playFright() {
  beep({ freq: 200, freqEnd: 400, duration: 0.3, type: 'sine', volume: 0.1 });
}

// ============================================================
// PARTÍCULAS
// ============================================================
// ============================================================
// LABERINTO
// ============================================================
let grid = [];
function buildMaze() {
  grid = [];
  state.dotsLeft = 0;
  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      const ch = MAZE_DATA[r]?.[c] || 'W';
      if (ch === '.' || ch === 'o') state.dotsLeft++;
      grid[r][c] = ch;
    }
  }
}

function isWalkable(col, row) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
  const ch = grid[row]?.[col];
  return ch !== 'W' && ch !== 'G';
}

function isWalkableForGhost(col, row) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
  const ch = grid[row]?.[col];
  return ch !== 'W';
}

// ============================================================
// PAC-MAN
// ============================================================
const pac = {
  x: 14 * CS + CS / 2,
  y: 23 * CS + CS / 2,
  dir: D.NONE,
  nextDir: D.NONE,
  mouthAngle: 0,
  mouthDir: 1,
  px: 0,
  py: 0,
};

function resetPac() {
  pac.x = 14 * CS + CS / 2;
  pac.y = 23 * CS + CS / 2;
  pac.dir = D.NONE;
  pac.nextDir = D.NONE;
  pac.px = pac.x;
  pac.py = pac.y;
}

function updatePac(dt) {
  pac.px = pac.x;
  pac.py = pac.y;

  // Mouth animation
  pac.mouthAngle += pac.mouthDir * dt * 8;
  if (pac.mouthAngle > 0.4) pac.mouthDir = -1;
  if (pac.mouthAngle < 0.05) pac.mouthDir = 1;

  // Try next direction first (buffering)
  let moved = false;
  const dirs = [pac.nextDir, pac.dir];
  for (const d of dirs) {
    if (d === D.NONE) continue;
    const nx = pac.x + d.dx * PAC_SPEED * dt;
    const ny = pac.y + d.dy * PAC_SPEED * dt;
    const col = Math.round((nx - CS / 2) / CS);
    const row = Math.round((ny - CS / 2) / CS);
    // Check if we can move to the target cell center
    const cx = col * CS + CS / 2,
      cy = row * CS + CS / 2;
    const dist = Math.hypot(nx - cx, ny - cy);
    if (dist < PAC_SPEED * dt * 1.2 && isWalkable(col, row)) {
      pac.x = nx;
      pac.y = ny;
      pac.dir = d;
      moved = true;
      break;
    }
  }

  if (!moved && pac.dir !== D.NONE) {
    // Try continue in current direction with alignment
    const nx = pac.x + pac.dir.dx * PAC_SPEED * dt;
    const ny = pac.y + pac.dir.dy * PAC_SPEED * dt;
    const col = Math.round((nx - CS / 2) / CS);
    const row = Math.round((ny - CS / 2) / CS);
    const cx = col * CS + CS / 2,
      cy = row * CS + CS / 2;
    const dist = Math.hypot(nx - cx, ny - cy);
    // Snap to grid if close
    if (dist < PAC_SPEED * dt * 1.5) {
      if (isWalkable(col, row)) {
        pac.x = nx;
        pac.y = ny;
      } else {
        // Snap to grid center at wall
        pac.x = pac.px;
        pac.y = pac.py;
      }
    } else {
      pac.x = nx;
      pac.y = ny;
    }
  }

  // Tunnel wrapping
  if (pac.x < -CS / 2) pac.x = CW + CS / 2;
  if (pac.x > CW + CS / 2) pac.x = -CS / 2;

  // Eat dots
  const pCol = Math.round((pac.x - CS / 2) / CS);
  const pRow = Math.round((pac.y - CS / 2) / CS);
  if (pRow >= 0 && pRow < ROWS && pCol >= 0 && pCol < COLS) {
    const ch = grid[pRow][pCol];
    if (ch === '.') {
      grid[pRow][pCol] = ' ';
      state.dotsLeft--;
      state.score += SCORE_DOT;
      playDot();
      spawnParticles(pCol * CS + CS / 2, pRow * CS + CS / 2, '#ffe066', 4, {
        spd: 40,
        life: 0.2,
        sm: 1,
        smx: 2,
      });
      updateHUD();
    } else if (ch === 'o') {
      grid[pRow][pCol] = ' ';
      state.dotsLeft--;
      state.score += SCORE_PELLET;
      state.frightened = FRIGHT_TIME;
      state.ghostCombo = 0;
      playPellet();
      playFright();
      // Reverse ghosts
      for (const g of ghosts)
        if (g.mode !== 'home') {
          g.dx *= -1;
          g.dy *= -1;
          g.mode = 'fright';
        }
      spawnParticles(pCol * CS + CS / 2, pRow * CS + CS / 2, '#ffe066', 12, {
        spd: 80,
        life: 0.4,
        sm: 2,
        smx: 3.5,
      });
      updateHUD();
    }
  }

  // Win check
  if (state.dotsLeft <= 0) {
    winGame();
  }
}

// ============================================================
// FANTASMAS
// ============================================================
const GHOST_NAMES = ['blinky', 'pinky', 'inky', 'clyde'];
const GHOST_COLORS = { blinky: '#ff4444', pinky: '#ffaacc', inky: '#44ddff', clyde: '#ffaa44' };
const GHOST_HOME = [
  { x: 14 * CS + CS / 2, y: 11 * CS + CS / 2, release: 0 }, // blinky - released immediately
  { x: 14 * CS + CS / 2, y: 14 * CS + CS / 2, release: 2 }, // pinky
  { x: 12 * CS + CS / 2, y: 14 * CS + CS / 2, release: 4 }, // inky
  { x: 16 * CS + CS / 2, y: 14 * CS + CS / 2, release: 6 }, // clyde
];

let ghosts = [];
function resetGhosts() {
  ghosts = [];
  for (let i = 0; i < 4; i++) {
    const h = GHOST_HOME[i];
    ghosts.push({
      name: GHOST_NAMES[i],
      color: GHOST_COLORS[GHOST_NAMES[i]],
      x: h.x,
      y: h.y,
      dx: 0,
      dy: 0,
      mode: 'home', // home, chase, scatter, fright, eyes
      releaseTime: h.release,
      timer: 0,
      scatterTarget: [
        { x: 0, y: 0 },
        { x: COLS * CS, y: 0 },
        { x: 0, y: ROWS * CS },
        { x: COLS * CS, y: ROWS * CS },
      ][i],
    });
  }
}

function releaseGhosts(dt) {
  for (const g of ghosts) {
    if (g.mode === 'home') {
      g.timer += dt;
      if (g.timer >= g.releaseTime) {
        g.mode = 'chase';
        g.x = 14 * CS + CS / 2;
        g.y = 11 * CS + CS / 2; // ghost gate exit
        g.dx = -1;
        g.dy = 0;
      }
    }
  }
}

function updateGhosts(dt) {
  // Fright timer
  if (state.frightened > 0) {
    state.frightened -= dt;
    if (state.frightened <= 0) {
      state.frightened = 0;
      for (const g of ghosts) if (g.mode === 'fright') g.mode = 'chase';
    }
  }

  for (const g of ghosts) {
    if (g.mode === 'home') continue;

    const spd =
      g.mode === 'fright' ? GHOST_FRIGHT_SPEED : g.mode === 'eyes' ? GHOST_HOME_SPEED : GHOST_SPEED;

    // Move in current direction
    g.x += g.dx * spd * dt;
    g.y += g.dy * spd * dt;

    // Check if at intersection (near grid center)
    const col = Math.round((g.x - CS / 2) / CS);
    const row = Math.round((g.y - CS / 2) / CS);
    const cx = col * CS + CS / 2,
      cy = row * CS + CS / 2;
    const distToCenter = Math.hypot(g.x - cx, g.y - cy);

    if (distToCenter < spd * dt * 1.5 && isWalkableForGhost(col, row)) {
      g.x = cx;
      g.y = cy; // snap to center

      // Ghost gate - only passable from inside home
      if (grid[row]?.[col] === 'G') {
        if (g.mode === 'eyes' || g.mode === 'chase') {
          // pass through
        } else {
          continue; // can't go into gate from outside
        }
      }

      // Choose next direction
      const dirs = [D.UP, D.DOWN, D.LEFT, D.RIGHT];
      const reverse = { dx: -g.dx, dy: -g.dy };
      let best = null,
        bestDist = Infinity;

      for (const d of dirs) {
        // Can't reverse (except in fright)
        if (d.dx === reverse.dx && d.dy === reverse.dy && g.mode !== 'fright') continue;
        if (!isWalkableForGhost(col + d.dx, row + d.dy)) continue;

        if (g.mode === 'fright') {
          // Random direction
          if (Math.random() < 0.25) {
            best = d;
            break;
          }
          if (!best) best = d;
        } else if (g.mode === 'eyes') {
          // Go towards home (ghost gate area)
          const target = { x: 14 * CS, y: 11 * CS };
          const nd = Math.hypot(cx + d.dx * CS - target.x, cy + d.dy * CS - target.y);
          if (nd < bestDist) {
            bestDist = nd;
            best = d;
          }
        } else {
          // Chase or scatter
          let target;
          if (g.mode === 'scatter') target = g.scatterTarget;
          else target = getGhostTarget(g, col, row);

          const nd = Math.hypot(cx + d.dx * CS - target.x, cy + d.dy * CS - target.y);
          if (nd < bestDist) {
            bestDist = nd;
            best = d;
          }
        }
      }

      if (best) {
        g.dx = best.dx;
        g.dy = best.dy;
      }
    }

    // Tunnel
    if (g.x < -CS / 2) g.x = CW + CS / 2;
    if (g.x > CW + CS / 2) g.x = -CS / 2;

    // Eyes reach home → respawn
    if (g.mode === 'eyes' && row === 11 && col === 14) {
      g.mode = 'chase';
      g.x = 14 * CS + CS / 2;
      g.y = 11 * CS + CS / 2;
    }
  }
}

function getGhostTarget(g) {
  switch (g.name) {
    case 'blinky': // Chase: targets Pac-Man
      return { x: pac.x, y: pac.y };
    case 'pinky': {
      // Ambush: 4 tiles ahead of Pac-Man
      const tx = pac.x + pac.dir.dx * CS * 4;
      const ty = pac.y + pac.dir.dy * CS * 4;
      return { x: tx, y: ty };
    }
    case 'inky': {
      // Variable: vector from blinky to 2 tiles ahead of pac-man, doubled
      const aheadX = pac.x + pac.dir.dx * CS * 2;
      const aheadY = pac.y + pac.dir.dy * CS * 2;
      const blinky = ghosts[0];
      return { x: aheadX + (aheadX - blinky.x), y: aheadY + (aheadY - blinky.y) };
    }
    case 'clyde': {
      // Shy: chases if far, scatters if close
      const dist = Math.hypot(pac.x - g.x, pac.y - g.y);
      if (dist > CS * 8) return { x: pac.x, y: pac.y };
      return g.scatterTarget;
    }
  }
}

function checkGhostCollisions() {
  for (const g of ghosts) {
    if (g.mode === 'home' || g.mode === 'eyes') continue;
    const dist = Math.hypot(pac.x - g.x, pac.y - g.y);
    if (dist < CS * 0.8) {
      if (g.mode === 'fright') {
        // Eat ghost!
        g.mode = 'eyes';
        state.score += SCORE_GHOST[Math.min(state.ghostCombo, 3)];
        state.ghostCombo++;
        playGhost();
        spawnParticles(g.x, g.y, '#ffe066', 15, { spd: 100, life: 0.5, sm: 2, smx: 3.5 });
        updateHUD();
      } else if (g.mode === 'chase' || g.mode === 'scatter') {
        // Die
        loseLife();
        return;
      }
    }
  }
}

// ============================================================
// GAME FLOW
// ============================================================
function resetGame() {
  state.score = 0;
  state.lives = START_LIVES;
  state.gameOver = false;
  state.paused = false;
  state.frightened = 0;
  state.ghostCombo = 0;
  buildMaze();
  resetPac();
  resetGhosts();
  document.getElementById('finalScore').style.display = 'none';
  updateHUD();
}

function startGame() {
  ensureAudio();
  resetGame();
  state.running = true;
  achievements.incrementPlays('pacman');
  document.getElementById('overlay').classList.add('hidden');
  if (state.best >= 2000) achievements.unlock('pacman_twothousand');
}

function togglePause() {
  if (!state.running || state.gameOver) return;
  state.paused = !state.paused;
  if (state.paused) {
    document.getElementById('overlayText').textContent = '⏸ PAUSA';
    document.getElementById('finalScore').style.display = 'none';
    document.getElementById('hintEl').innerHTML =
      `<kbd>Espacio</kbd> / <kbd>P</kbd> para continuar`;
    document.getElementById('overlay').classList.remove('hidden');
  } else {
    document.getElementById('overlay').classList.add('hidden');
  }
}

function loseLife() {
  state.lives--;
  playDeath();
  // Death animation particles
  spawnParticles(pac.x, pac.y, '#ffe066', 20, { spd: 80, life: 0.6, sm: 3, smx: 6 });
  updateHUD();
  if (state.lives <= 0) {
    endGame();
    return;
  }
  // Reset positions
  resetPac();
  resetGhosts();
  state.frightened = 0;
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('pacman2d_best', String(state.best));
    if (state.best >= 2000) achievements.unlock('pacman_twothousand');
  }
  const overlayText = document.getElementById('overlayText'),
    finalScore = document.getElementById('finalScore'),
    hintEl = document.getElementById('hintEl');
  overlayText.textContent = '💀 ¡Game Over!';
  finalScore.style.display = 'block';
  finalScore.textContent = `Puntaje: ${state.score} · Récord: ${state.best}`;
  hintEl.innerHTML = `<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> / tocar para empezar · <kbd>R</kbd> reiniciar`;
  document.getElementById('overlay').classList.remove('hidden');
  updateHUD();
}

function winGame() {
  state.running = false;
  state.gameOver = true;
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('pacman2d_best', String(state.best));
    if (state.best >= 2000) achievements.unlock('pacman_twothousand');
  }
  const overlayText = document.getElementById('overlayText'),
    finalScore = document.getElementById('finalScore'),
    hintEl = document.getElementById('hintEl');
  overlayText.textContent = '🎉 ¡Ganaste!';
  finalScore.style.display = 'block';
  finalScore.textContent = `Puntaje: ${state.score} · Récord: ${state.best}`;
  hintEl.innerHTML = `<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> / tocar para empezar · <kbd>R</kbd> reiniciar`;
  document.getElementById('overlay').classList.remove('hidden');
  updateHUD();
}

// ============================================================
// ENTRADA
// ============================================================
const input = { up: false, down: false, left: false, right: false };

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    input.up = true;
    setPacDir(D.UP);
  } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    e.preventDefault();
    input.down = true;
    setPacDir(D.DOWN);
  } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    e.preventDefault();
    input.left = true;
    setPacDir(D.LEFT);
  } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    input.right = true;
    setPacDir(D.RIGHT);
  } else if (e.code === 'Space' || e.code === 'KeyP') {
    e.preventDefault();
    if (!state.running) startGame();
    else togglePause();
  } else if (e.code === 'KeyR' && !state.running) {
    e.preventDefault();
    startGame();
  }
});

function setPacDir(d) {
  if (!state.running) {
    startGame();
    return;
  }
  if (state.gameOver || state.paused) return;
  // If the desired direction is walkable immediately, set it; otherwise buffer it
  const col = Math.round((pac.x - CS / 2) / CS);
  const row = Math.round((pac.y - CS / 2) / CS);
  if (isWalkable(col + d.dx, row + d.dy)) pac.dir = d;
  else pac.nextDir = d;
}

// Touch
function bindHoldButton(id, onDown, onUp) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      el.classList.add('is-pressed');
      onDown();
    },
    { passive: false },
  );
  el.addEventListener(
    'touchend',
    (e) => {
      e.preventDefault();
      el.classList.remove('is-pressed');
      onUp?.();
    },
    { passive: false },
  );
  el.addEventListener('touchcancel', () => {
    el.classList.remove('is-pressed');
    onUp?.();
  });
}
bindHoldButton('btnUp', () => {
  if (!state.running) startGame();
  else if (!state.gameOver) setPacDir(D.UP);
});
bindHoldButton('btnDown', () => {
  if (!state.running) startGame();
  else if (!state.gameOver) setPacDir(D.DOWN);
});
bindHoldButton('btnLeft', () => {
  if (!state.running) startGame();
  else if (!state.gameOver) setPacDir(D.LEFT);
});
bindHoldButton('btnRight', () => {
  if (!state.running) startGame();
  else if (!state.gameOver) setPacDir(D.RIGHT);
});
const btnPause = document.getElementById('btnPause');
btnPause?.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    btnPause.classList.add('is-pressed');
    togglePause();
  },
  { passive: false },
);
btnPause?.addEventListener(
  'touchend',
  (e) => {
    e.preventDefault();
    btnPause.classList.remove('is-pressed');
  },
  { passive: false },
);
btnPause?.addEventListener('touchcancel', () => btnPause.classList.remove('is-pressed'));

document.getElementById('gameCanvas').addEventListener('pointerdown', () => {
  if (!state.running) startGame();
});
document.getElementById('overlay').addEventListener('click', () => {
  if (!state.running) startGame();
});

// Gamepad
let gamepadIndex = null;
const prevGamepad = { start: false };
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
  if (ay < -0.4 || gp.buttons[12]?.pressed) setPacDir(D.UP);
  if (ay > 0.4 || gp.buttons[13]?.pressed) setPacDir(D.DOWN);
  if (ax < -0.4 || gp.buttons[14]?.pressed) setPacDir(D.LEFT);
  if (ax > 0.4 || gp.buttons[15]?.pressed) setPacDir(D.RIGHT);
  const sH = !!gp.buttons[9]?.pressed;
  if (sH && !prevGamepad.start && !state.running) startGame();
  prevGamepad.start = sH;
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
    cy = offY,
    cw2 = CW * s,
    ch2 = CH * s;

  // Background
  ctx.fillStyle = '#0d0d14';
  ctx.fillRect(cx, cy, cw2, ch2);

  // Maze
  const cs2 = CS * s;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const ch = grid[r]?.[c];
      if (!ch || ch === ' ') continue;
      const px = cx + c * cs2,
        py = cy + r * cs2;
      if (ch === 'W') {
        ctx.strokeStyle = 'rgba(40,40,100,0.5)';
        ctx.lineWidth = 2 * s;
        // Draw wall borders
        if (c > 0 && grid[r]?.[c - 1] !== 'W') {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px, py + cs2);
          ctx.stroke();
        }
        if (c < COLS - 1 && grid[r]?.[c + 1] !== 'W') {
          ctx.beginPath();
          ctx.moveTo(px + cs2, py);
          ctx.lineTo(px + cs2, py + cs2);
          ctx.stroke();
        }
        if (r > 0 && grid[r - 1]?.[c] !== 'W') {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + cs2, py);
          ctx.stroke();
        }
        if (r < ROWS - 1 && grid[r + 1]?.[c] !== 'W') {
          ctx.beginPath();
          ctx.moveTo(px, py + cs2);
          ctx.lineTo(px + cs2, py + cs2);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(30,30,80,0.3)';
        ctx.fillRect(px, py, cs2, cs2);
      } else if (ch === '.') {
        ctx.fillStyle = 'rgba(255,200,100,0.3)';
        ctx.shadowColor = 'rgba(255,200,100,0.1)';
        ctx.shadowBlur = 3 * s;
        ctx.beginPath();
        ctx.arc(px + cs2 / 2, py + cs2 / 2, 2 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (ch === 'o') {
        const pulse = 1 + Math.sin(Date.now() / 300) * 0.12;
        ctx.fillStyle = 'rgba(255,200,100,0.5)';
        ctx.shadowColor = 'rgba(255,200,100,0.3)';
        ctx.shadowBlur = 8 * s;
        ctx.beginPath();
        ctx.arc(px + cs2 / 2, py + cs2 / 2, 5 * s * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (ch === 'G') {
        ctx.fillStyle = 'rgba(255,150,200,0.15)';
        ctx.fillRect(px, py + cs2 / 2 - 1 * s, cs2, 2 * s);
      }
    }

  // Ghosts
  for (const g of ghosts) {
    if (g.mode === 'home') continue;
    const gx = cx + g.x * s,
      gy = cy + g.y * s;
    const frightFlash =
      state.frightened > 0 && state.frightened < 2 && Math.floor(state.frightened * 6) % 2 === 0;

    if (g.mode === 'eyes') {
      // Eyes only
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(gx - 4 * s, gy - 3 * s, 3 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(gx + 4 * s, gy - 3 * s, 3 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      // Look towards home
      ctx.beginPath();
      ctx.arc(gx - 3 * s, gy - 2 * s, 1.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(gx + 5 * s, gy - 2 * s, 1.5 * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const col = g.mode === 'fright' ? (frightFlash ? '#fff' : '#44aaff') : g.color;
      ctx.shadowColor = col;
      ctx.shadowBlur = 8 * s;
      ctx.fillStyle = col;
      // Ghost body
      const bw = 14 * s,
        bh = 12 * s;
      ctx.beginPath();
      ctx.arc(gx, gy - bh / 2 + 4 * s, bw / 2, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(gx - bw / 2, gy - bh / 2 + 4 * s, bw, bh - 4 * s);
      // Wavy bottom
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(gx - bw / 2 + ((i + 0.5) * bw) / 3, gy + bh / 2 - 2 * s, bw / 6, 0, Math.PI);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      // Eyes
      if (g.mode !== 'fright') {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(gx - 4 * s, gy - 3 * s, 3 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(gx + 4 * s, gy - 3 * s, 3 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222';
        const ed = g.dx * 2 * s,
          edy = g.dy * 2 * s;
        ctx.beginPath();
        ctx.arc(gx - 4 * s + ed, gy - 3 * s + edy, 1.5 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(gx + 4 * s + ed, gy - 3 * s + edy, 1.5 * s, 0, Math.PI * 2);
        ctx.fill();
      } else if (!frightFlash) {
        // Fright face
        ctx.fillStyle = 'rgba(255,200,200,0.6)';
        ctx.beginPath();
        ctx.arc(gx - 3 * s, gy - 1 * s, 1.5 * s, 0, Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(gx + 3 * s, gy - 1 * s, 1.5 * s, 0, Math.PI);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,200,200,0.4)';
        ctx.lineWidth = 1 * s;
        ctx.beginPath();
        ctx.moveTo(gx - 3 * s, gy + 3 * s);
        ctx.quadraticCurveTo(gx, gy + 5 * s, gx + 3 * s, gy + 3 * s);
        ctx.stroke();
      }
    }
  }

  // Pac-Man
  if (state.running || state.gameOver) {
    const px = cx + pac.x * s,
      py = cy + pac.y * s;
    const mouth = state.gameOver ? 0 : pac.mouthAngle;
    const startAngle = Math.atan2(pac.dir.dy, pac.dir.dx) - Math.PI / 2 + mouth;
    const endAngle = Math.atan2(pac.dir.dy, pac.dir.dx) - Math.PI / 2 - mouth + Math.PI * 2;

    ctx.shadowColor = '#ffe066';
    ctx.shadowBlur = 12 * s;
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, 8 * s, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Particles
  drawParticles(ctx, offX, offY, scale);

  // Pause overlay
  if (state.paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(cx, cy, cw2, ch2);
    ctx.fillStyle = '#fff';
    ctx.font = `${24 * s}px 'Courier New',monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏸ PAUSA', cx + cw2 / 2, cy + ch2 / 2);
  }

  ctx.restore();
}

// ============================================================
// HUD
// ============================================================
const scoreEl = document.getElementById('sc'),
  livesEl = document.getElementById('lv'),
  bestEl = document.getElementById('bst');
function updateHUD() {
  scoreEl.textContent = String(state.score);
  livesEl.textContent =
    '●'.repeat(Math.max(0, state.lives)) + '○'.repeat(Math.max(0, START_LIVES - state.lives));
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

  if (state.running && !state.gameOver && !state.paused) {
    releaseGhosts(dt);
    updatePac(dt);
    updateGhosts(dt);
    checkGhostCollisions();
    // Check if dots = 0 (from updatePac)
  }

  updateParticles(dt);
  draw();
  animFrameId = requestAnimationFrame(tick);
}

buildMaze();
resetPac();
resetGhosts();
updateHUD();

function cleanup() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
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
document.getElementById('helpBtn')?.addEventListener('click', () => showHelp('pacman'));
