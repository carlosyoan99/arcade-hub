/**
 * Shared DOM injection — Arcade Hub
 *
 * Injects common HTML structures (loading, announce, gameBar) into each game's
 * page, eliminating ~15 lines of duplicated markup per game.
 */

/**
 * Inject the shared common elements (loading, announce, gameBar) into the
 * document body. Safe to call multiple times — subsequent calls are no-ops.
 *
 * Must be called early in each game's script.js before any
 * `document.getElementById('loading')` / `gameBar` / `announce` access.
 */
export function injectCommonElements() {
  if (document.getElementById('__injected__')) return;
  const mark = document.createElement('meta');
  mark.id = '__injected__';

  // ── Loading spinner ──
  const loading = document.createElement('div');
  loading.id = 'loading';
  loading.innerHTML = '<div class="spinner"></div><span>◈ Cargando...</span>';
  document.body.appendChild(loading);

  // ── Screen-reader announce ──
  const announce = document.createElement('div');
  announce.id = 'announce';
  announce.setAttribute('aria-live', 'polite');
  announce.setAttribute('aria-atomic', 'true');
  announce.className = 'sr-only';
  document.body.appendChild(announce);

  // ── Game bar (hub, fullscreen, help) ──
  const bar = document.createElement('div');
  bar.id = 'gameBar';
  bar.innerHTML =
    '<button id="hubBtn" aria-label="Volver al Arcade Hub" title="Volver al Arcade Hub">\n' +
    '        ← Arcade\n' +
    '      </button>\n' +
    '      <button id="fsBtn" aria-label="Pantalla completa" title="Pantalla completa">⛶</button>\n' +
    '      <button id="helpBtn" aria-label="Ayuda" title="Ayuda">❓</button>';
  document.body.appendChild(bar);

  document.body.appendChild(mark);
}
