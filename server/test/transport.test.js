import assert from 'node:assert/strict';
import test from 'node:test';
import WebSocket from 'ws';
import { createRealtimeServer } from '../src/transport.js';

function waitFor(ws, predicate, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('timeout esperando mensaje'));
    }, timeoutMs);
    const onMessage = (raw) => {
      const message = JSON.parse(String(raw));
      if (predicate(message)) {
        cleanup();
        resolve(message);
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      ws.off('message', onMessage);
    };
    ws.on('message', onMessage);
  });
}

function open(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function send(ws, message) {
  ws.send(JSON.stringify(message));
}

function close(ws) {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) return resolve();
    ws.once('close', resolve);
    ws.close();
  });
}

test('relay real en puerto efímero: sala con 2 jugadores y 1 espectador', async (t) => {
  const server = createRealtimeServer({ host: '127.0.0.1', port: 0 });
  await new Promise((resolve, reject) => {
    server.wss.once('listening', resolve);
    server.wss.once('error', reject);
  });
  t.after(async () => {
    await server.close();
  });

  const url = `ws://127.0.0.1:${server.wss.address().port}`;
  const a = await open(url);
  const b = await open(url);
  const spectator = await open(url);
  t.after(() => close(a));
  t.after(() => close(b));
  t.after(() => close(spectator));

  const welcomeA = waitFor(a, (m) => m.t === 'welcome');
  const welcomeB = waitFor(b, (m) => m.t === 'welcome');
  const welcomeS = waitFor(spectator, (m) => m.t === 'welcome');
  send(a, { v: 1, t: 'hello', name: 'A' });
  send(b, { v: 1, t: 'hello', name: 'B' });
  send(spectator, { v: 1, t: 'hello', name: 'S' });
  const [wa, wb, ws] = await Promise.all([welcomeA, welcomeB, welcomeS]);
  assert.equal(wa.v, 1);
  assert.notEqual(wa.id, wb.id);
  assert.notEqual(wb.id, ws.id);

  const roster = (m) => m.t === 'joined' && m.players.length === 2 && m.spectators.length === 1;
  const joinedA = waitFor(a, roster);
  const joinedB = waitFor(b, roster);
  const joinedS = waitFor(spectator, roster);
  send(a, { v: 1, t: 'join', code: 'abcd' });
  send(b, { v: 1, t: 'join', code: 'ABCD' });
  send(spectator, { v: 1, t: 'join', code: 'ABCD', role: 'spectator' });
  const [ja, jb, js] = await Promise.all([joinedA, joinedB, joinedS]);
  assert.equal(ja.code, 'ABCD');
  assert.equal(ja.seed, jb.seed);
  assert.equal(jb.seed, js.seed);
  assert.equal(ja.hostId, wa.id);
  assert.deepEqual(
    ja.players.map((p) => p.id),
    [wa.id, wb.id],
  );
  assert.deepEqual(
    js.spectators.map((p) => p.id),
    [ws.id],
  );

  const inputToB = waitFor(b, (m) => m.t === 'input');
  const inputToS = waitFor(spectator, (m) => m.t === 'input');
  send(a, { v: 1, t: 'input', tick: 2, actions: ['p1Up'] });
  assert.deepEqual(await inputToB, { v: 1, t: 'input', from: wa.id, tick: 2, actions: ['p1Up'] });
  assert.deepEqual(await inputToS, { v: 1, t: 'input', from: wa.id, tick: 2, actions: ['p1Up'] });

  const specError = waitFor(spectator, (m) => m.t === 'error');
  send(spectator, { v: 1, t: 'input', tick: 3, actions: [] });
  assert.equal((await specError).code, 'spectator-read-only');

  const versionError = waitFor(a, (m) => m.t === 'error');
  send(a, { v: 2, t: 'input', tick: 3, actions: [] });
  assert.equal((await versionError).code, 'bad-version');
});
