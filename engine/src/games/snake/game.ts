import { clamp, manhattan } from '../../core/math.js';
import type { StepContext } from '../../core/simulation.js';
import { defineGame } from '../../game/contract.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import {
  PATHFINDING_SERVICE,
  type PathfindingService,
} from '../../sim/pathfinding.js';

export const SNAKE = {
  cols: 20,
  rows: 16,
  startLength: 3,
  maxSpeedLevel: 10,
  pointsPerSpeedLevel: 10,
  minMoveInterval: 4,
  dirs: [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ] as const,
} as const;

export interface SnakeCell {
  x: number;
  y: number;
}

export interface SnakeState {
  body: SnakeCell[];
  dir: number;
  pendingDir: number;
  food: SnakeCell;
  score: number;
  speedLevel: number;
  over: boolean;
  paused: boolean;
  generation: number;
  won: boolean;
  ticks: number;
  moveTimer: number;
  pattern: string;
  /** Vecino BFS hacia la comida, calculado con el servicio del motor. */
  nextStep: SnakeCell | null;
}

function initialState(ctx: StepContext): SnakeState {
  const headX = Math.floor(SNAKE.cols / 2);
  const headY = Math.floor(SNAKE.rows / 2);
  const body: SnakeCell[] = [];
  for (let i = 0; i < SNAKE.startLength; i++) body.push({ x: headX - i, y: headY });
  return {
    body,
    dir: 0,
    pendingDir: 0,
    food: { x: headX + 4, y: headY },
    score: 0,
    speedLevel: 1,
    over: false,
    paused: false,
    generation: 0,
    won: false,
    ticks: 0,
    moveTimer: 0,
    pattern: ctx.progression.nextPattern() ?? 'rush',
    nextStep: null,
  };
}

/** Tablero para el servicio BFS del motor: 0 libre, 1 ocupado por el cuerpo. */
function occupancy(state: SnakeState, food?: SnakeCell): number[][] {
  const grid = Array.from({ length: SNAKE.rows }, () => Array<number>(SNAKE.cols).fill(0));
  for (const cell of state.body) grid[cell.y]![cell.x] = 1;
  if (food !== undefined) grid[food.y]![food.x] = 0;
  return grid;
}

/** Comida con bolsa de patrones y veto de celdas inalcanzables (BFS del motor). */
function placeFood(state: SnakeState, ctx: StepContext): void {
  const pathfinding = ctx.services.get<PathfindingService>(PATHFINDING_SERVICE);
  const occupied = new Set(state.body.map((cell) => `${cell.x},${cell.y}`));
  const free: SnakeCell[] = [];
  for (let y = 0; y < SNAKE.rows; y++) {
    for (let x = 0; x < SNAKE.cols; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (free.length === 0) {
    state.won = true;
    state.over = true;
    ctx.emit('win', { score: state.score });
    return;
  }
  const head = state.body[0]!;
  const hazard = ctx.progression.state.hazard;
  const scored = free.map((cell) => {
    const distance = manhattan(head.x, head.y, cell.x, cell.y);
    const corner = Math.min(cell.x, SNAKE.cols - 1 - cell.x) + Math.min(cell.y, SNAKE.rows - 1 - cell.y);
    const weave = (cell.x + cell.y) % 3;
    const value =
      state.pattern === 'rush'
        ? distance
        : state.pattern === 'corner'
          ? SNAKE.cols + SNAKE.rows - corner
          : weave * 4 + distance * 0.5;
    return value * (1 - hazard * 0.5) + distance * hazard * 0.5;
  });
  let best = -Infinity;
  for (const value of scored) if (value > best) best = value;
  let candidates = free.filter((_cell, index) => scored[index]! >= best - 1);
  // Nunca aparece comida tras un muro de cuerpo: se descarta con BFS.
  const reachable = candidates.filter(
    (cell) =>
      pathfinding.bfsStep(occupancy(state, cell), { col: head.x, row: head.y }, { col: cell.x, row: cell.y }) !==
      null,
  );
  if (reachable.length > 0) candidates = reachable;
  const chosen = candidates[ctx.rng.int(candidates.length)] ?? free[0]!;
  state.food.x = chosen.x;
  state.food.y = chosen.y;
}

function rayDistance(state: SnakeState, turn: -1 | 0 | 1): number {
  const dirIndex = (state.dir + turn + 4) % 4;
  const [dx, dy] = SNAKE.dirs[dirIndex]!;
  const head = state.body[0]!;
  const occupied = new Set(state.body.map((cell) => `${cell.x},${cell.y}`));
  let distance = 0;
  let x = head.x;
  let y = head.y;
  while (distance < Math.max(SNAKE.cols, SNAKE.rows)) {
    x += dx;
    y += dy;
    if (x < 0 || x >= SNAKE.cols || y < 0 || y >= SNAKE.rows || occupied.has(`${x},${y}`)) break;
    distance++;
  }
  return distance;
}

export const snakeGame = defineGame<SnakeState>({
  id: 'snake',
  meta: { title: 'Snake', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['up', 'down', 'left', 'right', 'restart', 'pause'],
  progression: {
    id: 'snake',
    levels: [
      { speed: 1, spawnInterval: 10, hazard: 0, label: 'Nivel 1' },
      { speed: 1.08, spawnInterval: 9, hazard: 0.1, label: 'Nivel 2' },
      { speed: 1.18, spawnInterval: 8, hazard: 0.2, label: 'Nivel 3' },
      { speed: 1.3, spawnInterval: 7, hazard: 0.3, label: 'Nivel 4' },
    ],
    pointsPerLevel: 5,
    dda: { enabled: true, window: 400, maxAdjust: 0.08 },
    patterns: ['rush', 'corner', 'weave'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    return initialState(ctx);
  },

  step(state, ctx) {
    const generation = state.generation;
    if (
      handleLifecycle(state, ctx, state.score, () => {
        Object.assign(state, initialState(ctx));
        state.generation = generation + 1;
      })
    ) {
      return;
    }
    if (state.generation !== generation) return;
    const progress = ctx.progression.state;
    const pathfinding = ctx.services.get<PathfindingService>(PATHFINDING_SERVICE);
    const headNow = state.body[0]!;
    const bfsStep = pathfinding.bfsStep(
      occupancy(state, state.food),
      { col: headNow.x, row: headNow.y },
      { col: state.food.x, row: state.food.y },
    );
    state.nextStep = bfsStep === null ? null : { x: bfsStep.col, y: bfsStep.row };

    const requested = ctx.actions.consume('up')
      ? 3
      : ctx.actions.consume('down')
        ? 1
        : ctx.actions.consume('left')
          ? 2
          : ctx.actions.consume('right')
            ? 0
            : -1;
    if (requested >= 0 && requested !== (state.dir + 2) % 4) {
      state.pendingDir = requested;
      ctx.emit('turn', { dir: requested });
    }

    state.ticks++;
    state.moveTimer++;
    // Velocidad progresiva del original: 10 niveles, cada 10 comidas, hasta 60 ms.
    state.speedLevel = Math.min(
      SNAKE.maxSpeedLevel,
      Math.floor(state.score / SNAKE.pointsPerSpeedLevel) + 1,
    );
    const interval = clamp(
      Math.round((progress.spawnInterval ?? 10) / progress.speed) - (state.speedLevel - 1),
      SNAKE.minMoveInterval,
      SNAKE.cols,
    );
    if (state.moveTimer < interval) return;
    state.moveTimer = 0;
    state.dir = state.pendingDir;
    const [dx, dy] = SNAKE.dirs[state.dir]!;
    const head = state.body[0]!;
    const next: SnakeCell = { x: head.x + dx, y: head.y + dy };
    if (next.x < 0 || next.x >= SNAKE.cols || next.y < 0 || next.y >= SNAKE.rows) {
      state.over = true;
      ctx.emit('crash', { x: next.x, y: next.y });
      ctx.emit('gameOver', { score: state.score });
      ctx.progression.observe(-0.8);
      return;
    }
    const eating = next.x === state.food.x && next.y === state.food.y;
    const bodyLimit = eating ? state.body.length : state.body.length - 1;
    for (let i = 0; i < bodyLimit; i++) {
      const cell = state.body[i]!;
      if (cell.x === next.x && cell.y === next.y) {
        state.over = true;
        ctx.emit('crash', { x: next.x, y: next.y });
        ctx.emit('gameOver', { score: state.score });
        ctx.progression.observe(-0.8);
        return;
      }
    }
    state.body.unshift(next);
    if (eating) {
      state.score++;
      ctx.emit('eat', { x: next.x, y: next.y, score: state.score });
      ctx.progression.observe(0.5);
      if (ctx.progression.state.level > Math.floor((state.score - 1) / 5)) {
        ctx.emit('levelUp', { level: ctx.progression.state.level });
      }
      state.pattern = ctx.progression.nextPattern() ?? state.pattern;
      placeFood(state, ctx);
    } else {
      state.body.pop();
    }
  },

  observe(state) {
    const head = state.body[0]!;
    const dx = state.food.x - head.x;
    const dy = state.food.y - head.y;
    const distance = manhattan(head.x, head.y, state.food.x, state.food.y);
    const step = state.nextStep;
    return new Float32Array([
      (head.x / (SNAKE.cols - 1)) * 2 - 1,
      (head.y / (SNAKE.rows - 1)) * 2 - 1,
      distance > 0 ? dx / distance : 0,
      distance > 0 ? dy / distance : 0,
      (state.body.length / (SNAKE.cols * SNAKE.rows)) * 2 - 1,
      rayDistance(state, 0) / SNAKE.cols,
      rayDistance(state, -1) / SNAKE.rows,
      rayDistance(state, 1) / SNAKE.rows,
      step ? ((step.x - head.x) / SNAKE.cols) * 2 - 1 : 0,
      step ? ((step.y - head.y) / SNAKE.rows) * 2 - 1 : 0,
      (state.score / 50) * 2 - 1,
      (state.speedLevel / SNAKE.maxSpeedLevel) * 2 - 1,
      state.over ? 1 : -1,
    ]);
  },

  rules: singlePlayerRules<SnakeState>((state) => state.score + state.body.length * 0.1 - (state.over ? 50 : 0)),
});
