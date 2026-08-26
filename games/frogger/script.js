import { ensureAudio, beep } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements } from '../../shared/dom.js';
import { startMusic } from '../../shared/music.js';
import { setupCanvas } from '../../shared/display.js';
import { setupGameShell } from '../../shared/shell.js';
import { loadBest, saveBest } from '../../shared/scores.js';
import { createGameLoop } from '../../shared/loop.js';
import { createGamepad } from '../../shared/input.js';
import {
  updateShake,
  getShakeOffset,
  roundRect,
  spawnParticles,
  updateParticles,
  drawParticles,
  drawGlow,
  fillWithGlow,
  feedbackBundle,
  updateSquashes,
  clearSquashes,
} from '../../shared/effects.js';

injectCommonElements();

const shell = setupGameShell('frogger');

/* ============================================================
   FROGGER 2D — Arcade Hub
   Canvas 2D, sin dependencias externas.
   Cruzá la calle y el río esquivando obstáculos.
   ============================================================ */

// ============================================================
// CONSTANTES
// ============================================================
const COLS = 13,
  ROWS = 15,
  CS = 36;
const CW = COLS * CS,
  CH = ROWS * CS;
const CPAD = 10;

const LEVELS = 5; // safe zones to fill
const START_LIVES = 3;
const TIME_LIMIT = 60; // global timer per level (arcade-style)
const CROC_SPAWN_CHANCE = 0.18; // chance a river lane gets a croc

// Lane types
const ROAD = 'road',
  RIVER = 'river',
  SAFE = 'safe',
  START = 'start',
  GOAL = 'goal';

// Lane definitions: [{type, dir, speed, color?}]
// Row 0 = top (goal), Row 14 = bottom (start)
// Original Frogger: trucks slow+long, cars medium, race cars fast+narrow
const LANES = [
  { type: GOAL }, // 0 - goal zone
  { type: SAFE }, // 1 - safe grass
  { type: RIVER, dir: 1, speed: 60, color: '#4a8a5a' }, // 2 - logs
  { type: RIVER, dir: -1, speed: 80, color: '#5a7a4a' }, // 3 - logs
  { type: RIVER, dir: 1, speed: 50, color: '#3a9a5a', turtles: true }, // 4 - turtles (se sumergen)
  { type: RIVER, dir: -1, speed: 70, color: '#4a8a6a', turtles: true }, // 5 - turtles (se sumergen)
  { type: RIVER, dir: 1, speed: 90, color: '#5a8a4a', croc: true }, // 6 - logs + crocodile
  { type: SAFE }, // 7 - safe grass between road and river
  { type: ROAD, dir: -1, speed: 80 }, // 8 - cars (medium)
  { type: ROAD, dir: 1, speed: 55 }, // 9 - trucks (slow, long)
  { type: ROAD, dir: -1, speed: 150 }, // 10 - race cars (fast, narrow)
  { type: ROAD, dir: 1, speed: 90 }, // 11 - cars (medium)
  { type: ROAD, dir: -1, speed: 65 }, // 12 - trucks (slow, long)
  { type: SAFE }, // 13 - safe grass
  { type: START }, // 14 - start zone
];

// Goal positions (5 safe spots at the top)
const GOAL_X = [1, 3.5, 6, 8.5, 11]; // column centers

// ============================================================
// ESTADO
// ============================================================
const state = {
  running: false,
  gameOver: false,
  score: 0,
  lives: START_LIVES,
  level: 1,
  best: loadBest('frogger2d'),
  goals: [],
  timeLeft: TIME_LIMIT,
  extraLifeGiven: { 10000: false, 20000: false },
  bonusItems: [],
};

// ============================================================
// CANVAS
// ============================================================
const canvas = document.getElementById('gameCanvas'),
  ctx = canvas.getContext('2d', { alpha: false });
const { w: cw, h: ch, s: sc, x: ox, y: oy } = setupCanvas(canvas, ctx, CW, CH, CPAD);

// SONIDO (usando shared/audio.js)
function pHop() {
  beep({ freq: 400, freqEnd: 500, duration: 0.05, type: 'square', volume: 0.08 });
}
function pHit() {
  feedbackBundle('large', frog.x, frog.y, {
    color: '#ff4444',
    noFlash: true,
    onBeep: () => beep({ freq: 300, freqEnd: 60, duration: 0.3, type: 'sawtooth', volume: 0.2 }),
  });
}
function pGoal() {
  feedbackBundle('medium', frog.x, frog.y, {
    color: '#6ee7b7',
    onBeep: () =>
      beep({ freq: 600, freqEnd: 1000, duration: 0.12, type: 'triangle', volume: 0.16 }),
  });
}
function pWin() {
  [660, 880, 1100, 1320].forEach((ff, i) =>
    setTimeout(() => beep({ freq: ff, duration: 0.1, type: 'triangle', volume: 0.16 }), i * 90),
  );
}

// ============================================================
// ENTIDADES
// ============================================================
const frog = { x: (COLS / 2) * CS + CS / 2, y: (ROWS - 1) * CS + CS / 2, dir: 0 };
let obstacles = []; // vehicles, logs and turtles
let moveTimer = 0;
let tenSaid = false; // anuncio de "10 segundos" una vez por vida

function buildObstacles() {
  obstacles = [];
  for (let r = 0; r < ROWS; r++) {
    const lane = LANES[r];
    if (lane.type === ROAD) {
      const count = 2 + Math.floor(Math.random() * 2);
      const isTruck = lane.speed < 70;
      const isRace = lane.speed > 130;
      for (let i = 0; i < count; i++) {
        const x = Math.random() * CW;
        obstacles.push({
          row: r,
          x,
          y: r * CS + CS / 2,
          w: isTruck ? CS * 2.8 : isRace ? CS * 1.2 : CS * 1.8,
          h: CS * (isTruck ? 0.75 : isRace ? 0.5 : 0.7),
          dir: lane.dir,
          speed: lane.speed * (0.8 + Math.random() * 0.4),
          type: isTruck ? 'truck' : isRace ? 'racecar' : 'car',
          color: isTruck
            ? '#ff6644'
            : isRace
              ? '#ffff44'
              : ['#ffaa44', '#44aaff', '#ff6b6b', '#aa44ff'][i % 4],
        });
      }
    } else if (lane.type === RIVER) {
      const useTurtles = !!lane.turtles;
      const useCroc = !!lane.croc;
      const count = useTurtles ? 3 : 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const x = Math.random() * CW;
        obstacles.push({
          row: r,
          x,
          y: r * CS + CS / 2,
          w: useTurtles ? CS * 2.1 : useCroc ? CS * 2.5 : CS * (1.5 + Math.random() * 2),
          h: CS * 0.6,
          dir: lane.dir,
          speed: lane.speed * (0.8 + Math.random() * 0.4),
          type: useTurtles ? 'turtle' : useCroc ? 'log' : 'log',
          color: lane.color,
          ...(useTurtles
            ? {
                divePeriod: 3.5 + Math.random() * 1.5,
                diveDur: 1.3 + Math.random() * 0.5,
                divePhase: Math.random() * 5,
              }
            : {}),
          // Crocodile: sits on a log, mouth opens/closes periodically
          ...(useCroc
            ? {
                hasCroc: true,
                crocMouthOpen: false,
                crocTimer: Math.random() * 4,
                crocPeriod: 3 + Math.random() * 2,
              }
            : {}),
        });
      }
      // Spawn crocodile separately if lane has croc flag
      if (useCroc && Math.random() < CROC_SPAWN_CHANCE) {
        obstacles.push({
          row: r,
          x: Math.random() * CW,
          y: r * CS + CS / 2,
          w: CS * 2.2,
          h: CS * 0.7,
          dir: lane.dir,
          speed: lane.speed * (0.8 + Math.random() * 0.4),
          type: 'croc',
          color: '#2d8a4e',
          crocMouthOpen: false,
          crocTimer: Math.random() * 3,
          crocPeriod: 2.5 + Math.random() * 1.5,
        });
      }
    }
  }
  // Spawn bonus items on safe lanes
  spawnBonusItems();
}

// Bonus items: fly (200pts), butterfly (100pts), snake (kills)
function spawnBonusItems() {
  state.bonusItems = [];
  // Place 1-2 bonus items on safe lanes (rows 1, 7, 13)
  const safeLanes = [1, 7, 13];
  const count = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const row = safeLanes[Math.floor(Math.random() * safeLanes.length)];
    const type = Math.random() < 0.3 ? 'snake' : Math.random() < 0.5 ? 'fly' : 'butterfly';
    state.bonusItems.push({
      row,
      x: CS + Math.random() * (CW - CS * 2),
      y: row * CS + CS / 2,
      type,
      timer: 8 + Math.random() * 5, // disappears after timeout
      collected: false,
    });
  }
}

// Las tortugas sumergidas no sirven de plataforma
function turtleSubmerged(o, now = Date.now() / 1000) {
  return (now + o.divePhase) % o.divePeriod < o.diveDur;
}

function isPlatform(o) {
  if (o.type === 'log') return true;
  if (o.type === 'turtle') return !turtleSubmerged(o);
  return false;
}

function isCrocDangerous(o) {
  // Crocodile with mouth open kills the frog
  return o.type === 'croc' && o.crocMouthOpen;
}

function resetFrog() {
  frog.x = (COLS / 2) * CS + CS / 2;
  frog.y = (ROWS - 1) * CS + CS / 2;
  frog.dir = 0;
  moveTimer = 0;
  tenSaid = false;
}

function getFrogRow() {
  return Math.round((frog.y - CS / 2) / CS);
}

// ============================================================
// GAME FLOW
// ============================================================
function resetGame() {
  state.score = 0;
  state.lives = START_LIVES;
  state.level = 1;
  state.gameOver = false;
  state.goals = [];
  state.timeLeft = TIME_LIMIT;
  state.extraLifeGiven = { 10000: false, 20000: false };
  buildObstacles();
  resetFrog();
  document.getElementById('fs').style.display = 'none';
  updateHUD();
}

function startLevel() {
  state.level++;
  state.goals = [];
  state.timeLeft = TIME_LIMIT;
  tenSaid = false;
  buildObstacles();
  resetFrog();
  updateHUD();
}
function startGame() {
  clearSquashes();
  ensureAudio();
  startMusic('frogger');
  resetGame();
  state.running = true;
  achievements.incrementPlays('frogger');
  document.getElementById('overlay').classList.add('hidden');
  shell.enableTabTrap();
  if (state.best >= 1000) achievements.unlock('frogger_thousand');
  say('Frogger: cruzá la calle y el río esquivando obstáculos.');
}

function loseLife() {
  state.lives--;
  pHit();
  spawnParticles(frog.x, frog.y, '#6ee7b7', 15, { spd: 100, life: 0.5, smx: 5 });
  updateHUD();
  if (state.lives <= 0) {
    endGame();
    return;
  }
  resetFrog();
}

function endGame(won) {
  state.running = false;
  state.gameOver = true;
  if (state.score > state.best) {
    state.best = state.score;
    saveBest('frogger2d', state.best);
    if (state.best >= 1000) achievements.unlock('frogger_thousand');
  }
  if (won) pWin();
  const ot = document.getElementById('ot'),
    fs = document.getElementById('fs'),
    he = document.getElementById('he');
  ot.textContent = won ? '🎉 ¡Ganaste!' : '💀 ¡Game Over!';
  fs.style.display = 'block';
  fs.textContent = `Puntaje: ${state.score} · Récord: ${state.best}`;
  he.innerHTML = `<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> / tocar para empezar · <kbd>R</kbd> reiniciar`;
  document.getElementById('overlay').classList.remove('hidden');
  shell.disableTabTrap();
  say('Frogger: game over.');
  updateHUD();
}

// ============================================================
// FÍSICA
// ============================================================
function moveFrog(dx, dy) {
  if (!state.running || state.gameOver) return;
  const nx = frog.x + dx * CS;
  const ny = frog.y + dy * CS;
  if (nx < 0 || nx > CW || ny < 0 || ny > ROWS * CS) return;

  frog.x = nx;
  frog.y = ny;
  frog.dir = dx || (dy < 0 ? -Math.PI / 2 : Math.PI / 2) || 0;
  if (dx > 0) frog.dir = 0;
  if (dx < 0) frog.dir = Math.PI;
  moveTimer = 0.15; // movement cooldown
  pHop();

  // Check collisions
  checkFrogCollisions();
}

function checkFrogCollisions() {
  const row = getFrogRow();
  const lane = LANES[row];
  if (!lane) return;

  // Check bonus item collection
  for (const item of state.bonusItems) {
    if (item.collected || item.row !== row) continue;
    if (Math.abs(frog.x - item.x) < CS * 0.6) {
      item.collected = true;
      if (item.type === 'snake') {
        loseLife();
        return;
      }
      const pts = item.type === 'fly' ? 200 * state.level : 100 * state.level;
      state.score += pts;
      pGoal();
      spawnParticles(item.x, item.y, '#ffd700', 10, { spd: 80, life: 0.4, sm: 2, smx: 3 });
      checkExtraLife();
      updateHUD();
    }
  }

  if (lane.type === GOAL) {
    const col = frog.x / CS;
    let scored = false;
    for (const gx of GOAL_X) {
      if (Math.abs(col - gx) < 0.6 && !state.goals.includes(gx)) {
        state.goals.push(gx);
        // Time bonus: 10pts per second remaining (arcade-style)
        const timeBonus = Math.floor(state.timeLeft) * 10;
        state.score += 100 * state.level + timeBonus;
        pGoal();
        spawnParticles(frog.x, frog.y, '#ffd700', 12, { spd: 80, life: 0.4, sm: 2, smx: 3.5 });
        checkExtraLife();
        updateHUD();
        scored = true;
        if (state.goals.length >= LEVELS) {
          // Infinite levels: start next level instead of ending
          startLevel();
          return;
        }
        resetFrog();
        return;
      }
    }
    if (!scored) {
      loseLife();
    }
    return;
  }

  if (lane.type === ROAD) {
    for (const o of obstacles) {
      if (o.row !== row || o.type === 'log') continue;
      if (
        Math.abs(frog.x - o.x) < (o.w + CS * 0.6) / 2 &&
        Math.abs(frog.y - o.y) < (o.h + CS * 0.6) / 2
      ) {
        loseLife();
        return;
      }
    }
  }

  if (lane.type === RIVER) {
    let onLog = false;
    for (const o of obstacles) {
      if (o.row !== row || !isPlatform(o)) continue;
      // Crocodile with open mouth kills
      if (isCrocDangerous(o)) {
        if (Math.abs(frog.x - o.x) < (o.w + CS * 0.4) / 2) {
          loseLife();
          return;
        }
        continue;
      }
      if (Math.abs(frog.x - o.x) < (o.w + CS * 0.4) / 2) {
        onLog = true;
        break;
      }
    }
    if (!onLog) {
      spawnParticles(frog.x, frog.y, '#44aaff', 10, { spd: 60, life: 0.4, smx: 3 });
      loseLife();
    }
  }
}

function checkExtraLife() {
  if (state.score >= 20000 && !state.extraLifeGiven[20000]) {
    state.extraLifeGiven[20000] = true;
    state.lives++;
    beep({ freq: 800, freqEnd: 1200, duration: 0.15, type: 'triangle', volume: 0.2 });
    say('¡Vida extra!');
  } else if (state.score >= 10000 && !state.extraLifeGiven[10000]) {
    state.extraLifeGiven[10000] = true;
    state.lives++;
    beep({ freq: 800, freqEnd: 1200, duration: 0.15, type: 'triangle', volume: 0.2 });
    say('¡Vida extra!');
  }
}

function updateObstacles(dt) {
  for (const o of obstacles) {
    o.x += o.dir * o.speed * dt;
    // Wrap around
    if (o.dir > 0 && o.x > CW + o.w) o.x = -o.w;
    if (o.dir < 0 && o.x < -o.w) o.x = CW + o.w;

    // Crocodile mouth open/close
    if (o.type === 'croc' || o.hasCroc) {
      o.crocTimer += dt;
      if (o.crocTimer >= o.crocPeriod) {
        o.crocTimer = 0;
        o.crocMouthOpen = !o.crocMouthOpen;
      }
    }

    // Carry frog on log or surfaced turtle (not on dangerous croc)
    const row = getFrogRow();
    if (o.row === row && isPlatform(o) && !isCrocDangerous(o)) {
      if (Math.abs(frog.x - o.x) < (o.w + CS * 0.4) / 2) {
        frog.x += o.dir * o.speed * dt;
        if (frog.x < 0) {
          frog.x = 0;
          loseLife();
        }
        if (frog.x > CW) {
          frog.x = CW;
          loseLife();
        }
      }
    }
  }

  // Update bonus item timers
  for (const item of state.bonusItems) {
    if (item.collected) continue;
    item.timer -= dt;
    if (item.timer <= 0) {
      item.collected = true;
    }
  }
}

// ============================================================
// INPUT
// ============================================================
window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    if (!state.running) startGame();
    else if (moveTimer <= 0) moveFrog(0, -1);
  } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    e.preventDefault();
    if (!state.running) startGame();
    else if (moveTimer <= 0) moveFrog(0, 1);
  } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    e.preventDefault();
    if (!state.running) startGame();
    else if (moveTimer <= 0) moveFrog(-1, 0);
  } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    if (!state.running) startGame();
    else if (moveTimer <= 0) moveFrog(1, 0);
  } else if (e.code === 'KeyR' && !state.running) {
    e.preventDefault();
    startGame();
  }
});

// Touch d-pad
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
bTouch('bU', () => {
  if (!state.running) startGame();
  else if (moveTimer <= 0) moveFrog(0, -1);
});
bTouch('bD', () => {
  if (!state.running) startGame();
  else if (moveTimer <= 0) moveFrog(0, 1);
});
bTouch('bL', () => {
  if (!state.running) startGame();
  else if (moveTimer <= 0) moveFrog(-1, 0);
});
bTouch('bR', () => {
  if (!state.running) startGame();
  else if (moveTimer <= 0) moveFrog(1, 0);
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
const gP = { s: false };

function pG() {
  const gp = gamepad.pad;
  if (!gp) return;
  const ax = gp.axes[0] ?? 0,
    ay = gp.axes[1] ?? 0;
  const du = !!gp.buttons[12]?.pressed,
    dd = !!gp.buttons[13]?.pressed;
  const dl = !!gp.buttons[14]?.pressed,
    dr = !!gp.buttons[15]?.pressed;

  if ((ay < -0.4 || du) && moveTimer <= 0) {
    if (!state.running) startGame();
    else moveFrog(0, -1);
  }
  if ((ay > 0.4 || dd) && moveTimer <= 0) {
    if (!state.running) startGame();
    else moveFrog(0, 1);
  }
  if ((ax < -0.4 || dl) && moveTimer <= 0) {
    if (!state.running) startGame();
    else moveFrog(-1, 0);
  }
  if ((ax > 0.4 || dr) && moveTimer <= 0) {
    if (!state.running) startGame();
    else moveFrog(1, 0);
  }
  const sH = !!gp.buttons[9]?.pressed;
  if (sH && !gP.s && !state.running) startGame();
  gP.s = sH;
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

  // Background
  ctx.fillStyle = '#0d0d14';
  ctx.fillRect(cx, cy, CW * s, CH * s);

  // Draw lanes
  for (let r = 0; r < ROWS; r++) {
    const lane = LANES[r];
    const ly = cy + r * CS * s;

    if (lane.type === GOAL) {
      // Goal zone
      ctx.fillStyle = '#1a1a2a';
      ctx.fillRect(cx, ly, CW * s, CS * s);
      // Goal spots
      for (const gx of GOAL_X) {
        const filled = state.goals.includes(gx);
        ctx.strokeStyle = filled ? 'rgba(255,215,0,0.6)' : 'rgba(255,215,0,0.2)';
        ctx.lineWidth = 2 * s;
        ctx.strokeRect(cx + (gx * CS - CS * 0.4) * s, ly + 2 * s, CS * 0.8 * s, (CS - 4) * s);
        if (filled) {
          ctx.fillStyle = 'rgba(255,215,0,0.15)';
          ctx.fillRect(cx + (gx * CS - CS * 0.4) * s, ly + 2 * s, CS * 0.8 * s, (CS - 4) * s);
          // Draw frog in goal
          drawFrog(cx + gx * CS * s, ly + (CS / 2) * s, s, 0);
        }
      }
    } else if (lane.type === SAFE) {
      ctx.fillStyle = 'rgba(30,50,30,0.4)';
      ctx.fillRect(cx, ly, CW * s, CS * s);
      // Grass texture
      ctx.strokeStyle = 'rgba(60,100,60,0.1)';
      ctx.lineWidth = 0.5 * s;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + Math.random() * CW * s, ly);
        ctx.quadraticCurveTo(
          cx + Math.random() * CW * s,
          ly + CS * s * 0.3,
          cx + Math.random() * CW * s,
          ly + CS * s,
        );
        ctx.stroke();
      }
    } else if (lane.type === START) {
      ctx.fillStyle = 'rgba(30,40,30,0.5)';
      ctx.fillRect(cx, ly, CW * s, CS * s);
    } else if (lane.type === ROAD) {
      // Road
      ctx.fillStyle = '#1a1a22';
      ctx.fillRect(cx, ly, CW * s, CS * s);
      // Dashed center line
      ctx.setLineDash([8 * s, 12 * s]);
      ctx.strokeStyle = 'rgba(255,255,100,0.08)';
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      ctx.moveTo(cx, ly + (CS * s) / 2);
      ctx.lineTo(cx + CW * s, ly + (CS * s) / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (lane.type === RIVER) {
      // Water
      const wGrad = ctx.createLinearGradient(cx, ly, cx + CW * s, ly);
      wGrad.addColorStop(0, '#0a1a2a');
      wGrad.addColorStop(0.5, '#0d1f30');
      wGrad.addColorStop(1, '#0a1a2a');
      ctx.fillStyle = wGrad;
      ctx.fillRect(cx, ly, CW * s, CS * s);
      // Ripple
      ctx.strokeStyle = 'rgba(100,180,255,0.04)';
      ctx.lineWidth = 0.5 * s;
      for (let i = 0; i < 3; i++) {
        const rx = (Date.now() * 0.03 + i * 100) % (CW * s);
        ctx.beginPath();
        ctx.arc(cx + rx, ly + CS * s * (0.3 + 0.3 * i), 20 * s, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // Obstacles (cars, trucks, logs)
  for (const o of obstacles) {
    const ox2 = cx + o.x * s,
      oy2 = cy + o.y * s;
    if (o.type === 'turtle') {
      const now = Date.now() / 1000;
      const cyc = (now + o.divePhase) % o.divePeriod;
      if (turtleSubmerged(o)) {
        // Bajo el agua: solo un anillo tenue
        ctx.strokeStyle = 'rgba(110,231,183,0.12)';
        ctx.lineWidth = 1 * s;
        ctx.beginPath();
        ctx.ellipse(ox2, oy2, (o.w / 2) * s, (o.h / 2) * s, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Parpadeo justo antes de sumergirse
        const aboutToDive = o.divePeriod - cyc < 0.55;
        ctx.globalAlpha = aboutToDive ? (Math.floor(now * 8) % 2 === 0 ? 0.45 : 1) : 1;
        // Caparazones (grupo de 3 lóbulos)
        for (let k = -1; k <= 1; k++) {
          fillWithGlow(
            ctx,
            () => {
              ctx.beginPath();
              ctx.ellipse(
                ox2 + k * o.w * 0.3 * s,
                oy2,
                o.w * 0.26 * s,
                o.h * 0.42 * s,
                0,
                0,
                Math.PI * 2,
              );
            },
            '#2f7d4f',
            0.25,
            3 * s,
          );
          ctx.strokeStyle = 'rgba(255,255,255,0.12)';
          ctx.lineWidth = 1 * s;
          ctx.beginPath();
          ctx.ellipse(
            ox2 + k * o.w * 0.3 * s,
            oy2,
            o.w * 0.18 * s,
            o.h * 0.28 * s,
            0,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        }
        // Cabeza en la dirección de movimiento
        ctx.fillStyle = '#3fa06a';
        ctx.beginPath();
        ctx.arc(ox2 + (((o.dir > 0 ? 1 : -1) * o.w) / 2) * s, oy2, 3.5 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else if (o.type === 'log') {
      ctx.fillStyle = o.color;
      roundRect(ctx, ox2 - (o.w / 2) * s, oy2 - (o.h / 2) * s, o.w * s, o.h * s, 3 * s);
      ctx.fill();
      drawGlow(ctx, ox2, oy2, o.w * s * 0.3, 'rgba(100,180,100,0.06)', 0.04, 3);
      // Wood grain
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 0.5 * s;
      ctx.beginPath();
      ctx.moveTo(ox2 - (o.w / 2) * s + 4 * s, oy2);
      ctx.lineTo(ox2 + (o.w / 2) * s - 4 * s, oy2);
      ctx.stroke();
    } else if (o.type === 'truck') {
      ctx.fillStyle = o.color;
      roundRect(ctx, ox2 - (o.w / 2) * s, oy2 - (o.h / 2) * s, o.w * s, o.h * s, 3 * s);
      ctx.fill();
      drawGlow(ctx, ox2, oy2, o.w * s * 0.3, 'rgba(255,100,50,0.1)', 0.04, 3);
      // Cab
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(
        ox2 + (((o.dir > 0 ? 1 : -1) * o.w) / 4) * s - 3 * s,
        oy2 - (o.h / 3) * s,
        6 * s,
        o.h * 0.6 * s,
      );
      // Wheels
      ctx.fillStyle = 'rgba(50,50,50,0.5)';
      ctx.fillRect(ox2 - (o.w / 3) * s, oy2 + (o.h / 2) * s - 2 * s, 4 * s, 4 * s);
      ctx.fillRect(ox2 + (o.w / 3) * s - 4 * s, oy2 + (o.h / 2) * s - 2 * s, 4 * s, 4 * s);
    } else if (o.type === 'croc') {
      // Crocodile: green body with open/closed mouth
      ctx.fillStyle = o.color;
      roundRect(ctx, ox2 - (o.w / 2) * s, oy2 - (o.h / 2) * s, o.w * s, o.h * s, 3 * s);
      ctx.fill();
      drawGlow(ctx, ox2, oy2, o.w * s * 0.3, 'rgba(50,180,80,0.12)', 0.04, 3);
      // Head + mouth
      const headX = ox2 + (((o.dir > 0 ? 1 : -1) * o.w) / 2.5) * s;
      ctx.fillStyle = '#3a9a5a';
      ctx.beginPath();
      ctx.arc(headX, oy2, 5 * s, 0, Math.PI * 2);
      ctx.fill();
      // Mouth
      if (o.crocMouthOpen) {
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(headX + (o.dir > 0 ? 4 : -4) * s, oy2, 3.5 * s, 0, Math.PI * 2);
        ctx.fill();
        // Teeth
        ctx.fillStyle = '#fff';
        for (let t = -1; t <= 1; t++) {
          ctx.fillRect(headX + (o.dir > 0 ? 2 : -5) * s, oy2 + t * 2 * s - 1 * s, 2 * s, 2 * s);
        }
      } else {
        // Closed mouth line
        ctx.strokeStyle = '#2d6a3e';
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.moveTo(headX, oy2 - 2 * s);
        ctx.lineTo(headX + (o.dir > 0 ? 5 : -5) * s, oy2);
        ctx.lineTo(headX, oy2 + 2 * s);
        ctx.stroke();
      }
      // Tail
      ctx.fillStyle = '#2d7a4a';
      const tailX = ox2 - (((o.dir > 0 ? 1 : -1) * o.w) / 2.5) * s;
      ctx.beginPath();
      ctx.moveTo(tailX, oy2 - 3 * s);
      ctx.lineTo(tailX - (o.dir > 0 ? 8 : -8) * s, oy2);
      ctx.lineTo(tailX, oy2 + 3 * s);
      ctx.fill();
    } else if (o.type === 'racecar') {
      // Race car: narrow, fast, yellow with racing stripe
      ctx.fillStyle = o.color;
      roundRect(ctx, ox2 - (o.w / 2) * s, oy2 - (o.h / 2) * s, o.w * s, o.h * s, 3 * s);
      ctx.fill();
      drawGlow(ctx, ox2, oy2, o.w * s * 0.3, 'rgba(255,255,50,0.12)', 0.04, 3);
      // Racing stripe
      ctx.fillStyle = 'rgba(255,0,0,0.4)';
      ctx.fillRect(ox2 - (o.w / 2) * s + 2 * s, oy2 - 1 * s, o.w * s - 4 * s, 2 * s);
      // Wheels
      ctx.fillStyle = 'rgba(50,50,50,0.5)';
      ctx.beginPath();
      ctx.arc(ox2 - (o.w / 3) * s, oy2 + (o.h / 2) * s, 2 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ox2 + (o.w / 3) * s, oy2 + (o.h / 2) * s, 2 * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Car
      ctx.fillStyle = o.color;
      roundRect(ctx, ox2 - (o.w / 2) * s, oy2 - (o.h / 2) * s, o.w * s, o.h * s, 4 * s);
      ctx.fill();
      drawGlow(ctx, ox2, oy2, o.w * s * 0.25, 'rgba(255,200,100,0.08)', 0.04, 3);
      // Windshield
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      roundRect(ctx, ox2 - (o.w / 4) * s, oy2 - (o.h / 3) * s, (o.w / 2) * s, o.h * 0.5 * s, 2 * s);
      ctx.fill();
      // Wheels
      ctx.fillStyle = 'rgba(50,50,50,0.4)';
      ctx.beginPath();
      ctx.arc(ox2 - (o.w / 3) * s, oy2 + (o.h / 2) * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ox2 + (o.w / 3) * s, oy2 + (o.h / 2) * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Bonus items
  for (const item of state.bonusItems) {
    if (item.collected) continue;
    const ix = cx + item.x * s;
    const iy = cy + item.y * s;
    const blink = item.timer < 3 && Math.floor(Date.now() / 200) % 2 === 0;
    if (blink) continue;
    if (item.type === 'fly') {
      // Fly: small golden dot
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(ix, iy, 4 * s, 0, Math.PI * 2);
      ctx.fill();
      drawGlow(ctx, ix, iy, 8 * s, '#ffd700', 0.15, 3);
    } else if (item.type === 'butterfly') {
      // Butterfly: colorful wings
      ctx.fillStyle = '#ff66aa';
      ctx.beginPath();
      ctx.ellipse(ix - 4 * s, iy, 5 * s, 3 * s, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#aa66ff';
      ctx.beginPath();
      ctx.ellipse(ix + 4 * s, iy, 5 * s, 3 * s, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffff66';
      ctx.beginPath();
      ctx.arc(ix, iy, 2 * s, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.type === 'snake') {
      // Snake: red warning
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(ix, iy, 4 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${8 * s}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', ix, iy);
    }
  }

  // Timer de vida: barra neon abajo a la derecha
  {
    const frac = Math.max(0, state.timeLeft / TIME_LIMIT);
    const barW = CW * s * 0.28;
    const tx = cx + CW * s - barW - 10 * s;
    const ty = cy + CH * s - 11 * s;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(tx, ty, barW, 5 * s);
    ctx.fillStyle = frac > 0.25 ? '#6ee7b7' : '#ff5e7a';
    ctx.fillRect(tx, ty, barW * frac, 5 * s);
    drawGlow(ctx, tx + barW * frac, ty + 2.5 * s, 6 * s, '#6ee7b7', 0.08, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `${9 * s}px 'Courier New',monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(state.timeLeft)}s`, tx - 8 * s, ty + 2.5 * s);
  }

  // Frog
  if (state.running || state.gameOver) {
    drawFrog(cx + frog.x * s, cy + frog.y * s, s, frog.dir);
  }

  // Particles
  drawParticles(ctx, ox, oy, sc);

  ctx.restore();
}

function drawFrog(x, y, s, dir) {
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(x + 2 * s, y + 4 * s, 10 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.save();
  ctx.translate(x, y);
  fillWithGlow(
    ctx,
    () => {
      ctx.beginPath();
      ctx.ellipse(0, 0, 10 * s, 7 * s, 0, 0, Math.PI * 2);
    },
    '#6ee7b7',
    0.4,
    4 * s,
  );

  // Eyes (look in movement direction)
  const ed = Math.cos(dir) * 2 * s,
    edy = Math.sin(dir) * 2 * s;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-4 * s + ed, -4 * s + edy, 3 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(4 * s + ed, -4 * s + edy, 3 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(-4 * s + ed * 1.5, -4 * s + edy * 1.5, 1.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(4 * s + ed * 1.5, -4 * s + edy * 1.5, 1.5 * s, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.fillStyle = '#2f9e73';
  // Back legs
  roundRect(ctx, -9 * s, -1 * s, 4 * s, 8 * s, 2 * s);
  ctx.fill();
  roundRect(ctx, 5 * s, -1 * s, 4 * s, 8 * s, 2 * s);
  ctx.fill();
  // Front legs
  roundRect(ctx, -8 * s, -5 * s, 3 * s, 5 * s, 1.5 * s);
  ctx.fill();
  roundRect(ctx, 5 * s, -5 * s, 3 * s, 5 * s, 1.5 * s);
  ctx.fill();

  ctx.restore();
}

// ============================================================
// HUD
// ============================================================
const scoreEl = document.getElementById('scoreValue'),
  livesEl = document.getElementById('livesValue');
const roundEl = document.getElementById('roundValue'),
  bestEl = document.getElementById('bestValue');
function updateHUD() {
  scoreEl.textContent = String(state.score);
  livesEl.textContent =
    '●'.repeat(Math.max(0, state.lives)) + '○'.repeat(Math.max(0, START_LIVES - state.lives));
  roundEl.textContent = String(state.level);
  bestEl.textContent = String(state.best);
}

// ============================================================
// MAIN LOOP
// ============================================================
const loop = createGameLoop((dt) => {
  pG();
  updateShake(dt);

  if (state.running && !state.gameOver) {
    if (moveTimer > 0) moveTimer -= dt;

    // Timer de vida (60s): si llega a cero, se ahoga la rana
    state.timeLeft -= dt;
    if (state.timeLeft <= 10 && !tenSaid) {
      tenSaid = true;
      say('¡10 segundos!');
    }
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      say('¡Se acabó el tiempo!');
      loseLife();
    }

    updateObstacles(dt);

    // Re-check after log movement
    const row = getFrogRow();
    const lane = LANES[row];
    if (lane && lane.type === RIVER) {
      let onLog = false;
      let onDangerousCroc = false;
      for (const o of obstacles) {
        if (o.row !== row || !isPlatform(o)) continue;
        if (Math.abs(frog.x - o.x) < (o.w + CS * 0.4) / 2) {
          if (isCrocDangerous(o)) {
            onDangerousCroc = true;
            break;
          }
          onLog = true;
          break;
        }
      }
      if (onDangerousCroc && !state.gameOver) {
        loseLife();
      } else if (!onLog && !state.gameOver) {
        spawnParticles(frog.x, frog.y, '#44aaff', 10, { spd: 60, life: 0.4, smx: 3 });
        loseLife();
      }
    }
  }

  updateSquashes(dt);
  updateParticles(dt);
  draw();
});

resetFrog();
buildObstacles();
updateHUD();

shell.onCleanup(() => loop.stop());
document.getElementById('loading').classList.add('hidden');
loop.start();
