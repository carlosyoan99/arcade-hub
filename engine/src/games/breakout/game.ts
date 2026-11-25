import { clamp, normalize2 } from '../../core/math.js';
import type { StepContext } from '../../core/simulation.js';
import { handleLifecycle } from '../../game/lifecycle.js';
import { singlePlayerRules } from '../../game/rules.js';
import { defineGame } from '../../game/contract.js';
import { COLLISION_SERVICE, type CollisionService } from '../../sim/collision.js';

export const BREAKOUT = {
  width: 700,
  height: 500,
  paddleHalfW: 45,
  paddleY: 472,
  paddleThickness: 10,
  paddleSpeed: 380,
  ballRadius: 6,
  launchSpeed: 290,
  maxSpeed: 700,
  hitGrowth: 1.01,
  levelSpeedGrowth: 1.08,
  lives: 3,
  brickRows: 8,
  brickCols: 14,
  brickW: 40,
  brickH: 18,
  brickGap: 4,
  brickTop: 40,
  loseY: 515,
  antiStuckTicks: 300,
  rowPoints: [80, 70, 60, 50, 40, 30, 20, 10] as const,
} as const;

export interface BreakoutBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface BreakoutBrick {
  x: number;
  y: number;
  points: number;
  alive: boolean;
}

export interface BreakoutState {
  paddleX: number;
  ball: BreakoutBall;
  bricks: BreakoutBrick[];
  score: number;
  lives: number;
  level: number;
  bricksBroken: number;
  ballSpeed: number;
  serving: boolean;
  over: boolean;
  paused: boolean;
  generation: number;
  ticks: number;
  stuckTimer: number;
}

function buildBricks(pattern: string | null): BreakoutBrick[] {
  const bricks: BreakoutBrick[] = [];
  const rowWidth = BREAKOUT.brickCols * BREAKOUT.brickW + (BREAKOUT.brickCols - 1) * BREAKOUT.brickGap;
  const startX = (BREAKOUT.width - rowWidth) / 2 + BREAKOUT.brickW / 2;
  for (let row = 0; row < BREAKOUT.brickRows; row++) {
    for (let col = 0; col < BREAKOUT.brickCols; col++) {
      if (pattern === 'bank' && (row + col) % 5 === 0) continue;
      const power = pattern === 'power' && (row * BREAKOUT.brickCols + col) % 11 === 0;
      bricks.push({
        x: startX + col * (BREAKOUT.brickW + BREAKOUT.brickGap),
        y: BREAKOUT.brickTop + BREAKOUT.brickH / 2 + row * (BREAKOUT.brickH + BREAKOUT.brickGap),
        points: (BREAKOUT.rowPoints[row] ?? 10) * (power ? 2 : 1),
        alive: true,
      });
    }
  }
  return bricks;
}

function parkBall(state: BreakoutState): void {
  state.ball.x = state.paddleX;
  state.ball.y = BREAKOUT.paddleY - 18;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.serving = true;
  state.stuckTimer = 0;
}

function initialState(ctx: StepContext): BreakoutState {
  const state: BreakoutState = {
    paddleX: BREAKOUT.width / 2,
    ball: { x: BREAKOUT.width / 2, y: BREAKOUT.paddleY - 18, vx: 0, vy: 0 },
    bricks: [],
    score: 0,
    lives: BREAKOUT.lives,
    level: 1,
    bricksBroken: 0,
    ballSpeed: BREAKOUT.launchSpeed,
    serving: true,
    over: false,
    paused: false,
    generation: 0,
    ticks: 0,
    stuckTimer: 0,
  };
  state.bricks = buildBricks(ctx.progression.nextPattern() ?? 'straight');
  return state;
}

export const breakoutGame = defineGame<BreakoutState>({
  id: 'breakout',
  meta: { title: 'Breakout', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['left', 'right', 'launch', 'restart', 'pause'],
  progression: {
    id: 'breakout',
    levels: [
      { speed: 1, spawnInterval: 300, hazard: 0, label: 'Nivel 1' },
      { speed: 1.08, spawnInterval: 270, hazard: 0.1, label: 'Nivel 2' },
      { speed: 1.16, spawnInterval: 240, hazard: 0.2, label: 'Nivel 3' },
      { speed: 1.28, spawnInterval: 210, hazard: 0.35, label: 'Nivel 4' },
    ],
    pointsPerLevel: 12,
    dda: { enabled: true, window: 300, maxAdjust: 0.08 },
    patterns: ['straight', 'bank', 'power'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    return initialState(ctx);
  },

  step(state, ctx) {
    const generation = state.generation;
    if (
      handleLifecycle(state, ctx, state.bricksBroken, () => {
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
    if (progress.level + 1 > state.level) {
      state.level = progress.level + 1;
      state.ballSpeed = Math.min(BREAKOUT.maxSpeed, state.ballSpeed * BREAKOUT.levelSpeedGrowth);
      state.bricks = buildBricks(ctx.progression.nextPattern() ?? 'straight');
      parkBall(state);
      ctx.emit('levelUp', { level: state.level });
      ctx.schedule(2, () => {
        if (state.generation === generation && !state.paused && !state.over) {
          ctx.emit('fanfare', { level: state.level });
        }
      });
    }

    const halfW = BREAKOUT.paddleHalfW * (1 - progress.hazard * 0.25);
    if (ctx.actions.isDown('left')) state.paddleX -= BREAKOUT.paddleSpeed * dt;
    if (ctx.actions.isDown('right')) state.paddleX += BREAKOUT.paddleSpeed * dt;
    state.paddleX = clamp(
      state.paddleX,
      halfW + BREAKOUT.ballRadius,
      BREAKOUT.width - halfW - BREAKOUT.ballRadius,
    );
    if (state.serving) {
      state.ball.x = state.paddleX;
      state.ball.y = BREAKOUT.paddleY - 18;
      if (ctx.actions.consume('launch')) {
        const angle = ctx.rng.range(-0.3, 0.3);
        const direction = normalize2(Math.sin(angle), -Math.cos(angle));
        state.ball.vx = direction.x;
        state.ball.vy = direction.y;
        state.serving = false;
        state.stuckTimer = 0;
        ctx.emit('launch', { x: state.ball.x, y: state.ball.y });
      }
      state.ticks++;
      return;
    }

    const speed = Math.min(BREAKOUT.maxSpeed, state.ballSpeed * progress.speed);
    const steps = Math.max(1, Math.ceil((speed * dt) / (BREAKOUT.brickH * 0.3)));
    const subDt = dt / steps;
    for (let step = 0; step < steps; step++) {
      const ball = state.ball;
      const prevX = ball.x;
      const prevY = ball.y;
      ball.x += ball.vx * speed * subDt;
      ball.y += ball.vy * speed * subDt;

      if (ball.x - BREAKOUT.ballRadius < 0) {
        ball.x = BREAKOUT.ballRadius;
        ball.vx = -ball.vx;
        ctx.emit('wallHit', { axis: 'x', x: ball.x, y: ball.y });
      } else if (ball.x + BREAKOUT.ballRadius > BREAKOUT.width) {
        ball.x = BREAKOUT.width - BREAKOUT.ballRadius;
        ball.vx = -ball.vx;
        ctx.emit('wallHit', { axis: 'x', x: ball.x, y: ball.y });
      }
      if (ball.y - BREAKOUT.ballRadius < 0) {
        ball.y = BREAKOUT.ballRadius;
        ball.vy = -ball.vy;
        ctx.emit('wallHit', { axis: 'y', x: ball.x, y: ball.y });
      }

      const paddleRect = {
        x: state.paddleX - halfW,
        y: BREAKOUT.paddleY - BREAKOUT.paddleThickness / 2,
        w: halfW * 2,
        h: BREAKOUT.paddleThickness,
      };
      if (
        ball.vy > 0 &&
        prevY + BREAKOUT.ballRadius <= paddleRect.y + 2 &&
        collision.circleAabb({ x: ball.x, y: ball.y, r: BREAKOUT.ballRadius }, paddleRect)
      ) {
        ball.y = paddleRect.y - BREAKOUT.ballRadius;
        const offset = clamp((ball.x - state.paddleX) / halfW, -1, 1);
        const direction = normalize2(Math.sin(offset * 0.7), -Math.cos(offset * 0.7));
        ball.vx = direction.x;
        ball.vy = direction.y;
        state.ballSpeed = Math.min(BREAKOUT.maxSpeed, state.ballSpeed * BREAKOUT.hitGrowth);
        state.stuckTimer = 0;
        ctx.emit('paddleHit', { x: ball.x, y: ball.y, offset });
        ctx.progression.observe(0.4);
      }

      for (const brick of state.bricks) {
        if (!brick.alive) continue;
        const rect = {
          x: brick.x - BREAKOUT.brickW / 2,
          y: brick.y - BREAKOUT.brickH / 2,
          w: BREAKOUT.brickW,
          h: BREAKOUT.brickH,
        };
        if (!collision.circleAabb({ x: ball.x, y: ball.y, r: BREAKOUT.ballRadius }, rect)) continue;
        const wasWithinXPrev =
          Math.abs(prevX - brick.x) <= BREAKOUT.brickW / 2 + BREAKOUT.ballRadius;
        if (wasWithinXPrev) ball.vy = -ball.vy;
        else ball.vx = -ball.vx;
        brick.alive = false;
        state.score += brick.points;
        state.bricksBroken++;
        state.stuckTimer = 0;
        ctx.emit('brickBreak', { x: brick.x, y: brick.y, points: brick.points });
        ctx.progression.observe(0.5);
        break;
      }

      if (ball.y > BREAKOUT.loseY) {
        state.lives--;
        ctx.emit('lifeLost', { lives: state.lives });
        ctx.progression.observe(-0.8);
        if (state.lives <= 0) {
          state.over = true;
          ctx.emit('gameOver', { score: state.score });
        } else {
          parkBall(state);
        }
        break;
      }
      if (state.serving) break;
    }

    // Anti-stuck fiel al original: 5 s (spawnInterval de la curva) sin ladrillo ⇒ forzar subida.
    if (!state.serving) {
      state.stuckTimer++;
      if (state.stuckTimer >= (progress.spawnInterval ?? BREAKOUT.antiStuckTicks) && state.ball.vy > 0) {
        state.ball.vy = -Math.abs(state.ball.vy);
        state.stuckTimer = 0;
        ctx.emit('antiStuck', { x: state.ball.x, y: state.ball.y });
      }
    }
    state.ticks++;
  },

  observe(state) {
    const alive = state.bricks.reduce((count, brick) => count + (brick.alive ? 1 : 0), 0);
    return new Float32Array([
      (state.ball.x / BREAKOUT.width) * 2 - 1,
      (state.ball.y / BREAKOUT.height) * 2 - 1,
      state.ball.vx,
      state.ball.vy,
      (state.paddleX / BREAKOUT.width) * 2 - 1,
      (alive / Math.max(1, state.bricks.length)) * 2 - 1,
      (state.lives / BREAKOUT.lives) * 2 - 1,
      (state.ballSpeed / BREAKOUT.maxSpeed) * 2 - 1,
      (state.stuckTimer / BREAKOUT.antiStuckTicks) * 2 - 1,
      state.serving ? 1 : -1,
    ]);
  },

  render(renderer, state, _alpha) {
    // alpha se ignora: todo lo visible ya está en el estado.
    const ctx = renderer as CanvasRenderingContext2D | null;
    if (!ctx || typeof ctx.clearRect !== 'function') return;
    const { width } = BREAKOUT;
    const height = BREAKOUT.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#070b1c';
    ctx.fillRect(0, 0, width, height);

    const palette = ['#22d3ee', '#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb7185', '#fb923c', '#facc15'];
    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      const row = clamp(
        Math.floor((brick.y - BREAKOUT.brickTop - BREAKOUT.brickH / 2) / (BREAKOUT.brickH + BREAKOUT.brickGap)),
        0,
        palette.length - 1,
      );
      const bx = brick.x - BREAKOUT.brickW / 2;
      const by = brick.y - BREAKOUT.brickH / 2;
      ctx.fillStyle = palette[row]!;
      ctx.fillRect(bx, by, BREAKOUT.brickW, BREAKOUT.brickH);
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.fillRect(bx + 2, by + 2, BREAKOUT.brickW - 4, 2);
      if (brick.points > (BREAKOUT.rowPoints[row] ?? 10)) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(brick.x - 6, brick.y - 2, 12, 4);
      }
    }

    // Línea de riesgo: se enciende si la bola baja o quedan pocas vidas.
    const riskY = BREAKOUT.paddleY - 70;
    ctx.save();
    ctx.setLineDash([10, 10]);
    ctx.lineWidth = state.lives <= 1 ? 2 : 1;
    ctx.strokeStyle = state.lives <= 1 ? '#ff3b6b' : state.ball.vy > 0 ? '#fb923c' : '#334155';
    ctx.beginPath();
    ctx.moveTo(0, riskY);
    ctx.lineTo(width, riskY);
    ctx.stroke();
    ctx.restore();

    if (state.serving) {
      ctx.save();
      ctx.setLineDash([4, 8]);
      ctx.strokeStyle = 'rgba(94,242,255,0.55)';
      ctx.beginPath();
      ctx.moveTo(state.ball.x, state.ball.y);
      ctx.lineTo(state.ball.x, riskY);
      ctx.stroke();
      ctx.restore();
    }

    const halfW = BREAKOUT.paddleHalfW;
    ctx.fillStyle = '#5ef2ff';
    ctx.fillRect(state.paddleX - halfW, BREAKOUT.paddleY - BREAKOUT.paddleThickness / 2, halfW * 2, BREAKOUT.paddleThickness);
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(state.paddleX - halfW + 3, BREAKOUT.paddleY - BREAKOUT.paddleThickness / 2 + 2, halfW * 2 - 6, 2);

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, BREAKOUT.ballRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`PTS ${state.score}`, 12, 24);
    ctx.textAlign = 'right';
    ctx.fillText(`LV ${state.level}`, width - 12, 24);
    ctx.textAlign = 'left';
    for (let i = 0; i < BREAKOUT.lives; i++) {
      ctx.fillStyle = i < state.lives ? '#ff4d6d' : '#1e293b';
      ctx.fillRect(12 + i * 14, 32, 10, 6);
    }
  },

  rules: singlePlayerRules<BreakoutState>((state) =>
    state.score + state.bricksBroken * 10 + state.lives * 50 - (state.over ? 200 : 0),
  ),
});
