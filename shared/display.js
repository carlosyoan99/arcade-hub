/**
 * Canvas display helper — Arcade Hub
 *
 * Configures a responsive canvas with DPR-aware sizing and letterbox centering.
 * Replaces duplicated resizeCanvas()/resize() functions across all games.
 */

/**
 * Set up a canvas with automatic resize and letterbox centering.
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} gameW — Logical game width in pixels
 * @param {number} gameH — Logical game height in pixels
 * @param {number} [padding=20] — Minimum edge padding in pixels
 * @returns {{
 *   w: number,
 *   h: number,
 *   s: number,
 *   x: number,
 *   y: number,
 *   destroy: () => void,
 * }}
 *   w, h: current window dimensions (canvas logical size)
 *   s: scale factor (game → pixel)
 *   x, y: letterbox offset in pixels
 *   destroy: removes the resize listener (call in cleanup)
 */
export function setupCanvas(canvas, ctx, gameW, gameH, padding = 20) {
  let _w = 0,
    _h = 0,
    _s = 1,
    _x = 0,
    _y = 0;

  let resizeTimer = null;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    _w = window.innerWidth;
    _h = window.innerHeight;
    // Set canvas backing store size in device pixels
    canvas.width = _w * dpr;
    canvas.height = _h * dpr;
    // Ensure CSS size matches layout (avoid visual scaling mismatches)
    try {
      canvas.style.width = _w + 'px';
      canvas.style.height = _h + 'px';
    } catch (e) {
      // ignore if style cannot be set (e.g., SVG canvas wrappers)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sx = (_w - padding * 2) / gameW;
    const sy = (_h - padding * 2) / gameH;
    _s = Math.min(sx, sy);
    _x = (_w - gameW * _s) / 2;
    _y = (_h - gameH * _s) / 2;
  }

  function debouncedResize() {
    if (resizeTimer) cancelAnimationFrame(resizeTimer);
    resizeTimer = requestAnimationFrame(resize);
  }

  window.addEventListener('resize', debouncedResize);
  resize();

  return {
    get w() {
      return _w;
    },
    get h() {
      return _h;
    },
    get s() {
      return _s;
    },
    get x() {
      return _x;
    },
    get y() {
      return _y;
    },
    destroy() {
      if (resizeTimer) cancelAnimationFrame(resizeTimer);
      window.removeEventListener('resize', debouncedResize);
    },
  };
}
