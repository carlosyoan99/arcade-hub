import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NET_VERSION,
  ProtocolError,
  encode,
  parseClientMessage,
  parseClientText,
} from '../src/protocol.js';

const hello = { v: 1, t: 'hello', name: 'Ada' };
const join = { v: 1, t: 'join', code: 'abcd', role: 'player' };
const input = { v: 1, t: 'input', tick: 7, actions: ['p1Up', 'serve'] };
const hash = { v: 1, t: 'hash', tick: 30, value: '30:123:e22d095e-20' };
const left = { v: 1, t: 'left' };

function rejects(raw, code) {
  assert.throws(
    () => parseClientMessage(raw),
    (error) => error instanceof ProtocolError && (code === undefined || error.code === code),
  );
}

test('acepta los cinco mensajes cliente→servidor y sanea los campos', () => {
  assert.deepEqual(parseClientMessage(hello), hello);
  assert.deepEqual(parseClientMessage(join), { ...join, code: 'ABCD' });
  assert.deepEqual(parseClientMessage(input), input);
  assert.deepEqual(parseClientMessage(hash), hash);
  assert.deepEqual(parseClientMessage(left), left);
  assert.deepEqual(parseClientMessage({ ...join, role: undefined }), {
    ...join,
    code: 'ABCD',
    role: 'player',
  });
  assert.equal(NET_VERSION, 1);
  assert.equal(JSON.parse(encode(parseClientMessage(input))).tick, 7);
});

test('rechaza versión incorrecta, tipo desconocido y envelope roto', () => {
  rejects({ ...hello, v: 2 }, 'bad-version');
  rejects({ ...hello, v: '1' }, 'bad-version');
  rejects({ ...hello, t: 'nope' }, 'unknown-type');
  rejects(null, 'bad-envelope');
  rejects([], 'bad-envelope');
  rejects('hello', 'bad-envelope');
  assert.throws(
    () => parseClientText('{'),
    (error) => error.code === 'bad-json',
  );
  assert.deepEqual(parseClientText(encode(input)), input);
});

test('valida tick y actions en input', () => {
  rejects({ ...input, tick: -1 }, 'bad-tick');
  rejects({ ...input, tick: 1.5 }, 'bad-tick');
  rejects({ ...input, tick: '7' }, 'bad-tick');
  rejects({ ...input, actions: 'p1Up' }, 'bad-actions');
  rejects({ ...input, actions: ['p1Up', 'p1Up'] }, 'bad-actions');
  rejects({ ...input, actions: [7] }, 'bad-actions');
  rejects({ ...input, actions: Array.from({ length: 65 }, () => 'up') }, 'bad-actions');
});

test('valida join, hash y name', () => {
  rejects({ ...join, code: 'abc' }, 'bad-code');
  rejects({ ...join, code: 'ab-cd!' }, 'bad-code');
  rejects({ ...join, role: 'bot' }, 'bad-role');
  rejects({ ...hello, name: '' }, 'bad-name');
  rejects({ ...hello, name: 'a'.repeat(25) }, 'bad-name');
  rejects({ ...hello, name: 'a\nb' }, 'bad-name');
  rejects({ ...hash, value: 'not a hash!' }, 'bad-hash');
  rejects({ ...hash, value: '' }, 'bad-value');
  rejects({ ...hash, tick: -1 }, 'bad-tick');
});
