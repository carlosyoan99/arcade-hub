import { describe, expect, it } from 'vitest';
import { clip, clipObservation, normalize, normalizeObservation, UNIT_RANGE } from '../src/ai/sensors.js';

describe('sensores', () => {
  it('escala y recorta a [-1, 1]', () => {
    expect(normalize(0, { min: -10, max: 10 })).toBeCloseTo(0, 6);
    expect(normalize(10, { min: -10, max: 10 })).toBeCloseTo(1, 6);
    expect(normalize(5, { min: 0, max: 10 })).toBeCloseTo(0, 6);
    expect(clip(5, -1, 1)).toBe(1);
    expect(clipObservation(Float32Array.from([-4, 0.25, 9]))).toEqual(
      Float32Array.from([-1, 0.25, 1]),
    );
    expect(UNIT_RANGE).toEqual({ min: -1, max: 1 });
  });

  it('normaliza vectores con un rango por sensor', () => {
    const result = normalizeObservation(
      Float32Array.from([5, 100]),
      [
        { min: 0, max: 10 },
        { min: 0, max: 200 },
      ],
    );
    expect(result[0]).toBeCloseTo(0, 6);
    expect(result[1]).toBeCloseTo(0, 6);
    expect(() => normalizeObservation(Float32Array.from([1]), [])).toThrow(RangeError);
    expect(() => normalize(Number.NaN, { min: 0, max: 1 })).toThrow(RangeError);
    expect(() => normalize(0, { min: 1, max: 1 })).toThrow(RangeError);
  });
});
