import type { Tick } from './types.js';

export interface ClockState {
  readonly tick: Tick;
}

/** Reloj de simulación: el tiempo es siempre `tick * dt`, nunca reloj real. */
export interface Clock {
  readonly dt: number;
  tick: Tick;
  readonly time: number;
  advance(ticks?: number): void;
  snapshot(): ClockState;
  restore(state: ClockState): void;
}

export function createClock(dt: number = 1 / 60, tick: Tick = 0): Clock {
  if (!Number.isFinite(dt) || dt <= 0) {
    throw new RangeError('createClock: dt debe ser finito y mayor que 0');
  }
  if (!Number.isInteger(tick) || tick < 0) {
    throw new RangeError('createClock: tick debe ser un entero >= 0');
  }

  let current = tick;

  return {
    dt,
    get tick(): Tick {
      return current;
    },
    set tick(value: Tick) {
      if (!Number.isInteger(value) || value < 0) {
        throw new RangeError('Clock.tick debe ser un entero >= 0');
      }
      current = value;
    },
    get time(): number {
      return current * dt;
    },
    advance(ticks: number = 1): void {
      if (!Number.isInteger(ticks) || ticks < 0) {
        throw new RangeError('Clock.advance: ticks debe ser un entero >= 0');
      }
      current += ticks;
    },
    snapshot(): ClockState {
      return { tick: current };
    },
    restore(state: ClockState): void {
      if (!Number.isInteger(state.tick) || state.tick < 0) {
        throw new RangeError('Clock.restore: tick inválido');
      }
      current = state.tick;
    },
  };
}
