# Estándar obligatorio — juegos y HUB

> 27-nov-2026 · Criterios que debe cumplir **cada juego migrado** y el HUB antes de hablar de `rc`/`1.0.0`.
> Se deriva de la comparación con el original (código legacy conservado en git) y de alternativas modernas del género.

## 1. Decisiones de proceso

1. La versión se mantiene en **`0.2.0-beta.0`**. No hay `rc` hasta cerrar las regresiones de presentación y características.
2. El **motor coordina todo**: ajuste a pantalla, fullscreen, capturas, temas, juice, pausa, guardado, IA y red son servicios/plugins del motor o de la UI del motor. Los juegos solo declaran reglas, estado, curva de dificultad, eventos y dibujo.
3. Toda comprobación debe tener evidencia: test automatizado, E2E o captura. Un "parece que funciona" no cuenta.

## 2. Checklist por juego (medible)

| # | Requisito | Cómo verificarlo |
| --- | --- | --- |
| 1 | **Ajuste a pantalla**: el canvas escala conservando la proporción (letterbox), sin recortes ni desbordes, en escritorio y móvil. | Test `computeLetterbox` + E2E con 3 viewports (360×640, 1280×720, 1920×1080) sin scroll horizontal. |
| 2 | **Pantalla completa**: botón/atajo (`F`/`F11`) que usa Fullscreen API y escala el canvas al 100 % de la pantalla sin deformar. | E2E: pulsar fullscreen y comprobar `document.fullscreenElement` y que el canvas llena el viewport. |
| 3 | **Captura en el HUB**: cada juego genera una miniatura real (canvas offscreen → dataURL) con su estado inicial y unos cuantos ticks deterministas. | Test `captureThumbnail(game, seed, tick)` para los 32 juegos: dataURL no vacío y distinto entre juegos. |
| 4 | **Juice**: eventos del juego alimentan partículas, audio y feedback visual; `prefers-reduced-motion` los modera sin eliminarlos. | Test de eventos por juego + E2E con reduced motion; revisión visual de capturas. |
| 5 | **Pausa y reinicio** con acciones nombradas, sin `setTimeout` ni reloj real; `generation` anula timers vencidos. | Tests de lifecycle por juego (ya presentes) + test de timers en pausa/reinicio. |
| 6 | **Paridad de controles**: teclado, gamepad, táctil y puntero producen las mismas acciones. | `test/input-host.test.ts` + revisión de `actions` declaradas vs usadas en cada juego. |
| 7 | **Dificultad progresiva y variedad**: ≥3 niveles crecientes, `hazard`, patrones con bolsa, DDA acotado; la IA/perfiles Fácil/Normal/Difícil son datos, no lógica duplicada. | `test/catalog.test.ts` + tests por juego de subida de nivel. |
| 8 | **Semilla compartible**: la semilla se muestra/copia y reproduce la misma partida (replay). | Test determinismo + `tools/replay.ts` con la misma semilla. |
| 9 | **Accesibilidad**: foco visible, `aria-live`, contraste AA, navegación por teclado, sin depender solo de color/audio. | Skill `accessibility`: axe/Lighthouse en E2E y revisión de tokens. |
| 10 | **Determinismo e integridad**: mismo seed + misma cinta ⇒ mismo hash; cero `Math.random`/`Date.now`/DOM en `step()`. | `test/determinism.test.ts`, `test/import-graph.test.ts` y golden hash. |
| 11 | **Fidelidad**: las mecánicas que definen al original están presentes (ver auditoría juego a juego); las mejoras modernas se añaden, no sustituyen. | Informe `docs/informe-caracteristicas-juegos.md` con evidencia `script.js:NN` vs `game.ts:NN`. |

## 3. Comparación con el original y alternativas modernas

- **Original**: se lee del código legacy congelado en git (`a8a8093^:games/<id>/script.js`) y del informe histórico `docs/Arcade Hub — investigación completa.md`. Es la autoridad sobre mecánicas y controles.
- **Moderno**: se toman ideas que no rompan la identidad (Tetris Effect/99: hold/queue/ghost y modos sociales; Pac-Man Championship Edition: ritmo y tableros; Galaga Wars/Raiden modernos: variety de oleadas y jefes; Out Run/Cosy Ultra: curvas, día/noche y tráfico; Dino Runner: variedad de obstáculos y ciclo día/noche).
- **Regla**: una característica moderna entra **además** de la original, nunca en lugar de ella. Si hay conflicto, gana la original y se documenta el motivo.
- **Juice**: partículas/audio/shake/freeze-frame siguen siendo eventos del motor; un juego nunca los implementa por su cuenta.

## 4. HUB objetivo

| Requisito | Estado anterior | Estado actual | Objetivo |
| --- | --- | --- | --- |
| Capturas por juego | PNG por juego + miniaturas canvas (`asset/hub-cards.js`) | **Perdido**: tarjetas de texto | Generar miniaturas desde el motor (`captureThumbnail`) con aspecto fiel al juego |
| Temas | claro/oscuro (`themeToggle`) | **Perdido** | Claro / oscuro / retro, con tokens y persistencia versionada en `store/` |
| Fullscreen | botón en game bar | **Perdido en juegos migrados** | Botón y atajo en la vista de juego del motor |
| Ajuste a pantalla | canvas fijo + letterbox parcial | **Regresión**: canvas fijo | Letterbox centralizado y escalado responsive |
| Densidad visual | hero + stats + tarjetas | Simplificado en exceso | Vitrina con capturas y metadatos, filtros y orden; sobria pero informativa |
| Accesibilidad | foco, aria-live, reduced motion | Parcial | Checklist AA completa con axe en E2E |

## 5. Criterio de salida

1. Los cinco informes de auditoría (`docs/auditoria/*.md`) están completos y citan evidencia.
2. El informe consolidado `docs/informe-caracteristicas-juegos.md` lista P0/P1/P2 por juego con esfuerzo y dependencias del motor.
3. El plan es aprobado antes de tocar código; solo entonces se ejecutan las correcciones por batches.
