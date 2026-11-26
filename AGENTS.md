# AGENTS.md — Arcade Engine / Arcade Hub

Orientación rápida. Lee también `CLAUDE.md` (convenciones), `CONTRIBUTING.md` (cómo migrar un juego), `TODO.md` (roadmap) y los DDT en `docs/`: F0 (núcleo/plugins), F1 (presentación), F2 (primeros juegos), F3 (IA), F5 (online).

## Dónde trabajar

- **Activo:** `engine/` — TypeScript estricto, Vite, Vitest, plugins nativos; 32 juegos integrados y 334 tests en verde.
- **Activo:** `server/` — salas WebSocket con lockstep determinista.
- **Generado:** `index.html` y `assets/` en la raíz — salida de `npm run build:hub`; no editar a mano.
- **Retirado:** el Arcade Hub legacy (`games/`, `shared/`, `asset/`, etc.) ya no está en el repo. Su referencia histórica vive en `docs/`.

## Comandos (desde la raíz)

```bash
npm install
npm test                                   # Vitest del engine
npm run test:server                        # tests del servidor
npm run typecheck                          # tsc completo
npm run build                              # librería del engine
npm run build:hub                          # HUB en la raíz (index.html + assets/)
npm run dev                                # demo visual
npm start                                  # servidor de salas
npm run check                              # toda la verificación
npm run headless -w @arcade/engine -- --ticks 600 --seed 12345
```

Dentro de `engine/`: `npm test`, `npm run build`, `npm run build:hub`, `npm run dev`, `npm run headless`.

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

- `engine/test/determinism.test.ts` incluye el hash golden (`600:3336926330:e22d095e-20`). Cambiarlo sin explicación rompe el determinismo.
- Todo juego nuevo debe tener test de determinismo, de subida de dificultad, de `observe()` finito y de evento de juice.
- `npm test -w @arcade/engine` debe estar en verde antes de integrar.

## Hub publicado, rollback e histórico

- El HUB se publica con `npm run build:hub`: genera `index.html` y `assets/` en la raíz sin iframes, conservando canonical, robots, sitemap, favicon, Open Graph/Twitter y JSON-LD. Sirve la raíz con cualquier servidor estático.
- Para deshacer la retirada del legacy: `git revert <hash-del-commit>` (o `git revert HEAD` si es el último). El procedimiento y los riesgos están en `docs/plan-retirada-legacy.md`.
- Hash golden vigente: `600:3336926330:e22d095e-20`; se comprueba en `engine/test/determinism.test.ts`.
- Bugs B1-B8 y decisiones del Hub anterior: `docs/Arcade Hub — investigación completa.md` (registro histórico; ya no hay código legacy que corregir).
- El motor usa `store/` versionado con validación para la persistencia.
