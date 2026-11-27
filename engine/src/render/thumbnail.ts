import { createSimulation } from '../core/simulation.js';
import { gameSimulationOptions } from '../game/adapter.js';
import type { GameDefinition } from '../game/contract.js';

export interface CanvasLike {
  width: number;
  height: number;
  getContext(kind: '2d'): CanvasRenderingContext2D | null;
  toDataURL(type?: string): string;
}

export type CanvasFactory = (width: number, height: number) => CanvasLike;

export interface ThumbnailOptions {
  readonly seed?: number;
  readonly tick?: number;
  readonly width?: number;
  readonly height?: number;
  readonly createCanvas?: CanvasFactory;
}

/** Lienzo usado para dibujar el juego antes de escalarlo a la miniatura. */
const SOURCE_WIDTH = 1024;
const SOURCE_HEIGHT = 700;

function browserCanvas(width: number, height: number): CanvasLike {
  if (typeof document === 'undefined') {
    throw new Error('captureThumbnail: sin DOM; pasa createCanvas en el entorno de pruebas');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Genera una captura real del juego migrado ejecutando su mismo `step()` y
 * `render()` con una semilla fija. Misma semilla y tick ⇒ misma imagen.
 */
export function captureThumbnail(
  game: GameDefinition<object>,
  options: ThumbnailOptions = {},
): string {
  const seed = options.seed ?? 12345;
  const ticks = options.tick ?? 12;
  const width = options.width ?? 320;
  const height = options.height ?? 200;
  const factory = options.createCanvas ?? browserCanvas;

  const simulation = createSimulation(gameSimulationOptions(game as never, { seed }));
  for (let i = 0; i < ticks; i++) simulation.tick([]);

  const source = factory(SOURCE_WIDTH, SOURCE_HEIGHT);
  const sourceCtx = source.getContext('2d');
  if (!sourceCtx) throw new Error('captureThumbnail: no se obtuvo contexto 2D');
  sourceCtx.fillStyle = '#0a0f14';
  sourceCtx.fillRect(0, 0, SOURCE_WIDTH, SOURCE_HEIGHT);
  game.render?.(sourceCtx, simulation.state, 0);

  const target = factory(width, height);
  const targetCtx = target.getContext('2d');
  if (!targetCtx) throw new Error('captureThumbnail: no se obtuvo contexto 2D de la miniatura');
  targetCtx.drawImage(source as unknown as CanvasImageSource, 0, 0, width, height);
  return target.toDataURL('image/png');
}
