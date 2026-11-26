/**
 * Capa de sala: registro de salas por código, relay y detección de desync.
 * No conoce WebSocket: un cliente es cualquier { id, name, role, send(message) }.
 */
import { randomBytes, randomInt } from 'node:crypto';
import {
  HASH_INTERVAL,
  MAX_PLAYERS_PER_ROOM,
  desyncMessage,
  errorMessage,
  joined,
  peerJoined,
  peerLeft,
  relayedHash,
  relayedInput,
} from './protocol.js';

export class Room {
  constructor(code, seed) {
    this.code = code;
    this.seed = seed >>> 0;
    /** @type {Map<string, {id:string,name:string,role:string,send:(m:object)=>void}>} */
    this.members = new Map();
    this.hostId = null;
    /** @type {Map<number, Map<string, string>>} */
    this.hashes = new Map();
    /** @type {Set<number>} */
    this.reported = new Set();
  }

  get players() {
    return [...this.members.values()].filter((client) => client.role === 'player');
  }

  get spectators() {
    return [...this.members.values()].filter((client) => client.role === 'spectator');
  }

  get empty() {
    return this.members.size === 0;
  }

  broadcast(message, exceptId) {
    for (const [id, client] of this.members) {
      if (id !== exceptId) client.send(message);
    }
  }

  snapshotFor(id) {
    return joined({
      code: this.code,
      id,
      hostId: this.hostId,
      seed: this.seed,
      players: this.players,
      spectators: this.spectators,
    });
  }

  broadcastSnapshot() {
    for (const [id, client] of this.members) client.send(this.snapshotFor(id));
  }

  join(client, role) {
    if (this.members.has(client.id)) return { ok: false, error: 'already-in-room' };
    if (role === 'player' && this.players.length >= MAX_PLAYERS_PER_ROOM) {
      return { ok: false, error: 'room-full' };
    }
    client.role = role;
    this.members.set(client.id, client);
    if (this.hostId === null && role === 'player') this.hostId = client.id;
    this.broadcast(peerJoined(client), client.id);
    this.broadcastSnapshot();
    return { ok: true, room: this };
  }

  leave(id) {
    if (!this.members.delete(id)) return false;
    for (const byPlayer of this.hashes.values()) byPlayer.delete(id);
    if (this.hostId === id) this.hostId = this.players[0]?.id ?? null;
    this.broadcast(peerLeft(id));
    if (!this.empty) this.broadcastSnapshot();
    return true;
  }

  /** Relaya input/hash a los demás miembros (jugadores y espectadores). */
  relay(client, message) {
    if (!this.members.has(client.id)) return { ok: false, error: 'not-in-room' };
    if (client.role === 'spectator') {
      client.send(errorMessage('spectator-read-only', 'un espectador no envía inputs ni hashes'));
      return { ok: false, error: 'spectator-read-only' };
    }
    if (message.t === 'input') {
      this.broadcast(relayedInput(client.id, message.tick, message.actions), client.id);
      return { ok: true };
    }
    if (message.t === 'hash') {
      this.broadcast(relayedHash(client.id, message.tick, message.value), client.id);
      return { ok: true, desync: this.recordHash(client.id, message.tick, message.value) };
    }
    return { ok: false, error: 'not-relayable' };
  }

  recordHash(fromId, tick, value) {
    let byPlayer = this.hashes.get(tick);
    if (byPlayer === undefined) {
      byPlayer = new Map();
      this.hashes.set(tick, byPlayer);
    }
    byPlayer.set(fromId, value);
    for (const oldTick of this.hashes.keys()) {
      if (oldTick < tick - 2 * HASH_INTERVAL) this.hashes.delete(oldTick);
    }
    for (const oldTick of this.reported) {
      if (oldTick < tick - 2 * HASH_INTERVAL) this.reported.delete(oldTick);
    }
    return this.checkDesync(tick);
  }

  /** Compara hashes cada HASH_INTERVAL ticks; informa si dos jugadores difieren. */
  checkDesync(tick) {
    if (tick <= 0 || tick % HASH_INTERVAL !== 0 || this.reported.has(tick)) return undefined;
    const byPlayer = this.hashes.get(tick);
    if (byPlayer === undefined) return undefined;
    const entries = [...byPlayer.entries()]
      .filter(([id]) => this.members.get(id)?.role === 'player')
      .sort(([a], [b]) => a.localeCompare(b));
    if (new Set(entries.map(([, value]) => value)).size < 2) return undefined;
    const hashes = entries.map(([from, value]) => ({ from, value }));
    this.reported.add(tick);
    this.broadcast(desyncMessage(tick, hashes));
    return { tick, hashes };
  }
}

export class RoomRegistry {
  constructor(options = {}) {
    this.rooms = new Map();
    this.seedFactory = options.seedFactory ?? (() => randomBytes(4).readUInt32BE(0));
  }

  get size() {
    return this.rooms.size;
  }

  get(code) {
    return this.rooms.get(code);
  }

  join(code, client, role) {
    let room = this.rooms.get(code);
    if (room === undefined) {
      room = new Room(code, this.seedFactory());
      this.rooms.set(code, room);
    }
    const result = room.join(client, role);
    if (!result.ok && room.empty) this.rooms.delete(code);
    return result;
  }

  leave(client) {
    const room = client?.room;
    if (room === undefined) return false;
    client.room = undefined;
    const left = room.leave(client.id);
    if (room.empty) this.rooms.delete(room.code);
    return left;
  }

  relay(client, message) {
    if (client?.room === undefined) return { ok: false, error: 'not-in-room' };
    return client.room.relay(client, message);
  }

  closeAll() {
    this.rooms.clear();
  }
}

export function generateCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[randomInt(alphabet.length)];
  return code;
}
