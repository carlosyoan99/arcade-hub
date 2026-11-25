# CLAUDE.md — Convenciones técnicas

Este repo tiene dos mundos: **`engine/` (Arcade Engine, activo)** y el **Arcade Hub legacy congelado**. Las convenciones de abajo son para el motor; el legado se conserva solo como referencia.

## Convenciones del motor

- TypeScript con `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`. ESM con imports terminados en `.js`. Comillas simples, 2 espacios, 100 columnas.
- Estructura: `core` (simulación/plugins), `input`, `progression`, `game`, `games`, `ai`, `render`, `audio`, `ui`, `store`, `tools`.
- `sim`, `ai`, `progression` y `game` no importan `render`, `audio`, `ui` ni DOM. `games` solo importa de `engine` (tipos y contrato).
- `StepContext` es la única vía del juego al motor: `clock`, `rng`, `events`, `scheduler`, `actions`, `services`, `progression`, `emit()`, `schedule()`.
- Bucle: 60 Hz fijos con acumulador; `alpha = accumulator / dt` solo para render; máximo 5 sub-pasos y 250 ms por frame.
- RNG: xorshift32 de 32 bits, `fork(salt)` para subsistemas (partículas, IA) sin consumir el stream principal.
- Estado: plano y serializable. `snapshot()` usa clon profundo; `hash()` es FNV-1a sobre serialización estable con claves ordenadas.
- Eventos: `emit(type, payload)`; un solo `events.drain()` por tick lo hace `eventFanoutPlugin`, que publica a audio/partículas.
- Progresión: `progression.update(progress)` cada tick; `state.speed`, `.spawnInterval`, `.hazard` y `nextPattern()` se usan de verdad. DDA oculto, `window` ≥ 300 ticks y `maxAdjust` ≤ 0.1.
- IA: misma `step()` del juego vía `trainHeadless`; observación Float32Array; campeón validado con semillas nunca vistas; cerebros v1 con checksum.

## Prohibido en `step()` / `init()` de un juego

`Math.random`, `Date.now`, `performance.now`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `document`, `window`, `localStorage`, imports de `render`/`audio`/`ui`/`store`.

## Estilo visual y juice

Neon 2D del Hub como referencia, pero los colores, partículas y sonidos son **servicios del motor**, no código copiado en cada juego. Un juego emite `hit`/`score`/`explode`/`levelUp`; el motor decide cómo se ve y suena. `prefers-reduced-motion` y remapeo de teclas viven en `ui/settings.ts`.

## Verificación

```bash
npm test -w @arcade/engine
npx tsc -p engine/tsconfig.json --noEmit
npm run build -w @arcade/engine
```

Si un cambio altera el hash golden, hay una razón (cambio de física o de RNG) y debe actualizarse el test a conciencia.

## Legado

Los 32 juegos en `games/` usan `shared/*.js`, requieren 5 archivos por juego y se registran en `games.js` + `sw.js`. Están congelados: no se corrijan bugs allí; se migran al motor. Sus bugs están documentados en `docs/Arcade Hub — investigación completa.md`.
