/**
 * Shared math & collision helpers — Arcade Hub
 *
 * Extracted duplicated helpers from individual games.
 * Used by: cell-swarm, double-dragon, gradius, raiden, galaga, etc.
 */

/**
 * Euclidean distance between two points with x,y properties.
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @returns {number}
 */
export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * AABB overlap test between two circles (fast abs-based, no sqrt).
 * @param {{x: number, y: number}} a - Center of circle A
 * @param {number} ar - Radius of circle A
 * @param {{x: number, y: number}} b - Center of circle B
 * @param {number} br - Radius of circle B
 * @returns {boolean}
 */
export function overlap(a, ar, b, br) {
  return Math.abs(a.x - b.x) < ar + br && Math.abs(a.y - b.y) < ar + br;
}

/**
 * Random float between a and b (inclusive).
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function rnd(a, b) {
  return a + Math.random() * (b - a);
}

/**
 * Clamp a value between min and max.
 * @param {number} v
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Wrap a value into the range [min, max) using toroidal wrapping.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function wrap(val, min, max) {
  const range = max - min;
  return ((((val - min) % range) + range) % range) + min;
}
