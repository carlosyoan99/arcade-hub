import { defineGame } from '../../game/contract.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import { approach, clamp, manhattan } from '../../core/math.js';
import { COLLISION_SERVICE, type CollisionService } from '../../sim/collision.js';
import { PATHFINDING_SERVICE, type PathfindingService } from '../../sim/pathfinding.js';
import type { StepContext } from '../../core/simulation.js';

/**
 * Paperboy completo: 3 carriles, buzones suscriptos/no suscriptos, lanzamiento
 * con cooldown, obstáculos (coche/camión/valla/perro), penalización por fallo,
 * días crecientes y patrones de calle. El servicio de pathfinding calcula un
 * carril seguro ahead para la observación de la IA.
 */
export const PAPERBOY = {
  width: 480,
  height: 320,
  roadTop: 160,
  laneHeight: 40,
  playerX: 80,
  scrollSpeed: 70,
  daySeconds: 45,
  houseSpacing: 90,
  paperSpeed: 200,
  throwCooldown: 0.3,
  laneColumns: 8,
  columnWidth: 60,
  rewardDelivered: 30,
  penaltyMissed: 20,
} as const;

export interface PaperboyHouse {
  x: number;
  lane: number;
  subscribed: boolean;
  delivered: boolean;
}

export interface PaperboyObstacle {
  x: number;
  lane: number;
  type: 'car' | 'fence' | 'dog' | 'truck';
  w: number;
  speed: number;
}

export interface PaperboyPaper {
  x: number;
  y: number;
  lane: number;
}

export interface PaperboyState {
  paused: boolean;
  over: boolean;
  generation: number;
  winner: number | null;
  playerLane: number;
  playerY: number;
  safeLane: number;
  papers: PaperboyPaper[];
  houses: PaperboyHouse[];
  obstacles: PaperboyObstacle[];
  scrollX: number;
  throwTimer: number;
  day: number;
  time: number;
  score: number;
  delivered: number;
  missed: number;
  thrown: number;
  dayPattern: string;
  ticks: number;
}

function laneY(lane: number): number {
  return PAPERBOY.roadTop + lane * PAPERBOY.laneHeight + PAPERBOY.laneHeight / 2;
}

function resetPaperboy(state: PaperboyState, ctx: StepContext): void {
  state.generation += 1;
  state.paused = false;
  state.over = false;
  state.winner = null;
  state.playerLane = 1;
  state.playerY = laneY(1);
  state.safeLane = 1;
  state.papers = [];
  state.houses = generateHouses(ctx, 'mailbox', 0);
  state.obstacles = generateObstacles(ctx, 'mailbox', 0);
  state.scrollX = 0;
  state.throwTimer = 0;
  state.day = 0;
  state.time = PAPERBOY.daySeconds;
  state.score = 0;
  state.delivered = 0;
  state.missed = 0;
  state.thrown = 0;
  state.dayPattern = 'mailbox';
  state.ticks = 0;
  ctx.emit('restart', { generation: state.generation });
}

function generateHouses(ctx: StepContext, pattern: string, hazard: number): PaperboyHouse[] {
  const houses: PaperboyHouse[] = [];
  const subscription = pattern === 'lawn' ? 0.35 - hazard * 0.1 : pattern === 'mailbox' ? 0.8 : 0.6;
  for (let i = 0; i < 30; i++) {
    houses.push({
      x: PAPERBOY.width + i * PAPERBOY.houseSpacing + ctx.rng.range(0, 30),
      lane: ctx.rng.int(3),
      subscribed: ctx.rng.next() < subscription,
      delivered: false,
    });
  }
  return houses;
}

function generateObstacles(ctx: StepContext, pattern: string, hazard: number): PaperboyObstacle[] {
  const obstacles: PaperboyObstacle[] = [];
  const types: readonly PaperboyObstacle['type'][] = ['car', 'fence', 'dog', 'truck'];
  const count = Math.round(20 * (1 + hazard)) + (pattern === 'obstacle' ? 6 : 0);
  for (let i = 0; i < count; i++) {
    const type = types[ctx.rng.int(types.length)] as PaperboyObstacle['type'];
    obstacles.push({
      x: PAPERBOY.width + 100 + i * 120 + ctx.rng.range(0, 60),
      lane: ctx.rng.int(3),
      type,
      w: type === 'truck' ? 50 : type === 'car' ? 35 : type === 'fence' ? 20 : 16,
      speed: type === 'dog' ? 40 : 0,
    });
  }
  return obstacles;
}

/** Reinserta un obstáculo al final de la calle en vez de vaciarla (paridad con el original). */
function recycleObstacle(ctx: StepContext, obstacle: PaperboyObstacle): void {
  const types: readonly PaperboyObstacle['type'][] = ['car', 'fence', 'dog', 'truck'];
  const type = types[ctx.rng.int(types.length)] as PaperboyObstacle['type'];
  obstacle.type = type;
  obstacle.lane = ctx.rng.int(3);
  obstacle.w = type === 'truck' ? 50 : type === 'car' ? 35 : type === 'fence' ? 20 : 16;
  obstacle.speed = type === 'dog' ? 40 : 0;
  obstacle.x = PAPERBOY.width + 100 + ctx.rng.range(0, PAPERBOY.houseSpacing);
}

/** Rejilla de 3 carriles × 8 columnas: 1 = obstáculo, 0 = libre. */
function safeLaneAhead(state: PaperboyState, pathfinding: PathfindingService): number {
  const grid: number[][] = Array.from({ length: 3 }, () =>
    Array.from({ length: PAPERBOY.laneColumns }, () => 0),
  );
  for (const obstacle of state.obstacles) {
    const col = Math.floor((obstacle.x - PAPERBOY.playerX) / PAPERBOY.columnWidth);
    if (col >= 0 && col < PAPERBOY.laneColumns) {
      const row = grid[obstacle.lane];
      if (row !== undefined) row[col] = 1;
    }
  }
  let targetCol = PAPERBOY.laneColumns - 1;
  let targetLane = state.playerLane;
  outer: for (let col = PAPERBOY.laneColumns - 1; col >= 1; col--) {
    for (let lane = 0; lane < 3; lane++) {
      if (grid[lane]?.[col] === 0) {
        targetCol = col;
        targetLane = lane;
        break outer;
      }
    }
  }
  const step = pathfinding.bfsStep(
    grid,
    { col: 0, row: state.playerLane },
    { col: targetCol, row: targetLane },
  );
  return step?.row ?? state.playerLane;
}

export const paperboyGame = defineGame<PaperboyState>({
  id: 'paperboy',
  meta: { title: 'Paperboy', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  // ↑↓ cambian de carril (←→ no tienen sentido en la perspectiva del original).
  actions: ['up', 'down', 'throw', 'pause', 'restart'],
  progression: {
    id: 'paperboy',
    levels: [
      { speed: 1, spawnInterval: 120, hazard: 0, label: 'Calle 1' },
      { speed: 1.1, spawnInterval: 100, hazard: 0.15, label: 'Calle 2' },
      { speed: 1.2, spawnInterval: 80, hazard: 0.3, label: 'Calle 3' },
    ],
    pointsPerLevel: 1,
    dda: { enabled: true, window: 300, maxAdjust: 0.08 },
    patterns: ['mailbox', 'obstacle', 'lawn'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    const state: PaperboyState = {
      paused: false,
      over: false,
      generation: 0,
      winner: null,
      playerLane: 1,
      playerY: laneY(1),
      safeLane: 1,
      papers: [],
      houses: [],
      obstacles: [],
      scrollX: 0,
      throwTimer: 0,
      day: 0,
      time: PAPERBOY.daySeconds,
      score: 0,
      delivered: 0,
      missed: 0,
      thrown: 0,
      dayPattern: 'mailbox',
      ticks: 0,
    };
    resetPaperboy(state, ctx);
    return state;
  },

  step(state, ctx) {
    if (handleLifecycle(state, ctx, state.day, () => resetPaperboy(state, ctx))) return;
    const dt = ctx.clock.dt;
    state.ticks += 1;
    const progress = ctx.progression.state;
    const collision = ctx.services.get<CollisionService>(COLLISION_SERVICE);
    const pathfinding = ctx.services.get<PathfindingService>(PATHFINDING_SERVICE);
    const scroll = PAPERBOY.scrollSpeed * progress.speed;

    state.time -= dt;
    if (state.time <= 0) {
      state.day += 1;
      state.time = PAPERBOY.daySeconds;
      state.dayPattern = ctx.progression.nextPattern() ?? 'mailbox';
      state.houses = generateHouses(ctx, state.dayPattern, progress.hazard);
      state.obstacles = generateObstacles(ctx, state.dayPattern, progress.hazard);
      state.score += 200;
      ctx.emit('levelUp', { day: state.day + 1, pattern: state.dayPattern });
      ctx.progression.observe(0.5);
    }

    state.scrollX += scroll * dt;
    state.throwTimer = Math.max(0, state.throwTimer - dt);
    state.score += scroll * dt * 0.05;

    if (ctx.actions.consume('up')) state.playerLane = Math.max(0, state.playerLane - 1);
    if (ctx.actions.consume('down')) state.playerLane = Math.min(2, state.playerLane + 1);
    state.playerY = approach(
      state.playerY,
      laneY(state.playerLane),
      PAPERBOY.laneHeight * progress.speed * 12 * dt,
    );
    state.safeLane = safeLaneAhead(state, pathfinding);
    if (state.safeLane !== state.playerLane && state.ticks % 60 === 0) {
      ctx.emit('avoid', { lane: state.safeLane });
    }

    if (ctx.actions.consume('throw') && state.throwTimer <= 0) {
      state.throwTimer = PAPERBOY.throwCooldown;
      state.thrown += 1;
      state.papers.push({
        x: PAPERBOY.playerX + 20,
        y: state.playerY - 4,
        lane: state.playerLane,
      });
      ctx.emit('throw', { lane: state.playerLane });
    }

    for (let i = state.papers.length - 1; i >= 0; i--) {
      const paper = state.papers[i];
      if (paper === undefined) continue;
      paper.x += PAPERBOY.paperSpeed * dt;
      if (paper.x > PAPERBOY.width + 20) {
        state.papers.splice(i, 1);
        continue;
      }
      let consumed = false;
      for (const house of state.houses) {
        if (house.delivered || house.lane !== paper.lane) continue;
        if (
          !collision.aabbOverlap(
            { x: paper.x - 4, y: paper.y - 4, w: 8, h: 8 },
            { x: house.x - 20, y: laneY(house.lane) - 10, w: 40, h: 20 },
          )
        ) continue;
        house.delivered = true;
        state.papers.splice(i, 1);
        consumed = true;
        if (house.subscribed) {
          state.delivered += 1;
          state.score += PAPERBOY.rewardDelivered;
          ctx.emit('deliver', { x: house.x, lane: house.lane });
          ctx.progression.observe(0.5);
        } else {
          state.missed += 1;
          state.score = Math.max(0, state.score - PAPERBOY.penaltyMissed);
          ctx.emit('miss', { x: house.x });
          ctx.progression.observe(-0.5);
        }
        break;
      }
      if (consumed) continue;
    }

    for (let i = state.houses.length - 1; i >= 0; i--) {
      const house = state.houses[i];
      if (house === undefined) continue;
      house.x -= scroll * dt;
      if (house.x < -40) state.houses.splice(i, 1);
    }

    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const obstacle = state.obstacles[i];
      if (obstacle === undefined) continue;
      obstacle.x -= (scroll + obstacle.speed) * dt;
      if (obstacle.x < -60) {
        recycleObstacle(ctx, obstacle);
        continue;
      }
      if (
        obstacle.lane === state.playerLane &&
        collision.aabbOverlap(
          { x: PAPERBOY.playerX - 10, y: state.playerY - 7, w: 20, h: 14 },
          { x: obstacle.x - obstacle.w / 2, y: laneY(obstacle.lane) - 7, w: obstacle.w, h: 14 },
        )
      ) {
        state.over = true;
        state.winner = null;
        ctx.emit('crash', { type: obstacle.type });
        // Juice: shake/hit-stop y partículas se consumen fuera del juego.
        ctx.emit('hit', { x: PAPERBOY.playerX, y: state.playerY });
        ctx.emit('explode', { x: obstacle.x, y: state.playerY });
        ctx.emit('gameOver', { score: state.score });
        ctx.progression.observe(-1);
        return;
      }
    }

    if (state.houses.length < 6) {
      const refill = Math.max(4, Math.round((progress.spawnInterval ?? 120) / 15));
      state.houses.push(...generateHouses(ctx, state.dayPattern, progress.hazard).slice(0, refill));
    }
  },

  render(renderer, state, _alpha) {
    // _alpha: el repartidor usa la y exacta del tick.
    const ctx = renderer as CanvasRenderingContext2D | null;
    if (!ctx || typeof ctx.clearRect !== 'function') return;
    const W = PAPERBOY.width;
    const H = PAPERBOY.height;
    const roadTop = PAPERBOY.roadTop;
    const laneH = PAPERBOY.laneHeight;

    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#06091a';
    ctx.fillRect(0, 0, W, roadTop);
    ctx.fillStyle = '#93a8d6';
    for (let i = 0; i < 30; i++) {
      const sx = (((i * 151 - state.scrollX * 0.2) % (W + 20)) + W + 20) % (W + 20) - 10;
      ctx.globalAlpha = 0.3 + (i % 4) * 0.16;
      ctx.fillRect(sx, (i * 43) % (roadTop - 20), 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#101735';
    for (let i = 0; i < 8; i++) {
      const bx = i * 64 + 6;
      const bh = 26 + (i * 29) % 38;
      ctx.fillRect(bx, roadTop - bh, 52, bh);
      ctx.fillStyle = i % 2 === 0 ? '#ffd166' : '#25f4e6';
      ctx.fillRect(bx + 10, roadTop - bh + 10, 6, 7);
      ctx.fillRect(bx + 30, roadTop - bh + 10, 6, 7);
      ctx.fillStyle = '#101735';
    }
    ctx.fillStyle = '#0a1020';
    ctx.fillRect(0, roadTop, W, laneH * 3);
    for (let lane = 0; lane < 3; lane++) {
      const y = roadTop + lane * laneH;
      ctx.fillStyle = lane % 2 === 0 ? '#101932' : '#0d162c';
      ctx.fillRect(0, y, W, laneH);
      ctx.strokeStyle = '#1d3a5c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.strokeStyle = '#25f4e6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, roadTop);
    ctx.lineTo(W, roadTop);
    ctx.moveTo(0, roadTop + 3 * laneH);
    ctx.lineTo(W, roadTop + 3 * laneH);
    ctx.stroke();

    for (const house of state.houses) {
      if (house.x < -30 || house.x > W + 30) continue;
      const my = laneY(house.lane);
      ctx.fillStyle = '#39405f';
      ctx.fillRect(house.x - 2, my + 6, 4, 12);
      ctx.fillStyle = house.delivered ? '#3c4566' : house.subscribed ? '#7df9ff' : '#ff5cf0';
      ctx.fillRect(house.x - 10, my - 4, 20, 12);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(house.x + 8, my - 8, 3, 7);
    }

    for (const obstacle of state.obstacles) {
      if (obstacle.x < -60 || obstacle.x > W + 60) continue;
      const oy = laneY(obstacle.lane);
      if (obstacle.type === 'car' || obstacle.type === 'truck') {
        ctx.fillStyle = obstacle.type === 'truck' ? '#ff9f43' : '#ff3f6e';
        ctx.fillRect(obstacle.x - obstacle.w / 2, oy - 8, obstacle.w, 16);
        ctx.fillStyle = '#7df9ff';
        ctx.fillRect(obstacle.x - obstacle.w / 2 + 4, oy - 5, 8, 4);
        ctx.fillStyle = '#050814';
        ctx.fillRect(obstacle.x - obstacle.w / 2 + 3, oy + 8, 6, 4);
        ctx.fillRect(obstacle.x + obstacle.w / 2 - 9, oy + 8, 6, 4);
      } else if (obstacle.type === 'fence') {
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obstacle.x - obstacle.w / 2, oy + 8);
        ctx.lineTo(obstacle.x - obstacle.w / 2, oy - 8);
        ctx.lineTo(obstacle.x + obstacle.w / 2, oy - 8);
        ctx.lineTo(obstacle.x + obstacle.w / 2, oy + 8);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#b56bff';
        ctx.beginPath();
        ctx.moveTo(obstacle.x, oy - 8);
        ctx.lineTo(obstacle.x + 8, oy + 8);
        ctx.lineTo(obstacle.x - 8, oy + 8);
        ctx.lineTo(obstacle.x, oy - 8);
        ctx.fill();
      }
    }

    for (const paper of state.papers) {
      ctx.fillStyle = '#fff3d0';
      ctx.fillRect(paper.x - 4, paper.y - 4, 8, 8);
    }

    const py = state.playerY;
    ctx.strokeStyle = state.throwTimer > 0 ? '#ffd166' : '#24e6ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(PAPERBOY.playerX - 8, py + 8, 7, 0, Math.PI * 2);
    ctx.moveTo(PAPERBOY.playerX + 8, py + 8);
    ctx.arc(PAPERBOY.playerX + 8, py + 8, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#25f4e6';
    ctx.fillRect(PAPERBOY.playerX - 6, py - 6, 12, 16);
    ctx.fillStyle = '#ff5cf0';
    ctx.fillRect(PAPERBOY.playerX - 2, py - 14, 8, 8);

    ctx.fillStyle = 'rgba(4, 6, 20, 0.82)';
    ctx.fillRect(0, H - 26, W, 26);
    ctx.font = '14px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7df9ff';
    ctx.fillText(`PTS ${Math.floor(state.score)} · DÍA ${state.day + 1}`, 10, H - 8);
    ctx.textAlign = 'center';
    ctx.fillText(`ENTREGADOS ${state.delivered} · FALLIDOS ${state.missed}`, W / 2, H - 8);
    ctx.textAlign = 'right';
    ctx.fillStyle = state.time < 10 ? '#ff4d6d' : '#7df9ff';
    ctx.fillText(`T ${state.time.toFixed(1)}`, W - 10, H - 8);
    ctx.fillStyle = 'rgba(255, 209, 102, 0.35)';
    ctx.fillRect(PAPERBOY.playerX - 2, laneY(state.safeLane) - 2, 4, 4);
    ctx.restore();
  },

  observe(state) {
    const nextHouse = state.houses.reduce<PaperboyHouse | null>((best, house) => {
      if (best === null) return house;
      const current = manhattan(PAPERBOY.playerX, state.playerLane, house.x, house.lane);
      const previous = manhattan(PAPERBOY.playerX, state.playerLane, best.x, best.lane);
      return current < previous ? house : best;
    }, null);
    const nextObstacle = state.obstacles[0];
    return new Float32Array([
      clamp(state.playerLane / 2, 0, 1),
      clamp((state.playerY - PAPERBOY.roadTop) / (PAPERBOY.laneHeight * 3), 0, 1),
      clamp(state.papers.length / 5, 0, 1),
      nextHouse === null ? 1 : clamp((nextHouse.x - PAPERBOY.playerX) / PAPERBOY.width, 0, 1),
      nextHouse === null || !nextHouse.subscribed ? 0 : 1,
      nextObstacle === undefined ? 1 : clamp((nextObstacle.x - PAPERBOY.playerX) / PAPERBOY.width, 0, 1),
      clamp(state.safeLane / 2, 0, 1),
      clamp(state.time / PAPERBOY.daySeconds, 0, 1),
      clamp(state.score / 2000, 0, 1),
      state.over ? 1 : 0,
    ]);
  },

  rules: singlePlayerRules<PaperboyState>(
    (state) => state.score + state.delivered * PAPERBOY.rewardDelivered - state.missed * PAPERBOY.penaltyMissed + state.day * 100,
  ),
});
