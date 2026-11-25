import { defineGame } from '../../game/contract.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import { clamp, dist2, normalize2 } from '../../core/math.js';
import { COLLISION_SERVICE, type CollisionService } from '../../sim/collision.js';
import type { StepContext } from '../../core/simulation.js';

/**
 * Neon Nexus completo: torre con escudo, oleadas con jefe cada 5, 17 cartas,
 * tienda de 4 objetos persistentes, mejoras ATK/HP/Velocidad con coste
 * creciente, proyectiles (multi/chain/AoE/vampiro), recursos con imán y
 * enemigos camuflados/voladores. La persistencia vive en el estado de la
 * simulación (sin localStorage/DOM), conservando todas las mecánicas.
 */
export const NEON_NEXUS = {
  arenaR: 340,
  towerR: 28,
  projectileSpeed: 550,
  clickCooldown: 0.18,
  wavePauseTicks: 120,
  maxShield: 20,
  initialHp: 100,
  initialAtk: 10,
  initialFireRate: 1.5,
  attractionR: 120,
  cardCount: 3,
} as const;

export const NEXUS_CARDS = [
  'chain', 'vampire', 'multishot', 'aoe', 'iceShield', 'atkSpd', 'atkUp', 'regen',
  'magnet', 'thorns', 'drain', 'turret', 'regenShield', 'globalSlow', 'sniper',
  'scanner', 'targeting',
] as const;
export type NexusCard = (typeof NEXUS_CARDS)[number];

export const NEXUS_SHOP = [
  { id: 'maxHP', baseCost: 15, maxLevel: 5 },
  { id: 'atkBonus', baseCost: 15, maxLevel: 5 },
  { id: 'startShield', baseCost: 25, maxLevel: 1 },
  { id: 'regenBonus', baseCost: 30, maxLevel: 3 },
] as const;
export type NexusShopItem = (typeof NEXUS_SHOP)[number]['id'];

export type NexusEnemyType = 'triangle' | 'square' | 'diamond' | 'hexagon' | 'camo' | 'flying' | 'boss';

export interface NexusEnemy {
  x: number;
  y: number;
  type: NexusEnemyType;
  hp: number;
  maxHp: number;
  r: number;
  speed: number;
  reward: number;
  frozen: number;
  detected: boolean;
}

export interface NexusProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  life: number;
}

export interface NexusResource {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface NexusState {
  paused: boolean;
  over: boolean;
  generation: number;
  winner: number | null;
  tower: {
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    atk: number;
    fireRate: number;
    fireTimer: number;
    clickTimer: number;
    shield: number;
    maxShield: number;
    lastHit: number;
    turretTimer: number;
  };
  enemies: NexusEnemy[];
  projectiles: NexusProjectile[];
  resources: NexusResource[];
  wave: number;
  waveQueue: NexusEnemyType[];
  spawned: number;
  spawnTimer: number;
  cleared: boolean;
  clearTimer: number;
  stars: number;
  coins: number;
  kills: number;
  score: number;
  atkLevel: number;
  hpLevel: number;
  spdLevel: number;
  upgCost: { atk: number; hp: number; spd: number };
  perm: Record<NexusShopItem, number>;
  cards: Record<NexusCard, number>;
  offeredCards: NexusCard[];
  offerPending: boolean;
  shopOpen: boolean;
  aimX: number;
  aimY: number;
  ticks: number;
}

const ENEMY_STATS: Record<NexusEnemyType, { hp: number; speed: number; r: number; reward: number }> = {
  triangle: { hp: 20, speed: 65, r: 10, reward: 1 },
  square: { hp: 40, speed: 50, r: 13, reward: 2 },
  diamond: { hp: 70, speed: 38, r: 15, reward: 3 },
  hexagon: { hp: 150, speed: 30, r: 18, reward: 5 },
  camo: { hp: 30, speed: 70, r: 11, reward: 2 },
  flying: { hp: 35, speed: 55, r: 12, reward: 3 },
  boss: { hp: 800, speed: 20, r: 30, reward: 20 },
};

function clampCost(base: number, level: number): number {
  return Math.round(base * (1 + level * 0.35));
}

function recalc(state: NexusState): void {
  const tower = state.tower;
  const cards = state.cards;
  tower.maxHp = NEON_NEXUS.initialHp + state.perm.maxHP * 20 + state.hpLevel * 15;
  tower.hp = Math.min(tower.hp, tower.maxHp);
  let atk = NEON_NEXUS.initialAtk + state.perm.atkBonus * 3 + state.atkLevel * 3;
  atk *= 1 + cards.atkUp * 0.4;
  let rate = NEON_NEXUS.initialFireRate * (1 + state.spdLevel * 0.1) * (1 + cards.atkSpd * 0.4);
  if (cards.sniper > 0) {
    atk *= 1 + cards.sniper;
    rate *= 0.5;
  }
  tower.atk = atk;
  tower.fireRate = rate;
  tower.maxShield = (state.perm.startShield > 0 ? NEON_NEXUS.maxShield : 0) + (cards.regenShield > 0 ? NEON_NEXUS.maxShield : 0);
  tower.shield = Math.min(tower.shield, tower.maxShield);
}

function resetNexus(state: NexusState, ctx: StepContext): void {
  state.generation += 1;
  state.paused = false;
  state.over = false;
  state.winner = null;
  state.tower = {
    x: 0,
    y: 0,
    hp: NEON_NEXUS.initialHp,
    maxHp: NEON_NEXUS.initialHp,
    atk: NEON_NEXUS.initialAtk,
    fireRate: NEON_NEXUS.initialFireRate,
    fireTimer: 0,
    clickTimer: 0,
    shield: 0,
    maxShield: 0,
    lastHit: 0,
    turretTimer: 0,
  };
  state.enemies = [];
  state.projectiles = [];
  state.resources = [];
  state.wave = 0;
  state.waveQueue = [];
  state.spawned = 0;
  state.spawnTimer = 0;
  state.cleared = false;
  state.clearTimer = 0;
  state.stars = 0;
  state.coins = 0;
  state.kills = 0;
  state.score = 0;
  state.atkLevel = 0;
  state.hpLevel = 0;
  state.spdLevel = 0;
  state.upgCost = { atk: 10, hp: 10, spd: 15 };
  state.perm = { maxHP: 0, atkBonus: 0, startShield: 0, regenBonus: 0 };
  for (const card of NEXUS_CARDS) state.cards[card] = 0;
  state.offeredCards = [];
  state.offerPending = false;
  state.shopOpen = false;
  state.aimX = 1;
  state.aimY = 0;
  state.ticks = 0;
  recalc(state);
  ctx.emit('restart', { generation: state.generation });
}

function buildWave(wave: number, pattern: string, hazard: number, rng: { int(max: number): number }): NexusEnemyType[] {
  const queue: NexusEnemyType[] = [];
  if (wave > 0 && wave % 5 === 0) {
    queue.push('boss');
    const escort = 3 + wave + Math.round(hazard * 3);
    for (let i = 0; i < escort; i++) queue.push('triangle');
    return queue;
  }
  const total = clamp(3 + wave * 2 + Math.round(hazard * 3), 3, 30);
  const tough = pattern === 'elite' ? 0.5 : pattern === 'shop' ? 0.1 : 0.25;
  for (let i = 0; i < total; i++) {
    const roll = rng.int(100) / 100;
    if (wave >= 8 && roll < tough * 0.25) queue.push('hexagon');
    else if (wave >= 5 && roll < tough * 0.5) queue.push('diamond');
    else if (roll < tough) queue.push('square');
    else queue.push('triangle');
  }
  if (wave >= 4) queue.push('camo');
  if (wave >= 6) queue.push('flying');
  return queue;
}

function spawnEnemy(state: NexusState, ctx: StepContext, type: NexusEnemyType): void {
  const progress = ctx.progression.state;
  const angle = ctx.rng.range(0, Math.PI * 2);
  const distance = NEON_NEXUS.arenaR * ctx.rng.range(0.7, 1);
  const stats = ENEMY_STATS[type];
  state.enemies.push({
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    type,
    hp: Math.round(stats.hp * (1 + progress.hazard * 0.3)),
    maxHp: Math.round(stats.hp * (1 + progress.hazard * 0.3)),
    r: stats.r,
    speed: stats.speed * progress.speed,
    reward: stats.reward,
    frozen: 0,
    detected: false,
  });
}

function findTarget(state: NexusState): NexusEnemy | null {
  const scout = state.cards.scanner > 0;
  const visible = state.enemies.filter((enemy) => enemy.hp > 0 && (!enemy.type.includes('camo') || scout || enemy.detected));
  const pool = visible.filter((enemy) => enemy.frozen <= 0);
  const candidates = pool.length > 0 ? pool : visible;
  if (candidates.length === 0) return null;
  if (state.cards.targeting > 0) {
    return candidates.reduce((best, enemy) => (enemy.hp > best.hp ? enemy : best));
  }
  return candidates.reduce((best, enemy) =>
    dist2(enemy.x, enemy.y, 0, 0) < dist2(best.x, best.y, 0, 0) ? enemy : best,
  );
}

function fireProjectile(state: NexusState, ctx: StepContext, target: NexusEnemy | null): void {
  const count = 1 + state.cards.multishot;
  const targets: (NexusEnemy | null)[] = target === null ? [null] : [target];
  const others = state.enemies
    .filter((enemy) => enemy !== target && enemy.hp > 0 && enemy.frozen <= 0)
    .sort((a, b) => dist2(a.x, a.y, 0, 0) - dist2(b.x, b.y, 0, 0));
  for (let i = 1; i < count; i++) targets.push(others[i - 1] ?? null);
  for (const chosen of targets) {
    let angle = ctx.rng.range(0, Math.PI * 2);
    if (chosen !== null) {
      const jitter = ctx.rng.range(0, chosen.r * 0.5);
      const jitterAngle = ctx.rng.range(0, Math.PI * 2);
      const dir = normalize2(
        chosen.x + Math.cos(jitterAngle) * jitter,
        chosen.y + Math.sin(jitterAngle) * jitter,
      );
      angle = Math.atan2(dir.y, dir.x);
    }
    state.projectiles.push({
      x: Math.cos(angle) * NEON_NEXUS.towerR,
      y: Math.sin(angle) * NEON_NEXUS.towerR,
      vx: Math.cos(angle) * NEON_NEXUS.projectileSpeed,
      vy: Math.sin(angle) * NEON_NEXUS.projectileSpeed,
      dmg: state.tower.atk,
      life: 2,
    });
  }
  ctx.emit('shoot', { count });
}

function spawnResource(state: NexusState, ctx: StepContext, x: number, y: number, amount: number): void {
  for (let i = 0; i < amount; i++) {
    const angle = ctx.rng.range(0, Math.PI * 2);
    const speed = ctx.rng.range(30, 80);
    state.resources.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 6 });
  }
}

function damageTower(state: NexusState, ctx: StepContext, damage: number): void {
  const tower = state.tower;
  tower.lastHit = 0;
  if (state.cards.iceShield > 0 && ctx.rng.next() < 0.25) {
    for (const enemy of state.enemies) {
      if (dist2(enemy.x, enemy.y, 0, 0) < 14400) enemy.frozen = 1.5;
    }
    ctx.emit('freeze', {});
  }
  if (state.cards.thorns > 0 && damage > 0) {
    const nearest = state.enemies.reduce<NexusEnemy | null>(
      (best, enemy) => (best === null || dist2(enemy.x, enemy.y, 0, 0) < dist2(best.x, best.y, 0, 0) ? enemy : best),
      null,
    );
    if (nearest !== null) nearest.hp -= damage * 0.25;
  }
  let remaining = damage;
  if (tower.shield > 0) {
    const absorbed = Math.min(tower.shield, remaining);
    tower.shield -= absorbed;
    remaining -= absorbed;
  }
  tower.hp = Math.max(0, tower.hp - remaining);
  ctx.emit('towerHit', { damage, hp: tower.hp });
  ctx.progression.observe(-0.7);
  if (tower.hp <= 0) {
    state.over = true;
    state.winner = null;
    state.shopOpen = true;
    ctx.emit('gameOver', { wave: state.wave });
  }
}

function offerCards(state: NexusState, ctx: StepContext): void {
  const pool = [...NEXUS_CARDS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = ctx.rng.int(i + 1);
    const first = pool[i] as NexusCard;
    pool[i] = pool[j] as NexusCard;
    pool[j] = first;
  }
  state.offeredCards = pool.filter((card) => state.cards[card] < 3).slice(0, NEON_NEXUS.cardCount);
  while (state.offeredCards.length < NEON_NEXUS.cardCount) {
    state.offeredCards.push('atkUp');
  }
  state.offerPending = true;
  ctx.emit('cardOffer', { cards: [...state.offeredCards] });
}

function pickCard(state: NexusState, ctx: StepContext, card: NexusCard): void {
  if (!state.offerPending || !state.offeredCards.includes(card)) return;
  state.cards[card] += 1;
  recalc(state);
  state.offerPending = false;
  state.offeredCards = [];
  ctx.emit('cardPick', { card });
  ctx.progression.observe(0.5);
}

export const neonNexusGame = defineGame<NexusState>({
  id: 'neon-nexus',
  meta: { title: 'Neon Nexus', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: [
    'fire', 'left', 'right', 'up', 'down',
    'upgradeAtk', 'upgradeHp', 'upgradeSpd',
    'card1', 'card2', 'card3',
    'shop', 'buyMaxHp', 'buyAtkBonus', 'buyStartShield', 'buyRegenBonus', 'closeShop',
    'pause', 'restart',
  ],
  progression: {
    id: 'neon-nexus',
    levels: [
      { speed: 1, spawnInterval: 60, hazard: 0, label: 'Oleada 1' },
      { speed: 1.1, spawnInterval: 48, hazard: 0.2, label: 'Oleada 2' },
      { speed: 1.25, spawnInterval: 38, hazard: 0.45, label: 'Oleada 3' },
    ],
    pointsPerLevel: 1,
    dda: { enabled: true, window: 400, maxAdjust: 0.08 },
    patterns: ['wave', 'shop', 'elite'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    const state: NexusState = {
      paused: false,
      over: false,
      generation: 0,
      winner: null,
      tower: {
        x: 0, y: 0, hp: NEON_NEXUS.initialHp, maxHp: NEON_NEXUS.initialHp,
        atk: NEON_NEXUS.initialAtk, fireRate: NEON_NEXUS.initialFireRate,
        fireTimer: 0, clickTimer: 0, shield: 0, maxShield: 0, lastHit: 0, turretTimer: 0,
      },
      enemies: [],
      projectiles: [],
      resources: [],
      wave: 0,
      waveQueue: [],
      spawned: 0,
      spawnTimer: 0,
      cleared: false,
      clearTimer: 0,
      stars: 0,
      coins: 0,
      kills: 0,
      score: 0,
      atkLevel: 0,
      hpLevel: 0,
      spdLevel: 0,
      upgCost: { atk: 10, hp: 10, spd: 15 },
      perm: { maxHP: 0, atkBonus: 0, startShield: 0, regenBonus: 0 },
      cards: Object.fromEntries(NEXUS_CARDS.map((card) => [card, 0])) as Record<NexusCard, number>,
      offeredCards: [],
      offerPending: false,
      shopOpen: false,
      aimX: 1,
      aimY: 0,
      ticks: 0,
    };
    resetNexus(state, ctx);
    return state;
  },

  step(state, ctx) {
    // Tienda: accesible al morir (T en el original) o entre oleadas.
    if (ctx.actions.consume('shop') && (state.over || state.cleared)) {
      state.shopOpen = !state.shopOpen;
      ctx.emit('shop', { open: state.shopOpen });
    }
    if (state.shopOpen) {
      const purchases: readonly [string, NexusShopItem][] = [
        ['buyMaxHp', 'maxHP'],
        ['buyAtkBonus', 'atkBonus'],
        ['buyStartShield', 'startShield'],
        ['buyRegenBonus', 'regenBonus'],
      ];
      for (const [action, id] of purchases) {
        if (!ctx.actions.consume(action)) continue;
        const item = NEXUS_SHOP.find((entry) => entry.id === id);
        if (item === undefined) continue;
        const level = state.perm[id];
        const cost = item.baseCost * (1 + level);
        if (level >= item.maxLevel || state.coins < cost) {
          ctx.emit('shopDenied', { item: id });
          continue;
        }
        state.coins -= cost;
        state.perm[id] = level + 1;
        recalc(state);
        ctx.emit('shopBuy', { item: id, level: level + 1 });
      }
      if (ctx.actions.consume('closeShop')) state.shopOpen = false;
      ctx.progression.update(state.wave);
      return;
    }

    if (handleLifecycle(state, ctx, state.wave, () => resetNexus(state, ctx))) return;

    if (state.offerPending) {
      if (ctx.actions.consume('card1')) pickCard(state, ctx, state.offeredCards[0] ?? 'atkUp');
      else if (ctx.actions.consume('card2')) pickCard(state, ctx, state.offeredCards[1] ?? 'atkUp');
      else if (ctx.actions.consume('card3')) pickCard(state, ctx, state.offeredCards[2] ?? 'atkUp');
      return;
    }

    const dt = ctx.clock.dt;
    state.ticks += 1;
    const progress = ctx.progression.state;
    const collision = ctx.services.get<CollisionService>(COLLISION_SERVICE);
    const tower = state.tower;
    state.score = state.wave * 100 + state.kills * 10 + state.stars;

    tower.fireTimer -= dt;
    tower.clickTimer -= dt;
    tower.lastHit += dt;
    if (tower.fireTimer <= 0) {
      fireProjectile(state, ctx, findTarget(state));
      tower.fireTimer = 1 / tower.fireRate;
    }
    if (state.cards.turret > 0) {
      tower.turretTimer -= dt;
      if (tower.turretTimer <= 0) {
        const target = findTarget(state);
        if (target !== null) {
          const dir = normalize2(target.x, target.y);
          state.projectiles.push({
            x: dir.x * (NEON_NEXUS.towerR + 10),
            y: dir.y * (NEON_NEXUS.towerR + 10),
            vx: dir.x * NEON_NEXUS.projectileSpeed * 1.2,
            vy: dir.y * NEON_NEXUS.projectileSpeed * 1.2,
            dmg: tower.atk * 0.5 * state.cards.turret,
            life: 1.5,
          });
          ctx.emit('turret', {});
        }
        tower.turretTimer = 1 / (tower.fireRate * 0.6);
      }
    }
    const regen = state.cards.regen * 3 + state.perm.regenBonus;
    if (regen > 0 && tower.hp < tower.maxHp) tower.hp = Math.min(tower.maxHp, tower.hp + regen * dt);
    if (state.cards.regenShield > 0 && tower.lastHit > 2 && tower.shield < tower.maxShield) {
      tower.shield = Math.min(tower.maxShield, tower.shield + 4 * dt);
    }
    if (state.cards.drain > 0) {
      const target = state.enemies.reduce<NexusEnemy | null>(
        (best, enemy) => (best === null || dist2(enemy.x, enemy.y, 0, 0) < dist2(best.x, best.y, 0, 0) ? enemy : best),
        null,
      );
      if (target !== null && tower.hp < tower.maxHp) {
        const amount = target.maxHp * 0.04 * state.cards.drain * dt;
        target.hp -= amount;
        tower.hp = Math.min(tower.maxHp, tower.hp + amount);
      }
    }

    let aimX = 0;
    let aimY = 0;
    if (ctx.actions.isDown('left')) aimX -= 1;
    if (ctx.actions.isDown('right')) aimX += 1;
    if (ctx.actions.isDown('up')) aimY -= 1;
    if (ctx.actions.isDown('down')) aimY += 1;
    if (aimX !== 0 || aimY !== 0) {
      const dir = normalize2(aimX, aimY);
      state.aimX = dir.x;
      state.aimY = dir.y;
    }
    if (ctx.actions.consume('fire') && tower.clickTimer <= 0) {
      state.projectiles.push({
        x: state.aimX * NEON_NEXUS.towerR,
        y: state.aimY * NEON_NEXUS.towerR,
        vx: state.aimX * NEON_NEXUS.projectileSpeed,
        vy: state.aimY * NEON_NEXUS.projectileSpeed,
        dmg: tower.atk * 0.8,
        life: 2,
      });
      tower.clickTimer = NEON_NEXUS.clickCooldown;
      ctx.emit('click', { x: state.aimX, y: state.aimY });
    }

    const upgrade = (action: string, cost: number, apply: () => void): void => {
      if (!ctx.actions.consume(action) || state.stars < cost) return;
      state.stars -= cost;
      apply();
      ctx.emit('upgrade', { action });
      ctx.progression.observe(0.4);
    };
    upgrade('upgradeAtk', state.upgCost.atk, () => {
      state.atkLevel += 1;
      recalc(state);
    });
    upgrade('upgradeHp', state.upgCost.hp, () => {
      state.hpLevel += 1;
      tower.hp += 15;
      state.upgCost.hp = clampCost(10, state.hpLevel);
      recalc(state);
    });
    upgrade('upgradeSpd', state.upgCost.spd, () => {
      state.spdLevel += 1;
      recalc(state);
    });

    if (state.spawned < state.waveQueue.length) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        const type = state.waveQueue[state.spawned];
        if (type !== undefined) spawnEnemy(state, ctx, type);
        state.spawned += 1;
        state.spawnTimer = (progress.spawnInterval ?? 60) / 60;
      }
    }

    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const projectile = state.projectiles[i];
      if (projectile === undefined) continue;
      const steps = Math.max(1, Math.ceil(NEON_NEXUS.projectileSpeed * dt / 4));
      const subDt = dt / steps;
      let removed = false;
      for (let s = 0; s < steps && !removed; s++) {
        projectile.x += projectile.vx * subDt;
        projectile.y += projectile.vy * subDt;
        for (let j = state.enemies.length - 1; j >= 0; j--) {
          const enemy = state.enemies[j];
          if (enemy === undefined) continue;
          if (
            !collision.circleAabb(
              { x: projectile.x, y: projectile.y, r: 4 },
              { x: enemy.x - enemy.r, y: enemy.y - enemy.r, w: enemy.r * 2, h: enemy.r * 2 },
            )
          ) continue;
          enemy.hp -= projectile.dmg;
          if (state.cards.vampire > 0) {
            tower.hp = Math.min(tower.maxHp, tower.hp + projectile.dmg * 0.15 * state.cards.vampire);
          }
          if (state.cards.chain > 0) {
            const neighbor = state.enemies
              .filter((other) => other !== enemy && dist2(other.x, other.y, enemy.x, enemy.y) < 10000)
              .reduce<NexusEnemy | null>(
                (best, other) => (best === null || dist2(other.x, other.y, enemy.x, enemy.y) < dist2(best.x, best.y, enemy.x, enemy.y) ? other : best),
                null,
              );
            if (neighbor !== null) neighbor.hp -= projectile.dmg * 0.5 * state.cards.chain;
          }
          if (state.cards.aoe > 0) {
            for (const other of state.enemies) {
              if (other !== enemy && dist2(other.x, other.y, enemy.x, enemy.y) < 3600) {
                other.hp -= projectile.dmg * 0.4 * state.cards.aoe;
              }
            }
          }
          state.projectiles.splice(i, 1);
          removed = true;
          ctx.emit('hit', { type: enemy.type });
          break;
        }
      }
      if (removed) continue;
      projectile.life -= dt;
      if (projectile.life <= 0 || dist2(projectile.x, projectile.y, 0, 0) > (NEON_NEXUS.arenaR + 50) ** 2) {
        state.projectiles.splice(i, 1);
      }
    }

    const magnetRange = NEON_NEXUS.attractionR * (state.cards.magnet > 0 ? 2 : 1);
    for (let i = state.resources.length - 1; i >= 0; i--) {
      const resource = state.resources[i];
      if (resource === undefined) continue;
      resource.life -= dt;
      if (resource.life <= 0) {
        state.resources.splice(i, 1);
        continue;
      }
      const d2 = dist2(resource.x, resource.y, 0, 0);
      if (d2 < magnetRange * magnetRange) {
        const distance = Math.sqrt(d2);
        const pull = 120 + (1 - distance / magnetRange) * 200;
        if (distance < NEON_NEXUS.towerR + 10) {
          state.stars += 1;
          state.resources.splice(i, 1);
          ctx.emit('resource', { stars: state.stars });
          continue;
        }
        resource.x -= (resource.x / distance) * pull * dt;
        resource.y -= (resource.y / distance) * pull * dt;
      } else {
        resource.x += resource.vx * dt;
        resource.y += resource.vy * dt;
        resource.vx *= 0.98;
        resource.vy *= 0.98;
      }
    }

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const enemy = state.enemies[i];
      if (enemy === undefined) continue;
      if (enemy.type === 'camo' && state.cards.scanner > 0) enemy.detected = true;
      if (enemy.frozen > 0) {
        enemy.frozen -= dt;
        continue;
      }
      const distance = Math.sqrt(dist2(enemy.x, enemy.y, 0, 0));
      if (distance < NEON_NEXUS.towerR + enemy.r) {
        damageTower(state, ctx, enemy.type === 'boss' ? 30 : 10);
        state.enemies.splice(i, 1);
        if (state.over) return;
        continue;
      }
      if (distance > 1) {
        const slow = state.cards.globalSlow > 0 ? 0.75 : 1;
        enemy.x -= (enemy.x / distance) * enemy.speed * dt * slow;
        enemy.y -= (enemy.y / distance) * enemy.speed * dt * slow;
      }
    }

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const enemy = state.enemies[i];
      if (enemy === undefined || enemy.hp > 0) continue;
      state.enemies.splice(i, 1);
      state.kills += 1;
      state.stars += enemy.reward;
      state.coins += enemy.reward;
      spawnResource(state, ctx, enemy.x, enemy.y, enemy.reward);
      ctx.emit('explode', { type: enemy.type });
      ctx.progression.observe(0.6);
    }

    if (
      state.spawned >= state.waveQueue.length &&
      state.enemies.length === 0 &&
      !state.cleared &&
      !state.offerPending
    ) {
      state.cleared = true;
      state.clearTimer = NEON_NEXUS.wavePauseTicks;
      state.wave += 1;
      state.stars += 3 + state.wave;
      ctx.emit('levelUp', { wave: state.wave });
      ctx.progression.observe(1);
    }
    if (state.cleared) {
      state.clearTimer -= 1;
      if (state.clearTimer <= 0) {
        state.cleared = false;
        state.waveQueue = buildWave(state.wave, ctx.progression.nextPattern() ?? 'wave', progress.hazard, ctx.rng);
        state.spawned = 0;
        state.spawnTimer = 0;
        offerCards(state, ctx);
      }
    }
  },

  render(renderer, state, _alpha) {
    // _alpha: el arena usa posiciones exactas del tick, sin interpolación.
    const ctx = renderer as CanvasRenderingContext2D | null;
    if (!ctx || typeof ctx.clearRect !== 'function') return;
    const S = NEON_NEXUS.arenaR * 2;
    const c = S / 2;
    const tower = state.tower;

    ctx.save();
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = '#141a33';
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      const p = (S / 8) * i;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, S);
      ctx.moveTo(0, p);
      ctx.lineTo(S, p);
      ctx.stroke();
    }
    ctx.strokeStyle = '#1f2a55';
    for (let r = 1; r <= 4; r++) {
      ctx.beginPath();
      ctx.arc(c, c, (NEON_NEXUS.arenaR * r) / 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = state.cleared ? '#ffd166' : '#25f4e6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c, c, NEON_NEXUS.arenaR, 0, Math.PI * 2);
    ctx.stroke();

    for (const resource of state.resources) {
      ctx.save();
      ctx.translate(c + resource.x, c + resource.y);
      ctx.rotate(state.ticks * 0.05);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
    }

    for (const enemy of state.enemies) {
      const ex = c + enemy.x;
      const ey = c + enemy.y;
      const color =
        enemy.type === 'boss'
          ? '#ff3f6e'
          : enemy.type === 'camo'
            ? enemy.detected ? '#b56bff' : '#4a4266'
            : enemy.type === 'flying'
              ? '#7df9ff'
              : enemy.type === 'hexagon'
                ? '#ff9f43'
                : enemy.type === 'diamond'
                  ? '#ffd166'
                  : enemy.type === 'square'
                    ? '#25f4e6'
                    : '#9be36b';
      const sides =
        enemy.type === 'triangle' || enemy.type === 'camo'
          ? 3
          : enemy.type === 'square' || enemy.type === 'diamond' || enemy.type === 'flying'
            ? 4
            : 6;
      const rot =
        enemy.type === 'triangle' || enemy.type === 'camo'
          ? -Math.PI / 2
          : enemy.type === 'square' ? Math.PI / 4 : 0;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.fillStyle = enemy.frozen > 0 ? '#1e4a6b' : color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k <= sides; k++) {
        const a = rot + (k * Math.PI * 2) / sides;
        const vx = Math.cos(a) * enemy.r;
        const vy = Math.sin(a) * enemy.r;
        if (k === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.fill();
      ctx.stroke();
      if (enemy.type === 'flying') {
        ctx.beginPath();
        ctx.moveTo(-enemy.r * 1.6, 0);
        ctx.lineTo(enemy.r * 1.6, 0);
        ctx.stroke();
      }
      ctx.restore();
      if (enemy.type === 'boss' || enemy.hp < enemy.maxHp) {
        ctx.fillStyle = '#1b2440';
        ctx.fillRect(ex - enemy.r, ey - enemy.r - 10, enemy.r * 2, 4);
        ctx.fillStyle = '#ff3f6e';
        ctx.fillRect(ex - enemy.r, ey - enemy.r - 10, enemy.r * 2 * clamp(enemy.hp / Math.max(1, enemy.maxHp), 0, 1), 4);
      }
    }

    ctx.strokeStyle = '#fff3a0';
    ctx.lineWidth = 2;
    for (const projectile of state.projectiles) {
      ctx.beginPath();
      ctx.moveTo(c + projectile.x, c + projectile.y);
      ctx.lineTo(c + projectile.x - projectile.vx * 0.02, c + projectile.y - projectile.vy * 0.02);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(c + tower.x, c + tower.y);
    ctx.strokeStyle = 'rgba(125, 249, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(state.aimX * NEON_NEXUS.arenaR * 0.7, state.aimY * NEON_NEXUS.arenaR * 0.7);
    ctx.stroke();
    ctx.rotate(state.ticks * 0.02);
    ctx.strokeStyle = '#25f4e6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, NEON_NEXUS.towerR + 8, 0, Math.PI * 1.6);
    ctx.stroke();
    ctx.rotate(-state.ticks * 0.07);
    ctx.fillStyle = tower.lastHit < 0.2 && state.ticks % 6 < 3 ? '#ffffff' : '#1a2f5c';
    ctx.strokeStyle = '#7df9ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let k = 0; k <= 6; k++) {
      const a = (k * Math.PI) / 3;
      const vx = Math.cos(a) * NEON_NEXUS.towerR;
      const vy = Math.sin(a) * NEON_NEXUS.towerR;
      if (k === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    }
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#25f4e6';
    ctx.beginPath();
    ctx.arc(0, 0, NEON_NEXUS.towerR * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (tower.shield > 0) {
      const pulse = 0.65 + 0.35 * Math.sin(state.ticks * 0.16);
      ctx.strokeStyle = `rgba(125, 249, 255, ${pulse.toFixed(3)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(c + tower.x, c + tower.y, NEON_NEXUS.towerR + 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#b56bff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(c + tower.x, c + tower.y, NEON_NEXUS.towerR + 19, 0, Math.PI * 2);
      ctx.stroke();
    }

    const bossFlash = state.enemies.some((enemy) => enemy.type === 'boss');
    if (bossFlash) {
      ctx.strokeStyle = state.ticks % 12 < 6 ? '#ff3f6e' : '#5c1230';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, S - 4, S - 4);
    }
    if (state.cleared || state.offerPending || state.shopOpen) {
      ctx.textAlign = 'center';
      if (state.cleared) {
        ctx.fillStyle = 'rgba(255, 209, 102, 0.85)';
        ctx.font = 'bold 28px ui-monospace, monospace';
        ctx.fillText(`OLEADA ${state.wave}`, c, c);
      }
      if (state.offerPending || state.shopOpen) {
        ctx.fillStyle = '#7df9ff';
        ctx.font = '18px ui-monospace, monospace';
        ctx.fillText(state.shopOpen ? 'TIENDA' : 'ELIGE CARTA', c, c + 34);
      }
    }

    ctx.fillStyle = 'rgba(4, 6, 20, 0.82)';
    ctx.fillRect(0, 0, S, 44);
    ctx.font = '14px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7df9ff';
    ctx.fillText(`OLEADA ${state.wave} · BAJAS ${state.kills}`, 12, 20);
    ctx.fillStyle = '#1b2440';
    ctx.fillRect(12, 28, 180, 6);
    ctx.fillStyle = '#ff5b7a';
    ctx.fillRect(12, 28, 180 * clamp(tower.hp / Math.max(1, tower.maxHp), 0, 1), 6);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`PTS ${state.score}  ★${state.stars}  CR ${state.coins}`, S - 12, 20);
    ctx.fillStyle = '#1b2440';
    ctx.fillRect(S - 192, 28, 180, 6);
    ctx.fillStyle = tower.maxShield > 0 ? '#7df9ff' : '#39415f';
    ctx.fillRect(S - 192, 28, 180 * (tower.maxShield > 0 ? clamp(tower.shield / tower.maxShield, 0, 1) : 0), 6);
    ctx.restore();
  },

  observe(state) {
    const target = findTarget(state);
    return new Float32Array([
      clamp(state.tower.hp / Math.max(1, state.tower.maxHp), 0, 1),
      clamp(state.tower.shield / Math.max(1, state.tower.maxShield), 0, 1),
      clamp(state.tower.atk / 100, 0, 1),
      clamp(state.stars / 100, 0, 1),
      clamp(state.coins / 100, 0, 1),
      target === null ? 1 : clamp(Math.sqrt(dist2(target.x, target.y, 0, 0)) / NEON_NEXUS.arenaR, 0, 1),
      target === null ? 1 : clamp(target.hp / target.maxHp, 0, 1),
      clamp(state.enemies.length / 30, 0, 1),
      clamp(state.wave / 10, 0, 1),
      state.aimX,
      state.aimY,
      state.offerPending ? 1 : 0,
      state.shopOpen ? 1 : 0,
      state.over ? 1 : 0,
    ]);
  },

  rules: singlePlayerRules<NexusState>(
    (state) => state.wave * 100 + state.kills * 10 + state.stars + state.tower.hp - (state.over ? 200 : 0),
  ),
});
