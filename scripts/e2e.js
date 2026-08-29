/* eslint-env node */
// E2E smoke audit: carga el hub y todos los juegos del manifiesto en Chrome
// real (headless) y reporta errores de consola, excepciones de página y
// respuestas HTTP fallidas. Uso:
//   npm run test:e2e
//   npm run test:e2e -- --game=pong
//   npm run test:e2e -- --headful   (Chrome visible)
//   npm run test:e2e -- --quiet     (solo el resumen)
import { readFileSync, statSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { games } from '../games.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8123;
const args = process.argv.slice(2);
const getArg = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const onlyGame = getArg('game');
const headful = args.includes('--headful');
const quiet = args.includes('--quiet');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let filePath = path.normalize(path.join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT) || path.basename(filePath).startsWith('.')) {
      res.writeHead(403).end();
      return;
    }
    if (!statSync(filePath).isFile()) {
      if (urlPath === '/' || urlPath === '') filePath = path.join(ROOT, 'index.html');
      else {
        res.writeHead(404).end();
        return;
      }
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404).end();
  }
});

const BENIGN_ERRORS = [
  /AudioContext was not allowed to start/i,
  /play\(\) request was interrupted/i,
  /The request is not allowed by the user agent/i,
  /not allowed to start after user gesture/i,
];

function isBenignMessage(text) {
  return BENIGN_ERRORS.some((re) => re.test(text));
}

async function auditPage(page, label, errors, httpErrors) {
  page.on('pageerror', (err) => errors.push(`pageerror: ${err}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !isBenignMessage(m.text())) errors.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().endsWith('/favicon.ico') && r.status() !== 404) {
      httpErrors.push(`HTTP ${r.status()} ${r.url()}`);
    }
  });
  page.on('requestfailed', (r) =>
    httpErrors.push(`REQUEST_FAILED ${r.url()} ${r.failure()?.errorText ?? ''}`),
  );
  const response = await page.goto(`http://127.0.0.1:${PORT}/${encodeURI(label)}`, {
    waitUntil: 'domcontentloaded',
  });
  if (response && response.status() >= 400)
    httpErrors.push(`PAGE HTTP ${response.status()} ${label}`);
  await page.waitForTimeout(1000);
  return page.evaluate(() => {
    const loading = document.getElementById('loading');
    return {
      loadingGone: !loading || loading.classList.contains('hidden'),
      hasCanvas: !!document.getElementById('gameCanvas'),
    };
  });
}

const results = [];
async function main() {
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'chrome', headless: !headful });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

  const targetGames = onlyGame ? games.filter((g) => g.id === onlyGame) : games;
  if (onlyGame && targetGames.length === 0) {
    console.error(`Juego desconocido: ${onlyGame}`);
    process.exit(2);
  }
  const log = quiet ? () => {} : (msg) => console.log(msg);

  try {
    for (const game of targetGames) {
      const page = await context.newPage();
      const errors = [];
      const httpErrors = [];
      const info = await auditPage(page, `games/${game.id}/index.html`, errors, httpErrors);
      await page.close();
      const label = `games/${game.id}`;
      const ok =
        errors.length === 0 && httpErrors.length === 0 && info.loadingGone && info.hasCanvas;
      results.push({ label, ok, errors, httpErrors, info });
      if (ok) log(`✔ ${game.id}`);
      else {
        log(`✖ ${game.id}`);
        if (!quiet) {
          if (!info.loadingGone) log(`    loading: la pantalla "Cargando..." sigue visible`);
          if (!info.hasCanvas) log(`    falta #gameCanvas`);
          for (const e of errors) log(`    ${e.split('\n')[0]}`);
          for (const e of httpErrors) log(`    ${e}`);
        }
      }
    }

    const page = await context.newPage();
    const errors = [];
    const httpErrors = [];
    await auditPage(page, 'index.html', errors, httpErrors);
    let hub = await page.evaluate(() => ({
      cards: document.querySelectorAll('#grid .card').length,
      entryOverlay: !!document.getElementById('entryOverlay'),
    }));
    if (hub.entryOverlay) {
      await page.waitForTimeout(7300);
      hub = await page.evaluate(() => ({
        cards: document.querySelectorAll('#grid .card').length,
        entryOverlay: !!document.getElementById('entryOverlay'),
      }));
    }
    await page.close();
    const hubOk =
      errors.length === 0 &&
      httpErrors.length === 0 &&
      hub.cards === games.length &&
      !hub.entryOverlay;
    results.push({ label: 'hub', ok: hubOk, errors, httpErrors, info: hub });

    // ── Camino real de juego: hub + iframe por hash (#game/<id>) ──
    const iframePage = await context.newPage();
    await auditPage(iframePage, 'index.html', [], []);
    for (const game of targetGames) {
      const errs = [];
      const httpreqs = [];
      const pathPart = `/games/${game.id}/`;
      const onConsole = (m) => {
        if (m.type() !== 'error' || isBenignMessage(m.text())) return;
        if ((m.location()?.url ?? '').includes(pathPart)) errs.push(`console: ${m.text()}`);
      };
      const onPageErr = (err) => {
        if (String(err).includes(pathPart)) errs.push(`pageerror: ${err}`);
      };
      iframePage.on('console', onConsole);
      iframePage.on('pageerror', onPageErr);
      iframePage.on('requestfailed', (r) => {
        if (r.url().includes(pathPart))
          httpreqs.push(`REQUEST_FAILED ${r.url()} ${r.failure()?.errorText ?? ''}`);
      });
      await iframePage.evaluate((id) => {
        window.location.hash = `#game/${id}`;
      }, game.id);
      await iframePage.waitForTimeout(2500);
      iframePage.off('console', onConsole);
      iframePage.off('pageerror', onPageErr);
      const frame = iframePage
        .frames()
        .find((f) => f.url().includes(pathPart) && f.url().endsWith('index.html'));
      let state = null;
      if (frame) {
        state = await frame.evaluate(() => {
          const loading = document.getElementById('loading');
          return {
            loadingGone: !loading || loading.classList.contains('hidden'),
            hasCanvas: !!document.getElementById('gameCanvas'),
            hasOverlay: !!document.getElementById('overlay'),
          };
        });
      }
      const ok =
        !!state &&
        state.loadingGone &&
        state.hasCanvas &&
        state.hasOverlay &&
        errs.length === 0 &&
        httpreqs.length === 0;
      results.push({
        label: `hub→iframe:${game.id}`,
        ok,
        errors: errs,
        httpErrors: httpreqs,
        info: state,
      });
      if (ok) log(`✔ hub→iframe:${game.id}`);
      else {
        log(`✖ hub→iframe:${game.id}`);
        if (!quiet) {
          if (!state) log(`    iframe no encontrado (hash ${game.id})`);
          else {
            if (!state.loadingGone)
              log(`    loading: la pantalla "Cargando..." sigue visible en el iframe`);
            if (!state.hasCanvas) log(`    falta #gameCanvas en el iframe`);
            if (!state.hasOverlay) log(`    falta #overlay en el iframe`);
          }
          for (const e of errs) log(`    ${e.split('\n')[0]}`);
          for (const e of httpreqs) log(`    ${e}`);
        }
      }
    }
    await iframePage.close();

    const passed = results.filter((r) => r.ok).length;
    const total = results.length;
    console.log(
      `\nResumen: ${passed}/${total} OK` +
        (hub.cards !== games.length
          ? ` (hub: ${hub.cards} tarjetas, esperaba ${games.length})`
          : '') +
        (hub.entryOverlay ? ' (hub: entry overlay aun presente)' : ''),
    );
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  console.error(
    'Si falla al lanzar Chrome: instale Google Chrome o pruebe con PLAYWRIGHT_BROWSERS_PATH.',
  );
  process.exit(1);
});
