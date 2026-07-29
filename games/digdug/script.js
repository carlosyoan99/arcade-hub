import { showHelp } from '../../shared/help.js';
import { ensureAudio, beep, startAmbient, stopAmbient, closeAudio } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import {
  triggerShake,
  updateShake,
  getShakeOffset,
  spawnParticles,
  updateParticles,
  drawParticles,
  roundRect,
} from '../../shared/effects.js';

/* ============================================================
   DIG DUG 2D — Arcade Hub
   Canvas 2D, sin dependencias externas.
   ============================================================ */

// ============================================================
// CONSTANTES
// ============================================================
const CW = 320,
  CH = 352;
const GS = 16; // grid cell size
const COLS = CW / GS; // 20
const ROWS = CH / GS; // 22
const START_LIVES = 3;
const PUMP_RATE = 0.12; // seconds between pump cycles

const PTS_POOKA = 1000;
const PTS_FYGAR = 2000;

// ============================================================
// ESTADO
// ============================================================
const state = {
  running: false,
  gameOver: false,
  score: 0,
  lives: START_LIVES,
  best: Number(localStorage.getItem('digdug2d_best') || 0),
  wave: 1,
  pumpTimer: 0,
  invincibleTimer: 0,
};

// ============================================================
// CANVAS
// ============================================================
const c = document.getElementById('gc'),
  ctx = c.getContext('2d');
let cw = 0,
  ch = 0,
  sc = 1,
  ox = 0,
  oy = 0;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  cw = window.innerWidth;
  ch = window.innerHeight;
  c.width = cw * dpr;
  c.height = ch * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sx = (cw - 12 * 2) / CW,
    sy = (ch - 12 * 2) / CH;
  sc = Math.min(sx, sy);
  ox = (cw - CW * sc) / 2;
  oy = (ch - CH * sc) / 2;
}
window.addEventListener('resize', resize);
resize();

// ============================================================
// SONIDO
// ============================================================
function pDig() {
  beep({ freq: 120, freqEnd: 80, duration: 0.04, type: 'triangle', volume: 0.04 });
}
function pPump() {
  beep({ freq: 600, freqEnd: 800, duration: 0.04, type: 'square', volume: 0.06 });
  triggerShake(0.5);
}
function pPop() {
  beep({ freq: 300, freqEnd: 2000, duration: 0.2, type: 'sawtooth', volume: 0.15 });
  triggerShake(3);
}
function pRock() {
  beep({ freq: 80, freqEnd: 30, duration: 0.3, type: 'sawtooth', volume: 0.2 });
  triggerShake(5);
}
function pDeath() {
  triggerShake(6);
  beep({ freq: 400, freqEnd: 40, duration: 0.4, type: 'sawtooth', volume: 0.2 });
}
function pFruit() {
  [880, 1100, 1320].forEach((ff, i) =>
    setTimeout(() => beep({ freq: ff, duration: 0.08, type: 'triangle', volume: 0.12 }), i * 60),
  );
}
function pWaveClear() {
  [440, 660, 880, 1100].forEach((ff, i) =>
    setTimeout(() => beep({ freq: ff, duration: 0.1, type: 'triangle', volume: 0.14 }), i * 80),
  );
}

// ============================================================
// PARTÍCULAS (usando shared/effects.js)
// ============================================================

// ============================================================
// MAPA (grilla)
// ============================================================
const T = { DIRT: 1, EMPTY: 0, ROCK: 2 };
let grid = [];

function buildGrid() {
  grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      // Top 3 rows are always empty (starting area + enemy spawn)
      // Bottom 2 rows are empty
      // Everything else is dirt, with some rocks
      if (r < 3 || r >= ROWS - 2) {
        grid[r][c] = T.EMPTY;
      } else if (r >= 3 && r <= 5 && (c === 0 || c === COLS - 1)) {
        // Small pathways on edges
        grid[r][c] = T.EMPTY;
      } else {
        grid[r][c] = T.DIRT;
      }
    }
  }
  // Place random rocks in the dirt area (rows 3-19)
  const numRocks = 4 + state.wave;
  let placed = 0;
  while (placed < numRocks) {
    const c = 2 + Math.floor(Math.random() * (COLS - 4));
    const r = 4 + Math.floor(Math.random() * (ROWS - 8));
    if (grid[r][c] === T.DIRT && grid[r][c + 1] === T.DIRT) {
      grid[r][c] = T.ROCK;
      grid[r][c + 1] = T.ROCK;
      placed++;
    }
  }
  // Clear starting area for player
  grid[3][Math.floor(COLS / 2)] = T.EMPTY;
  grid[3][Math.floor(COLS / 2) - 1] = T.EMPTY;
  grid[3][Math.floor(COLS / 2) + 1] = T.EMPTY;
}

function isDirt(c, r) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS && grid[r][c] === T.DIRT;
}
function isEmpty(c, r) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS && grid[r][c] === T.EMPTY;
}
function isRock(c, r) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS && grid[r][c] === T.ROCK;
}

// ============================================================
// ENTIDADES
// ============================================================
const player = { c: Math.floor(COLS / 2), r: 3, dir: 0, moving: false, pumpDir: 0 };
let pumpTarget = null; // enemy being inflated
let pumpProgress = 0;
let enemies = [];
let fallingRock = null; // {c, r, vy, frame}
let fruits = [];
let fruitTimer = 0;

function spawnEnemies() {
  enemies = [];
  const count = Math.min(2 + state.wave, 6);
  const spawnPoints = [
    { c: 1, r: 1 },
    { c: COLS - 2, r: 1 },
    { c: 2, r: 0 },
    { c: COLS - 3, r: 0 },
    { c: Math.floor(COLS / 2) - 1, r: 1 },
    { c: Math.floor(COLS / 2) + 1, r: 1 },
  ];
  for (let i = 0; i < count; i++) {
    const sp = spawnPoints[i % spawnPoints.length];
    enemies.push({
      c: sp.c,
      r: sp.r,
      type: i % 2 === 0 ? 'pooka' : 'fygar',
      alive: true,
      dir: 1, // 0=up,1=right,2=down,3=left
      moveTimer: 0,
      moveInterval: 0.3 + Math.random() * 0.15,
      inflation: 0, // 0-1, pops at 1
      prevC: sp.c,
      prevR: sp.r,
      stunned: 0,
    });
  }
}

function spawnFruit() {
  if (fruits.length > 0) return;
  const cx = 2 + Math.floor(Math.random() * (COLS - 4));
  const cy = 4 + Math.floor(Math.random() * (ROWS - 6));
  if (isEmpty(cx, cy)) {
    fruits.push({ c: cx, r: cy, type: Math.floor(Math.random() * 3), timer: 8 });
  }
}

function resetGame() {
  state.score = 0;
  state.lives = START_LIVES;
  state.gameOver = false;
  state.wave = 1;
  state.pumpTimer = 0;
  state.invincibleTimer = 0;
  state.running = false;
  buildGrid();
  player.c = Math.floor(COLS / 2);
  player.r = 3;
  player.dir = 0;
  pumpTarget = null;
  pumpProgress = 0;
  enemies = [];
  fallingRock = null;
  fruits = [];
  fruitTimer = 3;
  document.getElementById('fs').style.display = 'none';
  updateHUD();
}

function startGame() {
  ensureAudio();
  startAmbient();
  resetGame();
  spawnEnemies();
  state.running = true;
  achievements.incrementPlays('digdug');
  document.getElementById('overlay').classList.add('hidden');
  if (state.best >= 1000) achievements.unlock('digdug_thousand');
}

function loseLife() {
  state.lives--;
  pDeath();
  spawnParticles(player.c * GS + GS / 2, player.r * GS + GS / 2, '#6ec6ff', 15, {
    spd: 80,
    life: 0.5,
    smx: 4,
  });
  updateHUD();
  if (state.lives <= 0) {
    endGame();
    return;
  }
  state.invincibleTimer = 2;
  player.c = Math.floor(COLS / 2);
  player.r = 3;
  pumpTarget = null;
  pumpProgress = 0;
  // Clear some blocked tunnels around player respawn
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const nr = player.r + dr,
        nc = player.c + dc;
      if (isDirt(nc, nr)) grid[nr][nc] = T.EMPTY;
    }
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  stopAmbient();
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('digdug2d_best', String(state.best));
  }
  const ot = document.getElementById('ot'),
    fs = document.getElementById('fs'),
    he = document.getElementById('he');
  ot.textContent = 'Excavaste hasta el final!' + (state.score >= 5000 ? ' 🏆' : '');
  fs.style.display = 'block';
  fs.textContent = `Puntaje: ${state.score} · Record: ${state.best}`;
  he.innerHTML = `<kbd>Espacio</kbd> / tocar para empezar · <kbd>R</kbd> reiniciar`;
  document.getElementById('overlay').classList.remove('hidden');
  updateHUD();
}

function nextWave() {
  state.wave++;
  pWaveClear();
  buildGrid();
  // Clear player area
  grid[player.r][player.c] = T.EMPTY;
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const nr = player.r + dr,
        nc = player.c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && isDirt(nc, nr)) grid[nr][nc] = T.EMPTY;
    }
  player.c = Math.floor(COLS / 2);
  player.r = 3;
  pumpTarget = null;
  pumpProgress = 0;
  enemies = [];
  spawnEnemies();
  fruitTimer = 3;
  updateHUD();
}

// ============================================================
// ENTRADA
// ============================================================
const input = { up: false, down: false, left: false, right: false, fire: false };

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    e.preventDefault();
    input.left = true;
  } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    input.right = true;
  } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    input.up = true;
  } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    e.preventDefault();
    input.down = true;
  } else if (e.code === 'Space') {
    e.preventDefault();
    if (!state.running) startGame();
    else input.fire = true;
  } else if (e.code === 'KeyR' && !state.running) {
    e.preventDefault();
    startGame();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
  else if (e.code === 'ArrowUp' || e.code === 'KeyW') input.up = false;
  else if (e.code === 'ArrowDown' || e.code === 'KeyS') input.down = false;
  else if (e.code === 'Space') input.fire = false;
});

function bH(id, onDown, onUp) {
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
bH(
  'bL',
  () => (input.left = true),
  () => (input.left = false),
);
bH(
  'bR',
  () => (input.right = true),
  () => (input.right = false),
);
bH(
  'bU',
  () => (input.up = true),
  () => (input.up = false),
);
bH(
  'bD',
  () => (input.down = true),
  () => (input.down = false),
);
bH(
  'bF',
  () => {
    if (!state.running) startGame();
    else input.fire = true;
  },
  () => {
    input.fire = false;
  },
);

document.getElementById('gc').addEventListener('pointerdown', () => {
  if (!state.running) startGame();
});
document.getElementById('overlay').addEventListener('click', () => {
  if (!state.running) startGame();
});

// Gamepad
let gI = null;
const gP = { f: false, s: false };
window.addEventListener('gamepadconnected', (e) => (gI = e.gamepad.index));
window.addEventListener('gamepaddisconnected', (e) => {
  if (gI === e.gamepad.index) gI = null;
});
function pG() {
  if (!navigator.getGamepads) return;
  const pads = navigator.getGamepads();
  const gp = (gI !== null ? pads[gI] : null) || pads[0];
  if (!gp) return;
  const ax = gp.axes[0] ?? 0,
    ay = gp.axes[1] ?? 0;
  input.left = ax < -0.4 || !!gp.buttons[14]?.pressed;
  input.right = ax > 0.4 || !!gp.buttons[15]?.pressed;
  input.up = ay < -0.4 || !!gp.buttons[12]?.pressed;
  input.down = ay > 0.4 || !!gp.buttons[13]?.pressed;
  const fH = !!(gp.buttons[0]?.pressed || gp.buttons[2]?.pressed);
  const sH = !!gp.buttons[9]?.pressed;
  if (fH && !gP.f && !state.gameOver) {
    if (!state.running) startGame();
    else input.fire = true;
  }
  if (!fH && gP.f) input.fire = false;
  if (sH && !gP.s && !state.running) startGame();
  gP.f = fH;
  gP.s = sH;
}

// ============================================================
// FÍSICA / LÓGICA
// ============================================================

// Directions: 0=up, 1=right, 2=down, 3=left
const DC = [0, 1, 0, -1];
const DR = [-1, 0, 1, 0];

function updatePlayer(dt) {
  if (state.invincibleTimer > 0) state.invincibleTimer -= dt;
  if (state.pumpTimer > 0) state.pumpTimer -= dt;

  // Movement
  let dc = 0,
    dr = 0;
  if (input.left) {
    dc = -1;
    player.dir = 3;
  } else if (input.right) {
    dc = 1;
    player.dir = 1;
  } else if (input.up) {
    dr = -1;
    player.dir = 0;
  } else if (input.down) {
    dr = 1;
    player.dir = 2;
  }

  if (dc !== 0 || dr !== 0) {
    const nc = player.c + dc,
      nr = player.r + dr;
    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !isDirt(nc, nr)) {
      player.c = nc;
      player.r = nr;
      pDig();
    }
  }

  // Pump / inflate
  const facingC = player.c + DC[player.dir];
  const facingR = player.r + DR[player.dir];

  if (input.fire && state.pumpTimer <= 0) {
    // Check if facing an enemy
    let hitEnemy = false;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (e.c === facingC && e.r === facingR && e.inflation < 1) {
        if (pumpTarget !== e) {
          pumpTarget = e;
          pumpProgress = 0;
        }
        pumpProgress += 0.08;
        state.pumpTimer = PUMP_RATE;
        pPump();
        spawnParticles(e.c * GS + GS / 2, e.r * GS + GS / 2, '#ffdd88', 3, {
          spd: 30,
          life: 0.15,
          sm: 1,
          smx: 2,
        });
        if (pumpProgress >= 1) {
          // Pop!
          e.alive = false;
          const pts = e.type === 'pooka' ? PTS_POOKA : PTS_FYGAR;
          state.score += pts;
          pPop();
          spawnParticles(e.c * GS + GS / 2, e.r * GS + GS / 2, '#ff6b6b', 20, {
            spd: 100,
            life: 0.5,
            sm: 2,
            smx: 5,
          });
          pumpTarget = null;
          pumpProgress = 0;
          updateHUD();
          // Check wave clear
          if (enemies.filter((en) => en.alive).length === 0) {
            setTimeout(() => {
              if (state.running && !state.gameOver) nextWave();
            }, 600);
          }
        }
        hitEnemy = true;
        break;
      }
    }
    if (!hitEnemy) {
      pumpTarget = null;
      pumpProgress = 0;
    }
  } else if (!input.fire) {
    pumpTarget = null;
    pumpProgress = 0;
  }

  // Collision with enemies
  if (state.invincibleTimer <= 0) {
    for (const e of enemies) {
      if (!e.alive || e.inflation > 0.3) continue;
      if (e.c === player.c && e.r === player.r) {
        loseLife();
        break;
      }
    }
  }
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (!e.alive) continue;

    // Stunned from pump
    if (e.inflation > 0) {
      // Move slower when inflated
      e.moveInterval = 0.3 + e.inflation * 0.5;
    } else {
      e.moveInterval = 0.25 + Math.random() * 0.1;
    }

    e.moveTimer += dt;
    if (e.moveTimer < e.moveInterval) continue;
    e.moveTimer = 0;

    if (e.inflation >= 1) continue;
    if (e.stunned > 0) {
      e.stunned -= dt;
      continue;
    }

    // AI: Chase player with some randomness
    const dc = player.c - e.c;
    const dr = player.r - e.r;
    const dirs = [];

    // Prioritize direction toward player
    if (Math.abs(dc) > Math.abs(dr)) {
      if (dc > 0) dirs.push(1);
      else dirs.push(3);
      if (dr > 0) dirs.push(2);
      else if (dr < 0) dirs.push(0);
    } else {
      if (dr > 0) dirs.push(2);
      else if (dr < 0) dirs.push(0);
      if (dc > 0) dirs.push(1);
      else if (dc < 0) dirs.push(3);
    }

    // Add some random movement
    if (Math.random() < 0.3) {
      dirs.push(Math.floor(Math.random() * 4));
    }

    let moved = false;
    for (const d of dirs) {
      const nc = e.c + DC[d],
        nr = e.r + DR[d];
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        // Enemies can move through dirt (phase through) but prefer tunnels
        if (isEmpty(nc, nr) || (isDirt(nc, nr) && Math.random() < 0.3)) {
          e.c = nc;
          e.r = nr;
          e.dir = d;
          moved = true;
          break;
        }
      }
    }

    // Random direction if stuck
    if (!moved) {
      const rd = Math.floor(Math.random() * 4);
      const nc = e.c + DC[rd],
        nr = e.r + DR[rd];
      if (
        nr >= 0 &&
        nr < ROWS &&
        nc >= 0 &&
        nc < COLS &&
        (isEmpty(nc, nr) || (isDirt(nc, nr) && Math.random() < 0.4))
      ) {
        e.c = nc;
        e.r = nr;
        e.dir = rd;
      }
    }

    // Fygar fire breath (occasional)
    if (e.type === 'fygar' && Math.random() < 0.02) {
      // Check if player is in line
      const fdc = e.dir === 1 ? 1 : e.dir === 3 ? -1 : 0;
      const fdr = e.dir === 2 ? 1 : e.dir === 0 ? -1 : 0;
      for (let i = 1; i <= 4; i++) {
        const tc = e.c + fdc * i,
          tr = e.r + fdr * i;
        if (tc === player.c && tr === player.r && state.invincibleTimer <= 0) {
          loseLife();
          break;
        }
      }
    }
  }
}

function checkFallingRocks(_dt) {
  // Check for rocks that should fall
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!isRock(c, r)) continue;
      // Check if cells below the rock pair are empty
      let shouldFall = true;
      if (r + 3 < ROWS) {
        if (c > 0 && (isDirt(c, r + 1) || isDirt(c - 1, r + 1))) shouldFall = false;
        // Actually check: the rock occupies (c, r) and (c+1, r) (it was placed as a pair)
        // It falls if either cell below is empty
        if (isDirt(c, r + 1) && isDirt(c + 1, r + 1)) shouldFall = false;
      }

      if (shouldFall && r < ROWS - 1) {
        // Start falling
        fallingRock = { c, r, vy: 0, frame: 0 };
        grid[r][c] = T.EMPTY;
        grid[r][c + 1] = T.EMPTY;
        pRock();
        return;
      }
    }
  }
}

function updateFallingRock(dt) {
  if (!fallingRock) return;
  fallingRock.vy += 200 * dt;
  fallingRock.r += (fallingRock.vy * dt) / GS;
  fallingRock.frame++;

  const fr = Math.floor(fallingRock.r);
  const fc = fallingRock.c;

  // Kill enemies in path
  for (const e of enemies) {
    if (!e.alive) continue;
    if (Math.abs(e.c - fc) <= 1 && Math.abs(e.r - fr) <= 1) {
      e.alive = false;
      state.score += e.type === 'pooka' ? PTS_POOKA : PTS_FYGAR;
      spawnParticles(e.c * GS + GS / 2, e.r * GS + GS / 2, '#ff6b6b', 15, { spd: 80, life: 0.4 });
    }
  }

  // Kill player
  if (state.invincibleTimer <= 0 && Math.abs(player.c - fc) <= 1 && Math.abs(player.r - fr) <= 1) {
    loseLife();
  }

  // Check if rock reached bottom
  if (fr >= ROWS - 1) {
    fallingRock = null;
    // Check wave clear
    if (enemies.filter((e) => e.alive).length === 0) {
      setTimeout(() => {
        if (state.running && !state.gameOver) nextWave();
      }, 600);
    }
    updateHUD();
  }
}

function updateFruits(dt) {
  fruitTimer -= dt;
  if (fruitTimer <= 0) {
    spawnFruit();
    fruitTimer = 5 + Math.random() * 3;
  }

  for (let i = fruits.length - 1; i >= 0; i--) {
    const f = fruits[i];
    f.timer -= dt;
    if (f.timer <= 0) {
      fruits.splice(i, 1);
      continue;
    }

    // Collect fruit
    if (f.c === player.c && f.r === player.r) {
      state.score += 500;
      pFruit();
      spawnParticles(f.c * GS + GS / 2, f.r * GS + GS / 2, '#ffd700', 10, {
        spd: 60,
        life: 0.3,
        smx: 3,
      });
      fruits.splice(i, 1);
      updateHUD();
    }
  }
}

// ============================================================
// RENDER
// ============================================================
function draw() {
  ctx.clearRect(0, 0, cw, ch);
  const so = getShakeOffset();
  ctx.save();
  ctx.translate(so.x, so.y);
  const s = sc,
    cx = ox,
    cy = oy;

  // Background (dirt color)
  ctx.fillStyle = '#4a3020';
  ctx.fillRect(cx, cy, CW * s, CH * s);

  // Grid / dirt cells
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = cx + c * GS * s,
        y = cy + r * GS * s;
      if (grid[r][c] === T.DIRT) {
        // Dirt texture
        ctx.fillStyle = '#5a3a28';
        ctx.fillRect(x, y, GS * s, GS * s);
        ctx.fillStyle = '#4a2e1c';
        ctx.fillRect(x + 1 * s, y + 1 * s, GS * s - 2 * s, GS * s - 2 * s);
        // Random dots
        if ((c * 7 + r * 13) % 5 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.beginPath();
          ctx.arc(x + 6 * s, y + 5 * s, 1.5 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (grid[r][c] === T.ROCK) {
        // Rock
        ctx.fillStyle = '#6a5a4a';
        ctx.fillRect(x, y, GS * s, GS * s);
        ctx.fillStyle = '#7a6a5a';
        ctx.fillRect(x + 2 * s, y + 2 * s, GS * s - 4 * s, GS * s - 4 * s);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x + 3 * s, y + 3 * s, 3 * s, 2 * s);
      }
    }
  }

  // Tunnel edges (subtle outline)
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 0.5 * s;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== T.DIRT && grid[r][c] !== T.ROCK) {
        const x = cx + c * GS * s,
          y = cy + r * GS * s;
        if (isDirt(c, r - 1)) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + GS * s, y);
          ctx.stroke();
        }
        if (isDirt(c, r + 1)) {
          ctx.beginPath();
          ctx.moveTo(x, y + GS * s);
          ctx.lineTo(x + GS * s, y + GS * s);
          ctx.stroke();
        }
        if (isDirt(c - 1, r)) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + GS * s);
          ctx.stroke();
        }
        if (isDirt(c + 1, r)) {
          ctx.beginPath();
          ctx.moveTo(x + GS * s, y);
          ctx.lineTo(x + GS * s, y + GS * s);
          ctx.stroke();
        }
      }
    }
  }

  // Border
  ctx.shadowColor = 'rgba(110,231,183,0.06)';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = 'rgba(110,231,183,0.1)';
  ctx.lineWidth = 1.5 * s;
  ctx.strokeRect(cx, cy, CW * s, CH * s);
  ctx.shadowBlur = 0;

  // Falling rock
  if (fallingRock) {
    const fx = cx + fallingRock.c * GS * s,
      fy = cy + fallingRock.r * GS * s;
    ctx.fillStyle = '#6a5a4a';
    ctx.shadowColor = 'rgba(200,100,50,0.3)';
    ctx.shadowBlur = 8 * s;
    ctx.fillRect(fx, fy, GS * s * 2, GS * s);
    ctx.fillStyle = '#7a6a5a';
    ctx.fillRect(fx + 3 * s, fy + 3 * s, GS * s * 2 - 6 * s, GS * s - 6 * s);
    ctx.shadowBlur = 0;
  }

  // Fruits
  for (const f of fruits) {
    const fx = cx + f.c * GS * s,
      fy = cy + f.r * GS * s;
    const pulse = 0.8 + Math.sin(Date.now() / 200) * 0.2;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 6 * s;
    ctx.fillStyle = f.type === 0 ? '#ff6b6b' : f.type === 1 ? '#6ec6ff' : '#6ee7b7';
    ctx.beginPath();
    ctx.arc(fx + (GS / 2) * s, fy + (GS / 2) * s, 5 * s * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    const ex = cx + e.c * GS * s,
      ey = cy + e.r * GS * s,
      hs = (GS / 2) * s;

    if (e.type === 'pooka') {
      // Round red enemy
      const inflate = e.inflation;
      ctx.shadowColor = 'rgba(255,100,100,0.3)';
      ctx.shadowBlur = 4 * s;
      // Body (stretches as inflated)
      const iw = hs * (0.5 + inflate * 0.5);
      const ih = hs * (1.5 - inflate * 0.5);
      ctx.fillStyle = e.inflation > 0.5 ? '#ff8888' : '#ff6b6b';
      ctx.beginPath();
      ctx.ellipse(ex + hs, ey + ih, iw, ih * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex + hs - 3 * s, ey + ih - 2 * s, 2 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex + hs + 3 * s, ey + ih - 2 * s, 2 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(ex + hs - 2.5 * s, ey + ih - 1.5 * s, 1 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex + hs + 3.5 * s, ey + ih - 1.5 * s, 1 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      // Fygar - dragon-like
      ctx.shadowColor = 'rgba(100,200,100,0.3)';
      ctx.shadowBlur = 4 * s;
      ctx.fillStyle = e.inflation > 0.5 ? '#88dd88' : '#6ee7b7';
      // Body
      roundRect(ctx, ex + 2 * s, ey + 3 * s, GS * s - 4 * s, GS * s - 6 * s, 3 * s);
      ctx.fill();
      // Snout
      const sdx = e.dir === 1 ? 6 * s : e.dir === 3 ? -6 * s : 0;
      const sdy = e.dir === 2 ? 4 * s : e.dir === 0 ? -4 * s : 0;
      ctx.fillRect(ex + hs - 2 * s + sdx, ey + hs - 2 * s + sdy, 4 * s, 4 * s);
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex + hs - 2 * s, ey + 4 * s, 2 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex + hs + 2 * s, ey + 4 * s, 2 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(ex + hs - 1.5 * s, ey + 4.5 * s, 1 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex + hs + 2.5 * s, ey + 4.5 * s, 1 * s, 0, Math.PI * 2);
      ctx.fill();
      // Fire breath effect
      if (Math.random() < 0.05) {
        const fdc = DC[e.dir],
          fdr = DR[e.dir];
        ctx.fillStyle = 'rgba(255,100,0,0.3)';
        ctx.beginPath();
        ctx.moveTo(ex + hs + fdc * 4 * s, ey + hs + fdr * 4 * s);
        ctx.lineTo(ex + hs + fdc * 8 * s + fdr * 3 * s, ey + hs + fdr * 8 * s + fdc * 3 * s);
        ctx.lineTo(ex + hs + fdc * 8 * s - fdr * 3 * s, ey + hs + fdr * 8 * s - fdc * 3 * s);
        ctx.closePath();
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    // Inflation pump hose (visual)
    if (e === pumpTarget && pumpProgress > 0) {
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 2 * s;
      ctx.setLineDash([2 * s, 2 * s]);
      const px = cx + player.c * GS + (GS / 2) * s,
        py = cy + player.r * GS + (GS / 2) * s;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(ex + hs, ey + hs);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Player
  if (!state.gameOver) {
    const blink = state.invincibleTimer > 0 && Math.floor(state.invincibleTimer * 8) % 2 === 0;
    if (!blink) {
      const px = cx + player.c * GS + (GS / 2) * s,
        py = cy + player.r * GS + (GS / 2) * s;
      ctx.shadowColor = '#6ee7b7';
      ctx.shadowBlur = 6 * s;
      // Body (digger)
      ctx.fillStyle = '#6ee7b7';
      ctx.beginPath();
      ctx.arc(px, py - 2 * s, 5 * s, 0, Math.PI * 2);
      ctx.fill();
      // Goggles
      ctx.fillStyle = '#44ccff';
      ctx.beginPath();
      ctx.arc(px - 2 * s, py - 3 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + 2 * s, py - 3 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(px - 1 * s, py - 2.5 * s, 1 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + 3 * s, py - 2.5 * s, 1 * s, 0, Math.PI * 2);
      ctx.fill();
      // Pump gun
      const pdx = DC[player.dir] * 5 * s,
        pdy = DR[player.dir] * 5 * s;
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 2.5 * s;
      ctx.beginPath();
      ctx.moveTo(px + pdx * 0.3, py + pdy * 0.3);
      ctx.lineTo(px + pdx, py + pdy);
      ctx.stroke();
      // Feet
      ctx.fillStyle = '#44aa77';
      ctx.fillRect(px - 4 * s, py + 2 * s, 3 * s, 3 * s);
      ctx.fillRect(px + 1 * s, py + 2 * s, 3 * s, 3 * s);
      ctx.shadowBlur = 0;
    }
  }

  // Particles
  drawParticles(ctx, ox, oy, sc);
  ctx.restore();
}

// ============================================================
// HUD
// ============================================================
const scEl = document.getElementById('sc'),
  lvEl = document.getElementById('lv');
const bsEl = document.getElementById('bst');
function updateHUD() {
  scEl.textContent = String(state.score);
  lvEl.textContent =
    '●'.repeat(Math.max(0, state.lives)) + '○'.repeat(Math.max(0, 3 - state.lives));
  bsEl.textContent = String(state.best);
}

// ============================================================
// MAIN LOOP
// ============================================================
let animFrameId = null;
let lt = 0;
function tick(t) {
  const dt = Math.min((t - lt) / 1000, 0.05);
  lt = t;
  pG();
  updateShake(dt);

  if (state.running && !state.gameOver) {
    updatePlayer(dt);
    updateEnemies(dt);
    checkFallingRocks(dt);
    updateFallingRock(dt);
    updateFruits(dt);
  }

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
  lt = t;
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
document.getElementById('helpBtn')?.addEventListener('click', () => showHelp('digdug'));
