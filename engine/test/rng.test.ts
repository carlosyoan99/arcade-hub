import { describe, expect, it } from 'vitest';
import { createRNG } from '../src/core/rng.js';

describe('RNG sembrable', () => {
  it('la misma semilla da la misma secuencia', () => {
    const a = createRNG(1234);
    const b = createRNG(1234);
    const sequenceA = Array.from({ length: 50 }, () => a.next());
    const sequenceB = Array.from({ length: 50 }, () => b.next());
    expect(sequenceA).toEqual(sequenceB);
    expect(sequenceA.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('semillas distintas dan secuencias distintas', () => {
    expect(createRNG(1).next()).not.toBe(createRNG(2).next());
  });

  it('fork no altera el generador original', () => {
    const a = createRNG(55);
    const before = a.snapshot();
    const b = a.fork(9);
    expect(b.next()).not.toBe(a.next());
    expect(a.snapshot()).not.toBe(before);
    a.restore(before);
    expect(a.snapshot()).toBe(before);
  });

  it('int respeta el rango', () => {
    const rng = createRNG(7);
    for (let i = 0; i < 100; i++) {
      const value = rng.int(6);
      expect(Number.isInteger(value) && value >= 0 && value < 6).toBe(true);
    }
  });
});
