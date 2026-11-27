import { expect, test } from '@playwright/test';

// Espejo de engine/src/net/protocol.ts y server/src/protocol.js (v1).
const V = 1;
const TICKS = 600;
const HASH_INTERVAL = 30;
const HASH_VALUE = '600:3336926330:e22d095e-20';
const ROOM_CODE = 'E2E426';
const RELAY_URL = `ws://127.0.0.1:${process.env.ARCADE_PORT ?? '8787'}`;

const actionsFor = (tick) => (tick % 3 === 0 ? ['up'] : tick % 3 === 1 ? ['down'] : []);

/** Abre un WebSocket real desde la página y captura sus tramas con la API de Playwright. */
async function connect(page) {
  // El evento se arma antes de crear el socket para no perder ninguna trama.
  const socketReady = page.waitForEvent('websocket');
  await page.evaluate((url) => {
    window.__arcadeSocket = new WebSocket(url);
  }, RELAY_URL);

  const socket = await socketReady;
  const frames = [];
  socket.on('framereceived', (frame) => frames.push(String(frame.payload)));

  await page.waitForFunction(() => window.__arcadeSocket?.readyState === 1);
  const messages = () => frames.map((payload) => JSON.parse(payload));
  const send = (message) =>
    page.evaluate((raw) => window.__arcadeSocket.send(raw), JSON.stringify(message));

  return { socket, frames, messages, send };
}

function lastOf(client, type) {
  const found = client.messages().filter((message) => message.t === type);
  return found.at(-1);
}

test('dos clientes relayan 600 ticks idénticos sin desync', async ({ page, context }) => {
  const second = await context.newPage();
  await page.goto('/');
  await second.goto('/');

  const a = await connect(page);
  const b = await connect(second);

  // hello → welcome
  await a.send({ v: V, t: 'hello', name: 'E2E-A' });
  await b.send({ v: V, t: 'hello', name: 'E2E-B' });
  await expect.poll(() => lastOf(a, 'welcome')?.id).toBeTruthy();
  await expect.poll(() => lastOf(b, 'welcome')?.id).toBeTruthy();

  const idA = lastOf(a, 'welcome')?.id;
  const idB = lastOf(b, 'welcome')?.id;
  expect(idA).toBeTruthy();
  expect(idB).toBeTruthy();
  expect(idA).not.toBe(idB);

  // join → joined (la sala comparte semilla y host)
  await Promise.all([
    a.send({ v: V, t: 'join', code: ROOM_CODE, role: 'player' }),
    b.send({ v: V, t: 'join', code: ROOM_CODE, role: 'player' }),
  ]);
  const joinedFor = (client) =>
    client.messages().filter((message) => message.t === 'joined' && message.players.length === 2).at(-1);
  await expect.poll(() => joinedFor(a)).toBeTruthy();
  await expect.poll(() => joinedFor(b)).toBeTruthy();

  const joinedA = joinedFor(a);
  const joinedB = joinedFor(b);
  expect(joinedA).toMatchObject({ v: V, t: 'joined', code: ROOM_CODE });
  expect(typeof joinedA.hostId).toBe('string');
  expect(joinedB).toMatchObject({ v: V, t: 'joined', code: ROOM_CODE, hostId: joinedA.hostId });
  expect(joinedB.seed).toBe(joinedA.seed);

  // 600 ticks de input por cliente + hashes coincidentes cada 30 ticks.
  // Un único evaluate por cliente: la página envía la cinta completa de una vez.
  const tape = Array.from({ length: TICKS }, (_, tick) => actionsFor(tick));
  const sendTape = (pageUnderTest) =>
    pageUnderTest.evaluate(
      ({ actions, interval, value }) => {
        const socket = window.__arcadeSocket;
        for (let tick = 0; tick < actions.length; tick++) {
          socket.send(JSON.stringify({ v: 1, t: 'input', tick, actions: actions[tick] }));
          if (tick > 0 && tick % interval === 0) {
            socket.send(JSON.stringify({ v: 1, t: 'hash', tick, value }));
          }
        }
      },
      { actions: tape, interval: HASH_INTERVAL, value: HASH_VALUE },
    );
  await Promise.all([sendTape(page), sendTape(second)]);

  // Cada cliente recibe la cinta del otro (el relay excluye al emisor).
  const relayFrom = (client, from) =>
    client
      .messages()
      .filter((message) => message.t === 'input' && message.from === from)
      .map(({ tick, actions }) => ({ tick, actions }));

  await expect.poll(() => relayFrom(a, idB).length, { timeout: 30_000 }).toBe(TICKS);
  await expect.poll(() => relayFrom(b, idA).length, { timeout: 30_000 }).toBe(TICKS);

  const tapeA = relayFrom(a, idB);
  const tapeB = relayFrom(b, idA);
  expect(tapeA).toEqual(tapeB);
  expect(tapeA[0]).toEqual({ tick: 0, actions: ['up'] });
  expect(tapeA.at(-1)).toEqual({ tick: TICKS - 1, actions: [] });

  // Los hashes también se relayan y son idénticos; nadie reporta desync.
  const hashesFrom = (client, from) =>
    client.messages().filter((message) => message.t === 'hash' && message.from === from);
  await expect.poll(() => hashesFrom(a, idB).length, { timeout: 30_000 }).toBe(19);
  await expect.poll(() => hashesFrom(b, idA).length, { timeout: 30_000 }).toBe(19);
  expect(hashesFrom(a, idB).map(({ tick, value }) => ({ tick, value }))).toEqual(
    hashesFrom(b, idA).map(({ tick, value }) => ({ tick, value })),
  );

  const desyncs = (client) => client.messages().filter((message) => message.t === 'desync');
  expect(desyncs(a)).toEqual([]);
  expect(desyncs(b)).toEqual([]);
  expect(a.frames.some((payload) => payload.includes('"t":"error"'))).toBe(false);
  expect(b.frames.some((payload) => payload.includes('"t":"error"'))).toBe(false);

  await Promise.all([
    page.evaluate(() => window.__arcadeSocket.close()),
    second.evaluate(() => window.__arcadeSocket.close()),
  ]);
});
