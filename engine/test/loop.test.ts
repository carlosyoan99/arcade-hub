import { describe, expect, it } from 'vitest';
import { createLoop } from '../src/core/loop.js';
import { createSimulation } from '../src/core/simulation.js';

function counter() {
  return createSimulation({
    seed: 1,
    tickRate: 60,
    init: () => ({ value: 0 }),
    step: (state) => {
      state.value++;
    },
  });
}

describe('bucle de paso fijo', () => {
  it('un segundo simulado son 60 ticks', () => {
    const simulation = counter();
    const loop = createLoop({ simulation });
    for (let i = 0; i < 60; i++) loop.advance(1000 / 60);
    expect(simulation.state.value).toBe(60);
    expect(simulation.clock.time).toBeCloseTo(1, 10);
  });

  it('stepOnce avanza un tick sin reloj real', () => {
    const simulation = counter();
    const loop = createLoop({ simulation });
    loop.stepOnce();
    loop.stepOnce();
    expect(simulation.clock.tick).toBe(2);
    expect(loop.alpha).toBe(0);
  });

  it('limitados los sub-pasos y el delta grande', () => {
    const simulation = counter();
    const loop = createLoop({ simulation, maxSubSteps: 3 });
    loop.advance(10_000);
    expect(simulation.clock.tick).toBe(3);
    expect(loop.alpha).toBeGreaterThanOrEqual(0);
    expect(loop.alpha).toBeLessThan(1);
  });
});
