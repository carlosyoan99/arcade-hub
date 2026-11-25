import { defineGame } from '../../game/contract.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import { clamp, dist2, normalize2 } from '../../core/math.js';
import { COLLISION_SERVICE, type CollisionService } from '../../sim/collision.js';
import type { StepContext } from '../../core/simulation.js';

/**
 * Defender completo: humanos con paracaídas, aterrizadores en 4 fases,
 * bombarderos, mutantes, cuatro armas y oleadas. Los timers de oleada usan
 * ctx.schedule con generación/pausa (B6) y todo el azar es ctx.rng (B2/B5/B7).
 */
export const DEFENDER = {
  worldW: 6000,
  viewW: 600,
  height: 480,
  groundY: 400,
  shipSpeed: 280,
  laserSpeed: 900,
  maxLasers: 8,
  initialHumans: 10,
  initialBombs: 3,
  initialNuclear: 1,
  initialLives: 3,
  baseWaveTicks: 720,
  minWaveTicks: 300,
  hyperspaceCooldown: 5,
  humanPenalty: 50,
  maxLanders: 14,
} as const;

export interface DefenderHuman {
  id: number;
  x: number;
  y: number;
  vy: number;
  alive: boolean;
  grabbed: boolean;
  falling: boolean;
  parachute: boolean;
  saved: boolean;
}

export type DefenderEnemyPhase = 'entering' | 'hunting' | 'escaping' | 'flying' | 'chasing';

export interface DefenderEnemy {
  type: 'lander' | 'bomber' | 'mutant';
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  hp: number;
  size: number;
  targetX: number;
  phase: DefenderEnemyPhase;
  carrying: number | null;
  timer: number;
  wobble: number;
}

export interface DefenderLaser {
  x: number;
  y: number;
  vx: number;
}

export interface DefenderBomb {
  x: number;
  y: number;
  vy: number;
}

export interface DefenderState {
  paused: boolean;
  over: boolean;
  generation: number;
  winner: number | null;
  ship: { x: number; y: number; vx: number; vy: number; fireCd: number; invuln: number };
  cameraX: number;
  humans: DefenderHuman[];
  enemies: DefenderEnemy[];
  lasers: DefenderLaser[];
  bombs: DefenderBomb[];
  waves: number;
  waveActive: boolean;
  pendingSpawns: number;
  nextWaveAt: number;
  maxLanders: number;
  landerCount: number;
  bombsLeft: number;
  nuclearLeft: number;
  hyperspaceCd: number;
  lives: number;
  score: number;
  lostHumans: number;
  humansSaved: number;
  ticks: number;
}

/** Timer de juego: se reprograma si está pausado y se anula tras un reinicio (B6). */
function scheduleGame(state: DefenderState, ctx: StepContext, ticks: number, fn: () => void): void {
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

function resetDefender(state: DefenderState, ctx: StepContext): void {
  state.generation += 1;
  state.paused = false;
  state.over = false;
  state.winner = null;
  state.ship = { x: DEFENDER.viewW / 3, y: DEFENDER.height / 2, vx: 0, vy: 0, fireCd: 0, invuln: 0 };
  state.cameraX = 0;
  state.humans = [];
  for (let i = 0; i < DEFENDER.initialHumans; i++) {
    state.humans.push({
      id: i,
      x: 200 + i * 520,
      y: DEFENDER.groundY - 8,
      vy: 0,
      alive: true,
      grabbed: false,
      falling: false,
      parachute: false,
      saved: false,
    });
  }
  state.enemies = [];
  state.lasers = [];
  state.bombs = [];
  state.waves = 0;
  state.waveActive = false;
  state.pendingSpawns = 0;
  state.nextWaveAt = 60;
  state.maxLanders = 3;
  state.landerCount = 0;
  state.bombsLeft = DEFENDER.initialBombs;
  state.nuclearLeft = DEFENDER.initialNuclear;
  state.hyperspaceCd = 0;
  state.lives = DEFENDER.initialLives;
  state.score = 0;
  state.lostHumans = 0;
  state.humansSaved = 0;
  state.ticks = 0;
  ctx.emit('restart', { generation: state.generation });
}

function freeHuman(state: DefenderState, id: number, x: number, y: number): void {
  const human = state.humans.find((item) => item.id === id);
  if (human === undefined) return;
  human.grabbed = false;
  human.falling = true;
  human.parachute = true;
  human.vy = -80;
  human.x = x;
  human.y = y + 10;
}

function loseLife(state: DefenderState, ctx: StepContext): void {
  if (state.ship.invuln > 0 || state.over) return;
  state.lives -= 1;
  ctx.emit('hit', { lives: state.lives });
  if (state.lives <= 0) {
    state.over = true;
    state.winner = null;
    ctx.emit('gameOver', { score: state.score });
    return;
  }
  state.ship.x = state.cameraX + DEFENDER.viewW / 3;
  state.ship.y = DEFENDER.height / 2;
  state.ship.vx = 0;
  state.ship.vy = 0;
  state.ship.invuln = 1.5;
  state.nuclearLeft = DEFENDER.initialNuclear;
  state.hyperspaceCd = 0;
  ctx.progression.observe(-0.8);
}

function spawnEnemy(state: DefenderState, ctx: StepContext, type: DefenderEnemy['type']): void {
  const speed = ctx.progression.state.speed;
  const fromLeft = ctx.rng.next() < 0.5;
  const x = fromLeft ? state.cameraX - 20 : state.cameraX + DEFENDER.viewW + 20;
  const y = ctx.rng.range(30, 130);
  const wobble = ctx.rng.range(0, Math.PI * 2);

  if (type === 'lander') {
    const targets = state.humans.filter((h) => h.alive && !h.grabbed && !h.falling && !h.saved);
    state.enemies.push({
      type,
      x,
      y,
      vx: 0,
      vy: 30,
      speed: 80 * speed + state.waves * 5,
      hp: 1,
      size: 14,
      targetX: targets.length > 0 ? (targets[ctx.rng.int(targets.length)] as DefenderHuman).x : state.cameraX + 300,
      phase: 'entering',
      carrying: null,
      timer: 0,
      wobble,
    });
  } else if (type === 'bomber') {
    state.enemies.push({
      type,
      x,
      y,
      vx: (fromLeft ? 1 : -1) * (150 * speed),
      vy: 0,
      speed: 150 * speed + state.waves * 4,
      hp: 2,
      size: 16,
      targetX: x,
      phase: 'flying',
      carrying: null,
      timer: ctx.rng.range(1, 3),
      wobble,
    });
  } else {
    state.enemies.push({
      type,
      x,
      y: state.ship.y,
      vx: 0,
      vy: 0,
      speed: 160 * speed + state.waves * 3,
      hp: 1,
      size: 10,
      targetX: state.ship.x,
      phase: 'chasing',
      carrying: null,
      timer: 0,
      wobble,
    });
  }
  state.landerCount += 1;
}

function startWave(state: DefenderState, ctx: StepContext): void {
  const progress = ctx.progression.state;
  const pattern = ctx.progression.nextPattern() ?? 'lander';
  const base = 3 + Math.floor(state.waves / 2) + Math.round(progress.hazard * 3);
  const count = clamp(base + (pattern === 'swarm' ? 2 : 0), 2, state.maxLanders);
  const interval = progress.spawnInterval ?? 50;
  state.waveActive = true;
  ctx.emit('wave', { wave: state.waves + 1, pattern });

  for (let i = 0; i < count; i++) {
    const type: DefenderEnemy['type'] =
      pattern === 'smartbomb' && i % 2 === 1 ? 'bomber' : 'lander';
    state.pendingSpawns += 1;
    scheduleGame(state, ctx, i * interval, () => {
      state.pendingSpawns = Math.max(0, state.pendingSpawns - 1);
      spawnEnemy(state, ctx, type);
    });
  }
  state.nextWaveAt = state.ticks + Math.max(
    DEFENDER.minWaveTicks,
    Math.round((DEFENDER.baseWaveTicks - state.waves * 30) / progress.speed),
  );
}

export const defenderGame = defineGame<DefenderState>({
  id: 'defender',
  meta: { title: 'Defender', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: [
    'left', 'right', 'up', 'down', 'fire', 'bomb', 'hyperspace', 'nuclear', 'pause', 'restart',
  ],
  progression: {
    id: 'defender',
    levels: [
      { speed: 1, spawnInterval: 60, hazard: 0, label: 'Oleada 1' },
      { speed: 1.1, spawnInterval: 48, hazard: 0.2, label: 'Oleada 2' },
      { speed: 1.25, spawnInterval: 38, hazard: 0.45, label: 'Oleada 3' },
    ],
    pointsPerLevel: 1,
    dda: { enabled: true, window: 300, maxAdjust: 0.08 },
    patterns: ['lander', 'smartbomb', 'swarm'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    const state: DefenderState = {
      paused: false,
      over: false,
      generation: 0,
      winner: null,
      ship: { x: DEFENDER.viewW / 3, y: DEFENDER.height / 2, vx: 0, vy: 0, fireCd: 0, invuln: 0 },
      cameraX: 0,
      humans: [],
      enemies: [],
      lasers: [],
      bombs: [],
      waves: 0,
      waveActive: false,
      pendingSpawns: 0,
      nextWaveAt: 60,
      maxLanders: 3,
      landerCount: 0,
      bombsLeft: DEFENDER.initialBombs,
      nuclearLeft: DEFENDER.initialNuclear,
      hyperspaceCd: 0,
      lives: DEFENDER.initialLives,
      score: 0,
      lostHumans: 0,
      humansSaved: 0,
      ticks: 0,
    };
    resetDefender(state, ctx);
    return state;
  },

  step(state, ctx) {
    if (handleLifecycle(state, ctx, state.waves, () => resetDefender(state, ctx))) return;
    const dt = ctx.clock.dt;
    state.ticks += 1;
    const progress = ctx.progression.state;
    const speed = progress.speed;
    const collision = ctx.services.get<CollisionService>(COLLISION_SERVICE);

    if (state.ship.fireCd > 0) state.ship.fireCd -= dt;
    if (state.ship.invuln > 0) state.ship.invuln -= dt;
    if (state.hyperspaceCd > 0) state.hyperspaceCd -= dt;

    const direction = normalize2(
      Number(ctx.actions.isDown('right')) - Number(ctx.actions.isDown('left')),
      Number(ctx.actions.isDown('down')) - Number(ctx.actions.isDown('up')),
    );
    const { ship } = state;
    ship.x = clamp(ship.x + direction.x * DEFENDER.shipSpeed * dt, 30, DEFENDER.worldW - 30);
    ship.y = clamp(ship.y + direction.y * DEFENDER.shipSpeed * dt, 30, DEFENDER.height - 30);
    state.cameraX = clamp(ship.x - DEFENDER.viewW / 3, 0, DEFENDER.worldW - DEFENDER.viewW);

    if (ctx.actions.consume('fire') && ship.fireCd <= 0 && state.lasers.length < DEFENDER.maxLasers) {
      state.lasers.push({ x: ship.x + 12, y: ship.y, vx: DEFENDER.laserSpeed });
      ship.fireCd = 0.15;
      ctx.emit('shoot', { x: ship.x, y: ship.y });
    }

    if (ctx.actions.consume('bomb') && state.bombsLeft > 0) {
      state.bombsLeft -= 1;
      for (const enemy of state.enemies) {
        state.score += enemy.type === 'lander' ? 50 : enemy.type === 'bomber' ? 100 : 150;
        if (enemy.carrying !== null) freeHuman(state, enemy.carrying, enemy.x, enemy.y);
        ctx.emit('explode', { type: enemy.type, x: enemy.x, y: enemy.y });
      }
      state.enemies = [];
      state.landerCount = 0;
      ctx.emit('smartBomb', {});
      ctx.progression.observe(1);
    }

    if (ctx.actions.consume('hyperspace') && state.hyperspaceCd <= 0) {
      state.hyperspaceCd = DEFENDER.hyperspaceCooldown;
      ship.x = ctx.rng.range(30, DEFENDER.worldW - 30);
      ship.y = DEFENDER.groundY - 40 - ctx.rng.range(0, 120);
      ship.invuln = 0.5;
      ctx.emit('hyperspace', { x: ship.x, y: ship.y });
    }

    if (ctx.actions.consume('nuclear') && state.nuclearLeft > 0) {
      state.nuclearLeft -= 1;
      for (const enemy of state.enemies) {
        state.score += enemy.type === 'lander' ? 50 : enemy.type === 'bomber' ? 100 : 150;
        if (enemy.carrying !== null) freeHuman(state, enemy.carrying, enemy.x, enemy.y);
        ctx.emit('explode', { type: enemy.type, x: enemy.x, y: enemy.y });
      }
      state.enemies = [];
      state.bombs = [];
      state.landerCount = 0;
      ctx.emit('nuke', {});
      ctx.progression.observe(1);
    }

    // Láseres con sub-pasos (anti-tunneling), como el original.
    for (let i = state.lasers.length - 1; i >= 0; i--) {
      const laser = state.lasers[i];
      if (laser === undefined) continue;
      const steps = Math.max(1, Math.ceil(DEFENDER.laserSpeed * dt / 4));
      const subDt = dt / steps;
      let removed = false;
      for (let s = 0; s < steps && !removed; s++) {
        laser.x += laser.vx * subDt;
        if (laser.x - state.cameraX > DEFENDER.viewW + 20 || laser.x - state.cameraX < -20) {
          state.lasers.splice(i, 1);
          removed = true;
          break;
        }
        for (let j = state.enemies.length - 1; j >= 0; j--) {
          const enemy = state.enemies[j];
          if (enemy === undefined) continue;
          const radius = enemy.type === 'mutant' ? 10 : 14;
          if (dist2(laser.x, laser.y, enemy.x, enemy.y) >= radius * radius) continue;
          enemy.hp -= 1;
          state.lasers.splice(i, 1);
          removed = true;
          ctx.emit('hit', { type: enemy.type });
          if (enemy.hp <= 0) {
            state.score += enemy.type === 'lander' ? 150 : enemy.type === 'bomber' ? 250 : 300;
            if (enemy.carrying !== null) {
              freeHuman(state, enemy.carrying, enemy.x, enemy.y);
              ctx.emit('rescue', { id: enemy.carrying });
            }
            state.enemies.splice(j, 1);
            state.landerCount = Math.max(0, state.landerCount - 1);
            ctx.emit('explode', { type: enemy.type, x: enemy.x, y: enemy.y });
            ctx.progression.observe(0.5);
          }
          break;
        }
      }
    }

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const enemy = state.enemies[i];
      if (enemy === undefined) continue;
      if (enemy.type === 'lander') {
        if (enemy.phase === 'entering') {
          const diff = enemy.targetX - enemy.x;
          enemy.vx = Math.sign(diff) * enemy.speed;
          enemy.vy = 30;
          if (Math.abs(diff) < 20) enemy.phase = 'hunting';
        } else if (enemy.phase === 'hunting') {
          enemy.vx = Math.sin(enemy.wobble) * 40;
          enemy.vy = 60;
          enemy.wobble += dt * 2;
          const target = state.humans.find(
            (h) => h.alive && !h.grabbed && !h.falling && !h.saved && dist2(enemy.x, enemy.y, h.x, h.y) < 3600,
          );
          if (target !== undefined) {
            target.grabbed = true;
            enemy.carrying = target.id;
            enemy.phase = 'escaping';
            ctx.emit('abduct', { id: target.id });
            ctx.progression.observe(-0.6);
          }
        } else {
          enemy.vy = -enemy.speed * 0.8;
          enemy.vx = Math.sin(enemy.wobble) * 50;
          enemy.wobble += dt * 3;
          if (enemy.carrying !== null) {
            const human = state.humans.find((h) => h.id === enemy.carrying);
            if (human !== undefined) {
              human.x = enemy.x;
              human.y = enemy.y + 16;
              human.vy = 0;
            }
          }
          if (enemy.y < -30) {
            if (enemy.carrying !== null) {
              const human = state.humans.find((h) => h.id === enemy.carrying);
              if (human !== undefined) human.alive = false;
              state.lostHumans += 1;
              state.score = Math.max(0, state.score - DEFENDER.humanPenalty);
              spawnEnemy(state, ctx, 'mutant');
              ctx.emit('humanLost', { x: enemy.x });
              ctx.progression.observe(-1);
            }
            state.enemies.splice(i, 1);
            state.landerCount = Math.max(0, state.landerCount - 1);
            if (state.humans.every((h) => !h.alive || h.saved)) {
              state.over = true;
              ctx.emit('gameOver', { score: state.score });
            }
            continue;
          }
        }
      } else if (enemy.type === 'bomber') {
        enemy.timer -= dt;
        if (enemy.timer <= 0 && enemy.x > state.cameraX && enemy.x < state.cameraX + DEFENDER.viewW) {
          enemy.timer = ctx.rng.range(1, 3);
          state.bombs.push({ x: enemy.x, y: enemy.y + enemy.size, vy: 200 * speed });
          ctx.emit('bombDrop', { x: enemy.x });
        }
        if (enemy.x - state.cameraX < -100 || enemy.x - state.cameraX > DEFENDER.viewW + 100) {
          state.enemies.splice(i, 1);
          state.landerCount = Math.max(0, state.landerCount - 1);
          continue;
        }
      } else {
        const toPlayer = normalize2(ship.x - enemy.x, ship.y - enemy.y);
        enemy.vx = toPlayer.x * enemy.speed;
        enemy.vy = toPlayer.y * enemy.speed;
        enemy.wobble += dt * 5;
        if (dist2(ship.x, ship.y, enemy.x, enemy.y) > 640000) {
          state.enemies.splice(i, 1);
          state.landerCount = Math.max(0, state.landerCount - 1);
          continue;
        }
      }
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
    }

    for (let i = state.bombs.length - 1; i >= 0; i--) {
      const bomb = state.bombs[i];
      if (bomb === undefined) continue;
      bomb.y += bomb.vy * dt;
      if (bomb.y > DEFENDER.height + 20 || bomb.x - state.cameraX < -20 || bomb.x - state.cameraX > DEFENDER.viewW + 20) {
        state.bombs.splice(i, 1);
        continue;
      }
      if (
        collision.circleAabb(
          { x: bomb.x, y: bomb.y, r: 3 },
          { x: ship.x - 12, y: ship.y - 8, w: 24, h: 16 },
        )
      ) {
        state.bombs.splice(i, 1);
        loseLife(state, ctx);
      }
    }

    if (ship.invuln <= 0) {
      for (const enemy of state.enemies) {
        if (dist2(ship.x, ship.y, enemy.x, enemy.y) < (enemy.size + 10) ** 2) {
          loseLife(state, ctx);
          break;
        }
      }
    }

    for (const human of state.humans) {
      if (!human.alive || human.saved || !human.falling) continue;
      human.vy += 120 * dt;
      human.y += human.vy * dt;
      if (human.y >= DEFENDER.groundY - 8) {
        human.y = DEFENDER.groundY - 8;
        human.falling = false;
        human.saved = true;
        human.grabbed = false;
        human.vy = 0;
        state.humansSaved += 1;
        state.score += 100;
        ctx.emit('rescue', { id: human.id });
        ctx.progression.observe(0.8);
      }
    }

    if (!state.waveActive && state.ticks >= state.nextWaveAt) startWave(state, ctx);
    if (state.waveActive && state.pendingSpawns === 0 && state.enemies.length === 0) {
      state.waveActive = false;
      state.waves += 1;
      state.maxLanders = Math.min(state.maxLanders + 1, DEFENDER.maxLanders);
      const alive = state.humans.filter((h) => h.alive && !h.saved).length;
      state.score += alive * 100;
      state.nextWaveAt = state.ticks + 180;
      ctx.emit('levelUp', { wave: state.waves + 1 });
      ctx.progression.observe(1);
    }
  },

  observe(state) {
    const carrier = state.enemies.find((enemy) => enemy.carrying !== null);
    return new Float32Array([
      clamp(state.ship.x / DEFENDER.worldW, 0, 1),
      clamp(state.ship.y / DEFENDER.height, 0, 1),
      clamp(state.cameraX / (DEFENDER.worldW - DEFENDER.viewW), 0, 1),
      clamp(state.humans.filter((h) => h.alive && !h.saved).length / DEFENDER.initialHumans, 0, 1),
      clamp(state.enemies.length / DEFENDER.maxLanders, 0, 1),
      carrier === undefined ? 0 : clamp((carrier.y - state.ship.y) / DEFENDER.height, -1, 1),
      clamp(state.lives / DEFENDER.initialLives, 0, 1),
      clamp(state.bombsLeft / DEFENDER.initialBombs, 0, 1),
      state.over ? 1 : 0,
    ]);
  },

  rules: singlePlayerRules<DefenderState>(
    (state) => state.score + state.humansSaved * 100 - state.lostHumans * 50 + state.waves * 200,
  ),
});
