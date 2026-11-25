import { describe, expect, it } from 'vitest';
import { createSimulation } from '../src/core/simulation.js';
import { gameSimulationOptions } from '../src/game/adapter.js';
import { demoGame } from '../src/game/example.js';
import { runHeadless } from '../src/tools/headless.js';
import { createReplay } from '../src/input/virtual.js';
import { inputsFromReplay } from '../src/tools/replay.js';

const inputsAt = (tick: number) => (tick % 7 === 0 ? ['primary'] : []);

describe('determinismo', () => {
  it('misma semilla y mismos inputs producen el mismo hash', () => {
    const options = gameSimulationOptions(demoGame, { seed: 12345 });
    const a = runHeadless({ ...options, ticks: 600, inputsAt });
    const b = runHeadless({ ...options, ticks: 600, inputsAt });
    expect(a.hash).toBe(b.hash);
    expect(a.events).toBe(b.events);
  });

  it('coincide con el hash golden de referencia', () => {
    const options = gameSimulationOptions(demoGame, { seed: 12345 });
    expect(runHeadless({ ...options, ticks: 600 }).hash).toBe('600:3336926330:e22d095e-20');
  });

  it('semillas distintas producen hashes distintos', () => {
    const base = gameSimulationOptions(demoGame, { seed: 12345 });
    const other = gameSimulationOptions(demoGame, { seed: 54321 });
    expect(runHeadless({ ...base, ticks: 120, inputsAt }).hash).not.toBe(
      runHeadless({ ...other, ticks: 120, inputsAt }).hash,
    );
  });

  it('un replay reproduce exactamente la partida original', () => {
    const options = gameSimulationOptions(demoGame, { seed: 777 });
    const frames = Array.from({ length: 200 }, (_, i) =>
      i % 5 === 0 ? ['primary'] : [],
    );
    const original = runHeadless({ ...options, ticks: 200, inputsAt: (t) => frames[t - 1] ?? [] });
    const replay = createReplay(777, 60, frames);
    const reproduced = runHeadless({
      ...options,
      ticks: 200,
      inputsAt: inputsFromReplay(replay),
    });
    expect(reproduced.hash).toBe(original.hash);
  });

  it('snapshot/restore reproduce el futuro exacto', () => {
    const simulationOptions = gameSimulationOptions(demoGame, { seed: 99 });
    const reference = runHeadless({ ...simulationOptions, ticks: 300, inputsAt });

    const simulation = createSimulation(simulationOptions);
    for (let tick = 1; tick <= 150; tick++) simulation.tick(inputsAt(tick));
    const snapshot = simulation.snapshot();
    simulation.restore(snapshot);
    for (let tick = 151; tick <= 300; tick++) simulation.tick(inputsAt(tick));

    expect(simulation.hash()).toBe(reference.hash);
  });
});
