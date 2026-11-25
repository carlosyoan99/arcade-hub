import { describe, expect, it } from 'vitest';
import { createGameSimulation } from '../src/game/adapter.js';
import { GAMES } from '../src/games/index.js';

/** Contexto 2D stub: cualquier método es un no-op; los gradientes devuelven addColorStop. */
function stubContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const noop = (): void => undefined;
  const target: Record<string, unknown> = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => null,
    measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  };
  return new Proxy(target, {
    get(obj, property: string) {
      if (property in obj) return obj[property];
      return noop;
    },
    set(obj, property: string, value) {
      obj[property] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

describe('render de todo el catálogo', () => {
  it('los 32 juegos dibujan sin mutar el estado', () => {
    expect(GAMES).toHaveLength(32);
    const context = stubContext();

    for (const game of GAMES) {
      const simulation = createGameSimulation(game as never, { seed: 321 });
      for (let i = 0; i < 10; i++) simulation.tick([]);
      expect(typeof game.render, `${game.id} sin render`).toBe('function');
      const before = JSON.stringify(simulation.state);
      game.render?.(context, simulation.state, 0.5);
      expect(JSON.stringify(simulation.state), `${game.id} mutó el estado al dibujar`).toBe(before);
      // Un renderer ausente debe ser inerte, no lanzar.
      expect(() => game.render?.(null, simulation.state, 0)).not.toThrow();
    }
  });
});
