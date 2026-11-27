import { defineGame } from '../../game/contract.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import { clamp } from '../../core/math.js';
import { COLLISION_SERVICE, type CollisionService } from '../../sim/collision.js';
import type { StepContext } from '../../core/simulation.js';

/**
 * Moon Patrol completo: cráteres y minas, rovers y UFOs que disparan,
 * salto con gravedad, disparo adelante/triple y arriba, power-ups y niveles
 * por distancia con bonus de tiempo. Colisiones vía CollisionService.
 */
export const MOON_PATROL = {
  width: 480,
  height: 320,
  groundY: 260,
  playerX: 80,
  playerW: 24,
  playerH: 16,
  jumpForce: 250,
  gravity: 600,
  scrollSpeed: 80,
  bulletSpeed: 300,
  normalCooldown: 0.15,
  rapidCooldown: 0.05,
  powerupDuration: 8,
  levelDistance: 500,
  maxEnemies: 12,
} as const;

export interface MoonBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  enemy: boolean;
}

export interface MoonEnemy {
  x: number;
  y: number;
  type: 'rover' | 'ufo';
  speed: number;
  w: number;
  h: number;
  shootTimer: number;
}

export interface MoonObstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'crater' | 'mine';
}

export interface MoonPowerUp {
  x: number;
  y: number;
  kind: 'triple' | 'rapid';
}

export interface MoonPatrolState {
  paused: boolean;
  over: boolean;
  generation: number;
  winner: number | null;
  player: { y: number; vy: number; grounded: boolean };
  bullets: MoonBullet[];
  enemies: MoonEnemy[];
  obstacles: MoonObstacle[];
  powerups: MoonPowerUp[];
  scrollX: number;
  distance: number;
  level: number;
  levelTimer: number;
  jumpsThisLevel: number;
  tripleTimer: number;
  rapidTimer: number;
  shootCooldown: number;
  nextSpawnAt: number;
  nextPowerAt: number;
  kills: number;
  score: number;
  ticks: number;
}

function resetMoon(state: MoonPatrolState, ctx: StepContext): void {
  state.generation += 1;
  state.paused = false;
  state.over = false;
  state.winner = null;
  state.player = { y: MOON_PATROL.groundY, vy: 0, grounded: true };
  state.bullets = [];
  state.enemies = [];
  state.obstacles = [];
  state.powerups = [];
  state.scrollX = 0;
  state.distance = 0;
  state.level = 0;
  state.levelTimer = 0;
  state.jumpsThisLevel = 0;
  state.tripleTimer = 0;
  state.rapidTimer = 0;
  state.shootCooldown = 0;
  state.nextSpawnAt = 40;
  state.nextPowerAt = 240;
  state.kills = 0;
  state.score = 0;
  state.ticks = 0;
  ctx.emit('restart', { generation: state.generation });
}

function spawnFromPattern(state: MoonPatrolState, ctx: StepContext): void {
  const progress = ctx.progression.state;
  const pattern = ctx.progression.nextPattern() ?? 'crater';
  const x = MOON_PATROL.width + 20;
  if (pattern === 'ufo' || (pattern === 'crater' && ctx.rng.next() < 0.25)) {
    state.enemies.push({
      x,
      y: MOON_PATROL.groundY - 40 - ctx.rng.range(0, 60),
      type: 'ufo',
      speed: (40 + ctx.rng.range(0, 20)) * progress.speed,
      w: 16,
      h: 10,
      shootTimer: ctx.rng.range(2, 5),
    });
    ctx.emit('spawn', { type: 'ufo' });
  } else if (pattern === 'crater') {
    state.obstacles.push({
      x,
      y: MOON_PATROL.groundY - 6,
      w: 30 + ctx.rng.range(0, 20) * (1 + progress.hazard),
      h: 6,
      kind: 'crater',
    });
    ctx.emit('spawn', { type: 'crater' });
  } else if (pattern === 'rock') {
    state.obstacles.push({ x, y: MOON_PATROL.groundY - 8, w: 12, h: 8, kind: 'mine' });
    ctx.emit('spawn', { type: 'mine' });
  } else {
    state.enemies.push({
      x,
      y: MOON_PATROL.groundY - MOON_PATROL.playerH + 2,
      type: 'rover',
      speed: (60 + ctx.rng.range(0, 20)) * progress.speed,
      w: 20,
      h: 12,
      shootTimer: 0,
    });
    ctx.emit('spawn', { type: 'rover' });
  }
}

export const moonPatrolGame = defineGame<MoonPatrolState>({
  id: 'moon-patrol',
  meta: { title: 'Moon Patrol', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['jump', 'fire', 'fireUp', 'pause', 'restart'],
  progression: {
    id: 'moon-patrol',
    levels: [
      { speed: 1, spawnInterval: 90, hazard: 0, label: 'Sector 1' },
      { speed: 1.1, spawnInterval: 74, hazard: 0.2, label: 'Sector 2' },
      { speed: 1.22, spawnInterval: 58, hazard: 0.4, label: 'Sector 3' },
    ],
    pointsPerLevel: 500,
    dda: { enabled: true, window: 400, maxAdjust: 0.08 },
    patterns: ['crater', 'rock', 'ufo'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    const state: MoonPatrolState = {
      paused: false,
      over: false,
      generation: 0,
      winner: null,
      player: { y: MOON_PATROL.groundY, vy: 0, grounded: true },
      bullets: [],
      enemies: [],
      obstacles: [],
      powerups: [],
      scrollX: 0,
      distance: 0,
      level: 0,
      levelTimer: 0,
      jumpsThisLevel: 0,
      tripleTimer: 0,
      rapidTimer: 0,
      shootCooldown: 0,
      nextSpawnAt: 40,
      nextPowerAt: 240,
      kills: 0,
      score: 0,
      ticks: 0,
    };
    resetMoon(state, ctx);
    return state;
  },

  step(state, ctx) {
    if (handleLifecycle(state, ctx, state.distance, () => resetMoon(state, ctx))) return;
    const dt = ctx.clock.dt;
    state.ticks += 1;
    const progress = ctx.progression.state;
    const speed = progress.speed;
    const collision = ctx.services.get<CollisionService>(COLLISION_SERVICE);

    state.scrollX += MOON_PATROL.scrollSpeed * speed * dt;
    state.distance += MOON_PATROL.scrollSpeed * speed * dt;
    state.levelTimer += dt;
    state.score = Math.floor(state.distance * 0.1) + state.kills * 25;

    const targetLevel = Math.floor(state.distance / MOON_PATROL.levelDistance);
    if (targetLevel > state.level) {
      const bonus = 500 + Math.max(0, Math.ceil(45 - state.levelTimer) * 10);
      state.score += bonus;
      state.level = targetLevel;
      state.levelTimer = 0;
      state.jumpsThisLevel = 0;
      ctx.emit('levelUp', { level: state.level + 1, bonus });
      ctx.progression.observe(0.6);
    }

    if (state.tripleTimer > 0) state.tripleTimer -= dt;
    if (state.rapidTimer > 0) state.rapidTimer -= dt;
    state.shootCooldown = Math.max(0, state.shootCooldown - dt);

    if (ctx.actions.consume('jump') && state.player.grounded) {
      state.player.vy = -MOON_PATROL.jumpForce;
      state.player.grounded = false;
      state.jumpsThisLevel += 1;
      ctx.emit('jump', { y: state.player.y });
    }
    if (!state.player.grounded) {
      state.player.vy = clamp(state.player.vy + MOON_PATROL.gravity * dt, -MOON_PATROL.jumpForce, 600);
      state.player.y += state.player.vy * dt;
      if (state.player.y >= MOON_PATROL.groundY) {
        state.player.y = MOON_PATROL.groundY;
        state.player.vy = 0;
        state.player.grounded = true;
      }
    }

    const cooldown = state.rapidTimer > 0 ? MOON_PATROL.rapidCooldown : MOON_PATROL.normalCooldown;
    if (ctx.actions.isDown('fire') && state.shootCooldown <= 0) {
      const originY = state.player.y + MOON_PATROL.playerH / 2 - 2;
      const shots = state.tripleTimer > 0 ? [-1, 0, 1] : [0];
      for (const dir of shots) {
        state.bullets.push({
          x: MOON_PATROL.playerX + MOON_PATROL.playerW,
          y: originY,
          vx: MOON_PATROL.bulletSpeed,
          vy: MOON_PATROL.bulletSpeed * 0.5 * dir,
          w: 8,
          h: 3,
          enemy: false,
        });
      }
      state.shootCooldown = cooldown;
      ctx.emit('shoot', { x: MOON_PATROL.playerX, y: originY });
    }
    // ↑ dispara arriba Además de saltar (ambigüedad documentada, se conserva).
    if (ctx.actions.isDown('fireUp') && state.shootCooldown <= 0) {
      state.bullets.push({
        x: MOON_PATROL.playerX + MOON_PATROL.playerW / 2,
        y: state.player.y - 4,
        vx: MOON_PATROL.bulletSpeed * 0.5,
        vy: -MOON_PATROL.bulletSpeed,
        w: 3,
        h: 8,
        enemy: false,
      });
      state.shootCooldown = cooldown;
      ctx.emit('shootUp', { y: state.player.y });
    }

    if (state.ticks >= state.nextSpawnAt) {
      const interval = progress.spawnInterval ?? 90;
      const extra = ctx.rng.next() < progress.hazard ? 1 : 0;
      for (let i = 0; i <= extra; i++) {
        if (state.enemies.length < MOON_PATROL.maxEnemies) spawnFromPattern(state, ctx);
      }
      state.nextSpawnAt = state.ticks + Math.max(20, Math.round(interval / speed));
    }
    if (state.ticks >= state.nextPowerAt) {
      state.powerups.push({
        x: MOON_PATROL.width + 20,
        y: MOON_PATROL.groundY - MOON_PATROL.playerH - ctx.rng.range(0, 40),
        kind: ctx.rng.next() < 0.5 ? 'triple' : 'rapid',
      });
      state.nextPowerAt = state.ticks + 600;
      ctx.emit('powerupSpawn', {});
    }

    const playerBox = { x: MOON_PATROL.playerX, y: state.player.y, w: MOON_PATROL.playerW, h: MOON_PATROL.playerH };
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const bullet = state.bullets[i];
      if (bullet === undefined) continue;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.x > MOON_PATROL.width + 20 || bullet.y < -20 || bullet.y > MOON_PATROL.height + 20) {
        state.bullets.splice(i, 1);
        continue;
      }
      if (bullet.enemy) {
        if (
          collision.aabbOverlap(playerBox, {
            x: bullet.x,
            y: bullet.y,
            w: bullet.w,
            h: bullet.h,
          })
        ) {
          state.bullets.splice(i, 1);
          state.over = true;
          state.winner = null;
          ctx.emit('crash', { x: bullet.x, y: bullet.y });
          ctx.emit('hit', { x: MOON_PATROL.playerX, y: state.player.y });
          ctx.emit('gameOver', { score: state.score });
          ctx.progression.observe(-1);
        }
        continue;
      }
      for (let j = state.enemies.length - 1; j >= 0; j--) {
        const enemy = state.enemies[j];
        if (enemy === undefined) continue;
        if (
          collision.aabbOverlap(
            { x: bullet.x, y: bullet.y, w: bullet.w, h: bullet.h },
            { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h },
          )
        ) {
          state.bullets.splice(i, 1);
          state.enemies.splice(j, 1);
          state.kills += 1;
          state.score += enemy.type === 'ufo' ? 50 : 20;
          ctx.emit('hit', { x: bullet.x, y: bullet.y });
          ctx.emit('explode', { type: enemy.type, x: enemy.x, y: enemy.y });
          ctx.progression.observe(0.5);
          break;
        }
      }
    }

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const enemy = state.enemies[i];
      if (enemy === undefined) continue;
      enemy.x -= (MOON_PATROL.scrollSpeed + enemy.speed) * dt;
      if (enemy.x < -30) {
        state.enemies.splice(i, 1);
        continue;
      }
      if (enemy.type === 'ufo') {
        enemy.shootTimer -= dt;
        if (enemy.shootTimer <= 0) {
          enemy.shootTimer = 2 + ctx.rng.next() * 3;
          state.bullets.push({
            x: enemy.x,
            y: enemy.y + enemy.h,
            vx: -100,
            vy: 80,
            w: 4,
            h: 4,
            enemy: true,
          });
          ctx.emit('enemyShoot', { x: enemy.x });
        }
      }
      if (
        collision.aabbOverlap(playerBox, { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h })
      ) {
        state.over = true;
        state.winner = null;
        ctx.emit('crash', { x: enemy.x, y: enemy.y });
        ctx.emit('hit', { x: MOON_PATROL.playerX, y: state.player.y });
        ctx.emit('gameOver', { score: state.score });
        ctx.progression.observe(-1);
        return;
      }
    }

    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const obstacle = state.obstacles[i];
      if (obstacle === undefined) continue;
      obstacle.x -= MOON_PATROL.scrollSpeed * speed * dt;
      if (obstacle.x + obstacle.w < -10) {
        state.obstacles.splice(i, 1);
        continue;
      }
      if (collision.aabbOverlap(playerBox, obstacle)) {
        state.over = true;
        state.winner = null;
        ctx.emit('crash', { kind: obstacle.kind });
        ctx.emit('hit', { x: MOON_PATROL.playerX, y: state.player.y });
        ctx.emit('gameOver', { score: state.score });
        ctx.progression.observe(-1);
        return;
      }
    }

    for (let i = state.powerups.length - 1; i >= 0; i--) {
      const power = state.powerups[i];
      if (power === undefined) continue;
      power.x -= MOON_PATROL.scrollSpeed * speed * dt;
      if (power.x < -30) {
        state.powerups.splice(i, 1);
        continue;
      }
      if (collision.aabbOverlap(playerBox, { x: power.x, y: power.y, w: 16, h: 16 })) {
        if (power.kind === 'triple') state.tripleTimer = MOON_PATROL.powerupDuration;
        else state.rapidTimer = MOON_PATROL.powerupDuration;
        state.powerups.splice(i, 1);
        ctx.emit('powerup', { kind: power.kind });
        ctx.progression.observe(0.4);
      }
    }
  },

  render(renderer, state, _alpha) {
    // _alpha: la altura de salto se toma directamente del estado del tick.
    const ctx = renderer as CanvasRenderingContext2D | null;
    if (!ctx || typeof ctx.clearRect !== 'function') return;
    const W = MOON_PATROL.width;
    const H = MOON_PATROL.height;
    const groundY = MOON_PATROL.groundY;

    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#050814';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#93a8d6';
    for (let i = 0; i < 46; i++) {
      const sx = (((i * 137 - state.scrollX * 0.25) % (W + 20)) + W + 20) % (W + 20) - 10;
      const sy = (i * 71) % (groundY - 30);
      ctx.globalAlpha = 0.35 + (i % 4) * 0.15;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#12182c';
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = '#0b1022';
    for (let i = 0; i < 10; i++) {
      const cx = (((i * 88 - state.scrollX * 0.5) % (W + 80)) + W + 80) % (W + 80) - 40;
      ctx.save();
      ctx.translate(cx, groundY + 18);
      ctx.scale(1, 0.32);
      ctx.beginPath();
      ctx.arc(0, 0, 12 + (i % 3) * 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = '#25f4e6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();

    for (const obstacle of state.obstacles) {
      if (obstacle.x + obstacle.w < -10 || obstacle.x > W + 10) continue;
      if (obstacle.kind === 'crater') {
        ctx.save();
        ctx.translate(obstacle.x + obstacle.w / 2, obstacle.y + 2);
        ctx.scale(1, 0.28);
        ctx.fillStyle = '#02040c';
        ctx.beginPath();
        ctx.arc(0, 0, obstacle.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = '#7b5cff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(obstacle.x, obstacle.y);
        ctx.lineTo(obstacle.x + obstacle.w, obstacle.y);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#ff4d6d';
        ctx.beginPath();
        ctx.moveTo(obstacle.x + obstacle.w / 2, obstacle.y - 8);
        ctx.lineTo(obstacle.x + obstacle.w, obstacle.y + obstacle.h);
        ctx.lineTo(obstacle.x, obstacle.y + obstacle.h);
        ctx.lineTo(obstacle.x + obstacle.w / 2, obstacle.y - 8);
        ctx.fill();
      }
    }

    for (const power of state.powerups) {
      ctx.save();
      ctx.translate(power.x + 8, power.y + 8);
      ctx.rotate(state.ticks * 0.06);
      ctx.strokeStyle = power.kind === 'triple' ? '#ffd166' : '#ff5cf0';
      ctx.lineWidth = 2;
      ctx.strokeRect(-8, -8, 16, 16);
      ctx.restore();
    }

    for (const enemy of state.enemies) {
      if (enemy.x < -30 || enemy.x > W + 30) continue;
      if (enemy.type === 'ufo') {
        ctx.fillStyle = '#b56bff';
        ctx.beginPath();
        ctx.arc(enemy.x + enemy.w / 2, enemy.y + 3, enemy.w / 2, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(enemy.x, enemy.y + 3, enemy.w, enemy.h - 3);
        ctx.strokeStyle = '#e6c8ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(enemy.x, enemy.y + 3, enemy.w, enemy.h - 3);
      } else {
        ctx.fillStyle = '#ff8a3d';
        ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
        ctx.fillStyle = '#050814';
        ctx.fillRect(enemy.x + 2, enemy.y + enemy.h, enemy.w / 4, 3);
        ctx.fillRect(enemy.x + enemy.w - 2 - enemy.w / 4, enemy.y + enemy.h, enemy.w / 4, 3);
      }
    }

    for (const bullet of state.bullets) {
      ctx.fillStyle = bullet.enemy ? '#ff3f6e' : '#fff3a0';
      ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
    }

    const py = state.player.y;
    ctx.fillStyle = '#24e6ff';
    ctx.fillRect(MOON_PATROL.playerX, py, MOON_PATROL.playerW, MOON_PATROL.playerH);
    ctx.fillStyle = '#050814';
    ctx.fillRect(MOON_PATROL.playerX + 3, py + MOON_PATROL.playerH, 6, 4);
    ctx.fillRect(MOON_PATROL.playerX + MOON_PATROL.playerW - 9, py + MOON_PATROL.playerH, 6, 4);
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(MOON_PATROL.playerX + MOON_PATROL.playerW - 4, py + 4);
    ctx.lineTo(MOON_PATROL.playerX + MOON_PATROL.playerW + 10, py + 4);
    ctx.stroke();
    if (!state.player.grounded) {
      ctx.fillStyle = '#ff8a3d';
      ctx.fillRect(MOON_PATROL.playerX + 4, py + MOON_PATROL.playerH + 3, 4, 6);
      ctx.fillRect(MOON_PATROL.playerX + MOON_PATROL.playerW - 8, py + MOON_PATROL.playerH + 3, 4, 6);
    }

    ctx.fillStyle = 'rgba(4, 6, 20, 0.8)';
    ctx.fillRect(0, 0, W, 32);
    ctx.font = '14px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7df9ff';
    ctx.fillText(`PTS ${state.score}`, 10, 21);
    ctx.textAlign = 'center';
    ctx.fillText(`SECTOR ${state.level + 1} · ${state.kills} BAJAS`, W / 2, 21);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.floor(state.distance)}m`, W - 10, 21);
    ctx.fillStyle = '#1b2440';
    ctx.fillRect(10, H - 8, 90, 4);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(10, H - 8, 90 * clamp(state.tripleTimer / MOON_PATROL.powerupDuration, 0, 1), 4);
    ctx.fillStyle = '#1b2440';
    ctx.fillRect(W - 100, H - 8, 90, 4);
    ctx.fillStyle = '#ff5cf0';
    ctx.fillRect(W - 100, H - 8, 90 * clamp(state.rapidTimer / MOON_PATROL.powerupDuration, 0, 1), 4);
    ctx.restore();
  },

  observe(state) {
    const nextThreat = state.enemies[0];
    const nextObstacle = state.obstacles[0];
    return new Float32Array([
      clamp(state.player.y / MOON_PATROL.height, 0, 1),
      clamp(state.player.vy / 500, -1, 1),
      state.player.grounded ? 1 : 0,
      nextThreat === undefined ? 1 : clamp((nextThreat.x - MOON_PATROL.playerX) / MOON_PATROL.width, 0, 1),
      nextThreat === undefined ? 1 : clamp((nextThreat.y - MOON_PATROL.groundY) / MOON_PATROL.height, -1, 1),
      nextObstacle === undefined ? 1 : clamp((nextObstacle.x - MOON_PATROL.playerX) / MOON_PATROL.width, 0, 1),
      clamp(state.enemies.length / MOON_PATROL.maxEnemies, 0, 1),
      clamp(state.distance / (MOON_PATROL.levelDistance * 3), 0, 1),
      state.over ? 1 : 0,
    ]);
  },

  rules: singlePlayerRules<MoonPatrolState>(
    (state) => state.score + state.kills * 10 + state.level * 100,
  ),
});
