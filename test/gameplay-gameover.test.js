/**
 * Verificación de lógica de fin de partida y reinicio.
 *
 * Tres juegos con game-over DETERMINISTA bajo el rAF stepper (sin reloj real):
 *  - flappy-bird: la paloma cae y choca contra el suelo solo.
 *  - snake: manteniendo ArrowLeft, choca contra la pared.
 *  - dino-runner: un obstáculo aparece sin necesidad de inputs.
 *
 * Se verifica que el overlay vuelve a aparecer (fin de partida), que el texto
 * informativo no está vacío y que tras la secuencia de arranque el juego
 * reinicia: el HUD de score vuelve a '0'. No se fija el frame exacto — el rng
 * de dino-runner puede desplazar el obstáculo — solo se acota el horizonte.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGameEnv,
  createRafStepper,
  restoreGlobals,
  pressKey,
  releaseKey,
  clickOverlay,
  getText,
} from './helpers/game-test-helpers.js';

const GAME_OVER_CASES = {
  'flappy-bird': {
    // La paloma muere sin inputs (cae al suelo).
    driver: null,
    // Texto informativo de fin de partida.
    info: (doc) => getText(doc, 'ot') ?? getText(doc, 'fs'),
    expect: /r[ée]cord|chocaste/i,
  },
  snake: {
    // Choque contra la pared manteniendo ArrowLeft.
    driver: { code: 'ArrowLeft', eachFrame: true },
    info: (doc) => getText(doc, 'overlayText'),
    expect: /game over/i,
  },
  'dino-runner': {
    // Un obstáculo llega sin inputs.
    driver: null,
    info: (doc) => getText(doc, 'finalScore') ?? getText(doc, 'overlayText'),
    expect: /distancia|r[ée]cord/i,
  },
};

after(() => restoreGlobals());

for (const [gameId, cfg] of Object.entries(GAME_OVER_CASES)) {
  test(`logica-fin: ${gameId} termina la partida y reinicia`, async (t) => {
    const stepper = createRafStepper();
    const { dom, window: win, document: doc } = createGameEnv(gameId);
    t.after(() => {
      try {
        win.dispatchEvent(new win.Event('beforeunload'));
      } catch {
        /* cleanup best-effort en los tests */
      }
      dom.window.close();
    });

    const { raf, caf } = stepper;
    win.requestAnimationFrame = raf;
    win.cancelAnimationFrame = caf;
    globalThis.requestAnimationFrame = raf;
    globalThis.cancelAnimationFrame = caf;

    const moduleUrl = new URL(`../games/${gameId}/script.js`, import.meta.url).href;
    await import(moduleUrl);

    const runFrames = (n, action) => {
      for (let i = 0; i < n; i++) {
        if (action) action(i);
        stepper.step();
      }
    };
    const firstErrors = () => stepper.errors.slice(0, 3).map((e) => String(e.message ?? e));

    // Arranque estándar (Space → Enter → click → R).
    const overlayEl = doc.getElementById('overlay');
    const started = () => {
      if (!overlayEl) return true;
      return overlayEl.classList.contains('hidden') || overlayEl.style.display === 'none';
    };
    const startSequence = () => {
      pressKey(win, 'Space');
      runFrames(4);
      if (!started()) {
        pressKey(win, 'Enter');
        runFrames(4);
      }
      if (!started()) {
        clickOverlay(win);
        runFrames(4);
      }
      if (!started()) {
        pressKey(win, 'KeyR');
        runFrames(4);
      }
    };
    startSequence();
    assert.ok(started(), `${gameId}: el overlay no se ocultó tras arrancar`);

    // Conducir hasta la muerte dentro de un horizonte acotado.
    const HORIZON = 800;
    let overFrame = null;
    for (let i = 0; i < HORIZON && started(); i++) {
      if (cfg.driver?.eachFrame) pressKey(win, cfg.driver.code);
      stepper.step();
      if (!started()) overFrame = i + 1;
    }
    assert.ok(
      overFrame !== null,
      `${gameId}: el juego no terminó en ${HORIZON} frames (sin fin de partida)`,
    );
    assert.ok(overFrame >= 10, `${gameId}: fin de partida demasiado temprano (frame ${overFrame})`);

    // El texto informativo del fin de partida es coherente.
    const overText = (cfg.info(doc) ?? '').trim();
    assert.ok(overText.length > 0, `${gameId}: texto de fin de partida vacío`);
    assert.match(
      overText,
      cfg.expect,
      `${gameId}: texto de fin de partida inesperado: '${overText}'`,
    );

    // Soltar la tecla que pueda quedar "sostenida" por el driver.
    if (cfg.driver) releaseKey(win, cfg.driver.code);

    // Reiniciar con la secuencia de arranque → volver a jugar.
    startSequence();
    assert.ok(started(), `${gameId}: el juego no arrancó de nuevo tras el game over`);
    if (gameId !== 'dino-runner') {
      assert.equal(
        getText(doc, 'scoreValue')?.trim(),
        '0',
        `${gameId}: el score no volvió a 0 tras reiniciar`,
      );
    }

    assert.deepEqual(
      stepper.errors,
      [],
      `${gameId}: excepciones en el loop ${JSON.stringify(firstErrors())}`,
    );
  });
}
