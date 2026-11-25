import { approach, clamp, dist2, normalize2 } from '../../core/math.js';
import type { StepContext } from '../../core/simulation.js';
import { defineGame } from '../../game/contract.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import { COLLISION_SERVICE, type CollisionService } from '../../sim/collision.js';

export const JOUST = {
  width: 480,
  height: 540,
  playerW: 32,
  playerH: 36,
  accel: 600,
  maxSpeed: 200,
  friction: 0.92,
  flapVelocity: -280,
  gravity: 900,
  flapCooldown: 0.15,
  lavaStart: 500,
  lavaMin: 380,
  lavaRise: 1.5,
  eggHatchSeconds: 5,
  maxEnemies: 8,
  platforms: [
    { x: 0, y: 470, w: 480, h: 12 },
    { x: 40, y: 360, w: 160, h: 10 },
    { x: 280, y: 360, w: 160, h: 10 },
    { x: 140, y: 260, w: 200, h: 10 },
    { x: 20, y: 170, w: 130, h: 10 },
    { x: 330, y: 170, w: 130, h: 10 },
    { x: 180, y: 80, w: 120, h: 10 },
  ] as const,
  enemyPoints: {
    bounder: 500,
    hunter: 750,
    vulture: 600,
    'shadow-lord': 1500,
    pterodactyl: 1000,
  } as const,
} as const;

export type JoustEnemyType = keyof typeof JOUST.enemyPoints;
type DivePhase = 'fly' | 'dive' | 'climb';

export interface JoustRider {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: JoustEnemyType;
  flapTimer: number;
  flapInterval: number;
  divePhase: DivePhase | null;
  diveTimer: number;
  diveTarget: { x: number; y: number } | null;
}

export interface JoustEgg {
  x: number;
  y: number;
  vx: number;
  vy: number;
  timer: number;
}

export interface JoustPlayer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  facing: number;
  flapCooldown: number;
  invincible: number;
}

export interface JoustState {
  player: JoustPlayer;
  enemies: JoustRider[];
  eggs: JoustEgg[];
  lavaY: number;
  wave: number;
  lives: number;
  score: number;
  remaining: number;
  spawned: number;
  over: boolean;
  paused: boolean;
  generation: number;
  ticks: number;
  spawnTimer: number;
  waveTimer: number;
  waveActive: boolean;
  combo: number;
  pattern: string;
}

function makeRider(state: JoustState, ctx: StepContext, type?: JoustEnemyType): JoustRider {
  const roll = ctx.rng.next();
  const enemyType: JoustEnemyType =
    type ??
    (state.wave >= 5 && roll > 0.85
      ? 'pterodactyl'
      : state.wave >= 3 && roll > 0.7
        ? 'shadow-lord'
        : state.wave >= 2 && roll > 0.5
          ? 'vulture'
          : state.wave >= 2 && roll > 0.35
            ? 'hunter'
            : 'bounder');
  const side = ctx.rng.next() > 0.5 ? 0 : JOUST.width;
  const platform = JOUST.platforms[ctx.rng.int(JOUST.platforms.length)]!;
  const isPtero = enemyType === 'pterodactyl';
  const isVulture = enemyType === 'vulture';
  const speed = isPtero
    ? 180 + state.wave * 12
    : isVulture
      ? 100 + state.wave * 8
      : 60 + state.wave * 10 + ctx.rng.range(0, 30);
  return {
    x: side,
    y: isPtero ? 40 + ctx.rng.range(0, 60) : platform.y - 30,
    vx: (side === 0 ? 1 : -1) * speed,
    vy: isPtero ? 20 : -100 - ctx.rng.range(0, 100),
    type: enemyType,
    flapTimer: 0,
    flapInterval: isPtero ? 0.2 : isVulture ? 0.3 : Math.max(0.1, 0.4 + ctx.rng.range(0, 0.3) - state.wave * 0.01),
    divePhase: null,
    diveTimer: 0,
    diveTarget: null,
  };
}

function startWave(state: JoustState, ctx: StepContext): void {
  state.waveActive = true;
  state.combo = 0;
  state.remaining = Math.min(3 + state.wave, JOUST.maxEnemies);
  state.spawned = 0;
  state.spawnTimer = 0;
  state.pattern = ctx.progression.nextPattern() ?? 'swarm';
  if (state.pattern === 'egg') {
    state.eggs.push({
      x: JOUST.width / 2,
      y: 120,
      vx: ctx.rng.range(-40, 40),
      vy: -100,
      timer: JOUST.eggHatchSeconds,
    });
  }
  ctx.emit('waveStart', { wave: state.wave, pattern: state.pattern });
}

function initialState(ctx: StepContext): JoustState {
  const state: JoustState = {
    player: {
      x: JOUST.width / 2 - JOUST.playerW / 2,
      y: 300,
      vx: 0,
      vy: 0,
      onGround: false,
      facing: 1,
      flapCooldown: 0,
      invincible: 0,
    },
    enemies: [],
    eggs: [],
    lavaY: JOUST.lavaStart,
    wave: 1,
    lives: 3,
    score: 0,
    remaining: 0,
    spawned: 0,
    over: false,
    paused: false,
    generation: 0,
    ticks: 0,
    spawnTimer: 0,
    waveTimer: 0,
    waveActive: false,
    combo: 0,
    pattern: ctx.progression.nextPattern() ?? 'swarm',
  };
  startWave(state, ctx);
  return state;
}

function loseLife(state: JoustState, ctx: StepContext): void {
  if (state.player.invincible > 0 || state.over) return;
  state.lives--;
  state.combo = 0;
  ctx.emit('hit', { lives: state.lives });
  ctx.progression.observe(-0.8);
  if (state.lives <= 0) {
    state.over = true;
    ctx.emit('gameOver', { score: state.score, wave: state.wave });
    return;
  }
  state.player.y = 200;
  state.player.vy = -100;
  state.player.invincible = 1.5;
}

function landOnPlatform(x: number, prevBottom: number, bottom: number, width: number): number | null {
  if (bottom < prevBottom) return null;
  for (const platform of JOUST.platforms) {
    if (
      prevBottom <= platform.y + 2 &&
      bottom >= platform.y &&
      x + width > platform.x &&
      x < platform.x + platform.w
    ) {
      return platform.y;
    }
  }
  return null;
}

/** IA de cada enemigo del original; el vaivén del buitre usa el reloj de simulación (B7). */
function updateEnemy(state: JoustState, ctx: StepContext, enemy: JoustRider, dt: number, speed: number, hazard: number): void {
  enemy.flapTimer -= dt;
  if (enemy.flapTimer <= 0) {
    const flap: Record<JoustEnemyType, [number, number]> = {
      pterodactyl: [-280, 60],
      'shadow-lord': [-320, 80],
      vulture: [-260, 70],
      hunter: [-250, 60],
      bounder: [-200, 50],
    };
    const [base, spread] = flap[enemy.type];
    enemy.vy = enemy.divePhase === 'dive' ? 300 : base - ctx.rng.range(0, spread);
    enemy.flapTimer = enemy.flapInterval + ctx.rng.range(0, 0.2);
  }
  if (enemy.type === 'pterodactyl') {
    enemy.diveTimer -= dt;
    if (enemy.divePhase === null || enemy.divePhase === 'fly') {
      if (
        Math.abs(enemy.x - state.player.x) < 100 &&
        enemy.y < state.player.y - 40 &&
        ctx.rng.next() < 0.03
      ) {
        enemy.divePhase = 'dive';
        enemy.diveTimer = 0.8;
        enemy.diveTarget = { x: state.player.x, y: state.player.y };
      }
      if (enemy.y > 100) enemy.vy = -200;
      else if (enemy.y < 30) enemy.vy = 50;
    } else if (enemy.divePhase === 'dive') {
      const target = enemy.diveTarget ?? state.player;
      const direction = normalize2(target.x - enemy.x, target.y - enemy.y);
      enemy.vx = direction.x * 250;
      enemy.vy = direction.y * 250;
      if (enemy.diveTimer <= 0) {
        enemy.divePhase = 'climb';
        enemy.diveTimer = 1;
      }
    } else if (enemy.divePhase === 'climb') {
      enemy.vy = -300;
      if (enemy.diveTimer <= 0) {
        enemy.divePhase = 'fly';
        enemy.diveTimer = 2 + ctx.rng.range(0, 2);
      }
    }
  } else if (enemy.type === 'shadow-lord') {
    const dx = state.player.x - enemy.x;
    if (Math.abs(dx) > 20) enemy.vx += Math.sign(dx) * 200 * dt;
    if (state.player.y - enemy.y < -50) enemy.vy = -350;
    enemy.vx = clamp(enemy.vx, -(100 + state.wave * 5), 100 + state.wave * 5);
  } else if (enemy.type === 'hunter') {
    const dx = state.player.x - enemy.x;
    if (Math.abs(dx) > 30) enemy.vx += Math.sign(dx) * 150 * dt;
    enemy.vx = clamp(enemy.vx, -(70 + state.wave * 4), 70 + state.wave * 4);
  } else if (enemy.type === 'vulture') {
    // B7: antes se usaba el reloj real; ahora el tiempo de simulación determinista.
    enemy.vx += Math.sin(ctx.clock.time / 0.3 + enemy.x * 0.1) * 120 * dt;
    if (ctx.rng.next() < 0.02) enemy.vx = -enemy.vx;
    enemy.vx = clamp(enemy.vx, -(80 + state.wave * 5), 80 + state.wave * 5);
  } else {
    if (ctx.rng.next() < 0.01) enemy.vx = -enemy.vx;
    enemy.vx = clamp(enemy.vx, -(60 + state.wave * 5), 60 + state.wave * 5);
  }
  enemy.vx = approach(enemy.vx, clamp(enemy.vx, -220 * speed, 220 * speed), 10 * speed);
  enemy.vy = Math.min(500, enemy.vy + JOUST.gravity * dt + (enemy.divePhase === 'dive' ? 0 : hazard * 20 * dt));
  const prevBottom = enemy.y + JOUST.playerH;
  enemy.x = clamp(enemy.x + enemy.vx * dt, 0, JOUST.width - JOUST.playerW);
  enemy.y += enemy.vy * dt;
  const landing = landOnPlatform(enemy.x, prevBottom, enemy.y + JOUST.playerH, JOUST.playerW);
  if (landing !== null && enemy.vy >= 0) {
    enemy.y = landing - JOUST.playerH;
    enemy.vy = -180;
  }
}

export const joustGame = defineGame<JoustState>({
  id: 'joust',
  meta: { title: 'Joust', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['left', 'right', 'flap', 'restart', 'pause'],
  progression: {
    id: 'joust',
    levels: [
      { speed: 1, spawnInterval: 90, hazard: 0, label: 'Nivel 1' },
      { speed: 1.12, spawnInterval: 78, hazard: 0.2, label: 'Nivel 2' },
      { speed: 1.25, spawnInterval: 66, hazard: 0.4, label: 'Nivel 3' },
    ],
    pointsPerLevel: 1,
    dda: { enabled: true, window: 300, maxAdjust: 0.08 },
    patterns: ['egg', 'dive', 'swarm'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    return initialState(ctx);
  },

  step(state, ctx) {
    const generation = state.generation;
    if (
      handleLifecycle(state, ctx, state.wave, () => {
        Object.assign(state, initialState(ctx));
        state.generation = generation + 1;
      })
    ) {
      return;
    }
    if (state.generation !== generation) return;
    const collision = ctx.services.get<CollisionService>(COLLISION_SERVICE);
    const dt = ctx.clock.dt;
    const progress = ctx.progression.state;

    if (state.waveActive) {
      if (state.spawned < state.remaining) {
        state.spawnTimer++;
        if (state.spawnTimer >= (progress.spawnInterval ?? 90)) {
          state.spawnTimer = 0;
          const count =
            state.pattern === 'swarm' && state.spawned < state.remaining - 1
              ? Math.min(2, state.remaining - state.spawned)
              : 1;
          for (let i = 0; i < count; i++) {
            state.enemies.push(makeRider(state, ctx));
            state.spawned++;
          }
          ctx.emit('enemySpawn', { count, wave: state.wave });
        }
      }
    } else {
      state.waveTimer--;
      if (state.waveTimer <= 0) {
        state.wave++;
        state.waveTimer = 60;
        state.lavaY = JOUST.lavaStart;
        if (state.wave % 3 === 0 && state.lives < 5) state.lives++;
        state.score += 100 * state.wave;
        ctx.emit('levelUp', { wave: state.wave });
        ctx.schedule(3, () => {
          if (state.generation === generation && !state.paused && !state.over) {
            ctx.emit('fanfare', { wave: state.wave });
          }
        });
        startWave(state, ctx);
      }
    }

    const player = state.player;
    if (ctx.actions.isDown('left')) {
      player.vx -= JOUST.accel * dt;
      player.facing = -1;
    }
    if (ctx.actions.isDown('right')) {
      player.vx += JOUST.accel * dt;
      player.facing = 1;
    }
    if (!ctx.actions.isDown('left') && !ctx.actions.isDown('right')) {
      player.vx *= Math.pow(JOUST.friction, dt * 60);
    }
    player.vx = clamp(player.vx, -JOUST.maxSpeed, JOUST.maxSpeed);
    if (ctx.actions.consume('flap') && player.flapCooldown <= 0) {
      player.vy = JOUST.flapVelocity;
      player.flapCooldown = JOUST.flapCooldown;
      player.onGround = false;
      ctx.emit('flap', { x: player.x, y: player.y });
    }
    if (player.flapCooldown > 0) player.flapCooldown -= dt;
    if (player.invincible > 0) player.invincible -= dt;
    player.vy = Math.min(600, player.vy + JOUST.gravity * dt);
    const prevBottom = player.y + JOUST.playerH;
    player.x = clamp(player.x + player.vx * dt, 0, JOUST.width - JOUST.playerW);
    player.y += player.vy * dt;
    const landing = landOnPlatform(player.x, prevBottom, player.y + JOUST.playerH, JOUST.playerW);
    if (landing !== null && player.vy >= 0) {
      player.y = landing - JOUST.playerH;
      player.vy = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }
    if (player.y + JOUST.playerH > state.lavaY) loseLife(state, ctx);
    if (state.lavaY > JOUST.lavaMin) state.lavaY -= JOUST.lavaRise * dt;

    const playerRect = { x: player.x, y: player.y, w: JOUST.playerW, h: JOUST.playerH };
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const enemy = state.enemies[i]!;
      updateEnemy(state, ctx, enemy, dt, progress.speed, progress.hazard);
      if (enemy.y > state.lavaY + 30) {
        state.enemies.splice(i, 1);
        state.remaining = Math.max(0, state.remaining - 1);
        ctx.emit('explode', { x: enemy.x, y: enemy.y });
        continue;
      }
      const enemyRect = { x: enemy.x, y: enemy.y, w: JOUST.playerW, h: JOUST.playerH };
      if (!collision.aabbOverlap(playerRect, enemyRect)) continue;
      const playerCenter = player.y + JOUST.playerH / 2;
      const enemyCenter = enemy.y + JOUST.playerH / 2;
      if (playerCenter < enemyCenter - 6) {
        const points = JOUST.enemyPoints[enemy.type];
        state.score += points;
        state.combo++;
        state.remaining = Math.max(0, state.remaining - 1);
        state.eggs.push({
          x: enemy.x + JOUST.playerW / 2,
          y: enemy.y,
          vx: ctx.rng.range(-40, 40),
          vy: -150,
          timer: JOUST.eggHatchSeconds,
        });
        state.enemies.splice(i, 1);
        player.vy = -150;
        ctx.emit('joust', { points, type: enemy.type });
        ctx.progression.observe(0.8);
      } else {
        loseLife(state, ctx);
      }
    }

    for (let i = state.eggs.length - 1; i >= 0; i--) {
      const egg = state.eggs[i]!;
      egg.vy = Math.min(500, egg.vy + JOUST.gravity * dt);
      const prevEggBottom = egg.y + 10;
      egg.x = clamp(egg.x + egg.vx * dt, 0, JOUST.width);
      egg.y += egg.vy * dt;
      if (egg.x <= 0 || egg.x >= JOUST.width) egg.vx = -egg.vx;
      const platformY = landOnPlatform(egg.x - 8, prevEggBottom, egg.y + 10, 16);
      if (platformY !== null && egg.vy > 0) {
        egg.y = platformY - 10;
        egg.vy = -egg.vy * 0.5;
        if (Math.abs(egg.vy) < 20) egg.vy = 0;
      }
      if (egg.y > state.lavaY) egg.vy = Math.min(egg.vy, -180);
      if (egg.y > state.lavaY + 40) {
        state.eggs.splice(i, 1);
        continue;
      }
      egg.timer -= dt;
      if (egg.timer <= 0) {
        state.enemies.push(makeRider(state, ctx));
        state.eggs.splice(i, 1);
        ctx.emit('hatch', { x: egg.x, y: egg.y });
        continue;
      }
      const eggRect = { x: egg.x - 8, y: egg.y - 10, w: 16, h: 20 };
      if (collision.aabbOverlap(playerRect, eggRect)) {
        const bonus = Math.min(state.combo, 4) * 250;
        state.score += bonus;
        state.combo++;
        ctx.emit('egg', { points: bonus });
        ctx.progression.observe(0.5);
        state.eggs.splice(i, 1);
      }
    }

    if (state.waveActive && state.spawned >= state.remaining && state.enemies.length === 0 && state.eggs.length === 0) {
      state.waveActive = false;
      ctx.emit('waveClear', { wave: state.wave });
      ctx.progression.observe(1);
    }
    state.ticks++;
  },

  observe(state) {
    const player = state.player;
    const nearest = state.enemies.reduce<JoustRider | null>(
      (best, enemy) => (best === null || dist2(enemy.x, enemy.y, player.x, player.y) < dist2(best.x, best.y, player.x, player.y) ? enemy : best),
      null,
    );
    return new Float32Array([
      (player.x / JOUST.width) * 2 - 1,
      (player.y / JOUST.height) * 2 - 1,
      player.vx / JOUST.maxSpeed,
      player.vy / 600,
      player.onGround ? 1 : -1,
      player.facing,
      nearest ? ((nearest.x - player.x) / JOUST.width) * 2 - 1 : 1,
      nearest ? ((nearest.y - player.y) / JOUST.height) * 2 - 1 : 0,
      Math.min(1, state.enemies.length / JOUST.maxEnemies),
      Math.min(1, state.eggs.length / 8),
      (state.lavaY / JOUST.height) * 2 - 1,
      Math.min(1, state.wave / 10),
      (state.lives / 5) * 2 - 1,
      player.invincible > 0 ? 1 : -1,
      state.over ? 1 : -1,
    ]);
  },

  rules: singlePlayerRules<JoustState>((state) =>
    state.score + state.wave * 500 + state.lives * 100 - (state.over ? 1000 : 0),
  ),
});
