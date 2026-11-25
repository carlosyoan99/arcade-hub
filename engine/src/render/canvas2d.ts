/**
 * Canvas 2D determinista: DPR + letterbox calculados con matemática pura.
 * Nada de reloj real ni Math.random: el resize depende solo de sus entradas.
 */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Letterbox {
  /** Escala en píxeles CSS por unidad lógica. */
  readonly scale: number;
  readonly dpr: number;
  /** Rectángulo del mundo en píxeles CSS. */
  readonly css: Rect;
  /** Rectángulo del mundo en píxeles de dispositivo. */
  readonly device: Rect;
}

/**
 * Cálculo puro del letterbox. Se puede testear sin DOM: dado el viewport y el
 * tamaño lógico, devuelve siempre el mismo resultado.
 */
export function computeLetterbox(
  viewWidth: number,
  viewHeight: number,
  worldWidth: number,
  worldHeight: number,
  dpr: number = 1,
): Letterbox {
  if (!(viewWidth > 0) || !(viewHeight > 0) || !(worldWidth > 0) || !(worldHeight > 0)) {
    throw new RangeError('computeLetterbox: las dimensiones deben ser finitas y > 0');
  }
  if (!Number.isFinite(dpr) || dpr <= 0) {
    throw new RangeError('computeLetterbox: dpr debe ser finito y > 0');
  }

  const scale = Math.min(viewWidth / worldWidth, viewHeight / worldHeight);
  const cssWidth = worldWidth * scale;
  const cssHeight = worldHeight * scale;
  const css: Rect = {
    x: (viewWidth - cssWidth) / 2,
    y: (viewHeight - cssHeight) / 2,
    width: cssWidth,
    height: cssHeight,
  };

  return {
    scale,
    dpr,
    css,
    device: {
      x: css.x * dpr,
      y: css.y * dpr,
      width: cssWidth * dpr,
      height: cssHeight * dpr,
    },
  };
}

function readDevicePixelRatio(): number {
  const value = (globalThis as { devicePixelRatio?: number }).devicePixelRatio;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 1;
}

export interface CanvasRendererOptions {
  readonly width: number;
  readonly height: number;
  readonly background?: string;
  /** DPR inyectable: si se omite se lee devicePixelRatio (nunca un reloj). */
  readonly dpr?: number;
}

export interface CanvasRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly dpr: number;
  readonly viewWidth: number;
  readonly viewHeight: number;
  readonly letterbox: Letterbox;
  /** Recalcula DPR, tamaño del backing store y transformación. Determinista. */
  resize(): Letterbox;
  /** Limpia, pinta el fondo y deja el ctx en coordenadas del mundo. */
  begin(): void;
  /** Restaura la transformación aplicada por begin(). */
  end(): void;
  clear(): void;
  /** Convierte coordenadas relativas al canvas a coordenadas del mundo. */
  toWorld(clientX: number, clientY: number): { x: number; y: number };
}

export function createCanvasRenderer(
  canvas: HTMLCanvasElement,
  options: CanvasRendererOptions,
): CanvasRenderer {
  if (!(options.width > 0) || !(options.height > 0)) {
    throw new RangeError('createCanvasRenderer: width y height deben ser > 0');
  }

  const maybeCtx = canvas.getContext('2d');
  if (!maybeCtx) throw new Error('createCanvasRenderer: no se obtuvo contexto 2D');
  const ctx: CanvasRenderingContext2D = maybeCtx;

  let dpr = options.dpr ?? readDevicePixelRatio();
  if (!Number.isFinite(dpr) || dpr <= 0) {
    throw new RangeError('createCanvasRenderer: dpr debe ser finito y > 0');
  }

  let viewWidth = options.width;
  let viewHeight = options.height;
  let letterbox = computeLetterbox(viewWidth, viewHeight, options.width, options.height, dpr);

  function applyTransform(): void {
    ctx.setTransform(
      letterbox.dpr * letterbox.scale,
      0,
      0,
      letterbox.dpr * letterbox.scale,
      letterbox.device.x,
      letterbox.device.y,
    );
  }

  const renderer: CanvasRenderer = {
    canvas,
    ctx,
    worldWidth: options.width,
    worldHeight: options.height,
    get dpr(): number {
      return dpr;
    },
    get viewWidth(): number {
      return viewWidth;
    },
    get viewHeight(): number {
      return viewHeight;
    },
    get letterbox(): Letterbox {
      return letterbox;
    },
    resize(): Letterbox {
      dpr = options.dpr ?? readDevicePixelRatio();
      if (!Number.isFinite(dpr) || dpr <= 0) dpr = 1;

      const clientWidth = canvas.clientWidth;
      const clientHeight = canvas.clientHeight;
      const hasClientSize =
        typeof clientWidth === 'number' &&
        typeof clientHeight === 'number' &&
        clientWidth > 0 &&
        clientHeight > 0;

      if (hasClientSize) {
        viewWidth = clientWidth;
        viewHeight = clientHeight;
      } else if (canvas.width > 0 && canvas.height > 0) {
        viewWidth = canvas.width / dpr;
        viewHeight = canvas.height / dpr;
      } else {
        viewWidth = options.width;
        viewHeight = options.height;
      }

      const pixelWidth = Math.max(1, Math.round(viewWidth * dpr));
      const pixelHeight = Math.max(1, Math.round(viewHeight * dpr));
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

      letterbox = computeLetterbox(viewWidth, viewHeight, options.width, options.height, dpr);
      applyTransform();
      return letterbox;
    },
    begin(): void {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (options.background !== undefined) {
        ctx.fillStyle = options.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.save();
      applyTransform();
      ctx.beginPath();
      ctx.rect(0, 0, options.width, options.height);
      ctx.clip();
    },
    end(): void {
      ctx.restore();
    },
    clear(): void {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      applyTransform();
    },
    toWorld(clientX: number, clientY: number): { x: number; y: number } {
      return {
        x: (clientX - letterbox.css.x) / letterbox.scale,
        y: (clientY - letterbox.css.y) / letterbox.scale,
      };
    },
  };

  renderer.resize();
  return renderer;
}
