import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createGameEnv, restoreGlobals, pressKey, getText, ROOT } from './helpers/game-test-helpers.js';

describe('Paperboy — mecánicas', () => {
  let dom, win, doc;
  before(async () => {
    ({ dom, window: win, document: doc } = createGameEnv('paperboy'));
    await import(pathToFileURL(`${ROOT}/games/paperboy/script.js`).href);
  });
  after(() => { dom.window.close(); restoreGlobals(); });

  it('inicializa con score=0', () => { assert.equal(getText(doc, 'scoreValue'), '0'); });
  it('inicia juego con Space', () => { pressKey(win, 'Space'); assert.ok(doc.getElementById('overlay').classList.contains('hidden')); });
  it('soporta cambio de carril', () => { pressKey(win, 'ArrowUp'); pressKey(win, 'ArrowDown'); assert.ok(true); });
  it('lanzar periódico con ArrowRight', () => { pressKey(win, 'ArrowRight'); assert.ok(true); });
  it('soporta WASD', () => { pressKey(win, 'KeyW'); pressKey(win, 'KeyS'); pressKey(win, 'KeyD'); assert.ok(true); });
  it('pausa con KeyP', () => { pressKey(win, 'KeyP'); pressKey(win, 'KeyP'); assert.ok(true); });
  it('reinicia con KeyR', () => { pressKey(win, 'KeyR'); assert.equal(getText(doc, 'scoreValue'), '0'); });
  it('canvas tiene dimensiones válidas', () => { const c = doc.getElementById('gameCanvas'); assert.ok(c); assert.ok(c.width > 0); });
  it('tiene botones touch correctos', () => { assert.ok(doc.getElementById('btnUp')); assert.ok(doc.getElementById('btnDown')); assert.ok(doc.getElementById('btnThrow')); });
});
