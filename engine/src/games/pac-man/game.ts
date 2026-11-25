import { defineGame } from '../../game/contract.js';
import type { StepContext } from '../../core/simulation.js';
import { clamp, manhattan } from '../../core/math.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import { COLLISION_SERVICE, type CollisionService, type AABB } from '../../sim/collision.js';
import { PATHFINDING_SERVICE, type PathfindingService } from '../../sim/pathfinding.js';

export const PACMAN = {
  cols: 28,
  rows: 31,
  cs: 18,
  pacSpeed: 120,
  ghostSpeed: 80,
  ghostFrightSpeed: 50,
  ghostHomeSpeed: 120,
  elroy1Speed: 84,
  elroy2Speed: 88,
  frightTime: 6,
  deathTime: 1.4,
  maxLives: 3,
  scoreDot: 10,
  scorePellet: 50,
  scoreGhost: [200, 400, 800, 1600],
  dotRelease: [0, 0, 30, 60],
  elroy1Dots: 20,
  elroy2Dots: 10,
  modeSchedule: [7, 20, 7, 20, 5, 5, 5],
  fruitDots: [70, 170],
  fruitTime: 9,
  fruitPoints: [100, 300, 500, 700, 1000],
  fruitPos: { col: 13.5, row: 19.5 },
  extraLives: [10000, 20000],
} as const;

const MAZE_DATA: readonly string[] = [
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'W............WW............W',
  'WoWWW.WWWW..WW..WWWW.WWWWoWW',
  'W.WWW.WWWW..WW..WWWW.WWW.WWW',
  'W..........................W',
  'W.WWW.WW.WWWWWWWW.WW.WWW.WWW',
  'W.WWW.WW.WWWWWWWW.WW.WWW.WWW',
  'W....WW...WWWWWWWW...WW....W',
  'WWWW.WWWW.WWWWWWWW.WWWW.WWWW',
  'WWWW.WWWW.WWWWWWWW.WWWW.WWWW',
  'WWWW....WW......WW....WWWWWW',
  'WWWW.WW.WWWW  WWWW.WW.WWWWWW',
  'WWWW.WW.WWWW  WWWW.WW.WWWWWW',
  'WWWW....WWW    WWW....WWWWWW',
  'WWWW.WW.WWWWGGWWWW.WW.WWWWWW',
  'WWWW.WW.WWWWGGWWWW.WW.WWWWWW',
  'WWWW....WWWGGGGWWW....WWWWWW',
  'WWWW.WW.WWWWWWWWWW.WW.WWWWWW',
  'WWWW.WW.WWWWWWWWWW.WW.WWWWWW',
  'WWWW....WW......WW....WWWWWW',
  'WWWW.WWWWWWW..WWWWWWW.WWWWWW',
  'WWWW.WWWWWWW..WWWWWWW.WWWWWW',
  'W............WW............W',
  'WoWWW.WWWW..WW..WWWW.WWWWoWW',
  'W.WWW.WWWW..WW..WWWW.WWW.WWW',
  'W...WW....WWWWWW....WW...WWW',
  'WWW.WW.WW.WWWWWW.WW.WW.WWWWW',
  'WWW.WW.WW.WWWWWW.WW.WW.WWWWW',
  'W....WW...WWWWWW...WW....WWW',
  'W...WW....WWWWWW...WW....WWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
];

export interface Vec {
  dx: number;
  dy: number;
}
const NONE: Vec = { dx: 0, dy: 0 };
const UP: Vec = { dx: 0, dy: -1 };
const DOWN: Vec = { dx: 0, dy: 1 };
const LEFT: Vec = { dx: -1, dy: 0 };
const RIGHT: Vec = { dx: 1, dy: 0 };
const DIRS: readonly Vec[] = [UP, DOWN, LEFT, RIGHT];
const NAMES = ['blinky', 'pinky', 'inky', 'clyde'] as const;
type GhostName = (typeof NAMES)[number];
type GhostMode = 'home' | 'chase' | 'scatter' | 'fright' | 'eyes';

export interface Ghost {
  name: GhostName;
  x: number;
  y: number;
  dx: number;
  dy: number;
  mode: GhostMode;
  releaseTime: number;
  timer: number;
  scatterX: number;
  scatterY: number;
}
export interface PacmanState {
  maze: string[][];
  x: number;
  y: number;
  px: number;
  py: number;
  dir: Vec;
  nextDir: Vec;
  ghosts: Ghost[];
  score: number;
  lives: number;
  level: number;
  progress: number;
  dotsLeft: number;
  dotsEaten: number;
  ghostCombo: number;
  ghostPause: number;
  frightened: number;
  phaseIdx: number;
  modeTimer: number;
  fruitsSpawned: number;
  fruit: { idx: number; timer: number } | null;
  dying: number;
  nextExtraLife: number;
  paused: boolean;
  over: boolean;
  ticks: number;
  pattern: string | null;
}

function cell(state: PacmanState, col: number, row: number): string {
  return state.maze[row]?.[col] ?? 'W';
}
function walkable(state: PacmanState, col: number, row: number): boolean {
  if (row < 0 || row >= PACMAN.rows || col < 0 || col >= PACMAN.cols) return false;
  const ch = cell(state, col, row);
  return ch !== 'W' && ch !== 'G';
}
function ghostWalkable(state: PacmanState, col: number, row: number): boolean {
  if (row < 0 || row >= PACMAN.rows || col < 0 || col >= PACMAN.cols) return false;
  return cell(state, col, row) !== 'W';
}
function phaseName(index: number): GhostMode {
  return index % 2 === 0 ? 'scatter' : 'chase';
}
function resetModeSchedule(state: PacmanState): void {
  state.phaseIdx = state.pattern === 'chase' ? 1 : 0;
  state.modeTimer = PACMAN.modeSchedule[state.phaseIdx] ?? 7;
}

function resetPac(state: PacmanState): void {
  state.x = 14 * PACMAN.cs + PACMAN.cs / 2;
  state.y = 23 * PACMAN.cs + PACMAN.cs / 2;
  state.px = state.x;
  state.py = state.y;
  state.dir = NONE;
  state.nextDir = NONE;
}

function resetGhosts(state: PacmanState): void {
  const homes: ReadonlyArray<readonly [number, number, number]> = [
    [14, 11, 0],
    [14, 14, 2],
    [12, 14, 4],
    [16, 14, 6],
  ];
  const scatter: ReadonlyArray<readonly [number, number]> = [
    [25, 0],
    [2, 0],
    [27, 30],
    [0, 30],
  ];
  state.ghosts = NAMES.map((name, index) => ({
    name,
    x: (homes[index]?.[0] ?? 14) * PACMAN.cs + PACMAN.cs / 2,
    y: (homes[index]?.[1] ?? 14) * PACMAN.cs + PACMAN.cs / 2,
    dx: 0,
    dy: 0,
    mode: index === 0 ? phaseName(state.phaseIdx) : 'home',
    releaseTime: homes[index]?.[2] ?? 0,
    timer: 0,
    scatterX: (scatter[index]?.[0] ?? 0) * PACMAN.cs,
    scatterY: (scatter[index]?.[1] ?? 0) * PACMAN.cs,
  }));
}

function startLevel(state: PacmanState, ctx: StepContext): void {
  state.pattern = ctx.progression.nextPattern();
  state.maze = MAZE_DATA.map((row) => [...row]);
  state.dotsLeft = state.maze.reduce(
    (sum, row) => sum + row.filter((ch) => ch === '.' || ch === 'o').length,
    0,
  );
  state.dotsEaten = 0;
  state.ghostCombo = 0;
  state.ghostPause = 0;
  state.frightened = 0;
  state.fruitsSpawned = 0;
  state.fruit = null;
  state.dying = 0;
  resetModeSchedule(state);
  resetPac(state);
  resetGhosts(state);
  ctx.emit('levelStart', { level: state.level, pattern: state.pattern });
}

function resetGame(state: PacmanState, ctx: StepContext): void {
  state.score = 0;
  state.lives = PACMAN.maxLives;
  state.level = 1;
  state.progress = 0;
  state.nextExtraLife = PACMAN.extraLives[0] ?? 10000;
  state.over = false;
  startLevel(state, ctx);
}

function checkExtraLife(state: PacmanState, ctx: StepContext): void {
  if (state.score >= PACMAN.extraLives[1] && state.nextExtraLife <= PACMAN.extraLives[0]) {
    state.nextExtraLife = PACMAN.extraLives[1] ?? 20000;
    state.lives++;
    ctx.emit('extraLife', {});
  } else if (state.score >= (PACMAN.extraLives[0] ?? 10000) && state.nextExtraLife === PACMAN.extraLives[0]) {
    state.nextExtraLife = PACMAN.extraLives[1] ?? 20000;
    state.lives++;
    ctx.emit('extraLife', {});
  }
}

function setPacDir(state: PacmanState, direction: Vec): void {
  const col = Math.round((state.x - PACMAN.cs / 2) / PACMAN.cs);
  const row = Math.round((state.y - PACMAN.cs / 2) / PACMAN.cs);
  if (walkable(state, col + direction.dx, row + direction.dy)) state.dir = direction;
  else state.nextDir = direction;
}

function updatePac(state: PacmanState, dt: number, ctx: StepContext): void {
  state.px = state.x;
  state.py = state.y;
  let moved = false;
  for (const direction of [state.nextDir, state.dir]) {
    if (direction === NONE) continue;
    const nx = state.x + direction.dx * PACMAN.pacSpeed * dt;
    const ny = state.y + direction.dy * PACMAN.pacSpeed * dt;
    const col = Math.round((nx - PACMAN.cs / 2) / PACMAN.cs);
    const row = Math.round((ny - PACMAN.cs / 2) / PACMAN.cs);
    const cx = col * PACMAN.cs + PACMAN.cs / 2;
    const cy = row * PACMAN.cs + PACMAN.cs / 2;
    if (Math.hypot(nx - cx, ny - cy) < PACMAN.pacSpeed * dt * 1.2 && walkable(state, col, row)) {
      state.x = nx;
      state.y = ny;
      state.dir = direction;
      moved = true;
      break;
    }
  }
  if (!moved && state.dir !== NONE) {
    const nx = state.x + state.dir.dx * PACMAN.pacSpeed * dt;
    const ny = state.y + state.dir.dy * PACMAN.pacSpeed * dt;
    const col = Math.round((nx - PACMAN.cs / 2) / PACMAN.cs);
    const row = Math.round((ny - PACMAN.cs / 2) / PACMAN.cs);
    const cx = col * PACMAN.cs + PACMAN.cs / 2;
    const cy = row * PACMAN.cs + PACMAN.cs / 2;
    if (Math.hypot(nx - cx, ny - cy) < PACMAN.pacSpeed * dt * 1.5) {
      if (walkable(state, col, row)) {
        state.x = nx;
        state.y = ny;
      } else {
        state.x = state.px;
        state.y = state.py;
      }
    } else {
      state.x = nx;
      state.y = ny;
    }
  }

  // Tunnel wrapping (original behavior)
  if (state.x < -PACMAN.cs / 2) state.x = PACMAN.cols * PACMAN.cs + PACMAN.cs / 2;
  if (state.x > PACMAN.cols * PACMAN.cs + PACMAN.cs / 2) state.x = -PACMAN.cs / 2;
  state.y = clamp(state.y, PACMAN.cs / 2, PACMAN.rows * PACMAN.cs - PACMAN.cs / 2);

  const col = Math.round((state.x - PACMAN.cs / 2) / PACMAN.cs);
  const row = Math.round((state.y - PACMAN.cs / 2) / PACMAN.cs);
  const ch = cell(state, col, row);
  if (ch === '.' || ch === 'o') {
    const line = state.maze[row];
    if (line !== undefined) line[col] = ' ';
    state.dotsLeft--;
    state.dotsEaten++;
    state.score += ch === 'o' ? PACMAN.scorePellet : PACMAN.scoreDot;
    ctx.emit(ch === 'o' ? 'pellet' : 'dot', { row, col });
    ctx.progression.observe(0.1);
    if (ch === 'o') {
      state.frightened = PACMAN.frightTime;
      state.ghostCombo = 0;
      for (const ghost of state.ghosts) {
        if (ghost.mode !== 'home') {
          ghost.dx *= -1;
          ghost.dy *= -1;
          ghost.mode = 'fright';
        }
      }
      ctx.emit('fright', {});
    }
    checkExtraLife(state, ctx);
  }
}

function releaseGhosts(state: PacmanState, dt: number): void {
  for (let i = 0; i < state.ghosts.length; i++) {
    const ghost = state.ghosts[i];
    if (ghost === undefined || ghost.mode !== 'home') continue;
    const threshold = PACMAN.dotRelease[i] ?? 0;
    if (state.dotsEaten >= threshold || ghost.timer >= ghost.releaseTime) {
      ghost.mode = phaseName(state.phaseIdx);
      ghost.x = 14 * PACMAN.cs + PACMAN.cs / 2;
      ghost.y = 11 * PACMAN.cs + PACMAN.cs / 2;
      ghost.dx = -1;
      ghost.dy = 0;
    } else {
      ghost.timer += dt;
    }
  }
}

function ghostTarget(state: PacmanState, ghost: Ghost): readonly [number, number] {
  if (ghost.mode === 'eyes') return [14 * PACMAN.cs, 14 * PACMAN.cs];
  if (ghost.mode === 'scatter') return [ghost.scatterX, ghost.scatterY];
  if (ghost.name === 'blinky') return [state.x, state.y];
  if (ghost.name === 'pinky') {
    const extra = state.pattern === 'ambush' ? 5 : 4;
    let tx = state.x + state.dir.dx * PACMAN.cs * extra;
    const ty = state.y + state.dir.dy * PACMAN.cs * extra;
    if (state.dir.dy === -1) tx -= PACMAN.cs * 4; // overflow bug del original
    return [tx, ty];
  }
  if (ghost.name === 'inky') {
    const blinky = state.ghosts[0];
    const aheadX = state.x + state.dir.dx * PACMAN.cs * 2;
    const aheadY = state.y + state.dir.dy * PACMAN.cs * 2;
    return [aheadX + (aheadX - (blinky?.x ?? 0)), aheadY + (aheadY - (blinky?.y ?? 0))];
  }
  const dist = Math.hypot(state.x - ghost.x, state.y - ghost.y);
  return dist > PACMAN.cs * 8 ? [state.x, state.y] : [ghost.scatterX, ghost.scatterY];
}

function updateGhosts(
  state: PacmanState,
  dt: number,
  ctx: StepContext,
  pathfinding: PathfindingService,
): void {
  if (state.frightened > 0) {
    state.frightened -= dt;
    if (state.frightened <= 0) {
      state.frightened = 0;
      for (const ghost of state.ghosts) {
        if (ghost.mode === 'fright') ghost.mode = phaseName(state.phaseIdx);
      }
    }
  }

  for (const ghost of state.ghosts) {
    if (ghost.mode === 'home') continue;
    let speed: number;
    if (ghost.mode === 'fright') speed = PACMAN.ghostFrightSpeed;
    else if (ghost.mode === 'eyes') speed = PACMAN.ghostHomeSpeed;
    else if (ghost.name === 'blinky') {
      if (state.dotsLeft < PACMAN.elroy2Dots) speed = PACMAN.elroy2Speed;
      else if (state.dotsLeft < PACMAN.elroy1Dots) speed = PACMAN.elroy1Speed;
      else speed = PACMAN.ghostSpeed;
      if (state.dotsLeft < PACMAN.elroy1Dots && ghost.mode === 'scatter') ghost.mode = 'chase';
    } else speed = PACMAN.ghostSpeed;

    ghost.x += ghost.dx * speed * dt;
    ghost.y += ghost.dy * speed * dt;

    const col = Math.round((ghost.x - PACMAN.cs / 2) / PACMAN.cs);
    const row = Math.round((ghost.y - PACMAN.cs / 2) / PACMAN.cs);
    const cx = col * PACMAN.cs + PACMAN.cs / 2;
    const cy = row * PACMAN.cs + PACMAN.cs / 2;
    if (Math.hypot(ghost.x - cx, ghost.y - cy) < speed * dt * 1.5 && ghostWalkable(state, col, row)) {
      ghost.x = cx;
      ghost.y = cy;
      if (cell(state, col, row) === 'G' && ghost.mode !== 'eyes') continue;

      let best: Vec | null = null;
      let bestDistance = Infinity;
      let eyeStep: { col: number; row: number } | null = null;
      if (ghost.mode === 'eyes') {
        eyeStep = pathfinding.greedyStep(
          state.maze.map((line) => [...line]),
          { col, row },
          { col: 14, row: 14 },
          (ch) => ch !== 'W',
        );
      }
      for (const direction of DIRS) {
        if (
          direction.dx === -ghost.dx &&
          direction.dy === -ghost.dy &&
          ghost.mode !== 'fright'
        ) {
          continue;
        }
        if (!ghostWalkable(state, col + direction.dx, row + direction.dy)) continue;
        if (ghost.mode === 'fright') {
          if (ctx.rng.next() < 0.25) {
            best = direction;
            break;
          }
          if (best === null) best = direction;
          continue;
        }
        let targetX: number;
        let targetY: number;
        if (eyeStep !== null) {
          targetX = eyeStep.col * PACMAN.cs + PACMAN.cs / 2;
          targetY = eyeStep.row * PACMAN.cs + PACMAN.cs / 2;
        } else {
          const target = ghostTarget(state, ghost);
          targetX = target[0] ?? 0;
          targetY = target[1] ?? 0;
        }
        const distance = Math.hypot(cx + direction.dx * PACMAN.cs - targetX, cy + direction.dy * PACMAN.cs - targetY);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = direction;
        }
      }
      if (best !== null) {
        ghost.dx = best.dx;
        ghost.dy = best.dy;
      }
    }

    if (ghost.x < -PACMAN.cs / 2) ghost.x = PACMAN.cols * PACMAN.cs + PACMAN.cs / 2;
    if (ghost.x > PACMAN.cols * PACMAN.cs + PACMAN.cs / 2) ghost.x = -PACMAN.cs / 2;

    if (ghost.mode === 'eyes') {
      const distHome = Math.hypot(ghost.x - 14 * PACMAN.cs, ghost.y - 14 * PACMAN.cs);
      if (distHome < PACMAN.cs * 0.5) {
        ghost.mode = phaseName(state.phaseIdx);
        ghost.x = 14 * PACMAN.cs + PACMAN.cs / 2;
        ghost.y = 11 * PACMAN.cs + PACMAN.cs / 2;
        ghost.dx = -1;
        ghost.dy = 0;
      }
    }
  }
}

function updateModeSchedule(state: PacmanState, dt: number): void {
  if (state.frightened > 0) return;
  if (state.phaseIdx >= PACMAN.modeSchedule.length) return;
  state.modeTimer -= dt;
  while (state.modeTimer <= 0 && state.phaseIdx < PACMAN.modeSchedule.length - 1) {
    state.phaseIdx++;
    state.modeTimer += PACMAN.modeSchedule[state.phaseIdx] ?? 5;
    const mode = phaseName(state.phaseIdx);
    for (const ghost of state.ghosts) {
      if (ghost.mode === 'chase' || ghost.mode === 'scatter') {
        ghost.mode = mode;
        ghost.dx *= -1;
        ghost.dy *= -1;
      }
    }
  }
}

function updateFruit(state: PacmanState, dt: number, ctx: StepContext): void {
  if (state.fruit !== null) {
    state.fruit.timer -= dt;
    if (state.fruit.timer <= 0) {
      state.fruit = null;
      return;
    }
    const fx = PACMAN.fruitPos.col * PACMAN.cs;
    const fy = PACMAN.fruitPos.row * PACMAN.cs;
    if (Math.hypot(state.x - fx, state.y - fy) < PACMAN.cs * 0.7) {
      const points = PACMAN.fruitPoints[state.fruit.idx] ?? 100;
      state.score += points;
      ctx.emit('fruit', { points });
      ctx.progression.observe(0.6);
      state.fruit = null;
      checkExtraLife(state, ctx);
    }
  } else if (
    state.fruitsSpawned < PACMAN.fruitDots.length &&
    state.dotsEaten >= (PACMAN.fruitDots[state.fruitsSpawned] ?? 0)
  ) {
    state.fruit = { idx: state.fruitsSpawned, timer: PACMAN.fruitTime };
    state.fruitsSpawned++;
    ctx.emit('fruitSpawn', { idx: state.fruit.idx });
  }
}

function loseLife(state: PacmanState, ctx: StepContext): void {
  if (state.dying > 0) return;
  state.lives--;
  state.dying = PACMAN.deathTime;
  ctx.emit('hit', { x: state.x, y: state.y });
  ctx.progression.observe(-0.9);
}

function finishDeath(state: PacmanState): void {
  state.dying = 0;
  if (state.lives <= 0) {
    state.over = true;
    return;
  }
  resetPac(state);
  resetGhosts(state);
  state.frightened = 0;
  state.ghostPause = 0;
  state.ghostCombo = 0;
  resetModeSchedule(state);
}

export const pacmanGame = defineGame<PacmanState>({
  id: 'pac-man',
  meta: { title: 'Pac-Man', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['up', 'down', 'left', 'right', 'pause', 'restart'],
  progression: {
    id: 'pac-man',
    levels: [
      { speed: 1, spawnInterval: 6, hazard: 0, label: 'Laberinto 1' },
      { speed: 1.08, spawnInterval: 5, hazard: 0.1, label: 'Laberinto 2' },
      { speed: 1.16, spawnInterval: 5, hazard: 0.2, label: 'Laberinto 3' },
      { speed: 1.25, spawnInterval: 4, hazard: 0.3, label: 'Laberinto 4' },
    ],
    pointsPerLevel: 1,
    dda: { enabled: true, window: 400, maxAdjust: 0.08 },
    patterns: ['chase', 'scatter', 'ambush'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    const state: PacmanState = {
      maze: [],
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      dir: NONE,
      nextDir: NONE,
      ghosts: [],
      score: 0,
      lives: PACMAN.maxLives,
      level: 1,
      progress: 0,
      dotsLeft: 0,
      dotsEaten: 0,
      ghostCombo: 0,
      ghostPause: 0,
      frightened: 0,
      phaseIdx: 0,
      modeTimer: 0,
      fruitsSpawned: 0,
      fruit: null,
      dying: 0,
      nextExtraLife: PACMAN.extraLives[0] ?? 10000,
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

    if (state.dying > 0) {
      state.dying -= dt;
      if (state.dying <= 0) finishDeath(state);
      state.ticks++;
      return;
    }

    if (ctx.actions.isDown('up')) setPacDir(state, UP);
    else if (ctx.actions.isDown('down')) setPacDir(state, DOWN);
    else if (ctx.actions.isDown('left')) setPacDir(state, LEFT);
    else if (ctx.actions.isDown('right')) setPacDir(state, RIGHT);

    if (state.ghostPause > 0) {
      state.ghostPause -= dt;
    } else {
      releaseGhosts(state, dt);
      updatePac(state, dt, ctx);
      updateGhosts(state, dt, ctx, pathfinding);
      updateModeSchedule(state, dt);
      updateFruit(state, dt, ctx);

      const pacBox: AABB = { x: state.x - PACMAN.cs * 0.4, y: state.y - PACMAN.cs * 0.4, w: PACMAN.cs * 0.8, h: PACMAN.cs * 0.8 };
      for (const ghost of state.ghosts) {
        if (ghost.mode === 'home' || ghost.mode === 'eyes') continue;
        const ghostBox: AABB = {
          x: ghost.x - PACMAN.cs * 0.4,
          y: ghost.y - PACMAN.cs * 0.4,
          w: PACMAN.cs * 0.8,
          h: PACMAN.cs * 0.8,
        };
        if (!collision.aabbOverlap(pacBox, ghostBox)) continue;
        if (ghost.mode === 'fright') {
          ghost.mode = 'eyes';
          const points = PACMAN.scoreGhost[Math.min(state.ghostCombo, PACMAN.scoreGhost.length - 1)] ?? 200;
          state.score += points;
          state.ghostCombo++;
          state.ghostPause = 1;
          ctx.emit('ghostEat', { name: ghost.name, points });
          ctx.progression.observe(0.7);
          checkExtraLife(state, ctx);
        } else {
          loseLife(state, ctx);
          break;
        }
      }
    }

    if (state.dotsLeft <= 0 && !state.over) {
      state.level++;
      state.progress = state.level;
      state.score += 500;
      ctx.emit('levelUp', { level: state.level });
      ctx.progression.observe(1);
      startLevel(state, ctx);
    }
    if (state.lives <= 0 && state.dying <= 0) state.over = true;
    state.ticks++;
  },

  observe(state) {
    let nearest = 99;
    let dx = 0;
    let dy = 0;
    for (const ghost of state.ghosts) {
      const distance = manhattan(state.x / PACMAN.cs, state.y / PACMAN.cs, ghost.x / PACMAN.cs, ghost.y / PACMAN.cs);
      if (distance < nearest) {
        nearest = distance;
        dx = (ghost.x - state.x) / (PACMAN.cols * PACMAN.cs);
        dy = (ghost.y - state.y) / (PACMAN.rows * PACMAN.cs);
      }
    }
    return new Float32Array([
      state.x / (PACMAN.cols * PACMAN.cs),
      state.y / (PACMAN.rows * PACMAN.cs),
      dx,
      dy,
      nearest / (PACMAN.cols + PACMAN.rows),
      state.frightened > 0 ? 1 : 0,
      state.dotsLeft / 244,
      clamp(state.lives / PACMAN.maxLives, 0, 1),
    ]);
  },

  rules: singlePlayerRules<PacmanState>(
    (state) => state.score + state.level * 300 - (state.over ? 400 : 0),
  ),
});
