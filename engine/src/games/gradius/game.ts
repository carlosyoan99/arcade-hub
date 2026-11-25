import type { StepContext } from '../../core/simulation.js';
import { clamp, dist2, normalize2 } from '../../core/math.js';
import { defineGame } from '../../game/contract.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import type { CollisionService } from '../../sim/collision.js';

/** Gradius — 7 sectores, medidor SPD/MSL/DBL/OPT/SHD y un jefe por sector. */
export const GRADIUS = {
  width: 880,
  height: 560,
  baseMove: 3.2,
  speedStep: 0.65,
  fireInterval: 0.09,
  startLives: 3,
  maxStage: 7,
  shipRadius: 10,
  slotCount: 5,
} as const;

interface Player {
  x: number;
  y: number;
  inv: number;
  speed: number;
  missile: boolean;
  double: boolean;
  options: number;
  shield: boolean;
  fireTimer: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  missile: boolean;
  fuse: number;
}

interface EnemyBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  ttl: number;
}

interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  type: 'ship' | 'diver' | 'pod';
  fires: boolean;
  fireTimer: number;
  seed: number;
}

interface Pickup {
  x: number;
  y: number;
}

interface CueEvent {
  at: number;
  type: 'ship' | 'diver' | 'pod' | 'formation';
  y: number;
  n: number;
  done: boolean;
}

interface Boss {
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  a: number;
  v: number;
  spins: number;
  aimed: number;
  timer: number;
  phase: number;
  spinDir: number;
}

export interface GradiusState {
  player: Player;
  bullets: Bullet[];
  enemyBullets: EnemyBullet[];
  enemies: Enemy[];
  pickups: Pickup[];
  boss: Boss | null;
  gauge: number;
  cue: CueEvent[];
  pattern: string;
  stageClock: number;
  introTimer: number;
  bossOutro: number;
  clearTimer: number;
  damageThisStage: boolean;
  score: number;
  lives: number;
  stage: number;
  over: boolean;
  won: boolean;
  paused: boolean;
  ticks: number;
  progress: number;
  seed: number;
}

const BOSS_PARAMS = [
  { hp: 26, a: 0.9, v: 2.4, spins: 1, aimed: 1 },
  { hp: 32, a: 0.85, v: 2.7, spins: 1, aimed: 2 },
  { hp: 38, a: 0.8, v: 3.0, spins: 2, aimed: 2 },
  { hp: 46, a: 0.75, v: 3.2, spins: 2, aimed: 3 },
  { hp: 54, a: 0.7, v: 3.4, spins: 3, aimed: 3 },
  { hp: 62, a: 0.65, v: 3.6, spins: 3, aimed: 4 },
  { hp: 80, a: 0.6, v: 3.9, spins: 4, aimed: 5 },
] as const;

function resetPower(state: GradiusState): void {
  state.player.speed = 0;
  state.player.missile = false;
  state.player.double = false;
  state.player.options = 0;
  state.player.shield = false;
  state.gauge = 0;
}

function activatePower(state: GradiusState, ctx: StepContext): void {
  const index = state.gauge;
  let available = false;
  if (index === 0) available = state.player.speed < 4;
  else if (index === 1) available = !state.player.missile;
  else if (index === 2) available = !state.player.double;
  else if (index === 3) available = state.player.options < 2;
  else available = !state.player.shield;
  if (!available) {
    state.gauge = 0;
    ctx.emit('hit', { kind: 'powerBlocked' });
    return;
  }
  if (index === 0) state.player.speed = Math.min(4, state.player.speed + 1);
  else if (index === 1) state.player.missile = true;
  else if (index === 2) state.player.double = true;
  else if (index === 3) state.player.options++;
  else state.player.shield = true;
  state.gauge = 0;
  ctx.emit('hit', { kind: 'power', slot: index });
  ctx.emit('score', { score: state.score, points: 100 });
  state.score += 100;
  state.progress += 100;
}

function buildCue(state: GradiusState, ctx: StepContext): void {
  state.cue = [];
  state.pattern = ctx.progression.nextPattern() ?? 'capsule';
  const steps = 5 + state.stage;
  let time = 1.2;
  for (let i = 0; i < steps; i++) {
    const y = ctx.rng.range(80, GRADIUS.height - 80);
    const roll = ctx.rng.next();
    const type: CueEvent['type'] =
      state.pattern === 'capsule'
        ? roll < 0.7 ? 'pod' : 'ship'
        : state.pattern === 'wall'
          ? roll < 0.7 ? 'formation' : 'ship'
          : roll < 0.6 ? 'diver' : 'ship';
    const count = type === 'diver' && state.stage >= 4 ? 2 : 1;
    state.cue.push({ at: time, type, y, n: count, done: false });
    time += ctx.rng.range(1.1, 1.7);
  }
  ctx.emit('hit', { kind: 'cue', pattern: state.pattern });
}

function spawnEvent(state: GradiusState, ctx: StepContext, event: CueEvent): void {
  if (event.type === 'formation') {
    const count = 3 + Math.floor(state.stage / 2);
    for (let i = 0; i < count; i++) {
      state.enemies.push(makeEnemy(state, 'ship', GRADIUS.width + 40 + i * 34, event.y, -1.2 - (state.stage - 1) * 0.15));
    }
  } else if (event.type === 'diver') {
    for (let i = 0; i < event.n; i++) {
      state.enemies.push(makeEnemy(state, 'diver', GRADIUS.width + 40 + i * 60, event.y, -2.6 - (state.stage - 1) * 0.2));
    }
  } else if (event.type === 'pod') {
    state.enemies.push(makeEnemy(state, 'pod', GRADIUS.width + 40, event.y, -1.6 - (state.stage - 1) * 0.12));
  } else {
    state.enemies.push(makeEnemy(state, 'ship', GRADIUS.width + 40, event.y, -1.2 - (state.stage - 1) * 0.15));
  }
  ctx.emit('hit', { kind: 'spawn', type: event.type });
}

function makeEnemy(state: GradiusState, type: Enemy['type'], x: number, y: number, vx: number): Enemy {
  return {
    x,
    y,
    vx,
    vy: 0,
    r: type === 'diver' ? 15 : type === 'pod' ? 10 : 14,
    hp: type === 'diver' ? 2 + Math.floor(state.stage / 3) : 1,
    type,
    fires: type !== 'pod',
    fireTimer: 2,
    seed: ctxSeed(state),
  };
}

function ctxSeed(state: GradiusState): number {
  return (state.stage * 97 + state.ticks * 31) % 1000 / 100;
}

function spawnBoss(state: GradiusState, ctx: StepContext): void {
  const params = BOSS_PARAMS[Math.min(state.stage, GRADIUS.maxStage) - 1] ?? BOSS_PARAMS[0];
  state.boss = {
    x: GRADIUS.width - 150,
    y: GRADIUS.height / 2,
    r: 26,
    hp: params.hp,
    maxHp: params.hp,
    a: params.a,
    v: params.v,
    spins: params.spins,
    aimed: params.aimed,
    timer: 1.5,
    phase: 0,
    spinDir: 1,
  };
  ctx.emit('levelUp', { kind: 'boss', stage: state.stage });
}

function bossFan(state: GradiusState, dir: number, speed: number, count: number, offset: number): void {
  const boss = state.boss;
  if (!boss) return;
  for (let i = 0; i < count; i++) {
    const angle = dir + (i - (count - 1) / 2) * 0.16 + offset;
    state.enemyBullets.push({
      x: boss.x,
      y: boss.y,
      vx: Math.cos(angle) * speed * 60,
      vy: Math.sin(angle) * speed * 60,
      r: 5,
      ttl: 10,
    });
  }
}

function bossAimed(state: GradiusState, speed: number, count: number): void {
  const boss = state.boss;
  if (!boss) return;
  const base = Math.atan2(state.player.y - boss.y, state.player.x - boss.x);
  for (let i = 0; i < count; i++) {
    const angle = base + (i - (count - 1) / 2) * 0.14;
    state.enemyBullets.push({
      x: boss.x,
      y: boss.y,
      vx: Math.cos(angle) * speed * 60,
      vy: Math.sin(angle) * speed * 60,
      r: 5,
      ttl: 10,
    });
  }
}

function goPlay(state: GradiusState, ctx: StepContext): void {
  state.introTimer = 1.6;
  state.stageClock = 0;
  state.damageThisStage = false;
  state.player.x = 130;
  state.player.y = GRADIUS.height / 2;
  state.player.inv = 2;
  state.boss = null;
  state.bossOutro = 0;
  state.clearTimer = 0;
  state.enemies = [];
  state.bullets = [];
  state.enemyBullets = [];
  state.pickups = [];
  buildCue(state, ctx);
}

function nextStage(state: GradiusState, ctx: StepContext): void {
  state.score += 1000 + state.stage * 500;
  state.progress += 1000;
  ctx.emit('score', { score: state.score, points: 1000 + state.stage * 500 });
  if (state.stage >= GRADIUS.maxStage) {
    state.over = true;
    state.won = true;
    ctx.emit('gameOver', { score: state.score, won: true });
    return;
  }
  state.stage++;
  goPlay(state, ctx);
  ctx.emit('levelUp', { stage: state.stage });
}

function reset(state: GradiusState, ctx: StepContext): void {
  state.score = 0;
  state.lives = GRADIUS.startLives;
  state.stage = 1;
  state.over = false;
  state.won = false;
  state.paused = false;
  state.ticks = 0;
  state.progress = 0;
  state.player.x = 130;
  state.player.y = GRADIUS.height / 2;
  state.player.inv = 0;
  state.player.fireTimer = 0;
  resetPower(state);
  goPlay(state, ctx);
}

function playerHit(state: GradiusState, ctx: StepContext): void {
  if (state.player.inv > 0) return;
  state.damageThisStage = true;
  if (state.player.shield) {
    state.player.shield = false;
    state.player.inv = 1.2;
    ctx.emit('hit', { kind: 'shield' });
    return;
  }
  state.player.inv = 2;
  state.lives--;
  ctx.emit('explode', { x: state.player.x, y: state.player.y, kind: 'ship' });
  ctx.progression.observe(-0.8);
  resetPower(state);
  if (state.lives <= 0) {
    state.over = true;
    ctx.emit('gameOver', { score: state.score });
    return;
  }
  state.player.x = 130;
  state.player.y = GRADIUS.height / 2;
}

function killEnemy(state: GradiusState, ctx: StepContext, enemy: Enemy): void {
  const points = enemy.type === 'diver' ? 250 : enemy.type === 'pod' ? 150 : 100;
  state.score += points;
  state.progress += points;
  ctx.emit('explode', { x: enemy.x, y: enemy.y, points });
  ctx.emit('score', { score: state.score, points });
  ctx.progression.observe(0.4);
  if (ctx.rng.next() < 0.16 + ctx.progression.state.hazard * 0.1) {
    state.pickups.push({ x: enemy.x, y: enemy.y });
  }
}

export const gradiusGame = defineGame<GradiusState>({
  id: 'gradius',
  meta: { title: 'Gradius', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['left', 'right', 'up', 'down', 'fire', 'power', 'pause', 'restart'],
  progression: {
    id: 'gradius',
    levels: [
      { speed: 1, spawnInterval: 110, hazard: 0, label: 'Sector 1' },
      { speed: 1.1, spawnInterval: 92, hazard: 0.2, label: 'Sector 2' },
      { speed: 1.22, spawnInterval: 75, hazard: 0.4, label: 'Sector 3' },
    ],
    pointsPerLevel: 3000,
    dda: { enabled: true, window: 420, maxAdjust: 0.08 },
    patterns: ['capsule', 'wall', 'boss'],
    avoidRepeat: 2,
  },

  init(seed, ctx) {
    const state: GradiusState = {
      player: {
        x: 130,
        y: GRADIUS.height / 2,
        inv: 0,
        speed: 0,
        missile: false,
        double: false,
        options: 0,
        shield: false,
        fireTimer: 0,
      },
      bullets: [],
      enemyBullets: [],
      enemies: [],
      pickups: [],
      boss: null,
      gauge: 0,
      cue: [],
      pattern: 'capsule',
      stageClock: 0,
      introTimer: 0,
      bossOutro: 0,
      clearTimer: 0,
      damageThisStage: false,
      score: 0,
      lives: GRADIUS.startLives,
      stage: 1,
      over: false,
      won: false,
      paused: false,
      ticks: 0,
      progress: 0,
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
    const player = state.player;
    state.ticks++;
    player.fireTimer -= dt;

    if (state.introTimer > 0) {
      state.introTimer -= dt;
      if (state.introTimer <= 0) player.inv = 0;
    }
    // B6: todos los timers de fase viven en el estado.
    state.stageClock += dt;
    for (const event of state.cue) {
      if (!event.done && state.stageClock >= event.at) {
        event.done = true;
        spawnEvent(state, ctx, event);
      }
    }
    if (state.bossOutro > 0) {
      state.bossOutro -= dt;
      if (state.bossOutro <= 0) state.clearTimer = 1.4;
    }
    if (state.clearTimer > 0) {
      state.clearTimer -= dt;
      if (state.clearTimer <= 0) {
        nextStage(state, ctx);
        if (state.over) return;
      }
    }
    if (state.boss === null && state.bossOutro <= 0 && state.clearTimer <= 0 &&
        state.cue.every((event) => event.done) && state.enemies.length === 0) {
      spawnBoss(state, ctx);
    }

    if (ctx.actions.consume('power')) activatePower(state, ctx);

    let kx = (ctx.actions.isDown('right') ? 1 : 0) - (ctx.actions.isDown('left') ? 1 : 0);
    let ky = (ctx.actions.isDown('down') ? 1 : 0) - (ctx.actions.isDown('up') ? 1 : 0);
    if (kx !== 0 || ky !== 0) {
      const direction = normalize2(kx, ky);
      kx = direction.x;
      ky = direction.y;
    }
    const move = (GRADIUS.baseMove + player.speed * GRADIUS.speedStep) * 60 * dt;
    player.x = clamp(player.x + kx * move, 16, GRADIUS.width - 16);
    player.y = clamp(player.y + ky * move, 16, GRADIUS.height - 16);
    player.inv = Math.max(0, player.inv - dt);

    if (player.fireTimer <= 0) {
      player.fireTimer = GRADIUS.fireInterval;
      const nose = player.x + 16;
      state.bullets.push({ x: nose, y: player.y - 5, vx: 660, vy: 0, r: 4, missile: false, fuse: 0 });
      state.bullets.push({ x: nose, y: player.y + 5, vx: 660, vy: 0, r: 4, missile: false, fuse: 0 });
      if (player.double) {
        state.bullets.push({ x: nose, y: player.y - 8, vx: 570, vy: -156, r: 4, missile: false, fuse: 0 });
        state.bullets.push({ x: nose, y: player.y + 8, vx: 570, vy: 156, r: 4, missile: false, fuse: 0 });
      }
      if (player.missile) {
        for (const offset of [-16, 16]) {
          state.bullets.push({
            x: player.x + 4,
            y: player.y + offset,
            vx: 312,
            vy: -84,
            r: 6,
            missile: true,
            fuse: 0,
          });
        }
      }
      for (let i = 1; i <= player.options; i++) {
        const optionY = player.y + 16 * i;
        state.bullets.push({ x: player.x - 14 * i + 16, y: optionY, vx: 660, vy: 0, r: 3, missile: false, fuse: 0 });
        state.bullets.push({ x: player.x - 14 * i + 16, y: optionY - 10, vx: 660, vy: 0, r: 3, missile: false, fuse: 0 });
      }
      ctx.emit('shoot', { x: player.x, y: player.y, options: player.options });
    }

    for (const enemy of state.enemies) {
      if (enemy.type === 'diver') {
        enemy.seed += 0.06;
        enemy.x += enemy.vx * (0.8 + Math.sin(enemy.seed) * 6 * dt) * speed;
        enemy.y += Math.sin(enemy.seed * 1.7) * 40 * dt;
      } else {
        enemy.x += enemy.vx * speed * dt * 60;
      }
      enemy.fireTimer -= dt * (1 + progress.hazard);
      if (enemy.fires && enemy.fireTimer <= 0 && enemy.x > 60 && enemy.x < GRADIUS.width - 60) {
        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        const bulletSpeed = (enemy.type === 'diver' ? 4.6 : 3.6) * 60;
        state.enemyBullets.push({
          x: enemy.x - 14,
          y: enemy.y,
          vx: Math.cos(angle) * bulletSpeed,
          vy: Math.sin(angle) * bulletSpeed,
          r: 4,
          ttl: 8,
        });
        enemy.fireTimer = enemy.type === 'diver' ? 2.2 : 2.6;
        ctx.emit('shoot', { x: enemy.x, y: enemy.y, hostile: true });
      }
    }
    state.enemies = state.enemies.filter((enemy) => enemy.x > -80);

    if (state.boss !== null) {
      const boss = state.boss;
      // B7: movimiento del jefe con reloj de simulación.
      const time = ctx.clock.time;
      boss.y = GRADIUS.height / 2 + Math.sin(time * 1.3) * (GRADIUS.height * 0.3);
      boss.x = GRADIUS.width - 150 + Math.sin(time * 0.9) * 28;
      boss.timer -= dt * speed;
      if (boss.timer <= 0) {
        boss.phase++;
        boss.spinDir = -boss.spinDir;
        const offset = boss.phase * 0.28;
        for (let spin = 0; spin < boss.spins; spin++) {
          bossFan(state, boss.spinDir * spin * 0.5, boss.v, 7, offset);
        }
        bossAimed(state, boss.v * 1.5, Math.min(boss.aimed, 5));
        boss.timer = boss.a;
        ctx.emit('shoot', { x: boss.x, y: boss.y, hostile: true });
      }
    }

    for (const bullet of state.bullets) {
      if (bullet.missile) {
        bullet.fuse += dt;
        if (bullet.fuse > 0.8) bullet.vy += 7.2 * dt;
      }
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
    }
    state.bullets = state.bullets.filter((bullet) =>
      bullet.x < GRADIUS.width + 30 && bullet.y > -30 && bullet.y < GRADIUS.height + 30);

    for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
      const bullet = state.bullets[bi];
      if (!bullet) continue;
      let hit = false;
      const boss = state.boss;
      if (boss && collision.circleAabb(
        { x: bullet.x, y: bullet.y, r: bullet.r },
        { x: boss.x - boss.r - 6, y: boss.y - boss.r - 6, w: (boss.r + 6) * 2, h: (boss.r + 6) * 2 },
      )) {
        boss.hp -= bullet.missile ? 3 : 1;
        hit = true;
        ctx.emit('hit', { x: boss.x, y: boss.y, hp: boss.hp });
        if (boss.hp <= 0) {
          state.score += 5000 + state.stage * 500;
          state.progress += 5000;
          ctx.emit('explode', { x: boss.x, y: boss.y, points: 5000 });
          ctx.emit('score', { score: state.score, points: 5000 });
          state.boss = null;
          state.bossOutro = 1.1;
        }
      }
      if (!hit) {
        for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
          const enemy = state.enemies[ei];
          if (!enemy) continue;
          if (!collision.circleAabb(
            { x: bullet.x, y: bullet.y, r: bullet.r },
            { x: enemy.x - enemy.r, y: enemy.y - enemy.r, w: enemy.r * 2, h: enemy.r * 2 },
          )) continue;
          enemy.hp -= bullet.missile ? 3 : 1;
          hit = true;
          ctx.emit('hit', { x: enemy.x, y: enemy.y });
          if (enemy.hp <= 0) {
            state.enemies.splice(ei, 1);
            killEnemy(state, ctx, enemy);
          }
          break;
        }
      }
      if (hit) state.bullets.splice(bi, 1);
    }

    for (const enemyBullet of state.enemyBullets) {
      enemyBullet.x += enemyBullet.vx * dt;
      enemyBullet.y += enemyBullet.vy * dt;
      enemyBullet.ttl -= dt;
      if (player.inv <= 0 && collision.circleAabb(
        { x: enemyBullet.x, y: enemyBullet.y, r: enemyBullet.r },
        { x: player.x - GRADIUS.shipRadius, y: player.y - GRADIUS.shipRadius, w: GRADIUS.shipRadius * 2, h: GRADIUS.shipRadius * 2 },
      )) {
        enemyBullet.ttl = 0;
        playerHit(state, ctx);
      }
    }
    state.enemyBullets = state.enemyBullets.filter((enemyBullet) =>
      enemyBullet.ttl > 0 && enemyBullet.x > -40 && enemyBullet.x < GRADIUS.width + 40 &&
      enemyBullet.y > -40 && enemyBullet.y < GRADIUS.height + 40);

    for (const pickup of state.pickups) pickup.x -= 96 * dt;
    state.pickups = state.pickups.filter((pickup) => pickup.x > -30);
    for (let pi = state.pickups.length - 1; pi >= 0; pi--) {
      const pickup = state.pickups[pi];
      if (!pickup) continue;
      if (dist2(pickup.x, pickup.y, player.x, player.y) > 14 * 14) continue;
      state.pickups.splice(pi, 1);
      state.gauge = (state.gauge + 1) % GRADIUS.slotCount;
      ctx.emit('hit', { kind: 'capsule', gauge: state.gauge });
    }

    if (player.inv <= 0) {
      for (const enemy of state.enemies) {
        if (dist2(enemy.x, enemy.y, player.x, player.y) <= (enemy.r + GRADIUS.shipRadius) ** 2) {
          playerHit(state, ctx);
          break;
        }
      }
    }
    if (state.over) return;
    ctx.progression.observe(state.damageThisStage ? -0.2 : 0.2);
  },

  observe(state, playerId) {
    void playerId;
    let nearestX = 0;
    let nearestY = 0;
    let best = Number.POSITIVE_INFINITY;
    for (const enemy of state.enemies) {
      const distance = dist2(enemy.x, enemy.y, state.player.x, state.player.y);
      if (distance < best) {
        best = distance;
        nearestX = enemy.x;
        nearestY = enemy.y;
      }
    }
    return new Float32Array([
      clamp((state.player.x / GRADIUS.width) * 2 - 1, -1, 1),
      clamp((state.player.y / GRADIUS.height) * 2 - 1, -1, 1),
      clamp((nearestX - state.player.x) / GRADIUS.width, -1, 1),
      clamp((nearestY - state.player.y) / GRADIUS.height, -1, 1),
      clamp((state.gauge / GRADIUS.slotCount) * 2 - 1, -1, 1),
      clamp((state.bullets.length / 12) * 2 - 1, -1, 1),
      state.boss === null ? -1 : clamp((state.boss.hp / state.boss.maxHp) * 2 - 1, -1, 1),
      state.player.shield ? 1 : -1,
      clamp((state.lives / GRADIUS.startLives) * 2 - 1, -1, 1),
    ]);
  },

  rules: singlePlayerRules<GradiusState>(
    (state) =>
      state.score + state.stage * 150 + state.lives * 25 + state.ticks / 600 - (state.over ? 150 : 0),
  ),
});
