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

const VIEWPORTS = [
  { width: 360, height: 640 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
];

for (const viewport of VIEWPORTS) {
  test(`letterbox responsive ${viewport.width}×${viewport.height} sin scroll ni recorte`, async ({
    page,
    consoleErrors,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/#game/pong');
    await expect(page.locator('#stage')).toBeVisible();

    const metrics = await page.locator('#screen').evaluate((canvas) => {
      const rect = canvas.getBoundingClientRect();
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        worldWidth: Number(canvas.dataset.worldWidth),
        worldHeight: Number(canvas.dataset.worldHeight),
        box: JSON.parse(canvas.dataset.letterbox ?? '{}'),
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(viewport.width + 1);
    expect(metrics.rect.x).toBeGreaterThanOrEqual(-1);
    expect(metrics.rect.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(metrics.worldWidth).toBe(1024);
    expect(metrics.worldHeight).toBe(700);
    expect(metrics.box.scale).toBeGreaterThan(0);
    // computeLetterbox conserva la proporción y centra el mundo.
    expect(metrics.box.width / metrics.box.height).toBeCloseTo(1024 / 700, 3);
    expect(metrics.box.x).toBeGreaterThanOrEqual(-0.5);
    expect(metrics.box.y).toBeGreaterThanOrEqual(-0.5);
    expect(metrics.box.scale).toBeCloseTo(
      Math.min(metrics.rect.width / 1024, metrics.rect.height / 700),
      2,
    );

    expect(consoleErrors).toEqual([]);
  });
}

test('pantalla completa: botón, tecla F, sin deformar y Esc devuelve el foco', async ({
  page,
  consoleErrors,
}) => {
  await page.goto('/#game/pong');
  const button = page.getByTestId('fullscreen');
  await expect(button).toBeVisible();
  const size = await button.boundingBox();
  expect(size.width).toBeGreaterThanOrEqual(44);
  expect(size.height).toBeGreaterThanOrEqual(24);

  await button.click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
  const full = await page.locator('#screen').evaluate((canvas) => {
    const box = JSON.parse(canvas.dataset.letterbox ?? '{}');
    return { box, view: canvas.dataset.viewport };
  });
  expect(full.box.width / full.box.height).toBeCloseTo(1024 / 700, 3);

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await expect(button).toBeFocused();

  await page.keyboard.press('KeyF');
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
  await page.keyboard.press('KeyF');
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);

  expect(consoleErrors).toEqual([]);
});

test('las 32 tarjetas muestran capturas reales no vacías con alt', async ({
  page,
  consoleErrors,
}) => {
  await page.goto('/');
  const images = page.locator('#grid img.card__thumb');
  await expect(images).toHaveCount(32);
  const details = await images.evaluateAll((elements) =>
    elements.map((element) => ({
      src: element.getAttribute('src') ?? '',
      alt: element.getAttribute('alt') ?? '',
      naturalWidth: element.naturalWidth,
    })),
  );
  expect(new Set(details.map((image) => image.src)).size, 'capturas repetidas').toBe(32);
  for (const image of details) {
    expect(image.src.startsWith('data:image/png;base64,')).toBe(true);
    expect(image.src.length).toBeGreaterThan(1000);
    expect(image.alt.length).toBeGreaterThan(0);
    expect(image.naturalWidth).toBeGreaterThan(0);
  }

  expect(consoleErrors).toEqual([]);
});

function contrast(foreground, background) {
  const channel = (color) => {
    const value = Number.parseInt(color.slice(1), 16);
    const component = ((value >> 8) & 255) / 255;
    const red = ((value >> 16) & 255) / 255;
    const blue = (value & 255) / 255;
    return [red, component, blue].map((c) =>
      c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
    );
  };
  const luminance = (color) => {
    const [r, g, b] = channel(color);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [a, b] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

test('temas claro/oscuro/retro: toggle accesible, persistente y con contraste AA', async ({
  page,
  consoleErrors,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const themeButton = page.getByTestId('theme');

  const tokens = async () =>
    page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        theme: document.documentElement.dataset.theme,
        bg: style.getPropertyValue('--bg').trim(),
        panel: style.getPropertyValue('--panel').trim(),
        ink: style.getPropertyValue('--ink').trim(),
        muted: style.getPropertyValue('--muted').trim(),
        accent: style.getPropertyValue('--accent').trim(),
        label: document.querySelector('#theme').textContent.trim(),
        stored: localStorage.getItem('arcadehub_theme'),
      };
    });

  const seen = new Set();
  for (const expected of ['dark', 'light', 'retro']) {
    const state = await tokens();
    expect(state.theme).toBe(expected);
    expect(state.label).toContain(expected === 'dark' ? 'Oscuro' : expected === 'light' ? 'Claro' : 'Retro');
    expect(contrast(state.ink, state.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(state.muted, state.panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(state.accent, state.panel)).toBeGreaterThanOrEqual(3);
    seen.add(state.accent);

    const box = await themeButton.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(24);
    await themeButton.click();
  }
  expect(seen.size).toBe(3);

  // Retro persistido y aplicado antes del primer pintado tras recargar.
  await themeButton.click(); // oscuro → claro
  await themeButton.click(); // claro → retro
  expect((await tokens()).stored).toBe('{"v":1,"data":"retro"}');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'retro');
  await expect(page.getByTestId('theme')).toHaveAttribute('aria-label', /Retro/);
  const script = await page.locator('script:not([type])').first().textContent();
  expect(script).toContain('arcadehub_theme');

  expect(consoleErrors).toEqual([]);
});

test('R reinicia la simulación con la misma semilla y anuncia el hash del tick 0', async ({
  page,
  consoleErrors,
}) => {
  await page.goto('/#game/tetris?seed=4242');
  const hash = page.getByTestId('hash');
  const initial = await hash.getAttribute('data-initial-hash');
  expect(initial).toMatch(/^0:/);
  await expect.poll(async () => (await hash.textContent()) !== initial).toBe(true);

  await page.keyboard.press('KeyR');
  await expect(page.locator('#status')).toContainText(
    `Tetris reiniciado · semilla 4242 · hash ${initial}`,
  );
  await expect(hash).toHaveAttribute('data-initial-hash', initial);
  await expect(page.getByTestId('seed')).toHaveText('4242');
  await expect.poll(async () => (await hash.textContent()) !== initial).toBe(true);

  expect(consoleErrors).toEqual([]);
});

test('Cell Swarm: split/eject/boost llegan a InputFrame por teclado y a botones táctiles', async ({
  page,
  consoleErrors,
}) => {
  await page.goto('/#game/cell-swarm?seed=99');
  const actions = page.getByTestId('actions');

  for (const [code, action] of [
    ['KeyZ', 'eject'],
    ['KeyX', 'boost'],
    ['Space', 'split'],
  ]) {
    await page.keyboard.down(code);
    await expect.poll(() => actions.textContent()).toContain(action);
    await page.keyboard.up(code);
  }

  for (const action of ['split', 'eject', 'boost']) {
    const button = page.locator(`#touch-actions button[data-action="${action}"]`);
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(24);
    await button.hover();
    await page.mouse.down();
    await expect.poll(() => actions.textContent()).toContain(action);
    await page.mouse.up();
  }

  expect(consoleErrors).toEqual([]);
});

test('Cell Swarm: E/Q y doble tap alcanzan eject/boost', async ({ page, consoleErrors }) => {
  await page.goto('/#game/cell-swarm?seed=99');
  const actions = page.getByTestId('actions');

  await page.keyboard.down('KeyE');
  await expect.poll(() => actions.textContent()).toContain('eject');
  await page.keyboard.up('KeyE');
  await page.keyboard.down('KeyQ');
  await expect.poll(() => actions.textContent()).toContain('boost');
  await page.keyboard.up('KeyQ');

  await page.locator('#screen').dblclick();
  await expect.poll(() => actions.textContent()).toContain('boost');

  expect(consoleErrors).toEqual([]);
});

test('Neon Nexus: 1/2/3 cartas y mejoras/tienda por teclado', async ({ page, consoleErrors }) => {
  await page.goto('/#game/neon-nexus?seed=99');
  const actions = page.getByTestId('actions');

  for (const [key, action] of [
    ['1', 'card1'],
    ['2', 'card2'],
    ['3', 'card3'],
    ['4', 'upgradeAtk'],
    ['5', 'upgradeHp'],
    ['6', 'upgradeSpd'],
    ['b', 'shop'],
    ['7', 'buyMaxHp'],
    ['8', 'buyAtkBonus'],
    ['9', 'buyStartShield'],
    ['0', 'buyRegenBonus'],
    ['c', 'closeShop'],
  ]) {
    await page.keyboard.down(key);
    await expect.poll(() => actions.textContent()).toContain(action);
    await page.keyboard.up(key);
  }

  expect(consoleErrors).toEqual([]);
});

test('Q*bert: cuatro diagonales accesibles por teclado y táctil', async ({
  page,
  consoleErrors,
}) => {
  await page.goto('/#game/qbert?seed=99');
  const actions = page.getByTestId('actions');

  for (const [code, action] of [
    ['KeyQ', 'upLeft'],
    ['KeyE', 'upRight'],
    ['KeyA', 'downLeft'],
    ['KeyD', 'downRight'],
  ]) {
    await page.keyboard.down(code);
    await expect.poll(() => actions.textContent()).toContain(action);
    await page.keyboard.up(code);
  }

  for (const action of ['upLeft', 'upRight', 'downLeft', 'downRight']) {
    const button = page.locator(`#touch-actions button[data-action="${action}"]`);
    await expect(button).toBeVisible();
    await button.hover();
    await page.mouse.down();
    await expect.poll(() => actions.textContent()).toContain(action);
    await page.mouse.up();
  }

  expect(consoleErrors).toEqual([]);
});

test('CSP sin bloquear JSON-LD y foco visible con forced-colors', async ({
  page,
  consoleErrors,
}) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/');

  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("'unsafe-inline'");
  expect(csp).toContain("img-src 'self' data:");
  expect(await page.locator('#website-schema').textContent()).toContain('WebSite');
  expect(await page.locator('#itemlist-schema').textContent()).toContain('numberOfItems');

  const hasForcedColorsRule = await page.evaluate(() =>
    [...document.styleSheets].some((sheet) =>
      [...sheet.cssRules].some((rule) => rule.conditionText?.includes('forced-colors')),
    ),
  );
  expect(hasForcedColorsRule).toBe(true);

  await page.keyboard.press('Tab');
  const skip = page.locator('.skip');
  await expect(skip).toBeFocused();
  await expect(skip).toHaveCSS('outline-style', 'solid');
  const outlineWidth = await skip.evaluate((element) => getComputedStyle(element).outlineWidth);
  expect(Number.parseFloat(outlineWidth)).toBeGreaterThanOrEqual(2);

  expect(consoleErrors).toEqual([]);
});

test('semilla compartible: URL y dos contextos producen el mismo hash inicial', async ({
  page,
  browser,
  consoleErrors,
}) => {
  await page.goto('/#game/tetris?seed=4242');
  await expect(page.getByTestId('seed')).toHaveText('4242');
  expect(page.url()).toContain('#game/tetris?seed=4242');
  const first = await page.getByTestId('hash').getAttribute('data-initial-hash');

  await page.getByTestId('copy-seed').click();
  await expect(page.locator('#status')).toContainText('4242');

  const context = await browser.newContext();
  try {
    const other = await context.newPage();
    await other.goto('/#game/tetris?seed=4242');
    expect(await other.getByTestId('hash').getAttribute('data-initial-hash')).toBe(first);
  } finally {
    await context.close();
  }

  expect(consoleErrors).toEqual([]);
});
