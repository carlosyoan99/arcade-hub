import { defineGame } from '../../game/contract.js';
import type { StepContext } from '../../core/simulation.js';
import { clamp, approach } from '../../core/math.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import { COLLISION_SERVICE, type CollisionService, type AABB } from '../../sim/collision.js';

export const DK = {
  width: 480,
  height: 540,
  tile: 36,
  playerW: 20,
  playerH: 28,
  playerSpeed: 180,
  jumpHeight: 3.2 * 36,
  timeToApex: 0.38,
  coyoteTime: 0.1,
  jumpBuffer: 0.12,
  barrelRadius: 10,
  barrelSpeed: 120,
  maxBarrels: 6,
  fireSpeed: 60,
  maxFires: 3,
  fireInterval: 3,
  elevatorSpeed: 60,
  hammerTime: 4.5,
  constructionMaxBarrels: 8,
  hammerPoints: 100,
  timeLimit: 60,
  maxLives: 3,
} as const;

const GRAVITY = (2 * DK.jumpHeight) / DK.timeToApex ** 2;
const JUMP_VEL = -(2 * DK.jumpHeight) / DK.timeToApex;
const FALL_GRAVITY = GRAVITY * 1.8;
const PLATFORM_DEFS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 0, 14, 1],
  [0, 12, 14, 1],
  [1, 3, 9, 1],
  [0, 6, 8, 1],
  [3, 9, 9, 1],
  [4, 0.5, 6, 1],
];
const LADDER_DEFS: ReadonlyArray<readonly [number, number, number]> = [
  [9, 3, 4],
  [7, 6, 4],
  [4, 9, 4],
  [6, 0, 4],
];
const PHASE_NAMES = ['Barriles', 'Fuego', 'Elevador', 'Construcción'] as const;

export interface Barrel {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
export interface Fire {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  onGround: boolean;
  ladderCooldown: number;
}
export interface Elevator {
  x: number;
  y: number;
  w: number;
  h: number;
  yMin: number;
  yMax: number;
  dir: number;
}
export interface Barrier {
  x: number;
  y: number;
  w: number;
  h: number;
  gapX: number;
  gapW: number;
}
export interface DkState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  onGround: boolean;
  coyote: number;
  buffer: number;
  jumpReleased: boolean;
  barrels: Barrel[];
  fires: Fire[];
  elevators: Elevator[];
  barriers: Barrier[];
  hammerActive: boolean;
  hammerTimer: number;
  hammerTaken: boolean;
  hammerBroke: number;
  barrelSpawnTimer: number;
  fireSpawnTimer: number;
  timeAcc: number;
  timeLeft: number;
  score: number;
  lives: number;
  level: number;
  progress: number;
  phase: number;
  paused: boolean;
  over: boolean;
  ticks: number;
  pattern: string | null;
}

function platforms(): AABB[] {
  return PLATFORM_DEFS.map(([x, y, w, h]) => ({ x: x * DK.tile, y: y * DK.tile, w: w * DK.tile, h: h * DK.tile }));
}
function playerBox(state: DkState): AABB {
  return { x: state.x, y: state.y, w: state.w, h: state.h };
}
function initPlayer(state: DkState): void {
  state.x = 1.5 * DK.tile;
  state.y = 11 * DK.tile - DK.playerH;
  state.vx = 0;
  state.vy = 0;
  state.onGround = false;
  state.coyote = 0;
  state.buffer = 0;
  state.jumpReleased = false;
}

function setupPhase(state: DkState, ctx: StepContext): void {
  state.pattern = ctx.progression.nextPattern();
  state.phase = (state.level - 1) % 4;
  state.barrels = [];
  state.fires = [];
  state.elevators = [];
  state.barriers = [];
  state.hammerActive = false;
  state.hammerTimer = 0;
  state.hammerTaken = false;
  state.hammerBroke = 0;
  state.barrelSpawnTimer = 0;
  state.fireSpawnTimer = 0;
  if (state.phase === 2) {
    const defs: ReadonlyArray<readonly [number, number, number, number]> = [
      [8, 3, 9, 1],
      [3, 6, 11, -1],
      [6, 1, 9, 1],
    ];
    state.elevators = defs.map(([x, yMin, yMax, dir]) => ({
      x: x * DK.tile,
      y: yMin * DK.tile,
      w: DK.tile * 2,
      h: DK.tile * 0.4,
      yMin: yMin * DK.tile,
      yMax: yMax * DK.tile,
      dir,
    }));
  }
  if (state.phase === 3) {
    state.barriers = [
      { x: DK.tile, y: 2 * DK.tile, w: 6 * DK.tile, h: DK.tile * 0.5, gapX: 0, gapW: 0 },
      { x: 9 * DK.tile, y: 4.2 * DK.tile, w: 3 * DK.tile, h: DK.tile * 0.5, gapX: 0, gapW: 0 },
    ];
  }
  ctx.emit('phase', { level: state.level, phase: PHASE_NAMES[state.phase] ?? '', pattern: state.pattern });
}

function startGame(state: DkState, ctx: StepContext): void {
  state.score = 0;
  state.lives = DK.maxLives;
  state.level = 1;
  state.progress = 0;
  state.timeLeft = DK.timeLimit;
  state.timeAcc = 0;
  state.over = false;
  setupPhase(state, ctx);
  initPlayer(state);
}

function loseLife(state: DkState, ctx: StepContext): void {
  state.lives--;
  ctx.emit('hit', { x: state.x, y: state.y });
  ctx.progression.observe(-0.8);
  if (state.lives <= 0) {
    state.over = true;
    ctx.emit('gameOver', { score: state.score });
    return;
  }
  initPlayer(state);
  setupPhase(state, ctx);
  state.timeLeft = Math.max(30, state.timeLeft);
}

function levelComplete(state: DkState, ctx: StepContext): void {
  state.level++;
  state.progress = state.level;
  state.timeLeft = DK.timeLimit;
  state.timeAcc = 0;
  state.score += 500;
  ctx.emit('levelUp', { level: state.level, phase: PHASE_NAMES[(state.level - 1) % 4] ?? '' });
  ctx.progression.observe(1);
  setupPhase(state, ctx);
  initPlayer(state);
}

function onPlatform(state: DkState): number {
  for (const platform of platforms()) {
    if (
      state.x + state.w > platform.x + 2 &&
      state.x < platform.x + platform.w - 2 &&
      Math.abs(state.y + state.h - platform.y) < 6
    ) {
      return platform.y;
    }
  }
  return -1;
}
function ladderAt(state: DkState, up: boolean): { x: number; top: number; bottom: number } | null {
  for (const [lx, base, height] of LADDER_DEFS) {
    const x = lx * DK.tile;
    const top = (base - height + 1) * DK.tile;
    const bottom = (base + 1) * DK.tile;
    if (state.x + state.w > x + 4 && state.x < x + DK.tile - 4) {
      if (up && state.y + state.h > top && state.y + state.h < bottom) return { x, top, bottom };
      if (!up && state.y + state.h > top && state.y < bottom) return { x, top, bottom };
    }
  }
  return null;
}

function updatePlayer(state: DkState, dt: number, ctx: StepContext, collision: CollisionService): void {
  let move = 0;
  if (ctx.actions.isDown('left')) move -= 1;
  if (ctx.actions.isDown('right')) move += 1;
  state.vx = move * DK.playerSpeed;
  if (ctx.actions.consume('jump')) state.buffer = DK.jumpBuffer;
  state.buffer -= dt;
  if (ctx.actions.consume('jump')) state.jumpReleased = true;
  if (state.onGround) state.coyote = DK.coyoteTime;
  else state.coyote -= dt;

  const climbing = ladderAt(state, ctx.actions.isDown('up'));
  if (state.buffer > 0 && state.coyote > 0 && climbing === null) {
    state.vy = JUMP_VEL;
    state.buffer = 0;
    state.coyote = 0;
    state.onGround = false;
    ctx.emit('jump', { x: state.x, y: state.y });
  }
  if (state.jumpReleased && state.vy < 0) {
    state.vy *= 0.45;
    state.jumpReleased = false;
  }
  state.vy += (state.vy > 0 ? FALL_GRAVITY : GRAVITY) * dt;
  if (climbing !== null && ctx.actions.isDown('up')) {
    state.vy = -DK.playerSpeed * 0.7;
    state.onGround = false;
  }
  state.x = clamp(state.x + state.vx * dt, 0, DK.width - state.w);
  state.y += state.vy * dt;

  const floor = onPlatform(state);
  if (floor >= 0 && state.vy >= 0) {
    state.y = floor - state.h;
    state.vy = 0;
    state.onGround = true;
  } else {
    if (state.y + state.h > 12 * DK.tile) {
      state.y = 12 * DK.tile - state.h;
      state.vy = 0;
      state.onGround = true;
    } else state.onGround = false;
  }

  if (state.phase === 2) {
    for (const elevator of state.elevators) {
      const box = { x: elevator.x, y: elevator.y, w: elevator.w, h: elevator.h };
      if (
        collision.aabbOverlap(playerBox(state), { ...box, h: box.h + 8 }) &&
        state.y + state.h >= box.y &&
        state.vy >= 0
      ) {
        state.y = box.y - state.h;
        state.vy = 0;
        state.onGround = true;
      }
    }
  }
  if (state.phase === 3) {
    for (const barrier of state.barriers) {
      const overGap = state.x + state.w > barrier.gapX && state.x < barrier.gapX + barrier.gapW;
      if (
        !overGap &&
        state.x + state.w > barrier.x &&
        state.x < barrier.x + barrier.w &&
        state.y + state.h >= barrier.y &&
        state.y + state.h <= barrier.y + barrier.h + 8 &&
        state.vy >= 0
      ) {
        state.y = barrier.y - state.h;
        state.vy = 0;
        state.onGround = true;
      }
    }
  }
  if (state.y > DK.height) loseLife(state, ctx);
  if (state.y < 1.5 * DK.tile && state.x > 4 * DK.tile && state.x < 10 * DK.tile) levelComplete(state, ctx);
}

function spawnBarrel(state: DkState, ctx: StepContext): void {
  const construction = state.phase === 3;
  state.barrels.push({
    x: (construction ? 8 : 7) * DK.tile,
    y: (construction ? 2.2 : 0.8) * DK.tile,
    vx: (ctx.rng.next() > 0.5 ? 1 : -1) * DK.barrelSpeed * (construction ? 1.2 : 1),
    vy: 0,
  });
  ctx.emit('barrelSpawn', { phase: state.phase });
}

function updateBarrels(state: DkState, dt: number, ctx: StepContext, collision: CollisionService): void {
  for (let i = state.barrels.length - 1; i >= 0; i--) {
    const barrel = state.barrels[i];
    if (barrel === undefined) continue;
    barrel.vy += GRAVITY * dt;
    barrel.x += barrel.vx * dt;
    barrel.y += barrel.vy * dt;
    const barrelBox: AABB = {
      x: barrel.x - DK.barrelRadius,
      y: barrel.y - DK.barrelRadius,
      w: DK.barrelRadius * 2,
      h: DK.barrelRadius * 2,
    };
    let onPlat = false;
    const surfaces: AABB[] = state.phase === 3
      ? [...state.barriers.filter((b) => b.gapW > 0).map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h })), ...platforms()]
      : platforms();
    for (const surface of surfaces) {
      if (
        barrel.x + DK.barrelRadius > surface.x &&
        barrel.x - DK.barrelRadius < surface.x + surface.w &&
        barrel.y + DK.barrelRadius > surface.y &&
        barrel.y + DK.barrelRadius < surface.y + surface.h + 8 &&
        barrel.vy >= 0
      ) {
        if (state.phase === 3 && surface.y === state.barriers[0]?.y) {
          const gap = state.barriers[0];
          if (gap !== undefined && barrel.x > gap.gapX && barrel.x < gap.gapX + gap.gapW) continue;
        }
        barrel.y = surface.y - DK.barrelRadius;
        barrel.vy = 0;
        if (barrel.x < surface.x + 8) barrel.vx = Math.abs(barrel.vx);
        else if (barrel.x > surface.x + surface.w - 8) barrel.vx = -Math.abs(barrel.vx);
        onPlat = true;
        break;
      }
    }
    if (!onPlat) barrel.vy = barrel.vy > 0 ? barrel.vy : 0;
    if (barrel.y > DK.height + 50 || barrel.x < -50 || barrel.x > DK.width + 50) {
      state.barrels.splice(i, 1);
      continue;
    }
    if (collision.aabbOverlap(playerBox(state), barrelBox)) {
      if (state.hammerActive) {
        state.barrels.splice(i, 1);
        state.score += DK.hammerPoints;
        state.hammerBroke++;
        ctx.emit('barrelBreak', {});
        ctx.progression.observe(0.7);
      } else {
        loseLife(state, ctx);
        return;
      }
    }
  }
}

function spawnFire(state: DkState, ctx: StepContext): void {
  if (state.fires.length >= DK.maxFires) return;
  state.fires.push({
    x: 8.2 * DK.tile,
    y: 1.2 * DK.tile,
    vx: 0,
    vy: 0,
    w: 14,
    h: 14,
    onGround: false,
    ladderCooldown: 0,
  });
  ctx.emit('fireSpawn', {});
}

function updateFires(state: DkState, dt: number, ctx: StepContext, collision: CollisionService): void {
  for (let i = state.fires.length - 1; i >= 0; i--) {
    const fire = state.fires[i];
    if (fire === undefined) continue;
    fire.vy += GRAVITY * dt;
    fire.x += fire.vx * dt;
    fire.y += fire.vy * dt;
    let onPlat = false;
    for (const platform of platforms()) {
      if (
        fire.x + fire.w / 2 > platform.x &&
        fire.x - fire.w / 2 < platform.x + platform.w &&
        fire.y + fire.h > platform.y &&
        fire.y + fire.h < platform.y + platform.h + 8 &&
        fire.vy >= 0
      ) {
        fire.y = platform.y - fire.h;
        fire.vy = 0;
        onPlat = true;
        fire.onGround = true;
        break;
      }
    }
    if (onPlat || fire.onGround) {
      const dx = state.x - fire.x;
      fire.vx = dx > 10 ? DK.fireSpeed : dx < -10 ? -DK.fireSpeed : 0;
    }
    if (fire.onGround) {
      fire.ladderCooldown -= dt;
      if (fire.ladderCooldown <= 0) {
        for (const [lx] of LADDER_DEFS) {
          if (Math.abs(fire.x - lx * DK.tile) < DK.tile * 0.6) {
            fire.vy = -DK.fireSpeed * 1.2;
            fire.onGround = false;
            fire.ladderCooldown = 2;
            break;
          }
        }
        if (fire.ladderCooldown <= 0) fire.ladderCooldown = 0.5;
      }
    }
    if (fire.y > DK.height + 30 || fire.x < -30 || fire.x > DK.width + 30) {
      state.fires.splice(i, 1);
      continue;
    }
    if (collision.aabbOverlap(playerBox(state), { x: fire.x - fire.w / 2, y: fire.y - fire.h / 2, w: fire.w, h: fire.h })) {
      loseLife(state, ctx);
      return;
    }
  }
}

function updateElevators(state: DkState, dt: number): void {
  for (const elevator of state.elevators) {
    elevator.y = approach(elevator.y + elevator.dir * DK.elevatorSpeed * dt, elevator.dir > 0 ? elevator.yMax : elevator.yMin, DK.elevatorSpeed * dt * 2);
    if (elevator.y <= elevator.yMin) {
      elevator.y = elevator.yMin;
      elevator.dir = 1;
    }
    if (elevator.y >= elevator.yMax) {
      elevator.y = elevator.yMax;
      elevator.dir = -1;
    }
  }
}

function updateConstruction(state: DkState, dt: number, ctx: StepContext, collision: CollisionService): void {
  const extra = Math.min(2, Math.floor((state.level - 1) / 2));
  for (const barrier of state.barriers) {
    barrier.gapX = DK.tile * 2 + (barrier.w - 2 * DK.tile) * ctx.rng.next();
    barrier.gapW = DK.tile * 0.6 * (1 + extra * 0.4);
  }
  if (state.hammerActive) {
    state.hammerTimer -= dt;
    if (state.hammerTimer <= 0) state.hammerActive = false;
  } else if (!state.hammerTaken) {
    const pickup: AABB = { x: 5 * DK.tile, y: 6 * DK.tile, w: DK.tile * 0.8, h: DK.tile * 0.8 };
    if (collision.aabbOverlap(playerBox(state), pickup)) {
      state.hammerTaken = true;
      state.hammerActive = true;
      state.hammerTimer = DK.hammerTime;
      ctx.emit('hammer', {});
    }
  }
}

export const donkeyKongGame = defineGame<DkState>({
  id: 'donkey-kong',
  meta: { title: 'Donkey Kong', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['left', 'right', 'jump', 'up', 'down', 'pause', 'restart'],
  progression: {
    id: 'donkey-kong',
    levels: [
      { speed: 1, spawnInterval: 90, hazard: 0, label: 'Nivel 1' },
      { speed: 1.1, spawnInterval: 75, hazard: 0.2, label: 'Nivel 2' },
      { speed: 1.22, spawnInterval: 62, hazard: 0.4, label: 'Nivel 3' },
    ],
    pointsPerLevel: 1,
    dda: { enabled: true, window: 300, maxAdjust: 0.08 },
    patterns: ['barrel', 'fire', 'spring'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    const state: DkState = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      w: DK.playerW,
      h: DK.playerH,
      onGround: false,
      coyote: 0,
      buffer: 0,
      jumpReleased: false,
      barrels: [],
      fires: [],
      elevators: [],
      barriers: [],
      hammerActive: false,
      hammerTimer: 0,
      hammerTaken: false,
      hammerBroke: 0,
      barrelSpawnTimer: 0,
      fireSpawnTimer: 0,
      timeAcc: 0,
      timeLeft: DK.timeLimit,
      score: 0,
      lives: DK.maxLives,
      level: 1,
      progress: 0,
      phase: 0,
      paused: false,
      over: false,
      ticks: 0,
      pattern: null,
    };
    startGame(state, ctx);
    return state;
  },

  step(state, ctx) {
    if (handleLifecycle(state, ctx, state.progress, () => startGame(state, ctx))) return;
    const dt = ctx.clock.dt * ctx.progression.state.speed;
    const collision = ctx.services.get<CollisionService>(COLLISION_SERVICE);
    const hazard = ctx.progression.state.hazard;
    const patternBonus = state.pattern === 'fire' ? 0.7 : state.pattern === 'spring' ? 0.85 : 1;

    updatePlayer(state, dt, ctx, collision);
    if (state.over) return;

    if (state.phase === 0 || state.phase === 3) {
      updateBarrels(state, dt, ctx, collision);
      state.barrelSpawnTimer -= dt;
      const limit = state.phase === 3 ? DK.constructionMaxBarrels : DK.maxBarrels;
      if (state.barrelSpawnTimer <= 0 && state.barrels.length < limit) {
        spawnBarrel(state, ctx);
        const base = state.phase === 3 ? Math.max(0.6, 1.8 - state.level * 0.1) : Math.max(0.8, 2.5 - state.level * 0.15);
        state.barrelSpawnTimer = base * patternBonus * (1 - hazard * 0.3);
      }
    } else if (state.phase === 1) {
      updateFires(state, dt, ctx, collision);
      state.fireSpawnTimer -= dt;
      if (state.fireSpawnTimer <= 0) {
        spawnFire(state, ctx);
        state.fireSpawnTimer = Math.max(1.5, DK.fireInterval - state.level * 0.1) * patternBonus;
      }
    } else {
      updateElevators(state, dt);
    }
    if (state.over) return;

    if (state.phase === 3) updateConstruction(state, dt, ctx, collision);

    state.timeAcc += dt;
    if (state.timeAcc >= 1) {
      state.timeAcc -= 1;
      state.timeLeft -= 1;
      if (state.timeLeft <= 0) loseLife(state, ctx);
    }
    state.ticks++;
  },

  observe(state) {
    let near = 99;
    let dx = 0;
    let dy = 0;
    const hazards: AABB[] = [
      ...state.barrels.map((barrel) => ({ x: barrel.x, y: barrel.y, w: 1, h: 1 })),
      ...state.fires.map((fire) => ({ x: fire.x, y: fire.y, w: fire.w, h: fire.h })),
      ...state.elevators.map((elevator) => ({ x: elevator.x, y: elevator.y, w: elevator.w, h: elevator.h })),
    ];
    for (const hazard of hazards) {
      const distance = Math.abs(hazard.x - state.x) + Math.abs(hazard.y - state.y);
      if (distance < near) {
        near = distance;
        dx = (hazard.x - state.x) / DK.width;
        dy = (hazard.y - state.y) / DK.height;
      }
    }
    return new Float32Array([
      state.x / DK.width,
      state.y / DK.height,
      dx,
      dy,
      near / (DK.width + DK.height),
      state.hammerActive ? 1 : 0,
      state.timeLeft / DK.timeLimit,
      clamp(state.lives / DK.maxLives, 0, 1),
    ]);
  },

  render(renderer, state, _alpha) {
    // _alpha ignorado: el estado ya trae la posición de cada entidad.
    const ctx = renderer as CanvasRenderingContext2D | null;
    if (!ctx || typeof ctx.clearRect !== 'function') return;
    const tile = DK.tile;
    const W = DK.width;
    const H = DK.height;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, W, H);

    for (const [px, py, w, h] of PLATFORM_DEFS) {
      const x = px * tile;
      const y = py * tile;
      ctx.fillStyle = '#17325c';
      ctx.fillRect(x, y, w * tile, h * tile);
      ctx.fillStyle = '#5ef2ff';
      ctx.fillRect(x, y, w * tile, 3);
    }

    for (const [lx, base, height] of LADDER_DEFS) {
      const x = lx * tile + tile / 2;
      const top = (base - height + 1) * tile;
      const bottom = (base + 1) * tile;
      ctx.strokeStyle = '#ff8a3d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 10, top);
      ctx.lineTo(x - 10, bottom);
      ctx.moveTo(x + 10, top);
      ctx.lineTo(x + 10, bottom);
      for (let y = top + 10; y < bottom; y += 14) {
        ctx.moveTo(x - 10, y);
        ctx.lineTo(x + 10, y);
      }
      ctx.stroke();
    }

    for (const barrier of state.barriers) {
      ctx.fillStyle = '#ff3fa4';
      ctx.fillRect(barrier.x, barrier.y, barrier.w, barrier.h);
      if (barrier.gapW > 0) {
        ctx.fillStyle = '#05060f';
        ctx.fillRect(barrier.gapX, barrier.y - 2, barrier.gapW, barrier.h + 4);
      }
    }
    for (const elevator of state.elevators) {
      ctx.fillStyle = '#5ef2ff';
      ctx.fillRect(elevator.x, elevator.y, elevator.w, elevator.h);
      ctx.fillStyle = '#17325c';
      ctx.fillRect(elevator.x + 3, elevator.y + 3, elevator.w - 6, elevator.h - 6);
    }

    if (!state.hammerTaken) {
      ctx.fillStyle = '#ffc857';
      ctx.fillRect(5 * tile + 6, 6 * tile + 4, tile * 0.8 - 12, 7);
      ctx.fillRect(5 * tile + tile * 0.4 - 3, 6 * tile - 18, 6, 24);
    }

    ctx.fillStyle = '#b06bff';
    ctx.beginPath();
    ctx.arc(6.5 * tile, tile * 1.35, tile * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffc857';
    ctx.fillRect(6.5 * tile - 18, tile * 1.35 - 4, 36, 8);

    for (const barrel of state.barrels) {
      ctx.fillStyle = '#ffc857';
      ctx.beginPath();
      ctx.arc(barrel.x, barrel.y, DK.barrelRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7a4a1e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(barrel.x - 6, barrel.y - 6);
      ctx.lineTo(barrel.x + 6, barrel.y + 6);
      ctx.stroke();
    }
    for (const fire of state.fires) {
      ctx.fillStyle = '#ff3fa4';
      ctx.beginPath();
      ctx.moveTo(fire.x + fire.w / 2, fire.y - 5);
      ctx.lineTo(fire.x + fire.w, fire.y + fire.h);
      ctx.lineTo(fire.x, fire.y + fire.h);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#ff4d5e';
    ctx.fillRect(state.x, state.y + 8, state.w, state.h - 8);
    ctx.fillStyle = '#5ef2ff';
    ctx.fillRect(state.x + 3, state.y, state.w - 6, 12);
    ctx.fillStyle = '#f5f8ff';
    ctx.fillRect(state.x + 4, state.y + 3, 4, 4);
    ctx.fillRect(state.x + state.w - 8, state.y + 3, 4, 4);
    if (state.hammerActive) {
      ctx.strokeStyle = '#ffc857';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(state.x + state.w / 2, state.y + 4, 22, -0.9, 0.9);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(5,6,15,0.88)';
    ctx.fillRect(0, H - 24, W, 24);
    ctx.fillStyle = '#5ef2ff';
    ctx.font = '14px monospace';
    ctx.fillText(`DK  L${state.level}  x${state.lives}  ${String(state.score).padStart(6, '0')}`, 8, H - 8);
    ctx.fillStyle = '#ffc857';
    ctx.fillText(`T${Math.max(0, Math.ceil(state.timeLeft))}`, W - 48, H - 8);
    ctx.restore();
  },

  rules: singlePlayerRules<DkState>(
    (state) => state.score + state.level * 300 - (state.over ? 500 : 0),
  ),
});
