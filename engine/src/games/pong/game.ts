import { defineGame } from '../../game/contract.js';

export const PONG = {
  width: 960,
  height: 600,
  paddleWidth: 14,
  paddleHeight: 90,
  paddleInset: 28,
  paddleSpeed: 520,
  ballRadius: 8,
  ballSpeed: 420,
  winScore: 7,
} as const;

export interface PongBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface PongState {
  ball: PongBall;
  /** Posición Y del centro de cada pala. */
  left: number;
  right: number;
  score: [number, number];
  serving: boolean;
  over: boolean;
  winner: number | null;
  ticks: number;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function resetBall(state: PongStateInternal, direction: number): void {
  state.ball.x = PONG.width / 2;
  state.ball.y = PONG.height / 2;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.serving = true;
  state.serveDirection = direction;
}

/** Extensión interna del estado: dirección del saque siguiente. */
interface PongStateInternal extends PongState {
  serveDirection: number;
}

export const pongGame = defineGame<PongStateInternal>({
  id: 'pong',
  meta: { title: 'Pong', players: [1, 2], modes: ['solo', 'local', 'vsAI', 'online'] },
  actions: ['p1Up', 'p1Down', 'p2Up', 'p2Down', 'serve', 'pause', 'restart'],
  progression: {
    id: 'pong',
    levels: [
      { speed: 1, label: 'Nivel 1' },
      { speed: 1.12, hazard: 0.1, label: 'Nivel 2' },
      { speed: 1.25, hazard: 0.25, label: 'Nivel 3' },
      { speed: 1.4, hazard: 0.4, label: 'Nivel 4' },
    ],
    pointsPerLevel: 2,
    dda: { enabled: true, window: 300, maxAdjust: 0.08 },
    patterns: ['center', 'left', 'right', 'high', 'low'],
    avoidRepeat: 2,
  },

  init(_seed, ctx) {
    const direction = ctx.rng.int(2) === 0 ? -1 : 1;
    return {
      ball: { x: PONG.width / 2, y: PONG.height / 2, vx: 0, vy: 0 },
      left: PONG.height / 2,
      right: PONG.height / 2,
      score: [0, 0],
      serving: true,
      serveDirection: direction,
      over: false,
      winner: null,
      ticks: 0,
    };
  },

  step(state, ctx) {
    if (state.over) return;
    const dt = ctx.clock.dt;
    ctx.progression.update(state.score[0] + state.score[1]);

    if (ctx.actions.isDown('p1Up')) state.left -= PONG.paddleSpeed * dt;
    if (ctx.actions.isDown('p1Down')) state.left += PONG.paddleSpeed * dt;
    if (ctx.actions.isDown('p2Up')) state.right -= PONG.paddleSpeed * dt;
    if (ctx.actions.isDown('p2Down')) state.right += PONG.paddleSpeed * dt;

    const limit = PONG.height / 2 - PONG.paddleHeight / 2;
    state.left = clamp(state.left, limit, PONG.height - limit);
    state.right = clamp(state.right, limit, PONG.height - limit);

    if (state.serving) {
      if (ctx.actions.consume('serve')) {
        const angles: Record<string, number> = {
          center: 0,
          left: -0.35,
          right: 0.35,
          high: -0.5,
          low: 0.5,
        };
        const pattern = ctx.progression.nextPattern();
        const angle = pattern !== null && angles[pattern] !== undefined
          ? angles[pattern] as number + ctx.rng.range(-0.06, 0.06)
          : ctx.rng.range(-0.35, 0.35);
        const speed = PONG.ballSpeed * ctx.progression.state.speed;
        state.ball.vx = state.serveDirection * speed * Math.sqrt(1 - angle * angle);
        state.ball.vy = angle * speed;
        state.serving = false;
        ctx.emit('serve', { x: state.ball.x, y: state.ball.y });
      }
      state.ticks++;
      return;
    }

    const ball = state.ball;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.y - PONG.ballRadius <= 0 && ball.vy < 0) {
      ball.y = PONG.ballRadius;
      ball.vy = -ball.vy;
      ctx.emit('wallHit', { x: ball.x, y: ball.y });
    } else if (ball.y + PONG.ballRadius >= PONG.height && ball.vy > 0) {
      ball.y = PONG.height - PONG.ballRadius;
      ball.vy = -ball.vy;
      ctx.emit('wallHit', { x: ball.x, y: ball.y });
    }

    const leftX = PONG.paddleInset + PONG.paddleWidth;
    const rightX = PONG.width - PONG.paddleInset - PONG.paddleWidth;

    if (ball.vx < 0 && ball.x - PONG.ballRadius <= leftX && ball.x > PONG.paddleInset) {
      if (Math.abs(ball.y - state.left) <= PONG.paddleHeight / 2 + PONG.ballRadius) {
        const offset = clamp((ball.y - state.left) / (PONG.paddleHeight / 2), -1, 1);
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        ball.x = leftX + PONG.ballRadius;
        ball.vx = Math.abs(ball.vx);
        ball.vy = offset * speed * 0.75;
        ctx.emit('paddleHit', { side: 0, x: ball.x, y: ball.y });
        ctx.progression.observe(0.4);
      }
    }

    if (ball.vx > 0 && ball.x + PONG.ballRadius >= rightX && ball.x < PONG.width - PONG.paddleInset) {
      if (Math.abs(ball.y - state.right) <= PONG.paddleHeight / 2 + PONG.ballRadius) {
        const offset = clamp((ball.y - state.right) / (PONG.paddleHeight / 2), -1, 1);
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        ball.x = rightX - PONG.ballRadius;
        ball.vx = -Math.abs(ball.vx);
        ball.vy = offset * speed * 0.75;
        ctx.emit('paddleHit', { side: 1, x: ball.x, y: ball.y });
      }
    }

    if (ball.x < -20) {
      state.score[1]++;
      ctx.emit('score', { side: 1, score: [...state.score] });
      ctx.progression.observe(-0.8);
      resetBall(state, 1);
    } else if (ball.x > PONG.width + 20) {
      state.score[0]++;
      ctx.emit('score', { side: 0, score: [...state.score] });
      ctx.progression.observe(0.8);
      resetBall(state, -1);
    }

    if (state.score[0] >= PONG.winScore || state.score[1] >= PONG.winScore) {
      state.over = true;
      state.winner = state.score[0] > state.score[1] ? 0 : 1;
      ctx.emit('gameOver', { winner: state.winner });
    }
    state.ticks++;
  },

  observe(state, playerId) {
    const own = playerId === 0 ? state.left : state.right;
    const rival = playerId === 0 ? state.right : state.left;
    return new Float32Array([
      state.ball.x / PONG.width,
      state.ball.y / PONG.height,
      state.ball.vx / PONG.ballSpeed,
      state.ball.vy / PONG.ballSpeed,
      own / PONG.height,
      rival / PONG.height,
      state.serving ? 1 : 0,
    ]);
  },

  render(renderer, state) {
    const ctx = renderer as CanvasRenderingContext2D | null;
    if (!ctx || typeof ctx.clearRect !== 'function') return;
    ctx.clearRect(0, 0, PONG.width, PONG.height);
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, PONG.width, PONG.height);
    ctx.fillStyle = '#5ef2ff';
    ctx.fillRect(PONG.paddleInset, state.left - PONG.paddleHeight / 2, PONG.paddleWidth, PONG.paddleHeight);
    ctx.fillRect(
      PONG.width - PONG.paddleInset - PONG.paddleWidth,
      state.right - PONG.paddleHeight / 2,
      PONG.paddleWidth,
      PONG.paddleHeight,
    );
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, PONG.ballRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '32px monospace';
    ctx.fillText(`${state.score[0]}  ${state.score[1]}`, PONG.width / 2 - 28, 48);
  },

  rules: {
    isOver: (state) => state.over,
    winner: (state) => state.winner,
    score: (state) => state.score[0] * 100 + state.score[1],
    fitness: (state) =>
      (state.score[0] - state.score[1]) * 10 +
      (state.over ? (state.winner === 0 ? 100 : -100) : 0),
  },
});
