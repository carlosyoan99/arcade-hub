import { defineGame } from '../../game/contract.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import { clamp } from '../../core/math.js';
import { COLLISION_SERVICE, type CollisionService } from '../../sim/collision.js';
import type { StepContext } from '../../core/simulation.js';

/**
 * Out Run completo: carretera pseudo-3D con 300 segmentos, 5 tramos, curvas,
 * colinas, tráfico, turbo y temporizador. B2 queda corregido: `turbo` y
 * `pause` son acciones distintas y el juego nunca lee la tecla Espacio.
 */
export const OUT_RUN = {
  width: 480,
  height: 360,
  segments: 300,
  segmentLength: 12,
  maxSpeed: 240,
  accel: 160,
  brake: 280,
  friction: 40,
  turnSpeed: 180,
  turboMult: 1.8,
  turboDuration: 2.5,
  turboCooldown: 6,
  stages: 5,
  rivalCount: 8,
  initialTime: 75,
} as const;

const STAGE_LENGTH = OUT_RUN.segments * OUT_RUN.segmentLength;

export interface OutRunSegment {
  curve: number;
  hill: number;
  tree: boolean;
}

export interface OutRunRival {
  z: number;
  x: number;
  speed: number;
}

export interface OutRunState {
  paused: boolean;
  over: boolean;
  generation: number;
  winner: number | null;
  won: boolean;
  player: { x: number; speed: number };
  segments: OutRunSegment[];
  rivals: OutRunRival[];
  camZ: number;
  stage: number;
  stagePattern: string;
  time: number;
  turbo: number;
  turboCd: number;
  score: number;
  ticks: number;
}

function resetOutRun(state: OutRunState, ctx: StepContext): void {
  state.generation += 1;
  state.paused = false;
  state.over = false;
  state.winner = null;
  state.won = false;
  state.player = { x: 0, speed: 0 };
  state.segments = [];
  for (let i = 0; i < OUT_RUN.segments; i++) {
    const noise = ctx.rng.range(-0.25, 0.25);
    state.segments.push({
      curve: clamp(Math.sin(i * 0.02) * 0.6 + Math.sin(i * 0.007) * 0.8 + noise, -1, 1),
      hill: Math.sin(i * 0.015) * 30,
      tree: ctx.rng.next() < 0.04,
    });
  }
  state.rivals = [];
  for (let i = 0; i < OUT_RUN.rivalCount; i++) {
    state.rivals.push({
      z: 200 + i * 150 + ctx.rng.range(0, 100),
      x: ctx.rng.range(-0.6, 0.6),
      speed: ctx.rng.range(80, 140),
    });
  }
  state.camZ = 0;
  state.stage = 0;
  state.stagePattern = 'curve';
  state.time = OUT_RUN.initialTime;
  state.turbo = 0;
  state.turboCd = 0;
  state.score = 0;
  state.ticks = 0;
  ctx.emit('restart', { generation: state.generation });
}

function curveAt(state: OutRunState, z: number): number {
  const index = Math.floor(z / OUT_RUN.segmentLength) % OUT_RUN.segments;
  return state.segments[index]?.curve ?? 0;
}

export const outRunGame = defineGame<OutRunState>({
  id: 'out-run',
  meta: { title: 'Out Run', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['accel', 'brake', 'left', 'right', 'turbo', 'pause', 'restart'],
  progression: {
    id: 'out-run',
    levels: [
      { speed: 1, spawnInterval: 90, hazard: 0, label: 'Tramo 1' },
      { speed: 1.08, spawnInterval: 75, hazard: 0.15, label: 'Tramo 2' },
      { speed: 1.18, spawnInterval: 60, hazard: 0.3, label: 'Tramo 3' },
    ],
    pointsPerLevel: 1,
    dda: { enabled: true, window: 400, maxAdjust: 0.08 },
    patterns: ['curve', 'traffic', 'night'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    const state: OutRunState = {
      paused: false,
      over: false,
      generation: 0,
      winner: null,
      won: false,
      player: { x: 0, speed: 0 },
      segments: [],
      rivals: [],
      camZ: 0,
      stage: 0,
      stagePattern: 'curve',
      time: OUT_RUN.initialTime,
      turbo: 0,
      turboCd: 0,
      score: 0,
      ticks: 0,
    };
    resetOutRun(state, ctx);
    return state;
  },

  step(state, ctx) {
    if (handleLifecycle(state, ctx, state.stage, () => resetOutRun(state, ctx))) return;
    const dt = ctx.clock.dt;
    state.ticks += 1;
    const progress = ctx.progression.state;
    const collision = ctx.services.get<CollisionService>(COLLISION_SERVICE);

    state.time -= dt;
    if (state.time <= 0) {
      state.time = 0;
      state.over = true;
      state.winner = null;
      ctx.emit('gameOver', { score: state.score });
      return;
    }
    state.turboCd = Math.max(0, state.turboCd - dt);
    state.turbo = Math.max(0, state.turbo - dt);

    // B2: turbo es su propia acción nombrada, independiente de `pause`.
    if (ctx.actions.consume('turbo') && state.turboCd <= 0 && state.turbo <= 0) {
      state.turbo = OUT_RUN.turboDuration;
      state.turboCd = OUT_RUN.turboCooldown;
      ctx.emit('turbo', { stage: state.stage + 1 });
      ctx.progression.observe(0.4);
    }

    const maxSpeed = state.turbo > 0 ? OUT_RUN.maxSpeed * OUT_RUN.turboMult : OUT_RUN.maxSpeed;
    if (ctx.actions.isDown('accel')) {
      state.player.speed = Math.min(maxSpeed, state.player.speed + OUT_RUN.accel * dt);
    } else if (ctx.actions.isDown('brake')) {
      state.player.speed = Math.max(0, state.player.speed - OUT_RUN.brake * dt);
    } else {
      state.player.speed = Math.max(0, state.player.speed - OUT_RUN.friction * dt);
    }

    const steering = OUT_RUN.turnSpeed * dt * (state.player.speed / OUT_RUN.maxSpeed) / 100;
    if (ctx.actions.isDown('left')) state.player.x -= steering;
    if (ctx.actions.isDown('right')) state.player.x += steering;
    state.player.x = clamp(state.player.x, -2.5, 2.5);
    const curveBoost = state.stagePattern === 'curve' ? 1.4 : 1;
    state.player.x = clamp(
      state.player.x + curveAt(state, state.camZ) * state.player.speed * dt * 0.003 * curveBoost,
      -2.5,
      2.5,
    );

    state.camZ += state.player.speed * dt;
    state.score = Math.floor(state.camZ * 0.01);

    if (state.camZ >= (state.stage + 1) * STAGE_LENGTH) {
      state.stage += 1;
      state.time = clamp(state.time + 15, 0, 90);
      state.stagePattern = ctx.progression.nextPattern() ?? 'curve';
      ctx.emit('stage', { stage: state.stage + 1, pattern: state.stagePattern });
      ctx.emit('levelUp', { stage: state.stage + 1 });
      ctx.progression.observe(1);
      if (state.stage >= OUT_RUN.stages) {
        state.won = true;
        state.over = true;
        state.winner = 0;
        state.score += 1000;
        ctx.emit('win', { score: state.score });
        return;
      }
    }

    const trafficBoost = state.stagePattern === 'traffic' ? 1.25 : 1;
    for (const rival of state.rivals) {
      rival.z -= rival.speed * progress.speed * trafficBoost * dt;
      if (rival.z < state.camZ - 50) {
        rival.z = state.camZ + 500 + ctx.rng.range(0, (progress.spawnInterval ?? 90) * 3);
        rival.x = ctx.rng.range(-0.6, 0.6);
      }
      if (
        state.player.speed > 10 &&
        Math.abs(rival.x - state.player.x) < 0.6 &&
        Math.abs(rival.z - state.camZ) < 30 &&
        collision.circleAabb(
          { x: rival.x, y: rival.z - state.camZ, r: 0.3 },
          { x: state.player.x - 0.3, y: -15, w: 0.6, h: 30 },
        )
      ) {
        state.player.speed *= 0.3 - progress.hazard * 0.1;
        ctx.emit('crash', { z: rival.z });
        ctx.progression.observe(-0.6);
      }
    }
  },

  render(renderer, state, _alpha) {
    // _alpha: la carretera se dibuja con la posición exacta del tick.
    const ctx = renderer as CanvasRenderingContext2D | null;
    if (!ctx || typeof ctx.clearRect !== 'function') return;
    const W = OUT_RUN.width;
    const H = OUT_RUN.height;
    const horizon = H * 0.42;
    const bands = 44;
    const drawDist = bands * OUT_RUN.segmentLength;

    const centerAt = (z: number, p: number): number => {
      let bend = 0;
      for (let i = 0; i < 6; i++) bend += curveAt(state, z + i * OUT_RUN.segmentLength) * (i + 1) * 0.35;
      return W / 2 + bend * p;
    };
    const project = (dz: number) => {
      const t = clamp(1 - dz / drawDist, 0, 1);
      return {
        t,
        y: horizon + (H - horizon) * t * t,
        half: W * (0.05 + 0.5 * t),
        center: centerAt(state.camZ + dz, t),
      };
    };

    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0620';
    ctx.fillRect(0, 0, W, horizon + 2);
    ctx.fillStyle = '#3a0f5c';
    ctx.fillRect(0, horizon - 34, W, 34);
    ctx.fillStyle = '#ff5f7a';
    ctx.beginPath();
    ctx.arc(W * 0.72, horizon - 18, 26, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(0, horizon - 6, W, 2);
    ctx.fillStyle = '#07161c';
    ctx.fillRect(0, horizon, W, H - horizon);

    for (let b = 0; b < bands; b++) {
      const tFar = b / bands;
      const tNear = (b + 1) / bands;
      const seg = state.segments[b];
      const hill = seg?.hill ?? 0;
      const yFar = horizon + (H - horizon) * tFar * tFar - hill * tFar * 0.35;
      const yNear = horizon + (H - horizon) * tNear * tNear - hill * tNear * 0.35;
      const cFar = centerAt(state.camZ + tFar * drawDist, tFar);
      const cNear = centerAt(state.camZ + tNear * drawDist, tNear);
      const hFar = W * (0.05 + 0.5 * tFar);
      const hNear = W * (0.05 + 0.5 * tNear);
      ctx.fillStyle = b % 2 === 0 ? '#071b1c' : '#0a2422';
      ctx.fillRect(0, yFar, W, Math.max(1, yNear - yFar + 1));
      ctx.fillStyle = b % 2 === 0 ? '#161a36' : '#12162e';
      ctx.beginPath();
      ctx.moveTo(cFar - hFar, yFar);
      ctx.lineTo(cFar + hFar, yFar);
      ctx.lineTo(cNear + hNear, yNear);
      ctx.lineTo(cNear - hNear, yNear);
      ctx.lineTo(cFar - hFar, yFar);
      ctx.fill();
      ctx.strokeStyle = b % 2 === 0 ? '#25f4e6' : '#ff2fa4';
      ctx.lineWidth = 1 + tNear * 2;
      ctx.beginPath();
      ctx.moveTo(cFar - hFar, yFar);
      ctx.lineTo(cNear - hNear, yNear);
      ctx.moveTo(cFar + hFar, yFar);
      ctx.lineTo(cNear + hNear, yNear);
      ctx.stroke();
      if (b % 3 === 0) {
        ctx.strokeStyle = '#f8f3d0';
        ctx.lineWidth = 1 + tNear;
        ctx.beginPath();
        ctx.moveTo(cFar, yFar);
        ctx.lineTo(cNear, yNear);
        ctx.stroke();
      }
      if (seg?.tree === true) {
        const tx = cNear - hNear - 6 - (b % 3) * 5;
        const size = 4 + 12 * tNear;
        ctx.fillStyle = '#1bf0a0';
        ctx.beginPath();
        ctx.moveTo(tx, yNear - size);
        ctx.lineTo(tx - size * 0.7, yNear);
        ctx.lineTo(tx + size * 0.7, yNear);
        ctx.lineTo(tx, yNear - size);
        ctx.fill();
      }
    }

    for (const rival of state.rivals) {
      const dz = rival.z - state.camZ;
      if (dz < 5 || dz > drawDist) continue;
      const { y, half, center, t } = project(dz);
      const cx = center + rival.x * half;
      const cw = 4 + 22 * t;
      const ch = 3 + 14 * t;
      ctx.fillStyle = '#ff3f6e';
      ctx.fillRect(cx - cw / 2, y - ch, cw, ch);
      ctx.strokeStyle = '#ffd0dc';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - cw / 2, y - ch, cw, ch);
    }

    const turboOn = state.turbo > 0;
    if (turboOn) {
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.8)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const sy = (state.ticks * 9 + i * 47) % H;
        const sx = (i * 83) % W;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy + 22);
        ctx.stroke();
      }
    }
    const px = W / 2 + state.player.x * 46;
    const py = H - 26;
    ctx.fillStyle = turboOn && state.ticks % 8 < 4 ? '#ffffff' : '#24e6ff';
    ctx.beginPath();
    ctx.moveTo(px - 22, py + 10);
    ctx.lineTo(px - 15, py - 8);
    ctx.lineTo(px + 15, py - 8);
    ctx.lineTo(px + 22, py + 10);
    ctx.lineTo(px - 22, py + 10);
    ctx.fill();
    ctx.fillStyle = '#ff2f5e';
    ctx.fillRect(px - 16, py + 7, 8, 3);
    ctx.fillRect(px + 8, py + 7, 8, 3);

    ctx.fillStyle = 'rgba(4, 6, 20, 0.78)';
    ctx.fillRect(0, 0, W, 34);
    ctx.font = '14px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7df9ff';
    ctx.fillText(`PTS ${state.score}`, 10, 22);
    ctx.textAlign = 'center';
    ctx.fillText(`TRAMO ${state.stage + 1}/${OUT_RUN.stages}`, W / 2, 22);
    ctx.textAlign = 'right';
    ctx.fillStyle = state.time < 10 ? '#ff4d6d' : '#7df9ff';
    ctx.fillText(`T ${state.time.toFixed(1)}`, W - 10, 22);
    ctx.fillStyle = '#1b2440';
    ctx.fillRect(10, H - 10, 120, 5);
    ctx.fillStyle = turboOn ? '#ffd166' : '#24e6ff';
    const turboFill = turboOn
      ? state.turbo / OUT_RUN.turboDuration
      : 1 - state.turboCd / OUT_RUN.turboCooldown;
    ctx.fillRect(10, H - 10, 120 * clamp(turboFill, 0, 1), 5);
    ctx.restore();
  },

  observe(state) {
    let nearest: OutRunRival | null = null;
    let nearestDz = Infinity;
    for (const rival of state.rivals) {
      const dz = Math.abs(rival.z - state.camZ);
      if (dz < nearestDz) {
        nearest = rival;
        nearestDz = dz;
      }
    }
    return new Float32Array([
      clamp(state.player.speed / (OUT_RUN.maxSpeed * OUT_RUN.turboMult), 0, 1),
      clamp(state.player.x / 2.5, -1, 1),
      state.turbo > 0 ? 1 : 0,
      clamp(state.turboCd / OUT_RUN.turboCooldown, 0, 1),
      clamp(state.stage / OUT_RUN.stages, 0, 1),
      clamp(state.time / 90, 0, 1),
      nearest === null ? 1 : clamp((nearest.z - state.camZ) / 800, 0, 1),
      nearest === null ? 1 : clamp(nearest.x / 2.5, -1, 1),
      clamp(state.camZ / (OUT_RUN.stages * STAGE_LENGTH), 0, 1),
      state.over ? 1 : 0,
    ]);
  },

  rules: singlePlayerRules<OutRunState>(
    (state) => state.score + state.stage * 200 + (state.won ? 1000 : state.over ? -100 : 0),
  ),
});
