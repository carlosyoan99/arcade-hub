import type { StepContext } from '../../core/simulation.js';
import { clamp, dist2, lerp, normalize2 } from '../../core/math.js';
import { defineGame } from '../../game/contract.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import type { CollisionService } from '../../sim/collision.js';

/** Raiden — shmup vertical: 5 armas, 7 sectores, patrones de jefe y bombas expansivas. */
export const RAIDEN = {
  width: 720,
  height: 640,
  playWidth: 480,
  playLeft: 120,
  playRight: 600,
  moveSpeed: 312,
  bulletSpeed: 780,
  enemyBulletSpeed: 390,
  fireInterval: 0.13,
  startLives: 3,
  startBombs: 3,
  maxStage: 7,
  bombTtl: 0.8,
  bombGrowth: 26 * 60,
  invulnerable: 1.6,
  bossOutro: 1.2,
  clearDelay: 1.2,
} as const;

type Weapon = 'twin' | 'laser' | 'proton' | 'missile' | 'shield';
type BossPattern = 'spiral' | 'aimed' | 'ring' | 'waves' | 'spiral2' | 'aimed2' | 'final';

const WEAPONS: readonly Weapon[] = ['twin', 'laser', 'proton', 'missile', 'shield'];

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  heavy: boolean;
}

interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  type: 'ship' | 'drone';
  fires: boolean;
  fireTimer: number;
  score: number;
}

interface Bomb {
  x: number;
  y: number;
  r: number;
  ttl: number;
}

interface Pickup {
  x: number;
  y: number;
  weapon: Weapon;
}

interface Boss {
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  pattern: BossPattern;
  timer: number;
  phase: number;
}

export interface RaidenState {
  player: { x: number; y: number; vx: number; vy: number; inv: number; fireTimer: number };
  weapon: Weapon;
  bombsLeft: number;
  selecting: boolean;
  bullets: Bullet[];
  enemyBullets: Bullet[];
  enemies: Enemy[];
  bombs: Bomb[];
  pickups: Pickup[];
  boss: Boss | null;
  spawnTimer: number;
  waveIndex: number;
  bossIntro: boolean;
  bossOutro: number;
  clearTimer: number;
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

function stageParams(stage: number): {
  enemySpeed: number;
  bullets: number;
  hitpoints: number;
  spawnInterval: number;
  bossHp: number;
  bossPattern: BossPattern;
} {
  const patterns: readonly BossPattern[] = [
    'spiral', 'aimed', 'ring', 'waves', 'spiral2', 'aimed2', 'final',
  ];
  return {
    enemySpeed: 1 + (stage - 1) * 0.08,
    bullets: 1 + Math.floor((stage - 1) / 3),
    hitpoints: 1 + Math.floor((stage - 1) / 2),
    spawnInterval: Math.max(0.7, 1.5 - (stage - 1) * 0.1),
    bossHp: 40 + (stage - 1) * 20,
    bossPattern: patterns[stage - 1] ?? 'final',
  };
}

function cycleWeapon(state: RaidenState, direction: number, ctx: StepContext): void {
  const index = WEAPONS.indexOf(state.weapon);
  const next = (index + direction + WEAPONS.length) % WEAPONS.length;
  state.weapon = WEAPONS[next] ?? 'twin';
  ctx.emit('hit', { kind: 'weapon', weapon: state.weapon });
}

function fireWeapon(state: RaidenState, ctx: StepContext): void {
  const player = state.player;
  const cy = player.y - 8;
  switch (state.weapon) {
    case 'twin':
      state.bullets.push({ x: player.x - 7, y: cy, vx: 0, vy: -RAIDEN.bulletSpeed, r: 4, heavy: false });
      state.bullets.push({ x: player.x + 7, y: cy, vx: 0, vy: -RAIDEN.bulletSpeed, r: 4, heavy: false });
      break;
    case 'laser':
      state.bullets.push({ x: player.x, y: cy, vx: 0, vy: -RAIDEN.bulletSpeed - 180, r: 6, heavy: false });
      state.bullets.push({ x: player.x - 18, y: cy + 12, vx: 0, vy: -RAIDEN.bulletSpeed, r: 3, heavy: false });
      state.bullets.push({ x: player.x + 18, y: cy + 12, vx: 0, vy: -RAIDEN.bulletSpeed, r: 3, heavy: false });
      break;
    case 'proton':
      for (let i = 0; i < 5; i++) {
        state.bullets.push({
          x: player.x + (i - 2) * 8,
          y: cy,
          vx: (i - 2) * 42,
          vy: -RAIDEN.bulletSpeed,
          r: 3,
          heavy: false,
        });
      }
      break;
    case 'missile':
      for (const offset of [-10, 10]) {
        state.bullets.push({
          x: player.x + offset,
          y: cy + 6,
          vx: Math.sign(offset) * 144,
          vy: -480,
          r: 4,
          heavy: true,
        });
      }
      break;
    case 'shield':
      state.bullets.push({ x: player.x, y: cy, vx: 0, vy: -RAIDEN.bulletSpeed, r: 5, heavy: true });
      break;
  }
  ctx.emit('shoot', { x: player.x, y: player.y, weapon: state.weapon });
}

function spawnBoss(state: RaidenState, ctx: StepContext): void {
  const params = stageParams(state.stage);
  state.boss = {
    x: RAIDEN.width / 2,
    y: 110,
    r: 26,
    hp: params.bossHp,
    maxHp: params.bossHp,
    pattern: params.bossPattern,
    timer: 1.8,
    phase: 0,
  };
  state.bossIntro = true;
  ctx.emit('levelUp', { kind: 'boss', stage: state.stage, pattern: params.bossPattern });
}

function ring(
  state: RaidenState,
  count: number,
  speed: number,
  offset: number,
  dir: number,
): void {
  const boss = state.boss;
  if (!boss) return;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + offset + dir;
    state.enemyBullets.push({
      x: boss.x,
      y: boss.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 5,
      heavy: false,
    });
  }
}

function aimed(state: RaidenState, count: number, speed: number, scatter: number, ctx: StepContext): void {
  const boss = state.boss;
  if (!boss) return;
  const base = Math.atan2(state.player.y - boss.y, state.player.x - boss.x);
  for (let i = 0; i < count; i++) {
    const angle = base + (i - (count - 1) / 2) * 0.18 + ctx.rng.range(-scatter, scatter);
    state.enemyBullets.push({
      x: boss.x,
      y: boss.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 5,
      heavy: false,
    });
  }
}

function setupStage(state: RaidenState, ctx: StepContext): void {
  state.enemies = [];
  state.bullets = [];
  state.enemyBullets = [];
  state.bombs = [];
  state.pickups = [];
  state.boss = null;
  state.bossIntro = false;
  state.bossOutro = 0;
  state.clearTimer = 0;
  state.spawnTimer = 0;
  state.waveIndex = 0;
  state.selecting = true;
  state.player.x = RAIDEN.width / 2;
  state.player.y = RAIDEN.height - 60;
  state.player.inv = 0;
  ctx.emit('levelUp', { kind: 'stage', stage: state.stage });
}

function reset(state: RaidenState, ctx: StepContext): void {
  state.score = 0;
  state.lives = RAIDEN.startLives;
  state.stage = 1;
  state.over = false;
  state.won = false;
  state.paused = false;
  state.ticks = 0;
  state.progress = 0;
  state.bombsLeft = RAIDEN.startBombs;
  state.weapon = 'twin';
  state.player.x = RAIDEN.width / 2;
  state.player.y = RAIDEN.height - 60;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.inv = 0;
  state.player.fireTimer = 0;
  setupStage(state, ctx);
}

function playerHit(state: RaidenState, ctx: StepContext): void {
  if (state.player.inv > 0) return;
  state.player.inv = RAIDEN.invulnerable;
  state.lives--;
  state.weapon = 'twin';
  ctx.emit('explode', { x: state.player.x, y: state.player.y, kind: 'ship' });
  ctx.progression.observe(-0.8);
  if (state.lives <= 0) {
    state.over = true;
    ctx.emit('gameOver', { score: state.score });
  }
}

function killEnemy(state: RaidenState, ctx: StepContext, enemy: Enemy): void {
  state.score += enemy.score;
  state.progress += enemy.score;
  ctx.emit('explode', { x: enemy.x, y: enemy.y, points: enemy.score });
  ctx.emit('score', { score: state.score, points: enemy.score });
  ctx.progression.observe(0.4);
  if (ctx.rng.next() < 0.12 + ctx.progression.state.hazard * 0.1) {
    state.pickups.push({
      x: enemy.x,
      y: enemy.y,
      weapon: WEAPONS[ctx.rng.int(WEAPONS.length)] ?? 'twin',
    });
  }
}

export const raidenGame = defineGame<RaidenState>({
  id: 'raiden',
  meta: { title: 'Raiden', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['left', 'right', 'up', 'down', 'fire', 'bomb', 'confirm', 'pause', 'restart'],
  progression: {
    id: 'raiden',
    levels: [
      { speed: 1, spawnInterval: 70, hazard: 0, label: 'Sector 1' },
      { speed: 1.1, spawnInterval: 58, hazard: 0.2, label: 'Sector 2' },
      { speed: 1.25, spawnInterval: 46, hazard: 0.45, label: 'Sector 3' },
    ],
    pointsPerLevel: 4000,
    dda: { enabled: true, window: 420, maxAdjust: 0.08 },
    patterns: ['weave', 'turret', 'boss'],
    avoidRepeat: 2,
  },

  init(seed, ctx) {
    const state: RaidenState = {
      player: { x: RAIDEN.width / 2, y: RAIDEN.height - 60, vx: 0, vy: 0, inv: 0, fireTimer: 0 },
      weapon: 'twin',
      bombsLeft: RAIDEN.startBombs,
      selecting: true,
      bullets: [],
      enemyBullets: [],
      enemies: [],
      bombs: [],
      pickups: [],
      boss: null,
      spawnTimer: 0,
      waveIndex: 0,
      bossIntro: false,
      bossOutro: 0,
      clearTimer: 0,
      score: 0,
      lives: RAIDEN.startLives,
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

    if (state.selecting) {
      if (ctx.actions.consume('up')) cycleWeapon(state, -1, ctx);
      if (ctx.actions.consume('down')) cycleWeapon(state, 1, ctx);
      if (ctx.actions.consume('confirm') || ctx.actions.consume('fire')) {
        state.selecting = false;
        ctx.emit('hit', { kind: 'stageStart', weapon: state.weapon });
      }
      return;
    }

    // B6: timers de fase en el estado, no callbacks reales.
    if (state.bossIntro) state.bossIntro = false;
    if (state.bossOutro > 0) {
      state.bossOutro -= dt;
      if (state.bossOutro <= 0) state.clearTimer = RAIDEN.clearDelay;
    }
    if (state.clearTimer > 0) {
      state.clearTimer -= dt;
      if (state.clearTimer <= 0) {
        state.score += 1000;
        state.progress += 1000;
        ctx.emit('score', { score: state.score, points: 1000 });
        if (state.stage >= RAIDEN.maxStage) {
          state.over = true;
          state.won = true;
          ctx.emit('gameOver', { score: state.score, won: true });
          return;
        }
        state.stage++;
        setupStage(state, ctx);
        return;
      }
    }

    let kx = (ctx.actions.isDown('right') ? 1 : 0) - (ctx.actions.isDown('left') ? 1 : 0);
    let ky = (ctx.actions.isDown('down') ? 1 : 0) - (ctx.actions.isDown('up') ? 1 : 0);
    if (kx !== 0 || ky !== 0) {
      const direction = normalize2(kx, ky);
      kx = direction.x;
      ky = direction.y;
    }
    player.vx = kx * RAIDEN.moveSpeed;
    player.vy = ky * RAIDEN.moveSpeed;
    player.x = clamp(player.x + player.vx * dt, 0, RAIDEN.playWidth);
    player.y = clamp(player.y + player.vy * dt, 30, RAIDEN.height - 36);
    player.inv = Math.max(0, player.inv - dt);
    player.fireTimer -= dt;
    if (player.fireTimer <= 0) {
      player.fireTimer = RAIDEN.fireInterval;
      fireWeapon(state, ctx);
    }

    if (ctx.actions.consume('bomb') && state.bombsLeft > 0) {
      state.bombsLeft--;
      state.bombs.push({ x: player.x, y: player.y, r: 8, ttl: RAIDEN.bombTtl });
      ctx.emit('explode', { x: player.x, y: player.y, kind: 'bomb' });
      ctx.emit('score', { score: state.score, points: 0, reason: 'bomb' });
    }

    const params = stageParams(state.stage);
    const pattern = ctx.progression.nextPattern();
    state.spawnTimer -= dt * speed;
    if (state.boss === null && state.bossOutro <= 0 && state.clearTimer <= 0) {
      if (state.waveIndex >= 5 + state.stage) {
        if (state.enemies.length === 0 && !state.bossIntro) spawnBoss(state, ctx);
      } else if (state.spawnTimer <= 0) {
        state.spawnTimer = Math.max(params.spawnInterval * 0.5, (progress.spawnInterval ?? 70) / 60);
        state.waveIndex++;
        const side = ctx.rng.next() < 0.5 ? 0.25 : 0.55;
        for (let i = 0; i < params.bullets; i++) {
          state.enemies.push({
            x: side * RAIDEN.playWidth + i * 42,
            y: -30 - i * 40,
            vx: ctx.rng.range(-24, 24),
            vy: ctx.rng.range(72, 132) * params.enemySpeed,
            r: 14,
            hp: params.hitpoints,
            type: 'ship',
            fires: ctx.rng.next() < 0.5,
            fireTimer: ctx.rng.range(0.4, 1.2),
            score: 100,
          });
        }
        if (state.stage >= 3 && state.waveIndex % 3 === 0) {
          state.enemies.push({
            x: ctx.rng.range(60, RAIDEN.playWidth - 60),
            y: -30,
            vx: ctx.rng.range(-36, 36),
            vy: ctx.rng.range(48, 84) * params.enemySpeed,
            r: 13,
            hp: 2,
            type: 'drone',
            fires: false,
            fireTimer: 0,
            score: 200,
          });
        }
        ctx.emit('hit', { kind: 'spawn', pattern });
      }
    }

    for (const enemy of state.enemies) {
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt * speed;
      if (enemy.x < 0 || enemy.x > RAIDEN.playWidth) enemy.vx = -enemy.vx;
      enemy.fireTimer -= dt * (1 + progress.hazard);
      if (enemy.fires && enemy.fireTimer <= 0 && enemy.y > 20 && enemy.y < RAIDEN.height - 80) {
        enemy.fireTimer = 1.8;
        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        state.enemyBullets.push({
          x: enemy.x,
          y: enemy.y + 8,
          vx: Math.cos(angle) * RAIDEN.enemyBulletSpeed,
          vy: Math.sin(angle) * RAIDEN.enemyBulletSpeed,
          r: 4,
          heavy: false,
        });
        ctx.emit('shoot', { x: enemy.x, y: enemy.y, hostile: true });
      }
    }
    state.enemies = state.enemies.filter((enemy) => enemy.y < RAIDEN.height + 60);

    if (state.boss !== null) {
      const boss = state.boss;
      // B7: patrón de jefe con reloj de simulación.
      const time = ctx.clock.time;
      if (boss.pattern === 'final') {
        boss.x = RAIDEN.width / 2 + Math.sin(time * 1.4) * (RAIDEN.playWidth * 0.3);
        boss.y = 90 + Math.sin(time * 2.2) * 30;
      } else {
        boss.x = lerp(boss.x, RAIDEN.width / 2 + Math.sin(time * 1.1) * (RAIDEN.playWidth * 0.32), 0.04);
        boss.y = clamp(boss.y + Math.sin(time * 1.11) * 18 * dt, 60, 150);
      }
      boss.timer -= dt * speed;
      if (boss.timer <= 0) {
        boss.phase++;
        switch (boss.pattern) {
          case 'spiral':
            ring(state, 22, 204, boss.phase, boss.phase * 0.3);
            boss.timer = 2;
            break;
          case 'aimed':
            aimed(state, 3, 300, 0.08, ctx);
            boss.timer = 1.5;
            break;
          case 'ring':
            ring(state, 26, 192, 0, 0);
            aimed(state, 2, 312, 0.07, ctx);
            boss.timer = 1.7;
            break;
          case 'waves':
            ring(state, 18, 180, boss.phase, (boss.phase % 2 === 0 ? 1 : -1) * 0.4);
            aimed(state, 2, 276, 0.08, ctx);
            boss.timer = 1.4;
            break;
          case 'spiral2':
            ring(state, 30, 216, boss.phase * 0.5, boss.phase * 0.22);
            boss.timer = 1.3;
            break;
          case 'aimed2':
            ring(state, 14, 192, 0, boss.phase * 0.2);
            aimed(state, 4, 372, 0.05, ctx);
            boss.timer = 1.1;
            break;
          case 'final':
            ring(state, 32, 216, 0, boss.phase * 0.3);
            aimed(state, 5, 384, 0.04, ctx);
            boss.timer = 0.9;
            break;
        }
        ctx.emit('shoot', { x: boss.x, y: boss.y, hostile: true });
      }
    }

    for (const bullet of state.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
    }
    state.bullets = state.bullets.filter((bullet) =>
      bullet.y > -20 && bullet.x > -20 && bullet.x < RAIDEN.playWidth + 20);

    for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
      const bullet = state.bullets[bi];
      if (!bullet) continue;
      let consumed = false;
      const boss = state.boss;
      if (boss && collision.circleAabb(
        { x: bullet.x, y: bullet.y, r: bullet.r },
        { x: boss.x - boss.r - 6, y: boss.y - boss.r - 6, w: (boss.r + 6) * 2, h: (boss.r + 6) * 2 },
      )) {
        boss.hp -= bullet.heavy ? 2 : 1;
        consumed = true;
        ctx.emit('hit', { x: boss.x, y: boss.y, hp: boss.hp });
        if (boss.hp <= 0) {
          state.score += 5000 + state.stage * 500;
          state.progress += 5000;
          ctx.emit('explode', { x: boss.x, y: boss.y, points: 5000 });
          ctx.emit('score', { score: state.score, points: 5000 });
          state.boss = null;
          state.bossOutro = RAIDEN.bossOutro;
        }
      }
      if (!consumed) {
        for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
          const enemy = state.enemies[ei];
          if (!enemy) continue;
          if (!collision.circleAabb(
            { x: bullet.x, y: bullet.y, r: bullet.r },
            { x: enemy.x - enemy.r, y: enemy.y - enemy.r, w: enemy.r * 2, h: enemy.r * 2 },
          )) continue;
          enemy.hp -= bullet.heavy ? 2 : 1;
          consumed = true;
          ctx.emit('hit', { x: enemy.x, y: enemy.y });
          if (enemy.hp <= 0) {
            state.enemies.splice(ei, 1);
            killEnemy(state, ctx, enemy);
          }
          break;
        }
      }
      if (consumed) state.bullets.splice(bi, 1);
    }

    for (const bomb of state.bombs) {
      bomb.r += RAIDEN.bombGrowth * dt;
      bomb.ttl -= dt;
      for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
        const enemy = state.enemies[ei];
        if (!enemy || dist2(bomb.x, bomb.y, enemy.x, enemy.y) > bomb.r * bomb.r) continue;
        enemy.hp -= 4;
        if (enemy.hp <= 0) {
          state.enemies.splice(ei, 1);
          killEnemy(state, ctx, enemy);
        }
      }
      if (state.boss && dist2(bomb.x, bomb.y, state.boss.x, state.boss.y) <= bomb.r * bomb.r) {
        state.boss.hp -= 10;
        if (state.boss.hp <= 0) {
          state.score += 5000 + state.stage * 500;
          state.progress += 5000;
          ctx.emit('explode', { x: state.boss.x, y: state.boss.y, points: 5000 });
          state.boss = null;
          state.bossOutro = RAIDEN.bossOutro;
        }
      }
    }
    state.bombs = state.bombs.filter((bomb) => bomb.ttl > 0);

    for (const enemyBullet of state.enemyBullets) {
      enemyBullet.x += enemyBullet.vx * dt;
      enemyBullet.y += enemyBullet.vy * dt;
      if (player.inv <= 0 && collision.circleAabb(
        { x: enemyBullet.x, y: enemyBullet.y, r: enemyBullet.r },
        { x: player.x - 9, y: player.y - 9, w: 18, h: 18 },
      )) {
        enemyBullet.y = RAIDEN.height + 100;
        playerHit(state, ctx);
      }
    }
    state.enemyBullets = state.enemyBullets.filter((enemyBullet) =>
      enemyBullet.y > -30 && enemyBullet.y < RAIDEN.height + 30);

    for (const pickup of state.pickups) pickup.y += 96 * dt;
    state.pickups = state.pickups.filter((pickup) => pickup.y < RAIDEN.height + 20);
    for (let pi = state.pickups.length - 1; pi >= 0; pi--) {
      const pickup = state.pickups[pi];
      if (!pickup || dist2(pickup.x, pickup.y, player.x, player.y) > 12 * 12) continue;
      state.pickups.splice(pi, 1);
      state.weapon = pickup.weapon;
      ctx.emit('hit', { kind: 'pickup', weapon: pickup.weapon });
    }
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
      clamp(((state.player.x - RAIDEN.playLeft) / RAIDEN.playWidth) * 2 - 1, -1, 1),
      clamp((state.player.y / RAIDEN.height) * 2 - 1, -1, 1),
      clamp((nearestX - state.player.x) / RAIDEN.width, -1, 1),
      clamp((state.player.y - nearestY) / RAIDEN.height, -1, 1),
      clamp((state.enemyBullets.length / 12) * 2 - 1, -1, 1),
      (WEAPONS.indexOf(state.weapon) / (WEAPONS.length - 1)) * 2 - 1,
      clamp((state.bombsLeft / RAIDEN.startBombs) * 2 - 1, -1, 1),
      state.boss === null ? -1 : clamp((state.boss.hp / state.boss.maxHp) * 2 - 1, -1, 1),
      state.selecting ? 1 : -1,
      clamp((state.lives / RAIDEN.startLives) * 2 - 1, -1, 1),
    ]);
  },

  render(renderer, state, alpha) {
    void alpha; // Sin interpolación: el estado ya contiene las posiciones del frame.
    const ctx = renderer as CanvasRenderingContext2D | null;
    if (!ctx || typeof ctx.clearRect !== 'function') return;
    ctx.save();
    ctx.clearRect(0, 0, RAIDEN.width, RAIDEN.height);
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, RAIDEN.width, RAIDEN.height);

    // Carriles laterales fuera del área de juego.
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, RAIDEN.playLeft, RAIDEN.height);
    ctx.fillRect(RAIDEN.playRight, 0, RAIDEN.width - RAIDEN.playRight, RAIDEN.height);
    ctx.strokeStyle = '#16233a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(RAIDEN.playLeft, 0);
    ctx.lineTo(RAIDEN.playLeft, RAIDEN.height);
    ctx.moveTo(RAIDEN.playRight, 0);
    ctx.lineTo(RAIDEN.playRight, RAIDEN.height);
    ctx.stroke();
    ctx.fillStyle = '#16233a';
    for (let i = 0; i < 44; i++) {
      const sx = RAIDEN.playLeft + ((i * 149) % RAIDEN.playWidth);
      const sy = (i * 91 + state.ticks * 3) % RAIDEN.height;
      ctx.fillRect(sx, sy, 2, 6);
    }

    ctx.lineWidth = 2;
    for (const enemy of state.enemies) {
      ctx.strokeStyle = enemy.type === 'ship' ? '#5ef2ff' : '#ff3fa4';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const pickup of state.pickups) {
      ctx.fillStyle = '#38f5a3';
      ctx.fillRect(pickup.x - 6, pickup.y - 6, 12, 12);
    }
    for (const bullet of state.bullets) {
      ctx.fillStyle = bullet.heavy ? '#ff3fa4' : '#ffd166';
      ctx.fillRect(bullet.x - 2, bullet.y - 8, 4, 16);
    }
    for (const bullet of state.enemyBullets) {
      ctx.fillStyle = '#ff3fa4';
      ctx.fillRect(bullet.x - 2, bullet.y - 6, 4, 12);
    }

    // Bombas: anillo expansivo ligado al estado, sin sistema de partículas propio.
    for (const bomb of state.bombs) {
      ctx.strokeStyle = '#ffd166';
      ctx.globalAlpha = Math.max(0, bomb.ttl / RAIDEN.bombTtl);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(bomb.x, bomb.y, bomb.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (state.boss) {
      const boss = state.boss;
      ctx.save();
      ctx.translate(boss.x, boss.y);
      ctx.rotate((state.ticks / 60) * (boss.phase % 2 === 0 ? 1 : -1));
      ctx.strokeStyle = '#ff3fa4';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        const px = Math.cos(angle) * boss.r;
        const py = Math.sin(angle) * boss.r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#16233a';
      ctx.fillRect(RAIDEN.playLeft + 30, 10, RAIDEN.playWidth - 60, 6);
      ctx.fillStyle = '#ff3fa4';
      ctx.fillRect(
        RAIDEN.playLeft + 30,
        10,
        (RAIDEN.playWidth - 60) * (boss.hp / boss.maxHp),
        6,
      );
    }

    // Destello breve de invulnerabilidad.
    const player = state.player;
    const blink = player.inv > 0 ? 0.4 + 0.45 * Math.sin(player.inv * 14) : 1;
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.translate(player.x, player.y);
    ctx.strokeStyle = '#5ef2ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(12, 11);
    ctx.lineTo(0, 5);
    ctx.lineTo(-12, 11);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    ctx.font = '16px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5ef2ff';
    ctx.fillText(`PTS ${state.score}`, 12, 24);
    ctx.fillText(`VIDAS ${state.lives}  BOMBAS ${state.bombsLeft}`, 12, 44);
    ctx.textAlign = 'right';
    ctx.fillText(`SECTOR ${state.stage}`, RAIDEN.width - 12, 24);
    if (state.selecting) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd166';
      ctx.fillText(`ARMA: ${state.weapon}`, RAIDEN.width / 2, RAIDEN.height - 22);
    }
    if (state.paused || state.over || state.won) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 32px monospace';
      ctx.fillStyle = '#ff3fa4';
      ctx.fillText(state.won ? 'VICTORIA' : state.over ? 'FIN' : 'PAUSA', RAIDEN.width / 2, RAIDEN.height / 2);
    }
    ctx.restore();
  },
  rules: singlePlayerRules<RaidenState>(
    (state) =>
      state.score + state.stage * 200 + state.lives * 25 + state.bombsLeft * 10 +
      state.ticks / 600 - (state.over ? 150 : 0),
  ),
});
