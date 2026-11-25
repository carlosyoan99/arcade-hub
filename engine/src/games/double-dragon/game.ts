import { defineGame } from '../../game/contract.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import { clamp, dist2, normalize2 } from '../../core/math.js';
import { COLLISION_SERVICE, type CollisionService } from '../../sim/collision.js';
import type { StepContext } from '../../core/simulation.js';

/**
 * Double Dragon completo: 4 actos con grunts + jefe, puñetazo/patada/combo,
 * armas (sword/bat/dynamite), vidas y pickups. El D-pad se mantiene con
 * isDown (B5) y las transiciones usan ctx.schedule con generación/pausa (B6).
 */
export const DOUBLE_DRAGON = {
  width: 480,
  height: 320,
  groundY: 250,
  playerW: 18,
  playerH: 28,
  punchRange: 28,
  kickRange: 34,
  comboRange: 30,
  punchDmg: 10,
  kickDmg: 18,
  comboDmg: 30,
  playerSpeed: 100,
  enemySpeed: 55,
  attackCooldown: 0.3,
  comboCooldown: 0.6,
  acts: 4,
  enemiesPerAct: [5, 7, 8, 10] as const,
  bossHp: [80, 120, 160, 250] as const,
  bossSpeed: [40, 50, 55, 65] as const,
  weaponDmg: { sword: 15, bat: 20, dynamite: 40 } as const,
  weaponTypes: ['sword', 'bat', 'dynamite'] as const,
  initialLives: 3,
  maxLives: 5,
  pickupDuration: 8,
  weaponDuration: 15,
} as const;

export type DragonEnemyType = 'punk' | 'thug' | 'soldier' | 'boss';
export type DragonWeapon = (typeof DOUBLE_DRAGON.weaponTypes)[number];

export interface DragonEnemy {
  x: number;
  y: number;
  type: DragonEnemyType;
  hp: number;
  maxHp: number;
  speed: number;
  attackTimer: number;
  hit: number;
  facing: number;
  alive: boolean;
}

export interface DragonPickup {
  x: number;
  y: number;
  type: DragonWeapon | 'life';
  timer: number;
}

export interface DragonState {
  paused: boolean;
  over: boolean;
  generation: number;
  winner: number | null;
  won: boolean;
  player: { x: number; y: number; facing: number; weapon: DragonWeapon | null; weaponTimer: number };
  enemies: DragonEnemy[];
  pickups: DragonPickup[];
  act: number;
  phase: 'grunts' | 'boss' | 'idle';
  actPattern: string;
  attackTimer: number;
  hurtCd: number;
  waiting: boolean;
  lives: number;
  score: number;
  kills: number;
  ticks: number;
}

function scheduleGame(state: DragonState, ctx: StepContext, ticks: number, fn: () => void): void {
  const generation = state.generation;
  ctx.schedule(ticks, () => {
    if (state.generation !== generation || state.over) return;
    if (state.paused) {
      scheduleGame(state, ctx, ticks, fn);
      return;
    }
    fn();
  });
}

function resetDragon(state: DragonState, ctx: StepContext): void {
  state.generation += 1;
  state.paused = false;
  state.over = false;
  state.winner = null;
  state.won = false;
  state.player = {
    x: DOUBLE_DRAGON.width / 2,
    y: DOUBLE_DRAGON.groundY,
    facing: 1,
    weapon: null,
    weaponTimer: 0,
  };
  state.enemies = [];
  state.pickups = [];
  state.act = 0;
  state.phase = 'idle';
  state.actPattern = 'grunt';
  state.attackTimer = 0;
  state.hurtCd = 0;
  state.waiting = true;
  state.lives = DOUBLE_DRAGON.initialLives;
  state.score = 0;
  state.kills = 0;
  state.ticks = 0;
  scheduleGame(state, ctx, 30, () => {
    state.waiting = false;
    state.actPattern = ctx.progression.nextPattern() ?? 'grunt';
    spawnGrunts(state, ctx);
  });
  ctx.emit('restart', { generation: state.generation });
}

function hurtPlayer(state: DragonState, ctx: StepContext, damage: number): void {
  if (state.hurtCd > 0 || state.over) return;
  state.hurtCd = 0.5;
  state.lives -= 1;
  ctx.emit('playerHit', { damage, lives: state.lives });
  ctx.progression.observe(-0.8);
  if (state.lives <= 0) {
    state.over = true;
    state.winner = null;
    ctx.emit('gameOver', { score: state.score });
  }
}

function spawnGrunts(state: DragonState, ctx: StepContext): void {
  const progress = ctx.progression.state;
  const base = DOUBLE_DRAGON.enemiesPerAct[state.act] ?? 5;
  const count = clamp(base + Math.round(progress.hazard * 3), 3, 16);
  state.enemies = [];
  for (let i = 0; i < count; i++) {
    const roll = ctx.rng.next() + progress.hazard * 0.15;
    let type: DragonEnemyType = 'punk';
    if (roll > 0.7) type = 'thug';
    if (roll > 0.9) type = 'soldier';
    if (state.actPattern === 'grunt' && i % 3 !== 0) type = 'punk';
    const hp = Math.round((type === 'punk' ? 25 : type === 'thug' ? 40 : 55) * (1 + progress.hazard * 0.2));
    state.enemies.push({
      x: ctx.rng.range(40, DOUBLE_DRAGON.width - 40),
      y: DOUBLE_DRAGON.groundY - 10 + ctx.rng.range(-10, 10),
      type,
      hp,
      maxHp: hp,
      speed: (DOUBLE_DRAGON.enemySpeed + (type === 'soldier' ? 15 : 0)) * progress.speed,
      attackTimer: ctx.rng.range(1, 3),
      hit: 0,
      facing: ctx.rng.next() < 0.5 ? 1 : -1,
      alive: true,
    });
  }
  state.phase = 'grunts';
  ctx.emit('act', { act: state.act + 1, pattern: state.actPattern, enemies: count });
}

function spawnBoss(state: DragonState, ctx: StepContext): void {
  const progress = ctx.progression.state;
  const hp = Math.round((DOUBLE_DRAGON.bossHp[state.act] ?? 80) * (1 + progress.hazard * 0.25));
  state.enemies = [
    {
      x: DOUBLE_DRAGON.width / 2,
      y: DOUBLE_DRAGON.groundY - 10,
      type: 'boss',
      hp,
      maxHp: hp,
      speed: (DOUBLE_DRAGON.bossSpeed[state.act] ?? 40) * progress.speed,
      attackTimer: 1.5,
      hit: 0,
      facing: -1,
      alive: true,
    },
  ];
  state.phase = 'boss';
  ctx.emit('boss', { act: state.act + 1, hp });
}

function dropPickup(state: DragonState, ctx: StepContext, x: number, y: number): void {
  const roll = ctx.rng.next();
  if (state.actPattern === 'weapon' || roll < 0.3) {
    const types = DOUBLE_DRAGON.weaponTypes;
    state.pickups.push({
      x,
      y,
      type: types[ctx.rng.int(types.length)] as DragonWeapon,
      timer: DOUBLE_DRAGON.pickupDuration,
    });
  }
  if (roll < 0.15) {
    state.pickups.push({ x: x + 10, y, type: 'life', timer: DOUBLE_DRAGON.pickupDuration });
  }
}

function attack(state: DragonState, ctx: StepContext, kind: 'punch' | 'kick' | 'combo'): void {
  if (state.attackTimer > 0 || state.over) return;
  const weapon = state.player.weapon;
  const damage =
    kind === 'punch'
      ? weapon !== null
        ? DOUBLE_DRAGON.weaponDmg[weapon]
        : DOUBLE_DRAGON.punchDmg
      : kind === 'kick'
        ? DOUBLE_DRAGON.kickDmg
        : DOUBLE_DRAGON.comboDmg;
  const range =
    kind === 'punch'
      ? DOUBLE_DRAGON.punchRange
      : kind === 'kick'
        ? DOUBLE_DRAGON.kickRange
        : DOUBLE_DRAGON.comboRange;
  state.attackTimer = kind === 'combo' ? DOUBLE_DRAGON.comboCooldown : DOUBLE_DRAGON.attackCooldown;
  ctx.emit('attack', { kind, damage });

  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - state.player.x;
    const facingOk = (state.player.facing > 0 && dx > 0) || (state.player.facing < 0 && dx < 0);
    const inRange = dist2(state.player.x, state.player.y, enemy.x, enemy.y) < range * range;
    if (!facingOk || !inRange) continue;
    enemy.hp -= damage;
    enemy.hit = 0.2;
    state.score += 10;
    ctx.emit('hit', { type: enemy.type, damage });
    if (enemy.hp <= 0) {
      enemy.alive = false;
      state.kills += 1;
      state.score += enemy.type === 'boss' ? 500 : 50;
      dropPickup(state, ctx, enemy.x, enemy.y);
      ctx.emit('explode', { type: enemy.type });
      ctx.progression.observe(0.7);
    }
    break;
  }
  if (weapon !== null) {
    state.player.weaponTimer -= 0.1;
    if (state.player.weaponTimer <= 0) state.player.weapon = null;
  }
}

export const doubleDragonGame = defineGame<DragonState>({
  id: 'double-dragon',
  meta: { title: 'Double Dragon', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: [
    'left', 'right', 'up', 'down', 'punch', 'kick', 'combo', 'pause', 'restart',
  ],
  progression: {
    id: 'double-dragon',
    levels: [
      { speed: 1, spawnInterval: 90, hazard: 0, label: 'Acto 1' },
      { speed: 1.1, spawnInterval: 75, hazard: 0.2, label: 'Acto 2' },
      { speed: 1.22, spawnInterval: 62, hazard: 0.4, label: 'Acto 3' },
    ],
    pointsPerLevel: 1,
    dda: { enabled: true, window: 400, maxAdjust: 0.08 },
    patterns: ['grunt', 'weapon', 'boss'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    const state: DragonState = {
      paused: false,
      over: false,
      generation: 0,
      winner: null,
      won: false,
      player: {
        x: DOUBLE_DRAGON.width / 2,
        y: DOUBLE_DRAGON.groundY,
        facing: 1,
        weapon: null,
        weaponTimer: 0,
      },
      enemies: [],
      pickups: [],
      act: 0,
      phase: 'idle',
      actPattern: 'grunt',
      attackTimer: 0,
      hurtCd: 0,
      waiting: true,
      lives: DOUBLE_DRAGON.initialLives,
      score: 0,
      kills: 0,
      ticks: 0,
    };
    resetDragon(state, ctx);
    return state;
  },

  step(state, ctx) {
    if (handleLifecycle(state, ctx, state.act, () => resetDragon(state, ctx))) return;
    const dt = ctx.clock.dt;
    state.ticks += 1;
    const progress = ctx.progression.state;
    const collision = ctx.services.get<CollisionService>(COLLISION_SERVICE);

    if (state.attackTimer > 0) state.attackTimer -= dt;
    if (state.hurtCd > 0) state.hurtCd -= dt;
    if (state.player.weaponTimer > 0) {
      state.player.weaponTimer -= dt;
      if (state.player.weaponTimer <= 0) state.player.weapon = null;
    }

    // B5: el D-pad mantenido mueve de forma continua (isDown, no pulsación única).
    const direction = normalize2(
      Number(ctx.actions.isDown('right')) - Number(ctx.actions.isDown('left')),
      Number(ctx.actions.isDown('down')) - Number(ctx.actions.isDown('up')),
    );
    if (direction.x !== 0 || direction.y !== 0) {
      state.player.x = clamp(
        state.player.x + direction.x * DOUBLE_DRAGON.playerSpeed * dt,
        DOUBLE_DRAGON.playerW,
        DOUBLE_DRAGON.width - DOUBLE_DRAGON.playerW,
      );
      state.player.y = clamp(
        state.player.y + direction.y * DOUBLE_DRAGON.playerSpeed * dt,
        DOUBLE_DRAGON.groundY - 40,
        DOUBLE_DRAGON.groundY + 20,
      );
      if (direction.x !== 0) state.player.facing = direction.x;
    }

    if (ctx.actions.consume('punch')) attack(state, ctx, 'punch');
    if (ctx.actions.consume('kick')) attack(state, ctx, 'kick');
    if (ctx.actions.consume('combo')) attack(state, ctx, 'combo');

    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      if (enemy.hit > 0) {
        enemy.hit -= dt;
        continue;
      }
      const dx = state.player.x - enemy.x;
      const dy = state.player.y - enemy.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 20) {
        const toPlayer = normalize2(dx, dy);
        enemy.x += toPlayer.x * enemy.speed * dt;
        enemy.y += toPlayer.y * enemy.speed * dt;
        enemy.facing = dx > 0 ? 1 : -1;
      }
      enemy.attackTimer -= dt * progress.speed;
      if (enemy.attackTimer <= 0 && d < 35) {
        enemy.attackTimer = 1.5 + ctx.rng.next();
        const damage = enemy.type === 'boss' ? 25 : enemy.type === 'soldier' ? 15 : enemy.type === 'thug' ? 12 : 8;
        hurtPlayer(state, ctx, damage);
      }
    }
    state.enemies = state.enemies.filter((enemy) => enemy.alive);

    for (let i = state.pickups.length - 1; i >= 0; i--) {
      const pickup = state.pickups[i];
      if (pickup === undefined) continue;
      pickup.timer -= dt;
      if (pickup.timer <= 0) {
        state.pickups.splice(i, 1);
        continue;
      }
      if (
        collision.circleAabb(
          { x: state.player.x, y: state.player.y, r: 25 },
          { x: pickup.x - 4, y: pickup.y - 4, w: 8, h: 8 },
        )
      ) {
        if (pickup.type === 'life') {
          state.lives = Math.min(DOUBLE_DRAGON.maxLives, state.lives + 1);
        } else {
          state.player.weapon = pickup.type;
          state.player.weaponTimer = DOUBLE_DRAGON.weaponDuration;
        }
        state.pickups.splice(i, 1);
        ctx.emit('pickup', { type: pickup.type });
        ctx.progression.observe(0.4);
      }
    }

    if (state.enemies.length === 0 && !state.waiting) {
      if (state.phase === 'grunts') {
        state.phase = 'boss';
        state.waiting = true;
        const delay = Math.round((progress.spawnInterval ?? 90) / 2);
        scheduleGame(state, ctx, delay, () => {
          state.waiting = false;
          spawnBoss(state, ctx);
        });
      } else if (state.phase === 'boss') {
        if (state.act < DOUBLE_DRAGON.acts - 1) {
          state.act += 1;
          state.phase = 'idle';
          state.waiting = true;
          ctx.emit('levelUp', { act: state.act + 1 });
          ctx.progression.observe(1);
          scheduleGame(state, ctx, Math.round(progress.spawnInterval ?? 90), () => {
            state.waiting = false;
            state.actPattern = ctx.progression.nextPattern() ?? 'grunt';
            spawnGrunts(state, ctx);
          });
        } else {
          state.over = true;
          state.won = true;
          state.winner = 0;
          state.score += 1000;
          ctx.emit('win', { score: state.score });
          ctx.emit('gameOver', { score: state.score });
        }
      }
    }
  },

  observe(state) {
    let nearest: DragonEnemy | null = null;
    let nearestD2 = Infinity;
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      const d2 = dist2(state.player.x, state.player.y, enemy.x, enemy.y);
      if (d2 < nearestD2) {
        nearest = enemy;
        nearestD2 = d2;
      }
    }
    return new Float32Array([
      clamp(state.player.x / DOUBLE_DRAGON.width, 0, 1),
      clamp((state.player.y - DOUBLE_DRAGON.groundY + 40) / 60, 0, 1),
      state.player.facing > 0 ? 1 : -1,
      state.player.weapon !== null ? 1 : 0,
      nearest === null ? 1 : clamp((nearest.x - state.player.x) / DOUBLE_DRAGON.width, -1, 1),
      nearest === null ? 1 : clamp((nearest.y - state.player.y) / DOUBLE_DRAGON.height, -1, 1),
      nearest === null ? 0 : clamp(nearest.hp / nearest.maxHp, 0, 1),
      clamp(state.enemies.length / 16, 0, 1),
      clamp(state.lives / DOUBLE_DRAGON.initialLives, 0, 1),
      clamp(state.act / DOUBLE_DRAGON.acts, 0, 1),
      state.over ? 1 : 0,
    ]);
  },

  rules: singlePlayerRules<DragonState>(
    (state) => state.score + state.kills * 10 + state.act * 100 + (state.won === true ? 1000 : state.over ? -200 : 0),
  ),
});
