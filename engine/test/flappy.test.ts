import { describe, expect, it } from 'vitest';
import { createGameSimulation, gameSimulationOptions } from '../src/game/adapter.js';
import { runHeadless } from '../src/tools/headless.js';
import { FLAPPY, flappyGame } from '../src/games/flappy/game.js';

const simulation = () => createGameSimulation(flappyGame, { seed: 808 });

describe('Flappy Bird sobre la API del motor', () => {
  it('declara solo acciones y reglas del juego', () => {
    expect(flappyGame.actions).toEqual(['flap', 'restart', 'pause']);
    expect(flappyGame.meta.modes).toContain('demo');
  });

  it('es determinista', () => {
    const options = gameSimulationOptions(flappyGame, { seed: 4321 });
    const inputsAt = (tick: number) => (tick % 12 === 0 ? ['flap'] : []);
    const a = runHeadless({ ...options, ticks: 500, inputsAt });
    const b = runHeadless({ ...options, ticks: 500, inputsAt });
    expect(a.hash).toBe(b.hash);
  });

  it('el aleteo cambia la velocidad vertical', () => {
    const sim = simulation();
    sim.tick([]);
    const before = sim.state.birdVy;
    sim.tick(['flap']);
    expect(sim.state.birdVy).toBeLessThan(before);
  });

  it('genera tubos y puntúa al superarlos', () => {
    const sim = simulation();
    for (let i = 0; i < 45; i++) sim.tick(i % 12 === 0 ? ['flap'] : []);
    expect(sim.state.pipes.length).toBeGreaterThan(0);
    const pipe = sim.state.pipes[0];
    expect(pipe).toBeDefined();
    sim.state.birdY = pipe!.gapY + FLAPPY.pipeGap / 2;
    sim.state.birdVy = 0;
    pipe!.x = FLAPPY.birdX - FLAPPY.birdRadius - FLAPPY.pipeWidth - 2;
    sim.tick([]);
    expect(sim.state.score).toBe(1);
  });

  it('termina al chocar con el suelo', () => {
    const sim = simulation();
    for (let i = 0; i < 200 && !sim.state.over; i++) sim.tick([]);
    expect(sim.state.over).toBe(true);
    expect(flappyGame.rules.isOver(sim.state)).toBe(true);
  });

  it('observación para la IA normalizada', () => {
    const sim = simulation();
    const observation = flappyGame.observe?.(sim.state, 0);
    expect(observation?.length).toBe(5);
    expect([...(observation ?? [])].every((value) => Number.isFinite(value))).toBe(true);
  });
});
