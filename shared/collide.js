/**
 * Shared collision helpers — Arcade Hub
 *
 * Extracted duplicated dist() and overlap() from individual games.
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
