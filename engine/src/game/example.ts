import { defineGame } from './contract.js';

/**
 * Juego de prueba del motor, no parte del catálogo. Demuestra la frontera:
 * el juego solo declara estado y reglas; timers, RNG, eventos y acciones
 * vienen del motor.
 */
export interface DemoState {
  score: number;
  hits: number;
  pending: number;
}

export const demoGame = defineGame<DemoState>({
  id: 'demo',
  meta: { title: 'Demo determinista', players: [1], modes: ['solo', 'demo'] },
  actions: ['primary', 'restart'],
  init(_seed, ctx) {
    return { score: 0, hits: 0, pending: ctx.rng.int(4) };
  },
  step(state, ctx) {
    if (ctx.actions.wasPressed('primary')) {
      state.hits++;
      state.score += ctx.rng.int(10) + 1;
      ctx.emit('hit', state.score);
      ctx.schedule(3, () => {
        state.pending++;
      });
    }
  },
  rules: {
    isOver: (state) => state.hits >= 10,
    winner: () => 0,
    score: (state) => state.score,
    fitness: (state) => state.score,
  },
});
