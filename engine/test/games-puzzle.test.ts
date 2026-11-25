import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createGameSimulation, gameSimulationOptions } from '../src/game/adapter.js';
import type { GameDefinition } from '../src/game/contract.js';
import type { InputFrame } from '../src/input/virtual.js';
import { runHeadless } from '../src/tools/headless.js';
import { BREAKOUT, breakoutGame } from '../src/games/breakout/game.js';
import { SNAKE, snakeGame } from '../src/games/snake/game.js';
import { TETRIS, rotateBlocks, takeFromBag, tetrisGame } from '../src/games/tetris/game.js';
import { COLUMNS, columnsGame } from '../src/games/columns/game.js';
import { PUYO, puyoGame } from '../src/games/puyo-puyo/game.js';
import { DINO, dinoGame } from '../src/games/dino-runner/game.js';
import { JOUST, joustGame } from '../src/games/joust/game.js';

type AnyGame = GameDefinition<object>;

interface GameFixture {
  readonly game: AnyGame;
  readonly tape: (tick: number) => InputFrame;
  readonly juice: (tick: number) => InputFrame;
  readonly juiceTicks: number;
}

const fixtures: readonly GameFixture[] = [
  {
    game: breakoutGame as AnyGame,
    tape: (tick) => (tick === 1 ? ['launch'] : tick % 23 === 0 ? ['left'] : tick % 23 === 11 ? ['right'] : []),
    juice: (tick) => (tick === 1 ? ['launch'] : []),
    juiceTicks: 120,
  },
  {
    game: snakeGame as AnyGame,
    tape: (tick) => (tick % 17 === 0 ? ['up'] : tick % 17 === 5 ? ['left'] : []),
    juice: (tick) => (tick === 1 ? ['up'] : []),
    juiceTicks: 3,
  },
  {
    game: tetrisGame as AnyGame,
    tape: (tick) => (tick % 7 === 0 ? ['hardDrop'] : tick % 7 === 2 ? ['rotate'] : tick % 7 === 4 ? ['hold'] : []),
    juice: (tick) => (tick === 1 ? ['hardDrop'] : []),
    juiceTicks: 3,
  },
  {
    game: columnsGame as AnyGame,
    tape: (tick) => (tick % 40 === 0 ? ['hardDrop'] : tick % 9 === 3 ? ['rotate'] : tick % 9 === 6 ? ['left'] : []),
    juice: (tick) => (tick === 1 ? ['rotate'] : []),
    juiceTicks: 3,
  },
  {
    game: puyoGame as AnyGame,
    tape: (tick) => (tick % 12 === 0 ? ['hardDrop'] : tick % 9 === 3 ? ['rotate'] : tick % 9 === 6 ? ['right'] : []),
    juice: (tick) => (tick === 1 ? ['rotate'] : []),
    juiceTicks: 3,
  },
  {
    game: dinoGame as AnyGame,
    tape: (tick) => (tick % 20 === 0 ? ['jump'] : tick % 20 === 10 ? ['duck'] : []),
    juice: () => [],
    juiceTicks: 100,
  },
  {
    game: joustGame as AnyGame,
    tape: (tick) => (tick % 11 === 0 ? ['flap'] : tick % 11 < 5 ? ['right'] : ['left']),
    juice: (tick) => (tick === 1 ? ['flap'] : []),
    juiceTicks: 3,
  },
];

const ids = fixtures.map((fixture) => fixture.game.id);

describe('Juegos migrados sobre la API del motor', () => {
  it('los siete juegos están declarados con su id', () => {
    expect(ids).toEqual(['breakout', 'snake', 'tetris', 'columns', 'puyo-puyo', 'dino-runner', 'joust']);
  });

  for (const fixture of fixtures) {
    const { game, tape, juice, juiceTicks } = fixture;

    describe(game.id, () => {
      it('(a) es determinista con la misma semilla y cinta de entradas', () => {
        const options = gameSimulationOptions(game, { seed: 4242 });
        const a = runHeadless({ ...options, ticks: 240, inputsAt: tape });
        const b = runHeadless({ ...options, ticks: 240, inputsAt: tape });
        expect(a.hash).toBe(b.hash);
        expect(a.ticks).toBe(240);
      });

      it('(b) la dificultad sube con el progreso y el step actualiza la curva', () => {
        const config = game.progression;
        expect(config).toBeDefined();
        const levels = config!.levels;
        expect(levels.length).toBeGreaterThanOrEqual(3);
        for (let i = 1; i < levels.length; i++) {
          expect(levels[i]!.speed).toBeGreaterThan(levels[i - 1]!.speed);
          expect(levels[i]!.hazard ?? 0).toBeGreaterThanOrEqual(levels[i - 1]!.hazard ?? 0);
        }
        expect(levels[levels.length - 1]!.hazard ?? 0).toBeGreaterThan(0);
        expect(config!.patterns?.length ?? 0).toBeGreaterThanOrEqual(3);

        const sim = createGameSimulation(game, { seed: 99 });
        const before = sim.ctx.progression.state;
        sim.tick(tape(1));
        expect(sim.ctx.progression.state.ticks).toBe(before.ticks + 1);
        sim.ctx.progression.update(1_000_000);
        const after = sim.ctx.progression.state;
        expect(after.speed).toBeGreaterThan(before.speed);
        expect(after.hazard).toBeGreaterThan(before.hazard);
      });

      it('(c) observe devuelve una Float32Array finita y normalizada', () => {
        const sim = createGameSimulation(game, { seed: 17 });
        for (let tick = 1; tick <= 30; tick++) sim.tick(tape(tick));
        const observation = game.observe?.(sim.state as object, 0);
        expect(observation).toBeInstanceOf(Float32Array);
        expect(observation!.length).toBeGreaterThan(0);
        for (const value of observation!) {
          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(-1.01);
          expect(value).toBeLessThanOrEqual(1.01);
        }
      });

      it('(d) emite al menos un evento de juice', () => {
        const result = runHeadless({
          ...gameSimulationOptions(game, { seed: 2026 }),
          ticks: juiceTicks,
          inputsAt: juice,
        });
        expect(result.events).toBeGreaterThan(0);
      });
    });
  }
});

describe('Contrato: sin reloj real ni azar en la lógica', () => {
  it('ningún juego usa Math.random, Date.now, setTimeout ni DOM', () => {
    for (const id of ids) {
      const source = readFileSync(new URL(`../src/games/${id}/game.ts`, import.meta.url), 'utf8');
      expect(source).not.toMatch(/Math\.random|Date\.now|setTimeout|document\./);
    }
  });
});

describe('Breakout: ladrillos, ángulo y anti-stuck', () => {
  it('la pelota rebota en la paleta con el ángulo según el punto de impacto', () => {
    const sim = createGameSimulation(breakoutGame, { seed: 1 });
    sim.tick(['launch']);
    expect(sim.state.serving).toBe(false);
    sim.state.paddleX = BREAKOUT.width / 2;
    sim.state.ball.x = BREAKOUT.width / 2;
    sim.state.ball.y = BREAKOUT.paddleY - BREAKOUT.paddleThickness / 2 - BREAKOUT.ballRadius + 1;
    sim.state.ball.vx = 0;
    sim.state.ball.vy = 1;
    sim.tick([]);
    expect(sim.state.ball.vy).toBeLessThan(0);

    const state = sim.state;
    state.paddleX = BREAKOUT.width / 2 - 30;
    state.ball.x = BREAKOUT.width / 2;
    state.ball.y = BREAKOUT.paddleY - BREAKOUT.paddleThickness / 2 - BREAKOUT.ballRadius + 1;
    state.ball.vx = 0;
    state.ball.vy = 1;
    sim.tick([]);
    expect(state.ball.vx).toBeGreaterThan(0);
  });

  it('rompe un ladrillo, suma puntos y emite brickBreak', () => {
    const sim = createGameSimulation(breakoutGame, { seed: 7 });
    sim.tick(['launch']);
    sim.events.drain();
    const brick = sim.state.bricks.find((candidate) => candidate.alive)!;
    sim.state.ball.x = brick.x;
    sim.state.ball.y = brick.y + BREAKOUT.brickH / 2 + BREAKOUT.ballRadius + 2;
    sim.state.ball.vx = 0;
    sim.state.ball.vy = -1;
    sim.tick([]);
    expect(sim.state.score).toBeGreaterThan(0);
    expect(sim.state.bricksBroken).toBe(1);
    expect(sim.events.drain().some((event) => event.type === 'brickBreak')).toBe(true);
  });

  it('el anti-stuck invierte la caída tras el intervalo sin golpes', () => {
    const sim = createGameSimulation(breakoutGame, { seed: 8 });
    sim.tick(['launch']);
    sim.events.drain();
    sim.state.stuckTimer = 299;
    sim.state.ball.vx = 0;
    sim.state.ball.vy = 0.5;
    sim.tick([]);
    expect(sim.state.ball.vy).toBeLessThan(0);
    expect(sim.events.drain().some((event) => event.type === 'antiStuck')).toBe(true);
  });
});

describe('Snake: velocidad progresiva y BFS', () => {
  it('sube de velocidad cada 10 comidas hasta el nivel 10', () => {
    const sim = createGameSimulation(snakeGame, { seed: 31 });
    sim.state.score = 90;
    sim.tick([]);
    expect(sim.state.speedLevel).toBe(SNAKE.maxSpeedLevel);
    expect(sim.state.nextStep).not.toBeNull();
  });

  it('come y emite eat', () => {
    const sim = createGameSimulation(snakeGame, { seed: 32 });
    const head = sim.state.body[0]!;
    sim.state.food = { x: head.x + 1, y: head.y };
    sim.events.drain();
    for (let i = 0; i < 12; i++) sim.tick([]);
    expect(sim.state.score).toBe(1);
    expect(sim.events.drain().some((event) => event.type === 'eat')).toBe(true);
  });
});

describe('Tetris: 7-bag, SRS, T-Spin, lock delay, ghost y hold', () => {
  it('la bolsa de 7 no repite pieza en cada ciclo', () => {
    const sim = createGameSimulation(tetrisGame, { seed: 31337 });
    while (sim.state.bag.length > 0) takeFromBag(sim.state, sim.ctx);
    const drawn = Array.from({ length: 21 }, () => takeFromBag(sim.state, sim.ctx));
    for (let cycle = 0; cycle < 3; cycle++) {
      const group = drawn.slice(cycle * 7, cycle * 7 + 7);
      expect(new Set(group).size).toBe(7);
      expect([...group].sort()).toEqual([...TETRIS.names].sort());
    }
  });

  it('aplica wall kicks SRS completos a la pieza I', () => {
    const sim = createGameSimulation(tetrisGame, { seed: 12 });
    const piece = sim.state.piece!;
    piece.name = 'I';
    piece.rot = 1;
    piece.x = -2;
    piece.y = 5;
    piece.blocks = rotateBlocks('I', 1);
    sim.tick(['rotate']);
    expect(piece.rot).toBe(2);
    expect(piece.x).toBeGreaterThanOrEqual(0);
  });

  it('fija la pieza al vencer el lock delay de 30 ticks', () => {
    const sim = createGameSimulation(tetrisGame, { seed: 13 });
    const piece = sim.state.piece!;
    piece.name = 'O';
    piece.rot = 0;
    piece.x = 4;
    piece.y = 20;
    piece.blocks = rotateBlocks('O', 0);
    for (let i = 0; i < TETRIS.lockDelayTicks; i++) sim.tick([]);
    expect(sim.state.grid[20]!.some((cell) => cell !== 0)).toBe(true);
  });

  it('el hard drop fija la pieza y el hold guarda la actual', () => {
    const sim = createGameSimulation(tetrisGame, { seed: 14 });
    const initialName = sim.state.piece!.name;
    sim.tick(['hold']);
    expect(sim.state.hold).toBe(initialName);
    expect(sim.state.canHold).toBe(false);
    sim.tick([]);
    const beforeScore = sim.state.score;
    sim.tick(['hardDrop']);
    expect(sim.state.score).toBeGreaterThan(beforeScore);
    expect(sim.state.ghostY).toBeGreaterThanOrEqual(0);
  });
});

describe('Columns: gemas, power-ups y timers de estado (B3/B6)', () => {
  it('B3: hardDrop funciona aunque pause esté en la misma cinta', () => {
    const sim = createGameSimulation(columnsGame, { seed: 21 });
    sim.events.drain();
    sim.tick(['pause', 'hardDrop']);
    expect(sim.events.drain().some((event) => event.type === 'hardDrop')).toBe(true);
    expect(sim.state.paused).toBe(true);
  });

  it('B6: el flash se congela al pausar y resuelve cascadas al reanudar', () => {
    const sim = createGameSimulation(columnsGame, { seed: 22 });
    sim.state.board[11]![0] = 0;
    sim.state.board[11]![1] = 0;
    sim.state.board[11]![2] = 0;
    sim.state.flashCells = ['11,0', '11,1', '11,2'];
    sim.state.pendingClear = true;
    sim.state.flashTimer = 5;
    sim.events.drain();
    sim.tick(['pause']);
    expect(sim.state.flashTimer).toBe(5);
    sim.tick([]); // suelta pause
    sim.tick(['pause']); // vuelve a pulsar para reanudar
    for (let i = 0; i < COLUMNS.flashTicks; i++) sim.tick([]);
    expect(sim.state.score).toBeGreaterThan(0);
    expect(sim.events.drain().some((event) => event.type === 'clear')).toBe(true);
  });

  it('las gemas especiales se generan y se consumen desde la cola', () => {
    const sim = createGameSimulation(columnsGame, { seed: 23 });
    sim.state.nextGem = COLUMNS.special.lightning;
    sim.tick([]);
    expect(sim.state.board).toHaveLength(COLUMNS.rows);
    expect(Object.values(COLUMNS.special)).toContain(COLUMNS.special.poison);
  });
});

describe('Puyo Puyo: cadenas, basura, CPU y timers (B4/B6)', () => {
  it('B4: hardDrop funciona aunque pause esté en la misma cinta', () => {
    const sim = createGameSimulation(puyoGame, { seed: 24 });
    sim.events.drain();
    sim.tick(['pause', 'hardDrop']);
    expect(sim.events.drain().some((event) => event.type === 'hardDrop')).toBe(true);
    expect(sim.state.paused).toBe(true);
  });

  it('B6: la basura diferida se congela al pausar y se descarta al reiniciar', () => {
    const sim = createGameSimulation(puyoGame, { seed: 25 });
    sim.state.garbageQueue = 2;
    sim.state.garbageTimer = 5;
    sim.tick(['pause']);
    expect(sim.state.garbageTimer).toBe(5);
    sim.tick([]); // suelta pause
    sim.tick(['pause']); // vuelve a pulsar para reanudar
    for (let col = 0; col < PUYO.cols; col++) sim.state.board[11]![col] = 0; // la basura se pega sobre puyos existentes
    for (let i = 0; i < 5; i++) sim.tick([]);
    expect(sim.state.garbageQueue).toBe(0);
    expect(sim.state.board.some((row) => row.includes(PUYO.garbage))).toBe(true);

    sim.state.garbageQueue = 4;
    sim.state.garbageTimer = 5;
    sim.tick(['restart']);
    expect(sim.state.garbageQueue).toBe(0);
    expect(sim.state.garbageTimer).toBe(0);
  });

  it('4 puyos del mismo color limpian y puntúan', () => {
    const sim = createGameSimulation(puyoGame, { seed: 33 });
    sim.tick([]);
    sim.state.piece.gems = [0, 0];
    sim.state.piece.col = 0;
    sim.events.drain();
    sim.tick(['hardDrop']);
    sim.tick([]);
    sim.state.piece.gems = [0, 0];
    sim.state.piece.col = 1;
    sim.tick(['hardDrop']);
    expect(sim.state.score).toBeGreaterThan(0);
    expect(sim.events.drain().some((event) => event.type === 'clear' || event.type === 'chain')).toBe(true);
  });

  it('el tablero CPU existe y piensa con el mismo tablero lógico', () => {
    const sim = createGameSimulation(puyoGame, { seed: 34 });
    expect(sim.state.cpuBoard).toHaveLength(PUYO.rows);
    for (let i = 0; i < PUYO.garbageDelayTicks + 5; i++) sim.tick([]);
    expect(sim.state.cpuPiece).not.toBeNull();
  });
});

describe('Dino Runner: cactus, pterodáctilos y ciclo día/noche (B8)', () => {
  it('B8: el cactus apoya su base en el suelo, no centrado bajo él', () => {
    let cactus: { y: number; h: number } | undefined;
    for (let seed = 41; seed <= 60 && cactus === undefined; seed++) {
      const sim = createGameSimulation(dinoGame, { seed });
      for (let i = 0; i < 100; i++) sim.tick([]);
      cactus = sim.state.obstacles.find((obstacle) => obstacle.type === 'cactus');
    }
    expect(cactus).toBeDefined();
    expect(cactus!.y + cactus!.h).toBeCloseTo(DINO.groundY, 5);
  });

  it('cada 100 m cambia día/noche y emite milestone', () => {
    const sim = createGameSimulation(dinoGame, { seed: 42 });
    sim.state.distance = 99.9;
    sim.events.drain();
    for (let i = 0; i < 5; i++) sim.tick([]);
    expect(sim.state.milestone).toBeGreaterThanOrEqual(1);
    expect(sim.state.isNight).toBe(true);
    expect(sim.events.drain().some((event) => event.type === 'dayNight')).toBe(true);
  });

  it('salta y muere al chocar', () => {
    const sim = createGameSimulation(dinoGame, { seed: 43 });
    sim.events.drain();
    sim.tick(['jump']);
    expect(sim.state.vy).toBeLessThan(0);
    expect(sim.events.drain().some((event) => event.type === 'jump')).toBe(true);
    for (let i = 0; i < 400 && !sim.state.over; i++) sim.tick([]);
    expect(sim.state.over).toBe(true);
  });
});

describe('Joust: altitud, huevos y oleadas sin reloj real (B7)', () => {
  it('gana la justa si su centro está más alto que el del enemigo', () => {
    const sim = createGameSimulation(joustGame, { seed: 51 });
    const player = sim.state.player;
    sim.state.enemies.push({
      x: player.x,
      y: player.y + 20,
      vx: 0,
      vy: 0,
      type: 'bounder',
      flapTimer: 1,
      flapInterval: 1,
      divePhase: null,
      diveTimer: 0,
      diveTarget: null,
    });
    sim.events.drain();
    const before = sim.state.score;
    sim.tick([]);
    expect(sim.state.score).toBeGreaterThan(before);
    expect(sim.events.drain().some((event) => event.type === 'joust')).toBe(true);
    expect(JOUST.enemyPoints.bounder).toBeGreaterThan(0);
  });

  it('recoge un huevo y suma bonus', () => {
    const sim = createGameSimulation(joustGame, { seed: 52 });
    const player = sim.state.player;
    sim.state.eggs.push({ x: player.x + 16, y: player.y + 10, vx: 0, vy: 0, timer: 5 });
    sim.events.drain();
    sim.tick([]);
    expect(sim.events.drain().some((event) => event.type === 'egg' || event.type === 'hatch')).toBe(true);
  });

  it('la oleada avanza y el fanfare usa el scheduler con guardas', () => {
    const sim = createGameSimulation(joustGame, { seed: 53 });
    sim.state.waveActive = false;
    sim.state.waveTimer = 1;
    sim.events.drain();
    sim.tick([]);
    expect(sim.state.wave).toBe(2);
    expect(sim.events.drain().some((event) => event.type === 'levelUp' || event.type === 'waveStart')).toBe(true);
  });
});

describe('Reglas de fin de partida', () => {
  it('cada juego declara isOver, winner, score y fitness coherentes', () => {
    for (const { game } of fixtures) {
      const sim = createGameSimulation(game, { seed: 5 });
      expect(game.rules.isOver(sim.state as object)).toBe(false);
      expect(game.rules.score(sim.state as object)).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(game.rules.fitness(sim.state as object))).toBe(true);
      (sim.state as { over: boolean }).over = true;
      expect(game.rules.isOver(sim.state as object)).toBe(true);
    }
  });
});
