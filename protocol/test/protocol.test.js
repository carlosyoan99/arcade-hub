import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HASH_INTERVAL,
  MAX_PLAYERS_PER_ROOM,
  NET_VERSION,
  ProtocolError,
  desyncMessage,
  encode,
  parseClientMessage,
  parseClientText,
  parseServerMessage,
  parseServerText,
  welcome,
} from '../index.js';

test('el paquete compartido expone el contrato v1 completo', () => {
  assert.equal(NET_VERSION, 1);
  assert.equal(HASH_INTERVAL, 30);
  assert.equal(MAX_PLAYERS_PER_ROOM, 4);
  assert.equal(parseClientMessage({ v: 1, t: 'left' }).t, 'left');
  assert.deepEqual(parseServerMessage(welcome('host-1')), welcome('host-1'));
  assert.equal(parseServerText(encode(desyncMessage(30, []))).t, 'desync');
});

test('la validación compartida rechaza envelopes rotos y versión incorrecta', () => {
  assert.throws(
    () => parseClientMessage({ v: 2, t: 'hello', name: 'Ada' }),
    (error) => error instanceof ProtocolError && error.code === 'bad-version',
  );
  assert.throws(
    () => parseServerMessage({ v: 1, t: 'nope' }),
    (error) => error instanceof ProtocolError && error.code === 'unknown-type',
  );
  assert.throws(
    () => parseClientText('{'),
    (error) => error.code === 'bad-json',
  );
});
