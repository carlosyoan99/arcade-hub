/* eslint-env node */
// Servidor estático mínimo para la suite E2E (playwright.config.js) y para el
// desarrollo local. Sirve el repo desde la raíz con MIME correctos y
// Cache-Control no-store (el service worker se encarga del versionado offline).
// Uso:
//   node scripts/web-server.js [puerto]
import { statSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

/**
 * Crea un servidor HTTP estático que sirve `root`.
 * @param {string} root - directorio raíz a servir
 * @returns {http.Server}
 */
export function createStaticServer(root) {
  return http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let filePath = path.normalize(path.join(root, urlPath));
      if (!filePath.startsWith(root) || path.basename(filePath).startsWith('.')) {
        res.writeHead(403).end();
        return;
      }
      if (!statSync(filePath).isFile()) {
        if (urlPath === '/' || urlPath === '') filePath = path.join(root, 'index.html');
        else if (urlPath.endsWith('/favicon.ico')) {
          res.writeHead(204).end();
          return;
        } else {
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
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.argv[2]) || 8124;
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const server = createStaticServer(root);
  server.listen(port, () => {
    console.log(`Servidor estático en http://127.0.0.1:${port}`);
  });
}
