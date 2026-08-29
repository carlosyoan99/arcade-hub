/* eslint-env node */
// Regenera las screenshots de todos los juegos (games/<id>/screenshot.png) con
// el diseño de captura a pantalla completa estilo qbert/raiden: canvas estirado
// al viewport 1024×768 sobre fondo oscuro neón. No modifica el código de los
// juegos: solo inyecta CSS temporal para la captura.
// Uso:
//   node scripts/shots.js
//   node scripts/shots.js --game=pong
//   node scripts/shots.js --headful
import { statSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { games } from '../games.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8127;
const VIEWPORT = { width: 1024, height: 768 };
const args = process.argv.slice(2);
const getArg = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const onlyGame = getArg('game');
const headful = args.includes('--headful');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
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
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

// CSS de captura: el canvas ocupa todo el viewport sobre fondo oscuro neón;
// se ocultan loading, barra de juego y controles táctiles para una escena pura.
const STYLE = `
html, body { background: #05060f !important; }
#gameCanvas {
  position: fixed !important;
  inset: 0 !important;
  margin: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  display: block !important;
  image-rendering: auto !important;
}
#loading, #touchControls {
  display: none !important;
}
`;

const canvasStats = (p) =>
  p.evaluate(() => {
    const c = document.getElementById('gameCanvas');
    if (!c) return { bright: 0, total: 0 };
    const ctx = c.getContext('2d');
    if (!ctx) return { bright: 0, total: 0 };
    const { width: w, height: h } = c;
    const d = ctx.getImageData(0, 0, w, h).data;
    let bright = 0;
    const step = 8;
    for (let i = 0; i < d.length; i += step * 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      if (r + g + b > 200) bright++;
      else if (r + g + b > 60) bright += 0.35;
    }
    return { bright, total: Math.ceil(d.length / (step * 4)) };
  });

const shot = async (p, attempt = 0) => {
  try {
    return await p.screenshot({ type: 'png', timeout: 45000 });
  } catch (err) {
    if (attempt < 2) {
      await p.waitForTimeout(800);
      return shot(p, attempt + 1);
    }
    throw err;
  }
};

const browser = await chromium.launch({ channel: 'chrome', headless: !headful });
const results = [];
for (const game of games) {
  if (onlyGame && game.id !== onlyGame) continue;
  const page = await browser.newPage({ viewport: VIEWPORT });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
  try {
    await page.goto(`http://127.0.0.1:${PORT}/games/${game.id}/index.html`, {
      waitUntil: 'domcontentloaded',
    });
    await page.addStyleTag({ content: STYLE });
    await page.waitForTimeout(1100);
    // Secuencia de arranque probada: clicks + Enter/r alternados hasta que el
    // juego arranque (el overlay se oculta). La mayor parte de la composición
    // neón aparece en partida.
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press(i % 2 ? 'Enter' : 'r');
      await page.mouse.click(512, 384);
      await page.waitForTimeout(700);
    }
    await page.waitForTimeout(1400);
    const s1 = await canvasStats(page);
    const buf = await shot(page);
    const file = path.join(ROOT, 'games', game.id, 'screenshot.png');
    writeFileSync(file, buf);
    const frac = ((s1.bright / s1.total) * 100).toFixed(1);
    results.push({ id: game.id, frac, errors, bytes: buf.length });
    const warn = errors.length ? `  ⚠ ${errors.join('; ')}` : '';
    console.log(`${game.id.padEnd(16)} shot 1024x768 bright≈${frac}%  ${buf.length}B${warn}`);
  } catch (err) {
    results.push({ id: game.id, frac: -1, errors: [String(err).split('\n')[0]], bytes: 0 });
    console.error(`✖ ${game.id}: ${String(err).split('\n')[0]}`);
  }
  await page.close();
}

const ok = results.filter((r) => r.frac >= 0 && r.errors.length === 0).length;
const withErr = results.filter((r) => r.errors.length > 0).map((r) => r.id);
console.log(`\nResumen: ${ok}/${results.length} capturas OK`);
if (withErr.length) console.log(`Con errores de consola: ${withErr.join(', ')}`);
await browser.close();
server.close();
