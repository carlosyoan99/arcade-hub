# DDT F2 — Primeros juegos sobre el motor

> 25-nov-2026 · Fase 2 y puente con F3. Juegos de validación: **Pong** y **Flappy Bird**.

## 1. Objetivo

Validar que el contrato `GameDefinition` es suficiente: un juego debe poder escribirse **solo** con `id`, `meta`, `actions`, `init`, `step`, `render`, `observe` y `rules`. Cualquier mecánica repetible (bucle, input, timers, colisiones, audio, guardado, IA, red) debe venir del motor o de un plugin.

## 2. Pong (`engine/src/games/pong/game.ts`)

- **Estado:** pelota `{x,y,vx,vy}`, palas `left`/`right`, marcador, flags `serving`/`over`/`winner`, `ticks`.
- **Acciones declaradas:** `p1Up`, `p1Down`, `p2Up`, `p2Down`, `serve`, `pause`, `restart`. El juego no lee `e.code`.
- **Física:** paso fijo por `ctx.clock.dt`; rebotes por aritmética (`sqrt` permitido, sin `sin`/`cos`); ángulo según punto de impacto; sprint sin duplicación de constantes.
- **Eventos:** `serve`, `wallHit`, `paddleHit`, `score`, `gameOver`. El juego solo emite; render/audio reaccionan.
- **IA:** `observe()` devuelve 7 floats normalizados; `rules.fitness` puntúa diferencia y victoria. El bot vive en `engine/src/ai/`, no aquí.
- **Modos:** `solo`, `local`, `vsAI`, `online` (los slots los resuelve el motor).
- **Validación:** 6 tests — determinismo con semilla+cinta, servicio de saque, punto, rebote, observación y reglas.

## 3. Flappy Bird (`engine/src/games/flappy/game.ts`)

- **Estado:** `birdY`, `birdVy`, tubos, marcador, `over`, contador de ticks.
- **Acciones:** `flap`, `restart`, `pause`. Misma acción para humano, IA y replay.
- **Tubos:** generados con `ctx.rng.int()`, nunca `Math.random`.
- **IA:** `observe()` de 5 floats (altura, velocidad, distancia al tubo, centro del hueco, tamaño del hueco). Es el objetivo principal de la primera neuroevolución.
- **Validación:** 6 tests — determinismo, aleteo, generación y puntuación, colisión con suelo, observación.

## 4. Frontera juego/motor (comprobada)

| Mecánica | Dónde vive |
| --- | --- |
| Bucle de paso fijo, alpha, sub-pasos | `core/loop.ts` |
| Reloj, RNG, timers, eventos, snapshot | `core/*` |
| Acciones nombradas, bindings, entrada virtual | `input/*` |
| IA, cerebros, entrenador | `ai/*` (plugin/servicio) |
| Render, cámara, partículas, audio, UI, guardado | `render/*`, `audio/*`, `ui/*`, `store/*` (plugins) |
| Reglas, estado, nivel, puntuación del juego | `games/<id>/game.ts` |

**Regla de oro:** si una función aparece en dos juegos, sube al motor.

## 5. Demo visual

`engine/index.html` + `engine/demo/main.ts`: conmutador Pong/Flappy, `createLoop` real, `pongGame.render`/`flappyGame.render` sobre Canvas 2D y bindings de teclado. Permite comprobar que la simulación determinista también se ve bien.

## 6. Criterio de salida

- `npx vitest run test/pong.test.ts test/flappy.test.ts` → 12/12 en verde.
- Los juegos no importan de `core/` directamente salvo tipos, ni contienen `Math.random`, `Date.now` ni timers propios.
