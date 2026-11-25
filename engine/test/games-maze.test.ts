import { describe, expect, it } from 'vitest';
import { createGameSimulation, gameSimulationOptions } from '../src/game/adapter.js';
import type { GameDefinition } from '../src/game/contract.js';
import type { InputFrame } from '../src/input/virtual.js';
import { runHeadless } from '../src/tools/headless.js';
import { bombermanGame } from '../src/games/bomberman/game.js';
import { pacmanGame } from '../src/games/pac-man/game.js';
import { qbertGame } from '../src/games/qbert/game.js';
import { froggerGame } from '../src/games/frogger/game.js';
import { digDugGame } from '../src/games/dig-dug/game.js';
import { burgerTimeGame } from '../src/games/burger-time/game.js';
import { donkeyKongGame } from '../src/games/donkey-kong/game.js';
import { cellSwarmGame } from '../src/games/cell-swarm/game.js';

function runSuite<S extends object>(
  game: GameDefinition<S>,
  tape: (tick: number) => InputFrame,
): void {
  it('es determinista con la misma semilla y cinta de inputs', () => {
    const options = gameSimulationOptions(game, { seed: 4242 });
    const a = runHeadless({ ...options, ticks: 300, inputsAt: tape });
    const b = runHeadless({ ...options, ticks: 300, inputsAt: tape });
    expect(a.hash).toBe(b.hash);
  });

  it('la dificultad sube con el progreso', () => {
    const config = game.progression;
    expect(config).toBeDefined();
    const levels = config?.levels ?? [];
    expect(levels.length).toBeGreaterThanOrEqual(3);
    expect((config?.patterns ?? []).length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]?.speed ?? 0).toBeGreaterThan(levels[i - 1]?.speed ?? 0);
    }

    const sim = createGameSimulation(game, { seed: 99 });
    const before = sim.ctx.progression.state;
    const target = (config?.pointsPerLevel ?? 1) * (levels.length - 1) + 1;
    const mutable = sim.state as unknown as Record<string, number>;
    mutable.progress = target;
    mutable.gained = target;
    sim.tick([]);
    const after = sim.ctx.progression.state;
    expect(after.speed).toBeGreaterThan(before.speed);
    expect(after.hazard).toBeGreaterThanOrEqual(before.hazard);
  });

  it('observación finita y normalizada', () => {
    const sim = createGameSimulation(game, { seed: 7 });
    for (let i = 0; i < 40; i++) sim.tick(tape(i + 1));
    const observation = game.observe?.(sim.state, 0);
    expect(observation).toBeInstanceOf(Float32Array);
    expect(observation?.length ?? 0).toBeGreaterThan(0);
    expect([...(observation ?? [])].every((value) => Number.isFinite(value))).toBe(true);
  });

  it('emite al menos un evento de juice', () => {
    const sim = createGameSimulation(game, { seed: 11 });
    let count = 0;
    for (let i = 0; i < 220; i++) {
      sim.tick(tape(i + 1));
      count += sim.events.drain().length;
    }
    expect(count).toBeGreaterThan(0);
  });
}

describe('Juegos de laberinto sobre la API del motor', () => {
  describe('Bomberman', () => {
    runSuite(bombermanGame, (tick) =>
      tick === 8 ? ['bomb'] : tick % 10 === 0 ? ['right'] : [],
    );
  });

  describe('Pac-Man', () => {
    runSuite(pacmanGame, (tick) => (tick % 7 === 0 ? ['right'] : []));
  });

  describe('Q*bert', () => {
    runSuite(qbertGame, (tick) => (tick % 9 === 0 ? ['downRight'] : []));
  });

  describe('Frogger', () => {
    runSuite(froggerGame, (tick) => (tick % 13 === 0 ? ['up'] : []));
  });

  describe('Dig Dug', () => {
    runSuite(digDugGame, (tick) =>
      tick === 16 ? ['pump'] : tick % 8 === 0 ? ['down'] : [],
    );
  });

  describe('Burger Time', () => {
    runSuite(burgerTimeGame, (tick) => (tick % 7 === 0 ? ['right'] : []));
  });

  describe('Donkey Kong', () => {
    runSuite(donkeyKongGame, (tick) =>
      tick === 20 ? ['jump'] : tick % 9 === 0 ? ['right'] : [],
    );
  });

  describe('Cell Swarm', () => {
    runSuite(cellSwarmGame, (tick) =>
      tick === 30 ? ['split'] : tick % 6 === 0 ? ['right'] : [],
    );
  });
});
