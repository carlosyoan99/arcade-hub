import type { StepContext } from '../../core/simulation.js';
import { clamp, dist2 } from '../../core/math.js';
import { defineGame } from '../../game/contract.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import type { CollisionService } from '../../sim/collision.js';

/** Missile Command — 6 ciudades, 3 baterías, interceptores y explosiones radiales. */
export const MISSILE_COMMAND = {
  width: 800,
  height: 600,
  groundY: 570,
  cityRadius: 10,
  cities: 6,
  bases: 3,
  startAmmo: 30,
  ammoPerWave: 5,
  minAmmoPerBase: 2,
  abmSpeed: 550,
  blastRadius: 40,
  blastDuration: 0.4,
  aimSpeed: 480,
  cityPoints: 5,
  killPoints: 25,
  minIncomingInterval: 0.3,
  baseIncomingInterval: 1.2,
  incomingReduction: 0.05,
  waveEndDelay: 1.5,
} as const;

interface Incoming {
  x: number;
  y: number;
  vx: number;
  vy: number;
  split: boolean;
  splitDone: boolean;
}

interface Abm {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
}

interface Blast {
  x: number;
  y: number;
  timer: number;
}

export interface MissileCommandState {
  cursor: { x: number; y: number };
  cities: { x: number; alive: boolean }[];
  bases: { x: number; ammo: number }[];
  incoming: Incoming[];
  abms: Abm[];
  blasts: Blast[];
  score: number;
  wave: number;
  over: boolean;
  paused: boolean;
  ticks: number;
  progress: number;
  ammo: number;
  waveActive: boolean;
  waveTimer: number;
  toSpawn: number;
  incomingTimer: number;
  pattern: string;
  seed: number;
}

function citiesAlive(state: MissileCommandState): number {
  return state.cities.filter((city) => city.alive).length;
}

function initLevel(state: MissileCommandState): void {
  state.cities = [];
  const spacing = MISSILE_COMMAND.width / (MISSILE_COMMAND.cities + 1);
  for (let i = 0; i < MISSILE_COMMAND.cities; i++) {
    state.cities.push({ x: spacing * (i + 1), alive: true });
  }
  state.bases = [
    MISSILE_COMMAND.width * 0.15,
    MISSILE_COMMAND.width * 0.5,
    MISSILE_COMMAND.width * 0.85,
  ].map((x) => ({
    x,
    ammo: Math.max(
      MISSILE_COMMAND.minAmmoPerBase,
      Math.floor(MISSILE_COMMAND.startAmmo / MISSILE_COMMAND.bases),
    ),
  }));
  state.incoming = [];
  state.abms = [];
  state.blasts = [];
  state.ammo = MISSILE_COMMAND.startAmmo;
  state.incomingTimer = 0;
  state.waveTimer = 0;
  state.waveActive = false;
}

function startWave(state: MissileCommandState, ctx: StepContext): void {
  state.waveActive = true;
  state.ammo += MISSILE_COMMAND.ammoPerWave;
  for (const base of state.bases) {
    base.ammo = Math.max(
      MISSILE_COMMAND.minAmmoPerBase,
      Math.floor(state.ammo / MISSILE_COMMAND.bases),
    );
  }
  state.toSpawn = 8 + state.wave * 2;
  ctx.emit('levelUp', { wave: state.wave });
}

function reset(state: MissileCommandState, ctx: StepContext): void {
  state.score = 0;
  state.wave = 1;
  state.over = false;
  state.paused = false;
  state.ticks = 0;
  state.progress = 0;
  state.cursor.x = MISSILE_COMMAND.width / 2;
  state.cursor.y = MISSILE_COMMAND.height / 2;
  initLevel(state);
  startWave(state, ctx);
}

function spawnMissile(state: MissileCommandState, ctx: StepContext): void {
  const pattern = ctx.progression.nextPattern() ?? 'straight';
  const fromX = ctx.rng.range(0, MISSILE_COMMAND.width);
  const aliveCities = state.cities.filter((city) => city.alive);
  const cityChance = pattern === 'smart' ? 1 : 0.7;
  const targetX =
    aliveCities.length > 0 && ctx.rng.next() < cityChance
      ? (aliveCities[ctx.rng.int(aliveCities.length)]?.x ?? ctx.rng.range(0, MISSILE_COMMAND.width))
      : ctx.rng.range(0, MISSILE_COMMAND.width);
  const speed = 120 + state.wave * 8 + ctx.rng.range(0, 40);
  const distance = Math.hypot(targetX - fromX, MISSILE_COMMAND.groundY);
  state.incoming.push({
    x: fromX,
    y: 0,
    vx: ((targetX - fromX) / distance) * speed,
    vy: (MISSILE_COMMAND.groundY / distance) * speed,
    split: pattern === 'split' && ctx.rng.next() < 0.6,
    splitDone: false,
  });
}

function detonate(state: MissileCommandState, x: number, y: number, ctx: StepContext): void {
  state.blasts.push({ x, y, timer: MISSILE_COMMAND.blastDuration });
  ctx.emit('explode', { x, y, kind: 'abm' });
}

function nextWave(state: MissileCommandState, ctx: StepContext): void {
  const survivors = citiesAlive(state);
  const bonus = survivors * MISSILE_COMMAND.cityPoints * state.wave;
  state.score += bonus;
  state.progress += bonus + 200;
  ctx.emit('score', { score: state.score, points: bonus });
  state.wave++;
  initLevel(state);
  startWave(state, ctx);
}

export const missileCommandGame = defineGame<MissileCommandState>({
  id: 'missile-command',
  meta: { title: 'Missile Command', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['aimLeft', 'aimRight', 'aimUp', 'aimDown', 'fire', 'pause', 'restart'],
  progression: {
    id: 'missile-command',
    levels: [
      { speed: 1, spawnInterval: 110, hazard: 0, label: 'Ciudad 1' },
      { speed: 1.12, spawnInterval: 88, hazard: 0.2, label: 'Ciudad 2' },
      { speed: 1.25, spawnInterval: 68, hazard: 0.4, label: 'Ciudad 3' },
    ],
    pointsPerLevel: 600,
    dda: { enabled: true, window: 360, maxAdjust: 0.08 },
    patterns: ['straight', 'split', 'smart'],
    avoidRepeat: 2,
  },

  init(seed, _ctx) {
    const state: MissileCommandState = {
      cursor: { x: MISSILE_COMMAND.width / 2, y: MISSILE_COMMAND.height / 2 },
      cities: [],
      bases: [],
      incoming: [],
      abms: [],
      blasts: [],
      score: 0,
      wave: 1,
      over: false,
      paused: false,
      ticks: 0,
      progress: 0,
      ammo: MISSILE_COMMAND.startAmmo,
      waveActive: false,
      waveTimer: 0,
      toSpawn: 0,
      incomingTimer: 0,
      pattern: 'straight',
      seed,
    };
    reset(state, _ctx);
    return state;
  },

  step(state, ctx) {
    if (handleLifecycle(state, ctx, state.progress, () => reset(state, ctx))) return;
    const dt = ctx.clock.dt;
    const collision = ctx.services.get<CollisionService>('collision');
    const progress = ctx.progression.state;
    const speed = progress.speed;
    state.ticks++;

    if (ctx.actions.isDown('aimLeft')) state.cursor.x -= MISSILE_COMMAND.aimSpeed * dt;
    if (ctx.actions.isDown('aimRight')) state.cursor.x += MISSILE_COMMAND.aimSpeed * dt;
    if (ctx.actions.isDown('aimUp')) state.cursor.y -= MISSILE_COMMAND.aimSpeed * dt;
    if (ctx.actions.isDown('aimDown')) state.cursor.y += MISSILE_COMMAND.aimSpeed * dt;
    state.cursor.x = clamp(state.cursor.x, 0, MISSILE_COMMAND.width);
    state.cursor.y = clamp(state.cursor.y, 0, MISSILE_COMMAND.groundY - 10);

    if (ctx.actions.consume('fire') && state.waveActive && state.ammo > 0) {
      let base = state.bases[0];
      let best = Number.POSITIVE_INFINITY;
      for (const candidate of state.bases) {
        if (candidate.ammo <= 0) continue;
        const distance = Math.hypot(candidate.x - state.cursor.x, MISSILE_COMMAND.groundY - state.cursor.y);
        if (distance < best) {
          best = distance;
          base = candidate;
        }
      }
      if (base && base.ammo > 0) {
        base.ammo--;
        state.ammo--;
        const dx = state.cursor.x - base.x;
        const dy = state.cursor.y - MISSILE_COMMAND.groundY;
        const distance = Math.hypot(dx, dy) || 1;
        state.abms.push({
          x: base.x,
          y: MISSILE_COMMAND.groundY,
          vx: (dx / distance) * MISSILE_COMMAND.abmSpeed,
          vy: (dy / distance) * MISSILE_COMMAND.abmSpeed,
          targetX: state.cursor.x,
          targetY: state.cursor.y,
        });
        ctx.emit('shoot', { x: base.x, y: MISSILE_COMMAND.groundY, targetX: state.cursor.x });
      }
    }

    if (state.waveActive && state.toSpawn > 0) {
      state.incomingTimer -= dt * speed;
      if (state.incomingTimer <= 0) {
        spawnMissile(state, ctx);
        state.toSpawn--;
        const interval = Math.max(
          MISSILE_COMMAND.minIncomingInterval,
          MISSILE_COMMAND.baseIncomingInterval - state.wave * MISSILE_COMMAND.incomingReduction,
        );
        state.incomingTimer = interval * (0.5 + ctx.rng.next());
        if (state.wave > 3 && ctx.rng.next() < 0.3) spawnMissile(state, ctx);
        ctx.emit('hit', { kind: 'incoming', remaining: state.toSpawn });
      }
    }

    for (const abm of state.abms) {
      const step = MISSILE_COMMAND.abmSpeed * dt;
      const dx = abm.targetX - abm.x;
      const dy = abm.targetY - abm.y;
      if (Math.hypot(dx, dy) <= step) {
        abm.x = abm.targetX;
        abm.y = abm.targetY;
        abm.targetX = MISSILE_COMMAND.width + 1;
        detonate(state, abm.x, abm.y, ctx);
      } else {
        abm.x += abm.vx * dt;
        abm.y += abm.vy * dt;
      }
    }
    state.abms = state.abms.filter((abm) => abm.targetX <= MISSILE_COMMAND.width);

    for (let ei = state.incoming.length - 1; ei >= 0; ei--) {
      const missile = state.incoming[ei];
      if (!missile) continue;
      missile.x += missile.vx * speed * dt;
      missile.y += missile.vy * speed * dt;
      if (missile.split && !missile.splitDone && missile.y > MISSILE_COMMAND.height * 0.45) {
        missile.splitDone = true;
        state.incoming.push({
          x: missile.x,
          y: missile.y,
          vx: missile.vx + 30,
          vy: missile.vy,
          split: false,
          splitDone: true,
        });
        ctx.emit('hit', { kind: 'split', x: missile.x, y: missile.y });
      }
      if (missile.y < MISSILE_COMMAND.groundY) continue;
      const city = state.cities.find((candidate) =>
        candidate.alive && Math.abs(candidate.x - missile.x) < MISSILE_COMMAND.cityRadius * 2);
      if (city) {
        city.alive = false;
        ctx.emit('explode', { x: city.x, y: MISSILE_COMMAND.groundY, kind: 'city' });
        ctx.emit('hit', { kind: 'city', x: city.x });
        ctx.progression.observe(-0.8);
      } else {
        ctx.emit('explode', { x: missile.x, y: MISSILE_COMMAND.groundY, kind: 'ground' });
      }
      state.incoming.splice(ei, 1);
      if (citiesAlive(state) === 0) {
        state.over = true;
        ctx.emit('gameOver', { score: state.score });
        return;
      }
    }

    for (const blast of state.blasts) {
      blast.timer -= dt;
      for (let ei = state.incoming.length - 1; ei >= 0; ei--) {
        const missile = state.incoming[ei];
        if (!missile) continue;
        if (!collision.circleAabb(
          { x: missile.x, y: missile.y, r: 2 },
          {
            x: blast.x - MISSILE_COMMAND.blastRadius,
            y: blast.y - MISSILE_COMMAND.blastRadius,
            w: MISSILE_COMMAND.blastRadius * 2,
            h: MISSILE_COMMAND.blastRadius * 2,
          },
        )) continue;
        state.incoming.splice(ei, 1);
        state.score += MISSILE_COMMAND.killPoints;
        state.progress += MISSILE_COMMAND.killPoints;
        ctx.emit('hit', { x: missile.x, y: missile.y });
        ctx.emit('score', { score: state.score, points: MISSILE_COMMAND.killPoints });
        ctx.progression.observe(0.5);
      }
    }
    state.blasts = state.blasts.filter((blast) => blast.timer > 0);

    if (state.waveActive && state.toSpawn === 0 && state.incoming.length === 0) {
      state.waveTimer += dt;
      if (state.waveTimer > MISSILE_COMMAND.waveEndDelay) {
        state.waveTimer = 0;
        nextWave(state, ctx);
      }
    } else {
      state.waveTimer = 0;
    }
  },

  observe(state, playerId) {
    void playerId;
    let nearestX = 0;
    let nearestY = 0;
    let best = Number.POSITIVE_INFINITY;
    for (const missile of state.incoming) {
      const distance = dist2(missile.x, missile.y, state.cursor.x, state.cursor.y);
      if (distance < best) {
        best = distance;
        nearestX = missile.x;
        nearestY = missile.y;
      }
    }
    return new Float32Array([
      clamp((state.cursor.x / MISSILE_COMMAND.width) * 2 - 1, -1, 1),
      clamp((state.cursor.y / MISSILE_COMMAND.height) * 2 - 1, -1, 1),
      clamp((nearestX - state.cursor.x) / MISSILE_COMMAND.width, -1, 1),
      clamp((nearestY - state.cursor.y) / MISSILE_COMMAND.height, -1, 1),
      clamp((state.ammo / (MISSILE_COMMAND.startAmmo + MISSILE_COMMAND.ammoPerWave * 3)) * 2 - 1, -1, 1),
      clamp((citiesAlive(state) / MISSILE_COMMAND.cities) * 2 - 1, -1, 1),
      clamp((state.incoming.length / 16) * 2 - 1, -1, 1),
      clamp((state.abms.length / 4) * 2 - 1, -1, 1),
      clamp((state.blasts.length / 4) * 2 - 1, -1, 1),
    ]);
  },

  render(renderer, state, alpha) {
    void alpha; // Sin interpolación: el estado ya contiene las posiciones del frame.
    const ctx = renderer as CanvasRenderingContext2D | null;
    if (!ctx || typeof ctx.clearRect !== 'function') return;
    const { width, height, groundY } = MISSILE_COMMAND;
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, groundY, width, height - groundY);
    ctx.strokeStyle = '#5ef2ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    ctx.fillStyle = '#16233a';
    for (let i = 0; i < 40; i++) {
      ctx.fillRect((i * 181) % width, (i * 53) % (groundY - 120), 2, 2);
    }

    for (const city of state.cities) {
      if (city.alive) {
        ctx.fillStyle = '#5ef2ff';
        ctx.beginPath();
        ctx.moveTo(city.x - MISSILE_COMMAND.cityRadius, groundY);
        ctx.lineTo(city.x - 6, groundY - 12);
        ctx.lineTo(city.x + 6, groundY - 12);
        ctx.lineTo(city.x + MISSILE_COMMAND.cityRadius, groundY);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.strokeStyle = '#ff3fa4';
        ctx.beginPath();
        ctx.moveTo(city.x - 6, groundY - 12);
        ctx.lineTo(city.x + 6, groundY);
        ctx.moveTo(city.x + 6, groundY - 12);
        ctx.lineTo(city.x - 6, groundY);
        ctx.stroke();
      }
    }
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    for (const base of state.bases) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(base.x - 12, groundY);
      ctx.lineTo(base.x, groundY - 14);
      ctx.lineTo(base.x + 12, groundY);
      ctx.closePath();
      ctx.fill();
      ctx.fillText(String(base.ammo), base.x, groundY + 16);
    }

    ctx.lineWidth = 2;
    for (const missile of state.incoming) {
      ctx.strokeStyle = '#ff3fa4';
      ctx.beginPath();
      ctx.moveTo(missile.x - missile.vx * 0.08, missile.y - missile.vy * 0.08);
      ctx.lineTo(missile.x, missile.y);
      ctx.stroke();
    }
    for (const abm of state.abms) {
      ctx.strokeStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(abm.x - abm.vx * 0.06, abm.y - abm.vy * 0.06);
      ctx.lineTo(abm.x, abm.y);
      ctx.stroke();
    }
    // Explosiones radiales: destello breve calculado desde el temporizador del estado.
    for (const blast of state.blasts) {
      const progress = 1 - blast.timer / MISSILE_COMMAND.blastDuration;
      ctx.strokeStyle = '#ffb347';
      ctx.globalAlpha = Math.max(0, blast.timer / MISSILE_COMMAND.blastDuration);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(
        blast.x,
        blast.y,
        MISSILE_COMMAND.blastRadius * (0.25 + 0.75 * progress),
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (!state.over) {
      ctx.strokeStyle = '#5ef2ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(state.cursor.x - 12, state.cursor.y);
      ctx.lineTo(state.cursor.x + 12, state.cursor.y);
      ctx.moveTo(state.cursor.x, state.cursor.y - 12);
      ctx.lineTo(state.cursor.x, state.cursor.y + 12);
      ctx.stroke();
    }

    ctx.font = '16px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5ef2ff';
    ctx.fillText(`PTS ${state.score}`, 12, 24);
    ctx.fillText(`MUNICIÓN ${state.ammo}`, 12, 44);
    ctx.textAlign = 'right';
    ctx.fillText(`OLEADA ${state.wave}`, width - 12, 24);
    if (state.paused || state.over) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 32px monospace';
      ctx.fillStyle = '#ff3fa4';
      ctx.fillText(state.over ? 'FIN' : 'PAUSA', width / 2, height / 2);
    }
    ctx.restore();
  },
  rules: singlePlayerRules<MissileCommandState>(
    (state) =>
      state.score + state.wave * 80 + citiesAlive(state) * 25 + state.ammo - (state.over ? 200 : 0),
  ),
});
