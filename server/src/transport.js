/* global process */
/**
 * Capa de transporte: ws → validación → sala → relay.
 * El socket solo habla mensajes v1; cualquier error se responde, nunca se lanza.
 */
import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { ProtocolError, encode, errorMessage, parseClientText, welcome } from './protocol.js';
import { RoomRegistry } from './room.js';

export function createRealtimeServer(options = {}) {
  const host = options.host ?? process.env.ARCADE_HOST ?? '127.0.0.1';
  const port = options.port ?? Number(process.env.ARCADE_PORT ?? 8787);
  const rooms = options.rooms ?? new RoomRegistry();
  const wss = new WebSocketServer({ host, port });

  wss.on('connection', (socket) => {
    let client;

    const send = (message) => {
      if (socket.readyState === 1) socket.send(encode(message));
    };
    const fail = (code, message) => send(errorMessage(code, message));

    socket.on('message', (raw, isBinary) => {
      if (isBinary) {
        fail('binary-not-allowed', 'solo se aceptan mensajes de texto');
        return;
      }

      let message;
      try {
        message = parseClientText(String(raw));
      } catch (error) {
        fail(
          error instanceof ProtocolError ? error.code : 'bad-message',
          error instanceof Error ? error.message : 'mensaje inválido',
        );
        return;
      }

      switch (message.t) {
        case 'hello': {
          if (client !== undefined) {
            fail('already-helloed', 'ya se envió hello en esta conexión');
            return;
          }
          client = {
            id: randomUUID().replaceAll('-', '').slice(0, 12),
            name: message.name,
            role: 'player',
            room: undefined,
            send,
          };
          send(welcome(client.id));
          return;
        }
        case 'join': {
          if (client === undefined) {
            fail('hello-required', 'envía hello antes de join');
            return;
          }
          if (client.room !== undefined) {
            fail('already-joined', 'esta conexión ya está en una sala');
            return;
          }
          const result = rooms.join(message.code, client, message.role);
          if (!result.ok) {
            fail(result.error, result.error);
            return;
          }
          client.room = result.room;
          client.role = message.role;
          return;
        }
        case 'input':
        case 'hash': {
          if (client === undefined || client.room === undefined) {
            fail('join-required', 'envía join antes de input/hash');
            return;
          }
          const result = rooms.relay(client, message);
          if (!result.ok) fail(result.error, result.error);
          return;
        }
        case 'left': {
          if (client !== undefined) rooms.leave(client);
          client = undefined;
          socket.close(1000, 'left');
          return;
        }
        default:
          fail('unknown-type', 'mensaje no soportado');
      }
    });

    socket.on('close', () => {
      if (client !== undefined) rooms.leave(client);
      client = undefined;
    });
    socket.on('error', () => {
      // La desconexión se limpia en 'close'; evitar errores no manejados.
    });
  });

  return {
    wss,
    rooms,
    host,
    port,
    close() {
      return new Promise((resolve, reject) => {
        for (const socket of wss.clients) socket.terminate();
        wss.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
