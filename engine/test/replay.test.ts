import { describe, expect, it } from 'vitest';
import { inputsFromReplay, recordReplay } from '../src/tools/replay.js';

describe('replays', () => {
  it('recupera los frames por tick 1-based', () => {
    const replay = recordReplay(42, 60, [['up'], [], ['primary']]);
    const inputsAt = inputsFromReplay(replay);
    expect(inputsAt(1)).toEqual(['up']);
    expect(inputsAt(2)).toEqual([]);
    expect(inputsAt(3)).toEqual(['primary']);
    expect(inputsAt(4)).toEqual([]);
    expect(replay.seed).toBe(42);
    expect(replay.tickRate).toBe(60);
  });
});
