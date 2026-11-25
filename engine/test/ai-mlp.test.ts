import { describe, expect, it } from 'vitest';
import { createRNG } from '../src/core/rng.js';
import {
  countWeights,
  createMLP,
  defineTopology,
  deserializeWeights,
  parseTopology,
  randomWeights,
  serializeWeights,
} from '../src/ai/mlp.js';

describe('MLP pequeño', () => {
  it('forward con pesos conocidos', () => {
    const topology = defineTopology({ inputs: 2, hidden: [2], outputs: 1 });
    expect(countWeights(topology)).toBe(9);
    const weights = Float32Array.from([
      0.5, -0.5, 0.2, 0.8, // pesos de la capa oculta
      0.1, -0.2, // sesgos de la capa oculta
      1, -1, 0.3, // peso, peso y sesgo de salida
    ]);
    const mlp = createMLP(topology, weights);
    const output = mlp.forward(Float32Array.from([0.4, -0.6]));
    const h0 = Math.fround(Math.tanh(Math.fround(0.5 * 0.4 + -0.5 * -0.6 + 0.1)));
    const h1 = Math.fround(Math.tanh(Math.fround(0.2 * 0.4 + 0.8 * -0.6 - 0.2)));
    const expected = Math.fround(Math.tanh(Math.fround(h0 - h1 + 0.3)));
    expect(output.length).toBe(1);
    expect(output[0]).toBeCloseTo(expected, 5);
    expect(output[0]).toBeCloseTo(0.8796, 3);
  });

  it('relu oculta y sigmoid de salida', () => {
    const topology = defineTopology({
      inputs: 1,
      hidden: [],
      outputs: 1,
      activation: 'relu',
      outputActivation: 'sigmoid',
    });
    const mlp = createMLP(topology, Float32Array.from([2, -1]));
    expect(mlp.forward(Float32Array.from([1]))[0]).toBeCloseTo(1 / (1 + Math.exp(-1)), 5);
    expect(mlp.forward(Float32Array.from([-1]))[0]).toBeCloseTo(1 / (1 + Math.exp(3)), 5);
  });

  it('serialización determinista de pesos', () => {
    const topology = defineTopology({ inputs: 2, hidden: [2], outputs: 1 });
    const weights = randomWeights(topology, createRNG(42));
    const hex = serializeWeights(weights);
    expect(hex).toMatch(/^[0-9a-f]+$/);
    expect(hex.length).toBe(countWeights(topology) * 8);
    expect(serializeWeights(deserializeWeights(hex, weights.length))).toBe(hex);
    expect(serializeWeights(randomWeights(topology, createRNG(42)))).toBe(hex);
    expect(serializeWeights(randomWeights(topology, createRNG(43)))).not.toBe(hex);
  });

  it('valida forma y longitud', () => {
    const topology = defineTopology({ inputs: 2, hidden: [], outputs: 1 });
    expect(() => createMLP(topology, Float32Array.from([1, 2]))).toThrow(RangeError);
    expect(() => createMLP(topology, Float32Array.from([1, Number.NaN, 2]))).toThrow(RangeError);
    expect(() => createMLP(topology, Float32Array.from([1, 2, 3])).forward(Float32Array.from([1]))).toThrow(RangeError);
    expect(() => parseTopology({ inputs: 2, hidden: [], outputs: 1, activation: 'tanh' })).toThrow();
    expect(() => deserializeWeights('0g', 1)).toThrow(TypeError);
  });
});
