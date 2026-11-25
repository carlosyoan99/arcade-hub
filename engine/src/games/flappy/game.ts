import { defineGame } from '../../game/contract.js';
import { handleLifecycle } from '../../game/lifecycle.js';

export const FLAPPY = {
  width: 480,
  height: 640,
  birdX: 120,
  birdRadius: 14,
  gravity: 1400,
  flapVelocity: -430,
  pipeWidth: 72,
  pipeGap: 170,
  pipeSpeed: 190,
  pipeIntervalTicks: 100,
  minGapY: 80,
} as const;

export interface FlappyPipe {
  x: number;
  gapY: number;
  gap: number;
  scored: boolean;
}

export interface FlappyState {
  birdY: number;
  birdVy: number;
  pipes: FlappyPipe[];
  score: number;
  paused: boolean;
  over: boolean;
  ticks: number;
  nextPipeAt: number;
}

function createInitialState(): FlappyState {
  return {
    birdY: FLAPPY.height / 2,
    birdVy: 0,
    pipes: [],
    score: 0,
    paused: false,
    over: false,
    ticks: 0,
    nextPipeAt: 40,
  };
}

export const flappyGame = defineGame<FlappyState>({
  id: 'flappy',
  meta: { title: 'Flappy Bird', players: [1], modes: ['solo', 'vsAI', 'demo'] },
  actions: ['flap', 'restart', 'pause'],
  progression: {
    id: 'flappy',
    levels: [
      { speed: 1, spawnInterval: 100, hazard: 0, label: 'Nivel 1' },
      { speed: 1.1, spawnInterval: 90, hazard: 0.1, label: 'Nivel 2' },
      { speed: 1.22, spawnInterval: 78, hazard: 0.2, label: 'Nivel 3' },
      { speed: 1.35, spawnInterval: 66, hazard: 0.35, label: 'Nivel 4' },
    ],
    pointsPerLevel: 5,
    dda: { enabled: true, window: 400, maxAdjust: 0.08 },
    patterns: ['high', 'center', 'low', 'zigzag'],
    avoidRepeat: 2,
  },

  init() {
    return createInitialState();
  },

  step(state, ctx) {
    const skip = handleLifecycle(state, ctx, state.score, () =>
      Object.assign(state, createInitialState()),
    );
    if (skip) return;
    const dt = ctx.clock.dt;
    const progress = ctx.progression.state;

    if (ctx.actions.consume('flap')) {
      state.birdVy = FLAPPY.flapVelocity;
      ctx.emit('flap', { y: state.birdY });
    }

    state.birdVy += FLAPPY.gravity * dt;
    state.birdY += state.birdVy * dt;

    if (state.ticks >= state.nextPipeAt) {
      const gap = FLAPPY.pipeGap * (1 - progress.hazard * 0.4);
      const maxGapY = FLAPPY.height - FLAPPY.minGapY - gap;
      const pattern = ctx.progression.nextPattern() ?? 'center';
      const last = state.pipes[state.pipes.length - 1];
      const zone =
        pattern === 'high'
          ? 0
          : pattern === 'low'
            ? 1
            : pattern === 'zigzag' && last !== undefined
              ? last.gapY > FLAPPY.height / 2
                ? 0
                : 1
              : ctx.rng.next();
      state.pipes.push({
        x: FLAPPY.width,
        gapY: FLAPPY.minGapY + zone * Math.max(1, maxGapY - FLAPPY.minGapY),
        gap,
        scored: false,
      });
      state.nextPipeAt = state.ticks + (progress.spawnInterval ?? FLAPPY.pipeIntervalTicks);
    }

    for (const pipe of state.pipes) {
      pipe.x -= FLAPPY.pipeSpeed * progress.speed * dt;
      if (
        !pipe.scored &&
        pipe.x + FLAPPY.pipeWidth < FLAPPY.birdX - FLAPPY.birdRadius
      ) {
        pipe.scored = true;
        state.score++;
        ctx.emit('score', { score: state.score });
      }
      const overlapsX =
        FLAPPY.birdX + FLAPPY.birdRadius > pipe.x &&
        FLAPPY.birdX - FLAPPY.birdRadius < pipe.x + FLAPPY.pipeWidth;
      const hitsPipe =
        state.birdY - FLAPPY.birdRadius < pipe.gapY ||
        state.birdY + FLAPPY.birdRadius > pipe.gapY + pipe.gap;
      if (overlapsX && hitsPipe) {
        state.over = true;
        ctx.emit('crash', { x: FLAPPY.birdX, y: state.birdY });
      }
    }
    state.pipes = state.pipes.filter((pipe) => pipe.x + FLAPPY.pipeWidth > -10);

    if (state.birdY + FLAPPY.birdRadius >= FLAPPY.height) {
      state.birdY = FLAPPY.height - FLAPPY.birdRadius;
      state.over = true;
      ctx.emit('crash', { x: FLAPPY.birdX, y: state.birdY });
    }
    if (state.birdY - FLAPPY.birdRadius <= 0) {
      state.birdY = FLAPPY.birdRadius;
      state.birdVy = 0;
    }
    state.ticks++;
  },

  observe(state) {
    const nextPipe = state.pipes.find((pipe) => pipe.x + FLAPPY.pipeWidth > FLAPPY.birdX);
    return new Float32Array([
      state.birdY / FLAPPY.height,
      state.birdVy / 800,
      nextPipe ? (nextPipe.x - FLAPPY.birdX) / FLAPPY.width : 1,
      nextPipe ? (nextPipe.gapY + FLAPPY.pipeGap / 2) / FLAPPY.height : 0.5,
      FLAPPY.pipeGap / FLAPPY.height,
    ]);
  },

  render(renderer, state) {
    const ctx = renderer as CanvasRenderingContext2D | null;
    if (!ctx || typeof ctx.clearRect !== 'function') return;
    ctx.clearRect(0, 0, FLAPPY.width, FLAPPY.height);
    ctx.fillStyle = '#080b1c';
    ctx.fillRect(0, 0, FLAPPY.width, FLAPPY.height);
    ctx.fillStyle = '#38f5a3';
    ctx.beginPath();
    ctx.arc(FLAPPY.birdX, state.birdY, FLAPPY.birdRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff3fa4';
    for (const pipe of state.pipes) {
      ctx.fillRect(pipe.x, 0, FLAPPY.pipeWidth, pipe.gapY);
      ctx.fillRect(pipe.x, pipe.gapY + pipe.gap, FLAPPY.pipeWidth, FLAPPY.height);
    }
    ctx.font = '24px monospace';
    ctx.fillText(String(state.score), FLAPPY.width / 2 - 10, 40);
  },

  rules: {
    isOver: (state) => state.over,
    winner: (state) => (state.over ? 0 : null),
    score: (state) => state.score,
    fitness: (state) => state.score + (state.over ? 0 : state.ticks / 600),
  },
});
