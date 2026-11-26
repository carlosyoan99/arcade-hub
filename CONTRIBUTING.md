# Contribuir — Arcade Engine

El proyecto activo es `engine/` (junto con `server/`). El Arcade Hub legacy fue retirado; `index.html` y `assets/` en la raíz se generan con `npm run build:hub` y no se editan a mano.

## Flujo

1. Lee `AGENTS.md`, `CLAUDE.md`, `docs/DDT-F0-fundamentos.md`, `docs/DDT-F1-presentacion.md`, `docs/DDT-F3-IA.md` y `docs/investigacion-dificultad-variedad.md`.
2. Crea una rama desde `main`.
3. Para un juego nuevo, copia `engine/src/games/pong/game.ts` como plantilla y crea `engine/src/games/<id>/game.ts`.
4. Añade tests en `engine/test/` (determinismo, dificultad creciente, `observe()` finito y evento de juice).
5. Para juego posteriores a la v1 (los 32 ya están registrados), añádelo a `engine/src/games/index.ts`.
6. Verifica y commitea con mensaje conventional (`feat(games): ...`, `fix(engine): ...`, `docs: ...`).

```bash
npm run typecheck
npm test
npm run test:server
npm run build
npm run build:hub
```

## Checklist de un juego migrado

- [ ] `defineGame` con `id`, `meta`, `actions`, `progression`, `init`, `step`, `observe`, `rules` (y `render` si aplica).
- [ ] `step()` sin `Math.random`, `Date.now`, `setTimeout`, DOM, audio ni dibujo.
- [ ] Usa `ctx.rng`, `ctx.schedule`, `ctx.emit` y `ctx.actions` en lugar de mecanismos propios.
- [ ] `ctx.progression.update(...)` cada tick y uso real de `speed`, `spawnInterval`, `hazard` y `nextPattern()`.
- [ ] Curva con al menos 3 niveles crecientes y 3-5 patrones variados.
- [ ] Eventos de juice (`hit`, `score`, `explode`, `levelUp`, `gameOver`).
- [ ] Estado serializable que sobrevive a `snapshot()`/`restore()` y produce hash estable.
- [ ] Similitud reconocible con el original + mejoras modernas (semilla, QoL, accesibilidad).
- [ ] Tests en verde y `tsc` limpio.

## Si encuentras código repetido

No lo copies en el juego. Reporta cuál es, dónde aparece y qué servicio del motor podría absorberlo. Lo mismo si encuentras una función del motor ya implementada que no puedes usar, o una que falta. El coordinador decide si sube a `core/`, `input/`, `progression/`, `ai/` o `render/`.

## Histórico y rollback

El Hub anterior ya no existe en el repo: B1-B8 y las reglas originales quedan como registro histórico en `docs/Arcade Hub — investigación completa.md`, y sus correcciones están en los juegos migrados de `engine/src/games/`. El hash golden vigente es `600:3336926330:e22d095e-20`. Si hace falta recuperar el legacy, `git revert <hash-del-commit>`; ver `docs/plan-retirada-legacy.md`.
