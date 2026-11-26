/**
 * Adaptador de sala sobre un socket inyectado. No referencia WebSocket global:
 * funciona con un WebSocket del navegador, un socket de `ws` o un mock en Node.
 */
import type { InputFrame } from '../input/virtual.js';
import {
  NET_VERSION,
  ProtocolError,
  encode,
  parseServerMessage,
  type ClientMessage,
  type ErrorMessage,
  type JoinedMessage,
  type PlayerInfo,
  type ServerMessage,
} from './protocol.js';
import { createLockstep, type DesyncReport, type LockstepController } from './lockstep.js';

export interface NetSocket {
  send(data: string): void;
  close(): void;
  addEventListener?(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener?(type: 'message', listener: (event: { data: unknown }) => void): void;
  on?(event: 'message', listener: (data: unknown) => void): void;
  off?(event: 'message', listener: (data: unknown) => void): void;
}

export type RoomClientState = 'idle' | 'hello' | 'joining' | 'joined' | 'closed';

export interface RoomClientConfig {
  readonly socket: NetSocket;
  readonly name: string;
  readonly code: string;
  readonly role?: 'player' | 'spectator';
  readonly delay?: 2 | 3;
  readonly hashInterval?: number;
  onJoined?(message: JoinedMessage): void;
  onPeerJoined?(player: PlayerInfo): void;
  onPeerLeft?(id: string): void;
  onDesync?(report: DesyncReport): void;
  onError?(error: ErrorMessage): void;
}

export interface RoomClient {
  readonly state: RoomClientState;
  readonly id: string | undefined;
  readonly joined: JoinedMessage | undefined;
  readonly lockstep: LockstepController | undefined;
  hello(): void;
  join(): void;
  /** Parsea, valida y enruta un mensaje del servidor. Nunca lanza. */
  handleMessage(raw: unknown): ServerMessage | undefined;
  /** Devuelve el tick destino, o undefined si no se puede enviar. */
  submitInput(currentTick: number, actions: InputFrame): number | undefined;
  /** Registra y envía el hash local; devuelve un desync si corresponde. */
  recordHash(tick: number, value: string): DesyncReport | undefined;
  leave(): void;
  close(): void;
}

/** Acepta texto JSON, objetos del navegador ({ data }) y vistas de bytes de Node. */
function decodePayload(raw: unknown): unknown {
  let payload = raw;
  for (let i = 0; i < 2 && typeof payload === 'object' && payload !== null && 'data' in payload; i++) {
    payload = (payload as { data: unknown }).data;
  }
  if (typeof payload !== 'string') {
    if (ArrayBuffer.isView(payload) && !(payload instanceof DataView)) {
      const bytes = new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
      return JSON.parse([...bytes].map((byte) => String.fromCharCode(byte)).join('')) as unknown;
    }
    return payload;
  }
  return JSON.parse(payload) as unknown;
}

export function createRoomClient(config: RoomClientConfig): RoomClient {
  let state: RoomClientState = 'idle';
  let id: string | undefined;
  let joined: JoinedMessage | undefined;
  let lockstep: LockstepController | undefined;
  let detach: (() => void) | undefined;

  const send = (message: ClientMessage): void => {
    config.socket.send(encode(message));
  };

  const reportError = (code: string, message: string): void => {
    config.onError?.({ v: NET_VERSION, t: 'error', code, message });
  };

  const handleMessage = (raw: unknown): ServerMessage | undefined => {
    let message: ServerMessage;
    try {
      message = parseServerMessage(decodePayload(raw));
    } catch (error) {
      reportError(
        error instanceof ProtocolError ? error.code : 'bad-message',
        error instanceof Error ? error.message : 'mensaje inválido',
      );
      return undefined;
    }

    switch (message.t) {
      case 'welcome':
        id = message.id;
        state = 'hello';
        // El handshake es automático: welcome → join con el código configurado.
        api.join();
        break;
      case 'joined': {
        joined = message;
        state = 'joined';
        if (id === undefined) id = message.id;
        const players = message.players.filter((p) => p.role === 'player').map((p) => p.id);
        lockstep = createLockstep({
          players,
          localId: id,
          requireLocalInput: config.role !== 'spectator',
          ...(config.delay !== undefined ? { delay: config.delay } : {}),
          ...(config.hashInterval !== undefined ? { hashInterval: config.hashInterval } : {}),
          onInput: (tick, actions) => {
            if (config.role !== 'spectator') send({ v: NET_VERSION, t: 'input', tick, actions });
          },
          onDesync: (report) => config.onDesync?.(report),
        });
        config.onJoined?.(message);
        break;
      }
      case 'peer-joined': {
        if (message.player.role === 'player') lockstep?.addPlayer(message.player.id);
        config.onPeerJoined?.(message.player);
        if (joined !== undefined) {
          const list = message.player.role === 'player' ? joined.players : joined.spectators;
          const exists = list.some((player) => player.id === message.player.id);
          if (!exists) {
            joined =
              message.player.role === 'player'
                ? { ...joined, players: [...joined.players, message.player] }
                : { ...joined, spectators: [...joined.spectators, message.player] };
          }
        }
        break;
      }
      case 'peer-left':
        lockstep?.removePlayer(message.id);
        config.onPeerLeft?.(message.id);
        if (joined !== undefined) {
          joined = {
            ...joined,
            players: joined.players.filter((player) => player.id !== message.id),
            spectators: joined.spectators.filter((player) => player.id !== message.id),
          };
        }
        break;
      case 'input':
        // El espectador también arma la cinta, pero no puede aportar input propio.
        if (message.from !== id) lockstep?.submit(message.from, message.tick, message.actions);
        break;
      case 'hash':
        if (message.from !== id && lockstep !== undefined && id !== undefined) {
          lockstep.recordHash(message.from, message.tick, message.value);
          lockstep.checkHashes(message.tick);
        }
        break;
      case 'desync':
        config.onDesync?.({ tick: message.tick, hashes: message.hashes });
        break;
      case 'error':
        config.onError?.(message);
        break;
    }
    return message;
  };

  const api: RoomClient = {
    get state() {
      return state;
    },
    get id() {
      return id;
    },
    get joined() {
      return joined;
    },
    get lockstep() {
      return lockstep;
    },
    hello(): void {
      send({ v: NET_VERSION, t: 'hello', name: config.name });
      state = 'hello';
    },
    join(): void {
      if (id === undefined) throw new Error('welcome requerido antes de join');
      send({
        v: NET_VERSION,
        t: 'join',
        code: config.code.toUpperCase(),
        ...(config.role !== undefined ? { role: config.role } : {}),
      });
      state = 'joining';
    },
    handleMessage,
    submitInput(currentTick: number, actions: InputFrame): number | undefined {
      if (state !== 'joined' || config.role === 'spectator' || lockstep === undefined) {
        return undefined;
      }
      return lockstep.submitLocal(currentTick, actions);
    },
    recordHash(tick: number, value: string): DesyncReport | undefined {
      if (state !== 'joined' || lockstep === undefined || id === undefined) return undefined;
      lockstep.recordHash(id, tick, value);
      send({ v: NET_VERSION, t: 'hash', tick, value });
      return lockstep.checkHashes(tick);
    },
    leave(): void {
      send({ v: NET_VERSION, t: 'left' });
      api.close();
    },
    close(): void {
      state = 'closed';
      detach?.();
      detach = undefined;
      config.socket.close();
    },
  };

  const onRawMessage = (raw: unknown): void => {
    handleMessage(raw);
  };
  if (config.socket.addEventListener !== undefined) {
    const listener = (event: { data: unknown }): void => onRawMessage(event.data);
    config.socket.addEventListener('message', listener);
    detach = () => config.socket.removeEventListener?.('message', listener);
  } else if (config.socket.on !== undefined) {
    config.socket.on('message', onRawMessage);
    detach = () => config.socket.off?.('message', onRawMessage);
  }

  return api;
}
