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

  render(renderer, state, alpha) {
    void alpha; // Sin interpolación: el estado ya contiene las posiciones del frame.
    const ctx = renderer as CanvasRenderingContext2D | null;
    if (!ctx || typeof ctx.clearRect !== 'function') return;
    // Tempest no declara dimensiones: usamos un viewport local para proyectar el tubo.
    const width = 800;
    const height = 600;
    const cx = width / 2;
    const cy = height / 2;
    const radius = 240;
    const project = (side: number, depth: number): { x: number; y: number } => {
      const angle = -Math.PI / 2 + (side / TEMPEST.sides) * Math.PI * 2;
      const r = radius * Math.max(0, Math.min(1, depth));
      return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    };
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, width, height);

    // Tubo: anillos concéntricos y 16 radios desde el centro.
    ctx.lineWidth = 1;
    for (const depth of [0.25, 0.5, 0.75, 1]) {
      ctx.strokeStyle = depth === 1 ? '#5ef2ff' : '#16233a';
      ctx.beginPath();
      for (let side = 0; side <= TEMPEST.sides; side++) {
        const point = project(side % TEMPEST.sides, depth);
        if (side === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = '#101a2e';
    for (let side = 0; side < TEMPEST.sides; side++) {
      const inner = project(side, 0);
      const outer = project(side, 1);
      ctx.beginPath();
      ctx.moveTo(inner.x, inner.y);
      ctx.lineTo(outer.x, outer.y);
      ctx.stroke();
    }

    for (const bullet of state.bullets) {
      const point = project(bullet.angle, bullet.depth);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(point.x - 3, point.y - 3, 6, 6);
    }
    ctx.lineWidth = 2;
    for (const enemy of state.enemies) {
      const point = project(enemy.angle, enemy.depth);
      if (enemy.type === 'fuseball') {
        ctx.fillStyle = '#ff3fa4';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
        ctx.fill();
      } else if (enemy.type === 'pulsar') {
        ctx.fillStyle = '#ffb347';
        ctx.fillRect(point.x - 6, point.y - 6, 12, 12);
      } else {
        ctx.strokeStyle = '#5ef2ff';
        ctx.beginPath();
        ctx.moveTo(point.x, point.y - 7);
        ctx.lineTo(point.x + 7, point.y + 5);
        ctx.lineTo(point.x - 7, point.y + 5);
        ctx.closePath();
        ctx.stroke();
      }
    }

    const playerPoint = project(state.playerAngle, 1);
    ctx.strokeStyle = '#5ef2ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(playerPoint.x, playerPoint.y, 13, 0, Math.PI * 2);
    ctx.stroke();
    // Salto de esquiva y fin de partida: destellos breves desde el estado.
    if (state.jumping) {
      ctx.strokeStyle = '#ffd166';
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(state.jumpTimer * 14);
      ctx.beginPath();
      ctx.arc(playerPoint.x, playerPoint.y, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = state.jumping ? '#ffd166' : '#ff3fa4';
    ctx.beginPath();
    ctx.arc(playerPoint.x, playerPoint.y, 7, 0, Math.PI * 2);
    ctx.fill();
    if (state.over) {
      ctx.fillStyle = '#ff3fa4';
      ctx.globalAlpha = 0.2 + 0.2 * Math.sin(state.ticks * 0.25);
      ctx.beginPath();
      ctx.arc(cx, cy, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.font = '16px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5ef2ff';
    ctx.fillText(`PTS ${state.score}`, 12, 22);
    ctx.fillText(`OLEADA ${state.wave}`, 12, 42);
    ctx.textAlign = 'right';
    ctx.fillText(`NIVEL ${state.level}`, width - 12, 22);
    if (state.paused || state.over) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 32px monospace';
      ctx.fillStyle = '#ff3fa4';
      ctx.fillText(state.over ? 'FIN' : 'PAUSA', cx, cy);
    }
    ctx.restore();
  },
  rules: singlePlayerRules<TempestState>(
    (state) =>
      state.score + state.wave * 80 + state.ticks / 600 - (state.over ? 150 : 0),
  ),
});
