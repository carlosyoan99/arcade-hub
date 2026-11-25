import { clamp } from '../../core/math.js';
import type { StepContext } from '../../core/simulation.js';
import { defineGame } from '../../game/contract.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';

export const COLUMNS = {
  cols: 6,
  rows: 12,
  colors: 6,
  matchMin: 3,
  flashTicks: 30,
  special: { flash: 6, lightning: 7, poison: 8 } as const,
} as const;

export interface ColumnsPiece {
  col: number;
  row: number;
  gems: [number, number, number];
}

export interface ColumnsState {
  board: number[][];
  piece: ColumnsPiece;
  nextGem: number;
  score: number;
  level: number;
  gemsCleared: number;
  chains: number;
  maxChain: number;
  over: boolean;
  paused: boolean;
  generation: number;
  ticks: number;
  dropTimer: number;
  flashTimer: number;
  pendingClear: boolean;
  flashCells: string[];
  pattern: string;
}

function emptyBoard(): number[][] {
  return Array.from({ length: COLUMNS.rows }, () => Array<number>(COLUMNS.cols).fill(-1));
}

function rollGem(state: ColumnsState, ctx: StepContext): number {
  if (state.nextGem >= 0) {
    const gem = state.nextGem;
    state.nextGem = -1;
    return gem;
  }
  const chance = Math.min(0.35, 0.12 + Math.max(0, state.chains - 1) * 0.1);
  if (ctx.rng.next() < chance) {
    const specials = Object.values(COLUMNS.special);
    return specials[ctx.rng.int(specials.length)]!;
  }
  return ctx.rng.int(COLUMNS.colors);
}

function initialState(ctx: StepContext): ColumnsState {
  const state: ColumnsState = {
    board: emptyBoard(),
    piece: { col: 2, row: -1, gems: [0, 1, 2] },
    nextGem: -1,
    score: 0,
    level: 1,
    gemsCleared: 0,
    chains: 0,
    maxChain: 0,
    over: false,
    paused: false,
    generation: 0,
    ticks: 0,
    dropTimer: 0,
    flashTimer: 0,
    pendingClear: false,
    flashCells: [],
    pattern: ctx.progression.nextPattern() ?? 'gem',
  };
  spawnPiece(state, ctx);
  return state;
}

function spawnPiece(state: ColumnsState, ctx: StepContext): void {
  state.piece = {
    col: Math.floor(COLUMNS.cols / 2),
    row: -1,
    gems: [rollGem(state, ctx), rollGem(state, ctx), rollGem(state, ctx)],
  };
  state.dropTimer = 0;
  state.chains = 0;
  const col = state.piece.col;
  if (state.board[0]![col] !== -1 || state.board[1]![col] !== -1) {
    state.over = true;
    ctx.emit('gameOver', { score: state.score });
  }
}

function findMatches(board: number[][]): Set<string> {
  const matched = new Set<string>();
  const dirs: ReadonlyArray<readonly [number, number]> = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let row = 0; row < COLUMNS.rows; row++) {
    for (let col = 0; col < COLUMNS.cols; col++) {
      const color = board[row]![col]!;
      if (color < 0) continue;
      for (const [dy, dx] of dirs) {
        let length = 1;
        while (
          row + dy * length >= 0 &&
          row + dy * length < COLUMNS.rows &&
          col + dx * length >= 0 &&
          col + dx * length < COLUMNS.cols &&
          board[row + dy * length]![col + dx * length] === color
        ) {
          length++;
        }
        if (length < COLUMNS.matchMin) continue;
        for (let i = 0; i < length; i++) matched.add(`${row + dy * i},${col + dx * i}`);
      }
    }
  }
  return matched;
}

/** Power-ups fieles al original: flash tiñe vecinos, rayo limpia fila, veneno aleatoriza gemas. */
function applyPowerEffects(state: ColumnsState, ctx: StepContext, matched: Set<string>): void {
  const counts = Array<number>(COLUMNS.colors).fill(0);
  let best = -1;
  let bestCount = 0;
  for (const key of matched) {
    const [row, col] = key.split(',').map(Number) as [number, number];
    const gem = state.board[row]![col]!;
    if (gem >= 0 && gem < COLUMNS.colors) {
      counts[gem]!++;
      if (counts[gem]! > bestCount) {
        bestCount = counts[gem]!;
        best = gem;
      }
    }
  }
  const matchColor = best >= 0 ? best : ctx.rng.int(COLUMNS.colors);
  let poisoned = false;
  for (const key of [...matched]) {
    const [row, col] = key.split(',').map(Number) as [number, number];
    const gem = state.board[row]![col]!;
    if (gem === COLUMNS.special.flash) {
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nr >= COLUMNS.rows || nc < 0 || nc >= COLUMNS.cols) continue;
        const neighbor = state.board[nr]![nc]!;
        if (neighbor >= 0 && neighbor < COLUMNS.colors) {
          state.board[nr]![nc] = matchColor;
          matched.add(`${nr},${nc}`);
        }
      }
    } else if (gem === COLUMNS.special.lightning) {
      for (let c = 0; c < COLUMNS.cols; c++) {
        if (state.board[row]![c] !== -1) matched.add(`${row},${c}`);
      }
    } else if (gem === COLUMNS.special.poison) {
      poisoned = true;
    }
  }
  if (poisoned) {
    for (let r = 0; r < COLUMNS.rows; r++) {
      for (let c = 0; c < COLUMNS.cols; c++) {
        const gem = state.board[r]![c]!;
        if (gem >= 0 && gem < COLUMNS.colors) state.board[r]![c] = ctx.rng.int(COLUMNS.colors);
      }
    }
    ctx.emit('poison', {});
  }
}

function clearAndCollapse(state: ColumnsState, ctx: StepContext, matched: Set<string>, chain: number): number {
  applyPowerEffects(state, ctx, matched);
  let cleared = 0;
  for (const key of matched) {
    const [row, col] = key.split(',').map(Number) as [number, number];
    if (state.board[row]![col] !== -1) {
      state.board[row]![col] = -1;
      cleared++;
    }
  }
  if (cleared === 0) return 0;
  for (let col = 0; col < COLUMNS.cols; col++) {
    let write = COLUMNS.rows - 1;
    for (let row = COLUMNS.rows - 1; row >= 0; row--) {
      if (state.board[row]![col] !== -1) {
        state.board[write]![col] = state.board[row]![col]!;
        if (write !== row) state.board[row]![col] = -1;
        write--;
      }
    }
  }
  state.chains = chain;
  state.maxChain = Math.max(state.maxChain, chain);
  const points = cleared * 10 + (chain > 1 ? chain * 20 : 0) + state.level * 5;
  state.score += points;
  state.gemsCleared += cleared;
  state.level = Math.floor(state.gemsCleared / 25) + 1;
  ctx.emit(chain > 1 ? 'chain' : 'clear', { cleared, chain, points });
  ctx.progression.observe(Math.min(1, chain / 4));
  return cleared;
}

/** Tras una cascada puede aparecer una gema especial (flash/rayo/veneno). */
function maybeSpawnPowerGem(state: ColumnsState, ctx: StepContext): void {
  const probability = Math.min(0.35, 0.12 + Math.max(0, state.chains - 1) * 0.1);
  if (ctx.rng.next() >= probability) return;
  const specials = Object.values(COLUMNS.special);
  const type = specials[ctx.rng.int(specials.length)]!;
  const col = ctx.rng.int(COLUMNS.cols);
  for (let row = COLUMNS.rows - 1; row >= 0; row--) {
    if (state.board[row]![col] === -1) {
      state.board[row]![col] = type;
      ctx.emit('powerGem', { type, row, col });
      return;
    }
  }
}

function processClear(state: ColumnsState, ctx: StepContext): void {
  const matched = new Set(state.flashCells);
  state.flashCells = [];
  state.flashTimer = 0;
  state.pendingClear = false;
  if (clearAndCollapse(state, ctx, matched, state.chains + 1) > 0) {
    const next = findMatches(state.board);
    if (next.size > 0) {
      state.flashCells = [...next];
      state.flashTimer = COLUMNS.flashTicks;
      state.pendingClear = true;
      return;
    }
  }
  maybeSpawnPowerGem(state, ctx);
  spawnPiece(state, ctx);
}

function lockPiece(state: ColumnsState, ctx: StepContext): void {
  const piece = state.piece;
  for (let i = 0; i < 3; i++) {
    const row = piece.row + i;
    if (row >= 0 && row < COLUMNS.rows) state.board[row]![piece.col] = piece.gems[i]!;
    else if (row >= COLUMNS.rows) {
      state.over = true;
      ctx.emit('gameOver', { score: state.score, reason: 'overflow' });
      return;
    }
  }
  const matched = findMatches(state.board);
  if (matched.size > 0) {
    state.flashCells = [...matched];
    state.flashTimer = COLUMNS.flashTicks;
    state.pendingClear = true;
  } else {
    spawnPiece(state, ctx);
  }
}

function hardDropPiece(state: ColumnsState, ctx: StepContext): void {
  const piece = state.piece;
  while (piece.row + 3 < COLUMNS.rows && state.board[piece.row + 3]![piece.col] === -1) {
    piece.row++;
  }
  ctx.emit('hardDrop', { row: piece.row });
  lockPiece(state, ctx);
}

export const columnsGame = defineGame<ColumnsState>({
  id: 'columns',
  meta: { title: 'Columns', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['left', 'right', 'rotate', 'softDrop', 'hardDrop', 'restart', 'pause'],
  progression: {
    id: 'columns',
    levels: [
      { speed: 1, spawnInterval: 36, hazard: 0, label: 'Nivel 1' },
      { speed: 1.1, spawnInterval: 32, hazard: 0.15, label: 'Nivel 2' },
      { speed: 1.22, spawnInterval: 28, hazard: 0.3, label: 'Nivel 3' },
    ],
    pointsPerLevel: 20,
    dda: { enabled: true, window: 400, maxAdjust: 0.08 },
    patterns: ['gem', 'power', 'chain'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    return initialState(ctx);
  },

  step(state, ctx) {
    const generation = state.generation;
    const wasPaused = state.paused;
    // B3: Espacio se consume como hardDrop antes de que pause pueda capturarlo.
    const dropRequested = ctx.actions.consume('hardDrop');
    if (
      handleLifecycle(state, ctx, state.gemsCleared, () => {
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
      state.nextGem =
        state.pattern === 'power'
          ? COLUMNS.special.lightning
          : state.pattern === 'chain'
            ? COLUMNS.special.flash
            : -1;
      ctx.emit('levelUp', { level: state.level, pattern: state.pattern });
    }

    // B3/B6: el timer de flash vive en el estado y se congela con la pausa.
    if (state.pendingClear) {
      state.flashTimer--;
      if (state.flashTimer <= 0) processClear(state, ctx);
      state.ticks++;
      return;
    }

    const piece = state.piece;
    if (ctx.actions.consume('left') && piece.col > 0 && state.board[piece.row + 2]?.[piece.col - 1] === -1) {
      piece.col--;
      ctx.emit('move', { col: piece.col });
    }
    if (
      ctx.actions.consume('right') &&
      piece.col < COLUMNS.cols - 1 &&
      state.board[piece.row + 2]?.[piece.col + 1] === -1
    ) {
      piece.col++;
      ctx.emit('move', { col: piece.col });
    }
    if (ctx.actions.consume('rotate')) {
      const first = piece.gems[0]!;
      piece.gems[0] = piece.gems[1];
      piece.gems[1] = piece.gems[2];
      piece.gems[2] = first;
      ctx.emit('rotate', { col: piece.col });
    }
    if (dropRequested) {
      hardDropPiece(state, ctx);
      state.ticks++;
      return;
    }

    const soft = ctx.actions.isDown('softDrop');
    const interval = clamp(
      Math.round((progress.spawnInterval ?? 36) / progress.speed / (soft ? 6 : 1)),
      1,
      COLUMNS.rows,
    );
    state.dropTimer++;
    if (state.dropTimer >= interval) {
      state.dropTimer = 0;
      if (state.board[piece.row + 3]?.[piece.col] === -1 || (piece.row + 3 < 0 && state.board[0]![piece.col] === -1)) {
        piece.row++;
        if (soft) state.score++;
      } else {
        lockPiece(state, ctx);
      }
    }
    state.ticks++;
  },

  observe(state) {
    const heights = Array.from({ length: COLUMNS.cols }, (_cell, col) => {
      let height = 0;
      for (let row = 0; row < COLUMNS.rows; row++) {
        if (state.board[row]![col] !== -1) height = COLUMNS.rows - row;
      }
      return height / COLUMNS.rows;
    });
    let specials = 0;
    for (const row of state.board) for (const gem of row) if (gem >= COLUMNS.special.flash) specials++;
    return new Float32Array([
      ...heights,
      (state.piece.col / (COLUMNS.cols - 1)) * 2 - 1,
      ((state.piece.row + 1) / COLUMNS.rows) * 2 - 1,
      ...state.piece.gems.map((gem) => (gem / COLUMNS.special.poison) * 2 - 1),
      Math.min(1, state.chains / 4),
      Math.min(1, state.gemsCleared / 100),
      Math.min(1, specials / 8),
      clamp(state.flashTimer / COLUMNS.flashTicks, 0, 1) * 2 - 1,
      Math.min(1, state.level / 10),
      state.over ? 1 : -1,
    ]);
  },

  render(renderer, state, _alpha) {
    // alpha se ignora: el parpadeo de flash se deriva de flashTimer.
    const ctx = renderer as CanvasRenderingContext2D | null;
    if (!ctx || typeof ctx.clearRect !== 'function') return;
    const cell = 40;
    const boardW = COLUMNS.cols * cell;
    const boardH = COLUMNS.rows * cell;
    const panelX = boardW + 16;
    const panelW = 140;
    const width = panelX + panelW;
    const colors = ['#ff4d6d', '#fb923c', '#facc15', '#4ade80', '#22d3ee', '#c084fc', '#f8fafc', '#fde047', '#a855f7'];
    ctx.clearRect(0, 0, width, boardH);
    ctx.fillStyle = '#070b1c';
    ctx.fillRect(0, 0, width, boardH);

    ctx.strokeStyle = 'rgba(56,189,248,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let col = 0; col <= COLUMNS.cols; col++) {
      ctx.moveTo(col * cell, 0);
      ctx.lineTo(col * cell, boardH);
    }
    for (let row = 0; row <= COLUMNS.rows; row++) {
      ctx.moveTo(0, row * cell);
      ctx.lineTo(boardW, row * cell);
    }
    ctx.stroke();

    const gem = (col: number, row: number, value: number, flash: boolean): void => {
      if (row < 0 || row >= COLUMNS.rows || col < 0 || col >= COLUMNS.cols) return;
      const cx = col * cell + cell / 2;
      const cy = row * cell + cell / 2;
      const r = cell * 0.36;
      ctx.fillStyle = colors[value] ?? colors[0]!;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.55, cy - r * 0.15);
      ctx.lineTo(cx, cy - r * 0.8);
      ctx.lineTo(cx + r * 0.55, cy - r * 0.15);
      ctx.closePath();
      ctx.fill();
      if (flash) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (value === COLUMNS.special.flash) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 2, cy - 6, 4, 12);
        ctx.fillRect(cx - 6, cy - 2, 12, 4);
      } else if (value === COLUMNS.special.lightning) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 3, cy - 7);
        ctx.lineTo(cx + 3, cy - 1);
        ctx.lineTo(cx - 2, cy + 7);
        ctx.stroke();
      } else if (value === COLUMNS.special.poison) {
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    };
    const flashing = new Set(state.flashCells);
    const flashOn = state.flashTimer > 0 && Math.floor(state.flashTimer / 4) % 2 === 0;
    for (let row = 0; row < COLUMNS.rows; row++) {
      for (let col = 0; col < COLUMNS.cols; col++) {
        const value = state.board[row]![col]!;
        if (value >= 0) gem(col, row, value, flashOn && flashing.has(`${row},${col}`));
      }
    }
    for (let i = 0; i < 3; i++) {
      gem(state.piece.col, state.piece.row + i, state.piece.gems[i]!, false);
    }

    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('NEXT', panelX + 8, 24);
    if (state.nextGem >= 0) {
      const cx = panelX + panelW / 2;
      const cy = 62;
      const r = cell * 0.5;
      ctx.fillStyle = colors[state.nextGem] ?? colors[0]!;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.arc(cx - r * 0.3, cy - r * 0.35, r * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`PTS ${state.score}`, panelX + 8, boardH - 72);
    ctx.fillText(`LV ${state.level}`, panelX + 8, boardH - 52);
    ctx.fillText(`CHAIN ${state.maxChain}`, panelX + 8, boardH - 32);
  },

  rules: singlePlayerRules<ColumnsState>((state) =>
    state.score + state.maxChain * 100 + state.gemsCleared - (state.over ? 300 : 0),
  ),
});
