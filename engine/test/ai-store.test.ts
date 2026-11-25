import { describe, expect, it } from 'vitest';
import { createBrainStore, createMemoryStorage } from '../src/ai/brain-store.js';
import { BrainValidationError, createBrain, serializeBrain } from '../src/ai/brain.js';
import { defineTopology } from '../src/ai/mlp.js';

const topology = defineTopology({ inputs: 1, hidden: [], outputs: 1 });
const brain = createBrain({
  gameId: 'demo',
  gameVersion: '0',
  topology,
  weights: Float32Array.from([0.5, 0]),
  meta: { seed: 3, score: 4 },
});

describe('brain-store', () => {
  it('guarda y carga con el adaptador inyectado', () => {
    const storage = createMemoryStorage();
    const store = createBrainStore(storage, 'test');
    expect(store.load('best')).toBeNull();
    store.save('best', brain);
    expect(store.has('best')).toBe(true);
    expect(store.load('best')?.checksum).toBe(brain.checksum);
    expect(store.list()).toEqual(['best']);
    store.remove('best');
    expect(store.load('best')).toBeNull();
  });

  it('rechaza cerebros corruptos y aísla el namespace', () => {
    const storage = createMemoryStorage();
    const store = createBrainStore(storage, 'test');
    storage.set('test:bad', '{"v":1}');
    expect(() => store.load('bad')).toThrow(BrainValidationError);
    expect(store.tryLoad('bad')).toBeNull();
    expect(() => store.save('other', { ...brain, checksum: 'x' })).toThrow(BrainValidationError);
    storage.set('otro:best', serializeBrain(brain));
    expect(store.list()).not.toContain('otro:best');
    expect(store.has('best')).toBe(false);
  });
});
