import { defineGame } from '../../game/contract.js';
import type { StepContext } from '../../core/simulation.js';
import { clamp, manhattan } from '../../core/math.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import { COLLISION_SERVICE, type CollisionService, type AABB } from '../../sim/collision.js';
import { PATHFINDING_SERVICE, type PathfindingService } from '../../sim/pathfinding.js';

export const BOMBERMAN = {
  cols: 13,
  rows: 11,
  empty: 0,
  brick: 1,
  wall: 2,
  cell: 44,
  moveSpeed: 5.2,
  bombTime: 2.5,
  blastTtl: 0.38,
  respawnTime: 1.2,
  invincibleTime: 2.2,
  brickChance: 0.55,
  pickupChance: 0.35,
  maxLives: 3,
  playerStart: { r: 9, c: 1 },
  enemySpawns: [
    { r: 1, c: 1 },
    { r: 1, c: 11 },
    { r: 9, c: 11 },
  ],
  door: { r: 8, c: 5 },
} as const;

type PickupType = 'bomb' | 'fire' | 'speed' | 'full' | 'detonator';
export interface Bomb {
  row: number;
  col: number;
  /** Segundos; -1 = bomba con detonador (no explota sola). */
  timer: number;
  range: number;
}
export interface Blast {
  row: number;
  col: number;
  ttl: number;
}
export interface BomberEnemy {
  row: number;
  col: number;
  t: number;
  moving: boolean;
  dirR: number;
  dirC: number;
  prevR: number;
  prevC: number;
  speed: number;
  type: 'balloon' | 'oneal';
  dead: boolean;
}
export interface Pickup {
  row: number;
  col: number;
  type: PickupType;
}
export interface BombermanState {
  grid: number[][];
  row: number;
  col: number;
  t: number;
  moving: boolean;
  dirR: number;
  dirC: number;
  inv: number;
  alive: boolean;
  maxBombs: number;
  range: number;
  speed: number;
  detonator: boolean;
  collected: string[];
  bombs: Bomb[];
  blasts: Blast[];
  enemies: BomberEnemy[];
  pickups: Pickup[];
  doorActive: boolean;
  damageThisLevel: boolean;
  deadTimer: number;
  score: number;
  lives: number;
  level: number;
  progress: number;
  paused: boolean;
  over: boolean;
  ticks: number;
  pattern: string | null;
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function tileAabb(row: number, col: number): AABB {
  return { x: col, y: row, w: 1, h: 1 };
}
function entityAabb(row: number, col: number): AABB {
  return { x: col + 0.2, y: row + 0.2, w: 0.6, h: 0.6 };
}

function solidPattern(r: number, c: number): boolean {
  return r % 2 === 0 && c % 2 === 0 && r > 0 && r < BOMBERMAN.rows - 1 && c > 0 && c < BOMBERMAN.cols - 1;
}
function keepOpen(r: number, c: number): boolean {
  const zone = (sr: number, sc: number): boolean => Math.abs(r - sr) <= 1 && Math.abs(c - sc) <= 1;
  return (
    BOMBERMAN.enemySpawns.some((p) => zone(p.r, p.c)) ||
    zone(BOMBERMAN.playerStart.r, BOMBERMAN.playerStart.c)
  );
}

function generateMaze(ctx: StepContext, pattern: string | null): number[][] {
  const grid: number[][] = [];
  const base = pattern === 'corridor' ? 0.32 : BOMBERMAN.brickChance;
  for (let r = 0; r < BOMBERMAN.rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < BOMBERMAN.cols; c++) {
      let cell: number = BOMBERMAN.empty;
      if (r === 0 || r === BOMBERMAN.rows - 1 || c === 0 || c === BOMBERMAN.cols - 1) {
        cell = BOMBERMAN.wall;
      } else if (solidPattern(r, c)) {
        cell = BOMBERMAN.wall;
      } else if (!keepOpen(r, c) && ctx.rng.next() < base) {
        cell = BOMBERMAN.brick;
      }
      row.push(cell);
    }
    grid.push(row);
  }
  const doorRow = grid[BOMBERMAN.door.r];
  if (doorRow !== undefined) doorRow[BOMBERMAN.door.c] = BOMBERMAN.brick;
  return grid;
}

function spawnEnemies(state: BombermanState, ctx: StepContext): void {
  const count = Math.min(2 + Math.floor((state.level - 1) / 2), 6);
  state.enemies = [];
  for (let i = 0; i < count; i++) {
    const spawn = BOMBERMAN.enemySpawns[i % BOMBERMAN.enemySpawns.length];
    const oneal = state.pattern === 'cross' ? i % 2 === 0 : state.pattern === 'rush' || i % 2 === 1;
    state.enemies.push({
      row: spawn?.r ?? 1,
      col: spawn?.c ?? 1,
      t: 0,
      moving: false,
      dirR: 0,
      dirC: 1,
      prevR: 0,
      prevC: 1,
      speed: 0.55 + ctx.rng.next() * 0.15 + (state.pattern === 'rush' ? 0.15 : 0),
      type: oneal ? 'oneal' : 'balloon',
      dead: false,
    });
  }
}

function startLevel(state: BombermanState, ctx: StepContext): void {
  state.pattern = ctx.progression.nextPattern();
  state.grid = generateMaze(ctx, state.pattern);
  state.bombs = [];
  state.blasts = [];
  state.pickups = [];
  state.doorActive = false;
  state.damageThisLevel = false;
  state.row = BOMBERMAN.playerStart.r;
  state.col = BOMBERMAN.playerStart.c;
  state.t = 0;
  state.moving = false;
  state.alive = true;
  state.inv = 1.5;
  state.deadTimer = 0;
  spawnEnemies(state, ctx);
  ctx.emit('levelStart', { level: state.level, pattern: state.pattern });
}

function resetGame(state: BombermanState, ctx: StepContext): void {
  state.level = 1;
  state.progress = 0;
  state.score = 0;
  state.lives = BOMBERMAN.maxLives;
  state.maxBombs = 1;
  state.range = 2;
  state.speed = 1;
  state.detonator = false;
  state.collected = [];
  state.over = false;
  startLevel(state, ctx);
}

function walkable(state: BombermanState, r: number, c: number): boolean {
  if (r < 0 || c < 0 || r >= BOMBERMAN.rows || c >= BOMBERMAN.cols) return false;
  if (state.grid[r]?.[c] !== BOMBERMAN.empty) return false;
  return !state.bombs.some((bomb) => bomb.row === r && bomb.col === c);
}

function hasPickup(state: BombermanState, r: number, c: number): boolean {
  return state.pickups.some((pickup) => pickup.row === r && pickup.col === c);
}

function randomPickup(ctx: StepContext): PickupType {
  const roll = ctx.rng.next();
  if (roll < 0.22) return 'bomb';
  if (roll < 0.44) return 'fire';
  if (roll < 0.62) return 'speed';
  if (roll < 0.81) return 'full';
  return 'detonator';
}

function applyPickup(state: BombermanState, type: PickupType): void {
  if (!state.collected.includes(type)) state.collected.push(type);
  if (type === 'bomb') state.maxBombs = Math.min(state.maxBombs + 1, 8);
  else if (type === 'fire') state.range = Math.min(state.range + 2, 8);
  else if (type === 'speed') state.speed = Math.min(state.speed + 0.35, 1.8);
  else if (type === 'full') state.range = 8;
  else state.detonator = true;
}

function collectPickups(state: BombermanState): void {
  const index = state.pickups.findIndex((p) => p.row === state.row && p.col === state.col);
  if (index < 0) return;
  const pickup = state.pickups[index];
  if (pickup !== undefined) applyPickup(state, pickup.type);
  state.pickups.splice(index, 1);
  state.score += 100;
}

function explode(state: BombermanState, bomb: Bomb, ctx: StepContext, collision: CollisionService): void {
  const cells: Array<readonly [number, number]> = [[bomb.row, bomb.col]];
  for (const [dr, dc] of DIRS) {
    for (let i = 1; i <= bomb.range; i++) {
      const r = bomb.row + (dr ?? 0) * i;
      const c = bomb.col + (dc ?? 0) * i;
      if (r < 0 || c < 0 || r >= BOMBERMAN.rows || c >= BOMBERMAN.cols) break;
      const cell = state.grid[r]?.[c];
      if (cell === BOMBERMAN.wall || cell === undefined) break;
      cells.push([r, c]);
      if (cell === BOMBERMAN.brick) break;
    }
  }
  for (const [r, c] of cells) {
    state.blasts.push({ row: r ?? 0, col: c ?? 0, ttl: BOMBERMAN.blastTtl });
  }
  ctx.emit('explode', { r: bomb.row, c: bomb.col, cells: cells.length });

  for (const other of state.bombs) {
    if (other !== bomb && cells.some(([r, c]) => r === other.row && c === other.col)) {
      other.timer = Math.min(other.timer, 0);
    }
  }

  let drops = 0;
  for (const [r, c] of cells) {
    const row = state.grid[r ?? 0];
    if (row?.[c ?? 0] !== BOMBERMAN.brick) continue;
    row[c ?? 0] = BOMBERMAN.empty;
    const naturalDoor = r === BOMBERMAN.door.r && c === BOMBERMAN.door.c;
    if (!naturalDoor && ctx.rng.next() < BOMBERMAN.pickupChance && drops < 3 && !hasPickup(state, r ?? 0, c ?? 0)) {
      state.pickups.push({ row: r ?? 0, col: c ?? 0, type: randomPickup(ctx) });
      drops++;
    }
    ctx.emit('brick', { r, c });
  }

  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    if (cells.some(([r, c]) => r === enemy.row && c === enemy.col)) {
      enemy.dead = true;
      state.score += 100 + state.level * 10;
      ctx.emit('enemyHit', { type: enemy.type });
      ctx.progression.observe(0.5);
    }
  }

  if (
    state.alive &&
    state.inv <= 0 &&
    cells.some(([r, c]) =>
      collision.aabbOverlap(entityAabb(state.row, state.col), tileAabb(r ?? 0, c ?? 0)),
    )
  ) {
    killPlayer(state, ctx);
  }
}

function killPlayer(state: BombermanState, ctx: StepContext): void {
  if (!state.alive || state.inv > 0) return;
  state.alive = false;
  state.damageThisLevel = true;
  state.deadTimer = BOMBERMAN.respawnTime;
  state.lives--;
  ctx.emit('hit', { r: state.row, c: state.col });
  ctx.progression.observe(-0.8);
  if (state.lives <= 0) {
    state.over = true;
    ctx.emit('gameOver', { score: state.score });
  }
}

function respawn(state: BombermanState): void {
  state.row = BOMBERMAN.playerStart.r;
  state.col = BOMBERMAN.playerStart.c;
  state.t = 0;
  state.moving = false;
  state.alive = true;
  state.inv = BOMBERMAN.invincibleTime;
}

function checkDoor(state: BombermanState, ctx: StepContext): void {
  if (!state.doorActive) return;
  if (state.row === BOMBERMAN.door.r && state.col === BOMBERMAN.door.c) {
    state.level++;
    state.progress = state.level;
    state.score += state.level * 500;
    ctx.emit('levelUp', { level: state.level });
    ctx.progression.observe(0.8);
    startLevel(state, ctx);
  }
}

export const bombermanGame = defineGame<BombermanState>({
  id: 'bomberman',
  meta: { title: 'Bomberman', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['up', 'down', 'left', 'right', 'bomb', 'pause', 'restart'],
  progression: {
    id: 'bomberman',
    levels: [
      { speed: 1, spawnInterval: 9, hazard: 0, label: 'Oleada 1' },
      { speed: 1.1, spawnInterval: 8, hazard: 0.2, label: 'Oleada 2' },
      { speed: 1.2, spawnInterval: 7, hazard: 0.4, label: 'Oleada 3' },
    ],
    pointsPerLevel: 1,
    dda: { enabled: true, window: 300, maxAdjust: 0.08 },
    patterns: ['cross', 'corridor', 'rush'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    const state: BombermanState = {
      grid: [],
      row: BOMBERMAN.playerStart.r,
      col: BOMBERMAN.playerStart.c,
      t: 0,
      moving: false,
      dirR: 0,
      dirC: 0,
      inv: 0,
      alive: true,
      maxBombs: 1,
      range: 2,
      speed: 1,
      detonator: false,
      collected: [],
      bombs: [],
      blasts: [],
      enemies: [],
      pickups: [],
      doorActive: false,
      damageThisLevel: false,
      deadTimer: 0,
      score: 0,
      lives: BOMBERMAN.maxLives,
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
    const collision = ctx.services.get<CollisionService>(COLLISION_SERVICE);
    const pathfinding = ctx.services.get<PathfindingService>(PATHFINDING_SERVICE);

    let dirR = 0;
    let dirC = 0;
    if (ctx.actions.isDown('up')) dirR = -1;
    else if (ctx.actions.isDown('down')) dirR = 1;
    else if (ctx.actions.isDown('left')) dirC = -1;
    else if (ctx.actions.isDown('right')) dirC = 1;

    if (!state.alive) {
      state.deadTimer -= dt;
      if (state.deadTimer <= 0) respawn(state);
    } else {
      if (state.inv > 0) state.inv -= dt;
      if (state.moving) {
        if (dirR !== 0 || dirC !== 0) {
          if ((dirR !== state.dirR || dirC !== state.dirC) && state.t < 0.5) {
            state.moving = false;
            state.t = 0;
          }
        }
        if (state.moving) {
          state.t += BOMBERMAN.moveSpeed * state.speed * dt;
          if (state.t >= 1) {
            state.col += state.dirC;
            state.row += state.dirR;
            state.t = 0;
            state.moving = false;
            collectPickups(state);
            checkDoor(state, ctx);
          }
        }
      }
      if (!state.moving && (dirR !== 0 || dirC !== 0)) {
        if (walkable(state, state.row + dirR, state.col + dirC)) {
          state.dirR = dirR;
          state.dirC = dirC;
          state.moving = true;
          state.t = 0;
        }
      }
    }

    if (ctx.actions.consume('bomb') && state.alive) {
      if (state.bombs.length >= state.maxBombs) {
        if (state.detonator) for (const bomb of state.bombs) bomb.timer = 0;
      } else if (walkable(state, state.row, state.col)) {
        state.bombs.push({
          row: state.row,
          col: state.col,
          timer: state.detonator ? -1 : BOMBERMAN.bombTime,
          range: state.range,
        });
        ctx.emit('bomb', { r: state.row, c: state.col });
      }
    }

    for (const bomb of [...state.bombs]) {
      if (bomb.timer >= 0) bomb.timer -= dt;
      if (bomb.timer <= 0) {
        state.bombs = state.bombs.filter((other) => other !== bomb);
        explode(state, bomb, ctx, collision);
      }
    }
    for (const blast of state.blasts) blast.ttl -= dt;
    state.blasts = state.blasts.filter((blast) => blast.ttl > 0);

    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      if (enemy.moving) {
        enemy.t += enemy.speed * BOMBERMAN.moveSpeed * dt;
        if (enemy.t >= 1) {
          enemy.col += enemy.dirC;
          enemy.row += enemy.dirR;
          enemy.t = 0;
          enemy.moving = false;
          enemy.prevR = enemy.dirR;
          enemy.prevC = enemy.dirC;
          if (enemy.row === state.row && enemy.col === state.col) killPlayer(state, ctx);
        }
      } else {
        const options = DIRS.filter(
          ([dr, dc]) =>
            !(dr === -enemy.prevR && dc === -enemy.prevC) &&
            walkable(state, enemy.row + (dr ?? 0), enemy.col + (dc ?? 0)),
        );
        const fallback = DIRS.find(([dr, dc]) => walkable(state, enemy.row + (dr ?? 0), enemy.col + (dc ?? 0)));
        if (options.length === 0 && fallback !== undefined) {
          enemy.dirR = fallback[0] ?? 0;
          enemy.dirC = fallback[1] ?? 0;
          enemy.moving = true;
          enemy.t = 0;
          continue;
        }
        let chosen = options[0];
        if (enemy.type === 'oneal') {
          const step = pathfinding.greedyStep(
            state.grid,
            { col: enemy.col, row: enemy.row },
            { col: state.col, row: state.row },
            (cell) => cell === BOMBERMAN.empty,
          );
          const preferred = options.find(
            ([dr, dc]) => step !== null && step.col === enemy.col + (dc ?? 0) && step.row === enemy.row + (dr ?? 0),
          );
          if (preferred !== undefined) chosen = preferred;
          else {
            options.sort((a, b) =>
              manhattan(state.row, state.col, enemy.row + (a[0] ?? 0), enemy.col + (a[1] ?? 0)) -
              manhattan(state.row, state.col, enemy.row + (b[0] ?? 0), enemy.col + (b[1] ?? 0)),
            );
            chosen = options[0];
          }
        } else {
          chosen = options[ctx.rng.int(options.length)] ?? options[0];
        }
        if (chosen !== undefined) {
          enemy.dirR = chosen[0] ?? 0;
          enemy.dirC = chosen[1] ?? 0;
          enemy.moving = true;
          enemy.t = 0;
        }
      }
    }

    if (!state.doorActive && state.enemies.every((enemy) => enemy.dead)) {
      state.doorActive = true;
      const doorRow = state.grid[BOMBERMAN.door.r];
      if (doorRow !== undefined) doorRow[BOMBERMAN.door.c] = BOMBERMAN.empty;
      ctx.emit('doorOpen', {});
    }
    checkDoor(state, ctx);
    state.ticks++;
  },

  observe(state) {
    let nearest = 99;
    let dr = 0;
    let dc = 0;
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const distance = manhattan(state.row, state.col, enemy.row, enemy.col);
      if (distance < nearest) {
        nearest = distance;
        dr = (enemy.row - state.row) / BOMBERMAN.rows;
        dc = (enemy.col - state.col) / BOMBERMAN.cols;
      }
    }
    const danger = state.blasts.some((blast) => manhattan(blast.row, blast.col, state.row, state.col) <= 2);
    return new Float32Array([
      state.row / BOMBERMAN.rows,
      state.col / BOMBERMAN.cols,
      dr,
      dc,
      nearest / (BOMBERMAN.rows + BOMBERMAN.cols),
      danger ? 1 : 0,
      state.doorActive ? 1 : 0,
      clamp(state.lives / BOMBERMAN.maxLives, 0, 1),
    ]);
  },

  rules: singlePlayerRules<BombermanState>(
    (state) => state.score + state.level * 200 - (state.over ? 500 : 0),
  ),
});
