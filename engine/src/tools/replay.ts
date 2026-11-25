import { createReplay, type InputFrame, type Replay } from '../input/virtual.js';

export function recordReplay(
  seed: number,
  tickRate: number,
  frames: readonly InputFrame[],
): Replay {
  return createReplay(seed, tickRate, frames);
}

/** Cinta de inputs indexada por tick (1-based). */
export function inputsFromReplay(replay: Replay): (tick: number) => InputFrame {
  return (tick: number): InputFrame => replay.frames[tick - 1] ?? [];
}
