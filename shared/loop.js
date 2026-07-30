/* ============================================================
   shared/loop.js — Game loop compartido
   RAF + dt calculation + cleanup, sin dependencias externas.
   ============================================================ */

/**
 * Crea un game loop con dt calculation, RAF management y cleanup.
 *
 * @param {(dt: number) => void} stepFn — Se llama cada frame con el dt en segundos
 * @returns {{ start: () => void, stop: () => void, isRunning: boolean }}
 *
 * Uso típico:
 *   import { createGameLoop } from '../../shared/loop.js';
 *   const loop = createGameLoop((dt) => {
 *     pollGamepad();
 *     updateShake(dt);
 *     if (state.running && !state.gameOver) updateGame(dt);
 *     updateSquashes(dt);
 *     updateParticles(dt);
 *     draw();
 *   });
 *   loop.start();
 *
 *   // cleanup:
 *   function cleanup() { loop.stop(); closeAudio(); }
 *   window.addEventListener('beforeunload', cleanup);
 */
export function createGameLoop(stepFn) {
  let animFrameId = null;
  let lastTime = 0;
  let running = false;

  function tick(time) {
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    stepFn(dt);
    animFrameId = requestAnimationFrame(tick);
  }

  return {
    /** Inicia el loop (normalmente dentro de startGame) */
    start() {
      if (running) return;
      running = true;
      animFrameId = requestAnimationFrame((t) => {
        lastTime = t;
        tick(t);
      });
    },
    /** Detiene el loop (normalmente dentro de cleanup) */
    stop() {
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      running = false;
    },
    get isRunning() {
      return running;
    },
  };
}
