import { clamp, lerp } from '../../core/math.js';
import type { StepContext } from '../../core/simulation.js';
import { defineGame } from '../../game/contract.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import { COLLISION_SERVICE, type CollisionService } from '../../sim/collision.js';

export const DINO = {
  width: 800,
  height: 400,
  groundY: 300,
  gravity: 1800,
  jumpVelocity: -620,
  fastFallMultiplier: 2.5,
  x: 80,
  standW: 30,
  standH: 55,
  duckW: 45,
  duckH: 30,
  baseSpeed: 280,
  maxSpeed: 680,
  speedRamp: 2.8,
  milestone: 100,
  pterodactylHeights: [270, 230, 190] as const,
} as const;

export interface DinoObstacle {
  type: 'cactus' | 'bird';
  /** x es el centro; y es la arista superior del hitbox. */
  x: number;
  y: number;
  w: number;
  h: number;
  phase: number;
}

export interface DinoState {
  y: number;
  vy: number;
  onGround: boolean;
  ducking: boolean;
  obstacles: DinoObstacle[];
  distance: number;
  score: number;
  speed: number;
  ticks: number;
  nextSpawnIn: number;
  milestone: number;
  isNight: boolean;
  over: boolean;
  paused: boolean;
  generation: number;
  pattern: string;
  lastLevel: number;
}

function initialState(ctx: StepContext): DinoState {
  return {
    y: DINO.groundY,
    vy: 0,
    onGround: true,
    ducking: false,
    obstacles: [],
    distance: 0,
    score: 0,
    speed: DINO.baseSpeed,
    ticks: 0,
    nextSpawnIn: 1.2,
    milestone: 0,
    isNight: false,
    over: false,
    paused: false,
    generation: 0,
    pattern: ctx.progression.nextPattern() ?? 'cactus',
    lastLevel: 0,
  };
}

function spawn(state: DinoState, ctx: StepContext, hazard: number): void {
  const pattern = ctx.progression.nextPattern();
  const birdChance = 0.1 + hazard * 0.5;
  const isBird = pattern === 'bird' || (pattern !== 'cactus' && ctx.rng.next() < birdChance);
  const x = DINO.width + 40;
  if (isBird) {
    const tier = ctx.rng.int(DINO.pterodactylHeights.length);
    const centerY = DINO.pterodactylHeights[tier]!;
    state.obstacles.push({ type: 'bird', x, y: centerY - 10, w: 50, h: 20, phase: ctx.rng.range(0, 6.28) });
    ctx.emit('spawn', { type: 'bird', y: centerY });
    return;
  }
  const clusters = 1 + ctx.rng.int(1 + Math.floor(hazard * 3));
  const h = 30 + ctx.rng.int(21);
  // B8: el cactus se asienta SOBRE el suelo (parte inferior = groundY), no centrado en él.
  state.obstacles.push({ type: 'cactus', x, y: DINO.groundY - h, w: clusters * 36, h, phase: 0 });
  ctx.emit('spawn', { type: 'cactus', clusters });
}

function obstacleRect(obstacle: DinoObstacle) {
  return { x: obstacle.x - obstacle.w / 2, y: obstacle.y, w: obstacle.w, h: obstacle.h };
}

function dinoRect(state: DinoState) {
  const w = state.ducking && state.onGround ? DINO.duckW : DINO.standW;
  const h = state.ducking && state.onGround ? DINO.duckH : DINO.standH;
  return { x: DINO.x, y: state.y - h, w, h };
}

export const dinoGame = defineGame<DinoState>({
  id: 'dino-runner',
  meta: { title: 'Dino Runner', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['jump', 'duck', 'restart', 'pause'],
  progression: {
    id: 'dino-runner',
    levels: [
      { speed: 1, spawnInterval: 100, hazard: 0, label: 'Nivel 1' },
      { speed: 1.12, spawnInterval: 86, hazard: 0.2, label: 'Nivel 2' },
      { speed: 1.28, spawnInterval: 72, hazard: 0.4, label: 'Nivel 3' },
    ],
    pointsPerLevel: 300,
    dda: { enabled: true, window: 400, maxAdjust: 0.08 },
    patterns: ['cactus', 'bird', 'night'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    return initialState(ctx);
  },

  step(state, ctx) {
    const generation = state.generation;
    if (
      handleLifecycle(state, ctx, state.distance, () => {
        Object.assign(state, initialState(ctx));
        state.generation = generation + 1;
      })
    ) {
      return;
    }
    if (state.generation !== generation) return;
    const collision = ctx.services.get<CollisionService>(COLLISION_SERVICE);
    const dt = ctx.clock.dt;
    const progress = ctx.progression.state;
    if (progress.level > state.lastLevel) {
      state.lastLevel = progress.level;
      state.pattern = ctx.progression.nextPattern() ?? state.pattern;
      if (state.pattern === 'night') {
        state.isNight = !state.isNight;
        ctx.emit('dayNight', { night: state.isNight, source: 'pattern' });
      }
      ctx.emit('levelUp', { level: progress.level + 1, pattern: state.pattern });
      ctx.schedule(2, () => {
        if (state.generation === generation && !state.paused && !state.over) {
          ctx.emit('milestoneChime', { level: state.lastLevel });
        }
      });
    }

    state.speed = clamp(
      (DINO.baseSpeed + state.ticks * dt * DINO.speedRamp) * progress.speed,
      DINO.baseSpeed,
      DINO.maxSpeed,
    );
    state.distance += (state.speed * dt) / 25;
    state.score = Math.floor(state.distance);

    if (ctx.actions.consume('jump') && state.onGround) {
      state.vy = DINO.jumpVelocity;
      state.onGround = false;
      state.ducking = false;
      ctx.emit('jump', { y: state.y });
    }
    const duckDown = ctx.actions.isDown('duck');
    state.ducking = duckDown && state.onGround;
    if (duckDown && !state.onGround) state.vy += DINO.gravity * (DINO.fastFallMultiplier - 1) * dt;
    if (!state.onGround) {
      state.vy += DINO.gravity * dt;
      state.y += state.vy * dt;
      if (state.y >= DINO.groundY) {
        state.y = DINO.groundY;
        state.vy = 0;
        state.onGround = true;
        ctx.emit('land', { y: state.y });
      }
    }

    const currentMilestone = Math.floor(state.distance / DINO.milestone);
    if (currentMilestone > state.milestone) {
      state.milestone = currentMilestone;
      state.isNight = !state.isNight;
      ctx.emit('milestone', { meters: currentMilestone * DINO.milestone });
      ctx.emit('dayNight', { night: state.isNight, source: 'cycle' });
      ctx.progression.observe(0.5);
    }

    state.nextSpawnIn -= dt;
    if (state.nextSpawnIn <= 0) {
      spawn(state, ctx, progress.hazard);
      const base = progress.spawnInterval ?? 100;
      state.nextSpawnIn = lerp(base * 0.8, base * 1.25, ctx.rng.next()) / 60;
    }

    const player = dinoRect(state);
    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const obstacle = state.obstacles[i]!;
      obstacle.x -= state.speed * dt;
      if (obstacle.type === 'bird') obstacle.phase += dt * 8;
      if (obstacle.x + obstacle.w / 2 < -40) {
        state.obstacles.splice(i, 1);
        continue;
      }
      if (collision.aabbOverlap(player, obstacleRect(obstacle))) {
        state.over = true;
        ctx.emit('crash', { type: obstacle.type, x: obstacle.x, y: obstacle.y });
        ctx.emit('gameOver', { distance: Math.floor(state.distance) });
        ctx.progression.observe(-1);
        break;
      }
    }
    state.ticks++;
  },

  observe(state) {
    const nearest = state.obstacles.reduce<DinoObstacle | null>(
      (best, obstacle) => (best === null || obstacle.x < best.x ? obstacle : best),
      null,
    );
    const player = dinoRect(state);
    return new Float32Array([
      (state.y / DINO.groundY) * 2 - 1,
      state.vy / 1000,
      state.onGround ? 1 : -1,
      state.ducking ? 1 : -1,
      nearest ? ((nearest.x - DINO.x) / DINO.width) * 2 - 1 : 1,
      nearest ? (nearest.y / DINO.height) * 2 - 1 : 0,
      nearest ? (nearest.w / DINO.width) * 2 - 1 : -1,
      nearest ? (nearest.h / DINO.height) * 2 - 1 : -1,
      nearest?.type === 'bird' ? 1 : -1,
      (state.speed / DINO.maxSpeed) * 2 - 1,
      state.isNight ? 1 : -1,
      Math.min(1, state.distance / 1000),
      (player.y / DINO.height) * 2 - 1,
      state.over ? 1 : -1,
    ]);
  },

  rules: singlePlayerRules<DinoState>((state) =>
    state.distance / 10 + state.milestone * 50 - (state.over ? 200 : 0),
  ),
});
