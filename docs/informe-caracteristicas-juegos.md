# Informe — características a implementar (juegos y HUB)

> 27-nov-2026 · **Plan previo a cualquier cambio de código.** La versión se mantiene en `0.2.0-beta.0`.
> Fuentes: código legacy en git (`a8a8093^:games/<id>/script.js`), `docs/Arcade Hub — investigación completa.md`, implementación actual `engine/src/games/<id>/game.ts`, HUB actual y sus audits en `docs/auditoria/`.

## 1. Resumen ejecutivo

La migración es correcta en el **núcleo determinista** (334+ tests, golden hash intacto, 32 juegos con `render`, E2E en Firefox), pero las regresiones de **presentación y fidelidad** impiden hablar de `rc`:

- El canvas del HUB es fijo (960×600) para 30 de 32 juegos: no hay letterbox responsive.
- No hay pantalla completa ni atajo.
- Desaparecieron las 32 capturas/miniaturas del HUB; las tarjetas son solo texto.
- Desaparecieron los temas claro/oscuro; tampoco existe el modo retro nuevo.
- `R` no reinicia realmente la simulación y la semilla está embebida (`12345`), sin compartir.
- Varias mecánicas del original pueden haberse perdido en la reescritura (auditoría juego a juego en curso).

**Decisión:** no promocionar hasta cerrar los P0 de este informe con evidencia.

## 2. Estándar de referencia

Ver `docs/estandar-juego-y-hub.md`: 11 requisitos medibles por juego (ajuste a pantalla, fullscreen, captura, juice, pausa/reinicio, paridad de controles, dificultad, semilla, accesibilidad, determinismo y fidelidad) y criterios E2E/unitarios.

## 3. HUB — hallazgos P0 (evidencia en `docs/auditoria/hub-y-estandar.md`)

| ID | Regresión | Evidencia actual | Original / referencia | Acción |
| --- | --- | --- | --- | --- |
| H-P0-01 | Canvas fijo, sin letterbox | `engine/demo/main.ts:39-43,279-281` | `shared/loop.js` + `computeLetterbox` del motor | Cablear `computeLetterbox`/`toWorld` y escalado responsive |
| H-P0-02 | Sin pantalla completa | no hay `requestFullscreen` | `a8a8093^:shared/shell.js:47-50` | Botón + tecla `F`, `fullscreenElement`, Esc devuelve foco |
| H-P0-03 | Sin capturas por juego | `engine/demo/main.ts:150-173` (tarjetas de texto) | 32 PNG + `drawGameThumb` en `a8a8093^:asset/hub-cards.js` | Nueva función del motor `captureThumbnail(game, seed, tick)` → dataURL por juego |
| H-P0-04 | Sin temas claro/oscuro/retro | `engine/demo/hub.css:4-10` | tokens y toggle en `a8a8093^:asset/hub.css` y `hub.js` | Temas con tokens, persistencia versionada, anti-FOUC y AA en los tres |
| H-P0-05 | `R` no reinicia | `engine/demo/main.ts:303-306` | `restart` del shell legacy | Re-montar simulación y volver al hash del tick 0 con la misma semilla |
| H-P0-06 | Semilla embebida | `engine/demo/main.ts:38` | — | Ruta `#game/<id>?seed=<n>` y verificación del mismo hash |
| H-P0-07 | Documentación falsa | `docs/arquitectura.md:60` afirma thumbnails | — | Corregir tras implementar las capturas |
| H-P0-08 | E2E no cubre esto | `e2e/hub.spec.js` | — | Añadir casos de letterbox, fullscreen, capturas, temas, reinicio y semilla |
| H-P0-09 | CSP y `forced-colors` ausentes | `index.html`, `engine/demo/hub.css` | `a8a8093^:index.html:11-14`, `hub.css:694-708` | Restaurar CSP (sin bloquear JSON-LD) y `forced-colors` |
| H-P0-10 | Objetivos táctiles AA | no verificados | skill `accessibility` | ≥24×24 px y axe en E2E |

## 4. Juegos — auditoría juego a juego

Los informes detallados se generan en `docs/auditoria/{shooters,laberintos,puzzles,conduccion}.md` con:
mecánicas originales (`script.js:NN`), estado migrado (`game.ts:NN`), regresiones P0/P1/P2, adaptaciones modernas y funciones del motor que faltan.

| Juego | P0 | P1 | P2 | Estado |
| --- | --- | --- | --- | --- |
| Asteroids | Platillos voladores ausentes (brecha heredada) | — | — | Corrección en curso |
| Bomberman | — | Récords/logros sin wiring; `hazard` sin uso | — | Auditado |
| Breakout | — | Subir de nivel al vaciar tablero; anti-stuck 5 s | — | Corrección en curso |
| Burger Time | — | `progress` por hamburguesa satura la curva | — | Corrección en curso |
| Cell Swarm | `eject`/`boost` sin entrada (HUB) | Puntero ignorado; `gained` no se reinicia; récords | — | Corrección en curso |
| Centipede | Ninguno | — | — | Auditado |
| Columns | `hardDrop` inalcanzable (HUB: `Space→rotate`) | 20 gemas vs 25; especiales en pieza | — | Corrección en curso |
| Defender | `hyperspace`/`nuclear` sin entrada (HUB); `bomb` solo mando | Juice en colisiones | — | Corrección en curso |
| Dig Dug | — | Evento `dig` muerto; `hazard` sin uso | — | Corrección en curso |
| Dino Runner | — | Margen de colisión de 6 px perdido | Ritmo de spawn | Corrección en curso |
| Donkey Kong | — | Ambigüedad ↑/salto (separar `jump`) | — | Corrección en curso |
| Double Dragon | `punch`/`kick`/`combo` sin entrada (HUB) | Armas/pickups ya presentes | — | Corrección en curso |
| Flappy Bird | Sin P0 reportado | — | — | Piloto (auditoría ligera) |
| Frogger | — | Bonus aleatorio perdido; `hazard` sin uso | — | Corrección en curso |
| Galaga | Formación no oscila; no toca el borde | — | — | Corrección en curso |
| Gradius | `activatePower()` regala SPD/+100 sin cápsula | — | — | Corrección en curso |
| Joust | — | Sin wrapping horizontal; spawn gradual | Justas entre enemigos | Corrección en curso |
| Missile Command | Ciudades destruidas resucitan por oleada | Sin ciudades de reserva ni multiplicador | — | Corrección en curso |
| Moon Patrol | `fireUp` inalcanzable (HUB) | Juice en impactos | — | Corrección en curso |
| Neon Nexus | `card1..3`/tienda sin entrada; `offerPending` bloqueaba | Tienda permanente desconectada | — | **Corregido en motor**; bindings en curso |
| Out Run | `turbo` inalcanzable (HUB) | Logros, sonido de motor, colores rivales | Proyección de carretera | **Corregido en motor**; bindings en curso |
| Pac-Man | — | Contrato de victoria (`winGame()`) | — | Corrección en curso |
| Paperboy | — | Carriles ←→ vs ↑↓ (ya corregido); obstáculos no reciclados | Tasa de suscripción | **Corregido en motor** |
| Pole Position | `turbo` inalcanzable (HUB) | 2 vueltas (ya corregido a 3); colores/proyección | 75 s de clasificación (adaptación) | **Corregido en motor**; bindings en curso |
| Pong | Sin P0 reportado | — | — | Auditado |
| Puyo Puyo | `hardDrop` inalcanzable (HUB) | Match por componente vs línea recta; sin P2 humano | Flash 0,35 s | Corrección en curso |
| Q*bert | Diagonales Q/E/A/D y táctil inalcanzables (HUB) | `hazard` sin uso | — | Corrección en curso |
| Raiden | Ninguno | — | — | Auditado |
| Snake | — | `tapAction='primary'` no registrado; Espacio ya no pausa | Comida sesgada por patrones | Corrección en curso |
| Space Invaders | Ninguno (B1 resuelto) | — | — | Auditado |
| Tempest | Ninguno (B1/B6/B7 resueltos) | — | — | Auditado |
| Tetris | `hardDrop`/`hold`/`rotateCCW` sin tecla (HUB) | Basura inyectada por `holes`/`hazard` | — | Corrección en curso |

## 5. Funciones nuevas que debe aportar el motor

| Función | Destino | La necesitan | Determinismo |
| --- | --- | --- | --- |
| `captureThumbnail(game, seed, tick)` | `engine/src/render/` | HUB (32 capturas) | Misma semilla ⇒ misma imagen |
| `computeLetterbox` ya existe; cablearlo en la vista | `engine/demo/main.ts` | 30 juegos con canvas fijo | Solo render, no toca `step()` |
| `requestFullscreen` + atajo | `input/host.ts` o vista | todos los juegos | Fuera de `step()` |
| Temas y persistencia versionada | `ui/` + `store/` | HUB | No afecta hash |
| Replay/semilla en la ruta | `ui/hub-model.ts` + vista | todos | Misma semilla ⇒ mismo hash |
| `bindingsFor(game)` por juego (hardDrop, hold, turbo, armas, diagonales, cartas…) | `ui/hub-model.ts` | Tetris, Columns, Puyo, Out Run, Pole Position, Double Dragon, Defender, Moon Patrol, Neon Nexus, Cell Swarm, Q\*bert, Snake | Solo mapea acciones declaradas; no toca `step()` |
| Tap múltiple / zonas del canvas | `input/host.ts` + vista | Cell Swarm (`eject`/`boost`), Q\*bert (4 diagonales) | Puntero normalizado en snapshot |
| Eventos de juice consistentes (`hit`, `explode`, `card`, `boss`, `dig`, `turbo`) | `game/events.ts` + juegos | 30 juegos | `emit()` no altera el estado |
| Match-3 compartido y reglas 2P | `sim/grid.ts` + `game/` | Columns, Puyo | Determinista, sin RNG global |

## 6. Plan de trabajo propuesto (no ejecutado)

1. **Fase A — motor**: añadir las funciones que faltan (`captureThumbnail`, attachments de fullscreen/tema/semilla) con tests unitarios.
2. **Fase B — HUB**: vitrina con miniaturas reales, temas claro/oscuro/retro, responsive, fullscreen, reinicio y semilla; E2E ampliado.
3. **Fase C — juegos P0**: corregir regresiones por batches, con tests de regresión por juego.
4. **Fase D — P1/P2**: adaptaciones modernas y pulido sin romper la identidad.
5. **Fase E — cierre**: documentación, revisión de capturas y entonces sí valorar `rc`.

**No se empieza hasta que este plan esté aprobado.**
