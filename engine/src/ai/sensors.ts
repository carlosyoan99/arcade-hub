/** Normalización reutilizable de observaciones. Sin azar y sin dependencias. */

export interface SensorRange {
  readonly min: number;
  readonly max: number;
}

/** Rango de las observaciones ya normalizadas que producen los juegos. */
export const UNIT_RANGE: SensorRange = Object.freeze({ min: -1, max: 1 });

export function clip(value: number, min: number, max: number): number {
  if (!(max >= min)) throw new RangeError('clip: max debe ser >= min');
  return value < min ? min : value > max ? max : value;
}

/** Escala un valor de su rango al rango [-1, 1] y recorta fuera de rango. */
export function normalize(value: number, range: SensorRange): number {
  if (!Number.isFinite(value)) throw new RangeError('normalize: valor no finito');
  if (!Number.isFinite(range.min) || !Number.isFinite(range.max) || !(range.max > range.min)) {
    throw new RangeError('normalize: rango no válido');
  }
  const scaled = ((value - range.min) / (range.max - range.min)) * 2 - 1;
  return clip(scaled, -1, 1);
}

export function normalizeObservation(
  values: Float32Array | readonly number[],
  ranges: readonly SensorRange[],
): Float32Array {
  if (ranges.length !== values.length) {
    throw new RangeError('normalizeObservation: un rango por sensor');
  }
  const output = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    output[i] = Math.fround(normalize(values[i] as number, ranges[i] as SensorRange));
  }
  return output;
}

/** Recorte simple para juegos que ya entregan observaciones normalizadas. */
export function clipObservation(
  values: Float32Array | readonly number[],
  min = -1,
  max = 1,
): Float32Array {
  const output = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const value = values[i] as number;
    if (!Number.isFinite(value)) throw new RangeError('clipObservation: valor no finito');
    output[i] = Math.fround(clip(value, min, max));
  }
  return output;
}
