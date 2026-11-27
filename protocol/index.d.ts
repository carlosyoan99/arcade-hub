/**
 * Declaraciones del contrato de mensajes v1 del relay online.
 * Equivalentes a los tipos que antes vivían en engine/src/net/protocol.ts.
 */

export declare const NET_VERSION: 1;
export declare const MAX_NAME_LENGTH: 24;
export declare const MAX_CODE_LENGTH: 8;
export declare const MAX_ACTIONS: 64;
export declare const MAX_ACTION_LENGTH: 32;
export declare const MAX_HASH_LENGTH: 128;
export declare const HASH_INTERVAL: 30;
export declare const MAX_PLAYERS_PER_ROOM: 4;

export declare class ProtocolError extends Error {
  readonly code: string;
  constructor(code: string, message: string);
}

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
  readonly actions: readonly string[];
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
  readonly actions: readonly string[];
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

export declare function parseClientMessage(raw: unknown): ClientMessage;
export declare function parseServerMessage(raw: unknown): ServerMessage;
export declare function encode(message: NetMessage): string;
export declare function parseClientText(text: string): ClientMessage;
export declare function parseServerText(text: string): ServerMessage;

/** Constructores de mensajes servidor→cliente (todos versionados). */
export declare function welcome(id: string): WelcomeMessage;
export declare function joined(info: {
  readonly code: string;
  readonly id: string;
  readonly hostId: string;
  readonly seed: number;
  readonly players: readonly PlayerInfo[];
  readonly spectators: readonly PlayerInfo[];
}): JoinedMessage;
export declare function peerJoined(client: PlayerInfo): PeerJoinedMessage;
export declare function peerLeft(id: string): PeerLeftMessage;
export declare function relayedInput(
  from: string,
  tick: number,
  actions: readonly string[],
): RelayedInputMessage;
export declare function relayedHash(from: string, tick: number, value: string): RelayedHashMessage;
export declare function errorMessage(code: string, message: string): ErrorMessage;
export declare function desyncMessage(tick: number, hashes: readonly HashEntry[]): DesyncMessage;
