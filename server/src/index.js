/* global process */
/* eslint-disable no-console */
/**
 * Entrada CLI del relay. Host/puerto por variables de entorno:
 *   ARCADE_HOST (o HOST), ARCADE_PORT (o PORT). Default 127.0.0.1:8787.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRealtimeServer } from './transport.js';

export function main() {
  const host = process.env.ARCADE_HOST ?? process.env.HOST ?? '127.0.0.1';
  const rawPort = process.env.ARCADE_PORT ?? process.env.PORT ?? '8787';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`puerto inválido: ${rawPort}`);
  }

  const server = createRealtimeServer({ host, port });
  server.wss.on('listening', () => {
    console.log(`[arcade-server] relay escuchando en ws://${host}:${port}`);
  });
  server.wss.on('error', (error) => {
    console.error('[arcade-server] error de transporte:', error.message);
    process.exitCode = 1;
  });

  let closing = false;
  const shutdown = async (signal) => {
    if (closing) return;
    closing = true;
    console.log(`[arcade-server] ${signal}: cerrando salas y sockets…`);
    try {
      await server.close();
      process.exit(0);
    } catch (error) {
      console.error('[arcade-server] error al cerrar:', error);
      process.exit(1);
    }
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
