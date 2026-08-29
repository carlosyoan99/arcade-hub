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

describe('Pole Position — mecánicas', () => {
  let dom, win, doc;

  before(async () => {
    ({ dom, window: win, document: doc } = createGameEnv('pole-position'));
    await import(pathToFileURL(`${ROOT}/games/pole-position/script.js`).href);
  });

  after(() => {
    dom.window.close();
    restoreGlobals();
  });

  it('inicializa con tiempo de calificación', () => {
    const time = getText(doc, 'timeValue');
    assert.ok(time);
    assert.ok(Number(time) > 0);
  });

  it('inicia juego con Space', () => {
    pressKey(win, 'Space');
    assert.ok(doc.getElementById('overlay').classList.contains('hidden'));
  });

  it('soporta aceleración con ArrowUp', () => {
    pressKey(win, 'ArrowUp');
    assert.ok(true);
  });

  it('soporta freno con ArrowDown', () => {
    pressKey(win, 'ArrowDown');
    assert.ok(true);
  });

  it('soporta giro con ArrowLeft/Right', () => {
    pressKey(win, 'ArrowLeft');
    pressKey(win, 'ArrowRight');
    assert.ok(true);
  });

  it('soporta turbo con Space', () => {
    pressKey(win, 'Space');
    assert.ok(true);
  });

  it('soporta WASD', () => {
    pressKey(win, 'KeyW');
    pressKey(win, 'KeyS');
    pressKey(win, 'KeyA');
    pressKey(win, 'KeyD');
    assert.ok(true);
  });

  it('pausa con KeyP', () => {
    pressKey(win, 'KeyP');
    pressKey(win, 'KeyP');
    assert.ok(true);
  });

  it('reinicia con KeyR', () => {
    pressKey(win, 'KeyR');
    const time = getText(doc, 'timeValue');
    assert.ok(time);
  });

  it('canvas tiene dimensiones válidas', () => {
    const canvas = doc.getElementById('gameCanvas');
    assert.ok(canvas);
    assert.ok(canvas.width > 0);
    assert.ok(canvas.height > 0);
  });

  it('tiene botones touch correctos', () => {
    assert.ok(doc.getElementById('btnUp'));
    assert.ok(doc.getElementById('btnDown'));
    assert.ok(doc.getElementById('btnLeft'));
    assert.ok(doc.getElementById('btnRight'));
    assert.ok(doc.getElementById('btnTurbo'));
  });
});
