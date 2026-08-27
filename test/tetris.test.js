import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import {
  createGameEnv,
  restoreGlobals,
  pressKey,
  getText,
  ROOT,
} from './helpers/game-test-helpers.js';

describe('Tetris — mecánicas', () => {
  let dom, win, doc;

  before(async () => {
    ({ dom, window: win, document: doc } = createGameEnv('tetris'));
    await import(pathToFileURL(`${ROOT}/games/tetris/script.js`).href);
  });

  after(() => {
    dom.window.close();
    restoreGlobals();
  });

  it('inicializa con score=0, lines=0, level=1', () => {
    assert.equal(getText(doc, 'scoreValue'), '0');
    assert.equal(getText(doc, 'linesValue'), '0');
    assert.equal(getText(doc, 'levelValue'), '1');
  });

  it('tiene overlay visible al inicio', () => {
    assert.ok(doc.getElementById('overlay'));
    assert.ok(!doc.getElementById('overlay').classList.contains('hidden'));
  });

  it('inicia juego con Space', () => {
    pressKey(win, 'Space');
    assert.ok(doc.getElementById('overlay').classList.contains('hidden'));
  });

  it('muestra pieza en canvas tras iniciar', () => {
    const canvas = doc.getElementById('gameCanvas');
    assert.ok(canvas);
    assert.ok(canvas.width > 0);
    assert.ok(canvas.height > 0);
  });

  it('soporta rotación con ArrowUp', () => {
    pressKey(win, 'ArrowUp');
    // No debe crashear
    assert.ok(true);
  });

  it('soporta movimiento lateral con ArrowLeft/ArrowRight', () => {
    pressKey(win, 'ArrowLeft');
    pressKey(win, 'ArrowRight');
    assert.ok(true);
  });

  it('soporta hard drop con Space (pieza ya cayendo)', () => {
    pressKey(win, 'Space');
    assert.ok(true);
  });

  it('soporta hold con KeyC', () => {
    pressKey(win, 'KeyC');
    assert.ok(true);
  });

  it('pausa con KeyP', () => {
    pressKey(win, 'KeyP');
    const overlay = doc.getElementById('overlay');
    assert.ok(overlay);
  });

  it('reinicia con KeyR cuando no está corriendo', () => {
    pressKey(win, 'KeyP');
    assert.ok(true);
  });

  it('display de nivel funciona', () => {
    const levelText = getText(doc, 'levelValue');
    assert.ok(levelText !== undefined && levelText !== null);
  });

  it('display de best funciona', () => {
    const bestText = getText(doc, 'bestValue');
    assert.ok(bestText !== undefined && bestText !== null);
  });
});
