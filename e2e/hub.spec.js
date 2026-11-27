import { expect, test as base } from '@playwright/test';

/** Falla el test si el HUB escribe cualquier error en la consola del navegador. */
const test = base.extend({
  consoleErrors: async ({ page }, use) => {
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
    });
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    await use(errors);
    expect(errors, 'errores de consola del HUB').toEqual([]);
  },
});

test('la vitrina carga 32 juegos, sin iframes ni errores', async ({ page, consoleErrors }) => {
  await page.goto('/');

  await expect(page.locator('#grid > li')).toHaveCount(32);
  await expect(page.locator('#grid a.card')).toHaveCount(32);
  await expect(page.locator('#count')).toHaveText('32 títulos');
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('#shelf')).toBeVisible();
  await expect(page.locator('#stage')).toBeHidden();

  expect(consoleErrors).toEqual([]);
});

test('la búsqueda filtra la vitrina y lo anuncia por aria-live', async ({ page, consoleErrors }) => {
  await page.goto('/');

  const search = page.locator('#search');
  await expect(search).toHaveAttribute('type', 'search');
  await search.fill('pong');

  await expect(page.locator('#grid > li')).toHaveCount(1);
  await expect(page.locator('#grid a.card')).toHaveAttribute('href', '#game/pong');
  await expect(page.locator('#count')).toHaveText('1 títulos');
  await expect(page.locator('#empty')).toBeHidden();

  const results = page.locator('#results');
  await expect(results).toHaveAttribute('aria-live', 'polite');
  await expect(results).toContainText('1 juego encontrados');

  await search.fill('zzz-no-existe');
  await expect(page.locator('#grid > li')).toHaveCount(0);
  await expect(page.locator('#empty')).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test('#game/pong muestra canvas, HUD y anuncia el juego activo', async ({ page, consoleErrors }) => {
  await page.goto('/#game/pong');

  await expect(page.locator('#stage')).toBeVisible();
  await expect(page.locator('#shelf')).toBeHidden();
  await expect(page.locator('#stage-title')).toHaveText('Pong');
  await expect(page.locator('#screen')).toBeVisible();
  await expect(page.locator('#hint')).toContainText('P pausa');

  // El HUD (marcador) se pinta dentro del canvas: buscamos píxeles no fondo
  // en la franja central superior donde Pong dibuja el resultado.
  const hudPixels = () =>
    page.locator('#screen').evaluate((canvas) => {
      const ctx = canvas.getContext('2d');
      const { data } = ctx.getImageData(canvas.width / 2 - 70, 12, 140, 56);
      let painted = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 40 || data[i + 1] > 40 || data[i + 2] > 40) painted++;
      }
      return painted;
    });
  await expect.poll(hudPixels, { timeout: 10_000 }).toBeGreaterThan(0);

  const status = page.locator('#status');
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await expect(status).toHaveText('Juego activo: Pong');

  await page.locator('#back').click();
  await expect(page.locator('#shelf')).toBeVisible();
  await expect(status).toHaveText('Vitrina de juegos');

  expect(consoleErrors).toEqual([]);
});

test('prefers-reduced-motion desactiva animaciones y Tab deja foco visible', async ({
  page,
  consoleErrors,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const card = page.locator('.card').first();
  await expect(card).toBeVisible();
  await expect(card).not.toHaveCSS('animation-name', 'none');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.locator('.card').first()).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.card').first()).toHaveCSS('animation-duration', '0s');

  await page.keyboard.press('Tab');
  const skip = page.locator('.skip');
  await expect(skip).toBeFocused();
  await expect(skip).toHaveCSS('outline-style', 'solid');
  await expect(skip).toHaveCSS('outline-width', '2px');

  await page.keyboard.press('Tab');
  await expect(page.locator('#search')).toBeFocused();
  await expect(page.locator('#search')).toHaveCSS('outline-width', '2px');

  expect(consoleErrors).toEqual([]);
});
