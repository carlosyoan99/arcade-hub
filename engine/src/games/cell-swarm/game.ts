import { defineGame } from '../../game/contract.js';
import type { StepContext } from '../../core/simulation.js';
import { clamp, dist2, normalize2 } from '../../core/math.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';

export const SWARM = {
  world: 5000,
  foodCount: 600,
  botCount: 20,
  virusCount: 8,
  chaserCount: 15,
  minMass: 10,
  splitMinMass: 36,
  ejectMinMass: 16,
  ejectAmount: 5,
  splitDuration: 5,
  virusMass: 120,
  virusRadius: 35,
  chaserMass: 5,
  baseSpeed: 300,
  boostMult: 1.8,
  boostCost: 8,
  decayRate: 0.015,
  decayMin: 12,
  maxLives: 1,
} as const;

type Personality = 'aggressive' | 'timid' | 'balanced' | 'hunter' | 'coward';
const PERSONALITIES: readonly Personality[] = ['aggressive', 'timid', 'balanced', 'hunter', 'coward'];
const MODIFIERS: Record<Personality, { chase: number; flee: number; min: number; ratio: number }> = {
  aggressive: { chase: 1.4, flee: 0.7, min: 12, ratio: 1.1 },
  timid: { chase: 0.6, flee: 1.5, min: 30, ratio: 1.25 },
  balanced: { chase: 1, flee: 1, min: 20, ratio: 1.15 },
  hunter: { chase: 1.6, flee: 0.5, min: 8, ratio: 1.05 },
  coward: { chase: 0.3, flee: 1.8, min: 50, ratio: 1.35 },
};

export interface Cell {
  x: number;
  y: number;
  mass: number;
  mergeTimer: number;
}
export interface Bot extends Cell {
  targetX: number;
  targetY: number;
  personality: Personality;
  state: number;
  stateTimer: number;
  aiTimer: number;
}
export interface Food {
  x: number;
  y: number;
  mass: number;
}
export interface Virus {
  x: number;
  y: number;
  mass: number;
  radius: number;
}
export interface Chaser {
  x: number;
  y: number;
  mass: number;
  vx: number;
  vy: number;
  life: number;
}
export interface Projectile extends Cell {
  vx: number;
  vy: number;
  life: number;
}
export interface Blob {
  x: number;
  y: number;
  mass: number;
  vx: number;
  vy: number;
  life: number;
}
export interface SwarmState {
  cells: Cell[];
  foods: Food[];
  bots: Bot[];
  viruses: Virus[];
  chasers: Chaser[];
  projectiles: Projectile[];
  blobs: Blob[];
  /** Timers de reaparición en ticks (B6: sin setTimeout). */
  timers: number[];
  targetX: number;
  targetY: number;
  boosting: boolean;
  kills: number;
  eatKills: number;
  gained: number;
  bestMass: number;
  score: number;
  level: number;
  progress: number;
  paused: boolean;
  over: boolean;
  ticks: number;
  pattern: string | null;
}

function radius(mass: number): number {
  return Math.max(5, 4 * Math.sqrt(Math.max(1, mass)));
}
function worldPos(ctx: StepContext, margin: number): { x: number; y: number } {
  return {
    x: ctx.rng.range(margin, SWARM.world - margin),
    y: ctx.rng.range(margin, SWARM.world - margin),
  };
}
function spawnFood(ctx: StepContext): Food {
  const pos = worldPos(ctx, 20);
  return { x: pos.x, y: pos.y, mass: 1 + ctx.rng.next() * 2 };
}
function spawnVirus(ctx: StepContext): Virus {
  const pos = worldPos(ctx, 200);
  return { x: pos.x, y: pos.y, mass: SWARM.virusMass, radius: SWARM.virusRadius };
}
function spawnChaser(ctx: StepContext): Chaser {
  const pos = worldPos(ctx, 50);
  return {
    x: pos.x,
    y: pos.y,
    mass: SWARM.chaserMass,
    vx: ctx.rng.range(-80, 80),
    vy: ctx.rng.range(-80, 80),
    life: 12,
  };
}
function spawnBot(ctx: StepContext, pattern: string | null): Bot {
  const pos = worldPos(ctx, 100);
  const personality = pattern === 'hunt'
    ? ctx.rng.next() < 0.6 ? 'hunter' : 'aggressive'
    : PERSONALITIES[ctx.rng.int(PERSONALITIES.length)] ?? 'balanced';
  return {
    x: pos.x,
    y: pos.y,
    mass: ctx.rng.range(10, 60),
    mergeTimer: 0,
    targetX: pos.x,
    targetY: pos.y,
    personality,
    state: 0,
    stateTimer: 0,
    aiTimer: 0,
  };
}

function startLevel(state: SwarmState, ctx: StepContext): void {
  state.pattern = ctx.progression.nextPattern();
  const hazard = ctx.progression.state.hazard;
  const start = worldPos(ctx, 200);
  state.cells = [{ x: start.x, y: start.y, mass: SWARM.minMass, mergeTimer: 0 }];
  state.targetX = start.x;
  state.targetY = start.y;
  state.foods = Array.from({ length: SWARM.foodCount }, () => spawnFood(ctx));
  state.bots = Array.from({ length: SWARM.botCount }, () => spawnBot(ctx, state.pattern));
  state.viruses = Array.from(
    { length: SWARM.virusCount + Math.round(hazard * 4) },
    () => spawnVirus(ctx),
  );
  state.chasers = Array.from({ length: SWARM.chaserCount }, () => spawnChaser(ctx));
  state.projectiles = [];
  state.blobs = [];
  state.timers = [];
  state.boosting = false;
  ctx.emit('spawn', { level: state.level, pattern: state.pattern });
}

function resetGame(state: SwarmState, ctx: StepContext): void {
  state.kills = 0;
  state.eatKills = 0;
  state.gained = 0;
  state.bestMass = 0;
  state.score = 0;
  state.level = 1;
  state.progress = 0;
  state.over = false;
  startLevel(state, ctx);
}

function moveCell(cell: Cell, dt: number, targetX: number, targetY: number, player: boolean, boosting: boolean): void {
  const speed = player
    ? Math.max(60, (SWARM.baseSpeed * 3 * (boosting ? SWARM.boostMult : 1)) / Math.sqrt(cell.mass / 10))
    : Math.max(50, (SWARM.baseSpeed * 2.5) / Math.sqrt(cell.mass / 10));
  const direction = normalize2(targetX - cell.x, targetY - cell.y);
  if (dist2(targetX, targetY, cell.x, cell.y) > 25) {
    const step = Math.min(speed * dt, Math.hypot(targetX - cell.x, targetY - cell.y) * 0.9);
    cell.x += direction.x * step;
    cell.y += direction.y * step;
  }
  cell.x = clamp(cell.x, radius(cell.mass), SWARM.world - radius(cell.mass));
  cell.y = clamp(cell.y, radius(cell.mass), SWARM.world - radius(cell.mass));
  if (cell.mergeTimer > 0) cell.mergeTimer -= dt;
}

function canEat(eater: Cell, prey: Cell): boolean {
  if (eater.mass < prey.mass * 1.15) return false;
  return dist2(eater.x, eater.y, prey.x, prey.y) < (radius(eater.mass) - radius(prey.mass) * 0.5) ** 2;
}

function updateBotAI(bot: Bot, state: SwarmState, dt: number, ctx: StepContext): void {
  bot.aiTimer -= dt;
  if (bot.aiTimer > 0) return;
  bot.aiTimer = 0.3 + ctx.rng.next() * 0.4;
  const mod = MODIFIERS[bot.personality];

  let threat: Cell | null = null;
  let threatDist = Infinity;
  let prey: Cell | null = null;
  let preyDist = Infinity;
  let food: Food | null = null;
  let foodDist = Infinity;
  const all: Cell[] = [...state.cells, ...state.bots];
  for (const other of all) {
    if (other === bot) continue;
    const distance = Math.sqrt(dist2(bot.x, bot.y, other.x, other.y));
    const ratio = other.mass / bot.mass;
    if (ratio > mod.ratio && distance < 600 * mod.flee && distance < threatDist) {
      threat = other;
      threatDist = distance;
    } else if (ratio < 1 / mod.ratio && distance < 500 * mod.chase && distance < preyDist) {
      prey = other;
      preyDist = distance;
    }
  }
  for (const item of state.foods) {
    const distance = dist2(bot.x, bot.y, item.x, item.y);
    if (distance < foodDist && distance < 400 * 400) {
      food = item;
      foodDist = distance;
    }
  }
  if (threat !== null && threatDist < 350 * mod.flee) {
    bot.state = 3;
    const direction = normalize2(bot.x - threat.x, bot.y - threat.y);
    bot.targetX = bot.x + direction.x * 300;
    bot.targetY = bot.y + direction.y * 300;
  } else if (prey !== null && preyDist < 300 * mod.chase && bot.mass > mod.min) {
    bot.state = 2;
    bot.targetX = prey.x;
    bot.targetY = prey.y;
  } else if (food !== null) {
    bot.state = 1;
    bot.targetX = food.x;
    bot.targetY = food.y;
  } else {
    bot.state = 0;
    if (bot.stateTimer <= 0) {
      bot.targetX = clamp(bot.x + ctx.rng.range(-300, 300), 30, SWARM.world - 30);
      bot.targetY = clamp(bot.y + ctx.rng.range(-300, 300), 30, SWARM.world - 30);
      bot.stateTimer = 1.5 + ctx.rng.next() * 2;
    }
    bot.stateTimer -= dt;
  }
  bot.targetX = clamp(bot.targetX, 30, SWARM.world - 30);
  bot.targetY = clamp(bot.targetY, 30, SWARM.world - 30);
}

function processEating(state: SwarmState, ctx: StepContext): void {
  for (const bot of state.bots) {
    for (let i = state.foods.length - 1; i >= 0; i--) {
      const food = state.foods[i];
      if (food === undefined) continue;
      if (dist2(bot.x, bot.y, food.x, food.y) < radius(bot.mass) ** 2) {
        bot.mass += food.mass;
        state.foods.splice(i, 1);
        state.foods.push(spawnFood(ctx));
      }
    }
  }
  for (const cell of state.cells) {
    for (let i = state.foods.length - 1; i >= 0; i--) {
      const food = state.foods[i];
      if (food === undefined) continue;
      if (dist2(cell.x, cell.y, food.x, food.y) < radius(cell.mass) ** 2) {
        cell.mass += food.mass;
        state.gained += food.mass;
        state.foods.splice(i, 1);
        state.foods.push(spawnFood(ctx));
        ctx.emit('eat', { mass: food.mass });
      }
    }
    for (let i = state.bots.length - 1; i >= 0; i--) {
      const bot = state.bots[i];
      if (bot === undefined || !canEat(cell, bot)) continue;
      cell.mass += bot.mass * 0.8;
      state.gained += bot.mass * 0.8;
      state.kills++;
      state.eatKills++;
      state.bots.splice(i, 1);
      state.timers.push(Math.round((2 + ctx.rng.next() * 3) * 60));
      ctx.emit('eatBot', { personality: bot.personality });
      ctx.progression.observe(0.6);
    }
  }
  for (const bot of state.bots) {
    for (let i = state.cells.length - 1; i >= 0; i--) {
      const cell = state.cells[i];
      if (cell === undefined || !canEat(bot, cell)) continue;
      bot.mass += cell.mass * 0.8;
      state.cells.splice(i, 1);
      ctx.emit('cellLost', { mass: cell.mass });
      ctx.progression.observe(-0.8);
    }
  }
  for (let i = state.bots.length - 1; i >= 0; i--) {
    const eater = state.bots[i];
    if (eater === undefined) continue;
    for (let j = state.bots.length - 1; j >= 0; j--) {
      if (i === j) continue;
      const prey = state.bots[j];
      if (prey === undefined || !canEat(eater, prey)) continue;
      eater.mass += prey.mass * 0.8;
      state.bots.splice(j, 1);
      state.timers.push(Math.round((3 + ctx.rng.next() * 4) * 60));
      if (j < i) i--;
    }
  }
  for (let i = state.blobs.length - 1; i >= 0; i--) {
    const blob = state.blobs[i];
    if (blob === undefined) continue;
    for (const consumer of [...state.cells, ...state.bots]) {
      if (dist2(consumer.x, consumer.y, blob.x, blob.y) < radius(consumer.mass) ** 2) {
        consumer.mass += blob.mass;
        state.blobs.splice(i, 1);
        break;
      }
    }
  }
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const projectile = state.projectiles[i];
    if (projectile === undefined) continue;
    for (let j = state.bots.length - 1; j >= 0; j--) {
      const bot = state.bots[j];
      if (bot === undefined || bot.mass >= projectile.mass * 1.15) continue;
      if (dist2(projectile.x, projectile.y, bot.x, bot.y) >= (radius(projectile.mass) + radius(bot.mass)) ** 2) continue;
      projectile.mass += bot.mass * 0.8;
      state.bots.splice(j, 1);
      state.kills++;
      state.timers.push(Math.round((2 + ctx.rng.next() * 3) * 60));
      ctx.emit('splitKill', {});
    }
  }
  for (const cell of state.cells) {
    for (const virus of state.viruses) {
      if (cell.mass <= SWARM.virusMass * 0.9) continue;
      if (dist2(cell.x, cell.y, virus.x, virus.y) >= (radius(cell.mass) + virus.radius * 0.6) ** 2) continue;
      const piece = cell.mass / 4;
      cell.mass = piece;
      cell.mergeTimer = SWARM.splitDuration;
      for (let k = 0; k < 3 && state.cells.length < 8; k++) {
        const angle = (Math.PI * 2 * k) / 3 + ctx.rng.range(-0.4, 0.4);
        state.cells.push({
          x: cell.x + Math.cos(angle) * 30,
          y: cell.y + Math.sin(angle) * 30,
          mass: piece * 0.8,
          mergeTimer: SWARM.splitDuration,
        });
      }
      ctx.emit('virus', {});
      ctx.progression.observe(-0.4);
      break;
    }
  }
  for (const cell of state.cells) {
    for (let i = state.chasers.length - 1; i >= 0; i--) {
      const chaser = state.chasers[i];
      if (chaser === undefined) continue;
      if (dist2(cell.x, cell.y, chaser.x, chaser.y) >= (radius(cell.mass) + radius(chaser.mass)) ** 2) continue;
      cell.mass += state.boosting ? chaser.mass * 3 : chaser.mass;
      state.chasers.splice(i, 1);
      state.timers.push(Math.round((5 + ctx.rng.next() * 5) * 60));
      ctx.emit('chaser', {});
    }
  }
  for (const cell of [...state.cells, ...state.bots]) {
    if (cell.mass > SWARM.decayMin) cell.mass -= cell.mass * SWARM.decayRate * (1 / 60);
  }
}

export const cellSwarmGame = defineGame<SwarmState>({
  id: 'cell-swarm',
  meta: { title: 'Cell Swarm', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['up', 'down', 'left', 'right', 'split', 'eject', 'boost', 'pause', 'restart'],
  progression: {
    id: 'cell-swarm',
    levels: [
      { speed: 1, spawnInterval: 60, hazard: 0, label: 'Masa 1' },
      { speed: 1.1, spawnInterval: 50, hazard: 0.2, label: 'Masa 2' },
      { speed: 1.25, spawnInterval: 40, hazard: 0.4, label: 'Masa 3' },
    ],
    pointsPerLevel: 100,
    dda: { enabled: true, window: 400, maxAdjust: 0.08 },
    patterns: ['split', 'eject', 'hunt'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    const state: SwarmState = {
      cells: [],
      foods: [],
      bots: [],
      viruses: [],
      chasers: [],
      projectiles: [],
      blobs: [],
      timers: [],
      targetX: 0,
      targetY: 0,
      boosting: false,
      kills: 0,
      eatKills: 0,
      gained: 0,
      bestMass: 0,
      score: 0,
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

    let dx = 0;
    let dy = 0;
    if (ctx.actions.isDown('up')) dy = -1;
    else if (ctx.actions.isDown('down')) dy = 1;
    else if (ctx.actions.isDown('left')) dx = -1;
    else if (ctx.actions.isDown('right')) dx = 1;
    const direction = normalize2(dx, dy);
    const main = state.cells[0];
    if (main !== undefined && (dx !== 0 || dy !== 0)) {
      state.targetX = main.x + direction.x * 400;
      state.targetY = main.y + direction.y * 400;
    }

    state.boosting = ctx.actions.isDown('boost');
    if (state.boosting && main !== undefined && main.mass > 30) {
      main.mass = Math.max(SWARM.minMass, main.mass - SWARM.boostCost * dt);
      ctx.emit('boost', {});
    }

    if (ctx.actions.consume('split') && state.cells.length < 4 && main !== undefined && main.mass >= SWARM.splitMinMass) {
      const half = main.mass / 2;
      main.mass = half;
      main.mergeTimer = SWARM.splitDuration;
      state.projectiles.push({
        x: main.x,
        y: main.y,
        mass: half,
        mergeTimer: SWARM.splitDuration,
        vx: direction.x * 600,
        vy: direction.y * 600,
        life: 2.5,
      });
      ctx.emit('split', {});
    }
    if (ctx.actions.consume('eject') && main !== undefined && main.mass >= SWARM.ejectMinMass + SWARM.ejectAmount) {
      main.mass -= SWARM.ejectAmount;
      state.blobs.push({
        x: main.x + direction.x * radius(main.mass),
        y: main.y + direction.y * radius(main.mass),
        mass: SWARM.ejectAmount,
        vx: direction.x * 250 + ctx.rng.range(-30, 30),
        vy: direction.y * 250 + ctx.rng.range(-30, 30),
        life: 4,
      });
      ctx.emit('eject', {});
    }

    for (const cell of state.cells) moveCell(cell, dt, state.targetX, state.targetY, true, state.boosting);
    for (const bot of state.bots) {
      updateBotAI(bot, state, dt, ctx);
      moveCell(bot, dt, bot.targetX, bot.targetY, false, false);
    }

    for (let i = state.chasers.length - 1; i >= 0; i--) {
      const chaser = state.chasers[i];
      if (chaser === undefined) continue;
      chaser.x += chaser.vx * dt;
      chaser.y += chaser.vy * dt;
      chaser.life -= dt;
      for (const cell of [...state.cells, ...state.bots]) {
        if (dist2(cell.x, cell.y, chaser.x, chaser.y) > 200 * 200 || cell.mass <= chaser.mass * 2) continue;
        const away = normalize2(chaser.x - cell.x, chaser.y - cell.y);
        chaser.vx += away.x * 150 * dt;
        chaser.vy += away.y * 150 * dt;
      }
      chaser.x = clamp(chaser.x, 5, SWARM.world - 5);
      chaser.y = clamp(chaser.y, 5, SWARM.world - 5);
      if (chaser.life <= 0) {
        state.chasers.splice(i, 1);
        state.timers.push(Math.round((3 + ctx.rng.next() * 4) * 60));
      }
    }

    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const projectile = state.projectiles[i];
      if (projectile === undefined) continue;
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.vx *= 0.98;
      projectile.vy *= 0.98;
      projectile.life -= dt;
      projectile.mergeTimer -= dt;
      projectile.x = clamp(projectile.x, radius(projectile.mass), SWARM.world - radius(projectile.mass));
      projectile.y = clamp(projectile.y, radius(projectile.mass), SWARM.world - radius(projectile.mass));
      if (projectile.mergeTimer <= 0 || projectile.life <= 0) {
        const owner = state.cells[0];
        if (owner !== undefined) owner.mass += projectile.mass;
        state.projectiles.splice(i, 1);
        ctx.emit('merge', {});
      }
    }
    for (let i = state.blobs.length - 1; i >= 0; i--) {
      const blob = state.blobs[i];
      if (blob === undefined) continue;
      blob.x += blob.vx * dt;
      blob.y += blob.vy * dt;
      blob.vx *= 0.96;
      blob.vy *= 0.96;
      blob.life -= dt;
      if (blob.life <= 0) state.blobs.splice(i, 1);
    }

    processEating(state, ctx);

    for (let i = state.timers.length - 1; i >= 0; i--) {
      const remaining = (state.timers[i] ?? 0) - 1;
      if (remaining <= 0) {
        state.timers.splice(i, 1);
        if (state.bots.length < SWARM.botCount) state.bots.push(spawnBot(ctx, state.pattern));
        else if (state.chasers.length < SWARM.chaserCount) state.chasers.push(spawnChaser(ctx));
      } else {
        state.timers[i] = remaining;
      }
    }

    if (state.cells.length === 0) {
      state.over = true;
      ctx.emit('gameOver', { score: state.score });
      return;
    }

    const totalMass = state.cells.reduce((sum, cell) => sum + cell.mass, 0);
    state.bestMass = Math.max(state.bestMass, totalMass);
    state.score = Math.floor(totalMass) + state.kills * 50;
    if (state.gained >= (state.level + 1) * 100) {
      state.level++;
      state.progress = state.gained;
      state.score += 500;
      ctx.emit('levelUp', { level: state.level });
      startLevel(state, ctx);
    }
    state.ticks++;
  },

  observe(state) {
    const main = state.cells[0];
    let nearest = Infinity;
    let dx = 0;
    let dy = 0;
    for (const bot of state.bots) {
      const distance = dist2(bot.x, bot.y, main?.x ?? 0, main?.y ?? 0);
      if (distance < nearest) {
        nearest = distance;
        dx = (bot.x - (main?.x ?? 0)) / SWARM.world;
        dy = (bot.y - (main?.y ?? 0)) / SWARM.world;
      }
    }
    return new Float32Array([
      (main?.x ?? 0) / SWARM.world,
      (main?.y ?? 0) / SWARM.world,
      clamp((main?.mass ?? 0) / 300, 0, 1),
      clamp(dx, -1, 1),
      clamp(dy, -1, 1),
      Math.sqrt(nearest) / SWARM.world,
      clamp(state.cells.length / 4, 0, 1),
      clamp(state.viruses.length / 12, 0, 1),
    ]);
  },

  rules: singlePlayerRules<SwarmState>(
    (state) => state.score + state.kills * 50 - (state.over ? 500 : 0),
  ),
});
