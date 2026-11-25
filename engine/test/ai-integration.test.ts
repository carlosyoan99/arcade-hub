import { describe, expect, it } from 'vitest';
import { verifyBrain } from '../src/ai/brain.js';
import { trainHeadless } from '../src/ai/trainer.js';
import { flappyGame } from '../src/games/flappy/game.js';
import { pongGame } from '../src/games/pong/game.js';

describe('IA neuronal sobre juegos reales', () => {
  it('entrena Flappy con el mismo step() y valida con semillas nunca vistas', () => {
    const result = trainHeadless({
      game: flappyGame,
      seed: 4242,
      generations: 3,
      population: 8,
      ticksPerEval: 200,
      validationSeeds: 3,
    });

    expect(result.history).toHaveLength(3);
    expect(result.validation.seeds).toHaveLength(3);
    expect(result.validation.scores).toHaveLength(3);
    expect(Number.isFinite(result.validation.median)).toBe(true);
    expect(Number.isFinite(result.validation.worst)).toBe(true);
    expect(verifyBrain(result.champion)).toBe(true);
    for (const seed of result.validation.seeds) {
      expect(result.trainingSeeds).not.toContain(seed);
    }
  });

  it('el entrenamiento es reproducible con la misma semilla', () => {
    const options = {
      game: pongGame,
      seed: 777,
      generations: 2,
      population: 6,
      ticksPerEval: 120,
      validationSeeds: 2,
    } as const;
    const a = trainHeadless(options);
    const b = trainHeadless(options);
    expect(a.champion.checksum).toBe(b.champion.checksum);
    expect(a.validation.scores).toEqual(b.validation.scores);
  });
});
