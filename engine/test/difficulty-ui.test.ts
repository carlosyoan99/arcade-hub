import { describe, expect, it } from 'vitest';
import {
  createDifficultySimulation,
  difficultyProgressionConfig,
  DIFFICULTY_PROFILES,
  type Difficulty,
} from '../src/ai/difficulty.js';
import { flappyGame } from '../src/games/flappy/game.js';
import { missileCommandGame } from '../src/games/missile-command/game.js';
import { PROGRESSION_SERVICE } from '../src/progression/progression.js';

const LEVELS: readonly Difficulty[] = ['easy', 'normal', 'hard'];
const SEED = 4242;

describe('perfiles de dificultad aplicados a un juego real', () => {
  it('deriva curvas puras y distintas sin mutar la definición del juego', () => {
    const base = flappyGame.progression;
    expect(base).toBeDefined();
    if (base === undefined) return;
    const before = JSON.stringify(base);
    const easy = difficultyProgressionConfig(base, 'easy');
    const normal = difficultyProgressionConfig(base, 'normal');
    const hard = difficultyProgressionConfig(base, 'hard');

    expect(JSON.stringify(base)).toBe(before);
    expect(easy).toEqual(difficultyProgressionConfig(base, 'easy'));
    expect(hard).not.toEqual(normal);
    expect(easy.levels[2]!.speed).toBeLessThan(normal.levels[2]!.speed);
    expect(normal.levels[2]!.speed).toBeLessThan(hard.levels[2]!.speed);
    expect(easy.levels[2]!.hazard).toBeLessThan(normal.levels[2]!.hazard!);
    expect(normal.levels[2]!.hazard).toBeLessThan(hard.levels[2]!.hazard!);
    expect(easy.levels[2]!.spawnInterval).toBeGreaterThan(normal.levels[2]!.spawnInterval!);
    expect(hard.levels[2]!.spawnInterval).toBeLessThan(normal.levels[2]!.spawnInterval!);
  });

  it('instala el servicio de progresión del perfil en la simulación', () => {
    for (const difficulty of LEVELS) {
      const sim = createDifficultySimulation(flappyGame, { seed: SEED, difficulty });
      expect(sim.services.has(PROGRESSION_SERVICE)).toBe(true);
      expect(sim.plugins.plugins.some((plugin) => plugin.id === `difficulty:flappy:${difficulty}`)).toBe(
        true,
      );
      expect(DIFFICULTY_PROFILES[difficulty].speedScale).toBeTypeOf('number');
    }
  });

  it('produce velocidades y hazard distintos y reproducibles en Flappy', () => {
    const sample = (difficulty: Difficulty) => {
      const sim = createDifficultySimulation(flappyGame, { seed: SEED, difficulty });
      // 10 puntos = nivel 2 (pointsPerLevel = 5), con hazard declarado.
      sim.ctx.progression.update(10);
      const { speed, hazard, level } = sim.ctx.progression.state;
      return { speed, hazard, level };
    };

    const [easy, normal, hard] = LEVELS.map(sample);
    expect(easy!.level).toBe(normal!.level);
    expect(normal!.level).toBe(hard!.level);
    expect(easy!.speed).toBeLessThan(normal!.speed);
    expect(normal!.speed).toBeLessThan(hard!.speed);
    expect(easy!.hazard).toBeLessThan(normal!.hazard);
    expect(normal!.hazard).toBeLessThan(hard!.hazard);

    for (const difficulty of LEVELS) {
      expect(sample(difficulty)).toEqual(sample(difficulty));
    }
  });

  it('conserva el determinismo con la misma semilla y cinta de inputs', () => {
    const run = (difficulty: Difficulty) => {
      const sim = createDifficultySimulation(flappyGame, { seed: SEED, difficulty });
      for (let tick = 0; tick < 120; tick++) {
        sim.tick(tick % 6 === 0 ? ['flap'] : []);
      }
      return { hash: sim.hash(), progression: sim.ctx.progression.state };
    };

    for (const difficulty of LEVELS) {
      expect(run(difficulty)).toEqual(run(difficulty));
    }
    const hashes = LEVELS.map((difficulty) => run(difficulty).hash);
    expect(new Set(hashes).size).toBe(LEVELS.length);
  });
});

describe('Missile Command con puntero virtual', () => {
  const make = () => createDifficultySimulation(missileCommandGame, { seed: 11, difficulty: 'normal' });

  it('el puntero activo cambia el objetivo respecto al teclado', () => {
    const keyboard = make();
    for (let tick = 0; tick < 10; tick++) keyboard.tick(['aimLeft', 'aimUp']);
    keyboard.tick(['fire']);

    const pointer = make();
    pointer.actions.setPointer(0.8, 0.25, true);
    for (let tick = 0; tick < 10; tick++) pointer.tick([]);
    pointer.tick(['fire']);

    expect(pointer.state.cursor.x).toBe(0.8 * 800);
    expect(pointer.state.cursor.y).toBe(0.25 * 600);
    expect(pointer.state.cursor.x).toBeGreaterThan(keyboard.state.cursor.x);
    expect(pointer.state.cursor.y).toBeLessThan(keyboard.state.cursor.y);
    expect(pointer.state.abms[0]?.targetX).toBe(pointer.state.cursor.x);
    expect(pointer.state.abms[0]?.targetX).not.toBe(keyboard.state.abms[0]?.targetX);
  });

  it('sin puntero activo conserva la mirilla de teclado y es determinista', () => {
    const run = () => {
      const sim = make();
      sim.actions.setPointer(0.9, 0.9, false);
      for (let tick = 0; tick < 10; tick++) sim.tick(['aimLeft', 'aimDown']);
      return { cursor: { ...sim.state.cursor }, hash: sim.hash() };
    };

    const first = run();
    expect(first).toEqual(run());
    expect(first.cursor.x).toBeLessThan(400);
    expect(first.cursor.y).toBeGreaterThan(300);
  });
});
