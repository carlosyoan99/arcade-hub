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

import { icons } from './icons.js';

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
  const ico = (svg) => `<span class="icon-svg">${svg}</span>`;
  const bar = document.createElement('div');
  bar.id = 'gameBar';
  bar.innerHTML = `
      <button id="hubBtn" aria-label="Volver al Arcade Hub" title="Volver al Arcade Hub">
        ${ico(icons.chevronLeft)} Arcade
      </button>
      <button id="fsBtn" aria-label="Pantalla completa" title="Pantalla completa">${ico(icons.fullscreen)}</button>
      <button id="musicBtn" aria-pressed="true" aria-label="Silenciar música" title="Música">${ico(icons.music)}</button>
      <button id="settingsBtn" aria-label="Configuración" title="Configuración">${ico(icons.settings)}</button>
      <button id="helpBtn" aria-label="Ayuda" title="Ayuda">${ico(icons.help)}</button>`;
  document.body.appendChild(bar);

  document.body.appendChild(mark);
}
