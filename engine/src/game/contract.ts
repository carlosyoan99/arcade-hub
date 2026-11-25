import type { StepContext } from '../core/simulation.js';
import type { ActionName } from '../core/types.js';
import type { ProgressionConfig } from '../progression/curve.js';

export type GameMode = 'solo' | 'local' | 'vsAI' | 'online' | 'demo';

export interface GameMeta {
  readonly title: string;
  /** Número de jugadores soportados, o rango [min, max]. */
  readonly players: readonly number[];
  readonly modes: readonly GameMode[];
}

export interface GameRules<S extends object> {
  isOver(state: S): boolean;
  /** Id del slot ganador, o null si no hay / es empate. */
  winner(state: S): number | null;
  score(state: S): number;
  /** Aptitud para el entrenador headless de IA. */
  fitness(state: S): number;
}

/**
 * Contrato de un juego. Solo describe el juego: qué es, qué acciones pide,
 * cómo se inicializa, cómo avanza y cómo se puntúa. Los sistemas comunes
 * (bucle, entradas, colisiones, timers, audio, guardado, IA, red) son del motor.
 */
export interface GameDefinition<S extends object> {
  readonly id: string;
  readonly meta: GameMeta;
  readonly actions: readonly ActionName[];
  /** Curva de dificultad y patrones: datos, no lógica repetida en el juego. */
  readonly progression?: ProgressionConfig;
  init(seed: number, ctx: StepContext): S;
  step(state: S, ctx: StepContext): void;
  render?(r: unknown, state: S, alpha: number): void;
  observe?(state: S, playerId: number): Float32Array;
  readonly rules: GameRules<S>;
}

export function defineGame<S extends object>(definition: GameDefinition<S>): GameDefinition<S> {
  return definition;
}
