import type { ActionName } from '../core/types.js';
import type { ActionState } from './actions.js';

/**
 * Cinta de entradas por tick: el conjunto completo de acciones pulsadas.
 * La usan IA, replays y red exactamente igual que un jugador humano.
 */
export type InputFrame = readonly ActionName[];

export function applyInputFrame(actions: ActionState, frame: InputFrame = []): void {
  const next = new Set(frame);
  for (const name of actions.registered) {
    if (next.has(name) !== actions.isDown(name)) {
      actions.setDown(name, next.has(name));
    }
  }
}

export function captureInputFrame(actions: ActionState): InputFrame {
  return actions.registered.filter((name) => actions.isDown(name));
}

export interface Replay {
  readonly seed: number;
  readonly tickRate: number;
  readonly frames: readonly InputFrame[];
}

export function createReplay(seed: number, tickRate: number, frames: readonly InputFrame[]): Replay {
  return { seed, tickRate, frames };
}
