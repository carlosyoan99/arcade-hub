import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createGameSimulation, gameSimulationOptions } from '../src/game/adapter.js';
import type { GameDefinition } from '../src/game/contract.js';
import { runHeadless } from '../src/tools/headless.js';
import { asteroidsGame } from '../src/games/asteroids/game.js';
import { centipedeGame } from '../src/games/centipede/game.js';
import { galagaGame } from '../src/games/galaga/game.js';
import { gradiusGame } from '../src/games/gradius/game.js';
import { raidenGame } from '../src/games/raiden/game.js';
import { spaceInvadersGame } from '../src/games/space-invaders/game.js';
import { tempestGame } from '../src/games/tempest/game.js';
import { missileCommandGame } from '../src/games/missile-command/game.js';

/** Todos los juegos del batch exponen `progress` para alimentar la curva. */
interface ShooterState {
  progress: number;
  score: number;
  paused: boolean;
  over: boolean;
}
type ShooterGame = GameDefinition<ShooterState>;

interface BatchEntry {
  readonly game: ShooterGame;
  readonly file: string;
}

const batch: readonly BatchEntry[] = [
  { game: asteroidsGame as ShooterGame, file: 'asteroids' },
  { game: centipedeGame as ShooterGame, file: 'centipede' },
  { game: galagaGame as ShooterGame, file: 'galaga' },
  { game: gradiusGame as ShooterGame, file: 'gradius' },
  { game: raidenGame as ShooterGame, file: 'raiden' },
  { game: spaceInvadersGame as ShooterGame, file: 'space-invaders' },
  { game: tempestGame as ShooterGame, file: 'tempest' },
  { game: missileCommandGame as ShooterGame, file: 'missile-command' },
];

/** Cinta con pulsaciones de `fire` y movimiento; la misma para todas las semillas. */
function tape(tick: number): readonly string[] {
  const frame: string[] = [];
  if (tick % 6 < 3) frame.push('fire');
  if (tick % 11 < 5) frame.push('left');
  if (tick % 17 >= 12) frame.push('right');
  return frame;
}

describe.each(batch)('$file sobre la API del motor', ({ game }) => {
  it('declara solo lógica del juego', () => {
    expect(game.id).toBeTruthy();
    expect(game.actions).toContain('fire');
    expect(game.meta.players.length).toBeGreaterThan(0);
    expect(game.progression).toBeDefined();
    const sim = createGameSimulation(game, { seed: 1 });
    expect(game.rules.fitness(sim.state)).toBeTypeOf('number');
  });

  it('(a) es determinista con la misma semilla y cinta de inputs', () => {
    const options = gameSimulationOptions(game, { seed: 4321 });
    const a = runHeadless({ ...options, ticks: 320, inputsAt: tape });
    const b = runHeadless({ ...options, ticks: 320, inputsAt: tape });
    expect(a.hash).toBe(b.hash);
    expect(a.hash).toMatch(/^\d+:\d+:/);
  });

  it('(b) la dificultad sube con el progreso', () => {
    const config = game.progression;
    expect(config).toBeDefined();
    const levels = config!.levels;
    expect(levels.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < levels.length; i++) {
      const previous = levels[i - 1]!;
      const current = levels[i]!;
      expect(current.speed).toBeGreaterThan(previous.speed);
      expect(current.hazard ?? 0).toBeGreaterThanOrEqual(previous.hazard ?? 0);
      if (current.spawnInterval !== undefined && previous.spawnInterval !== undefined) {
        expect(current.spawnInterval).toBeLessThan(previous.spawnInterval);
      }
    }
    expect(config!.patterns?.length).toBeGreaterThanOrEqual(3);
    expect(config!.patterns?.length).toBeLessThanOrEqual(5);

    const sim = createGameSimulation(game, { seed: 99 });
    const baseSpeed = sim.ctx.progression.state.speed;
    sim.state.progress = config!.pointsPerLevel * (levels.length + 1);
    sim.tick([]);
    expect(sim.ctx.progression.state.speed).toBeGreaterThan(baseSpeed);
  });

  it('(c) observe devuelve un vector finito y normalizado', () => {
    const sim = createGameSimulation(game, { seed: 808 });
    for (let tick = 1; tick <= 40; tick++) sim.tick(tape(tick));
    const observation = game.observe?.(sim.state, 0);
    expect(observation).toBeInstanceOf(Float32Array);
    const values = [...(observation ?? [])];
    expect(values.length).toBeGreaterThan(0);
    expect(values.every(Number.isFinite)).toBe(true);
    expect(values.every((value) => value >= -1.001 && value <= 1.001)).toBe(true);
  });

  it('(d) emite al menos un evento de juice', () => {
    const options = gameSimulationOptions(game, { seed: 5150 });
    const result = runHeadless({ ...options, ticks: 240, inputsAt: tape });
    expect(result.events).toBeGreaterThan(0);
  });

  it('(e) el ciclo de vida pausa y reinicia desde acciones nombradas', () => {
    const sim = createGameSimulation(game, { seed: 606 });
    sim.tick([]);
    sim.tick(['pause']);
    expect(sim.state.paused).toBe(true);
    sim.tick([]);
    sim.tick(['pause']);
    expect(sim.state.paused).toBe(false);
    sim.state.score = 1234;
    sim.tick(['restart']);
    expect(sim.state.score).toBe(0);
    expect(sim.state.over).toBe(false);
  });
});

describe('reglas duras del batch de shooters', () => {
  it('ningún juego usa azar, reloj real, timers propios ni DOM en su lógica', () => {
    const forbidden = /Math\.random|Date\.now|setTimeout|setInterval|requestAnimationFrame|document\.|window\./;
    for (const { file } of batch) {
      const source = readFileSync(
        new URL(`../src/games/${file}/game.ts`, import.meta.url),
        'utf8',
      );
      expect(source).not.toMatch(forbidden);
      expect(source).toMatch(/ctx\.progression\.update|handleLifecycle\(/);
      expect(source).toContain('handleLifecycle(');
      expect(source).toContain('singlePlayerRules');
      expect(source).toContain("get<CollisionService>('collision')");
      expect(source).toContain('nextPattern()');
    }
  });
});
