import type { StepContext } from '../../core/simulation.js';
import { clamp, lerp } from '../../core/math.js';
import { defineGame } from '../../game/contract.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import type { CollisionService } from '../../sim/collision.js';

/** Tempest — tubo de 16 caras, disparo hacia el centro y salto de esquiva. */
export const TEMPEST = {
  sides: 16,
  bulletSpeed: 1.05,
  enemySpeedBase: 30,
  enemyDepthFactor: 0.001,
  jumpDuration: 0.5,
  jumpSides: 2,
  waveDelay: 1.5,
  startLives: 1,
} as const;

type EnemyType = 'flipper' | 'fuseball' | 'pulsar';

interface Enemy {
  angle: number;
  depth: number;
  type: EnemyType;
  speed: number;
}

interface Bullet {
  angle: number;
  depth: number;
}

export interface TempestState {
  playerAngle: number;
  jumping: boolean;
  jumpTimer: number;
  jumpFrom: number;
  jumpTo: number;
  enemies: Enemy[];
  bullets: Bullet[];
  score: number;
  lives: number;
  wave: number;
  level: number;
  over: boolean;
  paused: boolean;
  ticks: number;
  progress: number;
  /** Deadline absoluto (en ticks) para la siguiente oleada; 0 = sin oleada pendiente. */
  spawnTimer: number;
  /** Deadline absoluto (en ticks) para el próximo refuerzo. */
  reinforcementAt: number;
  seed: number;
}

function wrapAngle(angle: number): number {
  return ((angle % TEMPEST.sides) + TEMPEST.sides) % TEMPEST.sides;
}

function spawnWave(state: TempestState, ctx: StepContext): void {
  state.wave++;
  state.level = Math.floor(state.wave / 3) + 1;
  const progress = ctx.progression.state;
  const pattern = ctx.progression.nextPattern() ?? 'flipper';
  const count = Math.min(48, 4 + state.wave * 2 + Math.round(progress.hazard * 4));
  for (let i = 0; i < count; i++) {
    const roll = ctx.rng.next();
    const type: EnemyType =
      roll < 0.3 ? 'flipper' : ctx.rng.next() < 0.5 ? 'fuseball' : 'pulsar';
    state.enemies.push({
      angle: ctx.rng.int(TEMPEST.sides),
      depth: ctx.rng.range(0, 0.25),
      type: pattern === 'tank' && i % 3 === 0 ? 'fuseball' : type,
      speed: TEMPEST.enemySpeedBase + state.level * 5,
    });
  }
  state.spawnTimer = 0;
  state.reinforcementAt = state.ticks + (progress.spawnInterval ?? 120);
  ctx.emit('levelUp', { wave: state.wave, level: state.level, pattern });
}

function reset(state: TempestState, ctx: StepContext): void {
  state.score = 0;
  state.lives = TEMPEST.startLives;
  state.wave = 0;
  state.level = 1;
  state.over = false;
  state.paused = false;
  state.ticks = 0;
  state.progress = 0;
  state.spawnTimer = 0;
  state.reinforcementAt = 0;
  state.playerAngle = 0;
  state.jumping = false;
  state.jumpTimer = 0;
  state.jumpFrom = 0;
  state.jumpTo = 0;
  state.enemies = [];
  state.bullets = [];
  spawnWave(state, ctx);
}

export const tempestGame = defineGame<TempestState>({
  id: 'tempest',
  meta: { title: 'Tempest', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['left', 'right', 'fire', 'jump', 'pause', 'restart'],
  progression: {
    id: 'tempest',
    levels: [
      { speed: 1, spawnInterval: 120, hazard: 0, label: 'Nivel 1' },
      { speed: 1.12, spawnInterval: 96, hazard: 0.2, label: 'Nivel 2' },
      { speed: 1.28, spawnInterval: 76, hazard: 0.4, label: 'Nivel 3' },
    ],
    pointsPerLevel: 600,
    dda: { enabled: true, window: 360, maxAdjust: 0.08 },
    patterns: ['flipper', 'tank', 'scramble'],
    avoidRepeat: 2,
  },

  init(seed, ctx) {
    const state: TempestState = {
      playerAngle: 0,
      jumping: false,
      jumpTimer: 0,
      jumpFrom: 0,
      jumpTo: 0,
      enemies: [],
      bullets: [],
      score: 0,
      lives: TEMPEST.startLives,
      wave: 0,
      level: 1,
      over: false,
      paused: false,
      ticks: 0,
      progress: 0,
      spawnTimer: 0,
      reinforcementAt: 0,
      seed,
    };
    reset(state, ctx);
    return state;
  },

  step(state, ctx) {
    if (handleLifecycle(state, ctx, state.progress, () => reset(state, ctx))) return;
    const dt = ctx.clock.dt;
    const collision = ctx.services.get<CollisionService>('collision');
    const progress = ctx.progression.state;
    const speed = progress.speed;
    state.ticks++;

    if (state.jumping) {
      state.jumpTimer -= dt;
      if (state.jumpTimer <= 0) {
        state.jumping = false;
        state.playerAngle = wrapAngle(state.jumpTo);
      } else {
        const t = 1 - state.jumpTimer / TEMPEST.jumpDuration;
        state.playerAngle = wrapAngle(lerp(state.jumpFrom, state.jumpTo, t));
      }
    } else {
      // B1: rotación y disparo son acciones distintas de `pause`.
      if (ctx.actions.consume('left')) state.playerAngle = wrapAngle(state.playerAngle - 1);
      if (ctx.actions.consume('right')) state.playerAngle = wrapAngle(state.playerAngle + 1);
    }
    if (ctx.actions.consume('jump') && !state.jumping) {
      state.jumping = true;
      state.jumpTimer = TEMPEST.jumpDuration;
      state.jumpFrom = state.playerAngle;
      state.jumpTo = wrapAngle(state.playerAngle + TEMPEST.jumpSides);
      ctx.emit('hit', { kind: 'jump', angle: state.playerAngle });
    }
    if (ctx.actions.consume('fire')) {
      state.bullets.push({ angle: state.playerAngle, depth: 1 });
      ctx.emit('shoot', { angle: state.playerAngle });
    }

    for (const bullet of state.bullets) bullet.depth -= TEMPEST.bulletSpeed * speed * dt;
    state.bullets = state.bullets.filter((bullet) => bullet.depth > -0.1);

    for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
      const enemy = state.enemies[ei];
      if (!enemy) continue;
      enemy.depth += enemy.speed * TEMPEST.enemyDepthFactor * speed * dt;
      if (enemy.depth < 1) continue;
      const aligned = Math.abs(enemy.angle - wrapAngle(state.playerAngle)) < 0.5;
      if (enemy.type === 'fuseball' || (aligned && !state.jumping)) {
        state.lives = 0;
        state.over = true;
        ctx.emit('explode', { angle: enemy.angle, depth: enemy.depth, kind: 'player' });
        ctx.emit('gameOver', { score: state.score });
        ctx.progression.observe(-1);
        return;
      }
      enemy.depth = 1;
      if (ctx.rng.next() < 0.01) ctx.emit('hit', { kind: 'flipper', angle: enemy.angle });
    }

    for (let bi = state.bullets.length - 1; bi >= 0 && !state.over; bi--) {
      const bullet = state.bullets[bi];
      if (!bullet) continue;
      for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
        const enemy = state.enemies[ei];
        if (!enemy) continue;
        if (!collision.circleAabb(
          { x: bullet.angle, y: bullet.depth, r: 0.15 },
          { x: enemy.angle - 0.8, y: enemy.depth - 0.15, w: 1.6, h: 0.3 },
        )) continue;
        state.enemies.splice(ei, 1);
        state.bullets.splice(bi, 1);
        const points = enemy.type === 'fuseball' ? 50 : 20;
        state.score += points;
        state.progress += points;
        ctx.emit('hit', { angle: enemy.angle, depth: enemy.depth });
        ctx.emit('explode', { angle: enemy.angle, depth: enemy.depth, points });
        ctx.emit('score', { score: state.score, points });
        ctx.progression.observe(0.4);
        break;
      }
    }

    // `spawnTimer` y `reinforcementAt` son deadlines absolutos en ticks: nunca
    // se mezclan acumuladores de segundos con comparaciones de tick.
    if (
      progress.hazard > 0 &&
      state.enemies.length > 0 &&
      state.enemies.length < 60 &&
      state.ticks >= state.reinforcementAt
    ) {
      state.enemies.push({
        angle: ctx.rng.int(TEMPEST.sides),
        depth: 0,
        type: 'pulsar',
        speed: TEMPEST.enemySpeedBase + state.level * 5,
      });
      state.reinforcementAt = state.ticks + (progress.spawnInterval ?? 120);
      ctx.emit('hit', { kind: 'reinforcement' });
    }

    if (state.enemies.length === 0) {
      if (state.spawnTimer === 0) {
        state.spawnTimer = state.ticks + Math.round(TEMPEST.waveDelay / dt);
      }
      if (state.ticks >= state.spawnTimer) spawnWave(state, ctx);
    }
  },

  observe(state, playerId) {
    void playerId;
    let nearestAngle = 0;
    let nearestDepth = 0;
    let best = Number.POSITIVE_INFINITY;
    for (const enemy of state.enemies) {
      const diff = Math.min(
        Math.abs(enemy.angle - state.playerAngle),
        TEMPEST.sides - Math.abs(enemy.angle - state.playerAngle),
      );
      if (diff < best) {
        best = diff;
        nearestAngle = enemy.angle;
        nearestDepth = enemy.depth;
      }
    }
    let angleDiff = nearestAngle - state.playerAngle;
    if (angleDiff > TEMPEST.sides / 2) angleDiff -= TEMPEST.sides;
    if (angleDiff < -TEMPEST.sides / 2) angleDiff += TEMPEST.sides;
    return new Float32Array([
      clamp((state.playerAngle / TEMPEST.sides) * 2 - 1, -1, 1),
      state.jumping ? 1 : -1,
      clamp(angleDiff / (TEMPEST.sides / 2), -1, 1),
      clamp(nearestDepth * 2 - 1, -1, 1),
      clamp((state.bullets.length / 6) * 2 - 1, -1, 1),
      clamp((state.enemies.length / 32) * 2 - 1, -1, 1),
      state.over ? -1 : 1,
    ]);
  },

  rules: singlePlayerRules<TempestState>(
    (state) =>
      state.score + state.wave * 80 + state.ticks / 600 - (state.over ? 150 : 0),
  ),
});
