import { test, expect } from '@playwright/test';
import {
  games,
  trackErrors,
  waitForFrame,
  waitForGameState,
  overlayGone,
  trackEntryOverlay,
} from './helpers.js';

/** Cierra el entry overlay (si está visible) con un gesto real en la esquina. */
async function dismissEntryOverlay(page) {
  await page.mouse.click(5, 5);
  await expect.poll(() => overlayGone(page), { timeout: 4000 }).toBe(true);
}

test.describe('hub', () => {
  test('renderiza todas las tarjetas sin errores de consola ni HTTP', async ({ page }) => {
    test.setTimeout(30000);
    const { errors, httpErrors } = trackErrors(page);
    await page.goto('/');
    await dismissEntryOverlay(page);
    const cards = await page.locator('#grid .card').count();
    expect(cards, `la grilla debe listar los ${games.length} juegos`).toBe(games.length);
    expect(errors, errors.join('\n')).toEqual([]);
    expect(httpErrors, httpErrors.join('\n')).toEqual([]);
  });

  test('entry overlay: aparece fresco, auto-cierre y cierre por gesto', async ({ page }) => {
    test.setTimeout(60000);
    const { errors, httpErrors } = trackErrors(page);
    const audioWarnings = [];
    page.on('console', (m) => {
      if (/AudioContext was not allowed to start/i.test(m.text())) audioWarnings.push(m.text());
    });
    // Registra la aparición del overlay desde dentro del documento: es inmune a
    // la carrera con el auto-cierre de ~7s (el goto puede tardar más que el
    // overlay bajo CPU contenida; el flag queda anotado durante la carga).
    await trackEntryOverlay(page);
    // waitUntil domcontentloaded: el overlay se auto-cierra ~7s tras cargar y
    // esperar 'load' (bloqueado por Google Fonts fallando) lo perdería.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Apareció fresco sin interacción previa.
    await expect
      .poll(() => page.evaluate(() => window.__entryOverlayAppeared === true), { timeout: 5000 })
      .toBe(true);
    // Sin warnings de auto-play antes de ningún gesto del usuario.
    expect(audioWarnings, 'sin warnings de audio antes del gesto').toHaveLength(0);
    // Auto-cierre sin interacción a los ~7s.
    await expect.poll(() => overlayGone(page), { timeout: 12000 }).toBe(true);
    // Reaparece si se limpia el flag "visto" y se recarga.
    await page.evaluate(() => localStorage.removeItem('arcadehub_coin_inserted'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect
      .poll(() => page.evaluate(() => window.__entryOverlayAppeared === true), { timeout: 5000 })
      .toBe(true);
    // Se cierra con un gesto real.
    await page.mouse.click(40, 40);
    await expect.poll(() => overlayGone(page), { timeout: 4000 }).toBe(true);
    expect(errors, errors.join('\n')).toEqual([]);
    expect(httpErrors, httpErrors.join('\n')).toEqual([]);
  });

  test('clic en una card abre el juego en iframe', async ({ page }) => {
    test.setTimeout(60000);
    const { errors, httpErrors } = trackErrors(page);
    await page.goto('/');
    await dismissEntryOverlay(page);
    await page.locator('[data-game-id="pong"]').click();
    const frame = await waitForFrame(page, 'pong');
    const state = await waitForGameState(
      frame,
      (s) => s.loadingGone && s.hasCanvas && s.hasOverlay,
      {
        timeout: 15000,
      },
    );
    expect(state.loadingGone && state.hasCanvas && state.hasOverlay).toBe(true);
    expect(errors, errors.join('\n')).toEqual([]);
    expect(httpErrors, httpErrors.join('\n')).toEqual([]);
  });
});
