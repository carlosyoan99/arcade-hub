import type { ActionName } from '../core/types.js';
import type { ActionState } from './actions.js';

/**
 * Cinta de entradas por tick: el conjunto completo de acciones pulsadas.
 * La usan IA, replays y red exactamente igual que un jugador humano.
 */
export type InputFrame = readonly ActionName[];

export interface PointerFrame {
  readonly x: number;
  readonly y: number;
  readonly active?: boolean;
}

/** Cinta con acciones y puntero opcional para ratón, stick o táctil. */
export interface InputFrameWithPointer {
  readonly actions: InputFrame;
  readonly pointer?: PointerFrame;
}

export function applyInputFrameWithPointer(
  actions: ActionState,
  frame: InputFrameWithPointer,
): void {
  applyInputFrame(actions, frame.actions);
  const pointer = frame.pointer;
  if (pointer !== undefined) {
    actions.setPointer(pointer.x, pointer.y, pointer.active ?? true);
  } else {
    actions.setPointer(0.5, 0.5, false);
  }
}

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
  readonly pointers?: readonly (PointerFrame | undefined)[];
}

export function createReplay(
  seed: number,
  tickRate: number,
  frames: readonly InputFrame[],
  pointers?: readonly (PointerFrame | undefined)[],
): Replay {
  return pointers !== undefined ? { seed, tickRate, frames, pointers } : { seed, tickRate, frames };
}
