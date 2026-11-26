import assert from 'node:assert/strict';
import test from 'node:test';
import { HASH_INTERVAL } from '../src/protocol.js';
import { Room, RoomRegistry, generateCode } from '../src/room.js';

function makeClient(id, name = id) {
  return {
    id,
    name,
    role: 'player',
    received: [],
    send(message) {
      this.received.push(message);
    },
  };
}

function messages(client, type) {
  return client.received.filter((message) => message.t === type);
}

function setup(registry = new RoomRegistry({ seedFactory: () => 12345 })) {
  const p1 = makeClient('p1');
  const p2 = makeClient('p2');
  const spec = makeClient('spec');
  assert.equal(registry.join('ABCD', p1, 'player').ok, true);
  assert.equal(registry.join('ABCD', p2, 'player').ok, true);
  assert.equal(registry.join('ABCD', spec, 'spectator').ok, true);
  p1.room = registry.get('ABCD');
  p2.room = p1.room;
  spec.room = p1.room;
  return { registry, room: p1.room, p1, p2, spec };
}

test('sala con 2 jugadores y espectador: roster, seed y host', () => {
  const { room, p1, p2, spec } = setup();
  assert.equal(room.seed, 12345);
  assert.equal(room.hostId, 'p1');
  assert.deepEqual(
    room.players.map((c) => c.id),
    ['p1', 'p2'],
  );
  assert.deepEqual(
    room.spectators.map((c) => c.id),
    ['spec'],
  );
  for (const client of [p1, p2, spec]) {
    const joined = messages(client, 'joined').at(-1);
    assert.equal(joined.id, client.id);
    assert.equal(joined.seed, 12345);
    assert.equal(joined.hostId, 'p1');
    assert.deepEqual(
      joined.players.map((p) => p.id),
      ['p1', 'p2'],
    );
    assert.deepEqual(
      joined.spectators.map((p) => p.id),
      ['spec'],
    );
  }
  assert.equal(messages(p1, 'peer-joined').length, 2);
  assert.equal(messages(p2, 'peer-joined').length, 1);
  assert.equal(messages(spec, 'peer-joined').length, 0);
});

test('relay de input llega a jugadores y espectadores, nunca al emisor', () => {
  const { registry, p1, p2, spec } = setup();
  const result = registry.relay(p1, { v: 1, t: 'input', tick: 4, actions: ['p1Up'] });
  assert.equal(result.ok, true);
  for (const client of [p2, spec]) {
    const relayed = messages(client, 'input').at(-1);
    assert.deepEqual(relayed, { v: 1, t: 'input', from: 'p1', tick: 4, actions: ['p1Up'] });
  }
  assert.equal(messages(p1, 'input').length, 0);
});

test('el espectador recibe la cinta pero no puede emitir inputs ni hashes', () => {
  const { registry, spec } = setup();
  const result = registry.relay(spec, { v: 1, t: 'input', tick: 1, actions: [] });
  assert.deepEqual(result, { ok: false, error: 'spectator-read-only' });
  assert.equal(messages(spec, 'error').at(-1).code, 'spectator-read-only');
  assert.equal(
    registry.relay({ id: 'ghost', room: registry.get('ABCD') }, { t: 'input' }).ok,
    false,
  );
});

test('hashes iguales no reportan; hashes divergentes emiten desync una sola vez', () => {
  const { registry, p1, p2, spec } = setup();
  const tick = HASH_INTERVAL;
  registry.relay(p1, { v: 1, t: 'hash', tick, value: `${tick}:1:aaa` });
  registry.relay(p2, { v: 1, t: 'hash', tick, value: `${tick}:1:aaa` });
  assert.equal(messages(spec, 'desync').length, 0);

  const next = tick * 2;
  registry.relay(p1, { v: 1, t: 'hash', tick: next, value: `${next}:2:aaa` });
  const result = registry.relay(p2, { v: 1, t: 'hash', tick: next, value: `${next}:2:bbb` });
  assert.equal(result.desync.tick, next);
  assert.deepEqual(
    result.desync.hashes.map((h) => h.from),
    ['p1', 'p2'],
  );
  registry.relay(p2, { v: 1, t: 'hash', tick: next, value: `${next}:2:ccc` });
  for (const client of [p1, p2, spec]) {
    assert.equal(messages(client, 'desync').length, 1);
    assert.equal(messages(client, 'desync')[0].v, 1);
  }
});

test('capacidad: 4 jugadores y espectadores ilimitados; sala se cierra al vaciarse', () => {
  const registry = new RoomRegistry();
  const clients = Array.from({ length: 5 }, (_, i) => makeClient(`j${i}`));
  for (const client of clients.slice(0, 4)) {
    assert.equal(registry.join('ROOM1', client, 'player').ok, true);
    client.room = registry.get('ROOM1');
  }
  const fifth = registry.join('ROOM1', clients[4], 'player');
  assert.deepEqual(fifth, { ok: false, error: 'room-full' });
  assert.equal(registry.join('ROOM1', makeClient('watch'), 'spectator').ok, true);

  for (const client of clients.slice(0, 4)) registry.leave(client);
  assert.equal(registry.get('ROOM1').hostId, null);
  registry.leave({ id: 'watch', room: registry.get('ROOM1') });
  assert.equal(registry.size, 0);
});

test('host se reasigna al irse; room vacía se elimina; generateCode es estable', () => {
  const room = new Room('CODE1', 1);
  const a = makeClient('a');
  const b = makeClient('b');
  room.join(a, 'player');
  room.join(b, 'player');
  room.leave('a');
  assert.equal(room.hostId, 'b');
  assert.equal(messages(b, 'peer-left').at(-1).id, 'a');
  room.leave('b');
  assert.equal(room.empty, true);
  assert.match(generateCode(), /^[A-HJ-NP-Z2-9]{6}$/);
});
