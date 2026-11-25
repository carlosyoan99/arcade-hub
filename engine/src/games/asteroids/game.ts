import type { StepContext } from '../../core/simulation.js';
import { clamp, dist2, normalize2 } from '../../core/math.js';
import { defineGame } from '../../game/contract.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import type { CollisionService } from '../../sim/collision.js';

/** Asteroids — campo envolvente, inercia, fragmentación y sub-pasos anti-tunneling. */
export const ASTEROIDS = {
  width: 800,
  height: 600,
  wrapMargin: 50,
  rotationSpeed: 4.5,
  thrust: 320,
  friction: 0.992,
  maxSpeed: 500,
  bulletSpeed: 550,
  bulletLife: 1,
  fireCooldown: 0.15,
  shipRadius: 8,
  bulletRadius: 3,
  startLives: 3,
  baseAsteroids: 4,
  radii: [45, 25, 13],
  points: [20, 50, 100],
  invulnerable: 2,
  hyperCooldown: 5,
  hyperInvulnerable: 1.5,
  spawnSafeDistance: 150,
} as const;

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Bullet extends Body {
  life: number;
}

interface Asteroid extends Body {
  size: number;
  radius: number;
  points: number;
}

interface Ship extends Body {
  angle: number;
}

export interface AsteroidsState {
  ship: Ship;
  bullets: Bullet[];
  asteroids: Asteroid[];
  score: number;
  lives: number;
  wave: number;
  over: boolean;
  paused: boolean;
  ticks: number;
  progress: number;
  invuln: number;
  fireCd: number;
  hyperCd: number;
  spawnTimer: number;
  seed: number;
}

function wrap(entity: Body): void {
  const margin = ASTEROIDS.wrapMargin;
  const w = ASTEROIDS.width + margin * 2;
  const h = ASTEROIDS.height + margin * 2;
  entity.x = (((entity.x + margin) % w) + w) % w - margin;
  entity.y = (((entity.y + margin) % h) + h) % h - margin;
}

function spawnAsteroid(
  ctx: StepContext,
  x: number,
  y: number,
  size: number,
  vx?: number,
  vy?: number,
): Asteroid {
  const angle = ctx.rng.range(0, Math.PI * 2);
  const speed = ctx.rng.range(30, 90);
  const direction = normalize2(vx ?? Math.cos(angle) * speed, vy ?? Math.sin(angle) * speed);
  return {
    x,
    y,
    vx: direction.x * speed,
    vy: direction.y * speed,
    size,
    radius: ASTEROIDS.radii[size] ?? 13,
    points: ASTEROIDS.points[size] ?? 20,
  };
}

function spawnWave(state: AsteroidsState, ctx: StepContext): void {
  const progress = ctx.progression.state;
  const pattern = ctx.progression.nextPattern() ?? 'split';
  const count = ASTEROIDS.baseAsteroids + Math.floor(state.score / 200) + Math.round(progress.hazard * 2);
  for (let i = 0; i < count; i++) {
    let x = 0;
    let y = 0;
    for (let attempt = 0; attempt < 50; attempt++) {
      x = ctx.rng.range(0, ASTEROIDS.width);
      y = ctx.rng.range(0, ASTEROIDS.height);
      if (dist2(x, y, state.ship.x, state.ship.y) >= ASTEROIDS.spawnSafeDistance ** 2) break;
    }
    const size =
      pattern === 'split' && ctx.rng.next() < 0.4 ? 1 : ctx.rng.int(3);
    const asteroid = spawnAsteroid(ctx,x, y, size);
    if (pattern === 'drift') asteroid.vy *= 1.6;
    if (pattern === 'swarm') {
      asteroid.x = ASTEROIDS.width / 2 + (asteroid.x - ASTEROIDS.width / 2) * 0.4;
      asteroid.y = ASTEROIDS.height / 2 + (asteroid.y - ASTEROIDS.height / 2) * 0.4;
    }
    state.asteroids.push(asteroid);
  }
  if (state.wave > 0) ctx.emit('levelUp', { wave: state.wave, pattern });
}

function breakAsteroid(state: AsteroidsState, ctx: StepContext, asteroid: Asteroid): void {
  if (asteroid.size >= 2) return;
  const childSize = asteroid.size + 1;
  for (let i = 0; i < 2; i++) {
    const angle = ctx.rng.range(0, Math.PI * 2);
    const speed = 60 + ctx.rng.range(0, 40);
    state.asteroids.push(
      spawnAsteroid(
        ctx,
        asteroid.x,
        asteroid.y,
        childSize,
        Math.cos(angle) * speed + asteroid.vx * 0.5,
        Math.sin(angle) * speed + asteroid.vy * 0.5,
      ),
    );
  }
}

function reset(state: AsteroidsState, ctx: StepContext): void {
  state.score = 0;
  state.lives = ASTEROIDS.startLives;
  state.wave = 1;
  state.over = false;
  state.paused = false;
  state.ticks = 0;
  state.progress = 0;
  state.invuln = ASTEROIDS.invulnerable;
  state.fireCd = 0;
  state.hyperCd = 0;
  state.spawnTimer = 0;
  state.ship.x = ASTEROIDS.width / 2;
  state.ship.y = ASTEROIDS.height / 2;
  state.ship.vx = 0;
  state.ship.vy = 0;
  state.ship.angle = -Math.PI / 2;
  state.bullets = [];
  state.asteroids = [];
  spawnWave(state, ctx);
}

function loseLife(state: AsteroidsState, ctx: StepContext, x: number, y: number): void {
  state.lives--;
  ctx.emit('explode', { x, y, kind: 'ship' });
  ctx.progression.observe(-0.8);
  if (state.lives <= 0) {
    state.over = true;
    ctx.emit('gameOver', { score: state.score });
    return;
  }
  state.invuln = ASTEROIDS.invulnerable;
  state.ship.x = ASTEROIDS.width / 2;
  state.ship.y = ASTEROIDS.height / 2;
  state.ship.vx = 0;
  state.ship.vy = 0;
}

export const asteroidsGame = defineGame<AsteroidsState>({
  id: 'asteroids',
  meta: { title: 'Asteroids', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['left', 'right', 'thrust', 'fire', 'hyper', 'pause', 'restart'],
  progression: {
    id: 'asteroids',
    levels: [
      { speed: 1, spawnInterval: 240, hazard: 0, label: 'Oleada 1' },
      { speed: 1.1, spawnInterval: 200, hazard: 0.15, label: 'Oleada 2' },
      { speed: 1.2, spawnInterval: 165, hazard: 0.3, label: 'Oleada 3' },
      { speed: 1.35, spawnInterval: 130, hazard: 0.5, label: 'Oleada 4' },
    ],
    pointsPerLevel: 80,
    dda: { enabled: true, window: 360, maxAdjust: 0.08 },
    patterns: ['split', 'drift', 'swarm'],
    avoidRepeat: 2,
  },

  init(seed, ctx) {
    const state: AsteroidsState = {
      ship: { x: 400, y: 300, vx: 0, vy: 0, angle: -Math.PI / 2 },
      bullets: [],
      asteroids: [],
      score: 0,
      lives: ASTEROIDS.startLives,
      wave: 1,
      over: false,
      paused: false,
      ticks: 0,
      progress: 0,
      invuln: 0,
      fireCd: 0,
      hyperCd: 0,
      spawnTimer: 0,
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
    const ship = state.ship;
    state.ticks++;
    state.fireCd = Math.max(0, state.fireCd - dt);
    state.hyperCd = Math.max(0, state.hyperCd - dt);
    state.invuln = Math.max(0, state.invuln - dt);

    if (ctx.actions.isDown('left')) ship.angle -= ASTEROIDS.rotationSpeed * dt;
    if (ctx.actions.isDown('right')) ship.angle += ASTEROIDS.rotationSpeed * dt;
    if (ctx.actions.isDown('thrust')) {
      ship.vx += Math.cos(ship.angle) * ASTEROIDS.thrust * dt;
      ship.vy += Math.sin(ship.angle) * ASTEROIDS.thrust * dt;
    }
    const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
    if (speed > ASTEROIDS.maxSpeed) {
      ship.vx = (ship.vx / speed) * ASTEROIDS.maxSpeed;
      ship.vy = (ship.vy / speed) * ASTEROIDS.maxSpeed;
    }
    const friction = Math.pow(ASTEROIDS.friction, dt * 60);
    ship.vx *= friction;
    ship.vy *= friction;
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    wrap(ship);

    if (ctx.actions.isDown('fire') && state.fireCd <= 0) {
      const spread = ctx.rng.range(-0.025, 0.025);
      const angle = ship.angle + spread;
      state.bullets.push({
        x: ship.x + Math.cos(ship.angle) * 20,
        y: ship.y + Math.sin(ship.angle) * 20,
        vx: Math.cos(angle) * ASTEROIDS.bulletSpeed + ship.vx,
        vy: Math.sin(angle) * ASTEROIDS.bulletSpeed + ship.vy,
        life: ASTEROIDS.bulletLife,
      });
      state.fireCd = ASTEROIDS.fireCooldown;
      ctx.emit('shoot', { x: ship.x, y: ship.y });
    }

    if (ctx.actions.consume('hyper') && state.hyperCd <= 0) {
      ship.x = ctx.rng.range(30, ASTEROIDS.width - 30);
      ship.y = ctx.rng.range(30, ASTEROIDS.height - 30);
      ship.vx = 0;
      ship.vy = 0;
      state.hyperCd = ASTEROIDS.hyperCooldown;
      state.invuln = ASTEROIDS.hyperInvulnerable;
      ctx.emit('explode', { x: ship.x, y: ship.y, kind: 'hyper' });
      // Mejora documentada: riesgo de explosión al saltar.
      if (ctx.rng.next() < 0.1 + progress.hazard * 0.15) {
        loseLife(state, ctx, ship.x, ship.y);
        if (state.over) return;
      }
    }

    // Sub-pasos para balas rápidas: anti-tunneling sobre el radio pequeño (13 px).
    for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
      const bullet = state.bullets[bi];
      if (!bullet) continue;
      const maxStep = ASTEROIDS.bulletSpeed * dt;
      const steps = Math.max(1, Math.ceil(maxStep / (13 * 0.3)));
      let consumed = false;
      for (let sub = 0; sub < steps && !consumed; sub++) {
        bullet.x += (bullet.vx * dt) / steps;
        bullet.y += (bullet.vy * dt) / steps;
        for (let ai = state.asteroids.length - 1; ai >= 0; ai--) {
          const asteroid = state.asteroids[ai];
          if (!asteroid) continue;
          if (!collision.circleAabb(
            { x: bullet.x, y: bullet.y, r: ASTEROIDS.bulletRadius },
            {
              x: asteroid.x - asteroid.radius,
              y: asteroid.y - asteroid.radius,
              w: asteroid.radius * 2,
              h: asteroid.radius * 2,
            },
          )) continue;
          const points = asteroid.points;
          state.score += points;
          state.progress += points;
          ctx.emit('hit', { x: asteroid.x, y: asteroid.y });
          ctx.emit('explode', { x: asteroid.x, y: asteroid.y, size: asteroid.size });
          ctx.emit('score', { score: state.score, points });
          ctx.progression.observe(0.4);
          breakAsteroid(state, ctx, asteroid);
          state.asteroids.splice(ai, 1);
          state.bullets.splice(bi, 1);
          consumed = true;
          break;
        }
      }
    }
    for (const bullet of state.bullets) {
      bullet.life -= dt;
      wrap(bullet);
    }
    state.bullets = state.bullets.filter((bullet) => bullet.life > 0);

    for (const asteroid of state.asteroids) {
      asteroid.x += asteroid.vx * progress.speed * dt;
      asteroid.y += asteroid.vy * progress.speed * dt;
      wrap(asteroid);
    }

    if (progress.hazard > 0 && state.ticks >= state.spawnTimer && state.asteroids.length < 12) {
      const asteroid = spawnAsteroid(ctx,ctx.rng.range(0, ASTEROIDS.width), 0, 2);
      state.asteroids.push(asteroid);
      state.spawnTimer = state.ticks + (progress.spawnInterval ?? 200);
      ctx.emit('hit', { kind: 'reinforcement' });
    }

    if (state.invuln <= 0) {
      for (const asteroid of state.asteroids) {
        if (!collision.circleAabb(
          { x: ship.x, y: ship.y, r: ASTEROIDS.shipRadius },
          {
            x: asteroid.x - asteroid.radius,
            y: asteroid.y - asteroid.radius,
            w: asteroid.radius * 2,
            h: asteroid.radius * 2,
          },
        )) continue;
        loseLife(state, ctx, ship.x, ship.y);
        if (state.over) return;
        break;
      }
    }

    if (state.asteroids.length === 0) {
      state.wave++;
      state.progress += 40;
      spawnWave(state, ctx);
    }
  },

  observe(state, playerId) {
    void playerId;
    const ship = state.ship;
    let nearest = 1;
    for (const asteroid of state.asteroids) {
      const d = Math.sqrt(dist2(ship.x, ship.y, asteroid.x, asteroid.y));
      nearest = Math.min(nearest, d / ASTEROIDS.width);
    }
    return new Float32Array([
      clamp((ship.x / ASTEROIDS.width) * 2 - 1, -1, 1),
      clamp((ship.y / ASTEROIDS.height) * 2 - 1, -1, 1),
      clamp(ship.vx / ASTEROIDS.maxSpeed, -1, 1),
      clamp(ship.vy / ASTEROIDS.maxSpeed, -1, 1),
      Math.cos(ship.angle),
      Math.sin(ship.angle),
      clamp(state.bullets.length / 8, 0, 1) * 2 - 1,
      clamp(state.asteroids.length / 16, 0, 1) * 2 - 1,
      clamp(nearest * 2 - 1, -1, 1),
      state.invuln > 0 ? 1 : -1,
      clamp((state.lives / ASTEROIDS.startLives) * 2 - 1, -1, 1),
    ]);
  },

  rules: singlePlayerRules<AsteroidsState>(
    (state) =>
      state.score + state.wave * 50 + state.lives * 20 + state.ticks / 600 - (state.over ? 120 : 0),
  ),
});
