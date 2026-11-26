# Arquitectura canónica — Arcade Engine

> Estado actual del código (25-nov-2026). Si contradice al documento v0, prevalece este archivo.

## Fronteras

```
games/<id>/game.ts  →  GameDefinition (datos + reglas + step)
        ↓ usa
StepContext: clock, rng, rngFor, seed, events, scheduler, actions, services, progression, emit, schedule
        ↓ compuesto por
core/simulation.ts  →  plugins, snapshot/restore/hash
        ↓ servicios
core/     math, loop, clock, rng, scheduler, events, state, plugins, simulation
input/    actions (isDown/consume/axis/pointer), bindings, virtual (InputFrame/Replay)
sim/      grid, collision, pathfinding
progression/ curvas, DDA acotado, selector de patrones (bolsa + veto)
game/     contract, adapter, lifecycle, rules, events
ai/       mlp, brain, evolution, agents, sensors, brain-store, trainer, difficulty
render/   canvas2d, camera, sprites, particles, event-fanout, ui-draw
audio/    synth, music, manager
ui/       shell, hud, help, settings
store/    storage versionado, scores, achievements
tools/    headless runner, replay
```

- `sim/`, `ai/`, `progression/` y `game/` **no importan** `render/`, `audio/`, `ui/` ni DOM (por convención; sin test automático de grafo aún).
- `games/` solo importa del motor y no contiene bucle, colisiones genéricas, partículas, audio, guardado ni IA.
- Regla de oro: si una función aparece en dos juegos, sube al motor.

## Bucle y determinismo

60 Hz fijos con acumulador; `alpha = accumulator / dt` solo para render; máximo 5 sub-pasos y 250 ms por frame. El reloj de simulación es `tick * dt`; `step()` nunca lee reloj real. RNG xorshift32; `rngFor(namespace)` deriva streams sin consumir el principal. Hash FNV-1a sobre serialización estable con claves ordenadas. Golden: `600:3336926330:e22d095e-20`.

## Plugins

`EnginePlugin { id, version?, requires?, install(api), dispose? }`. Instalación topológica por `requires`; `services.provide/get/has`; hooks `preStep`/`postStep`. `eventFanoutPlugin` hace el único `events.drain()` por tick y publica a audio y partículas.

## Contrato de juego

```ts
defineGame<S>({
  id, meta, actions, init(seed, ctx), step(state, ctx),
  progression?, observe?, render?, rules: { isOver, winner, score, fitness },
});
```

`handleLifecycle(state, ctx, progress, reset)` centraliza `restart`/`pause`/`progression.update`. `singlePlayerRules(fitness)` evita repetir reglas. `JUICE_EVENTS` cataloga los eventos del motor.

## Dificultad y variedad

`progression` declara niveles (`speed`, `spawnInterval`, `hazard`), `pointsPerLevel`, DDA oculto y acotado (`window`, `maxAdjust`) y `patterns`. El selector usa bolsa sembrada con veto de repetición; `currentPattern` vive en el servicio, no duplicado en el juego. Ver `docs/investigacion-dificultad-variedad.md`.

## Validación

`npm test` (334 tests del engine), `npm run test:server`, `npm run typecheck`, `npm run build`, `npm run build:hub` y `npm run headless -w @arcade/engine -- --ticks 600 --seed 12345` (hash golden `600:3336926330:e22d095e-20`).

## HUB publicado y legado

El HUB se genera desde `engine/index.html` + `engine/demo/` con `npm run build:hub` y se publica en la raíz (`index.html` + `assets/`), sin iframes y con los meta/SEO del sitio anterior. El Hub legacy de D9 fue retirado el 26-nov-2026: ya no hay `games/`, `shared/`, `asset/` ni `index.html` antiguo; solo queda su registro histórico en `docs/`. El HUB conserva thumbnails canvas, foco visible, `aria-live`, `prefers-reduced-motion` y el juice sutil. Rollback: `git revert <hash-del-commit>` (ver `docs/plan-retirada-legacy.md`).
