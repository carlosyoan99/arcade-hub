/**
 * shared/shell.js — Game shell común — Arcade Hub
 *
 * Centraliza el boilerplate repetido en los 19 juegos:
 *   - Cableado de la game-bar (hub / fullscreen / música / ayuda)
 *   - Trampa de Tab (accesibilidad) con ciclo activar/desactivar
 *   - Limpieza en beforeunload/pagehide (audio, listeners, extras)
 *
 * Uso típico en el script.js de un juego:
 *   const shell = setupGameShell('pong');          // tras injectCommonElements()
 *   // en startGame():        shell.enableTabTrap();
 *   // en gameOver()/endGame(): shell.disableTabTrap();
 *   // al final del archivo:
 *   shell.onCleanup(() => loop.stop());
 *   document.getElementById('loading').classList.add('hidden');
 *   loop.start();
 */

import { showHelp } from './help.js';
import { stopMusic } from './music.js';
import { closeAudio } from './audio.js';

/**
 * Configura el shell compartido de un juego.
 * El cleanup siempre llama a stopMusic() + closeAudio() (closeAudio ya
 * detiene el ambient internamente), por lo que los juegos no deben
 * duplicar esas llamadas.
 *
 * @param {string} gameId - Id del juego (para showHelp y futuras extensiones)
 * @returns {{
 *   cleanup: () => void,
 *   onCleanup: (fn: () => void) => void,
 *   enableTabTrap: () => void,
 *   disableTabTrap: () => void,
 * }}
 */
export function setupGameShell(gameId) {
  // ── Game bar ──
  document.getElementById('hubBtn')?.addEventListener('click', () => {
    if (window.self !== window.top) {
      window.top.location.hash = '';
    } else {
      window.location.href = '../../index.html';
    }
  });
  document.getElementById('fsBtn')?.addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  });
  document.getElementById('helpBtn')?.addEventListener('click', () => showHelp(gameId));

  // ── Accesibilidad: Tab no debe sacar el foco mientras se juega ──
  const trapTab = (e) => {
    if (e.key === 'Tab') e.preventDefault();
  };
  const enableTabTrap = () => document.addEventListener('keydown', trapTab);
  const disableTabTrap = () => document.removeEventListener('keydown', trapTab);

  // ── Cleanup ──
  const extraCleanups = [];
  function cleanup() {
    disableTabTrap();
    for (const fn of extraCleanups) {
      try {
        fn();
      } catch {
        // un cleanup extra no debe impedir el resto
      }
    }
    stopMusic();
    closeAudio();
  }
  window.addEventListener('beforeunload', cleanup);
  window.addEventListener('pagehide', cleanup);

  return {
    cleanup,
    /** Registra limpieza adicional específica del juego (ej. loop.stop()). */
    onCleanup(fn) {
      extraCleanups.push(fn);
    },
    enableTabTrap,
    disableTabTrap,
  };
}
