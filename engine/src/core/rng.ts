/**
 * PRNG xorshift32: estado de un solo Uint32, sembrable, serializable y rápido.
 * Nunca usa Math.random: dos simulaciones con la misma semilla son idénticas.
 */
export interface RNG {
  /** Estado crudo (Uint32). Expuesto para snapshot en estado de juego. */
  state: number;
  /** Float en [0, 1). */
  next(): number;
  /** Entero en [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Float en [min, max). */
  range(min: number, max: number): number;
  /** Nuevo generador derivado, sin alterar este. */
  fork(salt: number): RNG;
  snapshot(): number;
  restore(state: number): void;
}

const FALLBACK_SEED = 0x9e3779b9;

export function createRNG(seed: number): RNG {
  let state = normalize(seed);

  function normalize(value: number): number {
    const result = value >>> 0;
    return result === 0 ? FALLBACK_SEED : result;
  }

  function nextRaw(): number {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state;
  }

  return {
    get state(): number {
      return state;
    },
    set state(value: number) {
      state = normalize(value);
    },
    next(): number {
      return nextRaw() / 0x1_0000_0000;
    },
    int(maxExclusive: number): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new RangeError('RNG.int: maxExclusive debe ser un entero > 0');
      }
      return nextRaw() % maxExclusive;
    },
    range(min: number, max: number): number {
      if (!(max > min)) {
        throw new RangeError('RNG.range: max debe ser mayor que min');
      }
      return min + this.next() * (max - min);
    },
    fork(salt: number): RNG {
      return createRNG(state ^ (salt >>> 0));
    },
    snapshot(): number {
      return state;
    },
    restore(value: number): void {
      state = normalize(value);
    },
  };
}
