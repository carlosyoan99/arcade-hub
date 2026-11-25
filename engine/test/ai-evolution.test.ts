import { describe, expect, it } from 'vitest';
import { createRNG } from '../src/core/rng.js';
import { createEvolver } from '../src/ai/evolution.js';
import { defineTopology, serializeWeights } from '../src/ai/mlp.js';

const topology = defineTopology({ inputs: 2, hidden: [3], outputs: 1 });

function fitnessSum(weights: Float32Array): number {
  let total = 0;
  for (const value of weights) total += value;
  return total;
}

function run(seed: number, generations = 4) {
  const evolver = createEvolver({
    rng: createRNG(seed),
    topology,
    populationSize: 8,
    seed,
    gameId: 'demo',
    gameVersion: '0',
  });
  const bests: number[] = [];
  for (let i = 0; i < generations; i++) {
    bests.push(evolver.step((brain) => fitnessSum(brain.weights)).bestFitness);
  }
  return {
    bests,
    population: evolver.population.map((brain) => serializeWeights(brain.weights)),
    checksums: evolver.history.map((entry) => entry.best.checksum),
  };
}

describe('neuroevolución', () => {
  it('misma semilla produce exactamente la misma evolución', () => {
    expect(run(1234)).toEqual(run(1234));
    expect(run(1234).population).not.toEqual(run(5678).population);
  });

  it('elitismo conserva a los mejores y no empeora el óptimo', () => {
    const result = run(99);
    for (let i = 1; i < result.bests.length; i++) {
      expect(result.bests[i] as number).toBeGreaterThanOrEqual(result.bests[i - 1] as number);
    }

    const evolver = createEvolver({
      rng: createRNG(5),
      topology,
      populationSize: 6,
      seed: 5,
      eliteCount: 2,
    });
    const step = evolver.step((brain) => fitnessSum(brain.weights));
    const eliteKeys = step.ranked.slice(0, 2).map((entry) => serializeWeights(entry.brain.weights));
    const survivorKeys = evolver.population
      .slice(0, 2)
      .map((brain) => serializeWeights(brain.weights));
    expect(survivorKeys).toEqual(eliteKeys);
  });

  it('nunca usa Math.random ni Date.now', () => {
    const originalRandom = Math.random;
    const originalNow = Date.now;
    Math.random = (): number => {
      throw new Error('Math.random está prohibido en la IA');
    };
    Date.now = (): number => {
      throw new Error('Date.now está prohibido en la IA');
    };
    let result: ReturnType<typeof run> | undefined;
    try {
      result = run(2026, 3);
    } finally {
      Math.random = originalRandom;
      Date.now = originalNow;
    }
    expect(result?.bests.length).toBe(3);
  });

  it('valida parámetros y fitness', () => {
    expect(() => createEvolver({
      rng: createRNG(1),
      topology,
      populationSize: 1,
      seed: 1,
    })).toThrow(RangeError);
    const evolver = createEvolver({ rng: createRNG(1), topology, populationSize: 4, seed: 1 });
    expect(() => evolver.step(() => Number.NaN)).toThrow(TypeError);
  });
});
