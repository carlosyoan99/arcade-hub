import { describe, expect, it } from 'vitest';
import { createSimulation } from '../src/core/simulation.js';
import { createRNG } from '../src/core/rng.js';
import { levelForProgress, type ProgressionConfig } from '../src/progression/curve.js';
import { createPatternPicker } from '../src/progression/variety.js';
import { createProgression, PROGRESSION_SERVICE, type ProgressionService } from '../src/progression/progression.js';
import { createGameSimulation } from '../src/game/adapter.js';
import { flappyGame } from '../src/games/flappy/game.js';
import { pongGame } from '../src/games/pong/game.js';

const config: ProgressionConfig = {
  id: 'test',
  levels: [{ speed: 1 }, { speed: 1.2 }, { speed: 1.5 }],
  pointsPerLevel: 10,
  maxLevel: 3,
  dda: { enabled: true, window: 4, maxAdjust: 0.1 },
  patterns: ['a', 'b', 'c'],
  avoidRepeat: 2,
};

describe('dificultad y variedad progresivas', () => {
  it('sube de nivel según el progreso y respeta el techo', () => {
    expect(levelForProgress(0, config)).toBe(0);
    expect(levelForProgress(9, config)).toBe(0);
    expect(levelForProgress(10, config)).toBe(1);
    expect(levelForProgress(35, config)).toBe(3);
    expect(levelForProgress(500, config)).toBe(3);
  });

  it('los patrones son sembrados y no se repiten seguidos', () => {
    const a = createPatternPicker(createRNG(7), config.patterns ?? [], 2);
    const b = createPatternPicker(createRNG(7), config.patterns ?? [], 2);
    const first = Array.from({ length: 12 }, () => a.next());
    const second = Array.from({ length: 12 }, () => b.next());
    expect(first).toEqual(second);
    for (let i = 1; i < first.length; i++) {
      expect(first[i]).not.toBe(first[i - 1]);
    }
  });

  it('la adaptación dinámica está acotada y no altera la semilla principal', () => {
    const rng = createRNG(11);
    const before = rng.snapshot();
    const progression = createProgression(config, rng);
    for (let i = 0; i < 20; i++) progression.observe(1);
    expect(progression.state.adjustment).toBeLessThanOrEqual(0.1);
    expect(progression.state.speed).toBeLessThanOrEqual(1 * 1.1 + 1e-9);
    progression.observe(-1);
    expect(progression.state.adjustment).toBeGreaterThanOrEqual(-0.1);
    expect(rng.snapshot()).toBe(before);
  });

  it('el estado de progresión entra en el snapshot de la simulación', () => {
    const simulation = createSimulation({
      seed: 3,
      init: () => ({ value: 0 }),
      step: (state, ctx) => {
        state.value++;
        ctx.progression.update(state.value);
      },
    });
    for (let i = 0; i < 5; i++) simulation.tick([]);
    const snapshot = simulation.snapshot();
    expect(snapshot.progression.ticks).toBe(5);
    simulation.restore(snapshot);
    expect(simulation.services.get<ProgressionService>(PROGRESSION_SERVICE).state.ticks).toBe(5);
  });

  it('Pong acelera la bola al subir de nivel', () => {
    const game = createGameSimulation(pongGame, { seed: 5 });
    game.tick([]);
    game.tick(['serve']);
    const firstSpeed = Math.abs(game.state.ball.vx);
    game.state.score = [4, 0];
    game.state.serving = true;
    game.tick([]);
    game.tick(['serve']);
    expect(game.state.serving).toBe(false);
    expect(Math.abs(game.state.ball.vx)).toBeGreaterThan(firstSpeed);
  });

  it('Flappy reduce el intervalo de tubos al avanzar', () => {
    const game = createGameSimulation(flappyGame, { seed: 5 });
    game.tick([]);
    const early = game.state.nextPipeAt - game.state.ticks;
    game.state.score = 25;
    game.tick([]);
    const later = game.state.nextPipeAt - game.state.ticks;
    expect(later).toBeLessThan(early);
  });
});
