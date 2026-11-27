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
  /** Tolerancia original: 6 px recortados a cada hitbox antes de colisionar. */
  collisionMargin: 6,
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

/** Recorta un rectángulo por todos sus lados; hitboxes pequeñas dejan de colisionar. */
function inset(rect: { x: number; y: number; w: number; h: number }) {
  const margin = DINO.collisionMargin;
  return {
    x: rect.x + margin,
    y: rect.y + margin,
    w: Math.max(0, rect.w - margin * 2),
    h: Math.max(0, rect.h - margin * 2),
  };
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
      if (collision.aabbOverlap(inset(player), inset(obstacleRect(obstacle)))) {
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

  render(renderer, state, _alpha) {
    // alpha se ignora: el ciclo día/noche viene de state.isNight.
    const ctx = renderer as CanvasRenderingContext2D | null;
    if (!ctx || typeof ctx.clearRect !== 'function') return;
    const { width, height, groundY } = DINO;
    ctx.clearRect(0, 0, width, height);
    const night = state.isNight;
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    if (night) {
      sky.addColorStop(0, '#060b25');
      sky.addColorStop(1, '#1b2445');
    } else {
      sky.addColorStop(0, '#7dd3fc');
      sky.addColorStop(1, '#fef3c7');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = night ? '#e2e8f0' : '#fff7ae';
    ctx.beginPath();
    ctx.arc(width - 90, night ? 70 : 80, night ? 30 : 36, 0, Math.PI * 2);
    ctx.fill();
    if (night) {
      ctx.fillStyle = '#cbd5e1';
      for (let i = 0; i < 28; i++) {
        const size = i % 4 === 0 ? 2 : 1;
        ctx.fillRect((i * 137) % width, 18 + ((i * 59) % 130), size, size);
      }
    }

    ctx.fillStyle = night ? '#263149' : '#d6d3a6';
    ctx.fillRect(0, groundY, width, height - groundY);
    ctx.fillStyle = night ? '#475569' : '#78716c';
    const offset = Math.floor(state.distance) % 40;
    for (let x = -offset; x < width; x += 40) ctx.fillRect(x, groundY + 24, 20, 3);

    for (const obstacle of state.obstacles) {
      if (obstacle.type === 'cactus') {
        ctx.fillStyle = night ? '#15803d' : '#166534';
        ctx.fillRect(obstacle.x - obstacle.w / 2, obstacle.y, obstacle.w, obstacle.h);
        ctx.fillStyle = night ? '#22c55e' : '#16a34a';
        ctx.fillRect(obstacle.x - obstacle.w / 2 - 6, obstacle.y + obstacle.h * 0.35, 6, obstacle.h * 0.25);
        ctx.fillRect(obstacle.x + obstacle.w / 2, obstacle.y + obstacle.h * 0.45, 6, obstacle.h * 0.2);
      } else {
        const wing = Math.sin(obstacle.phase) * 6;
        ctx.fillStyle = night ? '#f472b6' : '#be123c';
        ctx.fillRect(obstacle.x - obstacle.w / 2, obstacle.y + 4, obstacle.w, obstacle.h - 8);
        ctx.beginPath();
        ctx.moveTo(obstacle.x - 8, obstacle.y + 6);
        ctx.lineTo(obstacle.x - 22, obstacle.y + 6 - wing);
        ctx.lineTo(obstacle.x - 4, obstacle.y + 14);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(obstacle.x + 8, obstacle.y + 6);
        ctx.lineTo(obstacle.x + 22, obstacle.y + 6 + wing);
        ctx.lineTo(obstacle.x + 4, obstacle.y + 14);
        ctx.closePath();
        ctx.fill();
      }
    }

    const w = state.ducking && state.onGround ? DINO.duckW : DINO.standW;
    const h = state.ducking && state.onGround ? DINO.duckH : DINO.standH;
    const top = state.y - h;
    ctx.fillStyle = night ? '#a3e635' : '#365314';
    ctx.fillRect(DINO.x, top, w, h);
    ctx.fillStyle = night ? '#0f172a' : '#f8fafc';
    ctx.fillRect(DINO.x + w - 10, top + 8, 5, 5);
    const stride = Math.floor(state.ticks / 5) % 2 === 0 ? 4 : -2;
    ctx.fillStyle = night ? '#65a30d' : '#1a2e05';
    ctx.fillRect(DINO.x + 5 + stride, state.y - 6, 8, 6);
    ctx.fillRect(DINO.x + w - 13 - stride, state.y - 6, 8, 6);

    ctx.fillStyle = night ? '#e2e8f0' : '#1c1917';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`${String(state.score).padStart(5, '0')} m`, width - 110, 32);
    ctx.font = '12px monospace';
    ctx.fillText(night ? 'NOCHE' : 'DÍA', 14, 26);
  },

  rules: singlePlayerRules<DinoState>((state) =>
    state.distance / 10 + state.milestone * 50 - (state.over ? 200 : 0),
  ),
});
