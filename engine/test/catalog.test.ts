import { describe, expect, it } from 'vitest';
import { GAMES, GAME_IDS, findGame } from '../src/games/index.js';
import { gameSimulationOptions } from '../src/game/adapter.js';
import { runHeadless } from '../src/tools/headless.js';

describe('catálogo completo del motor', () => {
  it('tiene los 32 juegos con ids únicos', () => {
    expect(GAMES).toHaveLength(32);
    expect(new Set(GAME_IDS).size).toBe(32);
    expect(findGame('pong')?.id).toBe('pong');
    expect(findGame('no-existe')).toBeUndefined();
  });

  it('cada juego declara progresión creciente y patrones', () => {
    for (const game of GAMES) {
      expect(game.meta.title, `${game.id} sin título`).toBeTruthy();
      expect(game.actions.length, `${game.id} sin acciones`).toBeGreaterThan(0);
      const progression = game.progression;
      expect(progression, `${game.id} sin progresión`).toBeDefined();
      const levels = progression?.levels ?? [];
      expect(levels.length, `${game.id} con menos de 3 niveles`).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i]?.speed ?? 0, `${game.id} no acelera en el nivel ${i}`).toBeGreaterThan(
          levels[i - 1]?.speed ?? 0,
        );
      }
      expect(progression?.patterns?.length ?? 0, `${game.id} sin patrones`).toBeGreaterThanOrEqual(3);
      expect(game.rules.fitness, `${game.id} sin fitness`).toBeTypeOf('function');
    }
  });

  it('cada juego es determinista con la misma semilla', () => {
    for (const game of GAMES) {
      const options = gameSimulationOptions(game as never, { seed: 4242 });
      const inputsAt = (tick: number) => (tick % 13 === 0 ? ['primary'] : []);
      const a = runHeadless({ ...options, ticks: 120, inputsAt });
      const b = runHeadless({ ...options, ticks: 120, inputsAt });
      expect(a.hash, `${game.id} no es determinista`).toBe(b.hash);
    }
  });

  it('cada juego expone observe y reglas completas', () => {
    for (const game of GAMES) {
      expect(typeof game.observe, `${game.id} sin observe`).toBe('function');
      expect(typeof game.rules.isOver, `${game.id} sin isOver`).toBe('function');
      expect(typeof game.rules.winner, `${game.id} sin winner`).toBe('function');
      expect(typeof game.rules.score, `${game.id} sin score`).toBe('function');
    }
  });
});
