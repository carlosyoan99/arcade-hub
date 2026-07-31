#!/usr/bin/env node
/**
 * scripts/verify.js — Verificación de consistencia del proyecto.
 *
 * Detecta automáticamente la familia de bugs que históricamente se
 * encontraron por auditoría manual:
 *   1. Un juego en disco que no está en games.js (o viceversa)
 *   2. Un juego en games.js sin sus archivos (index.html/style.css/script.js/metadata.json)
 *   3. Un import de shared/*.js en un script.js que no está en el FILES de sw.js
 *   4. Un juego en games.js que no tiene su ruta en el FILES de sw.js
 *
 * Uso: npm run verify  (o: node scripts/verify.js)
 * Salida: 0 si todo OK, 1 si hay inconsistencias.
 *
 * Sin dependencias externas (solo Node built-ins + games.js que es data pura).
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { games } from '../games.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const errors = [];
const warn = (msg) => console.log('  ⚠️ ' + msg);

// ── 1. Carpetas en disco vs games.js ──
const diskDirs = fs
  .readdirSync(path.join(ROOT, 'games'))
  .filter((d) => fs.statSync(path.join(ROOT, 'games', d)).isDirectory() && d !== 'legacy-3d')
  .sort();

const manifestIds = games.map((g) => g.id);
const missingInManifest = diskDirs.filter((d) => !manifestIds.includes(d));
const missingOnDisk = manifestIds.filter((id) => !diskDirs.includes(id));

if (missingInManifest.length) {
  errors.push(`Juegos en disco sin entrada en games.js: ${missingInManifest.join(', ')}`);
}
if (missingOnDisk.length) {
  errors.push(`Juegos en games.js sin carpeta en disco: ${missingOnDisk.join(', ')}`);
}

// ── 2. Archivos por juego ──
const REQUIRED_FILES = ['index.html', 'style.css', 'script.js', 'metadata.json', 'README.md'];
for (const g of games) {
  const gameDir = path.join(ROOT, 'games', g.id);
  const missing = REQUIRED_FILES.filter((f) => !fs.existsSync(path.join(gameDir, f)));
  if (missing.length) {
    errors.push(`Juego ${g.id}: faltan archivos ${missing.join(', ')}`);
  }
  // file del manifest debe apuntar a un html existente
  if (g.file && !fs.existsSync(path.join(ROOT, g.file))) {
    errors.push(`Juego ${g.id}: 'file' en games.js no existe (${g.file})`);
  }
}

// ── 3. Imports de shared/*.js en cada script.js ──
const sharedImports = new Set();
for (const g of games) {
  const scriptPath = path.join(ROOT, 'games', g.id, 'script.js');
  if (!fs.existsSync(scriptPath)) continue;
  const src = fs.readFileSync(scriptPath, 'utf8');
  const matches = src.matchAll(/from\s+['"]\.\.\/\.\.\/shared\/([\w.-]+\.js)['"]/g);
  for (const m of matches) sharedImports.add('./shared/' + m[1]);
}

// ── 4. FILES de sw.js ──
function extractSwFiles() {
  const src = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const sandbox = {
    self: { addEventListener() {}, skipWaiting() {}, clients: { claim() {} } },
    caches: {},
    console,
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(src, ctx, { filename: 'sw.js' });
  // Las declaraciones const de nivel superior viven en el entorno léxico global
  // del contexto, no como propiedades del objeto — se leen con un segundo script.
  return vm.runInContext('FILES', ctx) || [];
}
const swFiles = extractSwFiles();

const missingInSw = [...sharedImports].filter((f) => !swFiles.includes(f));
if (missingInSw.length) {
  errors.push(`Imports de shared/ que faltan en sw.js FILES: ${missingInSw.join(', ')}`);
}

// Inverso: shared/*.js en FILES que ningún juego importa (stale/obsoleto)
const staleShared = swFiles.filter(
  (f) => f.startsWith('./shared/') && f.endsWith('.js') && !sharedImports.has(f),
);
if (staleShared.length) {
  warn(`shared/ en sw.js FILES que ningún juego importa: ${staleShared.join(', ')}`);
}

for (const g of games) {
  for (const f of ['index.html', 'style.css', 'script.js']) {
    const rel = `./games/${g.id}/${f}`;
    if (!swFiles.includes(rel)) {
      errors.push(`Juego ${g.id}: falta ${rel} en sw.js FILES`);
    }
  }
}

// ── 5. Extra: metadata.json válido con versión ──
for (const g of games) {
  const metaPath = path.join(ROOT, 'games', g.id, 'metadata.json');
  if (!fs.existsSync(metaPath)) continue;
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (!meta.version) errors.push(`Juego ${g.id}: metadata.json sin "version"`);
    if (meta.id !== g.id) warn(`metadata.id (${meta.id}) difiere de games.js id (${g.id})`);
  } catch {
    errors.push(`Juego ${g.id}: metadata.json inválido`);
  }
}

// ── Reporte ──
console.log('=== Verificación de consistencia ===');
console.log(`Juegos en games.js: ${manifestIds.length}`);
console.log(`Carpetas en disco: ${diskDirs.length}`);
console.log(`Imports shared/ usados: ${sharedImports.size}`);
console.log(`Entradas en sw.js FILES: ${swFiles.length}`);
console.log('');

if (errors.length) {
  console.log(`❌ ${errors.length} error(es):`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
} else {
  console.log('✅ Todo consistente.');
  process.exit(0);
}
