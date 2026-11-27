import { defineGame } from '../../game/contract.js';
import type { StepContext } from '../../core/simulation.js';
import { clamp, dist2 } from '../../core/math.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import { COLLISION_SERVICE, type CollisionService, type AABB } from '../../sim/collision.js';

export const FROGGER = {
  cols: 13,
  rows: 15,
  cs: 36,
  levels: 5,
  maxLives: 3,
  timeLimit: 60,
  crocChance: 0.18,
  goalX: [1, 3.5, 6, 8.5, 11],
  extraLives: [10000, 20000],
} as const;

type LaneType = 'goal' | 'safe' | 'river' | 'road' | 'start';
interface Lane {
  type: LaneType;
  dir?: number;
  speed?: number;
  turtles?: boolean;
  croc?: boolean;
}
const LANES: readonly Lane[] = [
  { type: 'goal' },
  { type: 'safe' },
  { type: 'river', dir: 1, speed: 60 },
  { type: 'river', dir: -1, speed: 80 },
  { type: 'river', dir: 1, speed: 50, turtles: true },
  { type: 'river', dir: -1, speed: 70, turtles: true },
  { type: 'river', dir: 1, speed: 90, croc: true },
  { type: 'safe' },
  { type: 'road', dir: -1, speed: 80 },
  { type: 'road', dir: 1, speed: 55 },
  { type: 'road', dir: -1, speed: 150 },
  { type: 'road', dir: 1, speed: 90 },
  { type: 'road', dir: -1, speed: 65 },
  { type: 'safe' },
  { type: 'start' },
];

export interface Obstacle {
  row: number;
  x: number;
  y: number;
  w: number;
  h: number;
  dir: number;
  speed: number;
  type: 'truck' | 'racecar' | 'car' | 'log' | 'turtle' | 'croc';
  divePeriod: number;
  diveDur: number;
  divePhase: number;
  hasCroc: boolean;
  crocTimer: number;
  crocPeriod: number;
  crocMouthOpen: boolean;
}
export interface BonusItem {
  row: number;
  x: number;
  y: number;
  type: 'snake' | 'fly' | 'butterfly';
  timer: number;
  collected: boolean;
}
/** Bonus del original: tipo aleatorio ponderado con RNG sembrado (sin Math.random). */
function randomBonusType(ctx: StepContext): BonusItem['type'] {
  const roll = ctx.rng.next();
  return roll < 0.3 ? 'snake' : roll < 0.7 ? 'fly' : 'butterfly';
}

export interface FroggerState {
  x: number;
  y: number;
  dir: number;
  obstacles: Obstacle[];
  bonusItems: BonusItem[];
  goals: number[];
  moveTimer: number;
  timeLeft: number;
  tenSaid: boolean;
  extraLifeGiven: { 10000: boolean; 20000: boolean };
  simTime: number;
  score: number;
  lives: number;
  level: number;
  progress: number;
  paused: boolean;
  over: boolean;
  ticks: number;
  pattern: string | null;
}

function makeObstacle(
  row: number,
  dir: number,
  w: number,
  h: number,
  speed: number,
  type: Obstacle['type'],
  ctx: StepContext,
): Obstacle {
  return {
    row,
    x: ctx.rng.range(-FROGGER.cs, FROGGER.cols * FROGGER.cs),
    y: row * FROGGER.cs + FROGGER.cs / 2,
    w,
    h,
    dir,
    speed,
    type,
    divePeriod: 3.5 + ctx.rng.next() * 1.5,
    diveDur: 1.3 + ctx.rng.next() * 0.5,
    divePhase: ctx.rng.next() * 5,
    hasCroc: false,
    crocTimer: ctx.rng.next() * 4,
    crocPeriod: 3 + ctx.rng.next() * 2,
    crocMouthOpen: false,
  };
}

function buildObstacles(state: FroggerState, ctx: StepContext): void {
  const hazard = ctx.progression.state.hazard;
  state.obstacles = [];
  state.bonusItems = [];
  for (let row = 0; row < FROGGER.rows; row++) {
    const lane = LANES[row];
    if (lane === undefined) continue;
    const speed = (lane.speed ?? 0) * (1 + hazard * 0.25);
    if (lane.type === 'road') {
      const count = 2 + ctx.rng.int(2) + (state.pattern === 'car' ? 1 : 0) + (hazard >= 0.2 ? 1 : 0);
      const isTruck = (lane.speed ?? 0) < 70;
      const isRace = (lane.speed ?? 0) > 130;
      for (let i = 0; i < count; i++) {
        state.obstacles.push(
          makeObstacle(
            row,
            lane.dir ?? 1,
            isTruck ? FROGGER.cs * 2.8 : isRace ? FROGGER.cs * 1.2 : FROGGER.cs * 1.8,
            FROGGER.cs * (isTruck ? 0.75 : isRace ? 0.5 : 0.7),
            speed * ctx.rng.range(0.8, 1.2),
            isTruck ? 'truck' : isRace ? 'racecar' : 'car',
            ctx,
          ),
        );
      }
    } else if (lane.type === 'river') {
      const count = lane.turtles ? 3 : 2 + ctx.rng.int(3);
      for (let i = 0; i < count; i++) {
        const w = lane.turtles
          ? FROGGER.cs * 2.1
          : lane.croc
            ? FROGGER.cs * 2.5
            : FROGGER.cs * (1.5 + ctx.rng.next() * 2);
        const obstacle = makeObstacle(row, lane.dir ?? 1, w, FROGGER.cs * 0.6, speed * ctx.rng.range(0.8, 1.2), lane.turtles ? 'turtle' : 'log', ctx);
        obstacle.hasCroc = !!lane.croc;
        if (lane.croc) {
          obstacle.crocPeriod = 2.5 + ctx.rng.next() * 1.5;
          obstacle.crocTimer = ctx.rng.next() * obstacle.crocPeriod;
        }
        state.obstacles.push(obstacle);
      }
      if (lane.croc && ctx.rng.next() < FROGGER.crocChance) {
        state.obstacles.push(
          makeObstacle(row, lane.dir ?? 1, FROGGER.cs * 2.2, FROGGER.cs * 0.7, speed * ctx.rng.range(0.8, 1.2), 'croc', ctx),
        );
      }
    }
  }
  const safeLanes = [1, 7, 13];
  const count = 1 + ctx.rng.int(2);
  for (let i = 0; i < count; i++) {
    const row = safeLanes[ctx.rng.int(safeLanes.length)] ?? 7;
    state.bonusItems.push({
      row,
      x: FROGGER.cs + ctx.rng.next() * (FROGGER.cols * FROGGER.cs - FROGGER.cs * 2),
      y: row * FROGGER.cs + FROGGER.cs / 2,
      type: randomBonusType(ctx),
      timer: 8 + ctx.rng.next() * 5,
      collected: false,
    });
  }
}

function resetFrog(state: FroggerState): void {
  state.x = Math.floor(FROGGER.cols / 2) * FROGGER.cs + FROGGER.cs / 2;
  state.y = (FROGGER.rows - 1) * FROGGER.cs + FROGGER.cs / 2;
  state.dir = 0;
  state.moveTimer = 0;
  state.timeLeft = FROGGER.timeLimit;
  state.tenSaid = false;
}
function frogRow(state: FroggerState): number {
  return Math.round((state.y - FROGGER.cs / 2) / FROGGER.cs);
}

function startLevel(state: FroggerState, ctx: StepContext): void {
  state.pattern = ctx.progression.nextPattern();
  state.goals = [];
  buildObstacles(state, ctx);
  resetFrog(state);
  ctx.emit('levelStart', { level: state.level, pattern: state.pattern });
}
function resetGame(state: FroggerState, ctx: StepContext): void {
  state.score = 0;
  state.lives = FROGGER.maxLives;
  state.level = 1;
  state.progress = 0;
  state.simTime = 0;
  state.extraLifeGiven = { 10000: false, 20000: false };
  state.over = false;
  startLevel(state, ctx);
}

function checkExtraLife(state: FroggerState, ctx: StepContext): void {
  if (state.score >= FROGGER.extraLives[1] && !state.extraLifeGiven[20000]) {
    state.extraLifeGiven[20000] = true;
    state.lives++;
    ctx.emit('extraLife', {});
  } else if (state.score >= FROGGER.extraLives[0] && !state.extraLifeGiven[10000]) {
    state.extraLifeGiven[10000] = true;
    state.lives++;
    ctx.emit('extraLife', {});
  }
}

function loseLife(state: FroggerState, ctx: StepContext): void {
  state.lives--;
  ctx.emit('hit', { row: frogRow(state) });
  ctx.progression.observe(-0.8);
  if (state.lives <= 0) {
    state.over = true;
    ctx.emit('gameOver', { score: state.score });
    return;
  }
  resetFrog(state);
}

function submerged(obstacle: Obstacle, time: number): boolean {
  return obstacle.type === 'turtle' && (time + obstacle.divePhase) % obstacle.divePeriod < obstacle.diveDur;
}
function isPlatform(obstacle: Obstacle, time: number): boolean {
  return (obstacle.type === 'log' || obstacle.type === 'turtle') && !submerged(obstacle, time);
}
function isCrocDangerous(obstacle: Obstacle): boolean {
  return obstacle.type === 'croc' && obstacle.crocMouthOpen;
}
function hitBox(obstacle: Obstacle): AABB {
  return { x: obstacle.x - obstacle.w / 2, y: obstacle.y - obstacle.h / 2, w: obstacle.w, h: obstacle.h };
}

function moveFrog(state: FroggerState, dx: number, dy: number, ctx: StepContext): void {
  const nx = state.x + dx * FROGGER.cs;
  const ny = state.y + dy * FROGGER.cs;
  if (nx < 0 || nx > FROGGER.cols * FROGGER.cs || ny < 0 || ny > FROGGER.rows * FROGGER.cs) return;
  state.x = nx;
  state.y = ny;
  state.dir = dx > 0 ? 0 : dx < 0 ? Math.PI : dy < 0 ? -Math.PI / 2 : Math.PI / 2;
  state.moveTimer = 0.15;
  ctx.emit('hop', { x: nx, y: ny });
  checkCollisions(state, ctx);
}

function checkCollisions(state: FroggerState, ctx: StepContext): void {
  const collision = ctx.services.get<CollisionService>(COLLISION_SERVICE);
  const row = frogRow(state);
  const lane = LANES[row];
  if (lane === undefined) return;
  const frogBox: AABB = { x: state.x - FROGGER.cs * 0.3, y: state.y - FROGGER.cs * 0.3, w: FROGGER.cs * 0.6, h: FROGGER.cs * 0.6 };

  for (const item of state.bonusItems) {
    if (item.collected || item.row !== row) continue;
    if (dist2(state.x, state.y, item.x, item.y) > (FROGGER.cs * 0.6) ** 2) continue;
    item.collected = true;
    if (item.type === 'snake') {
      loseLife(state, ctx);
      return;
    }
    const points = (item.type === 'fly' ? 200 : 100) * state.level;
    state.score += points;
    ctx.emit('bonus', { type: item.type, points });
    ctx.progression.observe(0.5);
    checkExtraLife(state, ctx);
  }

  if (lane.type === 'goal') {
    const col = state.x / FROGGER.cs;
    let scored = false;
    for (const goal of FROGGER.goalX) {
      if (Math.abs(col - goal) < 0.6 && !state.goals.includes(goal)) {
        state.goals.push(goal);
        const bonus = Math.floor(state.timeLeft) * 10;
        state.score += 100 * state.level + bonus;
        ctx.emit('home', { goal, points: 100 * state.level + bonus });
        ctx.progression.observe(1);
        checkExtraLife(state, ctx);
        scored = true;
        state.progress += 1;
        if (state.goals.length >= FROGGER.levels) {
          state.level++;
          ctx.emit('levelUp', { level: state.level });
          startLevel(state, ctx);
          return;
        }
        resetFrog(state);
        return;
      }
    }
    if (!scored) loseLife(state, ctx);
    return;
  }

  if (lane.type === 'road') {
    for (const obstacle of state.obstacles) {
      if (obstacle.row !== row || obstacle.type === 'log' || obstacle.type === 'turtle') continue;
      if (collision.aabbOverlap(frogBox, hitBox(obstacle))) {
        loseLife(state, ctx);
        return;
      }
    }
  }

  if (lane.type === 'river') {
    let onLog = false;
    for (const obstacle of state.obstacles) {
      if (obstacle.row !== row) continue;
      if (isCrocDangerous(obstacle)) {
        if (Math.abs(state.x - obstacle.x) < (obstacle.w + FROGGER.cs * 0.4) / 2) {
          loseLife(state, ctx);
          return;
        }
        continue;
      }
      if (isPlatform(obstacle, state.simTime) && Math.abs(state.x - obstacle.x) < (obstacle.w + FROGGER.cs * 0.4) / 2) {
        onLog = true;
        break;
      }
    }
    if (!onLog) loseLife(state, ctx);
  }
}

function updateObstacles(state: FroggerState, dt: number, ctx: StepContext): void {
  const row = frogRow(state);
  for (const obstacle of state.obstacles) {
    obstacle.x += obstacle.dir * obstacle.speed * dt;
    if (obstacle.dir > 0 && obstacle.x > FROGGER.cols * FROGGER.cs + obstacle.w) obstacle.x = -obstacle.w;
    if (obstacle.dir < 0 && obstacle.x < -obstacle.w) obstacle.x = FROGGER.cols * FROGGER.cs + obstacle.w;
    if (obstacle.type === 'croc' || obstacle.hasCroc) {
      obstacle.crocTimer += dt;
      if (obstacle.crocTimer >= obstacle.crocPeriod) {
        obstacle.crocTimer = 0;
        obstacle.crocMouthOpen = !obstacle.crocMouthOpen;
      }
    }
    if (obstacle.row === row && isPlatform(obstacle, state.simTime) && !isCrocDangerous(obstacle)) {
      if (Math.abs(state.x - obstacle.x) < (obstacle.w + FROGGER.cs * 0.4) / 2) {
        state.x = clamp(state.x + obstacle.dir * obstacle.speed * dt, 0, FROGGER.cols * FROGGER.cs);
        if (state.x <= 0 || state.x >= FROGGER.cols * FROGGER.cs) loseLife(state, ctx);
      }
    }
  }
  for (const item of state.bonusItems) {
    if (!item.collected) item.timer -= dt;
  }
}

export const froggerGame = defineGame<FroggerState>({
  id: 'frogger',
  meta: { title: 'Frogger', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['up', 'down', 'left', 'right', 'pause', 'restart'],
  progression: {
    id: 'frogger',
    levels: [
      { speed: 1, spawnInterval: 12, hazard: 0, label: 'Nivel 1' },
      { speed: 1.08, spawnInterval: 11, hazard: 0.15, label: 'Nivel 2' },
      { speed: 1.18, spawnInterval: 10, hazard: 0.3, label: 'Nivel 3' },
    ],
    pointsPerLevel: 5,
    dda: { enabled: true, window: 300, maxAdjust: 0.08 },
    patterns: ['log', 'turtle', 'car'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    const state: FroggerState = {
      x: 0,
      y: 0,
      dir: 0,
      obstacles: [],
      bonusItems: [],
      goals: [],
      moveTimer: 0,
      timeLeft: FROGGER.timeLimit,
      tenSaid: false,
      extraLifeGiven: { 10000: false, 20000: false },
      simTime: 0,
      score: 0,
      lives: FROGGER.maxLives,
      level: 1,
      progress: 0,
      paused: false,
      over: false,
      ticks: 0,
      pattern: null,
    };
    startLevel(state, ctx);
    return state;
  },

  step(state, ctx) {
    if (handleLifecycle(state, ctx, state.progress, () => resetGame(state, ctx))) return;
    const dt = ctx.clock.dt * ctx.progression.state.speed;
    state.simTime += dt;

    if (state.moveTimer > 0) state.moveTimer -= dt;
    if (state.moveTimer <= 0) {
      if (ctx.actions.isDown('up')) moveFrog(state, 0, -1, ctx);
      else if (ctx.actions.isDown('down')) moveFrog(state, 0, 1, ctx);
      else if (ctx.actions.isDown('left')) moveFrog(state, -1, 0, ctx);
      else if (ctx.actions.isDown('right')) moveFrog(state, 1, 0, ctx);
    }
    if (state.over) return;

    updateObstacles(state, dt, ctx);
    if (state.over) return;

    state.timeLeft -= dt;
    if (state.timeLeft <= 10 && !state.tenSaid) {
      state.tenSaid = true;
      ctx.emit('tenSeconds', {});
    }
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      loseLife(state, ctx);
    }
    state.ticks++;
  },

  observe(state) {
    let nearest = 99;
    let dx = 0;
    for (const obstacle of state.obstacles) {
      if (obstacle.row !== frogRow(state) && obstacle.row !== frogRow(state) + 1) continue;
      const distance = Math.abs(obstacle.x - state.x);
      if (distance < nearest) {
        nearest = distance;
        dx = (obstacle.x - state.x) / (FROGGER.cols * FROGGER.cs);
      }
    }
    return new Float32Array([
      state.x / (FROGGER.cols * FROGGER.cs),
      state.y / (FROGGER.rows * FROGGER.cs),
      state.timeLeft / FROGGER.timeLimit,
      dx,
      nearest / (FROGGER.cols * FROGGER.cs),
      state.goals.length / FROGGER.levels,
      clamp(state.lives / FROGGER.maxLives, 0, 1),
    ]);
  },

  render(renderer, state, _alpha) {
    // _alpha ignorado: las posiciones del estado ya son píxeles.
    const ctx = renderer as CanvasRenderingContext2D | null;
    if (!ctx || typeof ctx.clearRect !== 'function') return;
    const cs = FROGGER.cs;
    const W = FROGGER.cols * cs;
    const H = FROGGER.rows * cs;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, W, H);

    const laneColors: Record<LaneType, string> = {
      goal: '#0d2c1c',
      safe: '#121a24',
      river: '#062a44',
      road: '#181823',
      start: '#101b12',
    };
    for (let row = 0; row < FROGGER.rows; row++) {
      const lane = LANES[row];
      if (lane === undefined) continue;
      ctx.fillStyle = laneColors[lane.type];
      ctx.fillRect(0, row * cs, W, cs);
      ctx.strokeStyle = 'rgba(94,242,255,0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, row * cs + 0.5);
      ctx.lineTo(W, row * cs + 0.5);
      ctx.stroke();
    }

    for (const goal of FROGGER.goalX) {
      const gx = goal * cs - cs * 0.45;
      const filled = state.goals.includes(goal);
      ctx.fillStyle = filled ? '#ffc857' : '#0a3d26';
      ctx.fillRect(gx, 3, cs * 0.9, cs - 6);
      ctx.strokeStyle = '#3fd07a';
      ctx.lineWidth = 2;
      ctx.strokeRect(gx, 3, cs * 0.9, cs - 6);
    }

    for (const obstacle of state.obstacles) {
      const x = obstacle.x - obstacle.w / 2;
      const y = obstacle.y - obstacle.h / 2;
      if (obstacle.type === 'turtle') {
        const diving = ((state.simTime + obstacle.divePhase) % obstacle.divePeriod) < obstacle.diveDur;
        ctx.fillStyle = diving ? 'rgba(94,242,255,0.15)' : '#3fd0d8';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(x + obstacle.w * (0.2 + i * 0.3), obstacle.y, obstacle.h * 0.42, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }
      ctx.fillStyle = obstacle.type === 'log'
        ? '#8a5a3c'
        : obstacle.type === 'croc'
          ? '#3fd07a'
          : obstacle.type === 'truck'
            ? '#ffc857'
            : obstacle.type === 'racecar'
              ? '#5ef2ff'
              : '#ff3fa4';
      ctx.fillRect(x, y, obstacle.w, obstacle.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, obstacle.w - 1, obstacle.h - 1);
    }

    for (const item of state.bonusItems) {
      if (item.collected) continue;
      ctx.fillStyle = item.type === 'snake' ? '#3fd07a' : item.type === 'fly' ? '#b06bff' : '#ff3fa4';
      ctx.beginPath();
      ctx.arc(item.x, item.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#5ef2ff';
    ctx.beginPath();
    ctx.arc(state.x, state.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b3b2c';
    ctx.fillRect(state.x - 14, state.y - 16, 7, 10);
    ctx.fillRect(state.x + 7, state.y - 16, 7, 10);
    ctx.fillRect(state.x - 14, state.y + 7, 7, 9);
    ctx.fillRect(state.x + 7, state.y + 7, 7, 9);
    ctx.fillStyle = '#f5f8ff';
    ctx.fillRect(state.x - 7, state.y - 7, 5, 5);
    ctx.fillRect(state.x + 2, state.y - 7, 5, 5);

    ctx.fillStyle = 'rgba(5,6,15,0.88)';
    ctx.fillRect(0, H - 22, W, 22);
    ctx.fillStyle = '#5ef2ff';
    ctx.font = '14px monospace';
    ctx.fillText(`FROG  L${state.level}  x${state.lives}  ${String(state.score).padStart(5, '0')}`, 8, H - 7);
    const barW = (W - 150) * Math.max(0, Math.min(1, state.timeLeft / FROGGER.timeLimit));
    ctx.fillStyle = '#ffc857';
    ctx.fillRect(120, H - 17, barW, 9);
    ctx.restore();
  },

  rules: singlePlayerRules<FroggerState>(
    (state) => state.score + state.goals.length * 100 - (state.over ? 400 : 0),
  ),
});
