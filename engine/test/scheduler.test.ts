import { describe, expect, it } from 'vitest';
import { createClock } from '../src/core/clock.js';
import { createScheduler } from '../src/core/scheduler.js';

describe('scheduler de simulación', () => {
  it('dispara en el tick previsto y solo una vez', () => {
    const clock = createClock(1 / 60);
    const scheduler = createScheduler(clock);
    let calls = 0;
    scheduler.schedule(3, () => calls++);
    for (let i = 0; i < 2; i++) {
      clock.advance();
      scheduler.advance();
    }
    expect(calls).toBe(0);
    clock.advance();
    scheduler.advance();
    expect(calls).toBe(1);
    clock.advance();
    scheduler.advance();
    expect(calls).toBe(1);
  });

  it('no avanza en pausa y se puede cancelar', () => {
    const clock = createClock(1 / 60);
    const scheduler = createScheduler(clock);
    let calls = 0;
    const id = scheduler.schedule(2, () => calls++);
    clock.advance();
    // pausa: no se llama a advance
    expect(calls).toBe(0);
    scheduler.cancel(id);
    clock.advance();
    scheduler.advance();
    expect(calls).toBe(0);
    expect(scheduler.pending()).toBe(0);
  });

  it('sobrevive a snapshot/restore', () => {
    const clock = createClock(1 / 60);
    const scheduler = createScheduler(clock);
    let calls = 0;
    scheduler.schedule(4, () => calls++);
    const snapshot = scheduler.snapshot();
    scheduler.clear();
    scheduler.restore(snapshot);
    for (let i = 0; i < 4; i++) {
      clock.advance();
      scheduler.advance();
    }
    expect(calls).toBe(1);
  });
});
