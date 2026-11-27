import { describe, expect, it } from 'vitest';
import { createGameSimulation, gameSimulationOptions } from '../src/game/adapter.js';
import type { GameDefinition } from '../src/game/contract.js';
import type { InputFrame } from '../src/input/virtual.js';
import type { StepContext } from '../src/core/simulation.js';
import { runHeadless } from '../src/tools/headless.js';
import { BOMBERMAN, bombermanGame } from '../src/games/bomberman/game.js';
import { PACMAN, pacmanGame } from '../src/games/pac-man/game.js';
import { QBERT, qbertGame } from '../src/games/qbert/game.js';
import { FROGGER, froggerGame } from '../src/games/frogger/game.js';
import { DIGDUG, digDugGame } from '../src/games/dig-dug/game.js';
import { BURGER, burgerTimeGame } from '../src/games/burger-time/game.js';
import { DK, donkeyKongGame } from '../src/games/donkey-kong/game.js';
import { SWARM, cellSwarmGame } from '../src/games/cell-swarm/game.js';

/** Fija `hazard` sin alterar `speed` para aislar su efecto en cada juego. */
function forceHazard(sim: { readonly ctx: StepContext }, hazard: number): void {
  const service = sim.ctx.progression;
  const descriptor = Object.getOwnPropertyDescriptor(service, 'state');
  Object.defineProperty(service, 'state', {
    configurable: true,
    get: () => ({ ...(descriptor?.get?.call(service) as object), hazard }),
  });
}

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

    it('hazard añade enemigos y acelera su patrulla', () => {
      const base = createGameSimulation(bombermanGame, { seed: 5 });
      const hard = createGameSimulation(bombermanGame, { seed: 5 });
      forceHazard(base, 0);
      forceHazard(hard, 0.4);
      base.tick(['restart']);
      hard.tick(['restart']);
      expect(hard.state.enemies.length).toBeGreaterThan(base.state.enemies.length);
      expect(hard.state.enemies[0]?.speed).toBeGreaterThan(base.state.enemies[0]?.speed ?? 0);
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

    it('vaciar el laberinto gana la partida sin cambiar de nivel', () => {
      const sim = createGameSimulation(pacmanGame, { seed: 5 });
      const level = sim.state.level;
      sim.state.dotsLeft = 0;
      sim.tick([]);
      expect(sim.state.over).toBe(true);
      expect(sim.state.level).toBe(level);
      expect(sim.events.drain().some((event) => event.type === 'win')).toBe(true);
      // Los cuatro fantasmas siguen teniendo objetivo propio (scatter/chase).
      expect(sim.state.ghosts.map((ghost) => ghost.name)).toEqual(['blinky', 'pinky', 'inky', 'clyde']);
      expect(sim.state.ghosts.every((ghost) =>
        Number.isFinite(ghost.scatterX) && Number.isFinite(ghost.scatterY))).toBe(true);
    });

    it('hazard acelera la persecución de los fantasmas', () => {
      const stepAdvance = (hazard: number): number => {
        const sim = createGameSimulation(pacmanGame, { seed: 5 });
        forceHazard(sim, hazard);
        const ghost = sim.state.ghosts[0];
        expect(ghost).toBeDefined();
        if (ghost === undefined) return 0;
        // Corredor abierto (fila 4), lejos del centro de la celda para evitar el snap.
        const startX = 10 * PACMAN.cs + PACMAN.cs / 2 + 4;
        ghost.mode = 'chase';
        ghost.x = startX;
        ghost.y = 4 * PACMAN.cs + PACMAN.cs / 2;
        ghost.dx = 1;
        ghost.dy = 0;
        sim.tick([]);
        return (sim.state.ghosts[0]?.x ?? startX) - startX;
      };
      const base = stepAdvance(0);
      const hard = stepAdvance(0.3);
      expect(base).toBeGreaterThan(0);
      expect(hard).toBeGreaterThan(base * 1.05);
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

    it('hazard adelanta slick y la incubación de Coily', () => {
      const base = createGameSimulation(qbertGame, { seed: 5 });
      const hard = createGameSimulation(qbertGame, { seed: 5 });
      forceHazard(base, 0);
      forceHazard(hard, 0.4);
      base.state.slickTimer = 0;
      hard.state.slickTimer = 0;
      base.tick([]);
      hard.tick([]);
      expect(base.state.slick.length).toBe(0);
      expect(hard.state.slick.length).toBeGreaterThan(0);

      base.state.coily = null;
      hard.state.coily = null;
      base.state.jumpCount = QBERT.eggAfterJumps - 1;
      hard.state.jumpCount = QBERT.eggAfterJumps - 1;
      base.tick(['downRight']);
      hard.tick(['downRight']);
      expect((base.state.coily as { kind: string } | null)?.kind).toBe('egg');
      expect(hard.state.eggTimer).toBeLessThan(base.state.eggTimer);
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

    it('el bonus es aleatorio ponderado con ctx.rng, no una rotación fija', () => {
      const doubles: string[][] = [];
      const seen = new Set<string>();
      for (let seed = 1; seed <= 80; seed++) {
        const sim = createGameSimulation(froggerGame, { seed });
        const types = sim.state.bonusItems.map((item) => item.type);
        for (const type of types) seen.add(type);
        if (types.length === 2) doubles.push(types);
      }
      expect(doubles.length).toBeGreaterThan(10);
      expect([...seen].sort()).toEqual(['butterfly', 'fly', 'snake']);
      // Con kinds[i % 3] dos bonus consecutivos nunca repetirían tipo.
      expect(doubles.some(([first, second]) => first === second)).toBe(true);
    });

    it('hazard acelera carriles y añade tráfico', () => {
      const base = createGameSimulation(froggerGame, { seed: 5 });
      const hard = createGameSimulation(froggerGame, { seed: 5 });
      forceHazard(base, 0);
      forceHazard(hard, 0.3);
      base.tick(['restart']);
      hard.tick(['restart']);
      expect(hard.state.obstacles.length).toBeGreaterThan(base.state.obstacles.length);
      const baseCar = base.state.obstacles.find((obstacle) => obstacle.type === 'car');
      const hardCar = hard.state.obstacles.find((obstacle) => obstacle.type === 'car');
      expect(hardCar?.speed ?? 0).toBeGreaterThan(baseCar?.speed ?? 0);
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

    it('excavar tierra emite dig con posición y abre el túnel', () => {
      const sim = createGameSimulation(digDugGame, { seed: 5 });
      const state = sim.state;
      const row = state.grid[4];
      expect(row).toBeDefined();
      if (row === undefined) return;
      row[5] = DIGDUG.empty;
      row[6] = DIGDUG.dirt;
      state.c = 5;
      state.r = 4;
      const score = state.score;
      sim.events.drain();
      sim.tick(['right']);
      const digs = sim.events.drain().filter((event) => event.type === 'dig');
      expect(digs).toHaveLength(1);
      expect(digs[0]?.payload).toMatchObject({ c: 6, r: 4 });
      expect(row[6]).toBe(DIGDUG.empty);
      expect(state.c).toBe(6);
      expect(state.score).toBe(score + 1);
    });

    it('hazard aumenta el número de enemigos y su velocidad', () => {
      const base = createGameSimulation(digDugGame, { seed: 5 });
      const hard = createGameSimulation(digDugGame, { seed: 5 });
      forceHazard(base, 0);
      forceHazard(hard, 0.4);
      base.tick(['restart']);
      hard.tick(['restart']);
      expect(hard.state.enemies.length).toBeGreaterThan(base.state.enemies.length);
      expect(hard.state.enemies[0]?.moveInterval ?? 1).toBeLessThan(base.state.enemies[0]?.moveInterval ?? 0);
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

    it('progress sube por nivel, no por hamburguesa', () => {
      const sim = createGameSimulation(burgerTimeGame, { seed: 5 });
      const state = sim.state;
      state.enemies = [];
      state.stunned = 0;
      state.ingredients = [];
      const stack = [BURGER.bunBot, BURGER.patty, BURGER.tomato, BURGER.lettuce, BURGER.bunTop];
      for (let plat = 0; plat < BURGER.platforms - 1; plat++) {
        for (const type of stack) {
          state.ingredients.push({
            x: 100,
            y: 0,
            baseY: 0,
            plat,
            type,
            falling: false,
            fallTimer: 0,
            landed: true,
          });
        }
      }
      sim.tick([]);
      expect(state.burgersCompleted).toBe(4);
      expect(state.level).toBe(2);
      // Antes: +1 por burger ⇒ 4. Ahora: +1 al cerrar el nivel.
      expect(state.progress).toBe(1);
      sim.tick([]);
      expect(sim.ctx.progression.state.level).toBe(1);
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

    it('↑ trepa pero no salta; jump salta', () => {
      const sim = createGameSimulation(donkeyKongGame, { seed: 5 });
      for (let i = 0; i < 60 && !sim.state.onGround; i++) sim.tick([]);
      expect(sim.state.onGround).toBe(true);
      sim.events.drain();
      sim.tick(['up']);
      expect(sim.events.drain().some((event) => event.type === 'jump')).toBe(false);
      sim.state.onGround = true;
      sim.tick([]);
      sim.events.drain();
      sim.tick(['jump']);
      expect(sim.events.drain().some((event) => event.type === 'jump')).toBe(true);
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

    it('el puntero activo fija el objetivo de la célula principal', () => {
      const sim = createGameSimulation(cellSwarmGame, { seed: 5 });
      sim.ctx.actions.setPointer(0.9, 0.2, true);
      sim.tick([]);
      expect(sim.state.targetX).toBeCloseTo(0.9 * SWARM.world, 1);
      expect(sim.state.targetY).toBeCloseTo(0.2 * SWARM.world, 1);

      const other = createGameSimulation(cellSwarmGame, { seed: 5 });
      other.ctx.actions.setPointer(0.5, 0.5, false);
      const x = other.state.cells[0]?.x ?? 0;
      other.tick(['right']);
      expect(other.state.targetX).toBeGreaterThan(x);
    });

    it('gained se reinicia al subir de nivel y el progreso se acumula', () => {
      const sim = createGameSimulation(cellSwarmGame, { seed: 5 });
      sim.state.gained = 250;
      sim.tick([]);
      expect(sim.state.level).toBe(2);
      expect(sim.state.progress).toBeGreaterThanOrEqual(250);
      expect(sim.state.gained).toBe(0);
    });
  });
});
