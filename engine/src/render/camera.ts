/** Cámara 2D con follow/clamp deterministas y aplicación al contexto. */

import type { Rect } from './canvas2d.js';

export interface CameraOptions {
  /** Ancho lógico de la vista, en unidades del mundo. */
  readonly width: number;
  readonly height: number;
  readonly x?: number;
  readonly y?: number;
  readonly zoom?: number;
  /** Factor de suavizado por tick (0..1). 1 = salto inmediato. */
  readonly lerp?: number;
}

export interface CameraState {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export interface CameraTarget {
  readonly x: number;
  readonly y: number;
}

export interface Camera {
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
  set(x: number, y: number): void;
  follow(target: CameraTarget, factor?: number): void;
  /** Mantiene la vista dentro de bounds (o centrada si el mundo es más pequeño). */
  clamp(bounds: Rect): void;
  apply(ctx: CanvasRenderingContext2D): void;
  /** Rectángulo del mundo actualmente visible. */
  visible(): Rect;
  snapshot(): CameraState;
  restore(state: CameraState): void;
}

export function createCamera(options: CameraOptions): Camera {
  if (!(options.width > 0) || !(options.height > 0)) {
    throw new RangeError('createCamera: width y height deben ser > 0');
  }

  let x = options.x ?? 0;
  let y = options.y ?? 0;
  let zoom = options.zoom ?? 1;
  const lerp = options.lerp ?? 1;
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new RangeError('createCamera: centro inválido');
  if (!Number.isFinite(zoom) || zoom <= 0) throw new RangeError('createCamera: zoom debe ser > 0');
  if (!Number.isFinite(lerp) || lerp < 0 || lerp > 1) {
    throw new RangeError('createCamera: lerp debe estar en [0, 1]');
  }

  return {
    width: options.width,
    height: options.height,
    get x(): number {
      return x;
    },
    get y(): number {
      return y;
    },
    get zoom(): number {
      return zoom;
    },
    set(nextX: number, nextY: number): void {
      if (Number.isFinite(nextX)) x = nextX;
      if (Number.isFinite(nextY)) y = nextY;
    },
    follow(target: CameraTarget, factor: number = lerp): void {
      if (!Number.isFinite(factor)) return;
      const f = Math.max(0, Math.min(1, factor));
      if (Number.isFinite(target.x)) x += (target.x - x) * f;
      if (Number.isFinite(target.y)) y += (target.y - y) * f;
    },
    clamp(bounds: Rect): void {
      if (
        !(bounds.width > 0) ||
        !(bounds.height > 0) ||
        !Number.isFinite(bounds.x) ||
        !Number.isFinite(bounds.y)
      ) {
        return;
      }
      const halfWidth = options.width / (2 * zoom);
      const halfHeight = options.height / (2 * zoom);

      if (bounds.width <= halfWidth * 2) {
        x = bounds.x + bounds.width / 2;
      } else {
        x = Math.max(bounds.x + halfWidth, Math.min(bounds.x + bounds.width - halfWidth, x));
      }

      if (bounds.height <= halfHeight * 2) {
        y = bounds.y + bounds.height / 2;
      } else {
        y = Math.max(bounds.y + halfHeight, Math.min(bounds.y + bounds.height - halfHeight, y));
      }
    },
    apply(ctx: CanvasRenderingContext2D): void {
      ctx.translate(options.width / 2, options.height / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-x, -y);
    },
    visible(): Rect {
      return {
        x: x - options.width / (2 * zoom),
        y: y - options.height / (2 * zoom),
        width: options.width / zoom,
        height: options.height / zoom,
      };
    },
    snapshot(): CameraState {
      return { x, y, zoom };
    },
    restore(state: CameraState): void {
      if (Number.isFinite(state.x)) x = state.x;
      if (Number.isFinite(state.y)) y = state.y;
      if (Number.isFinite(state.zoom) && state.zoom > 0) zoom = state.zoom;
    },
  };
}
