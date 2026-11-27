import { clamp } from '../../core/math.js';
import type { StepContext } from '../../core/simulation.js';
import { defineGame } from '../../game/contract.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';

export const PUYO = {
  cols: 6,
  rows: 12,
  colors: 4,
  garbage: -2,
  matchMin: 4,
  garbageDelayTicks: 120,
} as const;

export interface PuyoPiece {
  col: number;
  row: number;
  gems: [number, number];
}

export interface PuyoState {
  board: number[][];
  cpuBoard: number[][];
  piece: PuyoPiece;
  cpuPiece: PuyoPiece | null;
  pair: [number, number];
  score: number;
  level: number;
  chains: number;
  totalChains: number;
  maxChain: number;
  garbageQueue: number;
  garbageTimer: number;
  forcedColor: number;
  over: boolean;
  paused: boolean;
  generation: number;
  ticks: number;
  dropTimer: number;
  cpuDropTimer: number;
  pattern: string;
}

function emptyBoard(): number[][] {
  return Array.from({ length: PUYO.rows }, () => Array<number>(PUYO.cols).fill(-1));
}

function rollPair(state: PuyoState, ctx: StepContext): [number, number] {
  if (state.forcedColor >= 0) {
    const color = state.forcedColor;
    state.forcedColor = -1;
    return [color, color];
  }
  return [ctx.rng.int(PUYO.colors), ctx.rng.int(PUYO.colors)];
}

function initialState(ctx: StepContext): PuyoState {
  const state: PuyoState = {
    board: emptyBoard(),
    cpuBoard: emptyBoard(),
    piece: { col: 2, row: -1, gems: [0, 1] },
    cpuPiece: null,
    pair: [0, 1],
    score: 0,
    level: 1,
    chains: 0,
    totalChains: 0,
    maxChain: 0,
    garbageQueue: 0,
    garbageTimer: 0,
    forcedColor: -1,
    over: false,
    paused: false,
    generation: 0,
    ticks: 0,
    dropTimer: 0,
    cpuDropTimer: 0,
    pattern: ctx.progression.nextPattern() ?? 'chain',
  };
  state.pair = rollPair(state, ctx);
  state.piece = { col: 2, row: -1, gems: [...state.pair] as [number, number] };
  return state;
}

function spawnPiece(state: PuyoState, ctx: StepContext, cpu = false): void {
  const pair = rollPair(state, ctx);
  const piece: PuyoPiece = { col: 2, row: -1, gems: [...pair] as [number, number] };
  if (cpu) {
    state.cpuPiece = piece;
    state.cpuDropTimer = 0;
    if (state.cpuBoard[0]![piece.col] !== -1) {
      state.cpuBoard = emptyBoard();
      ctx.emit('cpuReset', {});
    }
    return;
  }
  state.pair = pair;
  state.piece = piece;
  state.dropTimer = 0;
  if (state.board[0]![piece.col] !== -1) {
    state.over = true;
    ctx.emit('gameOver', { score: state.score });
  }
}

/** El original exige 4 puyos del mismo color en línea recta (horizontal o vertical). */
function findMatches(board: number[][]): Set<string> {
  const matched = new Set<string>();
  for (let row = 0; row < PUYO.rows; row++) {
    let run = 1;
    for (let col = 1; col <= PUYO.cols; col++) {
      const color = board[row]![col - 1]!;
      const next = col < PUYO.cols ? board[row]![col]! : -1;
      if (color >= 0 && next === color) {
        run++;
      } else {
        if (color >= 0 && run >= PUYO.matchMin) {
          for (let c = col - run; c < col; c++) matched.add(`${row},${c}`);
        }
        run = 1;
      }
    }
  }
  for (let col = 0; col < PUYO.cols; col++) {
    let run = 1;
    for (let row = 1; row <= PUYO.rows; row++) {
      const color = board[row - 1]![col]!;
      const next = row < PUYO.rows ? board[row]![col]! : -1;
      if (color >= 0 && next === color) {
        run++;
      } else {
        if (color >= 0 && run >= PUYO.matchMin) {
          for (let r = row - run; r < row; r++) matched.add(`${r},${col}`);
        }
        run = 1;
      }
    }
  }
  return matched;
}

function collapse(board: number[][]): void {
  for (let col = 0; col < PUYO.cols; col++) {
    let write = PUYO.rows - 1;
    for (let row = PUYO.rows - 1; row >= 0; row--) {
      if (board[row]![col] !== -1) {
        board[write]![col] = board[row]![col]!;
        if (write !== row) board[row]![col] = -1;
        write--;
      }
    }
  }
}

function clearMatched(board: number[][], matched: Set<string>): number {
  let cleared = 0;
  for (const key of matched) {
    const [row, col] = key.split(',').map(Number) as [number, number];
    if (board[row]![col] !== -1) {
      board[row]![col] = -1;
      cleared++;
    }
  }
  return cleared;
}

/** Basura fiel al original: se pega encima de la columna con puyos, no sustituye filas. */
function addGarbage(state: PuyoState, ctx: StepContext, count: number): void {
  for (let i = 0; i < count; i++) {
    const col = ctx.rng.int(PUYO.cols);
    for (let row = 0; row < PUYO.rows; row++) {
      if (state.board[row]![col] !== -1) {
        if (row > 0 && state.board[row - 1]![col] === -1) state.board[row - 1]![col] = PUYO.garbage;
        break;
      }
    }
  }
  if (state.ticks > 0) ctx.emit('garbage', { count });
}

function queueGarbage(state: PuyoState, ctx: StepContext, count: number): void {
  if (count <= 0) return;
  state.garbageQueue += count;
  state.garbageTimer = PUYO.garbageDelayTicks;
  ctx.progression.observe(-Math.min(1, count / 8));
}

function resolveChains(state: PuyoState, ctx: StepContext): void {
  let chain = 0;
  let matched = findMatches(state.board);
  while (matched.size > 0) {
    chain++;
    const cleared = clearMatched(state.board, matched);
    const points = cleared * 10 + (chain > 1 ? chain * 30 : 0) + state.level * 5;
    state.score += points;
    state.chains = chain;
    state.totalChains += 1;
    state.maxChain = Math.max(state.maxChain, chain);
    ctx.emit(chain > 1 ? 'chain' : 'clear', { cleared, chain, points });
    ctx.progression.observe(Math.min(1, chain / 5));
    collapse(state.board);
    matched = findMatches(state.board);
  }
  if (chain > 0) queueGarbage(state, ctx, chain * 2);
}

function lockPiece(state: PuyoState, ctx: StepContext, cpu = false): void {
  const piece = cpu ? state.cpuPiece : state.piece;
  if (!piece || state.over) return;
  const board = cpu ? state.cpuBoard : state.board;
  for (let i = 0; i < 2; i++) {
    const row = piece.row + i;
    if (row >= PUYO.rows) {
      if (cpu) {
        state.cpuBoard = emptyBoard();
        state.cpuPiece = null;
      } else {
        state.over = true;
        ctx.emit('gameOver', { score: state.score, reason: 'overflow' });
      }
      return;
    }
    if (row >= 0) board[row]![piece.col] = piece.gems[i]!;
  }
  if (cpu) {
    const matched = findMatches(state.cpuBoard);
    if (matched.size > 0) {
      const count = clearMatched(state.cpuBoard, matched);
      ctx.emit('cpuChain', { count });
      queueGarbage(state, ctx, Math.floor(count / PUYO.matchMin) * 2);
      collapse(state.cpuBoard);
    }
    state.cpuPiece = null;
    return;
  }
  resolveChains(state, ctx);
  spawnPiece(state, ctx);
}

/** CPU greedy del original: prueba cada columna y elige la que más puyos empareja. */
function cpuThink(state: PuyoState): void {
  const piece = state.cpuPiece;
  if (!piece) return;
  let bestCol = piece.col;
  let bestScore = -1;
  for (let col = 0; col < PUYO.cols; col++) {
    const test = state.cpuBoard.map((row) => [...row]);
    let row = -1;
    while (row + 2 < PUYO.rows && test[row + 2]![col] === -1) row++;
    if (row >= 0) {
      test[row]![col] = piece.gems[0]!;
      if (row + 1 < PUYO.rows) test[row + 1]![col] = piece.gems[1]!;
    }
    const score = findMatches(test).size;
    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }
  piece.col = bestCol;
}

function cpuStep(state: PuyoState, ctx: StepContext, interval: number): void {
  if (state.cpuPiece === null) {
    spawnPiece(state, ctx, true);
    cpuThink(state);
  }
  state.cpuDropTimer++;
  if (state.cpuDropTimer < interval) return;
  state.cpuDropTimer = 0;
  const piece = state.cpuPiece;
  if (!piece) return;
  if (piece.row + 2 < PUYO.rows && state.cpuBoard[piece.row + 2]![piece.col] === -1) piece.row++;
  else lockPiece(state, ctx, true);
}

function hardDropPiece(state: PuyoState, ctx: StepContext): void {
  const piece = state.piece;
  while (piece.row + 2 < PUYO.rows && state.board[piece.row + 2]![piece.col] === -1) piece.row++;
  ctx.emit('hardDrop', { row: piece.row });
  lockPiece(state, ctx);
}

export const puyoGame = defineGame<PuyoState>({
  id: 'puyo-puyo',
  meta: { title: 'Puyo Puyo', players: [1, 2], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['left', 'right', 'rotate', 'rotateCCW', 'softDrop', 'hardDrop', 'restart', 'pause'],
  progression: {
    id: 'puyo-puyo',
    levels: [
      { speed: 1, spawnInterval: 42, hazard: 0, label: 'Nivel 1' },
      { speed: 1.1, spawnInterval: 38, hazard: 0.2, label: 'Nivel 2' },
      { speed: 1.25, spawnInterval: 32, hazard: 0.4, label: 'Nivel 3' },
    ],
    pointsPerLevel: 3,
    dda: { enabled: true, window: 400, maxAdjust: 0.08 },
    patterns: ['chain', 'garbage', 'color'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    return initialState(ctx);
  },

  step(state, ctx) {
    const generation = state.generation;
    const wasPaused = state.paused;
    // B4: Espacio se consume como hardDrop antes de que pause pueda capturarlo.
    const dropRequested = ctx.actions.consume('hardDrop');
    if (
      handleLifecycle(state, ctx, state.totalChains, () => {
        Object.assign(state, initialState(ctx));
        state.generation = generation + 1;
      })
    ) {
      if (dropRequested && !wasPaused && state.generation === generation && !state.over) {
        hardDropPiece(state, ctx);
      }
      return;
    }
    if (state.generation !== generation) return;
    const progress = ctx.progression.state;
    if (progress.level + 1 > state.level) {
      state.level = progress.level + 1;
      state.pattern = ctx.progression.nextPattern() ?? state.pattern;
      if (state.pattern === 'color') state.forcedColor = ctx.rng.int(PUYO.colors);
      if (state.pattern === 'chain') {
        const counts = Array<number>(PUYO.colors).fill(0);
        for (const row of state.board) {
          for (const color of row) if (color >= 0 && color < PUYO.colors) counts[color]!++;
        }
        state.forcedColor = counts.indexOf(Math.max(...counts));
      }
      if (state.pattern === 'garbage') queueGarbage(state, ctx, 1);
      ctx.emit('levelUp', { level: state.level, pattern: state.pattern });
      ctx.schedule(3, () => {
        if (state.generation === generation && !state.paused && !state.over) {
          ctx.emit('fanfare', { level: state.level });
        }
      });
    }

    // B6: la basura diferida es un timer de estado: se congela al pausar y se descarta al reiniciar.
    if (state.garbageTimer > 0) {
      state.garbageTimer--;
      if (state.garbageTimer === 0 && state.garbageQueue > 0) {
        const amount = state.garbageQueue;
        state.garbageQueue = 0;
        addGarbage(state, ctx, amount);
      }
    }

    const interval = clamp(
      Math.round((progress.spawnInterval ?? 42) / progress.speed),
      1,
      PUYO.rows,
    );
    cpuStep(state, ctx, interval);

    const piece = state.piece;
    if (ctx.actions.consume('left') && piece.col > 0 && state.board[piece.row + 2]?.[piece.col - 1] === -1) {
      piece.col--;
      ctx.emit('move', { col: piece.col });
    }
    if (
      ctx.actions.consume('right') &&
      piece.col < PUYO.cols - 1 &&
      state.board[piece.row + 2]?.[piece.col + 1] === -1
    ) {
      piece.col++;
      ctx.emit('move', { col: piece.col });
    }
    const cw = ctx.actions.consume('rotate');
    const ccw = ctx.actions.consume('rotateCCW');
    if (cw || ccw) {
      const first = piece.gems[0];
      piece.gems[0] = piece.gems[1];
      piece.gems[1] = first;
      ctx.emit('rotate', { col: piece.col, ccw });
    }
    if (dropRequested) {
      hardDropPiece(state, ctx);
      state.ticks++;
      return;
    }

    const soft = ctx.actions.isDown('softDrop');
    const playerInterval = Math.max(1, Math.round(interval / (soft ? 6 : 1)));
    state.dropTimer++;
    if (state.dropTimer >= playerInterval) {
      state.dropTimer = 0;
      if (state.board[piece.row + 2]?.[piece.col] === -1 || (piece.row + 2 < 0 && state.board[0]![piece.col] === -1)) {
        piece.row++;
        if (soft) state.score++;
      } else {
        lockPiece(state, ctx);
      }
    }
    state.ticks++;
  },

  observe(state) {
    const heights = Array.from({ length: PUYO.cols }, (_cell, col) => {
      let height = 0;
      for (let row = 0; row < PUYO.rows; row++) {
        if (state.board[row]![col] !== -1) height = PUYO.rows - row;
      }
      return height / PUYO.rows;
    });
    const counts = Array.from({ length: PUYO.colors }, (_cell, color) => {
      let total = 0;
      for (const row of state.board) for (const cell of row) if (cell === color) total++;
      return Math.min(1, total / 12);
    });
    let garbageOnBoard = 0;
    for (const row of state.board) for (const cell of row) if (cell === PUYO.garbage) garbageOnBoard++;
    return new Float32Array([
      ...heights,
      ...counts,
      (state.piece.col / (PUYO.cols - 1)) * 2 - 1,
      ((state.piece.row + 1) / PUYO.rows) * 2 - 1,
      (state.piece.gems[0] / (PUYO.colors - 1)) * 2 - 1,
      (state.piece.gems[1] / (PUYO.colors - 1)) * 2 - 1,
      Math.min(1, state.garbageQueue / 12),
      clamp(state.garbageTimer / PUYO.garbageDelayTicks, 0, 1) * 2 - 1,
      Math.min(1, garbageOnBoard / 12),
      Math.min(1, state.maxChain / 5),
      Math.min(1, state.level / 10),
      state.over ? 1 : -1,
    ]);
  },

  render(renderer, state, _alpha) {
    // alpha se ignora: la animación se deriva de ticks y de los timers del estado.
    const ctx = renderer as CanvasRenderingContext2D | null;
    if (!ctx || typeof ctx.clearRect !== 'function') return;
    const cell = 36;
    const boardW = PUYO.cols * cell;
    const boardH = PUYO.rows * cell;
    const panelX = boardW + 20;
    const panelW = 180;
    const width = panelX + panelW;
    const colors = ['#ff4d6d', '#ffd166', '#4ade80', '#4cc9f0'];
    ctx.clearRect(0, 0, width, boardH);
    ctx.fillStyle = '#070b1c';
    ctx.fillRect(0, 0, width, boardH);

    const puyo = (x: number, y: number, r: number, value: number): void => {
      ctx.fillStyle = value === PUYO.garbage ? '#64748b' : colors[value] ?? colors[0]!;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.38)';
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    };
    const drawBoard = (board: number[][], ox: number, oy: number, size: number): void => {
      for (let row = 0; row < PUYO.rows; row++) {
        for (let col = 0; col < PUYO.cols; col++) {
          const value = board[row]![col]!;
          if (value >= 0) puyo(ox + (col + 0.5) * size, oy + (row + 0.5) * size, size * 0.42, value);
        }
      }
    };
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fillRect(0, 0, boardW, boardH);
    drawBoard(state.board, 0, 0, cell);
    for (let i = 0; i < 2; i++) {
      const row = state.piece.row + i;
      if (row >= 0 && row < PUYO.rows) {
        puyo((state.piece.col + 0.5) * cell, (row + 0.5) * cell, cell * 0.42, state.piece.gems[i]!);
      }
    }

    // Panel del rival: tablero CPU en miniatura para hacer legible la presión de basura.
    const mini = 14;
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('CPU', panelX + 8, 20);
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fillRect(panelX + 8, 30, PUYO.cols * mini, PUYO.rows * mini);
    drawBoard(state.cpuBoard, panelX + 8, 30, mini);
    if (state.cpuPiece) {
      for (let i = 0; i < 2; i++) {
        const row = state.cpuPiece.row + i;
        if (row >= 0 && row < PUYO.rows) {
          puyo(
            panelX + 8 + (state.cpuPiece.col + 0.5) * mini,
            30 + (row + 0.5) * mini,
            mini * 0.42,
            state.cpuPiece.gems[i]!,
          );
        }
      }
    }

    ctx.fillStyle = '#94a3b8';
    ctx.fillText('PAR', panelX + 8, 254);
    puyo(panelX + 34, 282, 13, state.pair[0]!);
    puyo(panelX + 64, 282, 13, state.pair[1]!);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`PTS ${state.score}`, panelX + 8, boardH - 72);
    ctx.fillText(`LV ${state.level}  CH ${state.maxChain}`, panelX + 8, boardH - 52);
    ctx.fillStyle = state.garbageQueue > 0 ? '#fb7185' : '#475569';
    ctx.fillText(`BASURA ${state.garbageQueue}`, panelX + 8, boardH - 32);
  },

  rules: singlePlayerRules<PuyoState>((state) =>
    state.score + state.maxChain * 200 + state.totalChains * 50 + state.level * 50 - (state.over ? 400 : 0),
  ),
});
