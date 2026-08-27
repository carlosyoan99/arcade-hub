import { ensureAudio, beep, startAmbient, stopAmbient } from '../../shared/audio.js';
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
  getShakeOffset,
  spawnParticles,
  updateParticles,
  drawParticles,
  drawGlow,
  strokeWithGlow,
  feedbackBundle,
  updateSquashes,
  clearSquashes,
} from '../../shared/effects.js';

injectCommonElements();

const shell = setupGameShell('galaga');

/* ============================================================
   GALAGA 2D — Arcade Hub
   Canvas 2D, sin dependencias externas.
   ============================================================ */

// ============================================================
// CONSTANTES
// ============================================================
const CW = 800,
  CH = 600,
  CPAD = 20;
const SHIP_Y = CH - 45,
  SHIP_W = 28,
  SHIP_H = 22;
const SHIP_SPEED = 350;
const ENEMY_COLS = 10,
  ENEMY_ROWS = 5;
const ENEMY_W = 24,
  ENEMY_H = 20,
  ENEMY_GAP = 6;
const START_LIVES = 3;
const BULLET_SPEED = 520,
  ENEMY_BULLET_SPEED = 200;
const FIRE_CD = 0.28;
const SHIP_MARGIN = 15;
const MIN_DIVE_INTERVAL = 0.8;
const DIVE_WAVE_REDUCTION = 0.08;
const DIVE_SPEED_MULT = 0.6;
const MAX_DIVERS = 2;
const DIVERS_PER_GROUP = 3;

// 3 tipos de enemigo: Boss (fila 0, 2HP), Bee (filas 1-2), Butterfly (filas 3-4)
const ENEMY_TYPES = {
  boss: { hp: 2, points: 150, color: '#ff6b6b', color2: '#cc3333', label: 'Boss' },
  bee: { hp: 1, points: 100, color: '#ffe066', color2: '#ccaa00', label: 'Bee' },
  butterfly: { hp: 1, points: 60, color: '#6ee7b7', color2: '#33aa77', label: 'Butterfly' },
};
const ROW_TYPE = ['boss', 'bee', 'bee', 'butterfly', 'butterfly'];

// Tractor beam (oleadas pares): un enemigo despliega el rayo; si atrapa tu nave,
// destruiló después para rescatarla y ganar doble disparo temporal.
const BEAM_DESCENT_Y = CH * 0.42;
const BEAM_TIME = 3.2;
const BEAM_BASE_HALF_W = 48;
const BEAM_COOLDOWN = 9;

const SCORE_BEAM_KILL = 300;
const SCORE_RESCUE = 500;

// ============================================================
// FORMATION PATTERNS — 8 layouts únicos que rotan por stage
// Cada patrón es un array de {row, col} -> offset {dx, dy} desde la posición base.
// Los offsets son relativos a la cuadrícula base (ENEMY_W + ENEMY_GAP spacing).
// ============================================================
const FORMATION_PATTERNS = [
  // 0: Classic grid (original Galaga)
  null,
  // 1: Diamond
  (r, c) => {
    const cx = ENEMY_COLS / 2 - 0.5;
    const cy = ENEMY_ROWS / 2 - 0.5;
    const dist = Math.abs(r - cy) + Math.abs(c - cx);
    return { dx: 0, dy: dist * 4 };
  },
  // 2: Arrow (V pointing down)
  (r, c) => {
    const cx = ENEMY_COLS / 2 - 0.5;
    return { dx: 0, dy: Math.abs(c - cx) * 3 + r * 2 };
  },
  // 3: Chevron rows (zigzag horizontal)
  (r, c) => ({ dx: (r % 2 === 0 ? 1 : -1) * (c % 3) * 3, dy: 0 }),
  // 4: V formation (pointed bottom)
  (r, c) => {
    const cx = ENEMY_COLS / 2 - 0.5;
    return { dx: (c - cx) * 2, dy: Math.abs(c - cx) * 3 + r * 2 };
  },
  // 5: Hourglass (narrow middle)
  (r, c) => {
    const cy = ENEMY_ROWS / 2 - 0.5;
    const narrowFactor = 1 - Math.abs(r - cy) * 0.25;
    const cx = ENEMY_COLS / 2 - 0.5;
    return { dx: (c - cx) * (1 - narrowFactor) * 4, dy: 0 };
  },
  // 6: Scattered (random-looking but deterministic)
  (r, c) => ({
    dx: (((r * 7 + c * 13) % 5) - 2) * 5,
    dy: (((r * 11 + c * 3) % 5) - 2) * 3,
  }),
  // 7: Invader silhouette (classic space invader shape)
  (r, c) => {
    // Row 0: narrow top (cols 3-6 only → skip others)
    // Row 1-2: wider
    // Row 3-4: arms extending
    const mask = [
      [0, 0, 0, 1, 1, 1, 1, 0, 0, 0], // boss row: 4 in center
      [0, 0, 1, 1, 1, 1, 1, 1, 0, 0], // bee row 1
      [1, 0, 1, 1, 1, 1, 1, 1, 0, 1], // bee row 2: arms
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // butterfly row 3
      [1, 0, 1, 0, 0, 0, 0, 1, 0, 1], // butterfly row 4: legs
    ];
    return mask[r] && mask[r][c] ? { dx: 0, dy: 0 } : { dx: 0, dy: 30, skip: true };
  },
];

// ============================================================
// ENTRY SEQUENCES — vuelos scriptados para los primeros 4 stages
// Cada secuencia define un grupo de enemigos con trayectoria de entrada.
// ============================================================
const ENTRY_SEQUENCES = [
  // Stage 1: Butterflies from left, Bees from right, Bosses from top
  [
    { type: 'butterfly', row: 3, startSide: 'left', cols: [0, 1, 2, 3, 4] },
    { type: 'butterfly', row: 4, startSide: 'right', cols: [5, 6, 7, 8, 9] },
    { type: 'bee', row: 1, startSide: 'left', cols: [0, 1, 2, 3, 4] },
    { type: 'bee', row: 2, startSide: 'right', cols: [5, 6, 7, 8, 9] },
    { type: 'boss', row: 0, startSide: 'top', cols: [3, 4, 5, 6] },
  ],
  // Stage 2: All from bottom, swooping up
  [
    { type: 'boss', row: 0, startSide: 'bottom', cols: [2, 3, 4, 5, 6, 7] },
    { type: 'bee', row: 1, startSide: 'bottom', cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
    { type: 'bee', row: 2, startSide: 'bottom', cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
    { type: 'butterfly', row: 3, startSide: 'bottom', cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
    { type: 'butterfly', row: 4, startSide: 'bottom', cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
  ],
  // Stage 3: Diagonal sweeps
  [
    { type: 'butterfly', row: 3, startSide: 'left', cols: [0, 1, 2, 3, 4] },
    { type: 'butterfly', row: 4, startSide: 'left', cols: [5, 6, 7, 8, 9] },
    { type: 'bee', row: 1, startSide: 'right', cols: [0, 1, 2, 3, 4] },
    { type: 'bee', row: 2, startSide: 'right', cols: [5, 6, 7, 8, 9] },
    { type: 'boss', row: 0, startSide: 'left', cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
  ],
  // Stage 4: Split groups from sides
  [
    { type: 'boss', row: 0, startSide: 'left', cols: [0, 1, 2, 3, 4] },
    { type: 'boss', row: 0, startSide: 'right', cols: [5, 6, 7, 8, 9] },
    { type: 'bee', row: 1, startSide: 'right', cols: [0, 1, 2, 3, 4] },
    { type: 'bee', row: 2, startSide: 'left', cols: [5, 6, 7, 8, 9] },
    { type: 'butterfly', row: 3, startSide: 'bottom', cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
    { type: 'butterfly', row: 4, startSide: 'bottom', cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
  ],
];

// ============================================================
// BONUS/CHALLENGE STAGE CONSTANTS
// ============================================================
const BONUS_EVERY = 5; // bonus stage every N waves
const BONUS_FLIGHT_SPEED = 160;
const BONUS_FLIGHT_INTERVAL = 0.4;
const BONUS_DURATION = 15; // seconds
const BONUS_ENEMY_COUNT = 40;

// ============================================================
// ESTADO
// ============================================================
const state = {
  running: false,
  gameOver: false,
  score: 0,
  lives: START_LIVES,
  wave: 1,
  best: loadBest('galaga2d'),
  invincibleTimer: 0,
  fireTimer: 0,
};

// ============================================================
// CANVAS
// ============================================================
const canvas = document.getElementById('gameCanvas'),
  ctx = canvas.getContext('2d', { alpha: false });
const { w: cw, h: ch, s: sc, x: ox, y: oy } = setupCanvas(canvas, ctx, CW, CH, CPAD);

// ============================================================
// SONIDO (usando shared/audio.js)
// ============================================================
function pFire() {
  beep({ freq: 900, freqEnd: 1400, duration: 0.04, type: 'square', volume: 0.08 });
}
function pExplode() {
  beep({ freq: 200, freqEnd: 40, duration: 0.2, type: 'sawtooth', volume: 0.18 });
}
function pDeath() {
  feedbackBundle('large', ship.x, SHIP_Y, {
    color: '#6ec6ff',
    noFlash: true,
    onBeep: () => beep({ freq: 400, freqEnd: 30, duration: 0.4, type: 'sawtooth', volume: 0.2 }),
  });
}
function pDive() {
  beep({ freq: 220, freqEnd: 400, duration: 0.1, type: 'triangle', volume: 0.1 });
}
function pBonus() {
  [660, 880, 1100, 1320].forEach((ff, i) =>
    setTimeout(() => beep({ freq: ff, duration: 0.08, type: 'triangle', volume: 0.14 }), i * 70),
  );
}
function pWave() {
  beep({ freq: 330, freqEnd: 660, duration: 0.12, type: 'triangle', volume: 0.12 });
}
function pBeam() {
  beep({ freq: 180, freqEnd: 520, duration: 0.5, type: 'sine', volume: 0.12 });
}
function pCapture() {
  beep({ freq: 600, freqEnd: 120, duration: 0.6, type: 'sawtooth', volume: 0.16 });
}
function pBonusStage() {
  [440, 550, 660, 880, 1100].forEach((ff, i) =>
    setTimeout(() => beep({ freq: ff, duration: 0.1, type: 'triangle', volume: 0.15 }), i * 80),
  );
}

// ============================================================
// PARTÍCULAS
// ============================================================

// ============================================================
// ENTIDADES
// ============================================================
const ship = { x: CW / 2, y: SHIP_Y };
let enemies = [],
  pBullets = [],
  eBullets = [];
let formationDir = 1,
  formationTimer = 0;
let diving = []; // enemies currently diving
let bonusActive = false,
  bonusTimer = 0;
let diveTimer = 0;
const diveInterval = 2.5;
let beam = null; // rayo tractor activo: { e, phase:'descend'|'beam', t }
let beamCooldown = 0;
let doubleShotActive = false; // permanente tras rescatar la nave capturada
let extraLivesGiven = 0; // track which thresholds have been given

// Entry sequence state
let entryState = null; // { groups: [...], groupIdx, spawnIdx, spawnTimer, active }

// Bonus stage state
let bonusStage = false;
let bonusFlighters = []; // enemies flying freely in bonus stage
let bonusFlightTimer = 0;
let bonusStageTimer = 0;
let bonusKills = 0;

// ============================================================
// FORMATION PATTERN HELPERS
// ============================================================
function getFormationPos(wave, row, col) {
  const baseX = (CW - (ENEMY_COLS * ENEMY_W + (ENEMY_COLS - 1) * ENEMY_GAP)) / 2 + ENEMY_W / 2;
  const baseY = 45;
  const x = baseX + col * (ENEMY_W + ENEMY_GAP);
  const y = baseY + row * (ENEMY_H + ENEMY_GAP);

  const patternIdx = (wave - 1) % FORMATION_PATTERNS.length;
  const patternFn = FORMATION_PATTERNS[patternIdx];
  if (!patternFn) return { x, y, skip: false };

  const offset = patternFn(row, col);
  return { x: x + (offset.dx || 0), y: y + (offset.dy || 0), skip: !!offset.skip };
}

function buildEnemies() {
  enemies = [];
  for (let r = 0; r < ENEMY_ROWS; r++) {
    const typeName = ROW_TYPE[r];
    const type = ENEMY_TYPES[typeName];
    for (let co = 0; co < ENEMY_COLS; co++) {
      const pos = getFormationPos(state.wave, r, co);
      if (pos.skip) continue; // pattern masks out this cell
      enemies.push({
        x: pos.x,
        y: pos.y,
        homeX: pos.x,
        homeY: pos.y,
        w: ENEMY_W,
        h: ENEMY_H,
        alive: true,
        row: r,
        col: co,
        type: typeName,
        hp: type.hp,
        color: type.color,
        color2: type.color2,
        points: type.points,
        diving: false,
        entering: false,
        entryProgress: 0,
        entryTarget: { x: pos.x, y: pos.y },
        entryStart: { x: 0, y: 0 },
      });
    }
  }
  diving = [];
  formationDir = 1;
  diveTimer = diveInterval;
  bonusActive = false;
  beam = null;
}

// ============================================================
// ENTRY SEQUENCE
// ============================================================
function startEntrySequence() {
  const seqIdx = (state.wave - 1) % ENTRY_SEQUENCES.length;
  const seq = ENTRY_SEQUENCES[seqIdx];
  entryState = {
    groups: seq.map((g) => ({
      type: g.type,
      row: g.row,
      startSide: g.startSide,
      cols: [...g.cols],
    })),
    groupIdx: 0,
    spawnIdx: 0,
    spawnTimer: 0,
    active: true,
    totalEnemies: seq.reduce((s, g) => s + g.cols.length, 0),
    spawned: 0,
  };
}

function getEntryStartPos(side) {
  switch (side) {
    case 'left':
      return { x: -40, y: CH * 0.3 + Math.random() * CH * 0.4 };
    case 'right':
      return { x: CW + 40, y: CH * 0.3 + Math.random() * CH * 0.4 };
    case 'top':
      return { x: CW * 0.3 + Math.random() * CW * 0.4, y: -40 };
    case 'bottom':
      return { x: CW * 0.2 + Math.random() * CW * 0.6, y: CH + 40 };
    default:
      return { x: CW / 2, y: -40 };
  }
}

function updateEntrySequence(dt) {
  if (!entryState || !entryState.active) return;

  entryState.spawnTimer += dt;
  if (entryState.spawnTimer < 0.12) return; // stagger spawns
  entryState.spawnTimer = 0;

  // Find next group with remaining cols
  while (
    entryState.groupIdx < entryState.groups.length &&
    entryState.spawnIdx >= entryState.groups[entryState.groupIdx].cols.length
  ) {
    entryState.groupIdx++;
    entryState.spawnIdx = 0;
  }

  if (entryState.groupIdx >= entryState.groups.length) {
    entryState.active = false;
    entryState = null;
    return;
  }

  const group = entryState.groups[entryState.groupIdx];
  const col = group.cols[entryState.spawnIdx];
  const typeName = group.type;
  const type = ENEMY_TYPES[typeName];
  const pos = getFormationPos(state.wave, group.row, col);
  const startPos = getEntryStartPos(group.startSide);

  const enemy = {
    x: startPos.x,
    y: startPos.y,
    homeX: pos.x,
    homeY: pos.y,
    w: ENEMY_W,
    h: ENEMY_H,
    alive: true,
    row: group.row,
    col: col,
    type: typeName,
    hp: type.hp,
    color: type.color,
    color2: type.color2,
    points: type.points,
    diving: false,
    entering: true,
    entryProgress: 0,
    entryTarget: { x: pos.x, y: pos.y },
    entryStart: { x: startPos.x, y: startPos.y },
    entrySpeed: 200 + Math.random() * 60,
  };

  // For bottom entry, arc upward to target
  if (group.startSide === 'bottom') {
    const midX = (startPos.x + pos.x) / 2 + (Math.random() - 0.5) * 200;
    const midY = Math.min(startPos.y, pos.y) - 100 - Math.random() * 100;
    enemy.entryMid = { x: midX, y: midY };
  }

  enemies.push(enemy);
  entryState.spawnIdx++;
  entryState.spawned++;

  // Check if all groups are done
  if (entryState.spawned >= entryState.totalEnemies) {
    entryState.active = false;
    entryState = null;
  }
}

function updateEnemyEntry(e, dt) {
  if (!e.entering) return;

  const target = e.entryTarget;
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 5) {
    e.x = target.x;
    e.y = target.y;
    e.entering = false;
    return;
  }

  // If we have a midpoint (bottom entry), use bezier-like movement
  if (e.entryMid) {
    const mid = e.entryMid;
    e.entryProgress += dt * 0.8;
    const t = Math.min(e.entryProgress, 1);
    // Quadratic bezier: (1-t)²·start + 2(1-t)t·mid + t²·end
    const t1 = (1 - t) * (1 - t);
    const t2 = 2 * (1 - t) * t;
    const t3 = t * t;
    e.x = t1 * e.entryStart.x + t2 * mid.x + t3 * target.x;
    e.y = t1 * e.entryStart.y + t2 * mid.y + t3 * target.y;
  } else {
    // Simple linear movement toward target
    const speed = e.entrySpeed || 200;
    e.x += (dx / dist) * speed * dt;
    e.y += (dy / dist) * speed * dt;
  }
}

// ============================================================
// BONUS/CHALLENGE STAGE
// ============================================================
function startBonusStage() {
  bonusStage = true;
  bonusFlighters = [];
  bonusFlightTimer = 0;
  bonusStageTimer = BONUS_DURATION;
  bonusKills = 0;

  // Spawn 40 enemies in waves from sides
  for (let i = 0; i < BONUS_ENEMY_COUNT; i++) {
    const typeName = ROW_TYPE[i % 5];
    const type = ENEMY_TYPES[typeName];
    const side = i % 2 === 0 ? 'left' : 'right';
    bonusFlighters.push({
      x: side === 'left' ? -40 - i * 15 : CW + 40 + i * 15,
      y: 60 + (i % 8) * 50 + Math.sin(i * 0.7) * 30,
      w: ENEMY_W,
      h: ENEMY_H,
      alive: true,
      type: typeName,
      hp: 1,
      color: type.color,
      color2: type.color2,
      points: type.points,
      vx: side === 'left' ? BONUS_FLIGHT_SPEED + i * 3 : -(BONUS_FLIGHT_SPEED + i * 3),
      vy: Math.sin(i * 1.3) * 40,
      dir: side === 'left' ? 1 : -1,
      phase: i * 0.3,
    });
  }

  pBonusStage();
  say('⭐ BONUS STAGE ⭐ ¡Derribá todo lo que puedas!');
}

function updateBonusStage(dt) {
  if (!bonusStage) return;

  bonusStageTimer -= dt;

  // Spawn enemies over time
  bonusFlightTimer += dt;
  const activeFlighters = bonusFlighters.filter((f) => f.alive);
  if (bonusFlightTimer > BONUS_FLIGHT_INTERVAL && activeFlighters.length < 12) {
    bonusFlightTimer = 0;
    // Activate next batch
    for (const f of bonusFlighters) {
      if (!f.alive) continue;
      if (f.x < -30 || f.x > CW + 30) {
        // Still off-screen, activate
        break;
      }
    }
  }

  // Update flighters
  for (const f of bonusFlighters) {
    if (!f.alive) continue;
    f.x += f.vx * dt;
    f.y += f.vy * dt + Math.sin(Date.now() / 400 + f.phase) * 20 * dt;

    // Wrap around vertically
    if (f.y < 30) f.vy = Math.abs(f.vy);
    if (f.y > SHIP_Y - 40) f.vy = -Math.abs(f.vy);

    // Remove if off-screen horizontally
    if ((f.dir === 1 && f.x > CW + 60) || (f.dir === -1 && f.x < -60)) {
      f.alive = false;
    }
  }

  // Check if bonus stage is over
  const remaining = bonusFlighters.filter((f) => f.alive).length;
  if (bonusStageTimer <= 0 || remaining === 0) {
    endBonusStage();
  }
}

function endBonusStage() {
  bonusStage = false;
  const bonus = bonusKills * 100;
  if (bonus > 0) {
    state.score += bonus;
    say(`⭐ Bonus: ${bonusKills} kills × 100 = ${bonus} pts ⭐`);
  } else {
    say('⭐ Bonus stage complete ⭐');
  }
  checkExtraLives();
  updateHUD();
  nextWave();
}

function checkBonusCollisions() {
  if (!bonusStage) return;

  for (let i = pBullets.length - 1; i >= 0; i--) {
    const b = pBullets[i];
    for (const f of bonusFlighters) {
      if (!f.alive) continue;
      if (Math.abs(b.x - f.x) < ENEMY_W / 2 && Math.abs(b.y - f.y) < ENEMY_H / 2) {
        f.alive = false;
        bonusKills++;
        state.score += f.points;
        pExplode();
        spawnParticles(f.x, f.y, f.color, 12, { spd: 80, life: 0.35 });
        pBullets.splice(i, 1);
        updateHUD();
        checkExtraLives();
        break;
      }
    }
  }
}

function resetGame() {
  state.score = 0;
  state.lives = START_LIVES;
  state.gameOver = false;
  state.wave = 1;
  state.invincibleTimer = 0;
  state.fireTimer = 0;
  state.running = false;
  ship.x = CW / 2;
  pBullets = [];
  eBullets = [];
  beamCooldown = 0;
  doubleShotActive = false;
  extraLivesGiven = 0;
  entryState = null;
  bonusStage = false;
  bonusFlighters = [];
  buildEnemies();
  document.getElementById('fs').style.display = 'none';
  updateHUD();
}

function startGame() {
  clearSquashes();
  ensureAudio();
  resetGame();
  state.running = true;
  achievements.incrementPlays('galaga');
  startAmbient();
  startMusic('galaga');
  document.getElementById('overlay').classList.add('hidden');
  shell.enableTabTrap();
  if (state.best >= 2000) achievements.unlock('galaga_twothousand');
  say('Galaga: comenzó la partida. Derribá a los enemigos en formación.');
}

function loseLife() {
  state.lives--;
  pDeath();
  spawnParticles(ship.x, SHIP_Y, '#6ec6ff', 20, { spd: 120, life: 0.6, smx: 5 });
  updateHUD();
  if (state.lives <= 0) {
    endGame();
    return;
  }
  state.invincibleTimer = 2;
  ship.x = CW / 2;
  doubleShotActive = false; // double shot lost on death

  pBullets = [];
  eBullets = [];
}

function endGame() {
  stopMusic();
  stopAmbient();
  state.running = false;
  state.gameOver = true;
  if (state.score > state.best) {
    state.best = state.score;
    saveBest('galaga2d', state.best);
  }
  const ot = document.getElementById('ot'),
    fs = document.getElementById('fs'),
    he = document.getElementById('he');
  ot.textContent = '💥 ¡Game Over!' + (state.score >= 5000 ? ' 🏆' : '');
  fs.style.display = 'block';
  fs.textContent = `Puntaje: ${state.score} · Récord: ${state.best}`;
  he.innerHTML = `<kbd>Espacio</kbd> / tocar para empezar · <kbd>R</kbd> reiniciar`;
  document.getElementById('overlay').classList.remove('hidden');
  shell.disableTabTrap();
  say('Galaga: game over.');
  updateHUD();
}

// ============================================================
// ENTRADA
// ============================================================
const input = { left: false, right: false, fire: false };

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    e.preventDefault();
    input.left = true;
  } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    input.right = true;
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
const bF = document.getElementById('bF');
bF?.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    bF.classList.add('is-pressed');
    if (!state.running) startGame();
    else input.fire = true;
  },
  { passive: false },
);
bF?.addEventListener(
  'touchend',
  (e) => {
    e.preventDefault();
    bF.classList.remove('is-pressed');
    input.fire = false;
  },
  { passive: false },
);
bF?.addEventListener('touchcancel', () => {
  bF.classList.remove('is-pressed');
  input.fire = false;
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
const gP = { f: false, s: false };

function pG() {
  const gp = gamepad.pad;
  if (!gp) return;
  const ax = gp.axes[0] ?? 0;
  input.left = ax < -0.4 || !!gp.buttons[14]?.pressed;
  input.right = ax > 0.4 || !!gp.buttons[15]?.pressed;
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
function updateFormation(dt) {
  if (bonusActive || bonusStage) return;
  const alive = enemies.filter((e) => e.alive && !e.diving && !e.entering);
  if (alive.length === 0 && (!entryState || !entryState.active)) {
    pBonus();
    nextWave();
    return;
  }

  // Side movement
  const speedMult = 1 + (ENEMY_COLS * ENEMY_ROWS - alive.length) * 0.025;
  formationTimer += dt * speedMult;
  const interval = 0.6;
  while (formationTimer >= interval) {
    formationTimer -= interval;
    let hitEdge = false;
    for (const e of enemies) {
      if (!e.alive || e.diving || e.entering) continue;
      e.x += formationDir * 8;
      if (e.x > CW - 30 || e.x < 30) hitEdge = true;
    }
    if (hitEdge) {
      formationDir *= -1;
      for (const e of enemies) {
        if (!e.alive || e.diving || e.entering) continue;
        e.y += 4;
      }
    }
  }

  // Dive timer
  diveTimer -= dt;
  if (diveTimer <= 0 && alive.length > 3) {
    startDive();
    diveTimer = Math.max(MIN_DIVE_INTERVAL, diveInterval - state.wave * DIVE_WAVE_REDUCTION);
  }

  if (beamCooldown > 0) beamCooldown -= dt;
}

function startDive() {
  const alive = enemies.filter((e) => e.alive && !e.diving && !e.entering);
  if (alive.length < 2) return;

  // Tractor beam: en oleadas pares un enemigo hace el picado especial
  if (
    !beam &&
    beamCooldown <= 0 &&
    state.wave % 2 === 0 &&
    state.invincibleTimer <= 0 &&
    !enemies.some((en) => en.hasCaptive)
  ) {
    const idx = Math.floor(Math.random() * alive.length);
    const e = alive[idx];
    e.diving = true;
    e.beam = true;
    e.beamX = Math.max(60, Math.min(CW - 60, ship.x)); // columna donde desplegará el haz
    beam = { e, phase: 'descend', t: 0 };
    diving.push(e);
    alive.splice(idx, 1);
    pDive();
    say('¡Rayo tractor entrante! Movete fuera del haz.');
    beamCooldown = BEAM_COOLDOWN;
    return;
  }

  const count = Math.min(MAX_DIVERS, Math.floor(alive.length / DIVERS_PER_GROUP));
  pDive();
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * alive.length);
    const e = alive[idx];
    e.diving = true;
    diving.push(e);
    alive.splice(idx, 1);
  }
}

// Vuelve a la formación tras terminar un picado (normal o de rayo)
function finishDive(e, i) {
  e.diving = false;
  e.beam = false;
  e.x = e.homeX;
  e.y = e.homeY;
  diving.splice(i, 1);
  // Add formation offset
  const alive = enemies.filter((en) => en.alive && !en.diving);
  if (alive.length > 0) {
    const avgY = alive.reduce((s, en) => s + en.homeY, 0) / alive.length;
    e.y = avgY + 20;
  }
}

function updateBeamDiver(e, dt, di) {
  const speed = 160 + state.wave * 6;
  if (beam.phase === 'descend') {
    e.x += Math.sign(e.beamX - e.x) * Math.min(Math.abs(e.beamX - e.x), speed * dt * 1.4);
    e.y += speed * dt;
    if (e.y >= BEAM_DESCENT_Y) {
      e.y = BEAM_DESCENT_Y;
      beam.phase = 'beam';
      beam.t = BEAM_TIME;
      pBeam();
    }
    return;
  }
  // Fase de haz: se balancea e intenta atrapar la nave
  beam.t -= dt;
  e.x += Math.sin(Date.now() / 300) * 18 * dt;
  if (state.invincibleTimer <= 0 && Math.abs(ship.x - e.x) < beamHalfWidth() * 0.75) {
    captureShip(e, di);
    return;
  }
  if (beam.t <= 0) {
    finishDive(e, di);
    beam = null;
  }
}

// El haz se expande y contrae mientras dura
function beamHalfWidth() {
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(((BEAM_TIME - beam.t) / BEAM_TIME) * Math.PI * 2));
  return BEAM_BASE_HALF_W * pulse;
}

function captureShip(e, i) {
  pCapture();
  feedbackBundle('large', ship.x, SHIP_Y, { color: '#6ee7b7' });
  spawnParticles(ship.x, SHIP_Y, '#6ec6ff', 16, { spd: 90, life: 0.5 });
  e.hasCaptive = true;
  state.lives--;
  updateHUD();
  beam = null;
  finishDive(e, i);
  say(
    state.lives > 0 ? '¡Nave capturada! Derribá al portador para rescatarla.' : '¡Nave capturada!',
  );
  if (state.lives <= 0) {
    endGame();
    return;
  }
  state.invincibleTimer = 2;
  ship.x = CW / 2;
  doubleShotActive = false; // double shot lost on death

  pBullets = [];
  eBullets = [];
}

function rescueShip(e) {
  state.score += SCORE_RESCUE;
  doubleShotActive = true;
  pBonus();
  spawnParticles(e.x, e.y, '#6ec6ff', 18, { spd: 110, life: 0.5 });
  say(`¡Nave rescatada! Doble disparo permanente (+${SCORE_RESCUE})`);
  updateHUD();
}

function updateDiving(dt) {
  for (let i = diving.length - 1; i >= 0; i--) {
    const e = diving[i];

    // Picado con rayo tractor: lógica propia
    if (e.beam) {
      updateBeamDiver(e, dt, i);
      continue;
    }

    const speed = 140 + state.wave * 8;

    // Sine-wave swoop
    const targetX = ship.x;
    const dx = targetX - e.x;
    e.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt * DIVE_SPEED_MULT);
    e.x += Math.sin(Date.now() / 200 + e.col) * 30 * dt;
    e.y += speed * dt;

    // Enemy shoots — frequency scales with wave
    if (Math.random() < 0.005 + state.wave * 0.001 && e.y > CH * 0.3) {
      eBullets.push({ x: e.x, y: e.y, vy: ENEMY_BULLET_SPEED });
    }

    // If reached bottom, return to formation
    if (e.y > SHIP_Y - 20) {
      // Collision with player
      if (state.invincibleTimer <= 0 && Math.abs(e.x - ship.x) < SHIP_W) {
        loseLife();
      }
      // Return to formation
      finishDive(e, i);
    }
  }
}

function checkExtraLives() {
  const thresholds = [10000, 30000, 60000];
  for (let i = extraLivesGiven; i < thresholds.length; i++) {
    if (state.score >= thresholds[i]) {
      state.lives++;
      extraLivesGiven = i + 1;
      say(`¡Vida extra! (${thresholds[i]} pts)`);
      spawnParticles(CW / 2, CH / 2, '#6ee7b7', 20, { spd: 100, life: 0.6 });
      updateHUD();
    }
  }
}

function nextWave() {
  state.wave++;
  if (state.wave >= 10) achievements.unlock('galaga_veteran');
  pWave();

  // Bonus stage every N waves
  if (state.wave % BONUS_EVERY === 0) {
    startBonusStage();
  } else {
    // Start entry sequence for first 4 waves, then instant spawn
    buildEnemies();
    if (state.wave <= ENTRY_SEQUENCES.length) {
      startEntrySequence();
    }
  }
  updateHUD();
}

function updatePlayer(dt) {
  if (state.invincibleTimer > 0) state.invincibleTimer -= dt;
  ship.x += (input.left ? -SHIP_SPEED * dt : 0) + (input.right ? SHIP_SPEED * dt : 0);
  ship.x = Math.max(SHIP_MARGIN, Math.min(CW - SHIP_MARGIN, ship.x));

  // Fire (doble disparo permanente tras rescatar la nave)
  if (state.fireTimer > 0) state.fireTimer -= dt;
  if (input.fire && state.fireTimer <= 0) {
    if (doubleShotActive) {
      pBullets.push({ x: ship.x - 8, y: ship.y - 15, vy: -BULLET_SPEED });
      pBullets.push({ x: ship.x + 8, y: ship.y - 15, vy: -BULLET_SPEED });
    } else {
      pBullets.push({ x: ship.x, y: ship.y - 15, vy: -BULLET_SPEED });
    }
    state.fireTimer = FIRE_CD;
    pFire();
  }
}

function updateBullets(dt) {
  // Player bullets
  for (let i = pBullets.length - 1; i >= 0; i--) {
    const b = pBullets[i];

    // Anti-tunneling: sub-pasos para balas rápidas
    const maxStep = BULLET_SPEED * dt;
    const minThickness = ENEMY_W * 0.5; // half enemy width
    if (maxStep > minThickness * 0.4) {
      const steps = Math.ceil(maxStep / (minThickness * 0.3));
      const subDt = dt / steps;
      let hit = false;
      for (let s = 0; s < steps && !hit; s++) {
        b.y += b.vy * subDt;
        if (b.y < 0) {
          pBullets.splice(i, 1);
          hit = true;
          break;
        }
        // Collision check in each sub-step
        for (const e of enemies) {
          if (!e.alive) continue;
          if (Math.abs(b.x - e.x) < ENEMY_W / 2 && Math.abs(b.y - e.y) < ENEMY_H / 2) {
            e.hp--;
            if (e.hp <= 0) {
              e.alive = false;
              if (e.type === 'boss') achievements.unlock('galaga_boss');
            }
            state.score += e.points;
            pExplode();
            spawnParticles(e.x, e.y, e.color, 12, { spd: 80, life: 0.35 });
            pBullets.splice(i, 1);
            hit = true;
            updateHUD();
            checkExtraLives();
            if (beam && beam.e === e) {
              state.score += SCORE_BEAM_KILL;
              say(`Rayo tractor interrumpido: +${SCORE_BEAM_KILL}`);
              beam = null;
              e.beam = false;
              updateHUD();
            }
            if (e.hasCaptive) {
              e.hasCaptive = false;
              rescueShip(e);
            }
            if (!e.alive) {
              const di = diving.indexOf(e);
              if (di >= 0) diving.splice(di, 1);
              if (enemies.filter((en) => en.alive).length === 0) {
                if (!bonusActive) {
                  pBonus();
                  nextWave();
                }
              }
            }
            break;
          }
        }
      }
    } else {
      b.y += b.vy * dt;
      if (b.y < 0) {
        pBullets.splice(i, 1);
        continue;
      }

      // Hit enemies
      let hit = false;
      for (const e of enemies) {
        if (!e.alive) continue;
        if (Math.abs(b.x - e.x) < ENEMY_W / 2 && Math.abs(b.y - e.y) < ENEMY_H / 2) {
          e.hp--;
          if (e.hp <= 0) {
            e.alive = false;
          }
          state.score += e.points;
          pExplode();
          spawnParticles(e.x, e.y, e.color, 12, { spd: 80, life: 0.35 });
          pBullets.splice(i, 1);
          hit = true;
          updateHUD();
          checkExtraLives();
          if (beam && beam.e === e) {
            state.score += SCORE_BEAM_KILL;
            say(`Rayo tractor interrumpido: +${SCORE_BEAM_KILL}`);
            beam = null;
            e.beam = false;
            updateHUD();
          }
          if (e.hasCaptive) {
            e.hasCaptive = false;
            rescueShip(e);
          }
          if (!e.alive) {
            const di = diving.indexOf(e);
            if (di >= 0) diving.splice(di, 1);
            if (enemies.filter((en) => en.alive).length === 0) {
              if (!bonusActive) {
                pBonus();
                nextWave();
              }
            }
          }
          break;
        }
      }
      if (hit) continue;
    }
  }

  // Enemy bullets
  for (let i = eBullets.length - 1; i >= 0; i--) {
    const b = eBullets[i];
    b.y += b.vy * dt;
    if (b.y > CH + 10) {
      eBullets.splice(i, 1);
      continue;
    }
    if (state.invincibleTimer <= 0 && Math.abs(b.x - ship.x) < 10 && Math.abs(b.y - SHIP_Y) < 15) {
      eBullets.splice(i, 1);
      loseLife();
      break;
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

  // Background
  const grad = ctx.createRadialGradient(
    cx + (CW * s) / 2,
    cy + (CH * s) / 2,
    0,
    cx + (CW * s) / 2,
    cy + (CH * s) / 2,
    CW * s * 0.7,
  );
  grad.addColorStop(0, '#0d1020');
  grad.addColorStop(1, '#0a0a14');
  ctx.fillStyle = grad;
  ctx.fillRect(cx, cy, CW * s, CH * s);

  // Stars
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let i = 0; i < 40; i++) {
    const x = (i * 89 + 31) % CW,
      y = (i * 143 + 67) % CH;
    ctx.beginPath();
    ctx.arc(cx + x * s, cy + y * s, (0.5 + (i % 2)) * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Border
  strokeWithGlow(
    ctx,
    () => ctx.strokeRect(cx, cy, CW * s, CH * s),
    'rgba(110,231,183,0.1)',
    1.5 * s,
    0.5,
    4,
  );

  // Bonus stage: draw flighters
  if (bonusStage) {
    for (const f of bonusFlighters) {
      if (!f.alive) continue;
      const fx = cx + f.x * s,
        fy = cy + f.y * s,
        fw = ENEMY_W * s,
        fh = ENEMY_H * s;
      ctx.fillStyle = f.color;
      drawEnemy(fx, fy, fw, fh, f.type);
      drawGlow(ctx, fx, fy, fw * 0.5, f.color, 0.12, 3);
    }
  }

  // Rayo tractor: línea telegráfica durante el descenso
  if (beam && beam.phase === 'descend') {
    const bx = cx + beam.e.beamX * s;
    ctx.strokeStyle = 'rgba(110,231,183,0.14)';
    ctx.lineWidth = 1 * s;
    ctx.setLineDash([6 * s, 6 * s]);
    ctx.beginPath();
    ctx.moveTo(bx, cy + (beam.e.y + ENEMY_H / 2) * s);
    ctx.lineTo(bx, cy + CH * s);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Rayo tractor desplegado: trapecio translúcido que se expande y contrae
  if (beam && beam.phase === 'beam') {
    const bx = cx + beam.e.x * s;
    const byTop = cy + (beam.e.y + ENEMY_H * 0.5) * s;
    const byBottom = cy + CH * s;
    const halfW = beamHalfWidth() * s;
    const alpha = 0.16 + 0.08 * Math.sin(Date.now() / 60);
    const bg = ctx.createLinearGradient(0, byTop, 0, byBottom);
    bg.addColorStop(0, `rgba(110,231,183,${Math.min(0.5, alpha + 0.25)})`);
    bg.addColorStop(1, 'rgba(110,231,183,0)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(bx - ENEMY_W * 0.3 * s, byTop);
    ctx.lineTo(bx + ENEMY_W * 0.3 * s, byTop);
    ctx.lineTo(bx + halfW, byBottom);
    ctx.lineTo(bx - halfW, byBottom);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(110,231,183,${Math.min(0.55, alpha + 0.3)})`;
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(bx - halfW, byBottom);
    ctx.lineTo(bx - ENEMY_W * 0.3 * s, byTop);
    ctx.moveTo(bx + ENEMY_W * 0.3 * s, byTop);
    ctx.lineTo(bx + halfW, byBottom);
    ctx.stroke();
  }

  // Enemies in formation (skip entering ones — they draw below)
  for (const e of enemies) {
    if (!e.alive || e.diving || e.entering) continue;
    const ex = cx + e.x * s,
      ey = cy + e.y * s,
      ew = ENEMY_W * s,
      eh = ENEMY_H * s;
    ctx.fillStyle = e.color;
    drawEnemy(ex, ey, ew, eh, e.type);
    drawGlow(ctx, ex, ey, ew * 0.5, e.color, 0.1, 3);
    if (e.hasCaptive) drawCapturedShip(ex, ey, ew, eh);
  }

  // Entering enemies (flying to formation)
  for (const e of enemies) {
    if (!e.alive || !e.entering) continue;
    const ex = cx + e.x * s,
      ey = cy + e.y * s,
      ew = ENEMY_W * s,
      eh = ENEMY_H * s;
    ctx.fillStyle = e.color;
    drawEnemy(ex, ey, ew, eh, e.type);
    drawGlow(ctx, ex, ey, ew * 0.7, e.color, 0.2, 4);
    // Trail effect during entry
    ctx.fillStyle = `rgba(${e.color === '#ff6b6b' ? '255,107,107' : e.color === '#ffe066' ? '255,224,102' : '110,231,183'},0.15)`;
    ctx.beginPath();
    ctx.arc(
      cx + (e.x - (e.entryTarget.x - e.x) * 0.1) * s,
      cy + (e.y - (e.entryTarget.y - e.y) * 0.1) * s,
      ew * 0.3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // Diving enemies
  for (const e of diving) {
    const ex = cx + e.x * s,
      ey = cy + e.y * s,
      ew = ENEMY_W * s,
      eh = ENEMY_H * s;
    ctx.fillStyle = e.color;
    drawEnemy(ex, ey, ew, eh, e.type);
    if (e.beam) drawGlow(ctx, ex, ey, ew * 0.9, '#6ee7b7', 0.2, 4);
    else drawGlow(ctx, ex, ey, ew * 0.6, e.color, 0.15, 3.5);
    if (e.hasCaptive) drawCapturedShip(ex, ey, ew, eh);
  }

  // Player bullets
  for (const b of pBullets) {
    const bx = cx + b.x * s,
      by = cy + b.y * s;
    ctx.fillStyle = '#ffdd88';
    ctx.fillRect(bx - 1.5 * s, by, 3 * s, 10 * s);
    drawGlow(ctx, bx, by, 3 * s, '#ffdd88', 0.12, 4);
  }

  // Enemy bullets
  for (const b of eBullets) {
    const bx = cx + b.x * s,
      by = cy + b.y * s;
    ctx.fillStyle = '#ff6666';
    ctx.beginPath();
    ctx.arc(bx, by, 2 * s, 0, Math.PI * 2);
    ctx.fill();
    drawGlow(ctx, bx, by, 2 * s, '#ff6666', 0.15, 4);
  }

  // Player ship
  if (!state.gameOver) {
    const blink = state.invincibleTimer > 0 && Math.floor(state.invincibleTimer * 8) % 2 === 0;
    if (!blink) {
      const sx = cx + ship.x * s,
        sy = cy + SHIP_Y * s;
      drawGlow(ctx, sx, sy, SHIP_W * s * 0.6, '#6ec6ff', 0.25, 3);
      drawPlayerShip(sx, sy, SHIP_W * s, SHIP_H * s);
    }
  }

  // Bonus stage HUD
  if (bonusStage) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `bold ${16 * s}px 'Courier New',monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `⭐ BONUS: ${bonusKills} kills | ${Math.max(0, Math.ceil(bonusStageTimer))}s`,
      cx + (CW * s) / 2,
      cy + 20 * s,
    );
  }

  // Bonus wave indicator (old system — when few enemies remain)
  if (bonusActive && !bonusStage) {
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.font = `${18 * s}px 'Courier New',monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⭐ BONUS ⭐', cx + (CW * s) / 2, cy + (CH * s) / 2);
  }

  // Formation pattern indicator (subtle)
  if (!bonusStage && state.wave > 1) {
    const patternIdx = (state.wave - 1) % FORMATION_PATTERNS.length;
    const patternNames = [
      'Classic',
      'Diamond',
      'Arrow',
      'Chevron',
      'V',
      'Hourglass',
      'Scattered',
      'Invader',
    ];
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.font = `${10 * s}px 'Courier New',monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(patternNames[patternIdx], cx + (CW - 10) * s, cy + 10 * s);
  }

  // Particles
  drawParticles(ctx, ox, oy, sc);
  ctx.restore();
}

function drawEnemy(x, y, w, h, typeName) {
  if (typeName === 'boss') {
    // Boss Galaga: larger body, crown-like top, 2 HP
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.1, w * 0.5, h * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    // Crown
    ctx.beginPath();
    ctx.moveTo(x - w * 0.3, y - h * 0.3);
    ctx.lineTo(x - w * 0.2, y - h * 0.5);
    ctx.lineTo(x - w * 0.1, y - h * 0.3);
    ctx.lineTo(x, y - h * 0.45);
    ctx.lineTo(x + w * 0.1, y - h * 0.3);
    ctx.lineTo(x + w * 0.2, y - h * 0.5);
    ctx.lineTo(x + w * 0.3, y - h * 0.3);
    ctx.closePath();
    ctx.fill();
    // Wings
    ctx.beginPath();
    ctx.moveTo(x - w * 0.45, y + h * 0.15);
    ctx.lineTo(x - w * 0.6, y + h * 0.55);
    ctx.lineTo(x - w * 0.25, y + h * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w * 0.45, y + h * 0.15);
    ctx.lineTo(x + w * 0.6, y + h * 0.55);
    ctx.lineTo(x + w * 0.25, y + h * 0.35);
    ctx.closePath();
    ctx.fill();
  } else if (typeName === 'bee') {
    // Bee: striped body, small wings
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.15, w * 0.4, h * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    // Stripes
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let si = -1; si <= 1; si++) {
      ctx.fillRect(x - w * 0.35, y + si * h * 0.2, w * 0.7, h * 0.08);
    }
    // Wings
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(x - w * 0.35, y - h * 0.1, w * 0.2, h * 0.3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + w * 0.35, y - h * 0.1, w * 0.2, h * 0.3, 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Butterfly: wide wings, antenna
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.15, w * 0.35, h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wings
    ctx.beginPath();
    ctx.moveTo(x - w * 0.3, y);
    ctx.quadraticCurveTo(x - w * 0.7, y - h * 0.3, x - w * 0.5, y + h * 0.4);
    ctx.lineTo(x - w * 0.2, y + h * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3, y);
    ctx.quadraticCurveTo(x + w * 0.7, y - h * 0.3, x + w * 0.5, y + h * 0.4);
    ctx.lineTo(x + w * 0.2, y + h * 0.15);
    ctx.closePath();
    ctx.fill();
    // Antenna
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.1, y - h * 0.2);
    ctx.lineTo(x - w * 0.15, y - h * 0.45);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w * 0.1, y - h * 0.2);
    ctx.lineTo(x + w * 0.15, y - h * 0.45);
    ctx.stroke();
  }
  // Eyes (common)
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(x - w * 0.12, y - h * 0.05, w * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + w * 0.12, y - h * 0.05, w * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(x - w * 0.12, y - h * 0.03, w * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + w * 0.12, y - h * 0.03, w * 0.04, 0, Math.PI * 2);
  ctx.fill();
}

// Nave capturada flotando junto a su portador
function drawCapturedShip(x, y, w, h) {
  const prevFill = ctx.fillStyle;
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#6ec6ff';
  drawPlayerShip(x, y - h * 1.05, w * 0.65, h * 0.65);
  ctx.globalAlpha = 1;
  ctx.fillStyle = prevFill;
}

function drawPlayerShip(x, y, w, h) {
  // Main body
  ctx.beginPath();
  ctx.moveTo(x, y - h / 2);
  ctx.lineTo(x - w / 2, y + h / 2);
  ctx.lineTo(x + w / 2, y + h / 2);
  ctx.closePath();
  ctx.fill();
  // Wings
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.1, y);
  ctx.lineTo(x - w * 0.7, y + h * 0.7);
  ctx.lineTo(x - w * 0.4, y + h * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.1, y);
  ctx.lineTo(x + w * 0.7, y + h * 0.7);
  ctx.lineTo(x + w * 0.4, y + h * 0.4);
  ctx.closePath();
  ctx.fill();
  // Cockpit
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.2);
  ctx.lineTo(x - w * 0.15, y + h * 0.1);
  ctx.lineTo(x + w * 0.15, y + h * 0.1);
  ctx.closePath();
  ctx.fill();
}

// ============================================================
// HUD
// ============================================================
const scoreEl = document.getElementById('scoreValue'),
  livesEl = document.getElementById('livesValue');
const waveEl = document.getElementById('waveValue'),
  bestEl = document.getElementById('bestValue');
function updateHUD() {
  scoreEl.textContent = String(state.score);
  livesEl.textContent =
    '●'.repeat(Math.max(0, state.lives)) + '○'.repeat(Math.max(0, START_LIVES - state.lives));
  waveEl.textContent = String(state.wave);
  bestEl.textContent = String(state.best);
}

// ============================================================
// MAIN LOOP
// ============================================================
const loop = createGameLoop((dt) => {
  pG();
  updateShake(dt);

  if (state.running && !state.gameOver) {
    if (bonusStage) {
      // Bonus stage: only player + flighter collision
      updatePlayer(dt);
      updateBonusStage(dt);
      checkBonusCollisions();
    } else {
      // Normal stage
      updateEntrySequence(dt);
      for (const e of enemies) {
        if (e.entering) updateEnemyEntry(e, dt);
      }
      updatePlayer(dt);
      updateFormation(dt);
      updateDiving(dt);
      updateBullets(dt);

      // Check for bonus state (when very few enemies left)
      const aliveCount = enemies.filter((e) => e.alive && !e.diving && !e.entering).length;
      if (aliveCount <= 3 && aliveCount > 0 && !bonusActive) {
        bonusActive = true;
        bonusTimer = 3;
      }
      if (bonusActive) {
        bonusTimer -= dt;
        if (bonusTimer <= 0) bonusActive = false;
      }
    }
  }

  updateSquashes(dt);
  updateParticles(dt);
  draw();
});

resetGame();
updateHUD();

shell.onCleanup(() => loop.stop());
document.getElementById('loading').classList.add('hidden');
loop.start();
