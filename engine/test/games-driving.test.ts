import { describe, expect, it } from 'vitest';
import { createGameSimulation, gameSimulationOptions } from '../src/game/adapter.js';
import { runHeadless } from '../src/tools/headless.js';
import type { GameDefinition } from '../src/game/contract.js';
import type { InputFrame } from '../src/input/virtual.js';
import { defenderGame } from '../src/games/defender/game.js';
import { doubleDragonGame } from '../src/games/double-dragon/game.js';
import { moonPatrolGame } from '../src/games/moon-patrol/game.js';
import { neonNexusGame, NEXUS_CARDS, NEXUS_SHOP } from '../src/games/neon-nexus/game.js';
import { outRunGame } from '../src/games/out-run/game.js';
import { paperboyGame } from '../src/games/paperboy/game.js';
import { polePositionGame } from '../src/games/pole-position/game.js';

type InputsAt = (tick: number) => InputFrame;

/** (a) Misma semilla + misma cinta ⇒ mismo hash. */
function expectDeterministic<S extends object>(
  game: GameDefinition<S>,
  seed: number,
  inputsAt: InputsAt,
  ticks = 400,
): void {
  const options = gameSimulationOptions(game, { seed });
  const a = runHeadless({ ...options, ticks, inputsAt });
  const b = runHeadless({ ...options, ticks, inputsAt });
  expect(a.hash).toBe(b.hash);
}

/** (b) La curva declarada se aplica de verdad cuando sube el progreso. */
function expectDifficultyRises<S extends object>(
  game: GameDefinition<S>,
  seed: number,
  setProgress: (state: S) => void,
): void {
  const sim = createGameSimulation(game, { seed });
  sim.tick([]);
  const before = { ...sim.ctx.progression.state };
  setProgress(sim.state);
  sim.tick([]);
  const after = sim.ctx.progression.state;
  expect(after.level).toBeGreaterThan(before.level);
  expect(after.speed).toBeGreaterThan(before.speed);
  expect(after.hazard).toBeGreaterThan(before.hazard);
  if (before.spawnInterval !== null && after.spawnInterval !== null) {
    expect(after.spawnInterval).toBeLessThan(before.spawnInterval);
  }
}

/** (c) observe() siempre devuelve floats normalizados y finitos. */
function expectObservationFinite<S extends object>(game: GameDefinition<S>, seed: number): void {
  const sim = createGameSimulation(game, { seed });
  for (let i = 0; i < 8; i++) sim.tick([]);
  const observation = game.observe?.(sim.state, 0);
  expect(observation).toBeInstanceOf(Float32Array);
  expect(observation?.length).toBeGreaterThan(0);
  expect([...(observation ?? [])].every((v) => Number.isFinite(v) && v >= -1.01 && v <= 1.01)).toBe(true);
}

/** (d) La lógica emite eventos de juice; render/audio los consumen fuera. */
function expectJuiceEvents<S extends object>(
  game: GameDefinition<S>,
  seed: number,
  inputsAt: InputsAt,
  ticks = 160,
): void {
  const options = gameSimulationOptions(game, { seed });
  const result = runHeadless({ ...options, ticks, inputsAt });
  expect(result.events).toBeGreaterThan(0);
}

describe('Juegos migrados al motor — determinismo, dificultad, observación y juice', () => {
  describe('Defender', () => {
    const inputsAt: InputsAt = (tick) => (tick % 5 === 1 ? ['fire'] : tick === 40 ? ['bomb'] : []);
    it('es determinista', () => expectDeterministic(defenderGame, 101, inputsAt));
    it('sube la dificultad por oleada', () =>
      expectDifficultyRises(defenderGame, 101, (state) => {
        state.waves = 1;
      }));
    it('observa en rango', () => expectObservationFinite(defenderGame, 101));
    it('emite eventos', () => expectJuiceEvents(defenderGame, 101, inputsAt));
  });

  describe('Double Dragon', () => {
    const inputsAt: InputsAt = (tick) => (tick % 7 === 1 ? ['punch'] : tick % 11 === 3 ? ['combo'] : []);
    it('es determinista', () => expectDeterministic(doubleDragonGame, 202, inputsAt));
    it('sube la dificultad por acto', () =>
      expectDifficultyRises(doubleDragonGame, 202, (state) => {
        state.act = 1;
      }));
    it('observa en rango', () => expectObservationFinite(doubleDragonGame, 202));
    it('emite eventos', () => expectJuiceEvents(doubleDragonGame, 202, inputsAt));
  });

  describe('Moon Patrol', () => {
    const inputsAt: InputsAt = (tick) =>
      tick % 5 === 1 ? ['fire'] : tick % 23 === 1 ? ['jump'] : tick % 17 === 2 ? ['fireUp'] : [];
    it('es determinista', () => expectDeterministic(moonPatrolGame, 303, inputsAt));
    it('sube la dificultad por distancia', () =>
      expectDifficultyRises(moonPatrolGame, 303, (state) => {
        state.distance = 500;
      }));
    it('observa en rango', () => expectObservationFinite(moonPatrolGame, 303));
    it('emite eventos', () => expectJuiceEvents(moonPatrolGame, 303, inputsAt));
  });

  describe('Neon Nexus', () => {
    const inputsAt: InputsAt = (tick) => (tick % 10 === 1 ? ['fire'] : []);
    it('es determinista', () => expectDeterministic(neonNexusGame, 404, inputsAt));
    it('sube la dificultad por oleada', () =>
      expectDifficultyRises(neonNexusGame, 404, (state) => {
        state.wave = 1;
      }));
    it('observa en rango', () => expectObservationFinite(neonNexusGame, 404));
    it('emite eventos', () => expectJuiceEvents(neonNexusGame, 404, inputsAt));
  });

  describe('Out Run', () => {
    const inputsAt: InputsAt = (tick) => (tick === 1 ? ['turbo', 'accel'] : ['accel']);
    it('es determinista', () => expectDeterministic(outRunGame, 505, inputsAt));
    it('sube la dificultad por tramo', () =>
      expectDifficultyRises(outRunGame, 505, (state) => {
        state.stage = 1;
      }));
    it('observa en rango', () => expectObservationFinite(outRunGame, 505));
    it('emite eventos', () => expectJuiceEvents(outRunGame, 505, inputsAt));
  });

  describe('Paperboy', () => {
    const inputsAt: InputsAt = (tick) => (tick % 20 === 1 ? ['throw'] : tick % 37 === 5 ? ['right'] : []);
    it('es determinista', () => expectDeterministic(paperboyGame, 606, inputsAt));
    it('sube la dificultad por calle', () =>
      expectDifficultyRises(paperboyGame, 606, (state) => {
        state.day = 1;
      }));
    it('observa en rango', () => expectObservationFinite(paperboyGame, 606));
    it('emite eventos', () => expectJuiceEvents(paperboyGame, 606, inputsAt));
  });

  describe('Pole Position', () => {
    const inputsAt: InputsAt = (tick) => (tick === 1 ? ['turbo', 'accel'] : ['accel']);
    it('es determinista', () => expectDeterministic(polePositionGame, 707, inputsAt));
    it('sube la dificultad por circuito', () =>
      expectDifficultyRises(polePositionGame, 707, (state) => {
        state.circuit = 1;
      }));
    it('observa en rango', () => expectObservationFinite(polePositionGame, 707));
    it('emite eventos', () => expectJuiceEvents(polePositionGame, 707, inputsAt));
  });
});

describe('Regresiones documentadas y mecánicas completas', () => {
  it('B2 — Out Run: turbo y pausa son acciones independientes', () => {
    const sim = createGameSimulation(outRunGame, { seed: 11 });
    sim.tick(['pause']);
    expect(sim.state.paused).toBe(true);
    expect(sim.state.turbo).toBe(0);
    sim.tick([]);
    expect(sim.state.turbo).toBe(0);
    sim.tick(['pause']);
    expect(sim.state.paused).toBe(false);
    sim.tick(['turbo']);
    expect(sim.state.turbo).toBeGreaterThan(0);
  });

  it('B5 — Double Dragon: el D-pad mantenido mueve de forma continua', () => {
    const sim = createGameSimulation(doubleDragonGame, { seed: 12 });
    const startX = sim.state.player.x;
    for (let i = 0; i < 10; i++) sim.tick(['right']);
    expect(sim.state.player.x).toBeGreaterThan(startX + 5);
  });

  it('B6 — Defender: los timers no spawnean en pausa ni tras reiniciar', () => {
    const sim = createGameSimulation(defenderGame, { seed: 13 });
    sim.tick(['pause']);
    for (let i = 0; i < 200; i++) sim.tick([]);
    expect(sim.state.enemies.length).toBe(0);
    expect(sim.state.pendingSpawns).toBe(0);
    sim.tick(['restart']);
    expect(sim.state.generation).toBe(2);
    for (let i = 0; i < 50; i++) sim.tick([]);
    expect(sim.state.enemies.length).toBe(0);
    expect(sim.state.pendingSpawns).toBe(0);
  });

  it('B6 — Double Dragon: el acto no avanza durante la pausa', () => {
    const sim = createGameSimulation(doubleDragonGame, { seed: 14 });
    sim.tick([]);
    sim.state.enemies = [];
    sim.state.phase = 'grunts';
    sim.state.waiting = false;
    sim.tick(['pause']);
    for (let i = 0; i < 100; i++) sim.tick([]);
    expect(sim.state.enemies.length).toBe(0);
    sim.tick(['pause']);
    for (let i = 0; i < 100; i++) sim.tick([]);
    expect(sim.state.enemies.some((enemy) => enemy.type === 'boss')).toBe(true);
  });

  it('Neon Nexus conserva las 17 cartas, la tienda de 4 objetos y las oleadas', () => {
    expect(NEXUS_CARDS).toHaveLength(17);
    expect(NEXUS_SHOP).toHaveLength(4);
    const sim = createGameSimulation(neonNexusGame, { seed: 15 });
    for (let i = 0; i < 600; i++) sim.tick(i % 10 === 1 ? ['fire'] : []);
    expect(sim.state.wave).toBeGreaterThan(0);
    expect(sim.state.kills + sim.state.stars).toBeGreaterThan(0);
  });
});
