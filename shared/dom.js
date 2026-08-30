/**
 * Shared DOM injection — Arcade Hub
 *
 * Injects common HTML structures (loading, announce, gameBar) into each game's
 * page, eliminating ~15 lines of duplicated markup per game.
 */

/**
 * Safely set hint text with styled <kbd> elements.
 * Replaces innerHTML for hint strings like:
 *   "{Espacio} / tocar para reintentar · {R} reiniciar"
 * Key names wrapped in {} become <kbd> elements; everything else is text.
 *
 * @param {HTMLElement} el
 * @param {string} text
 */
export function setHint(el, text) {
  if (!el) return;
  el.textContent = '';
  const parts = text.split(/(\{[^}]+\})/);
  for (const part of parts) {
    if (part.startsWith('{') && part.endsWith('}')) {
      const kbd = document.createElement('kbd');
      kbd.textContent = part.slice(1, -1);
      el.appendChild(kbd);
    } else if (part) {
      el.appendChild(document.createTextNode(part));
    }
  }
}

/**
 * Inject the shared common elements (loading, announce, gameBar) into the
 * document body. Safe to call multiple times — subsequent calls are no-ops.
 *
 * Must be called early in each game's script.js before any
 * `document.getElementById('loading')` / `gameBar` / `announce` access.
 */
/* ── Tema y preferencias de usuario (aplicadas en cada documento de juego) ──
   El juego puede vivir dentro del iframe del hub (mismo origen), así que
   hereda la elección de tema/reducción de movimiento del padre cuando exista.
   Sin iframe (juego abierto solo) aplica la preferencia guardada o la del SO. */
function applyTheme() {
  const THEME_KEY = 'arcadehub_theme';
  let theme = 'dark';
  try {
    theme = localStorage.getItem(THEME_KEY) || theme;
    if (window.parent && window.parent !== window) {
      const t = window.parent.document.documentElement.dataset.theme;
      if (t === 'light' || t === 'dark') theme = t;
    }
  } catch {
    /* sin almacenamiento / acceso al padre: se deja el valor por defecto */
  }
  document.documentElement.dataset.theme = theme;
}

function applyReduceMotion() {
  try {
    const pref = localStorage.getItem('arcadehub_reduce_motion') === 'on';
    document.documentElement.dataset.reduceMotion = pref ? 'on' : 'off';
  } catch {
    document.documentElement.dataset.reduceMotion = 'off';
  }
}

function applyUserPreferences() {
  applyTheme();
  applyReduceMotion();
}

export function injectCommonElements() {
  if (document.getElementById('__injected__')) return;
  const mark = document.createElement('meta');
  mark.id = '__injected__';
  applyUserPreferences();

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
    '        <span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></span> Arcade\n' +
    '      </button>\n' +
    '      <button id="fsBtn" aria-label="Pantalla completa" title="Pantalla completa"><span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></span></button>\n' +
    '      <button id="musicBtn" aria-pressed="true" aria-label="Silenciar música" title="Música"><span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3" fill="currentColor" stroke="none"/><circle cx="18" cy="16" r="3" fill="currentColor" stroke="none"/></svg></span></button>\n' +
    '      <button id="settingsBtn" aria-label="Configuración" title="Configuración"><span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span></button>\n' +
    '      <button id="helpBtn" aria-label="Ayuda" title="Ayuda"><span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span></button>';
  document.body.appendChild(bar);

  document.body.appendChild(mark);
}
