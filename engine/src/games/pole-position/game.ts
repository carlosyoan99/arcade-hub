import { defineGame } from '../../game/contract.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import { clamp, lerp } from '../../core/math.js';
import { COLLISION_SERVICE, type CollisionService } from '../../sim/collision.js';
import type { StepContext } from '../../core/simulation.js';

/**
 * Pole Position completo: clasificación de 75 s, carrera de 2 vueltas,
 * 8 rivales, posición de salida según tiempo, turbo, invencibilidad,
 * pickups en pista y 3 circuitos crecientes. Sin reloj real (B7).
 */
export const POLE_POSITION = {
  width: 480,
  height: 640,
  roadWidth: 160,
  carW: 12,
  carH: 20,
  rivalCount: 8,
  // Adaptación moderna: el original tenía 35 s para ~58 s de vuelta; se sube a 75 s para que la clasificación sea alcanzable.
  qualifySeconds: 75,
  raceSeconds: 60,
  raceLaps: 2,
  maxSpeed: 220,
  accel: 180,
  brake: 300,
  friction: 60,
  turnSpeed: 150,
  turboSpeed: 320,
  turboDuration: 2,
  turboCooldown: 5,
  invincDuration: 10,
  segments: 120,
  pickupCount: 8,
  circuits: 3,
} as const;

const SEGMENT_H = POLE_POSITION.height / 6;
const ROAD_LENGTH = POLE_POSITION.segments * SEGMENT_H;

export interface PoleRival {
  x: number;
  y: number;
  speed: number;
  phase: number;
}

export interface PolePickup {
  dist: number;
  x: number;
  kind: 'turbo' | 'invinc';
  collected: boolean;
}

export interface PolePositionState {
  paused: boolean;
  over: boolean;
  generation: number;
  winner: number | null;
  won: boolean;
  player: { x: number; y: number; speed: number; angle: number };
  rivals: PoleRival[];
  pickups: PolePickup[];
  roadOffset: number;
  laps: number;
  phase: 'qualify' | 'race';
  time: number;
  circuit: number;
  circuitPattern: string;
  position: number;
  turbo: number;
  turboCd: number;
  invinc: number;
  crashThisLap: number;
  qualifyingTime: number;
  score: number;
  ticks: number;
}

function wrapDistance(value: number): number {
  return ((value % ROAD_LENGTH) + ROAD_LENGTH) % ROAD_LENGTH;
}

function resetPole(state: PolePositionState, ctx: StepContext): void {
  state.generation += 1;
  state.paused = false;
  state.over = false;
  state.winner = null;
  state.won = false;
  state.player = {
    x: POLE_POSITION.width / 2,
    y: POLE_POSITION.height - 80,
    speed: 0,
    angle: 0,
  };
  state.rivals = [];
  state.pickups = [];
  state.roadOffset = 0;
  state.laps = 0;
  state.phase = 'qualify';
  state.time = POLE_POSITION.qualifySeconds;
  state.circuit = 0;
  state.circuitPattern = 'curve';
  state.position = POLE_POSITION.rivalCount + 1;
  state.turbo = 0;
  state.turboCd = 0;
  state.invinc = 0;
  state.crashThisLap = 0;
  state.qualifyingTime = 0;
  state.score = 0;
  state.ticks = 0;
  setupCircuit(state, ctx);
  ctx.emit('restart', { generation: state.generation });
}

function roadCurve(state: PolePositionState): number {
  const index = Math.floor((state.roadOffset + state.player.y) / SEGMENT_H) % POLE_POSITION.segments;
  const base = Math.sin(index * 0.08) * 0.6 + Math.sin(index * 0.03) * 0.4;
  const boost = state.circuitPattern === 'curve' ? 1.5 : 1;
  return clamp(base * (1 + state.circuit * 0.18) * boost, -1, 1);
}

function setupCircuit(state: PolePositionState, ctx: StepContext): void {
  const progress = ctx.progression.state;
  state.circuitPattern = ctx.progression.nextPattern() ?? 'curve';
  state.phase = 'qualify';
  state.time = POLE_POSITION.qualifySeconds;
  state.position = POLE_POSITION.rivalCount + 1;
  state.laps = 0;
  state.qualifyingTime = 0;
  state.turbo = 0;
  state.turboCd = 0;
  state.invinc = 0;
  state.crashThisLap = 0;
  state.roadOffset = 0;
  state.player.x = POLE_POSITION.width / 2;
  state.player.y = POLE_POSITION.height - 80;
  state.player.speed = 0;
  state.player.angle = 0;

  const k = 1 + state.circuit * 0.15;
  const traffic = state.circuitPattern === 'traffic' ? 1.2 : 1;
  state.rivals = [];
  for (let i = 0; i < POLE_POSITION.rivalCount; i++) {
    state.rivals.push({
      x: POLE_POSITION.width / 2 + ctx.rng.range(-0.3, 0.3) * POLE_POSITION.roadWidth,
      y: 100 + i * 60,
      speed: (80 + ctx.rng.range(0, 80)) * k * traffic * progress.speed,
      phase: ctx.rng.range(0, Math.PI * 2),
    });
  }
  state.pickups = [];
  for (let i = 0; i < POLE_POSITION.pickupCount; i++) {
    state.pickups.push({
      dist: (ROAD_LENGTH / POLE_POSITION.pickupCount) * i + ctx.rng.range(-100, 100),
      x: ctx.rng.range(-0.25, 0.25) * POLE_POSITION.roadWidth,
      kind: i % 2 === 0 ? 'turbo' : 'invinc',
      collected: false,
    });
  }
  ctx.emit('circuit', { circuit: state.circuit + 1, pattern: state.circuitPattern });
}

export const polePositionGame = defineGame<PolePositionState>({
  id: 'pole-position',
  meta: { title: 'Pole Position', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['accel', 'brake', 'left', 'right', 'turbo', 'pause', 'restart'],
  progression: {
    id: 'pole-position',
    levels: [
      { speed: 1, spawnInterval: 120, hazard: 0, label: 'Circuito 1' },
      { speed: 1.1, spawnInterval: 100, hazard: 0.15, label: 'Circuito 2' },
      { speed: 1.22, spawnInterval: 80, hazard: 0.3, label: 'Circuito 3' },
    ],
    pointsPerLevel: 1,
    dda: { enabled: true, window: 400, maxAdjust: 0.08 },
    patterns: ['curve', 'traffic', 'rain'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    const state: PolePositionState = {
      paused: false,
      over: false,
      generation: 0,
      winner: null,
      won: false,
      player: { x: POLE_POSITION.width / 2, y: POLE_POSITION.height - 80, speed: 0, angle: 0 },
      rivals: [],
      pickups: [],
      roadOffset: 0,
      laps: 0,
      phase: 'qualify',
      time: POLE_POSITION.qualifySeconds,
      circuit: 0,
      circuitPattern: 'curve',
      position: POLE_POSITION.rivalCount + 1,
      turbo: 0,
      turboCd: 0,
      invinc: 0,
      crashThisLap: 0,
      qualifyingTime: 0,
      score: 0,
      ticks: 0,
    };
    resetPole(state, ctx);
    return state;
  },

  step(state, ctx) {
    if (handleLifecycle(state, ctx, state.circuit, () => resetPole(state, ctx))) return;
    const dt = ctx.clock.dt;
    state.ticks += 1;
    const progress = ctx.progression.state;
    const collision = ctx.services.get<CollisionService>(COLLISION_SERVICE);

    state.time -= dt;
    if (state.time <= 0) {
      state.time = 0;
      state.over = true;
      state.winner = null;
      ctx.emit('gameOver', { score: state.score, qualified: state.phase === 'race' });
      return;
    }
    state.turboCd = Math.max(0, state.turboCd - dt);
    state.turbo = Math.max(0, state.turbo - dt);
    state.invinc = Math.max(0, state.invinc - dt);

    if (ctx.actions.consume('turbo') && state.turboCd <= 0 && state.turbo <= 0) {
      state.turbo = POLE_POSITION.turboDuration;
      state.turboCd = POLE_POSITION.turboCooldown;
      ctx.emit('turbo', { circuit: state.circuit + 1 });
      ctx.progression.observe(0.4);
    }

    const maxSpeed = state.turbo > 0 ? POLE_POSITION.turboSpeed : POLE_POSITION.maxSpeed;
    if (ctx.actions.isDown('accel')) {
      state.player.speed = Math.min(maxSpeed, state.player.speed + POLE_POSITION.accel * dt);
    } else if (ctx.actions.isDown('brake')) {
      state.player.speed = Math.max(0, state.player.speed - POLE_POSITION.brake * dt);
    } else {
      state.player.speed = Math.max(0, state.player.speed - POLE_POSITION.friction * dt);
    }
    if (ctx.actions.isDown('left')) state.player.angle -= POLE_POSITION.turnSpeed * dt;
    if (ctx.actions.isDown('right')) state.player.angle += POLE_POSITION.turnSpeed * dt;
    state.player.angle = clamp(state.player.angle, -1.2, 1.2);

    const previousX = state.player.x;
    state.player.x += (roadCurve(state) * state.player.speed * 0.8 + state.player.angle * 20) * dt;
    state.roadOffset += state.player.speed * dt;

    const minX = POLE_POSITION.width / 2 - POLE_POSITION.roadWidth / 2 + POLE_POSITION.carW;
    const maxX = POLE_POSITION.width / 2 + POLE_POSITION.roadWidth / 2 - POLE_POSITION.carW;
    // Corrección de bug: penalizar solo al cruzar el borde, no cada tick pegado a él.
    if (state.player.x < minX) {
      state.player.x = minX;
      if (previousX > minX) state.player.speed *= 0.5;
    }
    if (state.player.x > maxX) {
      state.player.x = maxX;
      if (previousX < maxX) state.player.speed *= 0.5;
    }

    let position = 1;
    const rainPenalty = state.circuitPattern === 'rain' ? 0.75 : 1;
    for (const rival of state.rivals) {
      rival.y -= rival.speed * dt;
      if (rival.y < -50) rival.y = POLE_POSITION.height + 50 + ctx.rng.range(0, 200);
      rival.phase += dt;
      const targetX = POLE_POSITION.width / 2 + Math.sin(rival.y * 0.02 + rival.phase) * POLE_POSITION.roadWidth * 0.3;
      rival.x = lerp(rival.x, targetX, Math.min(1, dt * 2));
      if (
        state.player.speed > 10 &&
        collision.circleAabb(
          { x: state.player.x, y: state.player.y, r: POLE_POSITION.carW },
          { x: rival.x - POLE_POSITION.carW / 2, y: rival.y - POLE_POSITION.carH / 2, w: POLE_POSITION.carW, h: POLE_POSITION.carH },
        ) &&
        state.invinc <= 0
      ) {
        state.player.speed *= 0.3 * rainPenalty;
        rival.speed *= 0.8;
        state.crashThisLap += 1;
        ctx.emit('crash', { x: rival.x, y: rival.y });
        ctx.progression.observe(-0.6);
      }
      if (rival.y < state.player.y) position += 1;
    }
    state.position = position;

    for (const pickup of state.pickups) {
      if (pickup.collected) continue;
      const d = wrapDistance(pickup.dist - (state.roadOffset + state.player.y));
      const threshold = (progress.spawnInterval ?? 120) / 6;
      if (d < threshold && Math.abs(pickup.x - (state.player.x - POLE_POSITION.width / 2)) < 46) {
        pickup.collected = true;
        if (pickup.kind === 'turbo') state.turbo = Math.max(state.turbo, POLE_POSITION.turboDuration);
        else state.invinc = POLE_POSITION.invincDuration;
        ctx.emit('pickup', { kind: pickup.kind });
        ctx.progression.observe(0.5);
      }
    }

    if (state.roadOffset >= ROAD_LENGTH) {
      state.roadOffset -= ROAD_LENGTH;
      state.laps += 1;
      ctx.emit('lap', { lap: state.laps + 1, phase: state.phase });
      if (state.phase === 'qualify') {
        state.qualifyingTime = POLE_POSITION.qualifySeconds - state.time;
        state.time = POLE_POSITION.raceSeconds;
        state.phase = 'race';
        state.laps = 0;
        state.position = clamp(
          1 + Math.floor((state.qualifyingTime - 22) * 0.55),
          1,
          POLE_POSITION.rivalCount,
        );
        state.crashThisLap = 0;
        ctx.emit('qualified', { position: state.position, time: state.qualifyingTime });
        ctx.progression.observe(0.7);
      } else {
        if (state.crashThisLap === 0) ctx.emit('cleanLap', { lap: state.laps });
        state.crashThisLap = 0;
        state.time = POLE_POSITION.raceSeconds;
        if (state.laps >= POLE_POSITION.raceLaps) {
          state.score = (POLE_POSITION.rivalCount + 1 - state.position) * 100 + Math.floor(state.time) * 10;
          if (state.position === 1 && state.circuit < POLE_POSITION.circuits - 1) {
            state.circuit += 1;
            ctx.emit('levelUp', { circuit: state.circuit + 1 });
            setupCircuit(state, ctx);
            ctx.progression.observe(1);
          } else {
            state.over = true;
            state.won = state.position === 1;
            state.winner = state.won ? 0 : null;
            if (state.won) state.score += 1000;
            ctx.emit(state.won ? 'win' : 'gameOver', { score: state.score });
          }
        }
      }
    }
  },

  observe(state) {
    let nearest: PoleRival | null = null;
    let nearestDy = Infinity;
    for (const rival of state.rivals) {
      const dy = Math.abs(rival.y - state.player.y);
      if (dy < nearestDy) {
        nearest = rival;
        nearestDy = dy;
      }
    }
    return new Float32Array([
      clamp(state.player.speed / POLE_POSITION.turboSpeed, 0, 1),
      clamp((state.player.x - POLE_POSITION.width / 2) / (POLE_POSITION.roadWidth / 2), -1, 1),
      clamp(state.player.angle / 1.2, -1, 1),
      state.turbo > 0 ? 1 : 0,
      state.invinc > 0 ? 1 : 0,
      clamp(state.time / POLE_POSITION.raceSeconds, 0, 1),
      clamp(state.position / (POLE_POSITION.rivalCount + 1), 0, 1),
      nearest === null ? 1 : clamp((nearest.y - state.player.y) / POLE_POSITION.height, -1, 1),
      nearest === null ? 1 : clamp((nearest.x - state.player.x) / POLE_POSITION.width, -1, 1),
      clamp(state.circuit / POLE_POSITION.circuits, 0, 1),
      state.over ? 1 : 0,
    ]);
  },

  rules: singlePlayerRules<PolePositionState>(
    (state) =>
      state.score +
      (POLE_POSITION.rivalCount + 1 - state.position) * 10 +
      state.circuit * 100 +
      (state.won ? 1000 : state.over ? -100 : 0),
  ),
});
