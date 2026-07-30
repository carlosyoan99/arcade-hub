import { showHelp } from '../../shared/help.js';
import { ensureAudio, beep, startAmbient, stopAmbient, closeAudio } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements } from '../../shared/dom.js';
import { setupCanvas } from '../../shared/display.js';
import { createGameLoop } from '../../shared/loop.js';
import {
  updateShake,
  getShakeOffset,
  roundRect,
  spawnParticles,
  updateParticles,
  drawParticles,
  clearParticles,
  drawGlow,
  feedbackBundle,
  triggerSquash,
  updateSquashes,
  clearSquashes,
} from '../../shared/effects.js';
document.documentElement.dataset.theme = localStorage.getItem('arcadehub_theme') || 'dark';

/* ============================================================
   NEON NEXUS — Arcade Hub
   Tower defense roguelike con geometría neon.
   ============================================================ */

// ============================================================
// CONSTANTES
// ============================================================
const ARENA_R = 340;
const TOWER_R = 28;
const TOWER_CX = 400;
const TOWER_CY = 400;
const ATTRACTION_R = 120;
const PROJECTILE_SPEED = 550;
const CLICK_CD = 0.18;
const WAVE_PAUSE = 2;

const ENEMY_TYPES = {
  triangle: {
    r: 10,
    hp: 20,
    speed: 65,
    color: '#ff5e7a',
    glow: 'rgba(255,94,122,0.4)',
    sides: 3,
    reward: 1,
  },
  square: {
    r: 13,
    hp: 40,
    speed: 50,
    color: '#ffd93d',
    glow: 'rgba(255,217,61,0.4)',
    sides: 4,
    reward: 2,
  },
  diamond: {
    r: 15,
    hp: 70,
    speed: 38,
    color: '#c084fc',
    glow: 'rgba(192,132,252,0.4)',
    sides: 4,
    reward: 3,
  },
  hexagon: {
    r: 18,
    hp: 150,
    speed: 30,
    color: '#00f5ff',
    glow: 'rgba(0,245,255,0.5)',
    sides: 6,
    reward: 5,
  },
};

const CARD_POOL = [
  { id: 'chain', name: '⚡ Cadena', desc: 'Proyectiles encadenan a +1 enemigo', rarity: 'common' },
  { id: 'vampire', name: '🩸 Vampirismo', desc: 'Cura 15% del daño infligido', rarity: 'rare' },
  {
    id: 'multishot',
    name: '🔱 +1 Proyectil',
    desc: 'Apunta a enemigos distintos o al azar',
    rarity: 'common',
  },
  { id: 'aoe', name: '💥 Explosión', desc: 'Proyectiles explotan en área (60px)', rarity: 'epic' },
  {
    id: 'iceShield',
    name: '❄️ Escudo Helado',
    desc: '25% de congelar al recibir daño',
    rarity: 'common',
  },
  { id: 'atkSpd', name: '⚡ Cargador', desc: '+40% velocidad de disparo', rarity: 'common' },
  { id: 'atkUp', name: '🔫 Cañón', desc: '+40% daño de torre', rarity: 'common' },
  { id: 'regen', name: '💚 Regeneración', desc: '+3 PV/s', rarity: 'rare' },
  { id: 'magnet', name: '🧲 Imán', desc: 'Dobla rango de atracción', rarity: 'common' },
  { id: 'thorns', name: '🛡️ Púas', desc: 'Refleja 25% daño recibido', rarity: 'rare' },
  { id: 'drain', name: '💧 Drenar', desc: 'Drena 4% PV/s del enemigo más cercano', rarity: 'rare' },
  {
    id: 'turret',
    name: '🔧 Torreta Auxiliar',
    desc: 'Torreta extra que dispara sola',
    rarity: 'epic',
  },
  {
    id: 'regenShield',
    name: '🛡️ Escudo Regenerativo',
    desc: 'Escudo se regenera 4/s tras 2s sin daño',
    rarity: 'rare',
  },
  {
    id: 'globalSlow',
    name: '🌀 Ralentización Global',
    desc: 'Ralentiza 25% a todos los enemigos',
    rarity: 'common',
  },
];

const SHOP_ITEMS = [
  { id: 'maxHP', name: '❤️ +20 HP Base', baseCost: 15, maxLevel: 5 },
  { id: 'atkBonus', name: '⚔️ +3 ATK Base', baseCost: 15, maxLevel: 5 },
  { id: 'startShield', name: '🛡️ Escudo Inicial', baseCost: 25, maxLevel: 1 },
  { id: 'regenBonus', name: '💚 Regen +1 HP/s', baseCost: 30, maxLevel: 3 },
];

const SHOP_KEY = 'neonNexus_';

// ============================================================
// DOM REFS
// ============================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlayText');
const hintEl = document.getElementById('hintEl');
const finalScoreEl = document.getElementById('finalScore');

const cardOverlay = document.getElementById('cardOverlay');
const cardEls = document.querySelectorAll('.card');

const shopOverlay = document.getElementById('shopOverlay');
const shopCoinsEl = document.getElementById('shopCoins');
const shopItemsEl = document.getElementById('shopItems');

const waveValEl = document.getElementById('waveValue');
const hpBarEl = document.getElementById('hpBar');
const hpTextEl = document.getElementById('hpText');
const starsValEl = document.getElementById('starsValue');
const coinsValEl = document.getElementById('coinsValue');
const upgAtkCostEl = document.getElementById('upgAtkCost');
const upgHpCostEl = document.getElementById('upgHpCost');
const upgSpdCostEl = document.getElementById('upgSpdCost');
const cardBadgeEl = document.getElementById('cardBadge');

// ============================================================
// CANVAS SETUP
// ============================================================
const {
  w: canvasW,
  h: canvasH,
  s: scale,
  x: offX,
  y: offY,
} = setupCanvas(canvas, ctx, 800, 800, 20);

// ============================================================
// SONIDO
// ============================================================
function sfxShoot() {
  beep({ freq: 800, freqEnd: 1200, duration: 0.04, type: 'sine', volume: 0.08 });
}
function sfxHit() {
  beep({ freq: 300, freqEnd: 100, duration: 0.06, type: 'square', volume: 0.1 });
}
function sfxKill() {
  beep({ freq: 600, freqEnd: 900, duration: 0.08, type: 'triangle', volume: 0.12 });
}
function sfxTowerHit() {
  feedbackBundle('medium', GAME_W / 2, GAME_H / 2, {
    color: '#ff4444',
    onBeep: () => beep({ freq: 150, freqEnd: 60, duration: 0.2, type: 'sawtooth', volume: 0.15 }),
  });
}
function sfxClickHit() {
  beep({ freq: 700, freqEnd: 1000, duration: 0.05, type: 'sine', volume: 0.1 });
}
function sfxWaveClear() {
  feedbackBundle('medium', GAME_W / 2, GAME_H / 2, {
    color: '#ffb800',
    noFlash: true,
    onBeep: () => {},
  });
  [660, 880, 1100].forEach((f, i) =>
    setTimeout(() => beep({ freq: f, duration: 0.1, type: 'triangle', volume: 0.14 }), i * 80),
  );
}
function sfxCardPick() {
  beep({ freq: 500, freqEnd: 1200, duration: 0.15, type: 'triangle', volume: 0.16 });
}
function sfxUpgrade() {
  beep({ freq: 400, freqEnd: 700, duration: 0.1, type: 'square', volume: 0.12 });
}
function sfxGameOver() {
  [440, 330, 220].forEach((f, i) =>
    setTimeout(() => beep({ freq: f, duration: 0.25, type: 'sawtooth', volume: 0.18 }), i * 150),
  );
}

// ============================================================
// ESTADO
// ============================================================
const state = {
  running: false,
  gameOver: false,
  wave: 0,
  enemiesSpawned: 0,
  spawnTimer: 0,
  spawnInterval: 0.6,
  cleared: false,
  clearTimer: 0,
  stars: 0,
  coins: Number(localStorage.getItem('neonNexus_coins') || 0),
  best: Number(localStorage.getItem('neonNexus_best') || 0),

  towerHP: 100,
  towerMaxHP: 100,
  towerATK: 10,
  towerFireTimer: 0,
  fireRate: 1.5,
  shieldHP: 0,

  // In-battle upgrade levels (persist across card picks)
  atkLevel: 0,
  spdLevel: 0,

  upgCost: { atk: 10, hp: 10, spd: 15 },
  clickTimer: 0,

  perm: {},
  cards: {},
  offeredCards: [],
};

const tower = { x: TOWER_CX, y: TOWER_CY, glowPhase: 0, pulsePhase: 0 };
let enemies = [];
let projectiles = [];
let resources = [];

// ============================================================
// CARGA PERMANENTE
// ============================================================
function loadPerm() {
  state.perm = {
    maxHP: Number(localStorage.getItem(SHOP_KEY + 'perm_hp') || 0),
    atkBonus: Number(localStorage.getItem(SHOP_KEY + 'perm_atk') || 0),
    startShield: Number(localStorage.getItem(SHOP_KEY + 'perm_shield') || 0),
    regenBonus: Number(localStorage.getItem(SHOP_KEY + 'perm_regen') || 0),
  };
  state.cards = {
    chain: false,
    vampire: false,
    multishot: 0,
    aoe: false,
    iceShield: false,
    atkSpd: 0,
    atkUp: 0,
    regen: 0,
    magnet: 0,
    thorns: 0,
    drain: false,
    turret: false,
    regenShield: false,
    globalSlow: 0,
  };
}

function savePerm(id, val) {
  localStorage.setItem(SHOP_KEY + 'perm_' + id, String(val));
}

function calcTowerStats() {
  const p = state.perm;
  state.towerMaxHP = 100 + p.maxHP * 20;
  state.towerHP = state.towerMaxHP;
  // Base ATK = perm + in-battle upgrades
  const baseATK = 10 + p.atkBonus * 3 + (state.atkLevel || 0) * 3;
  state.towerATK = baseATK;
  // Base fire rate with in-battle speed upgrades
  const baseRate = 1.5 * (1 + (state.spdLevel || 0) * 0.1);
  state.fireRate = baseRate;
  // Apply card multipliers
  if (state.cards.atkSpd > 0) state.fireRate *= 1 + state.cards.atkSpd * 0.4;
  if (state.cards.atkUp > 0) state.towerATK *= 1 + state.cards.atkUp * 0.4;
  state.shieldHP = p.startShield ? 20 : 0;
  state.upgCost = { atk: 10, hp: 10, spd: 15 };
}

// ============================================================
// ENEMIGOS
// ============================================================
function getWaveEnemies(wave) {
  const types = [];
  const base = 3 + wave * 2;
  if (wave <= 2) {
    for (let i = 0; i < base; i++) types.push('triangle');
  } else if (wave <= 5) {
    const sq = Math.min(Math.floor(base * 0.35), 5);
    for (let i = 0; i < base - sq; i++) types.push('triangle');
    for (let i = 0; i < sq; i++) types.push('square');
  } else if (wave <= 9) {
    const sq = Math.min(Math.floor(base * 0.3), 6);
    const di = Math.min(Math.floor(base * 0.15), 3);
    for (let i = 0; i < base - sq - di; i++) types.push('triangle');
    for (let i = 0; i < sq; i++) types.push('square');
    for (let i = 0; i < di; i++) types.push('diamond');
  } else {
    const sq = Math.min(Math.floor(base * 0.25), 7);
    const di = Math.min(Math.floor(base * 0.15), 4);
    const hx = Math.min(Math.floor(base * 0.1), 2);
    for (let i = 0; i < base - sq - di - hx; i++) types.push('triangle');
    for (let i = 0; i < sq; i++) types.push('square');
    for (let i = 0; i < di; i++) types.push('diamond');
    for (let i = 0; i < hx; i++) types.push('hexagon');
  }
  return types;
}

function spawnEnemy(type) {
  const def = ENEMY_TYPES[type];
  const angle = Math.random() * Math.PI * 2;
  const dist = ARENA_R - def.r - 5;
  const x = TOWER_CX + Math.cos(angle) * dist;
  const y = TOWER_CY + Math.sin(angle) * dist;
  const hpMult = 1 + (state.wave - 1) * 0.28;
  const spdMult = 1 + (state.wave - 1) * 0.015;

  enemies.push({
    x,
    y,
    type,
    r: def.r,
    hp: def.hp * hpMult,
    maxHP: def.hp * hpMult,
    speed: def.speed * spdMult,
    color: def.color,
    glow: def.glow,
    sides: def.sides,
    reward: def.reward,
    rot: Math.random() * Math.PI * 2,
    rotSpd: (Math.random() - 0.5) * 2,
    frozen: 0,
    targetX: TOWER_CX,
    targetY: TOWER_CY,
  });
}

function spawnWave() {
  state.wave++;
  const types = getWaveEnemies(state.wave);
  state.enemiesSpawned = 0;
  state.spawnTimer = 0;
  state.spawnInterval = Math.max(0.25, 0.6 - state.wave * 0.02);
  state.cleared = false;
  state.clearTimer = 0;
  enemies = [];
  projectiles = [];

  if (state.perm.startShield > 0) {
    state.shieldHP = 20;
  }

  state._waveQueue = types;
  updateHUD();
}

// ============================================================
// PROYECTILES
// ============================================================
function fireProjectile(target) {
  const projs = 1 + (state.cards.multishot > 0 ? state.cards.multishot : 0);
  const dmg = state.towerATK;

  // Collect unique targets for multishot: farthest first to avoid focusing one enemy
  const allTargets = [target];
  if (projs > 1) {
    const others = enemies.filter((e) => e !== target && e.hp > 0 && e.frozen <= 0);
    // Sort by distance to tower (it's OK to spread shots around)
    others.sort(
      (a, b) =>
        Math.hypot(a.x - TOWER_CX, a.y - TOWER_CY) - Math.hypot(b.x - TOWER_CX, b.y - TOWER_CY),
    );
    for (let i = 0; i < projs - 1 && i < others.length; i++) {
      allTargets.push(others[i]);
    }
    while (allTargets.length < projs) allTargets.push(null); // random
  }

  for (let i = 0; i < projs; i++) {
    let angle;
    if (allTargets[i]) {
      const t = allTargets[i];
      const offAngle = Math.random() * Math.PI * 2;
      const offDist = Math.random() * t.r * 0.5;
      angle = Math.atan2(
        t.y + Math.sin(offAngle) * offDist - TOWER_CY,
        t.x + Math.cos(offAngle) * offDist - TOWER_CX,
      );
    } else {
      angle = Math.random() * Math.PI * 2;
    }
    projectiles.push({
      x: TOWER_CX + Math.cos(angle) * TOWER_R,
      y: TOWER_CY + Math.sin(angle) * TOWER_R,
      vx: Math.cos(angle) * PROJECTILE_SPEED,
      vy: Math.sin(angle) * PROJECTILE_SPEED,
      dmg,
      life: 2,
    });
  }
  sfxShoot();
}

function findNearestEnemy() {
  let nearest = null,
    nd = Infinity;
  for (const e of enemies) {
    if (e.frozen > 0) continue;
    const d = Math.hypot(e.x - TOWER_CX, e.y - TOWER_CY);
    if (d < nd) {
      nd = d;
      nearest = e;
    }
  }
  return nearest;
}

// ============================================================
// RECURSOS
// ============================================================
function spawnResource(x, y, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 30 + Math.random() * 50;
    resources.push({
      x,
      y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      life: 6,
      size: 3 + Math.random() * 2,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

// ============================================================
// LÓGICA DE JUEGO
// ============================================================
function resetGame() {
  loadPerm();
  state.atkLevel = 0;
  state.spdLevel = 0;
  calcTowerStats();
  state.wave = 0;
  state.stars = 0;
  state.gameOver = false;
  state.cleared = false;
  enemies = [];
  projectiles = [];
  resources = [];
  state.clickTimer = 0;
  state.towerFireTimer = 0;
  state.shieldHP = state.perm.startShield ? 20 : 0;
  clearParticles();
  updateHUD();
  finalScoreEl.style.display = 'none';
  spawnWave();
}

function startGame() {
  clearSquashes();
  ensureAudio();
  startAmbient();
  resetGame();
  state.running = true;
  achievements.incrementPlays('neon-nexus');
  overlay.classList.add('hidden');
  cardOverlay.classList.add('hidden');
  shopOverlay.classList.add('hidden');
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  stopAmbient();

  const earned = Math.max(0, state.wave - 1);
  state.coins += earned;
  localStorage.setItem('neonNexus_coins', String(state.coins));

  if (state.wave > state.best) {
    state.best = state.wave;
    localStorage.setItem('neonNexus_best', String(state.best));
  }

  sfxGameOver();

  overlayText.textContent = '☠ CONEXIÓN PERDIDA ☠';
  finalScoreEl.style.display = 'block';
  finalScoreEl.textContent = `Oleada ${state.wave} · Mejor: ${state.best} · ✦${state.stars} estrellas · ◆${earned} monedas`;
  hintEl.innerHTML =
    `<kbd>Click</kbd> / <kbd>Espacio</kbd> reintentar · <kbd>R</kbd> reiniciar · ` +
    `<kbd>T</kbd> tienda`;
  overlay.classList.remove('hidden');
  updateHUD();
}

function towerTakeDamage(dmg) {
  if (state.shieldHP > 0) {
    if (state.shieldHP >= dmg) {
      state.shieldHP -= dmg;
      dmg = 0;
    } else {
      dmg -= state.shieldHP;
      state.shieldHP = 0;
    }
  }

  state.towerHP -= dmg;
  sfxTowerHit();
  spawnParticles(TOWER_CX, TOWER_CY, '#ff5e7a', 8, { spd: 120, life: 0.4 });

  // Ice shield
  if (state.cards.iceShield && Math.random() < 0.25) {
    for (const e of enemies) {
      const d = Math.hypot(e.x - TOWER_CX, e.y - TOWER_CY);
      if (d < 120) e.frozen = 1.5;
    }
  }

  // Thorns
  if (state.cards.thorns && dmg > 0) {
    const reflectDmg = dmg * 0.25;
    const nearest = findNearestEnemy();
    if (nearest) nearest.hp -= reflectDmg;
  }

  if (state.towerHP <= 0) {
    state.towerHP = 0;
    endGame();
  }
  updateHUD();
}

// ============================================================
// CARTAS
// ============================================================
function offerCards() {
  const pool = [...CARD_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const available = pool.filter((c) => {
    const val = state.cards[c.id];
    if (typeof val === 'number') return val < 3;
    return !val;
  });
  const picked = available.slice(0, 3);
  while (picked.length < 3) {
    picked.push({ id: 'atkUp', name: '🔫 Cañón', desc: '+40% daño de torre', rarity: 'common' });
  }
  state.offeredCards = picked;
  renderCards(picked);
  cardOverlay.classList.remove('hidden');
  state.paused = true;
}

function renderCards(cards) {
  cardEls.forEach((el, i) => {
    if (i < cards.length) {
      const c = cards[i];
      const rarityColor =
        c.rarity === 'epic' ? '#ffd93d' : c.rarity === 'rare' ? '#c084fc' : '#7dd3fc';
      el.style.display = 'flex';
      el.className = 'card rarity-' + c.rarity;
      el.querySelector('.card-icon').textContent = c.name.split(' ')[0];
      el.querySelector('.card-name').textContent = c.name;
      el.querySelector('.card-desc').textContent = c.desc;
      el.querySelector('.card-rarity').textContent = c.rarity;
      el.querySelector('.card-rarity').style.color = rarityColor;
      el.dataset.cardId = c.id;
    } else {
      el.style.display = 'none';
    }
  });
}

function pickCard(idx) {
  const card = state.offeredCards[idx];
  if (!card) return;
  const val = state.cards[card.id];
  if (typeof val === 'number') {
    state.cards[card.id] = val + 1;
  } else {
    state.cards[card.id] = true;
  }
  // Recalculate all stats from scratch, preserving in-battle levels
  calcTowerStats();

  sfxCardPick();
  cardOverlay.classList.add('hidden');
  state.paused = false;
  state.cleared = false;

  spawnWave();
}

cardEls.forEach((el) => {
  el.addEventListener('click', () => {
    if (!cardOverlay.classList.contains('hidden')) {
      pickCard(parseInt(el.dataset.idx));
    }
  });
  el.addEventListener(
    'touchstart',
    (_e) => {
      _e.preventDefault();
      if (!cardOverlay.classList.contains('hidden')) {
        pickCard(parseInt(el.dataset.idx));
      }
    },
    { passive: false },
  );
});

// ============================================================
// TIENDA
// ============================================================
function renderShop() {
  shopCoinsEl.textContent = String(state.coins);
  const items = shopItemsEl.querySelectorAll('.shop-item');
  items.forEach((el) => {
    const id = el.dataset.id;
    const def = SHOP_ITEMS.find((s) => s.id === id);
    if (!def) return;
    const level = state.perm[id] || 0;
    el.classList.toggle('owned', level >= def.maxLevel);
    const cost = def.baseCost * (1 + level);
    el.querySelector('.shop-item-cost').textContent = '◆' + cost;
  });
}

function buyShop(id) {
  const def = SHOP_ITEMS.find((s) => s.id === id);
  if (!def) return;
  const level = state.perm[id] || 0;
  if (level >= def.maxLevel) return;
  const cost = def.baseCost * (1 + level);
  if (state.coins < cost) {
    beep({ freq: 200, duration: 0.15, type: 'sawtooth', volume: 0.12 });
    return;
  }
  state.coins -= cost;
  state.perm[id] = (state.perm[id] || 0) + 1;
  savePerm(id, state.perm[id]);
  localStorage.setItem('neonNexus_coins', String(state.coins));
  calcTowerStats();
  sfxUpgrade();
  renderShop();
  updateHUD();
}

shopItemsEl.addEventListener('click', (e) => {
  const item = e.target.closest('.shop-item');
  if (!item) return;
  buyShop(item.dataset.id);
});

document.getElementById('shopClose').addEventListener('click', () => {
  shopOverlay.classList.add('hidden');
  if (state.gameOver) {
    overlay.classList.remove('hidden');
  }
});

// ============================================================
// ENTRADA: TECLADO
// ============================================================
const keys = {};

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;

  if ((e.code === 'Space' || e.code === 'Enter') && !state.running && !state.gameOver) {
    e.preventDefault();
    startGame();
    return;
  }

  if (e.code === 'Space' && state.running && !state.gameOver) {
    e.preventDefault();
    clickAttack();
  }

  if (e.code === 'KeyR' && !state.running) {
    e.preventDefault();
    startGame();
  }

  if (e.code === 'KeyT' && state.gameOver) {
    e.preventDefault();
    overlay.classList.add('hidden');
    renderShop();
    shopOverlay.classList.remove('hidden');
  }

  if (e.code === 'Digit1' && state.running) {
    e.preventDefault();
    upgradeATK();
  }
  if (e.code === 'Digit2' && state.running) {
    e.preventDefault();
    upgradeHP();
  }
  if (e.code === 'Digit3' && state.running) {
    e.preventDefault();
    upgradeSpd();
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

// ============================================================
// ENTRADA: TÁCTIL
// ============================================================
function clickAttack() {
  if (state.gameOver || !state.running || state.paused) return;
  if (state.clickTimer > 0) return;
  state.clickTimer = CLICK_CD;

  const nearest = findNearestEnemy();
  if (!nearest) return;
  const dmg = state.towerATK * 0.5;
  nearest.hp -= dmg;
  sfxClickHit();
  spawnParticles(nearest.x, nearest.y, '#ffffff', 4, { spd: 50, life: 0.2, sm: 1, smx: 2 });
}

canvas.addEventListener('click', (_e) => {
  if (!state.running) {
    if (!state.gameOver || shopOverlay.classList.contains('hidden')) {
      startGame();
    }
    return;
  }
  clickAttack();
});

canvas.addEventListener(
  'touchstart',
  (_e) => {
    _e.preventDefault();
    if (!state.running) {
      startGame();
      return;
    }
    clickAttack();
  },
  { passive: false },
);

// Upgrade buttons
const upgAtkBtn = document.getElementById('upgAtkBtn');
const upgHpBtn = document.getElementById('upgHpBtn');
const upgSpdBtn = document.getElementById('upgSpdBtn');

function upgradeATK() {
  if (!state.running || state.gameOver) return;
  const cost = state.upgCost.atk;
  if (state.stars < cost) return;
  state.stars -= cost;
  state.atkLevel = (state.atkLevel || 0) + 1;
  calcTowerStats();
  sfxUpgrade();
  updateHUD();
}

function upgradeHP() {
  if (!state.running || state.gameOver) return;
  const cost = state.upgCost.hp;
  if (state.stars < cost) return;
  state.stars -= cost;
  const heal = 15;
  state.towerMaxHP += heal;
  state.towerHP = Math.min(state.towerHP + heal, state.towerMaxHP);
  state.upgCost.hp = Math.floor(cost * 1.35);
  sfxUpgrade();
  spawnParticles(TOWER_CX, TOWER_CY, '#6ee7b7', 6, { spd: 40, life: 0.3, sm: 2, smx: 4 });
  updateHUD();
}

function upgradeSpd() {
  if (!state.running || state.gameOver) return;
  const cost = state.upgCost.spd;
  if (state.stars < cost) return;
  state.stars -= cost;
  state.spdLevel = (state.spdLevel || 0) + 1;
  calcTowerStats();
  sfxUpgrade();
  updateHUD();
}

upgAtkBtn.addEventListener('click', upgradeATK);
upgHpBtn.addEventListener('click', upgradeHP);
upgSpdBtn.addEventListener('click', upgradeSpd);

// Touch controls
const tcFire = document.getElementById('tcFire');
tcFire.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    tcFire.classList.add('is-pressed');
    if (!state.running) startGame();
    else clickAttack();
  },
  { passive: false },
);
tcFire.addEventListener('touchend', (e) => {
  e.preventDefault();
  tcFire.classList.remove('is-pressed');
});
tcFire.addEventListener('touchcancel', () => tcFire.classList.remove('is-pressed'));

const tcAtk = document.getElementById('tcAtk');
tcAtk.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    upgradeATK();
    tcAtk.classList.add('is-pressed');
  },
  { passive: false },
);
tcAtk.addEventListener('touchend', (e) => {
  e.preventDefault();
  tcAtk.classList.remove('is-pressed');
});
tcAtk.addEventListener('touchcancel', () => tcAtk.classList.remove('is-pressed'));

const tcHp = document.getElementById('tcHp');
tcHp.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    upgradeHP();
    tcHp.classList.add('is-pressed');
  },
  { passive: false },
);
tcHp.addEventListener('touchend', (e) => {
  e.preventDefault();
  tcHp.classList.remove('is-pressed');
});
tcHp.addEventListener('touchcancel', () => tcHp.classList.remove('is-pressed'));

// Overlay click
overlay.addEventListener('click', () => {
  if (!state.running) {
    if (shopOverlay.classList.contains('hidden')) startGame();
  }
});

// ============================================================
// ENTRADA: GAMEPAD
// ============================================================
let gamepadIndex = null;
let prevBtn0 = false;
let prevBtn9 = false;

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

  const btnA = !!gp.buttons[0]?.pressed;
  const btnStart = !!gp.buttons[9]?.pressed;

  if (btnA && !prevBtn0) {
    if (!state.running) startGame();
    else clickAttack();
  }
  if (btnStart && !prevBtn9) {
    if (!state.running) startGame();
  }
  if (btnStart && !prevBtn9 && state.gameOver) {
    overlay.classList.add('hidden');
    renderShop();
    shopOverlay.classList.remove('hidden');
  }

  prevBtn0 = btnA;
  prevBtn9 = btnStart;
}

// ============================================================
// ACTUALIZACIÓN
// ============================================================
function updateEnemies(dt) {
  if (state._waveQueue && state.enemiesSpawned < state._waveQueue.length) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      const type = state._waveQueue[state.enemiesSpawned];
      spawnEnemy(type);
      state.enemiesSpawned++;
      state.spawnTimer = state.spawnInterval;
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    if (e.frozen > 0) {
      e.frozen -= dt;
      continue;
    }

    e.rot += e.rotSpd * dt;

    // Ralentización Global
    const slowMult = state.cards.globalSlow > 0 ? 0.75 : 1;

    const dx = e.targetX - e.x;
    const dy = e.targetY - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      e.x += (dx / dist) * e.speed * dt * slowMult;
      e.y += (dy / dist) * e.speed * dt * slowMult;
    }

    if (dist < TOWER_R + e.r) {
      towerTakeDamage(10);
      enemies.splice(i, 1);
      continue;
    }

    if (e.hp <= 0) {
      const def = ENEMY_TYPES[e.type];
      spawnResource(e.x, e.y, def.reward);
      sfxKill();
      spawnParticles(e.x, e.y, e.color, 10, { spd: 100, life: 0.4, sm: 2, smx: 4 });
      enemies.splice(i, 1);
    }
  }

  if (
    state._waveQueue &&
    state.enemiesSpawned >= state._waveQueue.length &&
    enemies.length === 0 &&
    !state.cleared &&
    !state.paused
  ) {
    state.cleared = true;
    state.clearTimer = WAVE_PAUSE;
    sfxWaveClear();
    const bonus = 3 + state.wave;
    state.stars += bonus;
    updateHUD();
    spawnParticles(TOWER_CX, TOWER_CY, '#ffd93d', 16, { spd: 120, life: 0.6, sm: 2, smx: 5 });
  }

  if (state.cleared && !state.paused) {
    state.clearTimer -= dt;
    if (state.clearTimer <= 0) {
      offerCards();
    }
  }
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];

    // Anti-tunneling: sub-pasos para proyectiles rápidos
    const maxStep = PROJECTILE_SPEED * dt;
    const minThickness = 10;
    if (maxStep > minThickness * 0.4) {
      const steps = Math.ceil(maxStep / (minThickness * 0.3));
      const subDt = dt / steps;
      for (let s = 0; s < steps; s++) {
        p.x += p.vx * subDt;
        p.y += p.vy * subDt;
        if (s === steps - 1) p.life -= dt;

        let hit = false;
        for (const e of enemies) {
          if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + 4) {
            e.hp -= p.dmg;
            sfxHit();
            spawnParticles(p.x, p.y, '#00f5ff', 3, { spd: 40, life: 0.2, sm: 1.5, smx: 2.5 });

            if (state.cards.chain) {
              let nextTarget = null,
                nd = Infinity;
              for (const e2 of enemies) {
                if (e2 === e) continue;
                const d = Math.hypot(e2.x - e.x, e2.y - e.y);
                if (d < nd && d < 100) {
                  nd = d;
                  nextTarget = e2;
                }
              }
              if (nextTarget) {
                nextTarget.hp -= p.dmg * 0.5;
                spawnParticles(nextTarget.x, nextTarget.y, '#c084fc', 2, { spd: 30, life: 0.15 });
              }
            }

            if (state.cards.vampire) {
              state.towerHP = Math.min(state.towerHP + p.dmg * 0.15, state.towerMaxHP);
            }

            if (state.cards.aoe) {
              for (const e2 of enemies) {
                if (e2 === e) continue;
                if (Math.hypot(e2.x - e.x, e2.y - e.y) < 60) e2.hp -= p.dmg * 0.4;
              }
              spawnParticles(p.x, p.y, '#ffd93d', 8, { spd: 80, life: 0.3, sm: 2, smx: 4 });
            }

            projectiles.splice(i, 1);
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      for (const e of enemies) {
        if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + 4) {
          e.hp -= p.dmg;
          sfxHit();
          spawnParticles(p.x, p.y, '#00f5ff', 3, { spd: 40, life: 0.2, sm: 1.5, smx: 2.5 });

          if (state.cards.chain) {
            let nextTarget = null,
              nd = Infinity;
            for (const e2 of enemies) {
              if (e2 === e) continue;
              const d = Math.hypot(e2.x - e.x, e2.y - e.y);
              if (d < nd && d < 100) {
                nd = d;
                nextTarget = e2;
              }
            }
            if (nextTarget) {
              nextTarget.hp -= p.dmg * 0.5;
              spawnParticles(nextTarget.x, nextTarget.y, '#c084fc', 2, { spd: 30, life: 0.15 });
            }
          }

          if (state.cards.vampire) {
            state.towerHP = Math.min(state.towerHP + p.dmg * 0.15, state.towerMaxHP);
          }

          if (state.cards.aoe) {
            for (const e2 of enemies) {
              if (e2 === e) continue;
              if (Math.hypot(e2.x - e.x, e2.y - e.y) < 60) e2.hp -= p.dmg * 0.4;
            }
            spawnParticles(p.x, p.y, '#ffd93d', 8, { spd: 80, life: 0.3, sm: 2, smx: 4 });
          }

          projectiles.splice(i, 1);
          break;
        }
      }
    }

    if (
      i < projectiles.length &&
      (p.life <= 0 || Math.hypot(p.x - TOWER_CX, p.y - TOWER_CY) > ARENA_R + 50)
    ) {
      projectiles.splice(i, 1);
    }
  }
}

function updateResources(dt) {
  const magnetRange = state.cards.magnet > 0 ? ATTRACTION_R * 2 : ATTRACTION_R;
  for (let i = resources.length - 1; i >= 0; i--) {
    const r = resources[i];
    r.life -= dt;
    if (r.life <= 0) {
      resources.splice(i, 1);
      continue;
    }

    const dx = TOWER_CX - r.x;
    const dy = TOWER_CY - r.y;
    const dist = Math.hypot(dx, dy);
    if (dist < magnetRange) {
      const spd = 120 + (1 - dist / magnetRange) * 200;
      r.x += (dx / dist) * spd * dt;
      r.y += (dy / dist) * spd * dt;
      if (dist < TOWER_R + 10) {
        state.stars++;
        updateHUD();
        spawnParticles(TOWER_CX, TOWER_CY, '#ffd93d', 2, { spd: 20, life: 0.15, sm: 1, smx: 2 });
        beep({ freq: 500 + state.stars * 20, duration: 0.015, type: 'sine', volume: 0.04 });
        resources.splice(i, 1);
      }
    } else {
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.vx *= 0.98;
      r.vy *= 0.98;
    }
  }
}

function updateTower(dt) {
  tower.pulsePhase += dt * 2;
  tower.glowPhase += dt;

  // ── Auto-fire principal ──
  state.towerFireTimer -= dt;
  if (state.towerFireTimer <= 0) {
    const target = findNearestEnemy();
    if (target) {
      fireProjectile(target);
      state.towerFireTimer = 1 / state.fireRate;
    } else {
      state.towerFireTimer = 0.1;
    }
  }

  // ── Torreta Auxiliar (dispara independiente al 60% de cadencia) ──
  if (state.cards.turret) {
    if (!state._turretTimer) state._turretTimer = 0;
    state._turretTimer -= dt;
    if (state._turretTimer <= 0) {
      const tTarget = findNearestEnemy();
      if (tTarget) {
        const dmg = state.towerATK * 0.5;
        const angle = Math.atan2(tTarget.y - TOWER_CY, tTarget.x - TOWER_CX);
        projectiles.push({
          x: TOWER_CX + Math.cos(angle) * (TOWER_R + 10),
          y: TOWER_CY + Math.sin(angle) * (TOWER_R + 10),
          vx: Math.cos(angle) * PROJECTILE_SPEED * 1.2,
          vy: Math.sin(angle) * PROJECTILE_SPEED * 1.2,
          dmg,
          life: 1.5,
        });
        beep({ freq: 1200, duration: 0.02, type: 'sine', volume: 0.04 });
      }
      state._turretTimer = 1 / (state.fireRate * 0.6);
    }
  }

  // ── Regeneración pasiva ──
  const regenRate = (state.cards.regen || 0) * 3 + (state.perm.regenBonus || 0);
  if (regenRate > 0 && state.towerHP < state.towerMaxHP) {
    state.towerHP = Math.min(state.towerHP + regenRate * dt, state.towerMaxHP);
  }

  // ── Escudo Regenerativo (se regenera tras 2s sin daño) ──
  if (state.cards.regenShield) {
    if (state._lastHitTimer === undefined) state._lastHitTimer = 0;
    state._lastHitTimer += dt;
    if (state._lastHitTimer > 2 && state.shieldHP < 20) {
      state.shieldHP = Math.min(state.shieldHP + 4 * dt, 20);
    }
  }

  // ── Drenar: chupa vida del enemigo más cercano ──
  if (state.cards.drain) {
    const drainTarget = findNearestEnemy();
    if (drainTarget && state.towerHP < state.towerMaxHP) {
      const drainAmt = drainTarget.maxHP * 0.04 * dt;
      drainTarget.hp -= drainAmt;
      state.towerHP = Math.min(state.towerHP + drainAmt, state.towerMaxHP);
    }
  }

  if (state.clickTimer > 0) state.clickTimer -= dt;
}

// ============================================================
// RENDER
// ============================================================
function draw() {
  ctx.clearRect(0, 0, canvasW, canvasH);

  const so = getShakeOffset();
  ctx.save();
  ctx.translate(so.x, so.y);

  const s = scale;
  const ox = offX;
  const oy = offY;
  const cx = ox + TOWER_CX * s;
  const cy = oy + TOWER_CY * s;
  const ar = ARENA_R * s;

  // ── Fondo ──
  const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, ar * 1.3);
  bgGrad.addColorStop(0, '#0d0d22');
  bgGrad.addColorStop(0.5, '#08081a');
  bgGrad.addColorStop(1, '#04040e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(ox, oy, 800 * s, 800 * s);

  // ── Arena glow ──
  ctx.shadowColor = 'rgba(0,245,255,0.06)';
  ctx.shadowBlur = 30;
  ctx.strokeStyle = 'rgba(0,245,255,0.07)';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.arc(cx, cy, ar, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ── Grid ──
  ctx.strokeStyle = 'rgba(0,245,255,0.03)';
  ctx.lineWidth = 1 * s;
  for (let i = -5; i <= 5; i++) {
    const pos = cx + i * (ar / 5);
    ctx.beginPath();
    ctx.moveTo(pos, cy - ar);
    ctx.lineTo(pos, cy + ar);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - ar, pos);
    ctx.lineTo(cx + ar, pos);
    ctx.stroke();
  }

  // ── Stars (background) ──
  const seed = 12345;
  for (let i = 0; i < 60; i++) {
    const angle = (i * 2.399 + seed) % (Math.PI * 2);
    const dist = (30 + ((i * 7 + seed) % 300)) * s;
    const sx2 = cx + Math.cos(angle) * dist;
    const sy2 = cy + Math.sin(angle) * dist;
    const br = 0.15 + ((i * 13 + seed) % 255) / 510;
    ctx.fillStyle = `rgba(255,255,255,${br})`;
    ctx.beginPath();
    ctx.arc(sx2, sy2, (0.5 + ((i * 5 + seed) % 20) / 20) * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Recursos (stars) ──
  for (const r of resources) {
    const rx = ox + r.x * s;
    const ry = oy + r.y * s;
    const rs = r.size * s;
    const bri = 0.6 + Math.sin(r.phase + r.life * 5) * 0.3;
    ctx.fillStyle = `rgba(255,217,61,${bri})`;
    drawStar(rx, ry, rs);
    drawGlow(ctx, rx, ry, rs * 2, 'rgba(255,217,61,0.3)', 0.06, 3);
  }

  // ── Proyectiles ──
  for (const p of projectiles) {
    const px = ox + p.x * s;
    const py = oy + p.y * s;
    ctx.fillStyle = '#00f5ff';
    ctx.beginPath();
    ctx.arc(px, py, 3 * s, 0, Math.PI * 2);
    ctx.fill();
    drawGlow(ctx, px, py, 3 * s, '#00f5ff', 0.12, 4);
  }

  // ── Enemigos ──
  for (const e of enemies) {
    const ex = ox + e.x * s;
    const ey = oy + e.y * s;
    const er = e.r * s;

    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(e.rot);

    ctx.fillStyle = e.color;

    ctx.beginPath();
    const sides = e.sides;
    for (let si = 0; si < sides; si++) {
      const a = (si / sides) * Math.PI * 2 - Math.PI / 2;
      const px2 = Math.cos(a) * er;
      const py2 = Math.sin(a) * er;
      if (si === 0) ctx.moveTo(px2, py2);
      else ctx.lineTo(px2, py2);
    }
    ctx.closePath();
    ctx.fill();
    drawGlow(ctx, ex, ey, er * 0.6, e.glow, 0.06, 3);

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1 * s;
    ctx.stroke();

    ctx.restore();

    // HP bar
    const hpW = e.r * 2 * s;
    const hpH = 3 * s;
    const hpX = ex - hpW / 2;
    const hpY = ey - er - 8 * s;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    roundRect(ctx, hpX, hpY, hpW, hpH, 1.5 * s);
    ctx.fill();
    const hpPct = Math.max(0, e.hp / e.maxHP);
    ctx.fillStyle = e.hp < e.maxHP * 0.3 ? '#ff5e7a' : e.color;
    roundRect(ctx, hpX, hpY, hpW * hpPct, hpH, 1.5 * s);
    ctx.fill();

    // Frozen indicator
    if (e.frozen > 0) {
      ctx.strokeStyle = 'rgba(0,245,255,0.5)';
      ctx.lineWidth = 2 * s;
      ctx.setLineDash([3 * s, 3 * s]);
      ctx.beginPath();
      ctx.arc(ex, ey, er + 4 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ── Torre ──
  const pulse = 1 + Math.sin(tower.pulsePhase) * 0.04;
  const tr = TOWER_R * s * pulse;

  const gradRing = ctx.createRadialGradient(cx, cy, tr * 0.8, cx, cy, tr * 1.6);
  gradRing.addColorStop(0, 'rgba(0,245,255,0.15)');
  gradRing.addColorStop(0.5, 'rgba(0,245,255,0.05)');
  gradRing.addColorStop(1, 'rgba(0,245,255,0)');
  ctx.fillStyle = gradRing;
  ctx.beginPath();
  ctx.arc(cx, cy, tr * 1.6, 0, Math.PI * 2);
  ctx.fill();

  if (state.shieldHP > 0) {
    ctx.strokeStyle = 'rgba(0,245,255,0.25)';
    ctx.lineWidth = 3 * s;
    ctx.setLineDash([6 * s, 4 * s]);
    ctx.beginPath();
    ctx.arc(cx, cy, tr + 8 * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.shadowColor = 'rgba(0,245,255,0.5)';
  ctx.shadowBlur = 20 * s;
  ctx.fillStyle = '#00f5ff';
  ctx.beginPath();
  ctx.arc(cx, cy, tr, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  const hiGrad = ctx.createRadialGradient(cx - tr * 0.3, cy - tr * 0.3, 0, cx, cy, tr);
  hiGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
  hiGrad.addColorStop(0.4, 'rgba(255,255,255,0.1)');
  hiGrad.addColorStop(1, 'rgba(0,0,0,0.1)');
  ctx.fillStyle = hiGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, tr, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(cx, cy, tr * 0.2, 0, Math.PI * 2);
  ctx.fill();

  drawParticles(ctx, offX, offY, scale);

  ctx.restore();
}

function drawStar(x, y, r) {
  const spikes = 4;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.4;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

// ============================================================
// HUD
// ============================================================
function updateHUD() {
  waveValEl.textContent = String(state.wave);
  const hpPct = state.towerMaxHP > 0 ? (state.towerHP / state.towerMaxHP) * 100 : 0;
  hpBarEl.style.width = Math.max(0, hpPct) + '%';
  hpTextEl.textContent = `${Math.ceil(state.towerHP)}/${state.towerMaxHP}`;
  starsValEl.textContent = String(state.stars);
  coinsValEl.textContent = String(state.coins);

  upgAtkCostEl.textContent = '✦' + state.upgCost.atk;
  upgHpCostEl.textContent = '✦' + state.upgCost.hp;
  upgSpdCostEl.textContent = '✦' + state.upgCost.spd;

  const ownedCards = Object.entries(state.cards).filter(([_, v]) => {
    if (typeof v === 'number') return v > 0;
    return v === true;
  });
  if (ownedCards.length > 0) {
    cardBadgeEl.style.display = 'block';
    cardBadgeEl.textContent = '◈ ' + ownedCards.length + ' mejoras activas';
  } else {
    cardBadgeEl.style.display = 'none';
  }
}

// ============================================================
// BUCLE PRINCIPAL
// ============================================================
const loop = createGameLoop((dt) => {
  ime;

  pollGamepad();
  updateShake(dt);

  if (state.running && !state.gameOver && !state.paused) {
    updateTower(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateResources(dt);
  }

  updateParticles(dt);
  draw();
});

// ── Init ──
loadPerm();
calcTowerStats();
updateHUD();

function cleanup() {
  loop.stop();
  closeAudio();
}
window.addEventListener('beforeunload', cleanup);
window.addEventListener('pagehide', cleanup);
document.getElementById('loading').classList.add('hidden');
loop.start();

// Game Bar
document.getElementById('hubBtn')?.addEventListener('click', () => {
  window.location.href = '../../index.html';
});
document.getElementById('fsBtn')?.addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  else document.exitFullscreen().catch(() => {});
});
document.getElementById('helpBtn')?.addEventListener('click', () => showHelp('neon-nexus'));
