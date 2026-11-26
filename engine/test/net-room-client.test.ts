import { describe, expect, it } from 'vitest';
import type { InputFrame } from '../src/input/virtual.js';
import type {
  ErrorMessage,
  JoinedMessage,
  PlayerInfo,
  ServerMessage,
} from '../src/net/protocol.js';
import { createRoomClient, type NetSocket, type RoomClient } from '../src/net/room-client.js';
import type { DesyncReport } from '../src/net/lockstep.js';

class MockSocket implements NetSocket {
  readonly sent: string[] = [];
  closed = false;
  private listener: ((event: { data: unknown }) => void) | undefined;

  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.closed = true;
  }
  addEventListener(_type: 'message', listener: (event: { data: unknown }) => void): void {
    this.listener = listener;
  }
  removeEventListener(): void {
    this.listener = undefined;
  }
  deliver(message: ServerMessage): void {
    this.listener?.({ data: message });
  }
  messages(): Record<string, unknown>[] {
    return this.sent.map((text) => JSON.parse(text) as Record<string, unknown>);
  }
}

interface Peer {
  readonly socket: MockSocket;
  readonly client: RoomClient;
  readonly errors: ErrorMessage[];
  readonly desyncs: DesyncReport[];
  readonly joinedEvents: JoinedMessage[];
}

const P1: PlayerInfo = { id: 'p1', name: 'A', role: 'player' };
const P2: PlayerInfo = { id: 'p2', name: 'B', role: 'player' };
const SPEC: PlayerInfo = { id: 's1', name: 'S', role: 'spectator' };

function makePeer(id: string, role: 'player' | 'spectator' = 'player'): Peer {
  const socket = new MockSocket();
  const errors: ErrorMessage[] = [];
  const desyncs: DesyncReport[] = [];
  const joinedEvents: JoinedMessage[] = [];
  const client = createRoomClient({
    socket,
    name: id,
    code: 'abcd',
    ...(role === 'spectator' ? { role } : {}),
    hashInterval: 10,
    onError: (error) => errors.push(error),
    onDesync: (report) => desyncs.push(report),
    onJoined: (message) => joinedEvents.push(message),
  });
  return { socket, client, errors, desyncs, joinedEvents };
}

function joinedMessage(id: string): JoinedMessage {
  return {
    v: 1,
    t: 'joined',
    code: 'ABCD',
    id,
    hostId: 'p1',
    seed: 12345,
    players: [P1, P2],
    spectators: [SPEC],
  };
}

function connect(peer: Peer, id: string): void {
  peer.client.hello();
  peer.socket.deliver({ v: 1, t: 'welcome', id });
  peer.socket.deliver(joinedMessage(id));
  expect(peer.client.state).toBe('joined');
}

describe('net/room-client — sala con 2 jugadores y espectador', () => {
  it('handshake automático y roster compartido', () => {
    const a = makePeer('p1');
    connect(a, 'p1');
    expect(a.socket.messages()[0]).toEqual({ v: 1, t: 'hello', name: 'p1' });
    expect(a.socket.messages()[1]).toEqual({ v: 1, t: 'join', code: 'ABCD' });
    expect(a.joinedEvents).toHaveLength(1);
    expect(a.joinedEvents[0]?.seed).toBe(12345);
    expect(a.client.id).toBe('p1');
    expect(a.client.joined?.players.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(a.client.joined?.spectators.map((p) => p.id)).toEqual(['s1']);
    expect(a.client.lockstep?.players()).toEqual(['p1', 'p2']);
  });

  it('los dos jugadores aportan inputs y el espectador solo observa la cinta', () => {
    const a = makePeer('p1');
    const b = makePeer('p2');
    const spec = makePeer('s1', 'spectator');
    connect(a, 'p1');
    connect(b, 'p2');
    connect(spec, 's1');

    expect(a.client.submitInput(0, ['p1Up'])).toBe(2);
    expect(b.client.submitInput(0, ['p2Down'])).toBe(2);
    const fromA = a.socket.messages().at(-1);
    const fromB = b.socket.messages().at(-1);
    expect(fromA).toEqual({ v: 1, t: 'input', tick: 2, actions: ['p1Up'] });
    expect(fromB).toEqual({ v: 1, t: 'input', tick: 2, actions: ['p2Down'] });

    const relayedA: ServerMessage = { v: 1, t: 'input', from: 'p1', tick: 2, actions: ['p1Up'] };
    const relayedB: ServerMessage = { v: 1, t: 'input', from: 'p2', tick: 2, actions: ['p2Down'] };
    for (const peer of [b, spec]) peer.socket.deliver(relayedA);
    for (const peer of [a, spec]) peer.socket.deliver(relayedB);

    const tape = (frame: InputFrame | undefined): InputFrame => frame ?? [];
    expect(tape(b.client.lockstep?.advance(2))).toEqual(['p1Up', 'p2Down']);
    expect(tape(a.client.lockstep?.advance(2))).toEqual(['p1Up', 'p2Down']);
    expect(tape(spec.client.lockstep?.advance(2))).toEqual(['p1Up', 'p2Down']);

    const sentBefore = spec.socket.sent.length;
    expect(spec.client.submitInput(0, ['p1Up'])).toBeUndefined();
    expect(spec.socket.sent).toHaveLength(sentBefore);
  });

  it('intercambio de hashes detecta desync en ambos jugadores', () => {
    const a = makePeer('p1');
    const b = makePeer('p2');
    connect(a, 'p1');
    connect(b, 'p2');

    a.client.recordHash(10, '10:1:aaa');
    b.socket.deliver({ v: 1, t: 'hash', from: 'p1', tick: 10, value: '10:1:aaa' });
    b.client.recordHash(10, '10:1:bbb');
    expect(b.desyncs).toHaveLength(1);
    expect(b.desyncs[0]?.hashes).toEqual([
      { from: 'p1', value: '10:1:aaa' },
      { from: 'p2', value: '10:1:bbb' },
    ]);

    a.socket.deliver({ v: 1, t: 'hash', from: 'p2', tick: 10, value: '10:1:bbb' });
    expect(a.desyncs).toHaveLength(1);
    expect(a.desyncs[0]?.tick).toBe(10);
    expect(a.socket.messages().at(-1)).toEqual({ v: 1, t: 'hash', tick: 10, value: '10:1:aaa' });
  });

  it('un mensaje malformado se reporta y no cambia el estado', () => {
    const a = makePeer('p1');
    expect(a.client.handleMessage({ v: 2, t: 'welcome', id: 'p1' })).toBeUndefined();
    expect(a.errors[0]?.code).toBe('bad-version');
    expect(a.client.state).toBe('idle');
    expect(a.client.id).toBeUndefined();

    connect(a, 'p1');
    a.socket.deliver({ v: 1, t: 'peer-left', id: 'p2' });
    expect(a.client.joined?.players.map((p) => p.id)).toEqual(['p1']);
    a.client.leave();
    expect(a.socket.messages().at(-1)).toEqual({ v: 1, t: 'left' });
    expect(a.socket.closed).toBe(true);
    expect(a.client.state).toBe('closed');
  });
});
