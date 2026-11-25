# DDT F5 — Online (pendiente)

> 25-nov-2026 · Diseño técnico de la fase de salas online. **Aún no implementado**: no existe `server/` ni `engine/src/net/`.

## 1. Objetivo

Pong, Snake y Tetris en modo versus online con **lockstep determinista** y relay pequeño, sin desync en 10 minutos. D3 (lockstep + relay) y D8 (servidor Node propio) quedan confirmados aquí; plan B: servidor autoritativo con snapshots.

## 2. Arquitectura propuesta

- `server/`: Node + `ws` (única dependencia de runtime permitida). Capas: transporte → sala → relay. Sin frameworks, Zod, Pino ni base de datos. Validación manual de mensajes en la frontera del socket; shutdown limpio; puerto/host por variables de entorno.
- `engine/src/net/`: `protocol.ts` (mensajes versionados), `lockstep.ts` (input delay 2-3 ticks y cola por tick), `room-client.ts`. `net` solo habla en inputs y hashes, nunca en render ni audio.
- Mensajes: `hello`, `join`, `input{tick, actions}`, `hash{tick, value}`, `left`. Todos versionados y validados antes de tocar el estado.

## 3. Determinismo

- Misma semilla y misma cinta de inputs en todos los clientes; `step()` ya es puro y usa `ctx.rng`, `ctx.clock` y timers en estado.
- Hash del estado cada N ticks vía `Simulation.hash()`; si dos clientes discrepán, se reporta desync y se aplica el plan B.
- Trigonometría tabulada: `step()` solo usa `+ - * / sqrt`. Verificado en los 32 juegos por los tests de determinismo y el barrido de APIs prohibidas.

## 4. Salas

Código de sala o IP manual (sin matchmaking ni descubrimiento automático), 2-4 jugadores, nombres visibles, espectadores gratis que reciben los mismos inputs. Reconexión **fuera de v1**.

## 5. Criterios de aceptación

1. `npm test -w @arcade/engine` sigue en verde y el golden hash no cambia.
2. Test de WebSocket (skill `playwright-best-practices`, `page.waitForEvent('websocket')`) que conecte dos clientes y avance 600 ticks sin desync.
3. Prueba manual de 10 minutos con Pong, Snake y Tetris sin desincronización.
4. `ws` es la única dependencia de runtime del servidor; el cliente sigue sin dependencias nuevas.

## 6. Riesgos

- Determinismo bit a bit entre navegadores: mitigado por RNG propio y tablas trigonométricas; plan B autoritativo si falla.
- Latencia y reconexión quedan fuera del alcance de v1.
- Antes de escribir código, aplicar la skill `create-specification` al contrato de mensajes.
