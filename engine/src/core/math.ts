/** Utilidades numéricas compartidas. Sin estado, sin azar, deterministas. */

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return current;
}

export function normalize2(x: number, y: number): { x: number; y: number } {
  const length = Math.sqrt(x * x + y * y);
  return length === 0 ? { x: 0, y: 0 } : { x: x / length, y: y / length };
}
