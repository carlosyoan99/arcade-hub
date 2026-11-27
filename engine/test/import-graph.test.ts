import { readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Frontera de dependencias del motor, comprobada sobre el código fuente.
 * No se añaden dependencias: se leen los .ts con node:fs y se extraen las
 * importaciones con regex sobre `import`/`export ... from`.
 */

const SRC = fileURLToPath(new URL('../src', import.meta.url));

/** Capas de presentación/persistencia/red: prohibidas en el núcleo del motor. */
const OUTER_LAYERS = new Set(['render', 'audio', 'ui', 'store', 'net']);
/** Capas que render/audio no deben arrastrar (mutarían sim/game). */
const SIM_LAYERS = new Set(['sim', 'game', 'games']);
/** Capas que net no debe arrastrar. */
const NET_BANNED = new Set(['render', 'audio', 'ui']);
/** Globals de DOM vedados en el núcleo. */
const DOM_GLOBALS = /\b(document|window|navigator|requestAnimationFrame|localStorage)\b/g;
/** loop.ts usa RAF legítimamente; simulation.ts solo define tipos. */
const DOM_EXEMPT = new Set(['core/loop.ts', 'core/simulation.ts']);

interface Literal {
  value: string;
  line: number;
  /** Código ya enmascarado (sin comentarios ni cadenas) justo antes de la comilla. */
  before: string;
}

interface ImportInfo {
  spec: string;
  line: number;
  layer: string;
  isRelative: boolean;
}

/**
 * Enmascara comentarios y contenido de cadenas (manteniendo saltos de línea y
 * longitudes) y recoge todos los literales con su contexto precedente.
 * Así una mención en un comentario (`sin localStorage`) o una propiedad
 * (`window: 500`) no se cuenta como importación ni como uso de DOM.
 */
function scanLiterals(source: string): { literals: Literal[]; code: string } {
  const literals: Literal[] = [];
  let code = '';
  let before = '';
  let line = 1;
  let i = 0;

  const emit = (chunk: string): void => {
    code += chunk;
    before = (before + chunk).slice(-180);
  };

  while (i < source.length) {
    const ch = source[i] ?? '';
    if (ch === '\n') {
      emit('\n');
      line += 1;
      i += 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') {
        emit(' ');
        i += 1;
      }
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      emit(' ');
      emit(' ');
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') {
          emit('\n');
          line += 1;
        } else {
          emit(' ');
        }
        i += 1;
      }
      if (i < source.length) {
        emit(' ');
        emit(' ');
        i += 2;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      const startLine = line;
      let value = '';
      emit(' '); // comilla de apertura
      i += 1;
      while (i < source.length) {
        const cur = source[i] ?? '';
        if (cur === '\\') {
          value += cur + (source[i + 1] ?? '');
          emit(' ');
          emit(' ');
          i += 2;
          continue;
        }
        if (cur === quote) {
          emit(' '); // comilla de cierre
          i += 1;
          break;
        }
        value += cur;
        if (cur === '\n') {
          emit('\n');
          line += 1;
        } else {
          emit(' ');
        }
        i += 1;
      }
      literals.push({ value, line: startLine, before });
      continue;
    }
    emit(ch);
    i += 1;
  }
  return { literals, code };
}

/** Un literal es especificador de módulo si va tras from/import/require(. */
const MODULE_CONTEXT = /(?:\bfrom\s*|\bimport\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)$/;

function listTsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = resolve(dir, entry.name);
      return entry.isDirectory() ? listTsFiles(path) : entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
    })
    .sort();
}

const ALL_FILES = listTsFiles(SRC);
const rel = (file: string): string => relative(SRC, file).split(sep).join('/');

function filesIn(layer: string): string[] {
  return ALL_FILES.filter((file) => rel(file).startsWith(`${layer}/`));
}

/** Especificadores de módulo detectados en el código fuente, con línea. */
function importSpecs(source: string): Array<{ spec: string; line: number }> {
  return scanLiterals(source)
    .literals.filter((literal) => MODULE_CONTEXT.test(literal.before))
    .map((literal) => ({ spec: literal.value, line: literal.line }));
}

function importsOf(file: string): ImportInfo[] {
  return importSpecs(readFileSync(file, 'utf8')).map(({ spec, line }) => {
    const isRelative = spec.startsWith('.');
    const target = isRelative ? resolve(dirname(file), spec) : '';
    const targetRel = target ? relative(SRC, target).split(sep).join('/') : '';
    const outside = !targetRel || targetRel === '..' || targetRel.startsWith('../') || isAbsolute(targetRel);
    return {
      spec,
      line,
      isRelative,
      layer: outside ? 'externo' : (targetRel.split('/')[0] ?? (spec.split('/')[0] ?? '')),
    };
  });
}

/** Líneas con globals de DOM usados como identificador (no como propiedad). */
function domUsagesIn(source: string): Array<{ line: number; token: string }> {
  return scanLiterals(source)
    .code.split('\n')
    .flatMap((lineText, index) => {
      const hits: Array<{ line: number; token: string }> = [];
      for (const match of lineText.matchAll(DOM_GLOBALS)) {
        const at = match.index ?? 0;
        if (lineText[at - 1] === '.' || /^\s*:/.test(lineText.slice(at + match[0].length))) continue;
        hits.push({ line: index + 1, token: match[0] });
      }
      return hits;
    });
}

function domUsages(file: string): Array<{ line: number; token: string }> {
  return DOM_EXEMPT.has(rel(file)) ? [] : domUsagesIn(readFileSync(file, 'utf8'));
}

function assertClean(violations: string[]): void {
  expect(violations.join('\n'), 'Frontera de dependencias del motor violada').toBe('');
}

function bannedImports(layers: string[], banned: Set<string>): string[] {
  return layers.flatMap((layer) => {
    const files = filesIn(layer);
    expect(files.length, `sin archivos en src/${layer}/`).toBeGreaterThan(0);
    return files.flatMap((file) =>
      importsOf(file)
        .filter((imp) => banned.has(imp.layer))
        .map((imp) => `${rel(file)}:${imp.line}: importación prohibida de '${imp.spec}' (capa ${imp.layer})`),
    );
  });
}

describe('grafo de imports del motor', () => {
  it('encuentra los .ts del motor', () => {
    expect(ALL_FILES.length).toBeGreaterThan(0);
    for (const layer of ['sim', 'ai', 'progression', 'core', 'game', 'games', 'render', 'audio', 'net']) {
      expect(filesIn(layer).length, `sin archivos en src/${layer}/`).toBeGreaterThan(0);
    }
  });

  it('el detector reconoce importaciones y globals de DOM (y ignora comentarios y propiedades)', () => {
    const sample = [
      "import { x } from '../render/canvas2d.js';",
      'export * from "../../audio/synth.js";',
      "import './side-effect.js';",
      'const bad = () => document.querySelector("div");',
      '// import { x } from "../ui/shell.js"; // sin localStorage',
      'const config = { window: 500, dda: { maxAdjust: 0.1 } };',
      'const ok = config.window;',
    ].join('\n');

    expect(importSpecs(sample)).toEqual([
      { spec: '../render/canvas2d.js', line: 1 },
      { spec: '../../audio/synth.js', line: 2 },
      { spec: './side-effect.js', line: 3 },
    ]);
    expect(domUsagesIn(sample)).toEqual([{ line: 4, token: 'document' }]);
  });

  it('sim/ai/progression/core no importan de render/audio/ui/store/net', () => {
    assertClean(bannedImports(['sim', 'ai', 'progression', 'core'], OUTER_LAYERS));
  });

  it('sim/ai/progression/core no usan globals de DOM', () => {
    const violations = ['sim', 'ai', 'progression', 'core'].flatMap((layer) =>
      filesIn(layer).flatMap((file) =>
        domUsages(file).map(({ line, token }) => `${rel(file)}:${line}: importación prohibida de DOM (${token})`),
      ),
    );
    assertClean(violations);
  });

  it('game no importa de render/audio/ui/store/net', () => {
    assertClean(bannedImports(['game'], OUTER_LAYERS));
  });

  it('games solo importa rutas relativas dentro de src, nunca capas externas ni el shared legacy', () => {
    const violations = filesIn('games').flatMap((file) =>
      importsOf(file).flatMap((imp) => {
        const problems: string[] = [];
        if (!imp.isRelative) {
          problems.push(`${rel(file)}:${imp.line}: importación prohibida de '${imp.spec}' (debe ser ruta relativa dentro de src)`);
        }
        if (imp.layer === 'externo') {
          problems.push(`${rel(file)}:${imp.line}: importación prohibida de '${imp.spec}' (fuera de src)`);
        }
        if (OUTER_LAYERS.has(imp.layer)) {
          problems.push(`${rel(file)}:${imp.line}: importación prohibida de '${imp.spec}' (capa ${imp.layer})`);
        }
        if (imp.layer === 'shared' || /(^|\/)shared\//.test(imp.spec)) {
          problems.push(`${rel(file)}:${imp.line}: importación prohibida de '${imp.spec}' (shared legacy)`);
        }
        return problems;
      }),
    );
    assertClean(violations);
  });

  it('render/audio no importan sim/game (excepto thumbnail, que solo lee el contrato)', () => {
    // `render/thumbnail.ts` necesita `game/adapter.ts` para ejecutar el step real
    // del juego y capturar su imagen. Es render-only, pura lectura y no muta el estado.
    const violations = bannedImports(['render', 'audio'], SIM_LAYERS).filter(
      (problem) => !problem.startsWith('render/thumbnail.ts:'),
    );
    assertClean(violations);
  });

  it('net no importa render/audio/ui ni usa DOM', () => {
    const violations = [
      ...bannedImports(['net'], NET_BANNED),
      ...filesIn('net').flatMap((file) =>
        domUsages(file).map(({ line, token }) => `${rel(file)}:${line}: importación prohibida de DOM (${token})`),
      ),
    ];
    assertClean(violations);
  });
});
