/**
 * Contrato de mensajes v1 del relay online. Validadores manuales, sin dependencias.
 * Espejo de server/src/protocol.js; mantener ambos en sincronía.
 * Este módulo no importa render/audio/ui/DOM: solo tipos del motor.
 */
import type { InputFrame } from '../input/virtual.js';

export const NET_VERSION = 1 as const;
export const MAX_NAME_LENGTH = 24;
export const MAX_CODE_LENGTH = 8;
export const MAX_ACTIONS = 64;
export const MAX_ACTION_LENGTH = 32;
export const MAX_HASH_LENGTH = 128;
export const HASH_INTERVAL = 30;

const ACTION_RE = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/;
const CODE_RE = /^[A-Z0-9]{4,8}$/;
const HASH_RE = /^[A-Za-z0-9:._-]{1,128}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export type Role = 'player' | 'spectator';

export interface PlayerInfo {
  readonly id: string;
  readonly name: string;
  readonly role: Role;
}

export interface HelloMessage {
  readonly v: 1;
  readonly t: 'hello';
  readonly name: string;
}

export interface JoinMessage {
  readonly v: 1;
  readonly t: 'join';
  readonly code: string;
  readonly role?: Role;
}

export interface InputMessage {
  readonly v: 1;
  readonly t: 'input';
  readonly tick: number;
  readonly actions: InputFrame;
}

export interface HashMessage {
  readonly v: 1;
  readonly t: 'hash';
  readonly tick: number;
  readonly value: string;
}

export interface LeftMessage {
  readonly v: 1;
  readonly t: 'left';
}

export type ClientMessage = HelloMessage | JoinMessage | InputMessage | HashMessage | LeftMessage;

export interface WelcomeMessage {
  readonly v: 1;
  readonly t: 'welcome';
  readonly id: string;
}

export interface JoinedMessage {
  readonly v: 1;
  readonly t: 'joined';
  readonly code: string;
  readonly id: string;
  readonly hostId: string;
  readonly seed: number;
  readonly players: readonly PlayerInfo[];
  readonly spectators: readonly PlayerInfo[];
}

export interface PeerJoinedMessage {
  readonly v: 1;
  readonly t: 'peer-joined';
  readonly player: PlayerInfo;
}

export interface PeerLeftMessage {
  readonly v: 1;
  readonly t: 'peer-left';
  readonly id: string;
}

export interface RelayedInputMessage {
  readonly v: 1;
  readonly t: 'input';
  readonly from: string;
  readonly tick: number;
  readonly actions: InputFrame;
}

export interface HashEntry {
  readonly from: string;
  readonly value: string;
}

export interface RelayedHashMessage {
  readonly v: 1;
  readonly t: 'hash';
  readonly from: string;
  readonly tick: number;
  readonly value: string;
}

export interface DesyncMessage {
  readonly v: 1;
  readonly t: 'desync';
  readonly tick: number;
  readonly hashes: readonly HashEntry[];
}

export interface ErrorMessage {
  readonly v: 1;
  readonly t: 'error';
  readonly code: string;
  readonly message: string;
}

export type ServerMessage =
  | WelcomeMessage
  | JoinedMessage
  | PeerJoinedMessage
  | PeerLeftMessage
  | RelayedInputMessage
  | RelayedHashMessage
  | DesyncMessage
  | ErrorMessage;

export type NetMessage = ClientMessage | ServerMessage;

export class ProtocolError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ProtocolError';
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new ProtocolError(code, message);
}

function hasControlChars(text: string): boolean {
  for (const char of text) {
    const point = char.charCodeAt(0);
    if (point < 0x20 || point === 0x7f) return true;
  }
  return false;
}

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail('bad-envelope', `${where}: se esperaba un objeto`);
  }
  return value as Record<string, unknown>;
}

function readString(obj: Record<string, unknown>, key: string, max: number): string {
  const value = obj[key];
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > max ||
    hasControlChars(value)
  ) {
    return fail(`bad-${key}`, `${key} debe ser una cadena de 1..${max} caracteres imprimibles`);
  }
  return value;
}

function readTick(obj: Record<string, unknown>): number {
  const value = obj['tick'];
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return fail('bad-tick', 'tick debe ser un entero seguro >= 0');
  }
  return value as number;
}

function readActions(obj: Record<string, unknown>): InputFrame {
  const value = obj['actions'];
  if (!Array.isArray(value) || value.length > MAX_ACTIONS) {
    return fail('bad-actions', `actions debe ser un array de hasta ${MAX_ACTIONS} acciones`);
  }
  const result: string[] = [];
  const seen = new Set<string>();
  for (const action of value) {
    if (typeof action !== 'string' || !ACTION_RE.test(action) || seen.has(action)) {
      return fail('bad-actions', 'cada acción debe ser un nombre único de hasta 32 caracteres');
    }
    seen.add(action);
    result.push(action);
  }
  return result;
}

function readRole(obj: Record<string, unknown>): Role {
  const value = obj['role'];
  if (value === undefined) return 'player';
  if (value !== 'player' && value !== 'spectator') {
    return fail('bad-role', 'role debe ser "player" o "spectator"');
  }
  return value;
}

function readId(value: unknown): string {
  if (typeof value !== 'string' || !ID_RE.test(value)) return fail('bad-id', 'id malformado');
  return value;
}

function readPlayerInfo(value: unknown): PlayerInfo {
  const obj = asRecord(value, 'player');
  return {
    id: readId(obj['id']),
    name: readString(obj, 'name', MAX_NAME_LENGTH),
    role: readRole(obj),
  };
}

function readPlayerList(value: unknown): readonly PlayerInfo[] {
  if (!Array.isArray(value)) return fail('bad-players', 'players debe ser un array');
  return value.map(readPlayerInfo);
}

function readHashValue(value: unknown): string {
  if (typeof value !== 'string' || !HASH_RE.test(value)) {
    return fail('bad-hash', 'value no es un hash válido');
  }
  return value;
}

function readHashes(value: unknown): readonly HashEntry[] {
  if (!Array.isArray(value)) return fail('bad-hashes', 'hashes debe ser un array');
  return value.map((entry) => {
    const obj = asRecord(entry, 'hash');
    return { from: readId(obj['from']), value: readHashValue(obj['value']) };
  });
}

function checkVersion(obj: Record<string, unknown>): void {
  if (obj['v'] !== NET_VERSION) {
    fail('bad-version', `versión esperada ${NET_VERSION}, recibida ${String(obj['v'])}`);
  }
}

/** Valida y sanea un mensaje cliente→servidor; devuelve solo campos conocidos. */
export function parseClientMessage(raw: unknown): ClientMessage {
  const obj = asRecord(raw, 'mensaje');
  checkVersion(obj);

  switch (obj['t']) {
    case 'hello':
      return { v: NET_VERSION, t: 'hello', name: readString(obj, 'name', MAX_NAME_LENGTH) };
    case 'join': {
      const code = readString(obj, 'code', MAX_CODE_LENGTH).toUpperCase();
      if (!CODE_RE.test(code)) {
        return fail('bad-code', 'code debe tener 4..8 caracteres alfanuméricos');
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
      if (!HASH_RE.test(value)) return fail('bad-hash', 'value no es un hash válido');
      return { v: NET_VERSION, t: 'hash', tick: readTick(obj), value };
    }
    case 'left':
      return { v: NET_VERSION, t: 'left' };
    default:
      return fail('unknown-type', `tipo de mensaje desconocido: ${String(obj['t'])}`);
  }
}

/** Valida y sanea un mensaje servidor→cliente. */
export function parseServerMessage(raw: unknown): ServerMessage {
  const obj = asRecord(raw, 'mensaje');
  checkVersion(obj);

  switch (obj['t']) {
    case 'welcome':
      return { v: NET_VERSION, t: 'welcome', id: readId(obj['id']) };
    case 'joined':
      return {
        v: NET_VERSION,
        t: 'joined',
        code: readString(obj, 'code', MAX_CODE_LENGTH),
        id: readId(obj['id']),
        hostId: readId(obj['hostId']),
        seed: Number(obj['seed']) >>> 0,
        players: readPlayerList(obj['players']),
        spectators: readPlayerList(obj['spectators']),
      };
    case 'peer-joined':
      return { v: NET_VERSION, t: 'peer-joined', player: readPlayerInfo(obj['player']) };
    case 'peer-left':
      return { v: NET_VERSION, t: 'peer-left', id: readId(obj['id']) };
    case 'input':
      return {
        v: NET_VERSION,
        t: 'input',
        from: readId(obj['from']),
        tick: readTick(obj),
        actions: readActions(obj),
      };
    case 'hash':
      return {
        v: NET_VERSION,
        t: 'hash',
        from: readId(obj['from']),
        tick: readTick(obj),
        value: readHashValue(obj['value']),
      };
    case 'desync':
      return {
        v: NET_VERSION,
        t: 'desync',
        tick: readTick(obj),
        hashes: readHashes(obj['hashes']),
      };
    case 'error':
      return {
        v: NET_VERSION,
        t: 'error',
        code: readString(obj, 'code', 32),
        message: readString(obj, 'message', 256),
      };
    default:
      return fail('unknown-type', `tipo de mensaje desconocido: ${String(obj['t'])}`);
  }
}

export function encode(message: NetMessage): string {
  return JSON.stringify(message);
}

export function parseClientText(text: string): ClientMessage {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return fail('bad-json', 'el mensaje no es JSON válido');
  }
  return parseClientMessage(raw);
}

export function parseServerText(text: string): ServerMessage {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return fail('bad-json', 'el mensaje no es JSON válido');
  }
  return parseServerMessage(raw);
}
