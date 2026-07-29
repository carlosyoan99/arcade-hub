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
  clearParticles,
} from '../../shared/effects.js';
document.documentElement.dataset.theme = localStorage.getItem('arcadehub_theme') || 'dark';

/* ============================================================
   CELL SWARM — Arcade Hub
   Agar.io-style battle royale de células con neón.
   ============================================================ */

// ============================================================
// CONSTANTES
// ============================================================
const WORLD_W = 5000;
const WORLD_H = 5000;
const FOOD_COUNT = 600;
const BOT_COUNT = 20;

const MASS_RADIUS_FACTOR = 4;
const BASE_SPEED = 300;
const MIN_MASS = 10;
const SPLIT_MIN_MASS = 36;
const EJECT_MIN_MASS = 16;
const SPLIT_DURATION = 5;
const EJECT_AMOUNT = 5;

const BOT_NAMES = [
  'Alpha',
  'Bravo',
  'Charlie',
  'Delta',
  'Echo',
  'Foxtrot',
  'Ghost',
  'Hawk',
  'Iris',
  'Jade',
  'Knight',
  'Luna',
  'Mystic',
  'Nova',
  'Omega',
  'Pixel',
  'Quantum',
  'Raven',
  'Storm',
  'Titan',
  'Viper',
  'Cobra',
  'Phoenix',
  'Nebula',
  'Cosmos',
  'Vortex',
  'Blaze',
  'Crystal',
  'Drift',
  'Ember',
];

const NEON_COLORS = [
  '#00f5ff',
  '#ff5e7a',
  '#ffd93d',
  '#c084fc',
  '#6ee7b7',
  '#ff8a65',
  '#7dd3fc',
  '#f472b6',
];

// ============================================================
// DOM REFS
// ============================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlayText');
const finalScoreEl = document.getElementById('finalScore');

const nameOverlay = document.getElementById('nameOverlay');
const nameInput = document.getElementById('nameInput');
const btnStart = document.getElementById('btnStart');

const massValueEl = document.getElementById('massValue');
const rankValueEl = document.getElementById('rankValue');
const lbEntriesEl = document.getElementById('lbEntries');

const btnSplit = document.getElementById('btnSplit');
const btnEject = document.getElementById('btnEject');

// ============================================================
// CANVAS SETUP
// ============================================================
let canvasW = 0,
  canvasH = 0;

function resizeCanvas() {
  canvasW = window.innerWidth;
  canvasH = window.innerHeight;
  canvas.width = canvasW;
  canvas.height = canvasH;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ============================================================
// ESTADO GLOBAL
// ============================================================
const state = {
  running: false,
  gameOver: false,
  playerName: '',
  targetX: canvasW / 2,
  targetY: canvasH / 2,
  bestMass: Number(localStorage.getItem('cellswarm_best') || 0),
};

// Camera
const cam = { x: 0, y: 0, zoom: 1, targetZoom: 1 };

// Entidades
let player = null;
let cells = []; // player cells (after split)
let foods = [];
let bots = [];
let ejected = []; // ejected mass blobs
let splitProjectiles = []; // split half-mass projectiles

// ============================================================
// SONIDO
// ============================================================
function sfxEat() {
  beep({ freq: 400, freqEnd: 600, duration: 0.06, type: 'sine', volume: 0.08 });
}
function sfxEatBig() {
  beep({ freq: 300, freqEnd: 700, duration: 0.1, type: 'triangle', volume: 0.1 });
  triggerShake(2);
}
function sfxSplit() {
  beep({ freq: 600, freqEnd: 1000, duration: 0.08, type: 'square', volume: 0.12 });
  triggerShake(3);
}
function sfxEject() {
  beep({ freq: 500, freqEnd: 300, duration: 0.05, type: 'sine', volume: 0.08 });
}
function sfxDeath() {
  beep({ freq: 400, freqEnd: 80, duration: 0.5, type: 'sawtooth', volume: 0.2 });
  triggerShake(8);
}
function sfxMerge() {
  beep({ freq: 500, freqEnd: 800, duration: 0.1, type: 'triangle', volume: 0.1 });
}

// ============================================================
// UTILIDADES
// ============================================================
function massToRadius(mass) {
  return Math.max(5, MASS_RADIUS_FACTOR * Math.sqrt(mass));
}

function rng(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function randColor() {
  return NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
}

function randWorldPos(margin) {
  margin = margin || 50;
  return { x: rng(margin, WORLD_W - margin), y: rng(margin, WORLD_H - margin) };
}

// ============================================================
// CÉLULA (JUGADOR)
// ============================================================
function createPlayerCell(x, y, mass) {
  return {
    x,
    y,
    mass: mass || MIN_MASS,
    radius: massToRadius(mass || MIN_MASS),
    vx: 0,
    vy: 0,
    color: '#00f5ff',
    name: state.playerName,
    isPlayer: true,
    mergeTimer: 0,
  };
}

// ============================================================
// SKIN SYSTEM
// ============================================================
const FLAG_SKINS = {
  argentina: ['#75aadb', '#ffffff', '#75aadb'],
  arg: ['#75aadb', '#ffffff', '#75aadb'],
  brasil: ['#009739', '#ffe11a', '#002776'],
  bra: ['#009739', '#ffe11a', '#002776'],
  usa: ['#b22234', '#ffffff', '#3c3b6e'],
  eeuu: ['#b22234', '#ffffff', '#3c3b6e'],
  france: ['#002395', '#ffffff', '#ed2939'],
  fra: ['#002395', '#ffffff', '#ed2939'],
  italy: ['#009246', '#ffffff', '#ce2b37'],
  ita: ['#009246', '#ffffff', '#ce2b37'],
  japan: ['#ffffff', '#bc002d', '#ffffff'],
  jpn: ['#ffffff', '#bc002d', '#ffffff'],
  uk: ['#012169', '#ffffff', '#c8102e'],
  gbr: ['#012169', '#ffffff', '#c8102e'],
  germany: ['#000000', '#dd0000', '#ffce00'],
  deu: ['#000000', '#dd0000', '#ffce00'],
  spain: ['#aa151b', '#f1bf00', '#aa151b'],
  esp: ['#aa151b', '#f1bf00', '#aa151b'],
  mexico: ['#006341', '#ffffff', '#ce1126'],
  mex: ['#006341', '#ffffff', '#ce1126'],
  colombia: ['#ce1126', '#003893', '#ffd100'],
  col: ['#ce1126', '#003893', '#ffd100'],
  canada: ['#ff0000', '#ffffff', '#ff0000'],
  can: ['#ff0000', '#ffffff', '#ff0000'],
  china: ['#de2910', '#ffde00', '#de2910'],
  chn: ['#de2910', '#ffde00', '#de2910'],
};

const GRADIENT_SKINS = {
  rainbow: { colors: ['#ff0000', '#ff8800', '#ffdd00', '#00dd00', '#0088ff', '#8800ff'] },
  aurora: { colors: ['#00ff88', '#00ddff', '#8800ff', '#ff00aa'] },
  sunset: { colors: ['#ff4400', '#ff8800', '#ffdd00', '#ff0088'] },
  ocean: { colors: ['#0044ff', '#0088ff', '#00ddff', '#00ffaa'] },
  fire: { colors: ['#ff0000', '#ff4400', '#ff8800', '#ffdd00'] },
  forest: { colors: ['#004400', '#008800', '#00cc00', '#44ff44'] },
  galaxy: { colors: ['#220044', '#6600aa', '#4400aa', '#0000aa'] },
  candy: { colors: ['#ff44aa', '#ff88cc', '#44ffaa', '#88ffcc'] },
};

const EMOJI_SKINS = {
  smile: '😊',
  heart: '❤️',
  alien: '👾',
  ghost: '👻',
  robot: '🤖',
  cat: '🐱',
  dog: '🐶',
  star: '⭐',
  moon: '🌙',
  sun: '☀️',
  skull: '💀',
  fire: '🔥',
  rainbow: '🌈',
  unicorn: '🦄',
  diamond: '💎',
  crown: '👑',
  lightning: '⚡',
  snow: '❄️',
  flower: '🌸',
  dragon: '🐉',
};

function getSkin(name) {
  const lower = name.toLowerCase();

  // Check flag skins
  for (const [key, colors] of Object.entries(FLAG_SKINS)) {
    if (lower === key || lower.includes(key)) {
      return { type: 'flag', color: colors[1], flagColors: colors };
    }
  }

  // Check emoji skins
  for (const [keyword, emoji] of Object.entries(EMOJI_SKINS)) {
    if (lower === keyword || lower.includes(keyword)) {
      return { type: 'emoji', color: '#ffd93d', emoji };
    }
  }

  // Check gradient skins (by exact name match)
  for (const [key, grad] of Object.entries(GRADIENT_SKINS)) {
    if (lower === key || lower.includes(key)) {
      return { type: 'gradient', color: grad.colors[0], gradColors: grad.colors };
    }
  }

  // Legacy special colors
  if (lower.includes('neon') || lower.includes('cyber') || lower.includes('glow')) {
    return { type: 'solid', color: '#00f5ff' };
  }
  if (lower.includes('gold') || lower.includes('star') || lower.includes('sun')) {
    return { type: 'solid', color: '#ffd93d' };
  }
  if (lower.includes('ghost') || lower.includes('shadow') || lower.includes('dark')) {
    return { type: 'solid', color: '#c084fc' };
  }
  if (lower.includes('fire') || lower.includes('blaze') || lower.includes('inferno')) {
    return { type: 'solid', color: '#ff5e7a' };
  }

  // Random neon
  return { type: 'solid', color: randColor() };
}

// ============================================================
// COMIDA
// ============================================================
function spawnFood() {
  const pos = randWorldPos(20);
  const color = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
  foods.push({
    x: pos.x,
    y: pos.y,
    mass: 1 + Math.random() * 2,
    color,
    radius: 4 + Math.random() * 3,
  });
}

function initFood() {
  foods = [];
  for (let i = 0; i < FOOD_COUNT; i++) spawnFood();
}

// ============================================================
// BOTS (IA)
// ============================================================
const BOT_STATE = { WANDER: 0, SEEK: 1, CHASE: 2, FLEE: 3, EVADE: 4 };

const BOT_PERSONALITIES = ['aggressive', 'timid', 'balanced', 'hunter', 'coward'];

const PERSONALITY_MODIFIERS = {
  aggressive: { chaseRange: 1.4, fleeRange: 0.7, chaseMassMin: 12, thresholdRatio: 1.1 },
  timid: { chaseRange: 0.6, fleeRange: 1.5, chaseMassMin: 30, thresholdRatio: 1.25 },
  balanced: { chaseRange: 1.0, fleeRange: 1.0, chaseMassMin: 20, thresholdRatio: 1.15 },
  hunter: { chaseRange: 1.6, fleeRange: 0.5, chaseMassMin: 8, thresholdRatio: 1.05 },
  coward: { chaseRange: 0.3, fleeRange: 1.8, chaseMassMin: 50, thresholdRatio: 1.35 },
};

function createBot() {
  const mass = rng(10, 60);
  const pos = randWorldPos(100);
  const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  const personality = BOT_PERSONALITIES[Math.floor(Math.random() * BOT_PERSONALITIES.length)];
  return {
    x: pos.x,
    y: pos.y,
    mass,
    radius: massToRadius(mass),
    vx: 0,
    vy: 0,
    color: randColor(),
    name,
    personality,
    isPlayer: false,
    targetX: pos.x,
    targetY: pos.y,
    state: BOT_STATE.WANDER,
    stateTimer: 0,
    aiTimer: 0,
    mergeTimer: 0,
  };
}

function initBots() {
  bots = [];
  for (let i = 0; i < BOT_COUNT; i++) bots.push(createBot());
}

function updateBotAI(bot, dt) {
  bot.aiTimer -= dt;
  if (bot.aiTimer > 0) return;
  bot.aiTimer = 0.3 + Math.random() * 0.4;

  const mod = PERSONALITY_MODIFIERS[bot.personality] || PERSONALITY_MODIFIERS.balanced;

  // Check for nearby split projectiles → evade!
  let nearestProj = null,
    ndProj = Infinity;
  for (const sp of splitProjectiles) {
    const d = dist(bot, sp);
    if (d < 200 && d < ndProj) {
      ndProj = d;
      nearestProj = sp;
    }
  }

  if (nearestProj && ndProj < 150) {
    // Dodge perpendicular to projectile direction
    bot.state = BOT_STATE.EVADE;
    const dx = nearestProj.vx;
    const dy = nearestProj.vy;
    // Perpendicular vector: (-dy, dx) or (dy, -dx)
    const perp = Math.random() > 0.5 ? 1 : -1;
    const evadeX = bot.x + -dy * perp * 300;
    const evadeY = bot.y + dx * perp * 300;
    bot.targetX = clamp(evadeX, 30, WORLD_W - 30);
    bot.targetY = clamp(evadeY, 30, WORLD_H - 30);
    return;
  }

  // Find nearest threats and prey (personality-adjusted)
  let nearestThreat = null,
    ndT = Infinity;
  let nearestPrey = null,
    ndP = Infinity;
  let nearestFood = null,
    ndF = Infinity;

  const allCells = [...(cells || []), ...bots];
  const threatRatio = mod.thresholdRatio || 1.15;
  const preyRatio = 1 / threatRatio;
  const baseChaseRange = 500 * mod.chaseRange;
  const baseFleeRange = 600 * mod.fleeRange;

  for (const other of allCells) {
    if (other === bot) continue;
    const d = dist(bot, other);
    const ratio = other.mass / bot.mass;

    if (ratio > threatRatio && d < baseFleeRange) {
      if (d < ndT) {
        ndT = d;
        nearestThreat = other;
      }
    } else if (ratio < preyRatio && d < baseChaseRange) {
      if (d < ndP) {
        ndP = d;
        nearestPrey = other;
      }
    }
  }

  // Nearest food
  for (const f of foods) {
    const d = dist(bot, f);
    if (d < ndF && d < 400) {
      ndF = d;
      nearestFood = f;
    }
  }

  // Decide action (personality-adjusted thresholds)
  const fleeDist = 350 * mod.fleeRange;
  const chaseDist = 300 * mod.chaseRange;

  if (nearestThreat && ndT < fleeDist) {
    bot.state = BOT_STATE.FLEE;
    const dx = bot.x - nearestThreat.x;
    const dy = bot.y - nearestThreat.y;
    const d = Math.hypot(dx, dy) || 1;
    bot.targetX = bot.x + (dx / d) * 300;
    bot.targetY = bot.y + (dy / d) * 300;
  } else if (nearestPrey && ndP < chaseDist && bot.mass > mod.chaseMassMin) {
    bot.state = BOT_STATE.CHASE;
    bot.targetX = nearestPrey.x;
    bot.targetY = nearestPrey.y;
  } else if (nearestFood) {
    bot.state = BOT_STATE.SEEK;
    bot.targetX = nearestFood.x;
    bot.targetY = nearestFood.y;
  } else {
    bot.state = BOT_STATE.WANDER;
    if (bot.stateTimer <= 0) {
      bot.targetX = clamp(bot.x + rng(-300, 300), 50, WORLD_W - 50);
      bot.targetY = clamp(bot.y + rng(-300, 300), 50, WORLD_H - 50);
      bot.stateTimer = 1.5 + Math.random() * 2;
    }
    bot.stateTimer -= dt;
  }

  // Clamp target
  bot.targetX = clamp(bot.targetX, 30, WORLD_W - 30);
  bot.targetY = clamp(bot.targetY, 30, WORLD_H - 30);
}

// ============================================================
// MOVIMIENTO
// ============================================================
function moveCell(cell, dt, targetX, targetY) {
  const speed = cell.isPlayer
    ? Math.max(60, (BASE_SPEED * 3) / Math.sqrt(cell.mass / 10))
    : Math.max(50, (BASE_SPEED * 2.5) / Math.sqrt(cell.mass / 10));

  const dx = targetX - cell.x;
  const dy = targetY - cell.y;
  const d = Math.hypot(dx, dy) || 1;

  if (d > 5) {
    const moveSpeed = Math.min(speed * dt, d * 0.9);
    cell.x += (dx / d) * moveSpeed;
    cell.y += (dy / d) * moveSpeed;
  }

  // World boundaries
  const rad = cell.radius || massToRadius(cell.mass);
  cell.x = clamp(cell.x, rad, WORLD_W - rad);
  cell.y = clamp(cell.y, rad, WORLD_H - rad);

  cell.radius = massToRadius(cell.mass);

  // Merge timer (for split cells)
  if (cell.mergeTimer > 0) cell.mergeTimer -= dt;
}

// ============================================================
// COLISIONES
// ============================================================
function checkEat(cell, other) {
  if (cell.mass < other.mass * 1.15) return false;
  const d = dist(cell, other);
  if (d < cell.radius - other.radius * 0.5) {
    return true;
  }
  return false;
}

function processEating() {
  // Bots eat food
  for (const bot of bots) {
    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i];
      if (dist(bot, f) < bot.radius) {
        bot.mass += f.mass;
        bot.radius = massToRadius(bot.mass);
        foods.splice(i, 1);
        spawnFood();
      }
    }
  }

  // Player cells eat food
  if (cells) {
    for (const c of cells) {
      for (let i = foods.length - 1; i >= 0; i--) {
        const f = foods[i];
        if (dist(c, f) < c.radius) {
          c.mass += f.mass;
          c.radius = massToRadius(c.mass);
          foods.splice(i, 1);
          spawnFood();
          sfxEat();
        }
      }
    }
  }

  // Player cells eat bots
  if (cells) {
    for (const c of cells) {
      for (let i = bots.length - 1; i >= 0; i--) {
        const bot = bots[i];
        if (checkEat(c, bot)) {
          c.mass += bot.mass * 0.8;
          c.radius = massToRadius(c.mass);
          sfxEatBig();
          spawnParticles(bot.x, bot.y, bot.color, 12, { spd: 100, life: 0.4 });
          bots.splice(i, 1);
          setTimeout(
            () => {
              if (!state.gameOver) bots.push(createBot());
            },
            2000 + Math.random() * 3000,
          );
        }
      }
    }
  }

  // Bots eat player cells
  for (const bot of bots) {
    if (!cells) continue;
    for (let i = cells.length - 1; i >= 0; i--) {
      const c = cells[i];
      if (checkEat(bot, c)) {
        bot.mass += c.mass * 0.8;
        bot.radius = massToRadius(bot.mass);
        cells.splice(i, 1);
        if (cells.length === 0) {
          endGame(bot.name);
          return;
        }
      }
    }
  }

  // Bots eat other bots
  for (let i = bots.length - 1; i >= 0; i--) {
    const a = bots[i];
    for (let j = bots.length - 1; j >= 0; j--) {
      if (i === j) continue;
      const b = bots[j];
      if (checkEat(a, b)) {
        a.mass += b.mass * 0.8;
        a.radius = massToRadius(a.mass);
        bots.splice(j, 1);
        setTimeout(
          () => {
            if (!state.gameOver) bots.push(createBot());
          },
          3000 + Math.random() * 4000,
        );
        if (j < i) i--;
      }
    }
  }

  // Ejected mass pickup
  for (let i = ejected.length - 1; i >= 0; i--) {
    const e = ejected[i];
    for (const c of [...(cells || []), ...bots]) {
      if (dist(c, e) < c.radius) {
        c.mass += e.mass;
        c.radius = massToRadius(c.mass);
        ejected.splice(i, 1);
        break;
      }
    }
  }

  // Split projectiles hit bots
  for (let pi = splitProjectiles.length - 1; pi >= 0; pi--) {
    const sp = splitProjectiles[pi];
    for (let bi = bots.length - 1; bi >= 0; bi--) {
      const bot = bots[bi];
      if (bot.mass < sp.mass * 1.15 && dist(sp, bot) < sp.radius + bot.radius) {
        sp.mass += bot.mass * 0.8;
        sp.radius = massToRadius(sp.mass);
        sfxEatBig();
        spawnParticles(bot.x, bot.y, bot.color, 8, { spd: 80, life: 0.3 });
        bots.splice(bi, 1);
        setTimeout(
          () => {
            if (!state.gameOver) bots.push(createBot());
          },
          2000 + Math.random() * 3000,
        );
      }
    }
  }
}

// ============================================================
// SPLIT / EYECTAR
// ============================================================
function doSplit() {
  if (!cells || cells.length >= 4) return;
  const main = cells[0];
  if (main.mass < SPLIT_MIN_MASS) return;

  const halfMass = main.mass / 2;
  main.mass = halfMass;
  main.radius = massToRadius(halfMass);
  main.mergeTimer = SPLIT_DURATION;

  // Convert screen target to world direction
  const spCx = canvasW / 2,
    spCy = canvasH / 2;
  const spWx = (state.targetX - spCx) / cam.zoom + cam.x;
  const spWy = (state.targetY - spCy) / cam.zoom + cam.y;
  const dx = spWx - main.x;
  const dy = spWy - main.y;
  const d = Math.hypot(dx, dy) || 1;

  splitProjectiles.push({
    x: main.x,
    y: main.y,
    mass: halfMass,
    radius: massToRadius(halfMass),
    vx: (dx / d) * 600,
    vy: (dy / d) * 600,
    color: main.color,
    life: 2.5,
    mergeTimer: SPLIT_DURATION,
  });

  sfxSplit();
  spawnParticles(main.x, main.y, main.color, 6, { spd: 60, life: 0.3 });
}

function doEject() {
  if (!cells || cells.length === 0) return;
  const main = cells[0];
  if (main.mass < EJECT_MIN_MASS + EJECT_AMOUNT) return;

  main.mass -= EJECT_AMOUNT;
  main.radius = massToRadius(main.mass);

  // Convert screen target to world direction
  const ejCx = canvasW / 2,
    ejCy = canvasH / 2;
  const ejWx = (state.targetX - ejCx) / cam.zoom + cam.x;
  const ejWy = (state.targetY - ejCy) / cam.zoom + cam.y;
  const dx = ejWx - main.x;
  const dy = ejWy - main.y;
  const d = Math.hypot(dx, dy) || 1;

  ejected.push({
    x: main.x + (dx / d) * main.radius,
    y: main.y + (dy / d) * main.radius,
    mass: EJECT_AMOUNT,
    radius: massToRadius(EJECT_AMOUNT),
    vx: (dx / d) * 250 + rng(-30, 30),
    vy: (dy / d) * 250 + rng(-30, 30),
    color: 'rgba(255,255,255,0.6)',
    life: 4,
  });

  sfxEject();
}

// ============================================================
// LÓGICA DE JUEGO
// ============================================================
function startGame() {
  ensureAudio();
  startAmbient();

  state.running = true;
  state.gameOver = false;
  overlay.classList.add('hidden');
  nameOverlay.classList.add('hidden');

  cells = [createPlayerCell(WORLD_W / 2 + rng(-200, 200), WORLD_H / 2 + rng(-200, 200), MIN_MASS)];
  player = cells[0];
  state.targetX = player.x;
  state.targetY = player.y;

  // ── SKIN SYSTEM ──
  const name = state.playerName.toLowerCase();
  const skin = getSkin(name);
  cells[0].color = skin.color;
  cells[0].skin = skin;

  // Gradient skins need extra data
  if (skin.type === 'gradient') {
    cells[0].skinGrad = skin;
  }

  initFood();
  initBots();
  splitProjectiles = [];
  ejected = [];

  cam.x = player.x;
  cam.y = player.y;
  cam.zoom = 1;

  achievements.incrementPlays('cell-swarm');
  updateHUD();
}

function endGame(killedBy) {
  state.running = false;
  state.gameOver = true;
  stopAmbient();

  let finalMass = 0;
  if (cells) for (const c of cells) finalMass += c.mass;
  if (finalMass > state.bestMass) {
    state.bestMass = Math.floor(finalMass);
    localStorage.setItem('cellswarm_best', String(state.bestMass));
  }

  sfxDeath();
  if (cells) {
    for (const c of cells) {
      spawnParticles(c.x, c.y, c.color, 20, { spd: 140, life: 0.6 });
    }
  }
  cells = [];

  overlayText.textContent = `☠ ${killedBy || 'Alguien'} te devoró ☠`;
  finalScoreEl.textContent = `Masa final: ${Math.floor(finalMass)} · Mejor: ${state.bestMass}`;
  overlay.classList.remove('hidden');
  updateHUD();
}

function resetGameState() {
  state.running = false;
  state.gameOver = false;
  nameOverlay.classList.remove('hidden');
  overlay.classList.add('hidden');
  cells = [];
  player = null;
  foods = [];
  bots = [];
  splitProjectiles = [];
  ejected = [];
  clearParticles();
}

// ============================================================
// ENTRADA
// ============================================================
// Mouse / touch target
canvas.addEventListener('mousemove', (e) => {
  if (state.running) {
    state.targetX = e.clientX;
    state.targetY = e.clientY;
  }
});

canvas.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    if (state.running) {
      const t = e.touches[0];
      state.targetX = t.clientX;
      state.targetY = t.clientY;
    }
  },
  { passive: false },
);

canvas.addEventListener(
  'touchmove',
  (e) => {
    e.preventDefault();
    if (state.running) {
      const t = e.touches[0];
      state.targetX = t.clientX;
      state.targetY = t.clientY;
    }
  },
  { passive: false },
);

// Keyboard
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && state.gameOver) {
    e.preventDefault();
    resetGameState();
  }
  if (e.code === 'Space' && state.running) {
    e.preventDefault();
    doSplit();
  }
  if (e.code === 'KeyE' && state.running) {
    e.preventDefault();
    doEject();
  }
});

// Buttons
btnSplit.addEventListener('click', doSplit);
btnEject.addEventListener('click', doEject);

// Touch controls
const tcSplit = document.getElementById('tcSplit');
const tcEject = document.getElementById('tcEject');

tcSplit.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    tcSplit.classList.add('is-pressed');
    doSplit();
  },
  { passive: false },
);
tcSplit.addEventListener('touchend', (e) => {
  e.preventDefault();
  tcSplit.classList.remove('is-pressed');
});
tcSplit.addEventListener('touchcancel', () => tcSplit.classList.remove('is-pressed'));

tcEject.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    tcEject.classList.add('is-pressed');
    doEject();
  },
  { passive: false },
);
tcEject.addEventListener('touchend', (e) => {
  e.preventDefault();
  tcEject.classList.remove('is-pressed');
});
tcEject.addEventListener('touchcancel', () => tcEject.classList.remove('is-pressed'));

// Gamepad
let gamepadIndex = null;
let prevBtn0 = false;
let prevBtn1 = false;

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

  // Left stick → target
  const lx = gp.axes[0] || 0;
  const ly = gp.axes[1] || 0;
  if (Math.abs(lx) > 0.15 || Math.abs(ly) > 0.15) {
    state.targetX += lx * 8;
    state.targetY += ly * 8;
  }

  const btnA = !!gp.buttons[0]?.pressed;
  const btnB = !!gp.buttons[1]?.pressed;

  if (btnA && !prevBtn0 && state.running) doSplit();
  if (btnB && !prevBtn1 && state.running) doEject();
  if (btnA && !prevBtn0 && !state.running && state.gameOver) resetGameState();

  prevBtn0 = btnA;
  prevBtn1 = btnB;
}

// Name entry
btnStart.addEventListener('click', () => {
  const name = nameInput.value.trim() || 'Cell';
  state.playerName = name.substring(0, 15);
  startGame();
});

nameInput.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') {
    const name = nameInput.value.trim() || 'Cell';
    state.playerName = name.substring(0, 15);
    startGame();
  }
});

// Overlay click (game over → restart)
overlay.addEventListener('click', () => {
  if (state.gameOver) resetGameState();
});

// ============================================================
// CÁMARA
// ============================================================
function updateCamera(dt) {
  if (!cells || cells.length === 0) return;

  let cx = 0,
    cy = 0,
    totalMass = 0;
  for (const c of cells) {
    cx += c.x * c.mass;
    cy += c.y * c.mass;
    totalMass += c.mass;
  }
  cx /= totalMass;
  cy /= totalMass;

  const lerp = 1 - Math.pow(0.01, dt);
  cam.x += (cx - cam.x) * lerp;
  cam.y += (cy - cam.y) * lerp;

  cam.targetZoom = clamp(40 / Math.sqrt(totalMass), 0.25, 1.2);
  cam.zoom += (cam.targetZoom - cam.zoom) * lerp;
}

function worldToScreen(wx, wy) {
  return {
    x: (wx - cam.x) * cam.zoom + canvasW / 2,
    y: (wy - cam.y) * cam.zoom + canvasH / 2,
  };
}

// ============================================================
// ACTUALIZACIÓN
// ============================================================
function update(dt, worldTx, worldTy) {
  if (!state.running || state.gameOver) return;

  // Move player cells using world coordinates
  if (cells) {
    for (const c of cells) {
      moveCell(c, dt, worldTx, worldTy);
    }
  }

  // Move bots
  for (const bot of bots) {
    updateBotAI(bot, dt);
    moveCell(bot, dt, bot.targetX, bot.targetY);
  }

  // Move split projectiles
  for (let i = splitProjectiles.length - 1; i >= 0; i--) {
    const sp = splitProjectiles[i];
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    sp.vx *= 0.98;
    sp.vy *= 0.98;
    sp.life -= dt;
    sp.mergeTimer -= dt;

    // Clamp to world
    sp.x = clamp(sp.x, sp.radius, WORLD_W - sp.radius);
    sp.y = clamp(sp.y, sp.radius, WORLD_H - sp.radius);

    // Return to player when timer expires
    if (sp.mergeTimer <= 0 || sp.life <= 0) {
      if (cells && cells.length > 0) {
        cells[0].mass += sp.mass;
        cells[0].radius = massToRadius(cells[0].mass);
        sfxMerge();
      }
      splitProjectiles.splice(i, 1);
    }
  }

  // Move ejected mass
  for (let i = ejected.length - 1; i >= 0; i--) {
    const e = ejected[i];
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.vx *= 0.96;
    e.vy *= 0.96;
    e.life -= dt;
    if (e.life <= 0) {
      ejected.splice(i, 1);
      continue;
    }
    e.x = clamp(e.x, 5, WORLD_W - 5);
    e.y = clamp(e.y, 5, WORLD_H - 5);
  }

  processEating();
  updateCamera(dt);
  updateHUD();
}

// ============================================================
// RENDER
// ============================================================
function draw() {
  ctx.clearRect(0, 0, canvasW, canvasH);

  // Fondo oscuro
  ctx.fillStyle = '#08081a';
  ctx.fillRect(0, 0, canvasW, canvasH);

  const so = getShakeOffset();
  ctx.save();
  ctx.translate(so.x, so.y);

  // Grid
  const gridSize = 80 * cam.zoom;
  const startX = ((-cam.x * cam.zoom + canvasW / 2) % gridSize) - gridSize;
  const startY = ((-cam.y * cam.zoom + canvasH / 2) % gridSize) - gridSize;
  const extraCols = Math.ceil(canvasW / gridSize) + 2;
  const extraRows = Math.ceil(canvasH / gridSize) + 2;

  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let col = 0; col < extraCols; col++) {
    const x = startX + col * gridSize;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasH);
    ctx.stroke();
  }
  for (let row = 0; row < extraRows; row++) {
    const y = startY + row * gridSize;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasW, y);
    ctx.stroke();
  }

  // Ejected mass
  for (const e of ejected) {
    const s = worldToScreen(e.x, e.y);
    const r = e.radius * cam.zoom;
    if (s.x < -50 || s.x > canvasW + 50 || s.y < -50 || s.y > canvasH + 50) continue;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, Math.max(2, r), 0, Math.PI * 2);
    ctx.fill();
  }

  // Food
  for (const f of foods) {
    const s = worldToScreen(f.x, f.y);
    const r = f.radius * cam.zoom;
    if (s.x < -10 || s.x > canvasW + 10 || s.y < -10 || s.y > canvasH + 10) continue;

    ctx.shadowColor = f.color;
    ctx.shadowBlur = 6 * cam.zoom;
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, Math.max(1.5, r), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Bots
  for (const bot of bots) {
    drawCell(bot);
  }

  // Split projectiles
  for (const sp of splitProjectiles) {
    drawCell(sp);
  }

  // Player cells
  if (cells) {
    for (const c of cells) {
      drawCell(c);
    }
  }

  // World border
  const borderTL = worldToScreen(0, 0);
  const borderBR = worldToScreen(WORLD_W, WORLD_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  ctx.strokeRect(borderTL.x, borderTL.y, borderBR.x - borderTL.x, borderBR.y - borderTL.y);

  drawParticles(ctx, 0, 0, 1);

  ctx.restore();
}

function drawCell(cell) {
  const s = worldToScreen(cell.x, cell.y);
  const r = cell.radius * cam.zoom;
  if (s.x < -100 || s.x > canvasW + 100 || s.y < -100 || s.y > canvasH + 100) return;

  const isPlayer = cell.isPlayer;
  const skin = cell.skin || {};
  const skinType = skin.type || 'solid';

  // Glow outer
  ctx.shadowColor = cell.color;
  ctx.shadowBlur = isPlayer ? 20 * cam.zoom : 8 * cam.zoom;

  // ── Cell body ──
  if (skinType === 'gradient' && skin.gradColors && r > 12) {
    const gColors = skin.gradColors;
    const gGrad = ctx.createRadialGradient(s.x - r * 0.3, s.y - r * 0.3, 0, s.x, s.y, r);
    for (let gi = 0; gi < gColors.length; gi++) {
      gGrad.addColorStop(gi / (gColors.length - 1), gColors[gi]);
    }
    ctx.fillStyle = gGrad;
  } else if (skinType === 'flag' && skin.flagColors && r > 14) {
    // Draw horizontal stripes
    const fCols = skin.flagColors;
    const stripeH = (r * 2) / fCols.length;
    ctx.save();
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.clip();
    for (let fi = 0; fi < fCols.length; fi++) {
      ctx.fillStyle = fCols[fi];
      ctx.fillRect(s.x - r, s.y - r + fi * stripeH, r * 2, stripeH + 1);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = cell.color;
  }

  // Draw circle body (unless flag did it via clip)
  if (skinType !== 'flag' || !skin.flagColors || r <= 14) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Inner highlight overlay
  ctx.shadowBlur = 0;
  const hiGrad = ctx.createRadialGradient(s.x - r * 0.3, s.y - r * 0.3, 0, s.x, s.y, r);
  hiGrad.addColorStop(0, 'rgba(255,255,255,0.25)');
  hiGrad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
  hiGrad.addColorStop(1, 'rgba(0,0,0,0.1)');
  ctx.fillStyle = hiGrad;
  ctx.beginPath();
  ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
  ctx.fill();

  // ── Name & emoji label ──
  if (r > 8) {
    const fontSize = Math.max(10, Math.min(r * 0.5, 30));

    if (skinType === 'emoji' && skin.emoji && r > 14) {
      // Render emoji instead of name
      const emojiSize = Math.max(12, Math.min(r * 0.55, 40));
      ctx.font = `${emojiSize}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(skin.emoji, s.x, s.y - 2);
    } else {
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Text shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillText(cell.name, s.x + 1, s.y + 1);

      ctx.fillStyle = '#fff';
      ctx.fillText(cell.name, s.x, s.y);
    }

    // Mass label (smaller, below name)
    if (r > 14) {
      const massFontSize = Math.max(8, Math.min(r * 0.3, 16));
      ctx.font = `${massFontSize}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText(
        Math.floor(cell.mass),
        s.x,
        s.y + (skinType === 'emoji' ? fontSize * 1.4 : fontSize * 1.1),
      );
    }
  }

  ctx.shadowBlur = 0;
}

// ============================================================
// HUD
// ============================================================
function updateHUD() {
  let totalMass = 0;
  if (cells) for (const c of cells) totalMass += c.mass;
  massValueEl.textContent = Math.floor(totalMass);

  // Compute rank
  const all = [...(bots || [])];
  if (cells) for (const c of cells) all.push({ mass: c.mass, isPlayer: true });
  all.sort((a, b) => b.mass - a.mass);
  const playerRank = all.findIndex((e) => e.isPlayer);
  rankValueEl.textContent = playerRank >= 0 ? `#${playerRank + 1}` : '—';

  // Leaderboard
  const top10 = all.slice(0, 10);
  let html = '';
  for (let i = 0; i < top10.length; i++) {
    const entry = top10[i];
    const isPlayer = entry.isPlayer;
    const name = isPlayer ? state.playerName : entry.name || '???';
    html += `<div class="lb-entry${isPlayer ? ' is-player' : ''}">
      <span class="lb-rank">${i + 1}</span>
      <span class="lb-name">${name}</span>
      <span class="lb-mass">${Math.floor(entry.mass)}</span>
    </div>`;
  }
  lbEntriesEl.innerHTML = html;
}

// ============================================================
// BUCLE PRINCIPAL
// ============================================================
let animFrameId = null;
let lastTime = 0;

function tick(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  pollGamepad();
  updateShake(dt);

  if (state.running && !state.gameOver) {
    // Convert screen target to world coordinates
    const cx = canvasW / 2,
      cy = canvasH / 2;
    const worldTx = (state.targetX - cx) / cam.zoom + cam.x;
    const worldTy = (state.targetY - cy) / cam.zoom + cam.y;
    update(dt, worldTx, worldTy);
  }

  updateParticles(dt);
  draw();
  animFrameId = requestAnimationFrame(tick);
}

// ── Init ──
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
document.getElementById('helpBtn')?.addEventListener('click', () => showHelp('cell-swarm'));
