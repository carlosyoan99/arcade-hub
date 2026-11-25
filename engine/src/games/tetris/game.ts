import { clamp } from '../../core/math.js';
import type { StepContext } from '../../core/simulation.js';
import { defineGame } from '../../game/contract.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';

export const TETRIS = {
  cols: 10,
  rows: 20,
  hiddenRows: 2,
  queueLength: 5,
  baseDropTicks: 60,
  speedPerLevel: 0.08,
  minDropTicks: 3,
  lockDelayTicks: 30,
  maxLockResets: 15,
  names: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const,
  scoreTable: [0, 100, 300, 500, 800] as const,
  tspinTable: [0, 400, 800, 1200, 1600] as const,
  tspinMiniTable: [0, 100, 200, 400] as const,
} as const;

export type TetrisName = (typeof TETRIS.names)[number];

type Blocks = ReadonlyArray<readonly [number, number]>;
type Kick = readonly [number, number];
type KickTable = Partial<Record<string, readonly Kick[]>>;

const PIECE_BLOCKS: Record<TetrisName, Blocks> = {
  I: [[0, 0], [1, 0], [2, 0], [3, 0]],
  O: [[0, 0], [1, 0], [0, 1], [1, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};
const PIECE_BOX: Record<TetrisName, number> = { I: 4, O: 2, T: 3, S: 3, Z: 3, J: 3, L: 3 };
const NAME_INDEX: Record<TetrisName, number> = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 };

/** Tablas SRS completas del Guideline (idénticas al juego original). */
const SRS_KICKS: Record<'JLSTZ' | 'I', KickTable> = {
  JLSTZ: {
    '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  },
  I: {
    '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  },
};

export interface TetrisPiece {
  name: TetrisName;
  rot: number;
  x: number;
  y: number;
  color: number;
  blocks: Blocks;
}

export interface TetrisState {
  grid: number[][];
  piece: TetrisPiece | null;
  bag: TetrisName[];
  next: TetrisName[];
  hold: TetrisName | null;
  canHold: boolean;
  score: number;
  lines: number;
  level: number;
  lastLevel: number;
  over: boolean;
  paused: boolean;
  generation: number;
  ticks: number;
  dropTimer: number;
  lockTimer: number;
  lockResets: number;
  ghostY: number;
  moveCooldown: number;
  moveDir: number;
  lastRotation: boolean;
  pattern: string;
  combo: number;
  backToBack: number;
  tspinType: number;
}

export function rotateBlocks(name: TetrisName, rot: number): Blocks {
  let blocks: Blocks = PIECE_BLOCKS[name];
  const size = PIECE_BOX[name];
  for (let turn = 0; turn < ((rot % 4) + 4) % 4; turn++) {
    blocks = blocks.map(([x, y]) => [size - 1 - y, x] as const);
  }
  return blocks;
}

function makePiece(name: TetrisName): TetrisPiece {
  return {
    name,
    rot: 0,
    x: Math.floor((TETRIS.cols - 4) / 2),
    y: 0,
    color: NAME_INDEX[name],
    blocks: rotateBlocks(name, 0),
  };
}

/** Bolsa de 7: cada ciclo contiene cada pieza una sola vez (Fisher-Yates sembrado). */
export function takeFromBag(state: TetrisState, ctx: StepContext): TetrisName {
  if (state.bag.length === 0) {
    const bag = [...TETRIS.names] as TetrisName[];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = ctx.rng.int(i + 1);
      const a = bag[i]!;
      bag[i] = bag[j]!;
      bag[j] = a;
    }
    state.bag = bag;
  }
  return state.bag.pop()!;
}

function collides(grid: number[][], blocks: Blocks, x: number, y: number): boolean {
  for (const [bx, by] of blocks) {
    const gx = x + bx;
    const gy = y + by;
    if (gx < 0 || gx >= TETRIS.cols || gy >= TETRIS.rows + TETRIS.hiddenRows) return true;
    if (gy >= 0 && grid[gy]![gx]! !== 0) return true;
  }
  return false;
}

function ghostYFor(grid: number[][], piece: TetrisPiece): number {
  let y = piece.y;
  while (!collides(grid, piece.blocks, piece.x, y + 1)) y++;
  return y;
}

function addGarbage(state: TetrisState, ctx: StepContext, rows: number): void {
  for (let i = 0; i < rows; i++) {
    state.grid.shift();
    const hole = ctx.rng.int(TETRIS.cols);
    state.grid.push(Array.from({ length: TETRIS.cols }, (_cell, col) => (col === hole ? 0 : 8)));
    if (state.grid[TETRIS.hiddenRows]!.some((cell) => cell !== 0)) {
      state.over = true;
      ctx.emit('gameOver', { score: state.score, reason: 'garbage' });
    }
  }
}

function spawn(state: TetrisState, ctx: StepContext, forced?: TetrisName): void {
  while (state.next.length < TETRIS.queueLength) state.next.push(takeFromBag(state, ctx));
  const name = forced ?? state.next.shift()!;
  state.next.push(takeFromBag(state, ctx));
  const piece = makePiece(name);
  state.piece = piece;
  state.dropTimer = 0;
  state.lockTimer = 0;
  state.lockResets = 0;
  state.lastRotation = false;
  state.tspinType = 0;
  state.ghostY = ghostYFor(state.grid, piece);
  if (collides(state.grid, piece.blocks, piece.x, piece.y)) {
    state.over = true;
    ctx.emit('gameOver', { score: state.score, reason: 'spawn' });
  }
}

function clearLines(state: TetrisState, ctx: StepContext, level: number): void {
  let cleared = 0;
  for (let row = TETRIS.rows + TETRIS.hiddenRows - 1; row >= 0; row--) {
    if (state.grid[row]!.every((cell) => cell !== 0)) {
      state.grid.splice(row, 1);
      state.grid.unshift(Array(TETRIS.cols).fill(0));
      cleared++;
      row++;
    }
  }
  if (cleared === 0) {
    state.combo = 0;
    state.tspinType = 0;
    return;
  }
  state.lines += cleared;
  state.combo++;
  const tspin = state.tspinType;
  const base =
    tspin === 2
      ? TETRIS.tspinTable[cleared] ?? 1600
      : tspin === 1
        ? TETRIS.tspinMiniTable[cleared] ?? 400
        : TETRIS.scoreTable[cleared] ?? 800;
  const special = tspin > 0 || cleared === 4;
  state.backToBack = special ? state.backToBack + 1 : 0;
  let points = base * level;
  if (state.backToBack > 1) points = Math.floor(points * 1.5);
  if (state.combo > 1) points += state.combo * 25;
  state.score += points;
  ctx.emit('lineClear', { cleared, points, combo: state.combo });
  if (tspin > 0) ctx.emit('tspin', { cleared, mini: tspin === 1 });
  if (cleared === 4) ctx.emit('tetris', { points });
  ctx.progression.observe(Math.min(1, cleared / 4));
}

/** Detección T-Spin completa: 4 esquinas del T y esquinas frontales según rotación. */
function detectTSpin(state: TetrisState): number {
  const piece = state.piece;
  if (!piece || piece.name !== 'T' || !state.lastRotation) return 0;
  const cx = piece.x + 1;
  const cy = piece.y + 1;
  const total = TETRIS.rows + TETRIS.hiddenRows;
  const filled = (x: number, y: number): boolean =>
    x < 0 || x >= TETRIS.cols || y < 0 || y >= total || (y >= 0 && state.grid[y]![x] !== 0);
  const corners = [
    filled(cx - 1, cy - 1),
    filled(cx + 1, cy - 1),
    filled(cx - 1, cy + 1),
    filled(cx + 1, cy + 1),
  ];
  if (corners.filter(Boolean).length < 3) return 0;
  const front = [corners[(piece.rot * 2) % 4]!, corners[(piece.rot * 2 + 1) % 4]!];
  if (front.every(Boolean) && !corners[(piece.rot * 2 + 2) % 4]) return 1;
  return 2;
}

function lockPiece(state: TetrisState, ctx: StepContext): void {
  const piece = state.piece;
  if (!piece || state.over) return;
  for (const [bx, by] of piece.blocks) {
    const gy = piece.y + by;
    const gx = piece.x + bx;
    if (gy >= 0 && gy < TETRIS.rows + TETRIS.hiddenRows && gx >= 0 && gx < TETRIS.cols) {
      state.grid[gy]![gx] = piece.color;
    }
  }
  state.tspinType = detectTSpin(state);
  clearLines(state, ctx, Math.max(1, state.level));
  state.canHold = true;
  spawn(state, ctx);
}

function initialState(ctx: StepContext): TetrisState {
  const total = TETRIS.rows + TETRIS.hiddenRows;
  const state: TetrisState = {
    grid: Array.from({ length: total }, () => Array<number>(TETRIS.cols).fill(0)),
    piece: null,
    bag: [],
    next: [],
    hold: null,
    canHold: true,
    score: 0,
    lines: 0,
    level: 1,
    lastLevel: 1,
    over: false,
    paused: false,
    generation: 0,
    ticks: 0,
    dropTimer: 0,
    lockTimer: 0,
    lockResets: 0,
    ghostY: 0,
    moveCooldown: 0,
    moveDir: 0,
    lastRotation: false,
    pattern: ctx.progression.nextPattern() ?? 'queue7',
    combo: 0,
    backToBack: 0,
    tspinType: 0,
  };
  spawn(state, ctx);
  return state;
}

export const tetrisGame = defineGame<TetrisState>({
  id: 'tetris',
  meta: { title: 'Tetris', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['left', 'right', 'rotate', 'rotateCCW', 'softDrop', 'hardDrop', 'hold', 'restart', 'pause'],
  progression: {
    id: 'tetris',
    levels: [
      { speed: 1, spawnInterval: 30, hazard: 0, label: 'Nivel 1' },
      { speed: 1.1, spawnInterval: 27, hazard: 0.1, label: 'Nivel 2' },
      { speed: 1.22, spawnInterval: 24, hazard: 0.2, label: 'Nivel 3' },
      { speed: 1.38, spawnInterval: 20, hazard: 0.3, label: 'Nivel 4' },
      { speed: 1.55, spawnInterval: 16, hazard: 0.45, label: 'Nivel 5' },
    ],
    pointsPerLevel: 8,
    dda: { enabled: true, window: 500, maxAdjust: 0.08 },
    patterns: ['queue7', 'tspin', 'holes'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    return initialState(ctx);
  },

  step(state, ctx) {
    const generation = state.generation;
    if (
      handleLifecycle(state, ctx, state.lines, () => {
        Object.assign(state, initialState(ctx));
        state.generation = generation + 1;
      })
    ) {
      return;
    }
    if (state.generation !== generation) return;
    const progress = ctx.progression.state;
    state.level = progress.level + 1;
    if (state.level > state.lastLevel) {
      state.lastLevel = progress.level + 1;
      state.pattern = ctx.progression.nextPattern() ?? state.pattern;
      if (state.pattern === 'holes' || progress.hazard > 0) {
        addGarbage(state, ctx, Math.max(0, Math.round(progress.hazard * 2)));
        ctx.emit('garbage', { rows: Math.round(progress.hazard * 2) });
      }
      if (state.pattern === 'tspin') state.score += 50 * state.level;
      while (state.next.length < TETRIS.queueLength) state.next.push(takeFromBag(state, ctx));
      ctx.emit('levelUp', { level: state.level, pattern: state.pattern });
    }
    const piece = state.piece;
    if (!piece || state.over) return;

    const direction = ctx.actions.isDown('left') ? -1 : ctx.actions.isDown('right') ? 1 : 0;
    if (direction !== 0 && (state.moveCooldown === 0 || state.moveDir !== direction)) {
      if (!collides(state.grid, piece.blocks, piece.x + direction, piece.y)) {
        piece.x += direction;
        state.lastRotation = false;
        ctx.emit('move', { x: piece.x, y: piece.y });
        if (collides(state.grid, piece.blocks, piece.x, piece.y + 1)) {
          state.lockTimer = 0;
          state.lockResets++;
        }
      }
      state.moveCooldown = state.moveDir === direction ? 4 : 8;
      state.moveDir = direction;
    } else if (direction === 0) {
      state.moveCooldown = 0;
      state.moveDir = 0;
    } else {
      state.moveCooldown--;
    }

    const rotate = ctx.actions.consume('rotate') ? 1 : ctx.actions.consume('rotateCCW') ? -1 : 0;
    if (rotate !== 0 && piece.name !== 'O') {
      const rot = (piece.rot + rotate + 4) % 4;
      const blocks = rotateBlocks(piece.name, rot);
      const table = SRS_KICKS[piece.name === 'I' ? 'I' : 'JLSTZ'];
      const kicks = table[`${piece.rot}>${rot}`] ?? [[0, 0] as Kick];
      for (const [kx, ky] of kicks) {
        if (!collides(state.grid, blocks, piece.x + kx, piece.y + ky)) {
          piece.blocks = blocks;
          piece.rot = rot;
          piece.x += kx;
          piece.y += ky;
          state.lastRotation = true;
          if (collides(state.grid, piece.blocks, piece.x, piece.y + 1)) {
            state.lockTimer = 0;
            state.lockResets++;
          }
          ctx.emit('rotate', { name: piece.name, rot });
          break;
        }
      }
    }

    if (ctx.actions.consume('hold') && state.canHold) {
      const current = piece.name;
      const saved = state.hold;
      state.hold = current;
      state.canHold = false;
      if (saved !== null) spawn(state, ctx, saved);
      else spawn(state, ctx);
      ctx.emit('hold', { name: current });
      state.ticks++;
      return;
    }
    if (ctx.actions.consume('hardDrop')) {
      let distance = 0;
      while (!collides(state.grid, piece.blocks, piece.x, piece.y + 1)) {
        piece.y++;
        distance++;
      }
      state.score += distance * 2;
      ctx.emit('hardDrop', { distance });
      lockPiece(state, ctx);
      state.ticks++;
      return;
    }

    const soft = ctx.actions.isDown('softDrop');
    const seconds = Math.max(0.05, 1 - (state.level - 1) * TETRIS.speedPerLevel);
    const gravity = Math.max(
      TETRIS.minDropTicks,
      Math.round((TETRIS.baseDropTicks * seconds) / progress.speed / (soft ? 10 : 1)),
    );
    state.dropTimer++;
    if (state.dropTimer >= gravity) {
      state.dropTimer = 0;
      if (!collides(state.grid, piece.blocks, piece.x, piece.y + 1)) {
        piece.y++;
        state.lastRotation = false;
        if (soft) state.score++;
      }
    }
    state.ghostY = ghostYFor(state.grid, piece);
    if (collides(state.grid, piece.blocks, piece.x, piece.y + 1)) {
      state.lockTimer++;
      if (state.lockTimer >= TETRIS.lockDelayTicks || state.lockResets >= TETRIS.maxLockResets) {
        lockPiece(state, ctx);
      }
    } else {
      state.lockTimer = 0;
      state.lockResets = 0;
    }
    state.ticks++;
  },

  observe(state) {
    const heights = Array.from({ length: TETRIS.cols }, (_cell, col) => {
      let height = 0;
      for (let row = 0; row < TETRIS.rows + TETRIS.hiddenRows; row++) {
        if (state.grid[row]![col] !== 0) height = TETRIS.rows + TETRIS.hiddenRows - row;
      }
      return clamp(height / (TETRIS.rows + TETRIS.hiddenRows), 0, 1);
    });
    let holes = 0;
    for (let col = 0; col < TETRIS.cols; col++) {
      let filled = false;
      for (let row = 0; row < TETRIS.rows + TETRIS.hiddenRows; row++) {
        if (state.grid[row]![col] !== 0) filled = true;
        else if (filled) holes++;
      }
    }
    const piece = state.piece;
    const nextName = state.next[0];
    return new Float32Array([
      ...heights,
      Math.min(1, holes / 20),
      Math.min(1, state.lines / 100),
      piece ? (piece.x / TETRIS.cols) * 2 - 1 : 0,
      piece ? (piece.y / (TETRIS.rows + TETRIS.hiddenRows)) * 2 - 1 : 0,
      piece ? ((state.ghostY - piece.y) / (TETRIS.rows + TETRIS.hiddenRows)) * 2 - 1 : 0,
      state.hold === null ? -1 : (NAME_INDEX[state.hold] / 7) * 2 - 1,
      nextName !== undefined ? (NAME_INDEX[nextName] / 7) * 2 - 1 : 0,
      clamp(state.lockTimer / TETRIS.lockDelayTicks, 0, 1) * 2 - 1,
      Math.min(1, state.level / 15),
      state.over ? 1 : -1,
    ]);
  },

  rules: singlePlayerRules<TetrisState>((state) =>
    state.score + state.lines * 100 + state.level * 50 - (state.over ? 500 : 0),
  ),
});
