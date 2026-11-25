import { describe, expect, it } from 'vitest';
import { verifyBrain } from '../src/ai/brain.js';
import { trainHeadless } from '../src/ai/trainer.js';
import type { GameDefinition } from '../src/game/contract.js';
import { demoGame, type DemoState } from '../src/game/example.js';

/** El juego sigue siendo el de ejemplo: el test solo aporta la observación. */
const game: GameDefinition<DemoState> = {
  ...demoGame,
  observe(state: DemoState): Float32Array {
    return Float32Array.from([
      Math.max(-1, Math.min(1, state.score / 50)),
      Math.max(-1, Math.min(1, state.pending / 3)),
      Math.max(-1, Math.min(1, state.hits / 10)),
    ]);
  },
};

const config = {
  game,
  seed: 4242,
  generations: 3,
  population: 6,
  ticksPerEval: 90,
  validationSeeds: 5,
} as const;

describe('entrenador headless', () => {
  it('entrena con el mismo step() y devuelve un campeón válido', () => {
    const result = trainHeadless(config);
    expect(result.history.length).toBe(3);
    expect(result.champion.gameId).toBe('demo');
    expect(result.champion.topology.outputs).toBe(game.actions.length);
    expect(verifyBrain(result.champion)).toBe(true);
    expect(result.validation.seeds.length).toBe(5);
    expect(result.validation.scores.length).toBe(5);
    expect(Number.isFinite(result.validation.median)).toBe(true);
    // El campeón realmente juega: consigue puntos con semillas nunca vistas.
    expect(result.validation.median).toBeGreaterThan(0);
    expect(result.checkpoints.length).toBe(3);
  });

  it('es estable: misma semilla, mismo campeón e historial', () => {
    const a = trainHeadless(config);
    const b = trainHeadless(config);
    expect(a.champion.checksum).toBe(b.champion.checksum);
    expect(a.history).toEqual(b.history);
    expect(a.validation).toEqual(b.validation);
    expect(a.trainingSeeds).toEqual(b.trainingSeeds);
  });

  it('las semillas de validación nunca se usan al entrenar', () => {
    const result = trainHeadless(config);
    const validation = new Set(result.validation.seeds);
    expect(validation.size).toBe(result.validation.seeds.length);
    expect(result.trainingSeeds.every((seed) => !validation.has(seed))).toBe(true);
  });

  it('acepta una función de aptitud alternativa', () => {
    const result = trainHeadless({ ...config, fitness: (state) => state.hits });
    expect(result.validation.median).toBeGreaterThanOrEqual(0);
    expect(verifyBrain(result.champion)).toBe(true);
  });

  it('exige observe() en el juego', () => {
    expect(() => trainHeadless({ ...config, game: demoGame })).toThrow(TypeError);
  });
});
