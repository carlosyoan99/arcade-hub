import { describe, expect, it } from 'vitest';
import { createRNG } from '../src/core/rng.js';
import {
  createDifficultyAgent,
  DIFFICULTY_PROFILES,
  difficultyProfile,
  selectCheckpoint,
  type BrainCheckpoint,
} from '../src/ai/difficulty.js';
import { createBrain } from '../src/ai/brain.js';
import { defineTopology } from '../src/ai/mlp.js';

const topology = defineTopology({ inputs: 1, hidden: [], outputs: 2 });

function checkpoint(generation: number, first: number): BrainCheckpoint {
  return {
    generation,
    brain: createBrain({
      gameId: 'demo',
      gameVersion: '0',
      topology,
      weights: Float32Array.from([2, -2, first, -first]),
      meta: { seed: generation, score: generation },
    }),
  };
}

const checkpoints = [checkpoint(5, 1), checkpoint(20, 2), checkpoint(60, 3), checkpoint(100, 4)];
const obs = Float32Array.from([0]);

describe('dificultad por checkpoints', () => {
  it('selecciona el checkpoint según fracción de generaciones', () => {
    expect(selectCheckpoint(checkpoints, 'easy', 100).meta.score).toBe(5);
    expect(selectCheckpoint(checkpoints, 'normal', 100).meta.score).toBe(20);
    expect(selectCheckpoint(checkpoints, 'hard', 100).meta.score).toBe(100);
    expect(difficultyProfile('hard')).toEqual(DIFFICULTY_PROFILES['hard']);
    expect(() => selectCheckpoint([], 'easy')).toThrow(RangeError);
  });

  it('retraso y error se inyectan sin reentrenar y son reproducibles', () => {
    const options = { actions: ['primary', 'restart'], totalGenerations: 100, delayTicks: 2 };
    const make = (errorRate: number) =>
      createDifficultyAgent(checkpoints, 'normal', { ...options, errorRate });
    const firstAgent = make(0);
    const baseline = make(0);
    const errorAgent = make(1);

    expect(firstAgent.act(obs, createRNG(11))).toEqual(['primary']);
    const baselineRng = createRNG(11);
    const errorRng = createRNG(11);
    const baselineFrames = Array.from({ length: 9 }, () => baseline.act(obs, baselineRng));
    const errorFrames = Array.from({ length: 9 }, () => errorAgent.act(obs, errorRng));
    expect(baselineFrames.filter((frame) => frame.length === 0).length).toBeGreaterThan(0);

    const repeatBaseline = make(0);
    const repeatRng = createRNG(11);
    expect(Array.from({ length: 9 }, () => repeatBaseline.act(obs, repeatRng))).toEqual(
      baselineFrames,
    );
    expect(errorFrames.some((frame, i) => frame.length > 0 && frame[0] !== baselineFrames[i]?.[0])).toBe(true);

    baseline.reset();
    expect(baseline.act(obs, createRNG(11))).toEqual(['primary']);
  });
});
