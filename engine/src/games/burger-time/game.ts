import { defineGame } from '../../game/contract.js';
import type { StepContext } from '../../core/simulation.js';
import { clamp, approach } from '../../core/math.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import { COLLISION_SERVICE, type CollisionService } from '../../sim/collision.js';

export const BURGER = {
  width: 400,
  height: 400,
  platforms: 5,
  platGap: 70,
  playerW: 14,
  playerH: 20,
  speed: 80,
  climbSpeed: 60,
  ingredientW: 30,
  ingredientH: 8,
  bunTop: 0,
  lettuce: 1,
  tomato: 2,
  patty: 3,
  bunBot: 4,
  maxLives: 3,
} as const;

const ENEMY_TYPES = {
  hotdog: { speed: 35, score: 20 },
  pickle: { speed: 25, score: 30 },
  egg: { speed: 30, score: 25 },
} as const;
type EnemyKind = keyof typeof ENEMY_TYPES;
const STACK = [BURGER.bunBot, BURGER.patty, BURGER.tomato, BURGER.lettuce, BURGER.bunTop];

export interface Platform {
  y: number;
  gaps: number[];
}
export interface Ingredient {
  x: number;
  y: number;
  baseY: number;
  plat: number;
  type: number;
  falling: boolean;
  fallTimer: number;
  landed: boolean;
}
export interface BurgerEnemy {
  x: number;
  plat: number;
  type: EnemyKind;
  facing: number;
  speed: number;
  stunned: number;
}
export interface BurgerState {
  x: number;
  y: number;
  plat: number;
  onLadder: boolean;
  facing: number;
  stunned: number;
  platforms: Platform[];
  ingredients: Ingredient[];
  enemies: BurgerEnemy[];
  burgersCompleted: number;
  pepperCount: number;
  score: number;
  lives: number;
  level: number;
  progress: number;
  paused: boolean;
  over: boolean;
  ticks: number;
  pattern: string | null;
}

function platY(index: number): number {
  return 40 + index * BURGER.platGap;
}
function ladderX(state: BurgerState, index: number): number {
  return state.platforms[index]?.gaps[0] ?? BURGER.width / 2;
}

function buildLevel(state: BurgerState, ctx: StepContext): void {
  state.platforms = [];
  for (let i = 0; i < BURGER.platforms; i++) {
    const gaps: number[] = [];
    if (i > 0) {
      gaps.push(60 + ctx.rng.next() * (BURGER.width - 120));
      gaps.push(60 + ctx.rng.next() * (BURGER.width - 120));
      gaps.sort((a, b) => a - b);
    }
    state.platforms.push({ y: platY(i), gaps });
  }
  state.ingredients = [];
  for (let p = 0; p < BURGER.platforms - 1; p++) {
    const y = platY(p) - 12;
    for (let j = 0; j < STACK.length; j++) {
      state.ingredients.push({
        x: 80 + j * 55,
        y,
        baseY: y,
        plat: p,
        type: STACK[j] ?? 0,
        falling: false,
        fallTimer: 0,
        landed: false,
      });
    }
    if (state.pattern === 'ingredient') {
      state.ingredients.push({
        x: 80,
        y,
        baseY: y,
        plat: p,
        type: BURGER.bunBot,
        falling: false,
        fallTimer: 0,
        landed: false,
      });
    }
  }
  const kinds: EnemyKind[] = ['hotdog', 'pickle', 'egg'];
  state.enemies = [];
  const count = 3 + state.level + (state.pattern === 'enemy' ? 1 : 0);
  for (let i = 0; i < count; i++) {
    const kind = kinds[i % kinds.length] ?? 'hotdog';
    state.enemies.push({
      x: 40 + ctx.rng.next() * (BURGER.width - 80),
      plat: ctx.rng.int(BURGER.platforms),
      type: kind,
      facing: ctx.rng.int(2) === 0 ? 1 : -1,
      speed: ENEMY_TYPES[kind].speed + state.level * 3,
      stunned: 0,
    });
  }
}

function startLevel(state: BurgerState, ctx: StepContext): void {
  state.pattern = ctx.progression.nextPattern();
  state.x = BURGER.width / 2;
  state.y = platY(BURGER.platforms - 1);
  state.plat = BURGER.platforms - 1;
  state.onLadder = false;
  state.stunned = 0;
  state.pepperCount = state.pattern === 'pepper' ? 4 : 3;
  buildLevel(state, ctx);
  ctx.emit('levelStart', { level: state.level, pattern: state.pattern });
}

function resetGame(state: BurgerState, ctx: StepContext): void {
  state.score = 0;
  state.lives = BURGER.maxLives;
  state.level = 1;
  state.progress = 0;
  state.burgersCompleted = 0;
  state.over = false;
  startLevel(state, ctx);
}

function loseLife(state: BurgerState, ctx: StepContext): void {
  state.lives--;
  state.score = Math.max(0, state.score - 50);
  state.stunned = 1;
  ctx.emit('hit', { x: state.x, plat: state.plat });
  ctx.progression.observe(-0.8);
  if (state.lives <= 0) {
    state.over = true;
    ctx.emit('gameOver', { score: state.score });
  }
}

function usePepper(state: BurgerState, ctx: StepContext): void {
  if (state.pepperCount <= 0) return;
  state.pepperCount--;
  for (const enemy of state.enemies) {
    if (enemy.plat === state.plat && Math.abs(enemy.x - state.x) < 50) {
      enemy.stunned = 3;
      ctx.emit('pepper', { type: enemy.type });
    }
  }
}

function checkBurgers(state: BurgerState, ctx: StepContext): void {
  for (let p = 0; p < BURGER.platforms; p++) {
    const bun = state.ingredients.find(
      (ingredient) => ingredient.type === BURGER.bunBot && ingredient.plat === p && ingredient.landed,
    );
    if (bun === undefined) continue;
    let complete = true;
    for (const type of STACK) {
      const found = state.ingredients.some(
        (ingredient) =>
          ingredient.type === type &&
          ingredient.plat === p &&
          ingredient.landed &&
          Math.abs(ingredient.x - bun.x) < 20,
      );
      if (!found) complete = false;
    }
    if (!complete) continue;
    state.score += 200;
    state.burgersCompleted++;
    state.progress++;
    ctx.emit('burger', { plat: p, score: state.score });
    ctx.progression.observe(1);
    state.ingredients = state.ingredients.filter(
      (ingredient) => !(ingredient.plat === p && ingredient.landed),
    );
    if (state.ingredients.length === 0) {
      state.level++;
      state.progress = state.level;
      ctx.emit('levelUp', { level: state.level });
      startLevel(state, ctx);
      return;
    }
  }
}

export const burgerTimeGame = defineGame<BurgerState>({
  id: 'burger-time',
  meta: { title: 'Burger Time', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['left', 'right', 'up', 'down', 'pepper', 'pause', 'restart'],
  progression: {
    id: 'burger-time',
    levels: [
      { speed: 1, spawnInterval: 12, hazard: 0, label: 'Nivel 1' },
      { speed: 1.1, spawnInterval: 10, hazard: 0.2, label: 'Nivel 2' },
      { speed: 1.22, spawnInterval: 9, hazard: 0.4, label: 'Nivel 3' },
    ],
    pointsPerLevel: 1,
    dda: { enabled: true, window: 300, maxAdjust: 0.08 },
    patterns: ['ingredient', 'enemy', 'pepper'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    const state: BurgerState = {
      x: BURGER.width / 2,
      y: platY(BURGER.platforms - 1),
      plat: BURGER.platforms - 1,
      onLadder: false,
      facing: 1,
      stunned: 0,
      platforms: [],
      ingredients: [],
      enemies: [],
      burgersCompleted: 0,
      pepperCount: 3,
      score: 0,
      lives: BURGER.maxLives,
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

    if (state.stunned > 0) {
      state.stunned -= dt;
      state.ticks++;
      return;
    }

    let moving = false;
    if (ctx.actions.isDown('left')) {
      state.x -= BURGER.speed * dt;
      state.facing = -1;
      moving = true;
    }
    if (ctx.actions.isDown('right')) {
      state.x += BURGER.speed * dt;
      state.facing = 1;
      moving = true;
    }
    state.x = clamp(state.x, BURGER.playerW, BURGER.width - BURGER.playerW);

    if (!state.onLadder) {
      if (ctx.actions.isDown('up') && Math.abs(state.x - ladderX(state, state.plat)) < 20 && state.plat > 0) {
        state.onLadder = true;
      }
      if (ctx.actions.isDown('down') && state.plat < BURGER.platforms - 1) {
        if (Math.abs(state.x - ladderX(state, state.plat + 1)) < 20) {
          state.onLadder = true;
          state.plat++;
        }
      }
    }
    if (state.onLadder) {
      const target = platY(state.plat);
      if (ctx.actions.isDown('up')) {
        state.y = approach(state.y, target - BURGER.platGap, BURGER.climbSpeed * dt);
        if (state.y <= target - BURGER.platGap + 4) {
          state.plat = Math.max(0, state.plat - 1);
          state.y = platY(state.plat);
          state.onLadder = false;
        }
        moving = true;
      } else if (ctx.actions.isDown('down')) {
        state.y = approach(state.y, target + BURGER.platGap, BURGER.climbSpeed * dt);
        if (state.y >= target - 4) {
          state.y = target;
          state.onLadder = false;
        }
        moving = true;
      } else if (Math.abs(state.y - target) < 4) {
        state.y = target;
        state.onLadder = false;
      }
    } else {
      state.y = platY(state.plat);
    }
    if (moving && ctx.rng.next() < 0.1) ctx.emit('walk', { x: state.x });

    if (ctx.actions.consume('pepper')) usePepper(state, ctx);

    for (const ingredient of state.ingredients) {
      if (ingredient.falling || ingredient.landed) continue;
      if (
        ingredient.plat === state.plat &&
        !state.onLadder &&
        Math.abs(ingredient.x - state.x) < BURGER.ingredientW * 0.6
      ) {
        ingredient.falling = true;
        ingredient.fallTimer = 0;
        ctx.emit('drop', { type: ingredient.type });
      }
    }
    for (const ingredient of state.ingredients) {
      if (!ingredient.falling) continue;
      ingredient.fallTimer += dt;
      ingredient.y += 120 * dt;
      const nextY = platY(ingredient.plat + 1);
      if (ingredient.y >= nextY - 10) {
        ingredient.y = nextY - 10;
        ingredient.falling = false;
        ingredient.plat++;
        ingredient.landed = true;
        ctx.emit('land', { type: ingredient.type });
      }
    }

    for (const enemy of state.enemies) {
      if (enemy.stunned > 0) {
        enemy.stunned -= dt;
        continue;
      }
      enemy.x += enemy.facing * enemy.speed * dt;
      if (enemy.x < 20 || enemy.x > BURGER.width - 20) enemy.facing *= -1;
      if (ctx.rng.next() < 0.005) {
        if (enemy.plat > 0 && Math.abs(enemy.x - ladderX(state, enemy.plat)) < 20) enemy.plat--;
        else if (enemy.plat < BURGER.platforms - 1) enemy.plat++;
      }
      const playerBox = { x: state.x - BURGER.playerW / 2, y: state.y - BURGER.playerH, w: BURGER.playerW, h: BURGER.playerH };
      const enemyBox = { x: enemy.x - 7, y: platY(enemy.plat) - BURGER.playerH, w: 14, h: BURGER.playerH };
      if (enemy.plat === state.plat && state.stunned <= 0 && collision.aabbOverlap(playerBox, enemyBox)) {
        loseLife(state, ctx);
        break;
      }
    }
    if (state.over) return;

    checkBurgers(state, ctx);
    state.ticks++;
  },

  observe(state) {
    let near = 99;
    let dx = 0;
    for (const enemy of state.enemies) {
      const distance = Math.abs(enemy.x - state.x) + Math.abs(enemy.plat - state.plat) * BURGER.platGap;
      if (distance < near) {
        near = distance;
        dx = (enemy.x - state.x) / BURGER.width;
      }
    }
    return new Float32Array([
      state.x / BURGER.width,
      state.plat / BURGER.platforms,
      dx,
      near / (BURGER.width + BURGER.platforms * BURGER.platGap),
      state.ingredients.filter((ingredient) => ingredient.landed).length / 20,
      clamp(state.pepperCount / 4, 0, 1),
      clamp(state.lives / BURGER.maxLives, 0, 1),
    ]);
  },

  rules: singlePlayerRules<BurgerState>(
    (state) => state.score + state.burgersCompleted * 200 - (state.over ? 500 : 0),
  ),
});
