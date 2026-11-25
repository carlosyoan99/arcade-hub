/** Primitivas de HUD sobre Canvas 2D: texto, barras y esquinas. Sin estado. */

export interface DrawTextOptions {
  readonly font?: string;
  readonly color?: string;
  readonly align?: CanvasTextAlign;
  readonly baseline?: CanvasTextBaseline;
  readonly maxWidth?: number;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: DrawTextOptions = {},
): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  ctx.save();
  if (options.font !== undefined) ctx.font = options.font;
  if (options.color !== undefined) ctx.fillStyle = options.color;
  if (options.align !== undefined) ctx.textAlign = options.align;
  if (options.baseline !== undefined) ctx.textBaseline = options.baseline;
  ctx.fillText(text, x, y, options.maxWidth);
  ctx.restore();
}

export interface DrawBarOptions {
  readonly width: number;
  readonly height: number;
  readonly value: number;
  readonly max?: number;
  readonly fill?: string;
  readonly background?: string;
  readonly outline?: string;
  readonly reverse?: boolean;
}

export function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  options: DrawBarOptions,
): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const width = options.width;
  const height = options.height;
  if (!(width > 0) || !(height > 0)) return;

  const max = options.max ?? 1;
  const raw = Number.isFinite(options.value) ? options.value : 0;
  const ratio = max > 0 ? Math.max(0, Math.min(1, raw / max)) : 0;
  const filledWidth = width * ratio;

  ctx.save();
  ctx.fillStyle = options.background ?? 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = options.fill ?? '#39ff14';
  if (options.reverse === true) {
    ctx.fillRect(x + width - filledWidth, y, filledWidth, height);
  } else {
    ctx.fillRect(x, y, filledWidth, height);
  }
  if (options.outline !== undefined) {
    ctx.strokeStyle = options.outline;
    ctx.strokeRect(x, y, width, height);
  }
  ctx.restore();
}

export interface DrawCornersOptions {
  readonly size?: number;
  readonly color?: string;
  readonly lineWidth?: number;
}

/** Cuatro escuadras neón en las esquinas de un rectángulo. */
export function drawCorners(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DrawCornersOptions = {},
): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (!(width > 0) || !(height > 0)) return;
  const size = Math.max(1, Math.min(options.size ?? 10, width / 2, height / 2));

  ctx.save();
  ctx.strokeStyle = options.color ?? '#39ff14';
  ctx.lineWidth = options.lineWidth ?? 2;
  ctx.beginPath();
  ctx.moveTo(x, y + size);
  ctx.lineTo(x, y);
  ctx.lineTo(x + size, y);
  ctx.moveTo(x + width - size, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + size);
  ctx.moveTo(x + width, y + height - size);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x + width - size, y + height);
  ctx.moveTo(x + size, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + height - size);
  ctx.stroke();
  ctx.restore();
}

export interface DrawPanelOptions extends DrawCornersOptions {
  readonly fill?: string;
}

export function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DrawPanelOptions = {},
): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (!(width > 0) || !(height > 0)) return;
  if (options.fill !== undefined) {
    ctx.save();
    ctx.fillStyle = options.fill;
    ctx.fillRect(x, y, width, height);
    ctx.restore();
  }
  drawCorners(ctx, x, y, width, height, options);
}
