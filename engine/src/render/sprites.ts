/** Dibujo de sprites con transformaciones. Solo lee; nunca toca estado de juego. */

export interface Sprite {
  readonly image: CanvasImageSource;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly anchorX: number;
  readonly anchorY: number;
}

export interface SpriteOptions {
  readonly anchorX?: number;
  readonly anchorY?: number;
}

export interface SpriteDrawOptions {
  readonly x: number;
  readonly y: number;
  readonly rotation?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
  readonly alpha?: number;
  readonly flipX?: boolean;
  readonly flipY?: boolean;
  /** Índice de frame en un atlas. */
  readonly frame?: number;
  readonly columns?: number;
  /** Origen alternativo en el atlas (en píxeles de imagen). */
  readonly sourceX?: number;
  readonly sourceY?: number;
}

export function createSprite(
  image: CanvasImageSource,
  frameWidth: number,
  frameHeight: number,
  options: SpriteOptions = {},
): Sprite {
  if (!(frameWidth > 0) || !(frameHeight > 0)) {
    throw new RangeError('createSprite: frameWidth y frameHeight deben ser > 0');
  }
  return {
    image,
    frameWidth,
    frameHeight,
    anchorX: options.anchorX ?? 0.5,
    anchorY: options.anchorY ?? 0.5,
  };
}

/** Origen de un frame de atlas, calculado sin reloj ni azar. */
export function frameOrigin(
  index: number,
  columns: number,
  frameWidth: number,
  frameHeight: number,
): { x: number; y: number } {
  if (!Number.isInteger(columns) || columns <= 0) return { x: 0, y: 0 };
  const safeIndex = Number.isFinite(index) && index > 0 ? Math.floor(index) : 0;
  return {
    x: (safeIndex % columns) * frameWidth,
    y: Math.floor(safeIndex / columns) * frameHeight,
  };
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  draw: SpriteDrawOptions,
): void {
  if (!Number.isFinite(draw.x) || !Number.isFinite(draw.y)) return;
  const alpha = draw.alpha ?? 1;
  if (!(alpha > 0)) return;

  const columns = draw.columns ?? 1;
  const origin =
    draw.sourceX !== undefined && draw.sourceY !== undefined
      ? { x: draw.sourceX, y: draw.sourceY }
      : frameOrigin(draw.frame ?? 0, columns, sprite.frameWidth, sprite.frameHeight);
  const scaleX = draw.scaleX ?? 1;
  const scaleY = draw.scaleY ?? 1;
  const anchorX = Math.max(0, Math.min(1, sprite.anchorX));
  const anchorY = Math.max(0, Math.min(1, sprite.anchorY));
  const dx = -sprite.frameWidth * anchorX;
  const dy = -sprite.frameHeight * anchorY;

  ctx.save();
  ctx.globalAlpha = ctx.globalAlpha * Math.max(0, Math.min(1, alpha));
  ctx.translate(draw.x, draw.y);
  if (draw.rotation !== undefined && Number.isFinite(draw.rotation)) ctx.rotate(draw.rotation);
  ctx.scale(
    draw.flipX === true ? -scaleX : scaleX,
    draw.flipY === true ? -scaleY : scaleY,
  );
  ctx.drawImage(
    sprite.image,
    origin.x,
    origin.y,
    sprite.frameWidth,
    sprite.frameHeight,
    dx,
    dy,
    sprite.frameWidth,
    sprite.frameHeight,
  );
  ctx.restore();
}
