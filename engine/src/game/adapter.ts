import type { EnginePlugin } from '../core/plugins.js';
import { createSimulation, type Simulation, type SimulationOptions } from '../core/simulation.js';
import type { GameDefinition } from './contract.js';
import { progressionPlugin } from '../progression/progression.js';

export interface GameSimulationConfig {
  readonly seed: number;
  readonly tickRate?: number;
  readonly plugins?: readonly EnginePlugin[];
}

/** Traduce un GameDefinition a opciones del motor, inyectando sus acciones. */
export function gameSimulationOptions<S extends object>(
  game: GameDefinition<S>,
  config: GameSimulationConfig,
): SimulationOptions<S> {
  const gamePlugin: EnginePlugin = {
    id: `game:${game.id}`,
    install(api): void {
      for (const action of game.actions) api.registerAction(action);
    },
  };

  return {
    seed: config.seed,
    ...(config.tickRate !== undefined ? { tickRate: config.tickRate } : {}),
    plugins: [
      gamePlugin,
      ...(game.progression !== undefined ? [progressionPlugin(game.progression)] : []),
      ...(config.plugins ?? []),
    ],
    init: game.init,
    step: game.step,
  };
}

export function createGameSimulation<S extends object>(
  game: GameDefinition<S>,
  config: GameSimulationConfig,
): Simulation<S> {
  return createSimulation(gameSimulationOptions(game, config));
}
