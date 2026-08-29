/**
 * shared/icons.js — SVG icon sprites for Arcade Hub
 *
 * Neon-style inline SVG icons replacing emoji across the project.
 * Zero dependencies. Each icon is a 24×24 viewBox with currentColor fill.
 *
 * Usage:
 *   import { icons } from '../../shared/icons.js';
 *   el.innerHTML = icons.music;          // raw SVG string
 *   el.appendChild(icons.musicNode());   // SVG DOM element
 */

const S = 24; // viewBox size

/**
 * Creates an SVG element from inner markup.
 * @param {string} inner - SVG inner HTML (paths, circles, etc.)
 * @returns {string} Complete SVG string
 */
function svg(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 ${S} ${S}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

/**
 * Creates an SVG DOM element from inner markup.
 * @param {string} inner - SVG inner HTML
 * @returns {SVGElement}
 */
function svgNode(inner) {
  const t = document.createElement('template');
  t.innerHTML = svg(inner);
  return t.content.firstChild;
}

export const icons = {
  // ── GameBar buttons ──

  /** Fullscreen (expand arrows) */
  fullscreen: svg(
    '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
  ),
  fullscreenNode: () =>
    svgNode(
      '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
    ),

  /** Music note (eighth note) */
  music: svg(
    '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3" fill="currentColor" stroke="none"/><circle cx="18" cy="16" r="3" fill="currentColor" stroke="none"/>',
  ),
  musicNode: () =>
    svgNode(
      '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3" fill="currentColor" stroke="none"/><circle cx="18" cy="16" r="3" fill="currentColor" stroke="none"/>',
    ),

  /** Muted (music note with slash) */
  muted: svg(
    '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3" fill="currentColor" stroke="none"/><circle cx="18" cy="16" r="3" fill="currentColor" stroke="none"/><line x1="2" y1="2" x2="22" y2="22" stroke-width="2.5"/>',
  ),
  mutedNode: () =>
    svgNode(
      '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3" fill="currentColor" stroke="none"/><circle cx="18" cy="16" r="3" fill="currentColor" stroke="none"/><line x1="2" y1="2" x2="22" y2="22" stroke-width="2.5"/>',
    ),

  /** Settings (gear) */
  settings: svg(
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  ),
  settingsNode: () =>
    svgNode(
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    ),

  /** Help (question mark in circle) */
  help: svg(
    '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  ),
  helpNode: () =>
    svgNode(
      '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    ),

  // ── Hub UI ──

  /** Trophy (for achievements, most-played) */
  trophy: svg(
    '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  ),
  trophyNode: () =>
    svgNode(
      '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    ),

  /** Crown (for most-played leader) */
  crown: svg(
    '<path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" fill="currentColor" stroke="none"/><path d="M3 20h18" stroke-width="2"/>',
  ),
  crownNode: () =>
    svgNode(
      '<path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" fill="currentColor" stroke="none"/><path d="M3 20h18" stroke-width="2"/>',
    ),

  /** Stats / chart */
  chart: svg(
    '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  ),
  chartNode: () =>
    svgNode(
      '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    ),

  /** Dice (random/surprise) */
  dice: svg(
    '<rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none"/>',
  ),
  diceNode: () =>
    svgNode(
      '<rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none"/>',
    ),

  /** Play count (gamepad) */
  gamepad: svg(
    '<line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>',
  ),
  gamepadNode: () =>
    svgNode(
      '<line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>',
    ),

  /** Star (for new badge, ratings) */
  star: svg(
    '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" stroke="none"/>',
  ),
  starNode: () =>
    svgNode(
      '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" stroke="none"/>',
    ),

  /** Lightning bolt (for turbo, power) */
  bolt: svg(
    '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" stroke="none"/>',
  ),
  boltNode: () =>
    svgNode(
      '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" stroke="none"/>',
    ),

  /** Diamond / gem (for Columns, Breakout) */
  gem: svg(
    '<path d="M6 3h12l4 6-10 13L2 9z" fill="currentColor" stroke="none"/><path d="M2 9h20" stroke-width="1.5"/><path d="M12 22L6 9l6-6 6 6-6 13z"/>',
  ),
  gemNode: () =>
    svgNode(
      '<path d="M6 3h12l4 6-10 13L2 9z" fill="currentColor" stroke="none"/><path d="M2 9h20" stroke-width="1.5"/><path d="M12 22L6 9l6-6 6 6-6 13z"/>',
    ),

  /** Skull (for death, game over) */
  skull: svg(
    '<circle cx="12" cy="10" r="8" fill="currentColor" stroke="none"/><circle cx="9" cy="9" r="1.5" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="15" cy="9" r="1.5" fill="var(--bg-mid, #0c0922)" stroke="none"/><path d="M9 17h6" stroke-width="2"/><line x1="10" y1="19" x2="10" y2="21"/><line x1="14" y1="19" x2="14" y2="21"/>',
  ),
  skullNode: () =>
    svgNode(
      '<circle cx="12" cy="10" r="8" fill="currentColor" stroke="none"/><circle cx="9" cy="9" r="1.5" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="15" cy="9" r="1.5" fill="var(--bg-mid, #0c0922)" stroke="none"/><path d="M9 17h6" stroke-width="2"/><line x1="10" y1="19" x2="10" y2="21"/><line x1="14" y1="19" x2="14" y2="21"/>',
    ),

  /** Heart (for lives) */
  heart: svg(
    '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="currentColor" stroke="none"/>',
  ),
  heartNode: () =>
    svgNode(
      '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="currentColor" stroke="none"/>',
    ),

  /** Rocket (for space games) */
  rocket: svg(
    '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  ),
  rocketNode: () =>
    svgNode(
      '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    ),

  /** Bug / alien (for Space Invaders) */
  bug: svg(
    '<rect x="8" y="6" width="8" height="14" rx="4" fill="currentColor" stroke="none"/><circle cx="10" cy="11" r="1" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="14" cy="11" r="1" fill="var(--bg-mid, #0c0922)" stroke="none"/><path d="M6 6l-3-3"/><path d="M18 6l3-3"/><path d="M6 13l-3 2"/><path d="M18 13l3 2"/><path d="M6 17l-3 1"/><path d="M18 17l3 1"/>',
  ),
  bugNode: () =>
    svgNode(
      '<rect x="8" y="6" width="8" height="14" rx="4" fill="currentColor" stroke="none"/><circle cx="10" cy="11" r="1" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="14" cy="11" r="1" fill="var(--bg-mid, #0c0922)" stroke="none"/><path d="M6 6l-3-3"/><path d="M18 6l3-3"/><path d="M6 13l-3 2"/><path d="M18 13l3 2"/><path d="M6 17l-3 1"/><path d="M18 17l3 1"/>',
    ),

  /** Bomb (for Bomberman) */
  bomb: svg(
    '<circle cx="12" cy="14" r="7" fill="currentColor" stroke="none"/><circle cx="10" cy="12" r="2" fill="var(--bg-mid, #0c0922)" stroke="none"/><path d="M16 4l2-2" stroke-width="2.5"/><circle cx="18" cy="2" r="1" fill="currentColor" stroke="none"/>',
  ),
  bombNode: () =>
    svgNode(
      '<circle cx="12" cy="14" r="7" fill="currentColor" stroke="none"/><circle cx="10" cy="12" r="2" fill="var(--bg-mid, #0c0922)" stroke="none"/><path d="M16 4l2-2" stroke-width="2.5"/><circle cx="18" cy="2" r="1" fill="currentColor" stroke="none"/>',
    ),

  /** Pawn / player (for Pong, general) */
  pawn: svg(
    '<circle cx="12" cy="6" r="4" fill="currentColor" stroke="none"/><path d="M8 22V18a4 4 0 0 1 8 0v4" fill="currentColor" stroke="none"/>',
  ),
  pawnNode: () =>
    svgNode(
      '<circle cx="12" cy="6" r="4" fill="currentColor" stroke="none"/><path d="M8 22V18a4 4 0 0 1 8 0v4" fill="currentColor" stroke="none"/>',
    ),

  /** Chevron left (for back) */
  chevronLeft: svg('<polyline points="15 18 9 12 15 6"/>'),
  chevronLeftNode: () => svgNode('<polyline points="15 18 9 12 15 6"/>'),

  /** Dinosaur (for Dino Runner) */
  dino: svg(
    '<path d="M8 4h2v2H8zM6 6h2v4H6zM8 10h8v2H8zM16 6h2v4h-2zM18 4h2v2h-2z" fill="currentColor" stroke="none"/><path d="M6 14h2v6H6zM14 12h2v8h-2z" fill="currentColor" stroke="none"/>',
  ),
  dinoNode: () =>
    svgNode(
      '<path d="M8 4h2v2H8zM6 6h2v4H6zM8 10h8v2H8zM16 6h2v4h-2zM18 4h2v2h-2z" fill="currentColor" stroke="none"/><path d="M6 14h2v6H6zM14 12h2v8h-2z" fill="currentColor" stroke="none"/>',
    ),

  /** Frog (for Frogger) */
  frog: svg(
    '<ellipse cx="12" cy="14" rx="8" ry="6" fill="currentColor" stroke="none"/><circle cx="8" cy="9" r="3" fill="currentColor" stroke="none"/><circle cx="16" cy="9" r="3" fill="currentColor" stroke="none"/><circle cx="8" cy="9" r="1.2" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="16" cy="9" r="1.2" fill="var(--bg-mid, #0c0922)" stroke="none"/>',
  ),
  frogNode: () =>
    svgNode(
      '<ellipse cx="12" cy="14" rx="8" ry="6" fill="currentColor" stroke="none"/><circle cx="8" cy="9" r="3" fill="currentColor" stroke="none"/><circle cx="16" cy="9" r="3" fill="currentColor" stroke="none"/><circle cx="8" cy="9" r="1.2" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="16" cy="9" r="1.2" fill="var(--bg-mid, #0c0922)" stroke="none"/>',
    ),

  /** Snake */
  snake: svg(
    '<path d="M4 12c0-4 4-8 8-8s8 4 8 8-4 4-8 4-4-4-4-4z" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.5" fill="var(--bg-mid, #0c0922)" stroke="none"/>',
  ),
  snakeNode: () =>
    svgNode(
      '<path d="M4 12c0-4 4-8 8-8s8 4 8 8-4 4-8 4-4-4-4-4z" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.5" fill="var(--bg-mid, #0c0922)" stroke="none"/>',
    ),

  /** Cloud / flappy (for Flappy Bird) */
  bird: svg(
    '<path d="M18 10a4 4 0 0 0-8 0c0 3-2 5-5 6 4 2 7 1 9 0 1 2 4 2 6 0-1-2-2-4-2-6z" fill="currentColor" stroke="none"/>',
  ),
  birdNode: () =>
    svgNode(
      '<path d="M18 10a4 4 0 0 0-8 0c0 3-2 5-5 6 4 2 7 1 9 0 1 2 4 2 6 0-1-2-2-4-2-6z" fill="currentColor" stroke="none"/>',
    ),

  /** Axe / lumberjack (for Donkey Kong) */
  axe: svg(
    '<path d="M14 4l-8 8 4 4 8-8z" fill="currentColor" stroke="none"/><path d="M10 16l-6 6" stroke-width="2.5"/>',
  ),
  axeNode: () =>
    svgNode(
      '<path d="M14 4l-8 8 4 4 8-8z" fill="currentColor" stroke="none"/><path d="M10 16l-6 6" stroke-width="2.5"/>',
    ),

  /** Ufo (for Galaga, Gradius, Defender) */
  ufo: svg(
    '<ellipse cx="12" cy="12" rx="10" ry="4" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="4" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="2" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="6" cy="13" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="13" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="14" r="1.5" fill="currentColor" stroke="none"/>',
  ),
  ufoNode: () =>
    svgNode(
      '<ellipse cx="12" cy="12" rx="10" ry="4" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="4" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="2" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="6" cy="13" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="13" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="14" r="1.5" fill="currentColor" stroke="none"/>',
    ),

  /** Pizza slice (for BurgerTime / food) */
  pizza: svg(
    '<path d="M12 2L2 22h20L12 2z" fill="currentColor" stroke="none"/><circle cx="10" cy="16" r="1.5" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="14" cy="13" r="1.5" fill="var(--bg-mid, #0c0922)" stroke="none"/>',
  ),
  pizzaNode: () =>
    svgNode(
      '<path d="M12 2L2 22h20L12 2z" fill="currentColor" stroke="none"/><circle cx="10" cy="16" r="1.5" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="14" cy="13" r="1.5" fill="var(--bg-mid, #0c0922)" stroke="none"/>',
    ),

  /** Fist (for Double Dragon) */
  fist: svg(
    '<path d="M18 11V6a2 2 0 0 0-4 0v1M14 10V4a2 2 0 0 0-4 0v6M10 10V6a2 2 0 0 0-4 0v8l-1.2-2.4a1.5 1.5 0 0 0-2.6 1.5L4 22h16l2-8a2 2 0 0 0-2-2h-2z" fill="currentColor" stroke="none"/>',
  ),
  fistNode: () =>
    svgNode(
      '<path d="M18 11V6a2 2 0 0 0-4 0v1M14 10V4a2 2 0 0 0-4 0v6M10 10V6a2 2 0 0 0-4 0v8l-1.2-2.4a1.5 1.5 0 0 0-2.6 1.5L4 22h16l2-8a2 2 0 0 0-2-2h-2z" fill="currentColor" stroke="none"/>',
    ),

  /** Newspaper (for Paperboy) */
  newspaper: svg(
    '<path d="M4 4h16v16H4z" fill="currentColor" stroke="none"/><line x1="7" y1="8" x2="17" y2="8" stroke="var(--bg-mid, #0c0922)" stroke-width="1.5"/><line x1="7" y1="11" x2="17" y2="11" stroke="var(--bg-mid, #0c0922)" stroke-width="1"/><line x1="7" y1="14" x2="12" y2="14" stroke="var(--bg-mid, #0c0922)" stroke-width="1"/><line x1="7" y1="17" x2="14" y2="17" stroke="var(--bg-mid, #0c0922)" stroke-width="1"/>',
  ),
  newspaperNode: () =>
    svgNode(
      '<path d="M4 4h16v16H4z" fill="currentColor" stroke="none"/><line x1="7" y1="8" x2="17" y2="8" stroke="var(--bg-mid, #0c0922)" stroke-width="1.5"/><line x1="7" y1="11" x2="17" y2="11" stroke="var(--bg-mid, #0c0922)" stroke-width="1"/><line x1="7" y1="14" x2="12" y2="14" stroke="var(--bg-mid, #0c0922)" stroke-width="1"/><line x1="7" y1="17" x2="14" y2="17" stroke="var(--bg-mid, #0c0922)" stroke-width="1"/>',
    ),

  /** Moon (for Moon Patrol) */
  moon: svg(
    '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" stroke="none"/>',
  ),
  moonNode: () =>
    svgNode(
      '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" stroke="none"/>',
    ),

  /** Crosshair (for Missile Command, Tempest) */
  crosshair: svg(
    '<circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>',
  ),
  crosshairNode: () =>
    svgNode(
      '<circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>',
    ),

  /** Car (for Pole Position, Out Run) */
  car: svg(
    '<path d="M5 17h14v-5l-2-5H7L5 12v5z" fill="currentColor" stroke="none"/><rect x="7" y="10" width="4" height="3" rx="1" fill="var(--bg-mid, #0c0922)" stroke="none"/><rect x="13" y="10" width="4" height="3" rx="1" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="8" cy="17" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="17" r="2" fill="currentColor" stroke="none"/>',
  ),
  carNode: () =>
    svgNode(
      '<path d="M5 17h14v-5l-2-5H7L5 12v5z" fill="currentColor" stroke="none"/><rect x="7" y="10" width="4" height="3" rx="1" fill="var(--bg-mid, #0c0922)" stroke="none"/><rect x="13" y="10" width="4" height="3" rx="1" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="8" cy="17" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="17" r="2" fill="currentColor" stroke="none"/>',
    ),

  /** Shovel / dig (for Dig Dug) */
  shovel: svg(
    '<path d="M6 18l4-4"/><path d="M14 8l4-4"/><path d="M10 14l-4 4" stroke-width="3"/><circle cx="18" cy="4" r="2" fill="currentColor" stroke="none"/>',
  ),
  shovelNode: () =>
    svgNode(
      '<path d="M6 18l4-4"/><path d="M14 8l4-4"/><path d="M10 14l-4 4" stroke-width="3"/><circle cx="18" cy="4" r="2" fill="currentColor" stroke="none"/>',
    ),

  /** Asteroid (for Asteroids) */
  asteroid: svg(
    '<path d="M12 2l3 2 4-1 2 4 1 4-2 3 1 4-4 2-3 1-4-2-4 2-3-1-1-4 2-3-1-4 2-4 4-1z" fill="currentColor" stroke="none"/>',
  ),
  asteroidNode: () =>
    svgNode(
      '<path d="M12 2l3 2 4-1 2 4 1 4-2 3 1 4-4 2-3 1-4-2-4 2-3-1-1-4 2-3-1-4 2-4 4-1z" fill="currentColor" stroke="none"/>',
    ),

  /** Shield (for Defender, Gradius) */
  shield: svg(
    '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" stroke="none"/>',
  ),
  shieldNode: () =>
    svgNode(
      '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" stroke="none"/>',
    ),

  /** Eagle / bird (for Joust) */
  eagle: svg(
    '<path d="M4 14c0-4 4-8 8-10 4 2 8 6 8 10-4 0-6-2-8-2s-4 2-8 2z" fill="currentColor" stroke="none"/><circle cx="10" cy="12" r="1" fill="var(--bg-mid, #0c0922)" stroke="none"/>',
  ),
  eagleNode: () =>
    svgNode(
      '<path d="M4 14c0-4 4-8 8-10 4 2 8 6 8 10-4 0-6-2-8-2s-4 2-8 2z" fill="currentColor" stroke="none"/><circle cx="10" cy="12" r="1" fill="var(--bg-mid, #0c0922)" stroke="none"/>',
    ),

  /** Spider / centipede (for Centipede) */
  centipede: svg(
    '<ellipse cx="12" cy="12" rx="4" ry="8" fill="currentColor" stroke="none"/><circle cx="12" cy="4" r="2.5" fill="currentColor" stroke="none"/><line x1="8" y1="8" x2="3" y2="6"/><line x1="16" y1="8" x2="21" y2="6"/><line x1="8" y1="12" x2="3" y2="12"/><line x1="16" y1="12" x2="21" y2="12"/><line x1="8" y1="16" x2="3" y2="18"/><line x1="16" y1="16" x2="21" y2="18"/>',
  ),
  centipedeNode: () =>
    svgNode(
      '<ellipse cx="12" cy="12" rx="4" ry="8" fill="currentColor" stroke="none"/><circle cx="12" cy="4" r="2.5" fill="currentColor" stroke="none"/><line x1="8" y1="8" x2="3" y2="6"/><line x1="16" y1="8" x2="21" y2="6"/><line x1="8" y1="12" x2="3" y2="12"/><line x1="16" y1="12" x2="21" y2="12"/><line x1="8" y1="16" x2="3" y2="18"/><line x1="16" y1="16" x2="21" y2="18"/>',
    ),

  /** Spiral (for Neon Nexus) */
  spiral: svg(
    '<path d="M12 12c0-2 2-4 4-4s4 2 4 4-2 6-6 6-8-2-8-6 2-8 6-8 10 2 10 6-2 8-6 8" fill="none"/>',
  ),
  spiralNode: () =>
    svgNode(
      '<path d="M12 12c0-2 2-4 4-4s4 2 4 4-2 6-6 6-8-2-8-6 2-8 6-8 10 2 10 6-2 8-6 8" fill="none"/>',
    ),

  /** Swarm / cell (for Cell Swarm) */
  swarm: svg(
    '<circle cx="8" cy="12" r="4" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="3" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="3" fill="currentColor" stroke="none"/><line x1="12" y1="12" x2="13" y2="10" stroke-width="1.5"/><line x1="12" y1="12" x2="13" y2="14" stroke-width="1.5"/>',
  ),
  swarmNode: () =>
    svgNode(
      '<circle cx="8" cy="12" r="4" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="3" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="3" fill="currentColor" stroke="none"/><line x1="12" y1="12" x2="13" y2="10" stroke-width="1.5"/><line x1="12" y1="12" x2="13" y2="14" stroke-width="1.5"/>',
    ),

  /** Cube (for Tetris) */
  cube: svg(
    '<path d="M12 2l8 4.5v11L12 22l-8-4.5v-11z" fill="currentColor" stroke="none"/><path d="M12 12l8-4.5" stroke-width="1.5"/><path d="M12 12l-8-4.5" stroke-width="1.5"/><path d="M12 12v10" stroke-width="1.5"/>',
  ),
  cubeNode: () =>
    svgNode(
      '<path d="M12 2l8 4.5v11L12 22l-8-4.5v-11z" fill="currentColor" stroke="none"/><path d="M12 12l8-4.5" stroke-width="1.5"/><path d="M12 12l-8-4.5" stroke-width="1.5"/><path d="M12 12v10" stroke-width="1.5"/>',
    ),

  /** Ghost (for Pac-Man) */
  ghost: svg(
    '<path d="M12 4a6 6 0 0 0-6 6v8h12v-8a6 6 0 0 0-6-6z" fill="currentColor" stroke="none"/><path d="M6 18l-1 4 3-3 3 3 3-3 3 3 3-3 1 4" stroke-width="1.5"/><circle cx="9.5" cy="10" r="1.5" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="14.5" cy="10" r="1.5" fill="var(--bg-mid, #0c0922)" stroke="none"/>',
  ),
  ghostNode: () =>
    svgNode(
      '<path d="M12 4a6 6 0 0 0-6 6v8h12v-8a6 6 0 0 0-6-6z" fill="currentColor" stroke="none"/><path d="M6 18l-1 4 3-3 3 3 3-3 3 3 3-3 1 4" stroke-width="1.5"/><circle cx="9.5" cy="10" r="1.5" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="14.5" cy="10" r="1.5" fill="var(--bg-mid, #0c0922)" stroke="none"/>',
    ),

  /** Satellite (for Raiden, space shmups) */
  satellite: svg(
    '<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>',
  ),
  satelliteNode: () =>
    svgNode(
      '<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>',
    ),

  /** Cube / block (for Q*bert) */
  qbert: svg(
    '<path d="M12 2l8 5v10l-8 5-8-5V7z" fill="currentColor" stroke="none"/><path d="M12 12l8-5" stroke-width="1.5"/><path d="M12 12l-8-5" stroke-width="1.5"/><circle cx="12" cy="12" r="2" fill="var(--bg-mid, #0c0922)" stroke="none"/>',
  ),
  qbertNode: () =>
    svgNode(
      '<path d="M12 2l8 5v10l-8 5-8-5V7z" fill="currentColor" stroke="none"/><path d="M12 12l8-5" stroke-width="1.5"/><path d="M12 12l-8-5" stroke-width="1.5"/><circle cx="12" cy="12" r="2" fill="var(--bg-mid, #0c0922)" stroke="none"/>',
    ),
};
