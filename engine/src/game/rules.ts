import type { GameRules } from './contract.js';

export interface SinglePlayerRulesState {
  readonly score: number;
  readonly over: boolean;
  readonly winner?: number | null;
}

/** Reglas estándar para juegos de un jugador. La IA nunca escribe récords. */
export function singlePlayerRules<S extends SinglePlayerRulesState>(
  fitness: (state: S) => number = (state) => state.score,
): GameRules<S> {
  return {
    isOver: (state) => state.over,
    winner: (state) => (state.over ? (state.winner ?? 0) : null),
    score: (state) => state.score,
    fitness,
  };
}
