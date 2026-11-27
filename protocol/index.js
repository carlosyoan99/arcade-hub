/**
 * Contrato de mensajes v1 del relay online.
 * Validación manual en la frontera del socket/transporte: sin Zod, sin dependencias.
 * Única fuente de verdad: engine (TypeScript) y servidor (Node) importan este módulo.
 */

export const NET_VERSION = 1;
export const MAX_NAME_LENGTH = 24;
export const MAX_CODE_LENGTH = 8;
export const MAX_ACTIONS = 64;
export const MAX_ACTION_LENGTH = 32;
export const MAX_HASH_LENGTH = 128;
export const HASH_INTERVAL = 30;
export const MAX_PLAYERS_PER_ROOM = 4;

const ACTION_RE = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/;
const CODE_RE = /^[A-Z0-9]{4,8}$/;
const HASH_RE = /^[A-Za-z0-9:._-]{1,128}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export class ProtocolError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ProtocolError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ProtocolError(code, message);
}

function hasControlChars(text) {
  for (const char of text) {
    const point = char.charCodeAt(0);
    if (point < 0x20 || point === 0x7f) return true;
  }
  return false;
}

function asRecord(value, where) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail('bad-envelope', `${where}: se esperaba un objeto`);
  }
  return value;
}

function readString(obj, key, max) {
  const value = obj[key];
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > max ||
    hasControlChars(value)
  ) {
    fail(`bad-${key}`, `${key} debe ser una cadena de 1..${max} caracteres imprimibles`);
  }
  return value;
}

function readTick(obj) {
  const value = obj.tick;
  if (!Number.isSafeInteger(value) || value < 0) {
    fail('bad-tick', 'tick debe ser un entero seguro >= 0');
  }
  return value;
}

function readActions(obj) {
  const value = obj.actions;
  if (!Array.isArray(value) || value.length > MAX_ACTIONS) {
    fail('bad-actions', `actions debe ser un array de hasta ${MAX_ACTIONS} acciones`);
  }
  const result = [];
  const seen = new Set();
  for (const action of value) {
    if (typeof action !== 'string' || !ACTION_RE.test(action) || seen.has(action)) {
      fail('bad-actions', 'cada acción debe ser un nombre único de hasta 32 caracteres');
    }
    seen.add(action);
    result.push(action);
  }
  return result;
}

function readRole(obj) {
  const value = obj.role;
  if (value === undefined) return 'player';
  if (value !== 'player' && value !== 'spectator') {
    fail('bad-role', 'role debe ser "player" o "spectator"');
  }
  return value;
}

function readId(value) {
  if (typeof value !== 'string' || !ID_RE.test(value)) {
    fail('bad-id', 'id malformado');
  }
  return value;
}

function readPlayerInfo(value) {
  const obj = asRecord(value, 'player');
  return {
    id: readId(obj.id),
    name: readString(obj, 'name', MAX_NAME_LENGTH),
    role: readRole(obj),
  };
}

function readPlayerList(value) {
  if (!Array.isArray(value)) fail('bad-players', 'players debe ser un array');
  return value.map(readPlayerInfo);
}

function readHashValue(value) {
  if (typeof value !== 'string' || !HASH_RE.test(value)) {
    fail('bad-hash', 'value no es un hash válido');
  }
  return value;
}

function readHashes(value) {
  if (!Array.isArray(value)) fail('bad-hashes', 'hashes debe ser un array');
  return value.map((entry) => {
    const obj = asRecord(entry, 'hash');
    return { from: readId(obj.from), value: readHashValue(obj.value) };
  });
}

function checkVersion(obj) {
  if (obj.v !== NET_VERSION) {
    fail('bad-version', `versión esperada ${NET_VERSION}, recibida ${String(obj.v)}`);
  }
}

/** Valida y sanea un mensaje cliente→servidor; devuelve solo campos conocidos. */
export function parseClientMessage(raw) {
  const obj = asRecord(raw, 'mensaje');
  checkVersion(obj);

  switch (obj.t) {
    case 'hello':
      return { v: NET_VERSION, t: 'hello', name: readString(obj, 'name', MAX_NAME_LENGTH) };
    case 'join': {
      const code = readString(obj, 'code', MAX_CODE_LENGTH).toUpperCase();
      if (!CODE_RE.test(code)) {
        fail('bad-code', 'code debe tener 4..8 caracteres alfanuméricos');
      }
      return { v: NET_VERSION, t: 'join', code, role: readRole(obj) };
    }
    case 'input':
      return {
        v: NET_VERSION,
        t: 'input',
        tick: readTick(obj),
        actions: readActions(obj),
      };
    case 'hash': {
      const value = readString(obj, 'value', MAX_HASH_LENGTH);
      if (!HASH_RE.test(value)) fail('bad-hash', 'value no es un hash válido');
      return { v: NET_VERSION, t: 'hash', tick: readTick(obj), value };
    }
    case 'left':
      return { v: NET_VERSION, t: 'left' };
    default:
      fail('unknown-type', `tipo de mensaje desconocido: ${String(obj.t)}`);
  }
}

/** Valida y sanea un mensaje servidor→cliente. */
export function parseServerMessage(raw) {
  const obj = asRecord(raw, 'mensaje');
  checkVersion(obj);

  switch (obj.t) {
    case 'welcome':
      return { v: NET_VERSION, t: 'welcome', id: readId(obj.id) };
    case 'joined':
      return {
        v: NET_VERSION,
        t: 'joined',
        code: readString(obj, 'code', MAX_CODE_LENGTH),
        id: readId(obj.id),
        hostId: readId(obj.hostId),
        seed: Number(obj.seed) >>> 0,
        players: readPlayerList(obj.players),
        spectators: readPlayerList(obj.spectators),
      };
    case 'peer-joined':
      return { v: NET_VERSION, t: 'peer-joined', player: readPlayerInfo(obj.player) };
    case 'peer-left':
      return { v: NET_VERSION, t: 'peer-left', id: readId(obj.id) };
    case 'input':
      return {
        v: NET_VERSION,
        t: 'input',
        from: readId(obj.from),
        tick: readTick(obj),
        actions: readActions(obj),
      };
    case 'hash':
      return {
        v: NET_VERSION,
        t: 'hash',
        from: readId(obj.from),
        tick: readTick(obj),
        value: readHashValue(obj.value),
      };
    case 'desync':
      return {
        v: NET_VERSION,
        t: 'desync',
        tick: readTick(obj),
        hashes: readHashes(obj.hashes),
      };
    case 'error':
      return {
        v: NET_VERSION,
        t: 'error',
        code: readString(obj, 'code', 32),
        message: readString(obj, 'message', 256),
      };
    default:
      fail('unknown-type', `tipo de mensaje desconocido: ${String(obj.t)}`);
  }
}

export function encode(message) {
  return JSON.stringify(message);
}

/** Parsea texto entrante; convierte JSON roto en ProtocolError. */
export function parseClientText(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    fail('bad-json', 'el mensaje no es JSON válido');
  }
  return parseClientMessage(raw);
}

export function parseServerText(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    fail('bad-json', 'el mensaje no es JSON válido');
  }
  return parseServerMessage(raw);
}

// --- Constructores de mensajes servidor→cliente (todos versionados) ---

export function welcome(id) {
  return { v: NET_VERSION, t: 'welcome', id: readId(id) };
}

function toInfo(client) {
  return { id: client.id, name: client.name, role: client.role };
}

export function joined({ code, id, hostId, seed, players, spectators }) {
  return {
    v: NET_VERSION,
    t: 'joined',
    code,
    id,
    hostId,
    seed: seed >>> 0,
    players: players.map(toInfo),
    spectators: spectators.map(toInfo),
  };
}

export function peerJoined(client) {
  return { v: NET_VERSION, t: 'peer-joined', player: toInfo(client) };
}

export function peerLeft(id) {
  return { v: NET_VERSION, t: 'peer-left', id };
}

export function relayedInput(from, tick, actions) {
  return { v: NET_VERSION, t: 'input', from, tick, actions };
}

export function relayedHash(from, tick, value) {
  return { v: NET_VERSION, t: 'hash', from, tick, value };
}

export function errorMessage(code, message) {
  return { v: NET_VERSION, t: 'error', code, message };
}

export function desyncMessage(tick, hashes) {
  return { v: NET_VERSION, t: 'desync', tick, hashes };
}
