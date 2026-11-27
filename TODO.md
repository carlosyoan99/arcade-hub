# TODO — Arcade Engine

> Estado: F0-F4, F5 y F7 (migración) completados; F6 pulido pendiente. Hub legacy retirado el 26-nov-2026 (referencia histórica en `docs/`).

## Hecho

- **F0 Fundamentos:** bucle de paso fijo, clock, RNG sembrable, scheduler, eventos, snapshot/restore/hash, acciones nombradas, entrada virtual (incluye puntero y `axis`), headless runner, plugins nativos, servicios de `math`, `grid`, `collision` y `pathfinding`.
- **F1 Presentación:** canvas2d/DPR/letterbox, cámara, sprites, partículas, fanout de eventos, synth/music/manager de audio, shell/HUD/help/settings, storage versionado, scores por modo y achievements. Demo visual Vite.
- **F2 Primeros juegos:** Pong y Flappy Bird como validación del contrato.
- **F3 IA neuronal:** MLP, cerebros v1 con checksum, neuroevolución, agentes, sensores, brain-store, trainer headless con validación honesta y dificultad por checkpoints.
- **F4 / F7 Migración:** los **32 juegos** del hub migrados e integrados en `engine/src/games/index.ts` (`dbf6401`). Cada juego tiene curva de dificultad, patrones, eventos de juice, `observe()` y tests propios. Simplificaciones iniciales eliminadas por instrucción del usuario; Pole Position corregido para poder clasificar.
- **Progresión y variedad:** curvas declarativas, DDA oculto acotado, selector de patrones con bolsa y veto.
- **Correcciones B1-B8:** aplicadas en las versiones migradas; el registro histórico está en `docs/Arcade Hub — investigación completa.md`.
- **F5 Online:** servidor de salas `ws` + lockstep determinista en `engine/src/net/` y `server/`.
- **Retirada del legacy:** HUB nuevo sin iframes publicado en la raíz con los meta/SEO, código viejo eliminado; ver `docs/plan-retirada-legacy.md`.
- **Documentación:** DDT F0/F1/F2/F3/F5, investigación de dificultad, decisiones de skills, README/AGENTS/CLAUDE/CONTRIBUTING actualizados; auditorías obsoletas eliminadas.
- **Grafo de imports automatizado:** `engine/test/import-graph.test.ts` hace cumplir la frontera de dependencias de `sim/ai/progression/core/game/games/render/audio/net` (8 tests en verde).

**Validado:** 334 tests del engine + tests del servidor en verde, `tsc` limpio, build de librería y del HUB OK. Golden hash `600:3336926330:e22d095e-20`. Rollback de la retirada: `git revert <hash-del-commit>`.

## En curso

1. ✅ Auditoría de bugs en los juegos migrados con evidencia `archivo:línea`; B1-B8 y los bugs nuevos corregidos.
2. ✅ Aplicación de la revisión documental (números actualizados, banner histórico, `docs/arquitectura.md`, DDT F5).
3. ✅ Render visual de los 32 juegos, verificado sin mutación de estado (`engine/test/render-all.test.ts`).
4. ✅ HUB nuevo servido desde `engine/` y publicado en la raíz, sin iframes.
5. ✅ F5 online: `server/` + `engine/src/net/` según `docs/DDT-F5-online.md`.
6. ✅ Retirada del Hub legacy y actualización de D9/DDT-F0.

## Pendiente

1. F6 pulido: revisión de rendimiento y accesibilidad con las skills `accessibility`, `playwright-best-practices` y `game-feel`.
2. Cerrar D1 (nombre), revisar D3/D8 con el DDT F5 y actualizar la matriz D1-D9.
3. Extender `InputFrame` con puntero para que Missile Command use ratón/stick/táctil en replay/headless.
