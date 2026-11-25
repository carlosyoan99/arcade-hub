# AGENTS.md — Arcade Engine / Arcade Hub

Orientación rápida. Lee también `CLAUDE.md` (convenciones), `CONTRIBUTING.md` (cómo migrar un juego), `TODO.md` (roadmap) y `docs/DDT-F0-fundamentos.md` (arquitectura del motor).

## Dónde trabajar

- **Activo:** `engine/` — TypeScript estricto, Vite, Vitest, plugins nativos.
- **Congelado:** `games/`, `shared/`, `index.html`, `asset/` — Arcade Hub legacy (32 juegos). Sirve solo como referencia de mecánicas. **No añadas juegos nuevos ni cambios allí.**

## Comandos (desde la raíz)

```bash
npm install
npm test -w @arcade/engine                 # Vitest
npm run build -w @arcade/engine            # tsc + Vite
npm run dev -w @arcade/engine              # demo visual
npm run headless -w @arcade/engine -- --ticks 600 --seed 12345
npx tsc -p engine/tsconfig.json --noEmit   # typecheck completo
```

Dentro de `engine/`: `npm test`, `npm run build`, `npm run dev`, `npm run headless`.

## Reglas del motor (no negociables)

1. `step()` es puro: nada de `Math.random`, `Date.now`, `setTimeout`, DOM, render ni audio. Azar = `ctx.rng`; timers = `ctx.schedule`; feedback = `ctx.emit`.
2. Un juego solo declara datos y reglas en `defineGame`. Cualquier mecánica repetible sube al motor como plugin/servicio.
3. La progresión es declarativa (`progression` en el juego) y se aplica con `ctx.progression`. Nunca escribas curvas de dificultad dentro de `step()`.
4. Los juegos emiten eventos de "juice"; partículas/audio los consumen por plugins (`eventFanoutPlugin` drena la cola una sola vez).
5. Todo estado debe sobrevivir a `snapshot()`/`restore()` y producir el mismo hash con la misma semilla y cinta de inputs.
6. Sin dependencias de runtime nuevas. Solo las devDependencies ya presentes.

## Migración de un juego

Copia `engine/src/games/pong/game.ts` como plantilla. Crea `engine/src/games/<id>/game.ts` y su test en `engine/test/`. Regístralo en `engine/src/games/index.ts` (lo hace el coordinador). Consulta `docs/investigacion-dificultad-variedad.md` para los valores de `progression`.

Si encuentras **código duplicado**, una funcionalidad del motor ya implementada que no puedes usar, o una función del motor que falta: **no la reimplementes en el juego; repórtalo** para decidir si sube al motor.

## Tests

- `engine/test/determinism.test.ts` incluye el hash golden (`600:3336926330:e22d095e-20`). Cambiarlo sin explicación rompe la determinismo.
- Todo juego nuevo debe tener test de determinismo, de subida de dificultad, de `observe()` finito y de evento de juice.
- `npm test -w @arcade/engine` debe estar en verde antes de integrar.

## Legado (solo lectura)

- Hub sin build step: `python3 -m http.server 8000`.
- `games.js` es el manifiesto; `sw.js` mantiene `FILES` (regenerar con `npm run verify:sw`).
- Bugs conocidos B1-B8: ver `docs/Arcade Hub — investigación completa.md`. No se corrigen en el legado; las correcciones van en los juegos migrados.
- `localStorage` legacy: `<gameId>_<key>`; el motor usa `store/` versionado con validación.
