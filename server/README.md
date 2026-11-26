# @arcade/server — relay online

Relay mínimo para el modo versus online del Arcade Engine. Node ESM + **`ws` como única dependencia de runtime**. Sin Express, Zod, Pino ni base de datos.

## Capas

1. `src/transport.js` — `WebSocketServer`, validación de texto entrante, asignación de id, envío de errores.
2. `src/room.js` — salas por código (2-4 jugadores + espectadores), relay y detección de desync.
3. `src/index.js` — arranque, variables de entorno y shutdown limpio.

`src/protocol.js` contiene el contrato v1 validado a mano. Es espejo de `engine/src/net/protocol.ts`; si cambias un mensaje, cambia ambos.

## Arrancar

```bash
npm install            # desde la raíz del monorepo
npm start -w @arcade/server
# o: ARCADE_HOST=0.0.0.0 ARCADE_PORT=9000 node server/src/index.js
```

`ARCADE_HOST` (o `HOST`) y `ARCADE_PORT` (o `PORT`). Defaults: `127.0.0.1:8787`. `SIGINT`/`SIGTERM` cierran sockets y salas antes de salir.

## Protocolo v1

Todo mensaje lleva `v: 1` y `t`. La frontera rechaza versión incorrecta, tipo desconocido y campos malformados con `{ v, t: 'error', code, message }`; nunca propaga un payload inválido al estado de la sala.

Cliente → servidor:

| `t`     | Campos                                             |
| ------- | -------------------------------------------------- |
| `hello` | `name` (1-24)                                      |
| `join`  | `code` (4-8 alnum), `role?` (`player`/`spectator`) |
| `input` | `tick` (>= 0), `actions` (≤ 64 nombres únicos)     |
| `hash`  | `tick`, `value` (hash de `Simulation.hash()`)      |
| `left`  | —                                                  |

Servidor → cliente: `welcome{id}`, `joined{code,id,hostId,seed,players,spectators}`, `peer-joined{player}`, `peer-left{id}`, `input{from,tick,actions}`, `hash{from,tick,value}`, `desync{tick,hashes}`, `error{code,message}`.

El relay reenvía cada `input`/`hash` a todos los demás miembros de la sala, **incluidos los espectadores**. Estos reciben la misma cinta pero no pueden enviar inputs ni hashes (`spectator-read-only`). El `seed` de la sala viaja en `joined` para que todos arranquen la misma simulación.

Cada 30 ticks el servidor compara los hashes recibidos para ese tick; si dos jugadores difieren, emite `desync` a toda la sala (una sola vez por tick).

## Tests

```bash
npm test -w @arcade/server
```

`test/protocol.test.js` valida la frontera; `test/room.test.js` cubre salas, relay y desync sin sockets; `test/transport.test.js` usa `ws` en puerto efímero.

## Fuera de v1

Reconexión, matchmaking, latencia/adaptación y servidor autoritativo (plan B si el determinismo bit a bit falla).
