import { test, expect } from '@playwright/test';
import {
  games,
  trackErrors,
  waitForGameState,
  waitForFrame,
  bootGame,
  expectCanvasAnimating,
  scoreFields,
  GAME_HINTS,
} from './helpers.js';

test.describe('juegos (carga directa)', () => {
  for (const game of games) {
    test(`${game.id}: arranca y el juego avanza sin errores`, async ({ page }) => {
      test.setTimeout(45000);
      const hints = GAME_HINTS[game.id];
      const { errors, httpErrors } = trackErrors(page);
      await page.goto(`/games/${game.id}/index.html`);
      await waitForGameState(page, (s) => s.loadingGone && s.hasCanvas && s.hasOverlay);
      expect(errors, errors.join('\n')).toEqual([]);
      expect(httpErrors, httpErrors.join('\n')).toEqual([]);

      // Gameplay real: inicia partida y el canvas debe seguir dibujando frames.
      await bootGame(page, { hints });
      await expectCanvasAnimating(page, { moveKeys: hints?.moveKeys });

      // Señal adicional de gameplay: el marcador por DOM (si el juego lo expone).
      const before = await scoreFields(page);
      await page.waitForTimeout(1000);
      const after = await scoreFields(page);
      const scored =
        before.length > 0 || after.length > 0 ? before.join(',') !== after.join(',') : false;
      test
        .info()
        .annotations.push({ type: 'gameplay', description: `score por DOM avanzó: ${scored}` });
    });
  }
});

test.describe('juegos (hub → iframe por hash)', () => {
  for (const game of games) {
    test(`${game.id}: carga desde el hub y avanza sin errores`, async ({ page }) => {
      // Los juegos de comportamiento lento (qbert) pueden superar los 45s bajo
      // CPU contenida al correr la suite completa.
      test.setTimeout(75000);
      const hints = GAME_HINTS[game.id];
      const { errors, httpErrors } = trackErrors(page, { filterUrl: `/games/${game.id}/` });
      // Cargar directo con el hash omite el entry overlay (hub.js lo remueve si
      // el hash inicia con #game/) y evita el gesto de dismiss bajo carga.
      await page.goto(`/#game/${game.id}`);
      const frame = await waitForFrame(page, game.id);
      await waitForGameState(frame, (s) => s.loadingGone && s.hasCanvas && s.hasOverlay);
      expect(errors, errors.join('\n')).toEqual([]);
      expect(httpErrors, httpErrors.join('\n')).toEqual([]);

      await bootGame(frame, { hints });
      await expectCanvasAnimating(frame, { moveKeys: hints?.moveKeys });
    });
  }
});
