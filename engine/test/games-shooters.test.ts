import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createGameSimulation, gameSimulationOptions } from '../src/game/adapter.js';
import type { GameDefinition } from '../src/game/contract.js';
import type { Simulation } from '../src/core/simulation.js';
import { runHeadless } from '../src/tools/headless.js';
import { ASTEROIDS, asteroidsGame } from '../src/games/asteroids/game.js';
import { centipedeGame } from '../src/games/centipede/game.js';
import { galagaGame } from '../src/games/galaga/game.js';
import { gradiusGame } from '../src/games/gradius/game.js';
import { raidenGame } from '../src/games/raiden/game.js';
import { spaceInvadersGame } from '../src/games/space-invaders/game.js';
import { TEMPEST, tempestGame } from '../src/games/tempest/game.js';
import {
  MISSILE_COMMAND,
  missileCommandGame,
  type MissileCommandState,
} from '../src/games/missile-command/game.js';

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

describe('Tempest: temporizadores de oleada (B6)', () => {
  it('con hazard > 0 no salta la oleada en un tick, solo tras el intervalo; respeta pausa y reinicio', () => {
    const sim = createGameSimulation(tempestGame, { seed: 1234 });
    sim.state.progress = tempestGame.progression!.pointsPerLevel * 2;
    sim.tick([]);
    expect(sim.ctx.progression.state.hazard).toBeGreaterThan(0);

    const wave = sim.state.wave;
    const delayTicks = Math.round(TEMPEST.waveDelay / sim.ctx.clock.dt);

    sim.state.enemies = [];
    sim.tick([]);
    expect(sim.state.wave).toBe(wave);

    for (let i = 1; i < delayTicks; i++) sim.tick([]);
    expect(sim.state.wave).toBe(wave);

    sim.tick([]);
    expect(sim.state.wave).toBe(wave + 1);

    // La pausa congela el deadline: avanzar ticks mientras está pausado no la dispara.
    sim.state.enemies = [];
    sim.tick(['pause']);
    expect(sim.state.paused).toBe(true);
    for (let i = 0; i < delayTicks; i++) sim.tick([]);
    expect(sim.state.wave).toBe(wave + 1);
    sim.tick([]);
    sim.tick(['pause']);
    expect(sim.state.paused).toBe(false);

    // El reinicio restaura la oleada y deja `spawnTimer` sin deadline pendiente.
    sim.state.progress = 999;
    sim.tick(['restart']);
    expect(sim.state.wave).toBe(1);
    expect(sim.state.progress).toBe(0);
    expect(sim.state.spawnTimer).toBe(0);
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

describe('Galaga: oscilación de la formación (regresión P0)', () => {
  it('la x de la formación se desplaza respecto a homeX, emite formationShift y vuelve tras el borde', () => {
    const sim = createGameSimulation(galagaGame, { seed: 4242 });
    // Esperamos a que termine la secuencia de entrada (los enemigos llegan
    // volando a la formación) y congelamos los picados para aislar la oscilación.
    for (let tick = 0; tick < 500; tick++) {
      sim.tick([]);
      sim.state.diveTimer = 999;
      if (sim.state.entry === null && sim.state.enemies.some((candidate) => !candidate.entering)) break;
    }
    const enemy = sim.state.enemies.find((candidate) => candidate.alive && !candidate.diving && !candidate.entering);
    expect(enemy).toBeDefined();
    const target = enemy!;
    const homeX = target.homeX;
    const homeY = target.homeY;
    sim.events.clear();

    for (let tick = 0; tick < 40; tick++) sim.tick([]);
    expect(sim.state.formationOffset).not.toBe(0);
    expect(target.x).not.toBe(homeX);
    expect(sim.events.peek().some((event) => event.type === 'formationShift')).toBe(true);

    const direction = sim.state.formationDir;
    sim.state.formationOffset = 235;
    for (let tick = 0; tick < 40; tick++) sim.tick([]);
    expect(sim.state.formationDir).toBe(-direction);
    expect(target.homeY).toBeGreaterThan(homeY);

    sim.state.formationOffset = 8;
    let returnedHome = false;
    for (let tick = 0; tick < 45; tick++) {
      sim.tick([]);
      if (Math.abs(sim.state.formationOffset) < 1) returnedHome = true;
    }
    expect(returnedHome).toBe(true);
  });
});

describe('Gradius: medidor de poder vacío (regresión P0)', () => {
  it('pulsar Espacio sin cápsulas no activa mejoras ni puntúa; con una cápsula sí', () => {
    const sim = createGameSimulation(gradiusGame, { seed: 77 });
    sim.tick([]);
    sim.events.clear();

    sim.tick(['power']);
    expect(sim.state.player.speed).toBe(0);
    expect(sim.state.score).toBe(0);
    expect(sim.events.peek().some((event) => event.type === 'hit' &&
      (event.payload as { kind?: string }).kind === 'power')).toBe(false);

    sim.tick([]); // soltar la pulsación anterior
    sim.state.gauge = 1;
    sim.tick(['power']);
    expect(sim.state.player.missile).toBe(true);
    expect(sim.state.score).toBe(100);
  });
});

describe('Asteroids: platillos voladores (P0 de identidad)', () => {
  it('aparecen por deadline en ticks, emiten spawn y puntúan 1000 (pequeño) y 200 (grande)', () => {
    const sim = createGameSimulation(asteroidsGame, { seed: 2026 });
    sim.tick([]);
    expect(sim.state.saucerAt).toBe(Math.round(ASTEROIDS.saucerFirstDelay / sim.ctx.clock.dt));
    sim.events.clear();

    sim.state.saucerAt = sim.state.ticks + 1;
    sim.tick([]);
    expect(sim.state.saucer).not.toBeNull();
    expect(sim.events.peek().some((event) => event.type === 'spawn' &&
      (event.payload as { kind?: string }).kind === 'saucer')).toBe(true);

    const saucer = sim.state.saucer!;
    saucer.size = 'small';
    saucer.x = 400;
    saucer.y = 200;
    sim.state.bullets = [{ x: 400, y: 200, vx: 0, vy: 0, life: 1, hostile: false }];
    sim.events.clear();
    const smallBefore = sim.state.score;
    sim.tick([]);
    expect(sim.state.score - smallBefore).toBe(1000);
    expect(sim.state.saucer).toBeNull();
    expect(sim.events.peek().some((event) => event.type === 'hit' &&
      (event.payload as { kind?: string }).kind === 'saucer')).toBe(true);

    sim.state.saucerAt = sim.state.ticks + 1;
    sim.tick([]);
    const large = sim.state.saucer!;
    large.size = 'large';
    large.x = 400;
    large.y = 200;
    sim.state.bullets = [{ x: 400, y: 200, vx: 0, vy: 0, life: 1, hostile: false }];
    const largeBefore = sim.state.score;
    sim.tick([]);
    expect(sim.state.score - largeBefore).toBe(200);
  });

  it('la pequeña apunta a la nave y la grande dispara al azar, con ctx.rng determinista', () => {
    function saucerShot(seed: number, size: 'small' | 'large') {
      const sim = createGameSimulation(asteroidsGame, { seed });
      sim.tick([]);
      sim.state.invuln = 999;
      sim.state.ship.x = 200;
      sim.state.ship.y = 100;
      sim.state.bullets = [];
      sim.state.saucer = { x: 400, y: 90, vx: 0, size, fireTimer: 0.001 };
      sim.events.clear();
      sim.tick([]);
      return {
        bullet: sim.state.bullets.find((candidate) => candidate.hostile),
        shoot: sim.events.peek().some((event) => event.type === 'shoot' &&
          (event.payload as { hostile?: boolean }).hostile === true),
      };
    }

    const small = saucerShot(3131, 'small');
    expect(small.bullet).toBeDefined();
    // La nave está a la izquierda: el disparo debe ir hacia ella (vx < 0)
    // y con poca desviación vertical (el spread máximo es 0.5 rad).
    expect(small.bullet!.vx).toBeLessThan(0);
    expect(Math.abs(small.bullet!.vy)).toBeLessThan(Math.abs(small.bullet!.vx));
    expect(small.bullet!.life).toBeGreaterThan(ASTEROIDS.bulletLife);
    expect(small.shoot).toBe(true);

    const large = saucerShot(3131, 'large');
    expect(large.bullet).toBeDefined();
    expect(large.shoot).toBe(true);
    const repeat = saucerShot(3131, 'large');
    expect(repeat.bullet?.vx).toBe(large.bullet?.vx);
    expect(repeat.bullet?.vy).toBe(large.bullet?.vy);
  });
});

describe('Missile Command: ciudades persistentes (regresión P0)', () => {
  function clearWave(sim: Simulation<MissileCommandState>): void {
    sim.state.toSpawn = 0;
    sim.state.incoming = [];
    sim.state.waveActive = true;
    sim.state.waveTimer = MISSILE_COMMAND.waveEndDelay + 0.1;
    sim.state.nextCityBonusAt = 100000;
  }

  it('una ciudad destruida sigue destruida al avanzar de oleada sin ciudad de reserva', () => {
    const sim = createGameSimulation(missileCommandGame, { seed: 8181 });
    sim.tick([]);
    sim.state.cities[0]!.alive = false;
    sim.state.cityReserve = 0;
    clearWave(sim);
    const wave = sim.state.wave;

    sim.tick([]);
    expect(sim.state.wave).toBe(wave + 1);
    expect(sim.state.cities[0]!.alive).toBe(false);
  });

  it('una ciudad de reserva repone una destruida al cambiar de oleada', () => {
    const sim = createGameSimulation(missileCommandGame, { seed: 8182 });
    sim.tick([]);
    sim.state.cities[0]!.alive = false;
    sim.state.cityReserve = 1;
    clearWave(sim);

    sim.tick([]);
    expect(sim.state.cities[0]!.alive).toBe(true);
    expect(sim.state.cityReserve).toBe(0);
    expect(sim.events.peek().some((event) => event.type === 'spawn' &&
      (event.payload as { kind?: string }).kind === 'city')).toBe(true);
  });
});
