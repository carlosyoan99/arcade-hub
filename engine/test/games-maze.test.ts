import { describe, expect, it } from 'vitest';
import { createGameSimulation, gameSimulationOptions } from '../src/game/adapter.js';
import type { GameDefinition } from '../src/game/contract.js';
import type { InputFrame } from '../src/input/virtual.js';
import { runHeadless } from '../src/tools/headless.js';
import { BOMBERMAN, bombermanGame } from '../src/games/bomberman/game.js';
import { PACMAN, pacmanGame } from '../src/games/pac-man/game.js';
import { QBERT, qbertGame } from '../src/games/qbert/game.js';
import { FROGGER, froggerGame } from '../src/games/frogger/game.js';
import { DIGDUG, digDugGame } from '../src/games/dig-dug/game.js';
import { BURGER, burgerTimeGame } from '../src/games/burger-time/game.js';
import { DK, donkeyKongGame } from '../src/games/donkey-kong/game.js';
import { SWARM, cellSwarmGame } from '../src/games/cell-swarm/game.js';

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
    it('laberinto 13×11, puerta y oleadas completas', () => {
      const sim = createGameSimulation(bombermanGame, { seed: 5 });
      expect(sim.state.grid.length).toBe(BOMBERMAN.rows);
      expect(sim.state.grid[0]?.length).toBe(BOMBERMAN.cols);
      expect(sim.state.grid[BOMBERMAN.door.r]?.[BOMBERMAN.door.c]).toBe(BOMBERMAN.brick);
      expect(sim.state.enemies.length).toBeGreaterThanOrEqual(2);
      expect(sim.state.enemies.some((enemy) => enemy.type === 'oneal')).toBe(true);
      sim.tick(['bomb']);
      expect(sim.state.bombs.length).toBe(1);
    });
  });

  describe('Pac-Man', () => {
    runSuite(pacmanGame, (tick) => (tick % 7 === 0 ? ['right'] : []));
    it('laberinto 28×31, 4 fantasmas y tunnel wrap', () => {
      const sim = createGameSimulation(pacmanGame, { seed: 5 });
      expect(sim.state.maze.length).toBe(PACMAN.rows);
      expect(sim.state.maze[0]?.length).toBe(PACMAN.cols);
      expect(sim.state.ghosts.map((ghost) => ghost.name)).toEqual(['blinky', 'pinky', 'inky', 'clyde']);
      expect(sim.state.dotsLeft).toBeGreaterThan(200);
      sim.state.x = -PACMAN.cs;
      sim.tick([]);
      expect(sim.state.x).toBeGreaterThan(PACMAN.cols * PACMAN.cs);
    });
  });

  describe('Q*bert', () => {
    runSuite(qbertGame, (tick) => (tick % 9 === 0 ? ['downRight'] : []));
    it('pirámide completa de 28 cubos y huevo de Coily', () => {
      const sim = createGameSimulation(qbertGame, { seed: 5 });
      expect(sim.state.cubes.length).toBe(28);
      expect(sim.state.cubes[27]?.k).toBe(QBERT.maxK);
      for (let i = 0; i < 10; i++) {
        sim.tick(['downRight']);
        for (let t = 0; t < 14; t++) sim.tick([]);
      }
      expect(sim.state.coily !== null || sim.state.over || sim.state.level > 1).toBe(true);
    });
  });

  describe('Frogger', () => {
    runSuite(froggerGame, (tick) => (tick % 13 === 0 ? ['up'] : []));
    it('15 carriles con carretera/río y reloj de simulación para tortugas', () => {
      const sim = createGameSimulation(froggerGame, { seed: 5 });
      expect(sim.state.obstacles.some((obstacle) => obstacle.type === 'log')).toBe(true);
      expect(sim.state.obstacles.some((obstacle) => obstacle.type === 'turtle')).toBe(true);
      expect(sim.state.obstacles.some((obstacle) => ['car', 'truck', 'racecar'].includes(obstacle.type))).toBe(true);
      expect(sim.state.timeLeft).toBe(FROGGER.timeLimit);
      const before = sim.state.simTime;
      sim.tick([]);
      expect(sim.state.simTime).toBeGreaterThan(before);
    });
  });

  describe('Dig Dug', () => {
    runSuite(digDugGame, (tick) =>
      tick === 16 ? ['pump'] : tick % 8 === 0 ? ['down'] : [],
    );
    it('grid 20×22 con rocas, Pooka/Fygar y temporizador de oleada en estado', () => {
      const sim = createGameSimulation(digDugGame, { seed: 5 });
      expect(sim.state.grid.length).toBe(DIGDUG.rows);
      expect(sim.state.grid[0]?.length).toBe(DIGDUG.cols);
      expect(sim.state.enemies.some((enemy) => enemy.type === 'pooka')).toBe(true);
      expect(sim.state.enemies.some((enemy) => enemy.type === 'fygar')).toBe(true);
      expect(typeof sim.state.waveTimer).toBe('number');
    });

    it('nivel alto no cuelga la generación de rocas', () => {
      const sim = createGameSimulation(digDugGame, { seed: 77 });
      sim.state.level = 1000;
      for (const enemy of sim.state.enemies) enemy.alive = false;
      for (let i = 0; i < 45; i++) sim.tick([]);
      expect(sim.state.level).toBe(1001);
      let rockCells = 0;
      for (const row of sim.state.grid) {
        for (const cell of row) if (cell === DIGDUG.rock) rockCells++;
      }
      expect(rockCells).toBeGreaterThan(0);
      // 16 columnas × 14 filas de parejas candidatas ⇒ como máximo 448 celdas.
      expect(rockCells).toBeLessThanOrEqual(16 * 14 * 2);
    });
  });

  describe('Burger Time', () => {
    runSuite(burgerTimeGame, (tick) => (tick % 7 === 0 ? ['right'] : []));
    it('5 plataformas, escaleras e ingredientes en cascada', () => {
      const sim = createGameSimulation(burgerTimeGame, { seed: 5 });
      expect(sim.state.platforms.length).toBe(BURGER.platforms);
      expect(sim.state.ingredients.length).toBeGreaterThanOrEqual(20);
      expect(sim.state.enemies.length).toBeGreaterThanOrEqual(3);
      expect(sim.state.platforms.slice(1).every((platform) => platform.gaps.length === 2)).toBe(true);
    });
  });

  describe('Donkey Kong', () => {
    runSuite(donkeyKongGame, (tick) =>
      tick === 20 ? ['jump'] : tick % 9 === 0 ? ['right'] : [],
    );
    it('4 fases arcade con martillo y plataformas originales', () => {
      const sim = createGameSimulation(donkeyKongGame, { seed: 5 });
      expect(DK.width).toBe(480);
      expect(DK.height).toBe(540);
      expect(sim.state.phase).toBe(0);
      expect(sim.state.hammerTaken).toBe(false);
      expect(sim.state.phase).toBeGreaterThanOrEqual(0);
      expect(sim.state.phase).toBeLessThanOrEqual(3);
    });
  });

  describe('Cell Swarm', () => {
    runSuite(cellSwarmGame, (tick) =>
      tick === 30 ? ['split'] : tick % 6 === 0 ? ['right'] : [],
    );
    it('mundo 5000×5000 con 600 comidas, 20 bots, virus y perseguidores', () => {
      const sim = createGameSimulation(cellSwarmGame, { seed: 5 });
      expect(SWARM.world).toBe(5000);
      expect(sim.state.foods.length).toBe(600);
      expect(sim.state.bots.length).toBe(20);
      expect(sim.state.viruses.length).toBeGreaterThanOrEqual(8);
      expect(sim.state.chasers.length).toBe(15);
    });
  });
});
