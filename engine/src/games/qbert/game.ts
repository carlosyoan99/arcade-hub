import { defineGame } from '../../game/contract.js';
import type { StepContext } from '../../core/simulation.js';
import { clamp, lerp, manhattan } from '../../core/math.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import { COLLISION_SERVICE, type CollisionService } from '../../sim/collision.js';

export const QBERT = {
  maxK: 6,
  stepX: 86,
  stepY: 42,
  hopSeconds: 0.22,
  turboSeconds: 8,
  turboHopSeconds: 0.11,
  invincibleTime: 2.2,
  maxLives: 3,
  eggAfterJumps: 10,
  eggHatch: 4,
  discInterval: 16,
  boostInterval: 30,
  slickInterval: 14,
} as const;

export interface Cube {
  k: number;
  i: number;
  colored: boolean;
}
export interface QbertHopper {
  kind: 'egg' | 'coily' | 'slick' | 'sam';
  k: number;
  i: number;
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  hopping: boolean;
  hopT: number;
  dead: boolean;
}
export interface Powerup {
  k: number;
  i: number;
}
export interface QbertState {
  cubes: Cube[];
  pk: number;
  pi: number;
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  hopping: boolean;
  hopT: number;
  falls: boolean;
  inv: number;
  alive: boolean;
  turbo: number;
  coily: QbertHopper | null;
  slick: QbertHopper[];
  disc: Powerup | null;
  boost: Powerup | null;
  jumpCount: number;
  discCount: number;
  levelTimer: number;
  eggTimer: number;
  slickTimer: number;
  discTimer: number;
  boostTimer: number;
  hitsThisLevel: boolean;
  score: number;
  lives: number;
  level: number;
  progress: number;
  paused: boolean;
  over: boolean;
  ticks: number;
  pattern: string | null;
}

type Hop = readonly [number, number];
const HOPS: Readonly<Record<string, Hop>> = {
  upLeft: [-1, -1],
  upRight: [-1, 0],
  downLeft: [1, 0],
  downRight: [1, 1],
};
const ALL_HOPS = Object.values(HOPS);

function cubePos(k: number, i: number): { x: number; y: number } {
  return { x: 360 + (i - k / 2) * QBERT.stepX, y: 118 + k * QBERT.stepY };
}
function inPyramid(k: number, i: number): boolean {
  return k >= 0 && k <= QBERT.maxK && i >= 0 && i <= k;
}
function makeHopper(kind: QbertHopper['kind'], k: number, i: number): QbertHopper {
  const pos = cubePos(k, i);
  return {
    kind,
    k,
    i,
    x: pos.x,
    y: pos.y,
    fromX: pos.x,
    fromY: pos.y,
    toX: pos.x,
    toY: pos.y,
    hopping: false,
    hopT: 0,
    dead: false,
  };
}

function startLevel(state: QbertState, ctx: StepContext): void {
  state.pattern = ctx.progression.nextPattern();
  state.cubes = [];
  for (let k = 0; k <= QBERT.maxK; k++) {
    for (let i = 0; i <= k; i++) state.cubes.push({ k, i, colored: false });
  }
  state.pk = 0;
  state.pi = 0;
  const pos = cubePos(0, 0);
  state.x = pos.x;
  state.y = pos.y;
  state.fromX = pos.x;
  state.fromY = pos.y;
  state.toX = pos.x;
  state.toY = pos.y;
  state.hopping = false;
  state.hopT = 0;
  state.falls = false;
  state.inv = 1.2;
  state.alive = true;
  state.turbo = 0;
  state.coily = null;
  state.slick = [];
  state.disc = null;
  state.boost = null;
  state.jumpCount = 0;
  state.discCount = 0;
  state.levelTimer = 0;
  state.eggTimer = 0;
  state.slickTimer = QBERT.slickInterval;
  state.discTimer = QBERT.discInterval;
  state.boostTimer = QBERT.boostInterval;
  state.hitsThisLevel = false;
  ctx.emit('levelStart', { level: state.level, pattern: state.pattern });
}

function resetGame(state: QbertState, ctx: StepContext): void {
  state.score = 0;
  state.lives = QBERT.maxLives;
  state.level = 1;
  state.progress = 0;
  state.over = false;
  startLevel(state, ctx);
}

function colorCube(state: QbertState, k: number, i: number, ctx: StepContext): void {
  const cube = state.cubes.find((c) => c.k === k && c.i === i);
  if (cube !== undefined && !cube.colored) {
    cube.colored = true;
    state.score += 25;
    ctx.emit('color', { k, i });
  }
}

function playerDied(state: QbertState, ctx: StepContext): void {
  state.alive = false;
  state.lives--;
  ctx.emit('hit', { k: state.pk, i: state.pi });
  ctx.progression.observe(-0.8);
  if (state.lives <= 0) {
    state.over = true;
    ctx.emit('gameOver', { score: state.score });
    return;
  }
  state.pk = 0;
  state.pi = 0;
  const pos = cubePos(0, 0);
  state.x = pos.x;
  state.y = pos.y;
  state.hopping = false;
  state.falls = false;
  state.inv = QBERT.invincibleTime;
  state.alive = true;
}

function playerHit(state: QbertState, ctx: StepContext): void {
  if (!state.alive || state.inv > 0) return;
  state.hitsThisLevel = true;
  playerDied(state, ctx);
}

function spawnEgg(state: QbertState, ctx: StepContext): void {
  if (state.coily !== null) return;
  state.eggTimer = QBERT.eggHatch;
  state.coily = makeHopper('egg', 0, 0);
  ctx.emit('egg', {});
}

function spawnSlick(state: QbertState, ctx: StepContext): void {
  const maxSlick = state.pattern === 'sam' ? 2 : state.level >= 4 ? 2 : state.level >= 2 ? 1 : 0;
  while (state.slick.length < maxSlick) {
    const k = 2 + ctx.rng.int(3);
    const i = ctx.rng.int(k + 1);
    const kind: QbertHopper['kind'] = ctx.rng.int(2) === 0 ? 'slick' : 'sam';
    state.slick.push(makeHopper(kind, k, i));
  }
  state.slickTimer = QBERT.slickInterval + ctx.rng.range(0, 8);
  ctx.emit('slickSpawn', {});
}

function spawnRandomPowerup(state: QbertState, ctx: StepContext, disc: boolean): void {
  if (disc && state.disc !== null) return;
  if (!disc && state.boost !== null) return;
  const k = 1 + ctx.rng.int(QBERT.maxK);
  const i = ctx.rng.int(k + 1);
  const powerup: Powerup = { k, i };
  if (disc) {
    state.disc = powerup;
    state.discTimer = QBERT.discInterval;
  } else {
    state.boost = powerup;
    state.boostTimer = QBERT.boostInterval;
  }
  ctx.emit(disc ? 'disc' : 'boost', { k, i });
}

function killSlick(state: QbertState, slick: QbertHopper, ctx: StepContext): void {
  state.slick = state.slick.filter((other) => other !== slick);
  state.score += 500;
  ctx.emit('enemyHit', { kind: slick.kind });
  ctx.progression.observe(0.5);
}

function killCoily(state: QbertState, fromDisc: boolean, ctx: StepContext): void {
  if (state.coily === null) return;
  state.score += fromDisc ? 1000 : 1500;
  state.coily = null;
  ctx.emit('enemyHit', { kind: 'coily', fromDisc });
  ctx.progression.observe(0.7);
}

function enemyHop(enemy: QbertHopper, hop: Hop): void {
  if (enemy.hopping || enemy.dead) return;
  const nk = enemy.k + (hop[0] ?? 0);
  const ni = enemy.i + (hop[1] ?? 0);
  enemy.fromX = enemy.x;
  enemy.fromY = enemy.y;
  if (!inPyramid(nk, ni)) {
    enemy.dead = true;
    enemy.hopping = true;
    enemy.hopT = 0;
    enemy.toX = enemy.x;
    enemy.toY = enemy.y + 500;
    return;
  }
  const pos = cubePos(nk, ni);
  enemy.k = nk;
  enemy.i = ni;
  enemy.toX = pos.x;
  enemy.toY = pos.y;
  enemy.hopping = true;
  enemy.hopT = 0;
}

function updateHopper(state: QbertState, enemy: QbertHopper, dt: number, ctx: StepContext): void {
  if (!enemy.hopping) return;
  enemy.hopT += dt;
  const t = Math.min(1, enemy.hopT / 0.46);
  enemy.x = lerp(enemy.fromX, enemy.toX, t);
  enemy.y = lerp(enemy.fromY, enemy.toY, t) - Math.sin(t * Math.PI) * 56;
  if (t < 1) return;
  enemy.hopping = false;
  if (enemy.dead) return;
  enemy.x = enemy.toX;
  enemy.y = enemy.toY;
  if (enemy.kind === 'slick' || enemy.kind === 'sam') {
    const cube = state.cubes.find((c) => c.k === enemy.k && c.i === enemy.i);
    if (cube !== undefined) cube.colored = false;
  }
  if (state.alive && !state.hopping && state.pk === enemy.k && state.pi === enemy.i) {
    if (enemy.kind === 'coily') playerHit(state, ctx);
    else killSlick(state, enemy, ctx);
  }
}

function updateEnemies(state: QbertState, dt: number, ctx: StepContext): void {
  if (state.coily !== null) {
    const coily = state.coily;
    if (coily.kind === 'egg') {
      if (!state.hopping && state.pk === 0 && state.pi === 0 && state.inv <= 0) {
        const cube = state.cubes.find((c) => c.k === 0 && c.i === 0);
        if (cube !== undefined && !cube.colored) {
          state.hitsThisLevel = true;
          playerHit(state, ctx);
          return;
        }
      }
      state.eggTimer -= dt;
      if (state.eggTimer <= 0) coily.kind = 'coily';
    } else if (!coily.dead) {
      updateHopper(state, coily, dt, ctx);
      if (!coily.hopping) {
        const dlWeight = state.pi === coily.i ? 3 : 1;
        const drWeight = state.pi + 1 === coily.i || coily.k === 0 ? 3 : 1;
        const total = dlWeight + drWeight;
        let roll = ctx.rng.next() * total;
        let picked: Hop = HOPS.downLeft ?? [-1, 0];
        for (const [hop, weight] of [
          [HOPS.downLeft, dlWeight],
          [HOPS.downRight, drWeight],
        ] as Array<[Hop, number]>) {
          if (roll < weight) {
            picked = hop;
            break;
          }
          roll -= weight;
        }
        if (state.pk > coily.k && ctx.rng.next() < 0.25) {
          picked = coily.i > state.pi ? (HOPS.downRight ?? [1, 1]) : (HOPS.downLeft ?? [1, 0]);
        }
        enemyHop(coily, picked);
      }
    }
    if (state.coily?.dead) state.coily = null;
  }

  for (const slick of state.slick) {
    updateHopper(state, slick, dt, ctx);
    if (!slick.hopping && !slick.dead) {
      const options = ALL_HOPS.filter(([dk, di]) => inPyramid(slick.k + (dk ?? 0), slick.i + (di ?? 0)));
      const hop = options[ctx.rng.int(options.length)];
      if (hop !== undefined) enemyHop(slick, hop);
    }
  }
  state.slick = state.slick.filter((slick) => !slick.dead);
}

function hop(state: QbertState, delta: Hop, ctx: StepContext): void {
  if (!state.alive || state.hopping) return;
  const nk = state.pk + (delta[0] ?? 0);
  const ni = state.pi + (delta[1] ?? 0);
  state.jumpCount++;
  state.fromX = state.x;
  state.fromY = state.y;
  state.hopT = 0;
  state.hopping = true;
  if (!inPyramid(nk, ni)) {
    const pos = cubePos(nk, ni);
    state.toX = pos.x;
    state.toY = pos.y + 420;
    state.pk = nk;
    state.pi = ni;
    state.falls = true;
    ctx.emit('jump', { to: [nk, ni], fall: true });
    return;
  }
  const pos = cubePos(nk, ni);
  state.pk = nk;
  state.pi = ni;
  state.toX = pos.x;
  state.toY = pos.y;
  ctx.emit('jump', { to: [nk, ni] });
  if (state.jumpCount === QBERT.eggAfterJumps) spawnEgg(state, ctx);
}

function land(state: QbertState, ctx: StepContext): void {
  colorCube(state, state.pk, state.pi, ctx);
  if (state.disc !== null && state.disc.k === state.pk && state.disc.i === state.pi) {
    state.discCount++;
    killCoily(state, true, ctx);
    state.disc = null;
  }
  if (state.boost !== null && state.boost.k === state.pk && state.boost.i === state.pi) {
    state.turbo = QBERT.turboSeconds;
    state.boost = null;
    ctx.emit('turbo', {});
  }
  for (const slick of [...state.slick]) {
    if (slick.k === state.pk && slick.i === state.pi && !slick.hopping) killSlick(state, slick, ctx);
  }
  if (state.coily !== null && state.coily.k === state.pk && state.coily.i === state.pi && !state.coily.hopping && !state.coily.dead) {
    playerHit(state, ctx);
    return;
  }
  if (state.cubes.every((cube) => cube.colored)) {
    state.score += 1000 + state.level * 500;
    state.level++;
    state.progress = state.level;
    ctx.emit('levelUp', { level: state.level });
    ctx.progression.observe(1);
    startLevel(state, ctx);
  }
}

export const qbertGame = defineGame<QbertState>({
  id: 'qbert',
  meta: { title: 'Q*bert', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['upLeft', 'upRight', 'downLeft', 'downRight', 'pause', 'restart'],
  progression: {
    id: 'qbert',
    levels: [
      { speed: 1, spawnInterval: 10, hazard: 0, label: 'Nivel 1' },
      { speed: 1.1, spawnInterval: 9, hazard: 0.2, label: 'Nivel 2' },
      { speed: 1.25, spawnInterval: 8, hazard: 0.4, label: 'Nivel 3' },
    ],
    pointsPerLevel: 1,
    dda: { enabled: true, window: 300, maxAdjust: 0.08 },
    patterns: ['cube', 'coil', 'sam'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    const state: QbertState = {
      cubes: [],
      pk: 0,
      pi: 0,
      x: 0,
      y: 0,
      fromX: 0,
      fromY: 0,
      toX: 0,
      toY: 0,
      hopping: false,
      hopT: 0,
      falls: false,
      inv: 0,
      alive: true,
      turbo: 0,
      coily: null,
      slick: [],
      disc: null,
      boost: null,
      jumpCount: 0,
      discCount: 0,
      levelTimer: 0,
      eggTimer: 0,
      slickTimer: 0,
      discTimer: 0,
      boostTimer: 0,
      hitsThisLevel: false,
      score: 0,
      lives: QBERT.maxLives,
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
    state.levelTimer += dt;
    if (state.inv > 0) state.inv -= dt;
    if (state.turbo > 0) state.turbo -= dt;

    state.discTimer -= dt;
    if (state.discTimer <= 0) spawnRandomPowerup(state, ctx, true);
    state.boostTimer -= dt;
    if (state.boostTimer <= 0) spawnRandomPowerup(state, ctx, false);
    state.slickTimer -= dt;
    if (state.slickTimer <= 0) spawnSlick(state, ctx);

    if (!state.hopping) {
      for (const [action, delta] of Object.entries(HOPS)) {
        if (ctx.actions.isDown(action)) {
          hop(state, delta, ctx);
          break;
        }
      }
    }

    if (state.hopping) {
      const duration = state.turbo > 0 ? QBERT.turboHopSeconds : QBERT.hopSeconds;
      state.hopT += dt;
      const t = Math.min(1, state.hopT / duration);
      state.x = lerp(state.fromX, state.toX, t);
      state.y = lerp(state.fromY, state.toY, t) - Math.sin(t * Math.PI) * 70;
      if (t >= 1) {
        state.hopping = false;
        state.x = state.toX;
        state.y = state.toY;
        if (state.falls) {
          state.falls = false;
          playerDied(state, ctx);
        } else {
          land(state, ctx);
        }
      }
    }

    updateEnemies(state, dt, ctx);

    if (state.alive && !state.hopping) {
      const playerBox = { x: state.x - 10, y: state.y - 10, w: 20, h: 20 };
      for (const enemy of [state.coily, ...state.slick]) {
        if (enemy === null || enemy.dead || enemy.hopping) continue;
        if (collision.aabbOverlap(playerBox, { x: enemy.x - 10, y: enemy.y - 10, w: 20, h: 20 })) {
          if (enemy.kind === 'coily') playerHit(state, ctx);
          else killSlick(state, enemy, ctx);
        }
      }
    }
    state.ticks++;
  },

  observe(state) {
    let colored = 0;
    for (const cube of state.cubes) if (cube.colored) colored++;
    let nearest = 99;
    for (const enemy of [state.coily, ...state.slick]) {
      if (enemy === null || enemy.dead) continue;
      const distance = manhattan(state.pk, state.pi, enemy.k, enemy.i);
      if (distance < nearest) nearest = distance;
    }
    return new Float32Array([
      state.pk / QBERT.maxK,
      state.pi / QBERT.maxK,
      state.cubes.length === 0 ? 0 : colored / state.cubes.length,
      nearest / 14,
      state.disc !== null ? 1 : 0,
      state.boost !== null ? 1 : 0,
      clamp(state.lives / QBERT.maxLives, 0, 1),
    ]);
  },

  rules: singlePlayerRules<QbertState>(
    (state) => state.score + state.level * 400 - (state.over ? 500 : 0),
  ),
});
