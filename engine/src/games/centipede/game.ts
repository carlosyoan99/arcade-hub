import type { StepContext } from '../../core/simulation.js';
import { clamp, dist2, manhattan, normalize2 } from '../../core/math.js';
import { defineGame } from '../../game/contract.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import type { CollisionService } from '../../sim/collision.js';

/** Centipede — grid 40×30, splitting clásico, hongos venenosos, araña/pulga/escorpión. */
export const CENTIPEDE = {
  width: 640,
  height: 480,
  cell: 16,
  cols: 40,
  rows: 30,
  playerSpeed: 280,
  bulletSpeed: 420,
  fireCooldown: 0.18,
  playerMargin: 10,
  playerTopRatio: 0.66,
  startLives: 3,
  initialMushrooms: 40,
  initialSegments: 8,
  segmentsPerWave: 2,
  maxSegments: 20,
  baseMoveInterval: 0.15,
  minMoveInterval: 0.06,
  moveReduction: 0.008,
  baseSpiderInterval: 4,
  minSpiderInterval: 2,
  spiderReduction: 0.15,
  baseFleaInterval: 6,
  minFleaInterval: 2.5,
  fleaReduction: 0.2,
  baseScorpionInterval: 8,
  minScorpionInterval: 4,
  scorpionReduction: 0.25,
  waveDelay: 0.5,
  invulnerable: 2,
  spiderSpeed: 140,
  fleaSpeed: 250,
  scorpionSpeed: 120,
  points: { segment: 10, head: 100, spider: 300, flea: 200, scorpion: 500 },
} as const;

interface Segment {
  x: number;
  y: number;
  isHead: boolean;
}

interface CentipedeChain {
  segments: Segment[];
  dir: number;
}

interface Mushroom {
  gx: number;
  gy: number;
  poisoned: boolean;
}

interface Bullet {
  x: number;
  y: number;
}

interface Spider {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Flea {
  x: number;
  y: number;
  vy: number;
}

interface Scorpion {
  x: number;
  y: number;
  vx: number;
}

export interface CentipedeState {
  player: { x: number; y: number };
  bullets: Bullet[];
  mushrooms: Mushroom[];
  centipedes: CentipedeChain[];
  spider: Spider | null;
  flea: Flea | null;
  scorpion: Scorpion | null;
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
  moveInterval: number;
  spiderTimer: number;
  spiderInterval: number;
  fleaTimer: number;
  fleaInterval: number;
  scorpionTimer: number;
  scorpionInterval: number;
  waveTimer: number;
  seed: number;
}

function center(gx: number, gy: number): { x: number; y: number } {
  return { x: gx * CENTIPEDE.cell + CENTIPEDE.cell / 2, y: gy * CENTIPEDE.cell + CENTIPEDE.cell / 2 };
}

function cellOf(x: number, y: number): { gx: number; gy: number } {
  return {
    gx: Math.round((x - CENTIPEDE.cell / 2) / CENTIPEDE.cell),
    gy: Math.round((y - CENTIPEDE.cell / 2) / CENTIPEDE.cell),
  };
}

function mushroomAt(state: CentipedeState, gx: number, gy: number): Mushroom | undefined {
  return state.mushrooms.find((m) => m.gx === gx && m.gy === gy);
}

function addMushroom(state: CentipedeState, gx: number, gy: number, poisoned = false): void {
  if (gy < 1 || gy >= CENTIPEDE.rows - 1 || gx < 0 || gx >= CENTIPEDE.cols) return;
  if (mushroomAt(state, gx, gy)) return;
  state.mushrooms.push({ gx, gy, poisoned });
}

function spawnMushrooms(state: CentipedeState, ctx: StepContext, count: number): void {
  for (let i = 0; i < count; i++) {
    const gx = ctx.rng.int(CENTIPEDE.cols - 2) + 1;
    const gy = ctx.rng.int(CENTIPEDE.rows - 6) + 1;
    addMushroom(state, gx, gy);
  }
}

function totalSegments(state: CentipedeState): number {
  return state.centipedes.reduce((sum, chain) => sum + chain.segments.length, 0);
}

function spawnCentipede(state: CentipedeState, ctx: StepContext, length: number): void {
  const pattern = ctx.progression.nextPattern() ?? 'snake';
  const size = Math.min(CENTIPEDE.maxSegments, length + (pattern === 'snake' ? 2 : 0));
  const startCol = ctx.rng.int(CENTIPEDE.cols - size - 2) + 1;
  const segments: Segment[] = [];
  for (let i = 0; i < size; i++) {
    const p = center(startCol + i, 1);
    segments.push({ x: p.x, y: p.y, isHead: i === 0 });
  }
  state.centipedes = [{ segments, dir: 1 }];
  if (pattern === 'spider' && state.spider === null) {
    state.spider = {
      x: ctx.rng.range(0, CENTIPEDE.width),
      y: CENTIPEDE.height * 0.55,
      vx: CENTIPEDE.spiderSpeed,
      vy: 40,
    };
  }
  if (pattern === 'mushroom') {
    spawnMushrooms(state, ctx, 4 + Math.round(ctx.progression.state.hazard * 6));
  }
}

function spawnFlea(state: CentipedeState, ctx: StepContext): void {
  if (state.flea !== null) return;
  const gx = ctx.rng.int(CENTIPEDE.cols - 2) + 1;
  state.flea = {
    x: center(gx, 1).x,
    y: CENTIPEDE.cell / 2,
    vy: CENTIPEDE.fleaSpeed * (0.7 + ctx.rng.next() * 0.3),
  };
}

function spawnScorpion(state: CentipedeState, ctx: StepContext): void {
  if (state.scorpion !== null) return;
  const fromLeft = ctx.rng.next() > 0.5;
  state.scorpion = {
    x: fromLeft ? -10 : CENTIPEDE.width + 10,
    y: center(0, ctx.rng.int(CENTIPEDE.rows - 8) + 2).y,
    vx: fromLeft ? CENTIPEDE.scorpionSpeed : -CENTIPEDE.scorpionSpeed,
  };
}

function spawnSpider(state: CentipedeState, ctx: StepContext): void {
  const top = CENTIPEDE.height * 0.55;
  const bottom = CENTIPEDE.height - 40;
  state.spider = {
    x: ctx.rng.range(0, CENTIPEDE.width),
    y: ctx.rng.range(top, bottom),
    vx: (ctx.rng.next() > 0.5 ? 1 : -1) * CENTIPEDE.spiderSpeed * (0.6 + ctx.rng.next() * 0.4),
    vy: (ctx.rng.next() > 0.5 ? 1 : -1) * CENTIPEDE.spiderSpeed * (0.3 + ctx.rng.next() * 0.3),
  };
}

function nextWave(state: CentipedeState, ctx: StepContext): void {
  state.wave++;
  state.progress += 100;
  spawnMushrooms(state, ctx, 15);
  spawnCentipede(
    state,
    ctx,
    Math.min(
      CENTIPEDE.initialSegments + state.wave * CENTIPEDE.segmentsPerWave,
      CENTIPEDE.maxSegments,
    ),
  );
  state.moveInterval = Math.max(
    CENTIPEDE.minMoveInterval,
    CENTIPEDE.baseMoveInterval - state.wave * CENTIPEDE.moveReduction,
  );
  state.spiderInterval = Math.max(
    CENTIPEDE.minSpiderInterval,
    CENTIPEDE.baseSpiderInterval - state.wave * CENTIPEDE.spiderReduction,
  );
  state.spiderTimer = state.spiderInterval * 0.5;
  state.fleaInterval = Math.max(
    CENTIPEDE.minFleaInterval,
    CENTIPEDE.baseFleaInterval - state.wave * CENTIPEDE.fleaReduction,
  );
  state.scorpionInterval = Math.max(
    CENTIPEDE.minScorpionInterval,
    CENTIPEDE.baseScorpionInterval - state.wave * CENTIPEDE.scorpionReduction,
  );
  ctx.emit('levelUp', { wave: state.wave });
}

function reset(state: CentipedeState, ctx: StepContext): void {
  state.score = 0;
  state.lives = CENTIPEDE.startLives;
  state.wave = 1;
  state.over = false;
  state.paused = false;
  state.ticks = 0;
  state.progress = 0;
  state.invuln = 0;
  state.fireCd = 0;
  state.moveTimer = 0;
  state.moveInterval = CENTIPEDE.baseMoveInterval;
  state.spiderTimer = CENTIPEDE.baseSpiderInterval;
  state.spiderInterval = CENTIPEDE.baseSpiderInterval;
  state.fleaTimer = CENTIPEDE.baseFleaInterval;
  state.fleaInterval = CENTIPEDE.baseFleaInterval;
  state.scorpionTimer = CENTIPEDE.baseScorpionInterval;
  state.scorpionInterval = CENTIPEDE.baseScorpionInterval;
  state.waveTimer = 0;
  state.bullets = [];
  state.mushrooms = [];
  state.spider = null;
  state.flea = null;
  state.scorpion = null;
  state.player.x = CENTIPEDE.width / 2;
  state.player.y = CENTIPEDE.height - 30;
  spawnMushrooms(state, ctx, CENTIPEDE.initialMushrooms + Math.round(ctx.progression.state.hazard * 10));
  spawnCentipede(state, ctx, CENTIPEDE.initialSegments);
}

function loseLife(state: CentipedeState, ctx: StepContext): void {
  state.lives--;
  ctx.emit('explode', { x: state.player.x, y: state.player.y, kind: 'player' });
  ctx.progression.observe(-0.8);
  if (state.lives <= 0) {
    state.over = true;
    ctx.emit('gameOver', { score: state.score });
    return;
  }
  state.invuln = CENTIPEDE.invulnerable;
  state.player.x = CENTIPEDE.width / 2;
  state.player.y = CENTIPEDE.height - 30;
  state.bullets = [];
  state.flea = null;
  state.scorpion = null;
}

function damageSegment(state: CentipedeState, ctx: StepContext, ci: number, si: number): void {
  const chain = state.centipedes[ci];
  const segment = chain?.segments[si];
  if (!chain || !segment) return;
  const points = segment.isHead ? CENTIPEDE.points.head : CENTIPEDE.points.segment;
  state.score += points;
  state.progress += points;
  const { gx, gy } = cellOf(segment.x, segment.y);
  addMushroom(state, gx, gy);
  const front = chain.segments.slice(0, si);
  const tail = chain.segments.slice(si + 1);
  const replacement: CentipedeChain[] = [];
  if (front.length > 0) replacement.push({ segments: front, dir: chain.dir });
  if (tail.length > 0) {
    const first = tail[0];
    if (first) first.isHead = true;
    replacement.push({ segments: tail, dir: chain.dir });
  }
  state.centipedes.splice(ci, 1, ...replacement);
  ctx.emit('hit', { x: segment.x, y: segment.y });
  ctx.emit('explode', { x: segment.x, y: segment.y, points });
  ctx.emit('score', { score: state.score, points });
  ctx.progression.observe(0.4);
  if (totalSegments(state) === 0) state.waveTimer = CENTIPEDE.waveDelay;
}

export const centipedeGame = defineGame<CentipedeState>({
  id: 'centipede',
  meta: { title: 'Centipede', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['left', 'right', 'up', 'down', 'fire', 'pause', 'restart'],
  progression: {
    id: 'centipede',
    levels: [
      { speed: 1, spawnInterval: 220, hazard: 0, label: 'Oleada 1' },
      { speed: 1.12, spawnInterval: 180, hazard: 0.2, label: 'Oleada 2' },
      { speed: 1.25, spawnInterval: 140, hazard: 0.4, label: 'Oleada 3' },
    ],
    pointsPerLevel: 200,
    dda: { enabled: true, window: 420, maxAdjust: 0.08 },
    patterns: ['snake', 'spider', 'mushroom'],
    avoidRepeat: 2,
  },

  init(seed, ctx) {
    const state: CentipedeState = {
      player: { x: CENTIPEDE.width / 2, y: CENTIPEDE.height - 30 },
      bullets: [],
      mushrooms: [],
      centipedes: [],
      spider: null,
      flea: null,
      scorpion: null,
      score: 0,
      lives: CENTIPEDE.startLives,
      wave: 1,
      over: false,
      paused: false,
      ticks: 0,
      progress: 0,
      invuln: 0,
      fireCd: 0,
      moveTimer: 0,
      moveInterval: CENTIPEDE.baseMoveInterval,
      spiderTimer: CENTIPEDE.baseSpiderInterval,
      spiderInterval: CENTIPEDE.baseSpiderInterval,
      fleaTimer: CENTIPEDE.baseFleaInterval,
      fleaInterval: CENTIPEDE.baseFleaInterval,
      scorpionTimer: CENTIPEDE.baseScorpionInterval,
      scorpionInterval: CENTIPEDE.baseScorpionInterval,
      waveTimer: 0,
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

    // B6: el cambio de oleada es un timer del estado, pausable y determinista.
    if (state.waveTimer > 0) {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) {
        state.waveTimer = 0;
        nextWave(state, ctx);
      }
    }

    let dx = (ctx.actions.isDown('right') ? 1 : 0) - (ctx.actions.isDown('left') ? 1 : 0);
    let dy = (ctx.actions.isDown('down') ? 1 : 0) - (ctx.actions.isDown('up') ? 1 : 0);
    if (dx !== 0 || dy !== 0) {
      const direction = normalize2(dx, dy);
      dx = direction.x;
      dy = direction.y;
    }
    state.player.x = clamp(
      state.player.x + dx * CENTIPEDE.playerSpeed * dt,
      CENTIPEDE.playerMargin,
      CENTIPEDE.width - CENTIPEDE.playerMargin,
    );
    state.player.y = clamp(
      state.player.y + dy * CENTIPEDE.playerSpeed * dt,
      CENTIPEDE.height * CENTIPEDE.playerTopRatio,
      CENTIPEDE.height - CENTIPEDE.playerMargin,
    );

    if (ctx.actions.isDown('fire') && state.fireCd <= 0) {
      state.bullets.push({ x: state.player.x, y: state.player.y - 10 });
      state.fireCd = CENTIPEDE.fireCooldown;
      ctx.emit('shoot', { x: state.player.x, y: state.player.y });
    }

    // Ciempiés: movimiento en grid con follow-the-leader y envenenamiento.
    state.moveTimer += dt;
    while (state.moveTimer >= state.moveInterval / speed) {
      state.moveTimer -= state.moveInterval / speed;
      for (let ci = state.centipedes.length - 1; ci >= 0; ci--) {
        const chain = state.centipedes[ci];
        const head = chain?.segments[0];
        if (!chain || !head) continue;
        const { gx, gy } = cellOf(head.x, head.y);
        const nextGx = gx + chain.dir;
        const hitsEdge = nextGx < 0 || nextGx >= CENTIPEDE.cols;
        const mushroom = hitsEdge ? undefined : mushroomAt(state, nextGx, gy);
        if (!hitsEdge && !mushroom) {
          const p = center(nextGx, gy);
          head.x = p.x;
          head.y = p.y;
        } else {
          if (mushroom?.poisoned) {
            const newGy = Math.min(gy + 4, CENTIPEDE.rows - 2);
            const p = center(gx, newGy);
            head.x = p.x;
            head.y = p.y;
          } else {
            const newGy = gy + 1;
            if (newGy >= CENTIPEDE.rows - 1) {
              state.centipedes.splice(ci, 1);
              if (state.centipedes.length === 0) state.waveTimer = CENTIPEDE.waveDelay;
              continue;
            }
            const p = center(gx, newGy);
            head.x = p.x;
            head.y = p.y;
            chain.dir = -chain.dir;
          }
        }
        const previous = chain.segments.map((segment) => ({ x: segment.x, y: segment.y }));
        for (let si = 1; si < chain.segments.length; si++) {
          const segment = chain.segments[si];
          const from = previous[si - 1];
          if (segment && from) {
            segment.x = from.x;
            segment.y = from.y;
          }
        }
      }
    }

    if (state.spider === null) {
      state.spiderTimer -= dt;
      if (state.spiderTimer <= 0) {
        spawnSpider(state, ctx);
        state.spiderTimer = state.spiderInterval;
      }
    } else {
      const spider = state.spider;
      spider.x += spider.vx * speed * dt;
      spider.y += spider.vy * dt;
      const top = CENTIPEDE.height * 0.55;
      const bottom = CENTIPEDE.height - 40;
      if (spider.x < 5 || spider.x > CENTIPEDE.width - 5) spider.vx = -spider.vx;
      if (spider.y < top || spider.y > bottom) spider.vy = -spider.vy;
      spider.x = clamp(spider.x, 5, CENTIPEDE.width - 5);
      spider.y = clamp(spider.y, top, bottom);
      if (ctx.rng.next() < 0.02) {
        spider.vx = (ctx.rng.next() > 0.5 ? 1 : -1) * CENTIPEDE.spiderSpeed * (0.6 + ctx.rng.next() * 0.4);
        spider.vy = (ctx.rng.next() > 0.5 ? 1 : -1) * CENTIPEDE.spiderSpeed * (0.3 + ctx.rng.next() * 0.3);
      }
    }

    if (state.flea === null) {
      state.fleaTimer -= dt;
      if (state.fleaTimer <= 0) {
        state.fleaTimer = state.fleaInterval;
        if (state.mushrooms.length < 25) spawnFlea(state, ctx);
      }
    } else {
      const flea = state.flea;
      flea.y += flea.vy * dt;
      if (ctx.rng.next() < 0.15) {
        const cell = cellOf(flea.x, flea.y);
        addMushroom(state, cell.gx, cell.gy);
      }
      if (flea.y > CENTIPEDE.height + 20) {
        state.flea = null;
        state.fleaTimer = state.fleaInterval;
      }
    }

    if (state.scorpion === null) {
      state.scorpionTimer -= dt;
      if (state.scorpionTimer <= 0) spawnScorpion(state, ctx);
    } else {
      const scorpion = state.scorpion;
      scorpion.x += scorpion.vx * dt;
      if (ctx.rng.next() < 0.08) {
        const cell = cellOf(scorpion.x, scorpion.y);
        const mushroom = mushroomAt(state, cell.gx, cell.gy);
        if (mushroom) mushroom.poisoned = true;
      }
      if (scorpion.x < -30 || scorpion.x > CENTIPEDE.width + 30) {
        state.scorpion = null;
        state.scorpionTimer = state.scorpionInterval;
      }
    }

    for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
      const bullet = state.bullets[bi];
      if (!bullet) continue;
      const steps = Math.max(1, Math.ceil(CENTIPEDE.bulletSpeed * dt / (CENTIPEDE.cell * 0.3)));
      let consumed = false;
      for (let sub = 0; sub < steps && !consumed; sub++) {
        bullet.y -= (CENTIPEDE.bulletSpeed * dt) / steps;
        if (bullet.y < 0) {
          state.bullets.splice(bi, 1);
          consumed = true;
          break;
        }
        for (let ci = state.centipedes.length - 1; ci >= 0 && !consumed; ci--) {
          const chain = state.centipedes[ci];
          if (!chain) continue;
          for (let si = chain.segments.length - 1; si >= 0; si--) {
            const segment = chain.segments[si];
            if (!segment) continue;
            if (
              collision.aabbOverlap(
                { x: bullet.x - 3, y: bullet.y - 3, w: 6, h: 6 },
                {
                  x: segment.x - CENTIPEDE.cell / 2,
                  y: segment.y - CENTIPEDE.cell / 2,
                  w: CENTIPEDE.cell,
                  h: CENTIPEDE.cell,
                },
              )
            ) {
              damageSegment(state, ctx, ci, si);
              state.bullets.splice(bi, 1);
              consumed = true;
              break;
            }
          }
        }
      }
      if (consumed) continue;
      const flea = state.flea;
      if (flea && dist2(bullet.x, bullet.y, flea.x, flea.y) <= 12 * 12) {
        state.score += CENTIPEDE.points.flea;
        state.progress += CENTIPEDE.points.flea;
        state.flea = null;
        state.fleaTimer = state.fleaInterval;
        ctx.emit('explode', { x: flea.x, y: flea.y, points: CENTIPEDE.points.flea });
        ctx.emit('score', { score: state.score, points: CENTIPEDE.points.flea });
        state.bullets.splice(bi, 1);
        continue;
      }
      const scorpion = state.scorpion;
      if (scorpion && dist2(bullet.x, bullet.y, scorpion.x, scorpion.y) <= 12 * 12) {
        state.score += CENTIPEDE.points.scorpion;
        state.progress += CENTIPEDE.points.scorpion;
        state.scorpion = null;
        state.scorpionTimer = state.scorpionInterval;
        ctx.emit('explode', { x: scorpion.x, y: scorpion.y, points: CENTIPEDE.points.scorpion });
        ctx.emit('score', { score: state.score, points: CENTIPEDE.points.scorpion });
        state.bullets.splice(bi, 1);
        continue;
      }
      const spider = state.spider;
      if (spider && dist2(bullet.x, bullet.y, spider.x, spider.y) <= 12 * 12) {
        state.score += CENTIPEDE.points.spider;
        state.progress += CENTIPEDE.points.spider;
        state.spider = null;
        state.spiderTimer = state.spiderInterval;
        ctx.emit('explode', { x: spider.x, y: spider.y, points: CENTIPEDE.points.spider });
        ctx.emit('score', { score: state.score, points: CENTIPEDE.points.spider });
        state.bullets.splice(bi, 1);
        continue;
      }
      const cell = cellOf(bullet.x, bullet.y);
      const mushroom = mushroomAt(state, cell.gx, cell.gy);
      const mushroomCenter = center(cell.gx, cell.gy);
      if (mushroom && dist2(bullet.x, bullet.y, mushroomCenter.x, mushroomCenter.y) <= 6 * 6) {
        state.mushrooms.splice(state.mushrooms.indexOf(mushroom), 1);
        ctx.emit('hit', { kind: 'mushroom', x: mushroom.gx, y: mushroom.gy });
        state.bullets.splice(bi, 1);
      }
    }

    if (state.invuln <= 0) {
      let hit = false;
      for (const chain of state.centipedes) {
        for (const segment of chain.segments) {
          if (manhattan(segment.x, segment.y, state.player.x, state.player.y) < 12) {
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
      const spider = state.spider;
      if (!hit && spider && manhattan(spider.x, spider.y, state.player.x, state.player.y) < 14) hit = true;
      const flea = state.flea;
      if (!hit && flea && manhattan(flea.x, flea.y, state.player.x, state.player.y) < 12) hit = true;
      const scorpion = state.scorpion;
      if (!hit && scorpion && manhattan(scorpion.x, scorpion.y, state.player.x, state.player.y) < 14) hit = true;
      if (hit) loseLife(state, ctx);
    }
  },

  observe(state, playerId) {
    void playerId;
    let nearestX = 0;
    let nearestY = 0;
    let best = Number.POSITIVE_INFINITY;
    for (const chain of state.centipedes) {
      for (const segment of chain.segments) {
        const distance = manhattan(segment.x, segment.y, state.player.x, state.player.y);
        if (distance < best) {
          best = distance;
          nearestX = segment.x;
          nearestY = segment.y;
        }
      }
    }
    return new Float32Array([
      clamp((state.player.x / CENTIPEDE.width) * 2 - 1, -1, 1),
      clamp((state.player.y / CENTIPEDE.height) * 2 - 1, -1, 1),
      clamp((nearestX - state.player.x) / CENTIPEDE.width, -1, 1),
      clamp((nearestY - state.player.y) / CENTIPEDE.height, -1, 1),
      clamp(state.bullets.length / 4, 0, 1) * 2 - 1,
      clamp(state.mushrooms.length / 60, 0, 1) * 2 - 1,
      state.spider === null ? -1 : 1,
      state.invuln > 0 ? 1 : -1,
      clamp((state.lives / CENTIPEDE.startLives) * 2 - 1, -1, 1),
    ]);
  },

  render(renderer, state, alpha) {
    void alpha; // Sin interpolación: el estado ya contiene las posiciones del frame.
    const ctx = renderer as CanvasRenderingContext2D | null;
    if (!ctx || typeof ctx.clearRect !== 'function') return;
    ctx.save();
    ctx.clearRect(0, 0, CENTIPEDE.width, CENTIPEDE.height);
    ctx.fillStyle = '#080b1c';
    ctx.fillRect(0, 0, CENTIPEDE.width, CENTIPEDE.height);

    // Límite de la zona inferior del jugador.
    const zoneY = CENTIPEDE.height * CENTIPEDE.playerTopRatio;
    ctx.strokeStyle = '#16233a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, zoneY);
    ctx.lineTo(CENTIPEDE.width, zoneY);
    ctx.stroke();

    // Hongos: coordenadas de celda convertidas al centro de la celda.
    ctx.lineWidth = 2;
    for (const mushroom of state.mushrooms) {
      const mx = mushroom.gx * CENTIPEDE.cell + CENTIPEDE.cell / 2;
      const my = mushroom.gy * CENTIPEDE.cell + CENTIPEDE.cell / 2;
      ctx.strokeStyle = mushroom.poisoned ? '#ff3fa4' : '#38f5a3';
      ctx.beginPath();
      ctx.arc(mx, my - 1, 5, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx, my - 1);
      ctx.lineTo(mx, my + 6);
      ctx.stroke();
    }

    for (const chain of state.centipedes) {
      for (const segment of chain.segments) {
        ctx.fillStyle = segment.isHead ? '#ffd166' : '#5ef2ff';
        ctx.beginPath();
        ctx.arc(segment.x, segment.y, segment.isHead ? 8 : 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (state.spider) {
      ctx.strokeStyle = '#ff3fa4';
      ctx.beginPath();
      ctx.moveTo(state.spider.x - 10, state.spider.y);
      ctx.lineTo(state.spider.x + 10, state.spider.y);
      ctx.moveTo(state.spider.x, state.spider.y - 8);
      ctx.lineTo(state.spider.x, state.spider.y + 8);
      ctx.stroke();
    }
    if (state.flea) {
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(state.flea.x - 4, state.flea.y - 6, 8, 12);
    }
    if (state.scorpion) {
      ctx.fillStyle = '#ff3fa4';
      ctx.fillRect(state.scorpion.x - 8, state.scorpion.y - 4, 16, 8);
    }
    ctx.fillStyle = '#ffd166';
    for (const bullet of state.bullets) ctx.fillRect(bullet.x - 2, bullet.y - 6, 4, 12);

    // Destello breve de invulnerabilidad del jugador.
    const blink = state.invuln > 0 ? 0.4 + 0.45 * Math.sin(state.invuln * 13) : 1;
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.translate(state.player.x, state.player.y);
    ctx.strokeStyle = '#5ef2ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(9, 9);
    ctx.lineTo(0, 4);
    ctx.lineTo(-9, 9);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    ctx.font = '16px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5ef2ff';
    ctx.fillText(`PTS ${state.score}`, 12, 22);
    ctx.fillText(`VIDAS ${state.lives}`, 12, 42);
    ctx.textAlign = 'right';
    ctx.fillText(`OLEADA ${state.wave}`, CENTIPEDE.width - 12, 22);
    if (state.paused || state.over) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 32px monospace';
      ctx.fillStyle = '#ff3fa4';
      ctx.fillText(state.over ? 'FIN' : 'PAUSA', CENTIPEDE.width / 2, CENTIPEDE.height / 2);
    }
    ctx.restore();
  },
  rules: singlePlayerRules<CentipedeState>(
    (state) =>
      state.score + state.wave * 60 + state.lives * 25 + state.ticks / 600 - (state.over ? 120 : 0),
  ),
});
