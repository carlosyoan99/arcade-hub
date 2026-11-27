import { describe, expect, it } from 'vitest';
import { GAMES } from '../src/games/index.js';
import { pongGame } from '../src/games/pong/game.js';
import { captureThumbnail, type CanvasFactory, type CanvasLike } from '../src/render/thumbnail.js';

function factory(log: string[]): CanvasFactory {
  return (width: number, height: number): CanvasLike => {
    let data = '';
    const gradient = { addColorStop: (): void => undefined };
    const ctx = new Proxy(
      {
        fillStyle: '',
        font: '',
        createLinearGradient: () => gradient,
        createRadialGradient: () => gradient,
        measureText: () => ({ width: 10 }),
      } as Record<string, unknown>,
      {
        get(target, property: string) {
          if (property in target) return target[property];
          return (...args: unknown[]): void => {
            log.push(`${property}:${width}x${height}:${args.length}`);
          };
        },
        set(target, property: string, value) {
          target[property] = value;
          return true;
        },
      },
    );
    return {
      width,
      height,
      getContext: () => ctx as unknown as CanvasRenderingContext2D,
      toDataURL: () => {
        data += `|png:${width}x${height}`;
        return data;
      },
    };
  };
}

describe('capturas del HUB', () => {
  it('usa el render real del juego y es determinista', () => {
    const first: string[] = [];
    const second: string[] = [];
    const a = captureThumbnail(pongGame as never, { seed: 77, tick: 5, createCanvas: factory(first) });
    const b = captureThumbnail(pongGame as never, { seed: 77, tick: 5, createCanvas: factory(second) });
    expect(first).toEqual(second);
    expect(a).toBe(b);
    expect(first.some((entry) => entry.startsWith('drawImage:'))).toBe(true);
    expect(first.some((entry) => entry.startsWith('fillRect:'))).toBe(true);
  });

  it('los 32 juegos generan una captura no vacía', () => {
    for (const game of GAMES) {
      const log: string[] = [];
      const url = captureThumbnail(game as never, { seed: 12345, tick: 3, createCanvas: factory(log) });
      expect(url.length, `${game.id} sin captura`).toBeGreaterThan(0);
    }
  });

  it('sin DOM exige un factory explícito', () => {
    expect(() => captureThumbnail(pongGame as never, { seed: 1 })).toThrow(/createCanvas/);
  });
});
