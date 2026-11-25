import { describe, expect, it } from 'vitest';
import { createRNG } from '../src/core/rng.js';
import type { InputFrame } from '../src/input/virtual.js';
import { NeuralBot, RuleBot, SearchBot } from '../src/ai/agents.js';
import { createBrain } from '../src/ai/brain.js';
import { countWeights, defineTopology } from '../src/ai/mlp.js';

const topology = defineTopology({ inputs: 1, hidden: [], outputs: 2 });

function twoOutputBrain(first: number, second: number) {
  return createBrain({
    gameId: 'demo',
    gameVersion: '0',
    topology,
    weights: Float32Array.from([2, -2, first, second]),
    meta: { seed: 1, score: 0 },
  });
}

describe('agentes', () => {
  it('RuleBot filtra acciones no registradas', () => {
    const bot = new RuleBot(() => ['primary', 'ghost'], ['primary', 'restart']);
    const frame: InputFrame = bot.act(Float32Array.from([0]));
    expect(frame).toEqual(['primary']);
  });

  it('NeuralBot elige la mayor salida y pulsa por flancos', () => {
    const bot = new NeuralBot(twoOutputBrain(2, -2), ['primary', 'restart']);
    expect(countWeights(topology)).toBe(4);
    expect(bot.act(Float32Array.from([0]))).toEqual(['primary']);
    expect(bot.act(Float32Array.from([0]))).toEqual([]);
    bot.reset();
    expect(bot.act(Float32Array.from([0]))).toEqual(['primary']);
    const levelBot = new NeuralBot(twoOutputBrain(2, -2), ['primary', 'restart'], { mode: 'level' });
    expect(levelBot.act(Float32Array.from([0]))).toEqual(['primary']);
    expect(levelBot.act(Float32Array.from([0]))).toEqual(['primary']);
    expect(() => new NeuralBot(twoOutputBrain(1, 1), ['primary'])).toThrow(RangeError);
  });

  it('SearchBot es una búsqueda corta y reproducible', () => {
    const make = (): SearchBot =>
      new SearchBot({
        actions: ['left', 'right', 'fire'],
        rng: createRNG(777),
        depth: 3,
        evaluate: (_obs, frame) => (frame.includes('fire') ? 10 : 0),
      });
    const a = make();
    const b = make();
    const obs = Float32Array.from([0]);
    expect(a.act(obs)).toEqual(['fire']);
    expect(b.act(obs)).toEqual(['fire']);
    expect(() => new SearchBot({
      actions: ['a'],
      rng: createRNG(1),
      depth: -1,
      evaluate: () => 0,
    })).toThrow(RangeError);
  });
});
