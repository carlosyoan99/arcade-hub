import type { StepContext } from '../../core/simulation.js';
import { clamp, dist2, lerp, normalize2 } from '../../core/math.js';
import { defineGame } from '../../game/contract.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import type { CollisionService } from '../../sim/collision.js';

/** Galaga — 8 formaciones, 4 entradas, bonus stage y rayo tractor con rescate. */
export const GALAGA = {
  width: 800,
  height: 600,
  shipY: 555,
  shipSpeed: 350,
  shipMargin: 15,
  bulletSpeed: 520,
  enemyBulletSpeed: 200,
  fireCooldown: 0.28,
  cols: 10,
  rows: 5,
  enemyW: 24,
  enemyH: 20,
  gapX: 6,
  gapY: 6,
  formationY: 45,
  startLives: 3,
  minDiveInterval: 0.8,
  diveReduction: 0.08,
  diveSpeedMult: 0.6,
  maxDivers: 2,
  diversPerGroup: 3,
  beamDescentY: 600 * 0.42,
  beamTime: 3.2,
  beamHalfWidth: 48,
  beamCooldown: 9,
  scoreBeamKill: 300,
  scoreRescue: 500,
  bonusEvery: 5,
  bonusDuration: 15,
  bonusEnemyCount: 40,
  bonusFlightSpeed: 160,
  invulnerable: 2,
} as const;

type EnemyType = 'boss' | 'bee' | 'butterfly';
type FormationName =
  | 'classic'
  | 'diamond'
  | 'arrow'
  | 'chevron'
  | 'v'
  | 'hourglass'
  | 'scatter'
  | 'silhouette';

interface Enemy {
  id: number;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  row: number;
  col: number;
  type: EnemyType;
  hp: number;
  points: number;
  alive: boolean;
  diving: boolean;
  entering: boolean;
  entryStartX: number;
  entryStartY: number;
  entryMidX: number;
  entryMidY: number;
  hasMid: boolean;
  entryProgress: number;
  entrySpeed: number;
  hasCaptive: boolean;
  beam: boolean;
  beamX: number;
  fireTimer: number;
}

interface Bullet {
  x: number;
  y: number;
  friendly: boolean;
}

interface Beam {
  enemyId: number;
  phase: 'descend' | 'beam';
  t: number;
  beamX: number;
}

interface BonusFighter {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: number;
  phase: number;
  type: EnemyType;
  points: number;
  alive: boolean;
}

interface EntryGroup {
  type: EnemyType;
  row: number;
  side: 'left' | 'right' | 'top' | 'bottom';
  cols: number[];
}

interface EntryState {
  groups: EntryGroup[];
  groupIndex: number;
  spawnIndex: number;
  timer: number;
  spawned: number;
  total: number;
}

export interface GalagaState {
  shipX: number;
  bullets: Bullet[];
  enemies: Enemy[];
  beam: Beam | null;
  beamCooldown: number;
  bonusFighters: BonusFighter[];
  bonusTimer: number;
  bonusKills: number;
  entry: EntryState | null;
  formationDir: number;
  formationTimer: number;
  diveTimer: number;
  score: number;
  lives: number;
  wave: number;
  over: boolean;
  paused: boolean;
  ticks: number;
  progress: number;
  fireCd: number;
  invuln: number;
  doubleShot: boolean;
  extraLivesGiven: number;
  pattern: string;
  nextId: number;
  seed: number;
}

const FORMATIONS: readonly FormationName[] = [
  'classic',
  'diamond',
  'arrow',
  'chevron',
  'v',
  'hourglass',
  'scatter',
  'silhouette',
];

const ENTRY_SEQUENCES: readonly (readonly EntryGroup[])[] = [
  [
    { type: 'butterfly', row: 3, side: 'left', cols: [0, 1, 2, 3, 4] },
    { type: 'butterfly', row: 4, side: 'right', cols: [5, 6, 7, 8, 9] },
    { type: 'bee', row: 1, side: 'left', cols: [0, 1, 2, 3, 4] },
    { type: 'bee', row: 2, side: 'right', cols: [5, 6, 7, 8, 9] },
    { type: 'boss', row: 0, side: 'top', cols: [3, 4, 5, 6] },
  ],
  [
    { type: 'boss', row: 0, side: 'bottom', cols: [2, 3, 4, 5, 6, 7] },
    { type: 'bee', row: 1, side: 'bottom', cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
    { type: 'bee', row: 2, side: 'bottom', cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
    { type: 'butterfly', row: 3, side: 'bottom', cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
    { type: 'butterfly', row: 4, side: 'bottom', cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
  ],
  [
    { type: 'butterfly', row: 3, side: 'left', cols: [0, 1, 2, 3, 4] },
    { type: 'butterfly', row: 4, side: 'left', cols: [5, 6, 7, 8, 9] },
    { type: 'bee', row: 1, side: 'right', cols: [0, 1, 2, 3, 4] },
    { type: 'bee', row: 2, side: 'right', cols: [5, 6, 7, 8, 9] },
    { type: 'boss', row: 0, side: 'left', cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
  ],
  [
    { type: 'boss', row: 0, side: 'left', cols: [0, 1, 2, 3, 4] },
    { type: 'boss', row: 0, side: 'right', cols: [5, 6, 7, 8, 9] },
    { type: 'bee', row: 1, side: 'right', cols: [0, 1, 2, 3, 4] },
    { type: 'bee', row: 2, side: 'left', cols: [5, 6, 7, 8, 9] },
    { type: 'butterfly', row: 3, side: 'bottom', cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
    { type: 'butterfly', row: 4, side: 'bottom', cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
  ],
];

const SILHOUETTE: readonly (readonly number[])[] = [
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
  [1, 0, 1, 1, 1, 1, 1, 1, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 1, 0, 0, 0, 0, 1, 0, 1],
];

function formationPos(pattern: FormationName, row: number, col: number): { dx: number; dy: number; skip: boolean } {
  const cx = GALAGA.cols / 2 - 0.5;
  const cy = GALAGA.rows / 2 - 0.5;
  switch (pattern) {
    case 'diamond':
      return { dx: 0, dy: Math.abs(row - cy) + Math.abs(col - cx) * 4, skip: false };
    case 'arrow':
      return { dx: 0, dy: Math.abs(col - cx) * 3 + row * 2, skip: false };
    case 'chevron':
      return { dx: (row % 2 === 0 ? 1 : -1) * (col % 3) * 3, dy: 0, skip: false };
    case 'v':
      return { dx: (col - cx) * 2, dy: Math.abs(col - cx) * 3 + row * 2, skip: false };
    case 'hourglass': {
      const narrow = 1 - Math.abs(row - cy) * 0.25;
      return { dx: (col - cx) * (1 - narrow) * 4, dy: 0, skip: false };
    }
    case 'scatter':
      return {
        dx: (((row * 7 + col * 13) % 5) - 2) * 5,
        dy: (((row * 11 + col * 3) % 5) - 2) * 3,
        skip: false,
      };
    case 'silhouette':
      return { dx: 0, dy: SILHOUETTE[row]?.[col] ? 0 : 30, skip: SILHOUETTE[row]?.[col] ? false : true };
    default:
      return { dx: 0, dy: 0, skip: false };
  }
}

function typeOf(row: number): { type: EnemyType; hp: number; points: number } {
  if (row === 0) return { type: 'boss', hp: 2, points: 150 };
  if (row <= 2) return { type: 'bee', hp: 1, points: 100 };
  return { type: 'butterfly', hp: 1, points: 60 };
}

function formationX(col: number): number {
  const totalWidth = GALAGA.cols * GALAGA.enemyW + (GALAGA.cols - 1) * GALAGA.gapX;
  return (GALAGA.width - totalWidth) / 2 + GALAGA.enemyW / 2 + col * (GALAGA.enemyW + GALAGA.gapX);
}

function formationY(row: number): number {
  return GALAGA.formationY + row * (GALAGA.enemyH + GALAGA.gapY);
}

function makeEnemy(state: GalagaState, row: number, col: number, x: number, y: number): Enemy {
  const spec = typeOf(row);
  const hp = spec.type === 'boss' && state.pattern === 'boss' ? spec.hp + 1 : spec.hp;
  return {
    id: state.nextId++,
    x,
    y,
    homeX: formationX(col),
    homeY: formationY(row),
    row,
    col,
    type: spec.type,
    hp,
    points: spec.points,
    alive: true,
    diving: false,
    entering: false,
    entryStartX: x,
    entryStartY: y,
    entryMidX: 0,
    entryMidY: 0,
    hasMid: false,
    entryProgress: 0,
    entrySpeed: 200,
    hasCaptive: false,
    beam: false,
    beamX: 0,
    fireTimer: 2,
  };
}

function applyPattern(state: GalagaState, ctx: StepContext): void {
  state.enemies = [];
  const choice = ctx.progression.nextPattern() ?? 'spiral';
  state.pattern = choice;
  const index = choice === 'split' ? (state.wave * 3) % FORMATIONS.length
    : choice === 'boss' ? FORMATIONS.length - 1
    : (state.wave - 1) % FORMATIONS.length;
  const pattern = FORMATIONS[index] ?? 'classic';
  for (let row = 0; row < GALAGA.rows; row++) {
    for (let col = 0; col < GALAGA.cols; col++) {
      const offset = formationPos(pattern, row, col);
      if (offset.skip) continue;
      state.enemies.push(
        makeEnemy(state, row, col, formationX(col) + offset.dx, formationY(row) + offset.dy),
      );
    }
  }
  state.formationDir = 1;
  state.formationTimer = 0;
  state.diveTimer = 2.5 / ctx.progression.state.speed;
  state.beam = null;
  state.bonusFighters = [];
  state.bonusTimer = 0;
  ctx.emit('levelUp', { wave: state.wave, pattern });
}

function startEntry(state: GalagaState, ctx: StepContext): void {
  const sequence = ENTRY_SEQUENCES[(state.wave - 1) % ENTRY_SEQUENCES.length];
  if (!sequence) return;
  state.enemies = [];
  state.entry = {
    groups: sequence.map((group) => ({ ...group, cols: [...group.cols] })),
    groupIndex: 0,
    spawnIndex: 0,
    timer: 0,
    spawned: 0,
    total: sequence.reduce((sum, group) => sum + group.cols.length, 0),
  };
  ctx.emit('hit', { kind: 'entry', wave: state.wave });
}

function entryStart(side: EntryGroup['side'], ctx: StepContext): { x: number; y: number } {
  if (side === 'left') return { x: -40, y: ctx.rng.range(GALAGA.height * 0.3, GALAGA.height * 0.7) };
  if (side === 'right') return { x: GALAGA.width + 40, y: ctx.rng.range(GALAGA.height * 0.3, GALAGA.height * 0.7) };
  if (side === 'bottom') return { x: ctx.rng.range(GALAGA.width * 0.2, GALAGA.width * 0.8), y: GALAGA.height + 40 };
  return { x: ctx.rng.range(GALAGA.width * 0.3, GALAGA.width * 0.7), y: -40 };
}

function startBonus(state: GalagaState, ctx: StepContext): void {
  state.bonusFighters = [];
  state.bonusTimer = GALAGA.bonusDuration;
  state.bonusKills = 0;
  for (let i = 0; i < GALAGA.bonusEnemyCount; i++) {
    const spec = typeOf(i % 5);
    const fromLeft = i % 2 === 0;
    state.bonusFighters.push({
      x: fromLeft ? -40 - i * 15 : GALAGA.width + 40 + i * 15,
      y: 60 + (i % 8) * 50 + Math.sin(i * 0.7) * 30,
      vx: fromLeft ? GALAGA.bonusFlightSpeed + i * 3 : -(GALAGA.bonusFlightSpeed + i * 3),
      vy: Math.sin(i * 1.3) * 40,
      dir: fromLeft ? 1 : -1,
      phase: i * 0.3,
      type: spec.type,
      points: spec.points,
      alive: true,
    });
  }
  ctx.emit('levelUp', { kind: 'bonus', wave: state.wave });
}

function checkExtraLives(state: GalagaState, ctx: StepContext): void {
  const thresholds = [10000, 30000, 60000];
  for (let i = state.extraLivesGiven; i < thresholds.length; i++) {
    const threshold = thresholds[i];
    if (threshold !== undefined && state.score >= threshold) {
      state.lives++;
      state.extraLivesGiven = i + 1;
      ctx.emit('score', { score: state.score, points: 0, reason: 'extraLife' });
    }
  }
}

function reset(state: GalagaState, ctx: StepContext): void {
  state.score = 0;
  state.lives = GALAGA.startLives;
  state.wave = 1;
  state.over = false;
  state.paused = false;
  state.ticks = 0;
  state.progress = 0;
  state.shipX = GALAGA.width / 2;
  state.fireCd = 0;
  state.invuln = 0;
  state.doubleShot = false;
  state.extraLivesGiven = 0;
  state.nextId = 0;
  state.beamCooldown = 0;
  state.bonusTimer = 0;
  state.bonusKills = 0;
  state.bonusFighters = [];
  state.entry = null;
  state.bullets = [];
  applyPattern(state, ctx);
  startEntry(state, ctx);
}

function loseLife(state: GalagaState, ctx: StepContext): void {
  state.lives--;
  state.doubleShot = false;
  state.invuln = GALAGA.invulnerable;
  state.shipX = GALAGA.width / 2;
  state.bullets = [];
  ctx.emit('explode', { x: state.shipX, y: GALAGA.shipY, kind: 'ship' });
  ctx.progression.observe(-0.8);
  if (state.lives <= 0) {
    state.over = true;
    ctx.emit('gameOver', { score: state.score });
  }
}

function finishDive(state: GalagaState, enemy: Enemy): void {
  enemy.diving = false;
  enemy.beam = false;
  enemy.x = enemy.homeX + state.formationDir * 8;
  enemy.y = enemy.homeY;
}

function nextWave(state: GalagaState, ctx: StepContext): void {
  state.wave++;
  state.progress += 400;
  if (state.wave % GALAGA.bonusEvery === 0) startBonus(state, ctx);
  else {
    applyPattern(state, ctx);
    if (state.wave <= ENTRY_SEQUENCES.length) startEntry(state, ctx);
  }
}

export const galagaGame = defineGame<GalagaState>({
  id: 'galaga',
  meta: { title: 'Galaga', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['left', 'right', 'fire', 'pause', 'restart'],
  progression: {
    id: 'galaga',
    levels: [
      { speed: 1, spawnInterval: 150, hazard: 0, label: 'Oleada 1' },
      { speed: 1.1, spawnInterval: 120, hazard: 0.2, label: 'Oleada 2' },
      { speed: 1.25, spawnInterval: 95, hazard: 0.4, label: 'Oleada 3' },
    ],
    pointsPerLevel: 1500,
    dda: { enabled: true, window: 360, maxAdjust: 0.08 },
    patterns: ['spiral', 'split', 'boss'],
    avoidRepeat: 2,
  },

  init(seed, ctx) {
    const state: GalagaState = {
      shipX: GALAGA.width / 2,
      bullets: [],
      enemies: [],
      beam: null,
      beamCooldown: 0,
      bonusFighters: [],
      bonusTimer: 0,
      bonusKills: 0,
      entry: null,
      formationDir: 1,
      formationTimer: 0,
      diveTimer: 2.5,
      score: 0,
      lives: GALAGA.startLives,
      wave: 1,
      over: false,
      paused: false,
      ticks: 0,
      progress: 0,
      fireCd: 0,
      invuln: 0,
      doubleShot: false,
      extraLivesGiven: 0,
      pattern: 'spiral',
      nextId: 0,
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
    state.beamCooldown = Math.max(0, state.beamCooldown - dt);

    if (ctx.actions.isDown('left')) state.shipX -= GALAGA.shipSpeed * dt;
    if (ctx.actions.isDown('right')) state.shipX += GALAGA.shipSpeed * dt;
    state.shipX = clamp(state.shipX, GALAGA.shipMargin, GALAGA.width - GALAGA.shipMargin);

    if (ctx.actions.isDown('fire') && state.fireCd <= 0) {
      const offsets = state.doubleShot ? [-8, 8] : [0];
      for (const offset of offsets) {
        state.bullets.push({ x: state.shipX + offset, y: GALAGA.shipY, friendly: true });
      }
      state.fireCd = GALAGA.fireCooldown;
      ctx.emit('shoot', { x: state.shipX, y: GALAGA.shipY, double: state.doubleShot });
    }

    // B7: el vaivén usa el reloj de simulación, nunca el reloj real.
    const time = ctx.clock.time;

    if (state.bonusTimer > 0) {
      state.bonusTimer -= dt;
      for (const fighter of state.bonusFighters) {
        if (!fighter.alive) continue;
        fighter.x += fighter.vx * dt;
        fighter.y += fighter.vy * dt + Math.sin(time / 0.4 + fighter.phase) * 20 * dt;
        if (fighter.y < 30) fighter.vy = Math.abs(fighter.vy);
        if (fighter.y > GALAGA.shipY - 40) fighter.vy = -Math.abs(fighter.vy);
        if ((fighter.dir === 1 && fighter.x > GALAGA.width + 60) ||
            (fighter.dir === -1 && fighter.x < -60)) fighter.alive = false;
      }
      if (state.bonusTimer <= 0 || state.bonusFighters.every((fighter) => !fighter.alive)) {
        state.score += state.bonusKills * 100;
        state.progress += state.bonusKills * 100;
        ctx.emit('score', { score: state.score, points: state.bonusKills * 100, reason: 'bonus' });
        state.bonusTimer = 0;
        nextWave(state, ctx);
      }
    } else if (state.entry !== null) {
      state.entry.timer += dt;
      if (state.entry.timer >= 0.12) {
        state.entry.timer = 0;
        const entry = state.entry;
        while (
          entry.groupIndex < entry.groups.length &&
          entry.spawnIndex >= (entry.groups[entry.groupIndex]?.cols.length ?? 0)
        ) {
          entry.groupIndex++;
          entry.spawnIndex = 0;
        }
        const group = entry.groups[entry.groupIndex];
        const col = group?.cols[entry.spawnIndex];
        if (!group || col === undefined) {
          state.entry = null;
        } else {
          const offset = formationPos(FORMATIONS[(state.wave - 1) % FORMATIONS.length] ?? 'classic', group.row, col);
          const start = entryStart(group.side, ctx);
          const enemy = makeEnemy(state, group.row, col, start.x, start.y);
          enemy.homeX = formationX(col) + offset.dx;
          enemy.homeY = formationY(group.row) + offset.dy;
          enemy.entryStartX = start.x;
          enemy.entryStartY = start.y;
          enemy.entering = true;
          enemy.entrySpeed = 200 + ctx.rng.range(0, 60);
          if (group.side === 'bottom') {
            enemy.hasMid = true;
            enemy.entryMidX = (start.x + enemy.homeX) / 2 + ctx.rng.range(-100, 100);
            enemy.entryMidY = Math.min(start.y, enemy.homeY) - 100 - ctx.rng.range(0, 100);
          }
          state.enemies.push(enemy);
          entry.spawnIndex++;
          entry.spawned++;
          if (entry.spawned >= entry.total) state.entry = null;
        }
      }
    } else {
      const formationAlive = state.enemies.filter((enemy) => enemy.alive && !enemy.diving && !enemy.entering).length;
      if (formationAlive === 0) {
        nextWave(state, ctx);
      } else {
        const aliveRatio = formationAlive / (GALAGA.rows * GALAGA.cols);
        const multiplier = 1 + (1 - aliveRatio) * (GALAGA.rows * GALAGA.cols) * 0.025;
        state.formationTimer += dt * multiplier * speed;
        while (state.formationTimer >= 0.6) {
          state.formationTimer -= 0.6;
          let hitEdge = false;
          for (const enemy of state.enemies) {
            if (!enemy.alive || enemy.diving || enemy.entering) continue;
            enemy.x += state.formationDir * 8;
            if (enemy.x > GALAGA.width - 30 || enemy.x < 30) hitEdge = true;
          }
          if (hitEdge) {
            state.formationDir = -state.formationDir;
            for (const enemy of state.enemies) {
              if (enemy.alive && !enemy.diving && !enemy.entering) enemy.y += 4;
            }
          }
        }

        state.diveTimer -= dt * speed;
        const minInterval = Math.max(GALAGA.minDiveInterval, 2.5 - state.wave * GALAGA.diveReduction);
        if (state.diveTimer <= 0 && formationAlive > 3) {
          const available = state.enemies.filter((enemy) => enemy.alive && !enemy.diving && !enemy.entering);
          if (
            state.beam === null &&
            state.beamCooldown <= 0 &&
            state.wave % 2 === 0 &&
            state.invuln <= 0 &&
            !state.enemies.some((enemy) => enemy.hasCaptive) &&
            available.length > 0
          ) {
            const index = ctx.rng.int(available.length);
            const enemy = available[index];
            if (enemy) {
              enemy.diving = true;
              enemy.beam = true;
              enemy.beamX = clamp(state.shipX, 60, GALAGA.width - 60);
              state.beam = {
                enemyId: enemy.id,
                phase: 'descend',
                t: GALAGA.beamTime,
                beamX: enemy.beamX,
              };
              state.beamCooldown = GALAGA.beamCooldown;
              ctx.emit('hit', { kind: 'beam' });
            }
          } else {
            const count = Math.min(
              GALAGA.maxDivers + Math.round(progress.hazard) + (state.pattern === 'split' ? 1 : 0),
              Math.floor(available.length / GALAGA.diversPerGroup),
            );
            for (let i = 0; i < count; i++) {
              const index = ctx.rng.int(available.length);
              const enemy = available.splice(index, 1)[0];
              if (enemy) enemy.diving = true;
            }
            if (count > 0) ctx.emit('hit', { kind: 'dive' });
          }
          state.diveTimer = (progress.spawnInterval ?? 150) / 60;
          state.diveTimer = Math.max(minInterval, state.diveTimer * 0.6);
        }
      }
    }

    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      if (enemy.entering) {
        const targetX = enemy.homeX;
        const targetY = enemy.homeY;
        const dx = targetX - enemy.x;
        const dy = targetY - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 5) {
          enemy.x = targetX;
          enemy.y = targetY;
          enemy.entering = false;
        } else if (enemy.hasMid) {
          enemy.entryProgress += dt * 0.8;
          const t = Math.min(enemy.entryProgress, 1);
          enemy.x = lerp(lerp(enemy.entryStartX, enemy.entryMidX, t), lerp(enemy.entryMidX, targetX, t), t);
          enemy.y = lerp(lerp(enemy.entryStartY, enemy.entryMidY, t), lerp(enemy.entryMidY, targetY, t), t);
        } else {
          const direction = normalize2(dx, dy);
          enemy.x += direction.x * enemy.entrySpeed * dt;
          enemy.y += direction.y * enemy.entrySpeed * dt;
        }
        continue;
      }
      if (!enemy.diving) {
        if (state.bonusTimer === 0 && state.entry === null) {
          enemy.x = enemy.homeX + state.formationDir * 0;
        }
        continue;
      }
      if (enemy.beam && state.beam !== null && state.beam.enemyId === enemy.id) {
        const beamSpeed = 160 + state.wave * 6;
        if (state.beam.phase === 'descend') {
          const step = Math.min(Math.abs(state.beam.beamX - enemy.x), beamSpeed * dt * 1.4);
          enemy.x += Math.sign(state.beam.beamX - enemy.x) * step;
          enemy.y += beamSpeed * dt;
          if (enemy.y >= GALAGA.beamDescentY) {
            enemy.y = GALAGA.beamDescentY;
            state.beam.phase = 'beam';
            state.beam.t = GALAGA.beamTime;
          }
        } else {
          state.beam.t -= dt * speed;
          enemy.x += Math.sin(time / 0.3) * 18 * dt;
          const pulse = 0.55 + 0.45 * Math.abs(Math.sin(((GALAGA.beamTime - state.beam.t) / GALAGA.beamTime) * Math.PI * 2));
          const halfWidth = GALAGA.beamHalfWidth * pulse;
          if (state.invuln <= 0 && Math.abs(state.shipX - enemy.x) < halfWidth * 0.75) {
            enemy.hasCaptive = true;
            state.lives--;
            state.beam = null;
            finishDive(state, enemy);
            state.invuln = GALAGA.invulnerable;
            state.shipX = GALAGA.width / 2;
            state.doubleShot = false;
            state.bullets = [];
            ctx.emit('hit', { kind: 'capture' });
            ctx.progression.observe(-0.8);
            if (state.lives <= 0) {
              state.over = true;
              ctx.emit('gameOver', { score: state.score });
              return;
            }
            continue;
          }
          if (state.beam.t <= 0) {
            finishDive(state, enemy);
            state.beam = null;
          }
        }
        continue;
      }
      const diveSpeed = 140 + state.wave * 8;
      enemy.x += Math.sign(state.shipX - enemy.x) * Math.min(Math.abs(state.shipX - enemy.x), diveSpeed * dt * GALAGA.diveSpeedMult);
      enemy.x += Math.sin(time / 0.2 + enemy.col) * 30 * dt;
      enemy.y += diveSpeed * dt;
      enemy.fireTimer -= dt * (1 + progress.hazard);
      if (enemy.fireTimer <= 0 && enemy.y > GALAGA.height * 0.3 && state.bullets.length < 60) {
        state.bullets.push({ x: enemy.x, y: enemy.y, friendly: false });
        enemy.fireTimer = 2.5;
        ctx.emit('shoot', { x: enemy.x, y: enemy.y, hostile: true });
      }
      if (enemy.y > GALAGA.shipY - 20) {
        if (state.invuln <= 0 && Math.abs(enemy.x - state.shipX) < 28) loseLife(state, ctx);
        finishDive(state, enemy);
      }
    }

    for (const bullet of state.bullets) {
      if (bullet.friendly) continue;
      bullet.y += GALAGA.enemyBulletSpeed * speed * dt;
      if (state.invuln <= 0 &&
          collision.aabbOverlap(
            { x: bullet.x - 5, y: bullet.y - 8, w: 10, h: 16 },
            { x: state.shipX - 14, y: GALAGA.shipY - 11, w: 28, h: 22 },
          )) {
        bullet.y = GALAGA.height + 100;
        loseLife(state, ctx);
      }
    }
    state.bullets = state.bullets.filter((bullet) => bullet.y > -20 && bullet.y < GALAGA.height + 20);

    for (let bi = state.bullets.length - 1; bi >= 0 && !state.over; bi--) {
      const bullet = state.bullets[bi];
      if (!bullet) continue;
      const steps = Math.max(1, Math.ceil(GALAGA.bulletSpeed * dt / (GALAGA.enemyW * 0.5 * 0.3)));
      let consumed = false;
      for (let sub = 0; sub < steps && !consumed; sub++) {
        bullet.y -= (GALAGA.bulletSpeed * dt) / steps;
        for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
          const enemy = state.enemies[ei];
          if (!enemy || !enemy.alive) continue;
          if (!collision.aabbOverlap(
            { x: bullet.x - 3, y: bullet.y - 3, w: 6, h: 6 },
            { x: enemy.x - GALAGA.enemyW / 2, y: enemy.y - GALAGA.enemyH / 2, w: GALAGA.enemyW, h: GALAGA.enemyH },
          )) continue;
          enemy.hp--;
          state.score += enemy.points;
          state.progress += enemy.points;
          ctx.emit('hit', { x: enemy.x, y: enemy.y });
          if (enemy.hp <= 0) {
            enemy.alive = false;
            if (state.beam?.enemyId === enemy.id) {
              state.score += GALAGA.scoreBeamKill;
              state.progress += GALAGA.scoreBeamKill;
              state.beam = null;
              ctx.emit('score', { score: state.score, points: GALAGA.scoreBeamKill, reason: 'interrupt' });
            }
            if (enemy.hasCaptive) {
              enemy.hasCaptive = false;
              state.doubleShot = true;
              state.score += GALAGA.scoreRescue;
              state.progress += GALAGA.scoreRescue;
              ctx.emit('score', { score: state.score, points: GALAGA.scoreRescue, reason: 'rescue' });
            }
            ctx.emit('explode', { x: enemy.x, y: enemy.y, points: enemy.points });
            if (state.enemies.every((other) => !other.alive) && state.entry === null) nextWave(state, ctx);
          }
          state.bullets.splice(bi, 1);
          consumed = true;
          checkExtraLives(state, ctx);
          break;
        }
      }
    }

    for (const fighter of state.bonusFighters) {
      if (!fighter.alive) continue;
      for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
        const bullet = state.bullets[bi];
        if (!bullet) continue;
        if (!collision.aabbOverlap(
          { x: bullet.x - 3, y: bullet.y - 3, w: 6, h: 6 },
          { x: fighter.x - GALAGA.enemyW / 2, y: fighter.y - GALAGA.enemyH / 2, w: GALAGA.enemyW, h: GALAGA.enemyH },
        )) continue;
        fighter.alive = false;
        state.bonusKills++;
        state.score += fighter.points;
        state.progress += fighter.points;
        state.bullets.splice(bi, 1);
        ctx.emit('explode', { x: fighter.x, y: fighter.y, points: fighter.points });
        ctx.emit('score', { score: state.score, points: fighter.points });
        checkExtraLives(state, ctx);
        break;
      }
    }
    ctx.progression.observe(state.bonusKills > 0 ? 0.4 : 0);
  },

  observe(state, playerId) {
    void playerId;
    let nearestX = 0;
    let nearestY = 0;
    let best = Number.POSITIVE_INFINITY;
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      const distance = dist2(enemy.x, enemy.y, state.shipX, GALAGA.shipY);
      if (distance < best) {
        best = distance;
        nearestX = enemy.x;
        nearestY = enemy.y;
      }
    }
    const hostile = state.bullets.filter((bullet) => !bullet.friendly).length;
    return new Float32Array([
      clamp((state.shipX / GALAGA.width) * 2 - 1, -1, 1),
      clamp((nearestX - state.shipX) / GALAGA.width, -1, 1),
      clamp((GALAGA.shipY - nearestY) / GALAGA.height, -1, 1),
      clamp((hostile / 8) * 2 - 1, -1, 1),
      state.beam === null ? -1 : 1,
      state.doubleShot ? 1 : -1,
      state.entry === null ? -1 : 1,
      clamp((state.bonusTimer / GALAGA.bonusDuration) * 2 - 1, -1, 1),
      clamp((state.lives / GALAGA.startLives) * 2 - 1, -1, 1),
    ]);
  },

  rules: singlePlayerRules<GalagaState>(
    (state) =>
      state.score + state.wave * 100 + state.lives * 30 + state.ticks / 600 - (state.over ? 150 : 0),
  ),
});
