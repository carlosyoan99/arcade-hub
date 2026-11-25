import { defineGame } from '../../game/contract.js';
import type { StepContext } from '../../core/simulation.js';
import { clamp, manhattan } from '../../core/math.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import { COLLISION_SERVICE, type CollisionService, type AABB } from '../../sim/collision.js';
import { PATHFINDING_SERVICE, type PathfindingService } from '../../sim/pathfinding.js';

export const DIGDUG = {
  cols: 20,
  rows: 22,
  gs: 16,
  empty: 0,
  dirt: 1,
  rock: 2,
  maxLives: 3,
  pumpRate: 0.12,
  pumpStep: 0.08,
  pointsPooka: 1000,
  pointsFygar: 2000,
  waveDelay: 0.6,
} as const;

const DC = [0, 1, 0, -1];
const DR = [-1, 0, 1, 0];

export interface DigEnemy {
  c: number;
  r: number;
  type: 'pooka' | 'fygar';
  alive: boolean;
  dir: number;
  moveTimer: number;
  moveInterval: number;
  inflation: number;
  stunned: number;
  disguised: boolean;
  disguiseTimer: number;
}
export interface FallingRock {
  c: number;
  r: number;
  vy: number;
}
export interface Fruit {
  c: number;
  r: number;
  type: number;
  timer: number;
}
export interface DigDugState {
  grid: number[][];
  c: number;
  r: number;
  dir: number;
  pumpTimer: number;
  invincibleTimer: number;
  pumpTarget: number | null;
  pumpProgress: number;
  enemies: DigEnemy[];
  fallingRocks: FallingRock[];
  fruits: Fruit[];
  fruitTimer: number;
  waveTimer: number;
  score: number;
  lives: number;
  level: number;
  progress: number;
  paused: boolean;
  over: boolean;
  ticks: number;
  pattern: string | null;
}

function buildGrid(state: DigDugState, ctx: StepContext): void {
  state.grid = [];
  for (let r = 0; r < DIGDUG.rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < DIGDUG.cols; c++) {
      if (r < 3 || r >= DIGDUG.rows - 2) row.push(DIGDUG.empty);
      else if (r >= 3 && r <= 5 && (c === 0 || c === DIGDUG.cols - 1)) row.push(DIGDUG.empty);
      else row.push(DIGDUG.dirt);
    }
    state.grid.push(row);
  }
  const rocks = 4 + state.level + (state.pattern === 'rock' ? 3 : 0);
  let placed = 0;
  while (placed < rocks) {
    const c = 2 + ctx.rng.int(DIGDUG.cols - 4);
    const r = 4 + ctx.rng.int(DIGDUG.rows - 8);
    if (state.grid[r]?.[c] === DIGDUG.dirt && state.grid[r]?.[c + 1] === DIGDUG.dirt) {
      const row = state.grid[r];
      if (row !== undefined) {
        row[c] = DIGDUG.rock;
        row[c + 1] = DIGDUG.rock;
      }
      placed++;
    }
  }
  const mid = Math.floor(DIGDUG.cols / 2);
  for (let dc = -1; dc <= 1; dc++) {
    const row = state.grid[3];
    if (row !== undefined) row[mid + dc] = DIGDUG.empty;
  }
}

function spawnEnemies(state: DigDugState, ctx: StepContext): void {
  const count = Math.min(2 + state.level, 6);
  const points: ReadonlyArray<readonly [number, number]> = [
    [1, 1],
    [DIGDUG.cols - 2, 1],
    [2, 0],
    [DIGDUG.cols - 3, 0],
    [Math.floor(DIGDUG.cols / 2) - 1, 1],
    [Math.floor(DIGDUG.cols / 2) + 1, 1],
  ];
  state.enemies = [];
  for (let i = 0; i < count; i++) {
    const spawn = points[i % points.length];
    state.enemies.push({
      c: spawn?.[0] ?? 1,
      r: spawn?.[1] ?? 1,
      type: i % 2 === 0 ? 'pooka' : 'fygar',
      alive: true,
      dir: 1,
      moveTimer: 0,
      moveInterval: 0.3 + ctx.rng.next() * 0.15,
      inflation: 0,
      stunned: 0,
      disguised: false,
      disguiseTimer: 3 + ctx.rng.next() * 5,
    });
  }
}

function startWave(state: DigDugState, ctx: StepContext): void {
  state.pattern = ctx.progression.nextPattern();
  buildGrid(state, ctx);
  spawnEnemies(state, ctx);
  state.c = Math.floor(DIGDUG.cols / 2);
  state.r = 3;
  state.dir = 0;
  state.pumpTarget = null;
  state.pumpProgress = 0;
  state.fallingRocks = [];
  state.fruits = [];
  state.fruitTimer = 3;
  state.waveTimer = 0;
  ctx.emit('levelStart', { level: state.level, pattern: state.pattern });
}

function resetGame(state: DigDugState, ctx: StepContext): void {
  state.score = 0;
  state.lives = DIGDUG.maxLives;
  state.level = 1;
  state.progress = 0;
  state.pumpTimer = 0;
  state.invincibleTimer = 0;
  state.over = false;
  startWave(state, ctx);
}

function at(state: DigDugState, c: number, r: number): number {
  return state.grid[r]?.[c] ?? DIGDUG.dirt;
}
function isEmpty(state: DigDugState, c: number, r: number): boolean {
  return r >= 0 && r < DIGDUG.rows && c >= 0 && c < DIGDUG.cols && at(state, c, r) === DIGDUG.empty;
}
function isDirt(state: DigDugState, c: number, r: number): boolean {
  return r >= 0 && r < DIGDUG.rows && c >= 0 && c < DIGDUG.cols && at(state, c, r) === DIGDUG.dirt;
}

function loseLife(state: DigDugState, ctx: StepContext): void {
  if (state.invincibleTimer > 0) return;
  state.lives--;
  ctx.emit('hit', { c: state.c, r: state.r });
  ctx.progression.observe(-0.8);
  if (state.lives <= 0) {
    state.over = true;
    ctx.emit('gameOver', { score: state.score });
    return;
  }
  state.invincibleTimer = 2;
  state.c = Math.floor(DIGDUG.cols / 2);
  state.r = 3;
  state.pumpTarget = null;
  state.pumpProgress = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (isDirt(state, state.c + dc, state.r + dr)) {
        const row = state.grid[state.r + dr];
        if (row !== undefined) row[state.c + dc] = DIGDUG.empty;
      }
    }
  }
}

function spawnFruit(state: DigDugState, ctx: StepContext): void {
  if (state.fruits.length > 0) return;
  const c = 2 + ctx.rng.int(DIGDUG.cols - 4);
  const r = 4 + ctx.rng.int(DIGDUG.rows - 6);
  if (isEmpty(state, c, r)) {
    state.fruits.push({ c, r, type: ctx.rng.int(3), timer: 8 });
  }
}

function killEnemy(state: DigDugState, enemy: DigEnemy, ctx: StepContext): void {
  enemy.alive = false;
  state.score += enemy.type === 'pooka' ? DIGDUG.pointsPooka : DIGDUG.pointsFygar;
  ctx.emit('pop', { type: enemy.type });
  ctx.progression.observe(0.6);
}

function updatePlayer(state: DigDugState, dt: number, ctx: StepContext): void {
  if (state.invincibleTimer > 0) state.invincibleTimer -= dt;
  if (state.pumpTimer > 0) state.pumpTimer -= dt;

  let dc = 0;
  let dr = 0;
  if (ctx.actions.isDown('left')) {
    dc = -1;
    state.dir = 3;
  } else if (ctx.actions.isDown('right')) {
    dc = 1;
    state.dir = 1;
  } else if (ctx.actions.isDown('up')) {
    dr = -1;
    state.dir = 0;
  } else if (ctx.actions.isDown('down')) {
    dr = 1;
    state.dir = 2;
  }
  if (dc !== 0 || dr !== 0) {
    const nc = state.c + dc;
    const nr = state.r + dr;
    if (isEmpty(state, nc, nr)) {
      if (isDirt(state, nc, nr)) {
        state.score += 1;
        ctx.emit('dig', { c: nc, r: nr });
      }
      state.c = nc;
      state.r = nr;
    }
  }

  const facingC = state.c + (DC[state.dir] ?? 0);
  const facingR = state.r + (DR[state.dir] ?? 0);
  if (ctx.actions.isDown('pump') && state.pumpTimer <= 0) {
    state.pumpTimer = DIGDUG.pumpRate;
    const target = state.enemies.find(
      (enemy) => enemy.alive && enemy.c === facingC && enemy.r === facingR && enemy.inflation < 1,
    );
    if (target !== undefined) {
      const index = state.enemies.indexOf(target);
      if (state.pumpTarget !== index) {
        state.pumpTarget = index;
        state.pumpProgress = 0;
      }
      if (target.disguised) {
        target.disguised = false;
        target.disguiseTimer = 4 + ctx.rng.next() * 4;
      }
      state.pumpProgress += DIGDUG.pumpStep;
      target.inflation = state.pumpProgress;
      ctx.emit('pump', { type: target.type, progress: state.pumpProgress });
      if (state.pumpProgress >= 1) {
        killEnemy(state, target, ctx);
        state.pumpTarget = null;
        state.pumpProgress = 0;
      }
    } else {
      state.pumpTarget = null;
      state.pumpProgress = 0;
    }
  } else if (!ctx.actions.isDown('pump')) {
    state.pumpTarget = null;
    state.pumpProgress = 0;
  }

  if (state.invincibleTimer <= 0) {
    for (const enemy of state.enemies) {
      if (!enemy.alive || enemy.inflation > 0.3) continue;
      if (enemy.c === state.c && enemy.r === state.r) {
        loseLife(state, ctx);
        break;
      }
    }
  }
}

function updateEnemies(state: DigDugState, dt: number, ctx: StepContext, pathfinding: PathfindingService): void {
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    enemy.moveInterval = enemy.inflation > 0 ? 0.3 + enemy.inflation * 0.5 : 0.25 + ctx.rng.next() * 0.1;
    enemy.moveTimer += dt;
    if (enemy.moveTimer < enemy.moveInterval || enemy.inflation >= 1 || enemy.stunned > 0) {
      if (enemy.stunned > 0) enemy.stunned -= dt;
      continue;
    }
    enemy.moveTimer = 0;

    if (enemy.type === 'pooka') {
      if (enemy.disguised) {
        const distance = manhattan(state.c, state.r, enemy.c, enemy.r);
        if (distance <= 2) {
          enemy.disguised = false;
          enemy.disguiseTimer = 4 + ctx.rng.next() * 4;
        }
        continue;
      }
      enemy.disguiseTimer -= enemy.moveInterval;
      if (enemy.disguiseTimer <= 0) {
        enemy.disguised = true;
        enemy.disguiseTimer = 0;
        continue;
      }
    }

    const preferred = pathfinding.greedyStep(
      state.grid,
      { col: enemy.c, row: enemy.r },
      { col: state.c, row: state.r },
      (cell) => cell === DIGDUG.empty,
    );
    let moved = false;
    const dirs: number[] = [];
    if (preferred !== null) {
      const dc = preferred.col - enemy.c;
      const dr = preferred.row - enemy.r;
      const index = [DC.indexOf(dc), DR.indexOf(dr)].find((value) => value >= 0);
      if (index !== undefined) dirs.push(index);
    }
    if (state.pattern === 'chase' || ctx.rng.next() < 0.3) dirs.push(ctx.rng.int(4));
    for (const dir of dirs) {
      const nc = enemy.c + (DC[dir] ?? 0);
      const nr = enemy.r + (DR[dir] ?? 0);
      if (isEmpty(state, nc, nr)) {
        enemy.c = nc;
        enemy.r = nr;
        enemy.dir = dir;
        moved = true;
        break;
      }
    }
    if (!moved) {
      const dir = ctx.rng.int(4);
      const nc = enemy.c + (DC[dir] ?? 0);
      const nr = enemy.r + (DR[dir] ?? 0);
      if (isEmpty(state, nc, nr)) {
        enemy.c = nc;
        enemy.r = nr;
        enemy.dir = dir;
      }
    }

    if (enemy.type === 'fygar' && ctx.rng.next() < 0.02) {
      const fdc = enemy.dir === 1 ? 1 : enemy.dir === 3 ? -1 : 0;
      const fdr = enemy.dir === 2 ? 1 : enemy.dir === 0 ? -1 : 0;
      for (let i = 1; i <= 4; i++) {
        if (enemy.c + fdc * i === state.c && enemy.r + fdr * i === state.r) {
          ctx.emit('fire', { type: 'fygar' });
          loseLife(state, ctx);
          break;
        }
      }
    }
  }
}

function checkFallingRocks(state: DigDugState, ctx: StepContext): void {
  for (let r = 0; r < DIGDUG.rows; r++) {
    for (let c = 0; c < DIGDUG.cols; c++) {
      if (at(state, c, r) !== DIGDUG.rock) continue;
      if (state.fallingRocks.some((rock) => rock.c === c && Math.floor(rock.r) === r)) continue;
      const belowA = at(state, c, r + 1);
      const belowB = at(state, c + 1, r + 1);
      if (belowA !== DIGDUG.dirt || belowB !== DIGDUG.dirt) {
        state.fallingRocks.push({ c, r, vy: 0 });
        const row = state.grid[r];
        if (row !== undefined) {
          row[c] = DIGDUG.empty;
          if (c + 1 < DIGDUG.cols) row[c + 1] = DIGDUG.empty;
        }
        ctx.emit('rockFall', { c, r });
        return;
      }
    }
  }
}

function updateFallingRocks(state: DigDugState, dt: number, ctx: StepContext, collision: CollisionService): void {
  for (let i = state.fallingRocks.length - 1; i >= 0; i--) {
    const rock = state.fallingRocks[i];
    if (rock === undefined) continue;
    rock.vy += 200 * dt;
    rock.r += (rock.vy * dt) / DIGDUG.gs;
    const row = Math.floor(rock.r);
    const rockBox: AABB = { x: rock.c, y: row, w: 2, h: 1 };
    for (const enemy of state.enemies) {
      if (!enemy.alive || !collision.aabbOverlap(rockBox, { x: enemy.c + 0.2, y: enemy.r + 0.2, w: 0.6, h: 0.6 })) continue;
      killEnemy(state, enemy, ctx);
    }
    if (collision.aabbOverlap(rockBox, { x: state.c + 0.2, y: state.r + 0.2, w: 0.6, h: 0.6 })) {
      loseLife(state, ctx);
    }
    if (row >= DIGDUG.rows - 1) state.fallingRocks.splice(i, 1);
  }
}

function updateFruits(state: DigDugState, dt: number, ctx: StepContext): void {
  state.fruitTimer -= dt;
  if (state.fruitTimer <= 0) {
    spawnFruit(state, ctx);
    state.fruitTimer = 5 + ctx.rng.next() * 3;
  }
  for (let i = state.fruits.length - 1; i >= 0; i--) {
    const fruit = state.fruits[i];
    if (fruit === undefined) continue;
    fruit.timer -= dt;
    if (fruit.timer <= 0) {
      state.fruits.splice(i, 1);
      continue;
    }
    if (fruit.c === state.c && fruit.r === state.r) {
      state.score += 500;
      state.fruits.splice(i, 1);
      ctx.emit('fruit', {});
      ctx.progression.observe(0.4);
    }
  }
}

export const digDugGame = defineGame<DigDugState>({
  id: 'dig-dug',
  meta: { title: 'Dig Dug', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['up', 'down', 'left', 'right', 'pump', 'pause', 'restart'],
  progression: {
    id: 'dig-dug',
    levels: [
      { speed: 1, spawnInterval: 8, hazard: 0, label: 'Nivel 1' },
      { speed: 1.1, spawnInterval: 7, hazard: 0.2, label: 'Nivel 2' },
      { speed: 1.25, spawnInterval: 6, hazard: 0.4, label: 'Nivel 3' },
    ],
    pointsPerLevel: 1,
    dda: { enabled: true, window: 300, maxAdjust: 0.08 },
    patterns: ['tunnel', 'rock', 'chase'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    const state: DigDugState = {
      grid: [],
      c: 0,
      r: 0,
      dir: 0,
      pumpTimer: 0,
      invincibleTimer: 0,
      pumpTarget: null,
      pumpProgress: 0,
      enemies: [],
      fallingRocks: [],
      fruits: [],
      fruitTimer: 0,
      waveTimer: 0,
      score: 0,
      lives: DIGDUG.maxLives,
      level: 1,
      progress: 0,
      paused: false,
      over: false,
      ticks: 0,
      pattern: null,
    };
    startWave(state, ctx);
    return state;
  },

  step(state, ctx) {
    if (handleLifecycle(state, ctx, state.progress, () => resetGame(state, ctx))) return;
    const dt = ctx.clock.dt * ctx.progression.state.speed;
    const collision = ctx.services.get<CollisionService>(COLLISION_SERVICE);
    const pathfinding = ctx.services.get<PathfindingService>(PATHFINDING_SERVICE);

    if (state.enemies.every((enemy) => !enemy.alive)) {
      state.waveTimer += dt;
      if (state.waveTimer >= DIGDUG.waveDelay) {
        state.level++;
        state.progress = state.level;
        state.score += 1000;
        ctx.emit('levelUp', { level: state.level });
        ctx.progression.observe(1);
        startWave(state, ctx);
        state.ticks++;
        return;
      }
    } else {
      state.waveTimer = 0;
    }

    updatePlayer(state, dt, ctx);
    if (state.over) return;
    updateEnemies(state, dt, ctx, pathfinding);
    if (state.over) return;
    checkFallingRocks(state, ctx);
    updateFallingRocks(state, dt, ctx, collision);
    if (state.over) return;
    updateFruits(state, dt, ctx);
    state.ticks++;
  },

  observe(state) {
    let near = 99;
    let dc = 0;
    let dr = 0;
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      const distance = manhattan(state.c, state.r, enemy.c, enemy.r);
      if (distance < near) {
        near = distance;
        dc = (enemy.c - state.c) / DIGDUG.cols;
        dr = (enemy.r - state.r) / DIGDUG.rows;
      }
    }
    return new Float32Array([
      state.c / DIGDUG.cols,
      state.r / DIGDUG.rows,
      clamp(dc, -1, 1),
      clamp(dr, -1, 1),
      near / (DIGDUG.cols + DIGDUG.rows),
      clamp(state.pumpProgress, 0, 1),
      clamp(state.lives / DIGDUG.maxLives, 0, 1),
    ]);
  },

  rules: singlePlayerRules<DigDugState>(
    (state) => state.score + state.level * 300 - (state.over ? 500 : 0),
  ),
});
