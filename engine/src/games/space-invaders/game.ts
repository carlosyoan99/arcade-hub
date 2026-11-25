import type { StepContext } from '../../core/simulation.js';
import { clamp, dist2 } from '../../core/math.js';
import { defineGame } from '../../game/contract.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import type { CollisionService } from '../../sim/collision.js';

/** Space Invaders — 5×11, un disparo en pantalla, escudos erosionables y nave misteriosa. */
export const SPACE_INVADERS = {
  width: 800,
  height: 600,
  shipY: 560,
  shipSpeed: 400,
  shipMargin: 20,
  rows: 5,
  cols: 11,
  invaderW: 30,
  invaderH: 24,
  gapX: 12,
  gapY: 16,
  formationY: 50,
  bulletSpeed: 500,
  enemyBulletSpeed: 220,
  fireCooldown: 0.3,
  maxEnemyBullets: 3,
  shields: 4,
  shieldWidth: 60,
  shieldY: 505,
  startLives: 3,
  invulnerable: 2,
  mysteryPoints: [50, 100, 150, 300],
  rowPoints: [30, 20, 20, 10, 10],
} as const;

interface Invader {
  x: number;
  y: number;
  row: number;
  col: number;
  alive: boolean;
  points: number;
}

interface ShieldBlock {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Shield {
  blocks: ShieldBlock[];
}

interface Bullet {
  x: number;
  y: number;
  vy: number;
}

interface Mystery {
  x: number;
  dir: number;
  points: number;
}

export interface SpaceInvadersState {
  shipX: number;
  bullet: Bullet | null;
  invaders: Invader[];
  enemyBullets: Bullet[];
  shields: Shield[];
  mystery: Mystery | null;
  score: number;
  lives: number;
  wave: number;
  over: boolean;
  paused: boolean;
  ticks: number;
  progress: number;
  invuln: number;
  fireCd: number;
  moveTimer: number;
  invDir: number;
  mysteryTimer: number;
  reachedBottom: boolean;
  extraLifeGiven: boolean;
  seed: number;
}

function invaderInterval(ratio: number, wave: number, speed: number): number {
  const base = ratio > 0.75 ? 0.55 : ratio > 0.5 ? 0.4 : ratio > 0.25 ? 0.25 : 0.12;
  const waveFactor = Math.max(0.5, 1 - (wave - 1) * 0.06);
  return (base * waveFactor) / speed;
}

function buildInvaders(state: SpaceInvadersState): void {
  state.invaders = [];
  const totalWidth = SPACE_INVADERS.cols * SPACE_INVADERS.invaderW +
    (SPACE_INVADERS.cols - 1) * SPACE_INVADERS.gapX;
  const startX = (SPACE_INVADERS.width - totalWidth) / 2 + SPACE_INVADERS.invaderW / 2;
  const offset = Math.min(state.wave - 1, 2);
  for (let row = 0; row < SPACE_INVADERS.rows; row++) {
    for (let col = 0; col < SPACE_INVADERS.cols; col++) {
      state.invaders.push({
        x: startX + col * (SPACE_INVADERS.invaderW + SPACE_INVADERS.gapX),
        y: SPACE_INVADERS.formationY + (row + offset) * (SPACE_INVADERS.invaderH + SPACE_INVADERS.gapY),
        row,
        col,
        alive: true,
        points: SPACE_INVADERS.rowPoints[row] ?? 10,
      });
    }
  }
  state.invDir = 1;
  state.moveTimer = 0;
  state.reachedBottom = false;
}

function buildShields(state: SpaceInvadersState): void {
  state.shields = [];
  const width = SPACE_INVADERS.shieldWidth;
  const gap = (SPACE_INVADERS.width - SPACE_INVADERS.shields * width) / (SPACE_INVADERS.shields + 1);
  for (let i = 0; i < SPACE_INVADERS.shields; i++) {
    const startX = gap + i * (width + gap);
    const blocks: ShieldBlock[] = [];
    for (let bx = 0; bx < 8; bx++) {
      for (let by = 0; by < 5; by++) {
        const keep =
          (by === 0 && bx > 0 && bx < 7) ||
          by === 1 ||
          by === 2 ||
          (by === 3 && bx > 1 && bx < 6);
        if (keep) {
          blocks.push({
            x: startX + bx * 7.5,
            y: SPACE_INVADERS.shieldY + by * 6,
            w: 7.5,
            h: 6,
          });
        }
      }
    }
    state.shields.push({ blocks });
  }
}

function erodeShield(state: SpaceInvadersState, x: number, y: number, radius: number, ctx: StepContext): boolean {
  let eroded = false;
  for (const shield of state.shields) {
    for (let bi = shield.blocks.length - 1; bi >= 0; bi--) {
      const block = shield.blocks[bi];
      if (!block) continue;
      if (dist2(block.x + block.w / 2, block.y + block.h / 2, x, y) > radius * radius) continue;
      shield.blocks.splice(bi, 1);
      eroded = true;
      ctx.emit('hit', { kind: 'shield', x: shield.blocks.length });
    }
  }
  return eroded;
}

function reset(state: SpaceInvadersState, ctx: StepContext): void {
  state.score = 0;
  state.lives = SPACE_INVADERS.startLives;
  state.wave = 1;
  state.over = false;
  state.paused = false;
  state.ticks = 0;
  state.progress = 0;
  state.invuln = 0;
  state.fireCd = 0;
  state.extraLifeGiven = false;
  state.shipX = SPACE_INVADERS.width / 2;
  state.bullet = null;
  state.enemyBullets = [];
  state.mystery = null;
  state.mysteryTimer = 3;
  buildInvaders(state);
  buildShields(state);
  ctx.emit('levelUp', { wave: state.wave });
}

function loseLife(state: SpaceInvadersState, ctx: StepContext): void {
  state.lives--;
  state.invuln = SPACE_INVADERS.invulnerable;
  state.shipX = SPACE_INVADERS.width / 2;
  state.bullet = null;
  state.enemyBullets = [];
  ctx.emit('explode', { x: state.shipX, y: SPACE_INVADERS.shipY, kind: 'ship' });
  ctx.progression.observe(-0.8);
  if (state.lives <= 0) {
    state.over = true;
    ctx.emit('gameOver', { score: state.score });
  }
}

function nextWave(state: SpaceInvadersState, ctx: StepContext): void {
  state.wave++;
  state.progress += 500;
  buildInvaders(state);
  buildShields(state);
  state.enemyBullets = [];
  state.mystery = null;
  state.mysteryTimer = 3;
  ctx.emit('levelUp', { wave: state.wave });
}

export const spaceInvadersGame = defineGame<SpaceInvadersState>({
  id: 'space-invaders',
  meta: { title: 'Space Invaders', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['left', 'right', 'fire', 'pause', 'restart'],
  progression: {
    id: 'space-invaders',
    levels: [
      { speed: 1, spawnInterval: 100, hazard: 0, label: 'Oleada 1' },
      { speed: 1.12, spawnInterval: 82, hazard: 0.15, label: 'Oleada 2' },
      { speed: 1.25, spawnInterval: 66, hazard: 0.3, label: 'Oleada 3' },
      { speed: 1.4, spawnInterval: 52, hazard: 0.45, label: 'Oleada 4' },
    ],
    pointsPerLevel: 1200,
    dda: { enabled: true, window: 360, maxAdjust: 0.08 },
    patterns: ['dive', 'sweep', 'shield'],
    avoidRepeat: 2,
  },

  init(seed, ctx) {
    const state: SpaceInvadersState = {
      shipX: SPACE_INVADERS.width / 2,
      bullet: null,
      invaders: [],
      enemyBullets: [],
      shields: [],
      mystery: null,
      score: 0,
      lives: SPACE_INVADERS.startLives,
      wave: 1,
      over: false,
      paused: false,
      ticks: 0,
      progress: 0,
      invuln: 0,
      fireCd: 0,
      moveTimer: 0,
      invDir: 1,
      mysteryTimer: 3,
      reachedBottom: false,
      extraLifeGiven: false,
      seed,
    };
    reset(state, ctx);
    return state;
  },

  step(state, ctx) {
    if (handleLifecycle(state, ctx, state.progress, () => reset(state, ctx))) return;
    const dt = ctx.clock.dt;
    const collision = ctx.services.get<CollisionService>('collision');
    const progress = ctx.progression.state;
    const speed = progress.speed;
    state.ticks++;
    state.fireCd = Math.max(0, state.fireCd - dt);
    state.invuln = Math.max(0, state.invuln - dt);

    if (ctx.actions.isDown('left')) state.shipX -= SPACE_INVADERS.shipSpeed * dt;
    if (ctx.actions.isDown('right')) state.shipX += SPACE_INVADERS.shipSpeed * dt;
    state.shipX = clamp(state.shipX, SPACE_INVADERS.shipMargin, SPACE_INVADERS.width - SPACE_INVADERS.shipMargin);

    const alive = state.invaders.filter((invader) => invader.alive);
    const bulletSpeed = SPACE_INVADERS.bulletSpeed +
      (1 - alive.length / (SPACE_INVADERS.rows * SPACE_INVADERS.cols)) * 200;
    if (ctx.actions.isDown('fire') && state.bullet === null && state.fireCd <= 0) {
      state.bullet = { x: state.shipX, y: SPACE_INVADERS.shipY - 12, vy: -bulletSpeed };
      state.fireCd = SPACE_INVADERS.fireCooldown;
      ctx.emit('shoot', { x: state.shipX, y: SPACE_INVADERS.shipY });
    }

    if (alive.length > 0) {
      const ratio = alive.length / (SPACE_INVADERS.rows * SPACE_INVADERS.cols);
      const pattern = ctx.progression.nextPattern();
      const interval = invaderInterval(ratio, state.wave, speed) * (pattern === 'sweep' ? 0.8 : 1);
      state.moveTimer += dt;
      while (state.moveTimer >= interval) {
        state.moveTimer -= interval;
        let hitEdge = false;
        for (const invader of alive) {
          invader.x += state.invDir * 12;
          if (invader.x > SPACE_INVADERS.width - 20 || invader.x < 20) hitEdge = true;
          if (invader.y + SPACE_INVADERS.invaderH > SPACE_INVADERS.shieldY + 20) state.reachedBottom = true;
        }
        if (hitEdge) {
          state.invDir = -state.invDir;
          for (const invader of alive) invader.y += 8;
        }
      }

      const bulletCap = SPACE_INVADERS.maxEnemyBullets + Math.round(progress.hazard * 3);
      if (state.enemyBullets.length < bulletCap && ctx.rng.next() < 0.02 * (1 + progress.hazard * 2)) {
        const lowest = new Map<number, Invader>();
        for (const invader of alive) {
          const current = lowest.get(invader.col);
          if (!current || invader.y > current.y) lowest.set(invader.col, invader);
        }
        const shooters = [...lowest.values()];
        const shooter = shooters[ctx.rng.int(shooters.length)];
        if (shooter) {
          state.enemyBullets.push({
            x: shooter.x,
            y: shooter.y + SPACE_INVADERS.invaderH / 2,
            vy: SPACE_INVADERS.enemyBulletSpeed + (state.wave - 1) * 15,
          });
          ctx.emit('shoot', { x: shooter.x, y: shooter.y, hostile: true });
        }
      }
    }

    state.mysteryTimer -= dt * speed;
    if (state.mystery === null && state.mysteryTimer <= 0) {
      const fromLeft = ctx.rng.next() > 0.5;
      const points = SPACE_INVADERS.mysteryPoints[ctx.rng.int(SPACE_INVADERS.mysteryPoints.length)] ?? 50;
      state.mystery = { x: fromLeft ? -30 : SPACE_INVADERS.width + 30, dir: fromLeft ? 1 : -1, points };
    }
    if (state.mystery !== null) {
      state.mystery.x += 120 * state.mystery.dir * dt;
      if (state.mystery.x < -40 || state.mystery.x > SPACE_INVADERS.width + 40) {
        state.mystery = null;
        state.mysteryTimer = 5 + ctx.rng.range(0, 8);
      }
    }

    if (state.bullet !== null) {
      const bullet = state.bullet;
      bullet.y += bullet.vy * dt;
      if (bullet.y < 0) {
        state.bullet = null;
      } else {
        let consumed = false;
        const mystery = state.mystery;
        if (mystery && collision.aabbOverlap(
          { x: bullet.x - 3, y: bullet.y - 6, w: 6, h: 12 },
          { x: mystery.x - 25, y: 15, w: 50, h: 30 },
        )) {
          state.score += mystery.points;
          state.progress += mystery.points;
          ctx.emit('explode', { x: mystery.x, y: 30, points: mystery.points });
          ctx.emit('score', { score: state.score, points: mystery.points });
          ctx.progression.observe(0.6);
          state.mystery = null;
          state.mysteryTimer = 5 + ctx.rng.range(0, 8);
          consumed = true;
        }
        if (!consumed) {
          for (const invader of state.invaders) {
            if (!invader.alive) continue;
            if (!collision.aabbOverlap(
              { x: bullet.x - 3, y: bullet.y - 6, w: 6, h: 12 },
              { x: invader.x - SPACE_INVADERS.invaderW / 2, y: invader.y - SPACE_INVADERS.invaderH / 2, w: SPACE_INVADERS.invaderW, h: SPACE_INVADERS.invaderH },
            )) continue;
            invader.alive = false;
            state.score += invader.points;
            state.progress += invader.points;
            ctx.emit('hit', { x: invader.x, y: invader.y });
            ctx.emit('explode', { x: invader.x, y: invader.y, points: invader.points });
            ctx.emit('score', { score: state.score, points: invader.points });
            ctx.progression.observe(0.4);
            if (!state.extraLifeGiven && state.score >= 1000) {
              state.extraLifeGiven = true;
              state.lives++;
              ctx.emit('score', { score: state.score, points: 0, reason: 'extraLife' });
            }
            consumed = true;
            break;
          }
        }
        if (!consumed && erodeShield(state, bullet.x, bullet.y, 12, ctx)) consumed = true;
        if (consumed) state.bullet = null;
      }
    }

    for (let ei = state.enemyBullets.length - 1; ei >= 0; ei--) {
      const enemyBullet = state.enemyBullets[ei];
      if (!enemyBullet) continue;
      enemyBullet.y += enemyBullet.vy * dt;
      if (enemyBullet.y > SPACE_INVADERS.height + 10) {
        state.enemyBullets.splice(ei, 1);
        continue;
      }
      if (state.invuln <= 0 && collision.aabbOverlap(
        { x: enemyBullet.x - 3, y: enemyBullet.y - 6, w: 6, h: 12 },
        { x: state.shipX - 20, y: SPACE_INVADERS.shipY - 11, w: 40, h: 22 },
      )) {
        state.enemyBullets.splice(ei, 1);
        loseLife(state, ctx);
        continue;
      }
      if (erodeShield(state, enemyBullet.x, enemyBullet.y, 8, ctx)) state.enemyBullets.splice(ei, 1);
    }

    for (const invader of state.invaders) {
      if (!invader.alive) continue;
      for (const shield of state.shields) {
        for (let bi = shield.blocks.length - 1; bi >= 0; bi--) {
          const block = shield.blocks[bi];
          if (!block) continue;
          if (collision.aabbOverlap(
            { x: invader.x - SPACE_INVADERS.invaderW / 2, y: invader.y - SPACE_INVADERS.invaderH / 2, w: SPACE_INVADERS.invaderW, h: SPACE_INVADERS.invaderH },
            block,
          )) shield.blocks.splice(bi, 1);
        }
      }
    }

    if (state.reachedBottom) {
      state.reachedBottom = false;
      loseLife(state, ctx);
    }
    if (!state.over && state.invuln <= 0) {
      for (const invader of state.invaders) {
        if (!invader.alive) continue;
        if (collision.aabbOverlap(
          { x: invader.x - SPACE_INVADERS.invaderW / 2, y: invader.y - SPACE_INVADERS.invaderH / 2, w: SPACE_INVADERS.invaderW, h: SPACE_INVADERS.invaderH },
          { x: state.shipX - 20, y: SPACE_INVADERS.shipY - 11, w: 40, h: 22 },
        )) {
          loseLife(state, ctx);
          break;
        }
      }
    }
    if (!state.over && state.invaders.every((invader) => !invader.alive)) nextWave(state, ctx);
  },

  observe(state, playerId) {
    void playerId;
    let leftmost: number = SPACE_INVADERS.width;
    let rightmost = 0;
    let bottom = 0;
    let count = 0;
    for (const invader of state.invaders) {
      if (!invader.alive) continue;
      leftmost = Math.min(leftmost, invader.x);
      rightmost = Math.max(rightmost, invader.x);
      bottom = Math.max(bottom, invader.y);
      count++;
    }
    let threatY: number = SPACE_INVADERS.height;
    for (const enemyBullet of state.enemyBullets) {
      if (Math.abs(enemyBullet.x - state.shipX) < 40) threatY = Math.min(threatY, enemyBullet.y);
    }
    const shieldsAlive = state.shields.filter((shield) => shield.blocks.length > 0).length;
    const totalBlocks = SPACE_INVADERS.shields * 29;
    const remainingBlocks = state.shields.reduce((sum, shield) => sum + shield.blocks.length, 0);
    return new Float32Array([
      clamp((state.shipX / SPACE_INVADERS.width) * 2 - 1, -1, 1),
      state.bullet === null ? -1 : 1,
      clamp((leftmost / SPACE_INVADERS.width) * 2 - 1, -1, 1),
      clamp((rightmost / SPACE_INVADERS.width) * 2 - 1, -1, 1),
      clamp((bottom / SPACE_INVADERS.height) * 2 - 1, -1, 1),
      clamp((threatY / SPACE_INVADERS.height) * 2 - 1, -1, 1),
      clamp((count / (SPACE_INVADERS.rows * SPACE_INVADERS.cols)) * 2 - 1, -1, 1),
      clamp((shieldsAlive / SPACE_INVADERS.shields) * 2 - 1, -1, 1),
      clamp((remainingBlocks / totalBlocks) * 2 - 1, -1, 1),
      state.mystery === null ? -1 : clamp((state.mystery.x / SPACE_INVADERS.width) * 2 - 1, -1, 1),
    ]);
  },

  rules: singlePlayerRules<SpaceInvadersState>(
    (state) =>
      state.score + state.wave * 100 + state.lives * 30 + state.ticks / 600 - (state.over ? 150 : 0),
  ),
});
