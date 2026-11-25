# Contribuir — Arcade Engine

El proyecto activo es `engine/`. El Arcade Hub legacy está congelado: no se aceptan cambios nuevos en `games/`, `shared/` ni `index.html`.

## Flujo

1. Lee `AGENTS.md`, `CLAUDE.md`, `docs/DDT-F0-fundamentos.md`, `docs/DDT-F1-presentacion.md`, `docs/DDT-F3-IA.md` y `docs/investigacion-dificultad-variedad.md`.
2. Crea una rama desde `main`.
3. Para un juego nuevo, copia `engine/src/games/pong/game.ts` como plantilla y crea `engine/src/games/<id>/game.ts`.
4. Añade tests en `engine/test/` (determinismo, dificultad creciente, `observe()` finito y evento de juice).
5. Para juego posteriores a la v1 (los 32 ya están registrados), añádelo a `engine/src/games/index.ts`.
6. Verifica y commitea con mensaje conventional (`feat(games): ...`, `fix(engine): ...`, `docs: ...`).

```bash
npm test -w @arcade/engine
npx tsc -p engine/tsconfig.json --noEmit
npm run build -w @arcade/engine
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

## Legado

Los juegos originales de `games/` se leen como referencia de reglas y controles. No se modifican. Sus bugs conocidos (B1-B8) están en `docs/Arcade Hub — investigación completa.md` y se corrigen en la versión migrada.
