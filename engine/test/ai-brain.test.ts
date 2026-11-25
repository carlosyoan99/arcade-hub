import { describe, expect, it } from 'vitest';
import {
  BrainValidationError,
  brainToJSON,
  createBrain,
  parseBrain,
  parseBrainJSON,
  serializeBrain,
  verifyBrain,
  withBrainScore,
} from '../src/ai/brain.js';
import { countWeights, defineTopology, serializeWeights } from '../src/ai/mlp.js';

function sample() {
  const topology = defineTopology({ inputs: 1, hidden: [2], outputs: 2 });
  const weights = Float32Array.from(
    { length: countWeights(topology) },
    (_, i) => Math.fround((i + 1) / 10),
  );
  return createBrain({
    gameId: 'demo',
    gameVersion: '1.0',
    topology,
    weights,
    meta: { seed: 7, score: 12.5 },
  });
}

describe('cerebro versionado', () => {
  it('serializa y carga conservando pesos y checksum', () => {
    const brain = sample();
    const loaded = parseBrain(serializeBrain(brain));
    expect(verifyBrain(brain)).toBe(true);
    expect(loaded.checksum).toBe(brain.checksum);
    expect(loaded.meta).toEqual(brain.meta);
    expect(serializeWeights(loaded.weights)).toBe(serializeWeights(brain.weights));
    expect(brainToJSON(brain).weights).toMatch(/^[0-9a-f]+$/);
  });

  it('rechaza JSON manipulado', () => {
    const original = brainToJSON(sample()) as unknown as Record<string, unknown>;
    const withChecksum = (patch: Record<string, unknown>): Record<string, unknown> => ({
      ...original,
      ...patch,
    });
    expect(() => parseBrainJSON(withChecksum({ checksum: 'deadbeef-4' }))).toThrow(
      BrainValidationError,
    );
    expect(() => parseBrainJSON(withChecksum({ v: 2 }))).toThrow(BrainValidationError);
    expect(() => parseBrainJSON(withChecksum({ score: 'x' }))).toThrow(BrainValidationError);
    expect(() =>
      parseBrainJSON(withChecksum({ meta: { seed: 7, score: Number.NaN } })),
    ).toThrow(BrainValidationError);
    expect(() => parseBrainJSON(withChecksum({ extra: true }))).toThrow(BrainValidationError);
    expect(() => parseBrainJSON(withChecksum({ weights: [0.1, 0.2] }))).toThrow(
      BrainValidationError,
    );
    const weights = original['weights'] as string;
    const last = weights.slice(-1) === 'f' ? '0' : 'f';
    expect(() => parseBrainJSON(withChecksum({ weights: `${weights.slice(0, -1)}${last}` }))).toThrow(
      BrainValidationError,
    );
    const topology = { ...(original['topology'] as object), inputs: 99 };
    expect(() => parseBrainJSON(withChecksum({ topology }))).toThrow(BrainValidationError);
    expect(() => parseBrain('{ no es json')).toThrow(BrainValidationError);
  });

  it('detecta pesos no finitos y mutaciones en memoria', () => {
    const brain = sample();
    const json = brainToJSON(brain) as unknown as Record<string, unknown>;
    const nanHex = Array.from({ length: countWeights(brain.topology) }, () => '7fc00000').join('');
    expect(() => parseBrainJSON({ ...json, weights: nanHex })).toThrow(BrainValidationError);
    brain.weights[0] = 0.123;
    expect(verifyBrain(brain)).toBe(false);
    const badWeights = brain.weights.slice();
    badWeights[0] = Number.POSITIVE_INFINITY;
    expect(() =>
      createBrain({
        gameId: 'demo',
        gameVersion: '1.0',
        topology: brain.topology,
        weights: badWeights,
        meta: brain.meta,
      }),
    ).toThrow(BrainValidationError);
  });

  it('recambia el checksum al cambiar la puntuación', () => {
    const brain = sample();
    const scored = withBrainScore(brain, 99);
    expect(scored.checksum).not.toBe(brain.checksum);
    expect(scored.meta.score).toBe(99);
    expect(serializeWeights(scored.weights)).toBe(serializeWeights(brain.weights));
    expect(verifyBrain(scored)).toBe(true);
  });
});
