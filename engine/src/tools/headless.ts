import { createSimulation, type SimulationOptions } from '../core/simulation.js';
import type { InputFrame } from '../input/virtual.js';

export interface HeadlessOptions<S extends object> extends SimulationOptions<S> {
  readonly ticks: number;
  readonly inputsAt?: (tick: number) => InputFrame;
}

export interface HeadlessResult {
  readonly ticks: number;
  readonly hash: string;
  readonly events: number;
}

/** Corre el mismo step() del juego sin DOM. Base de tests, replays e IA. */
export function runHeadless<S extends object>(options: HeadlessOptions<S>): HeadlessResult {
  if (!Number.isInteger(options.ticks) || options.ticks < 0) {
    throw new RangeError('runHeadless: ticks debe ser un entero >= 0');
  }
  const simulation = createSimulation(options);
  let events = 0;

  for (let tick = 1; tick <= options.ticks; tick++) {
    simulation.tick(options.inputsAt?.(tick) ?? []);
    events += simulation.events.drain().length;
  }

  return { ticks: options.ticks, hash: simulation.hash(), events };
}
