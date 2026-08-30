import { test, expect } from '@playwright/test';
import { games, gameState } from './helpers.js';

test('service worker: hub y todos los juegos funcionan offline', async ({ page }) => {
  test.setTimeout(240000);
  const context = page.context();

  // Registro y activación del service worker (precache de todos los FILES).
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 10000 })
    .toBe(true);

  await context.setOffline(true);

  try {
    // El hub offline arranca desde el caché del SW.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const cards = await page.locator('#grid .card').count();
    expect(cards, `el hub offline debe listar los ${games.length} juegos`).toBe(games.length);

    // Cada juego offline (cache-first del SW: si falta en FILES, no arranca).
    for (const game of games) {
      await page
        .goto(`/games/${game.id}/index.html`, {
          waitUntil: 'domcontentloaded',
          timeout: 8000,
        })
        .catch(() => {});
      await page.waitForTimeout(600);
      const state = await gameState(page);
      expect(
        state.loadingGone && state.hasCanvas,
        `${game.id} no arranca offline (falta en el precache del SW)`,
      ).toBe(true);
    }
  } finally {
    await context.setOffline(false);
  }
});
