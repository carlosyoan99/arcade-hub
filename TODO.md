# TODO — Arcade Engine

> Estado: F0-F4 y F7 (migración) completados. F5 online y F6 pulido pendientes. Hub legacy congelado.

## Hecho

- **F0 Fundamentos:** bucle de paso fijo, clock, RNG sembrable, scheduler, eventos, snapshot/restore/hash, acciones nombradas, entrada virtual (incluye puntero y `axis`), headless runner, plugins nativos, servicios de `math`, `grid`, `collision` y `pathfinding`.
- **F1 Presentación:** canvas2d/DPR/letterbox, cámara, sprites, partículas, fanout de eventos, synth/music/manager de audio, shell/HUD/help/settings, storage versionado, scores por modo y achievements. Demo visual Vite.
- **F2 Primeros juegos:** Pong y Flappy Bird como validación del contrato.
- **F3 IA neuronal:** MLP, cerebros v1 con checksum, neuroevolución, agentes, sensores, brain-store, trainer headless con validación honesta y dificultad por checkpoints.
- **F4 / F7 Migración:** los **32 juegos** del hub migrados e integrados en `engine/src/games/index.ts` (`dbf6401`). Cada juego tiene curva de dificultad, patrones, eventos de juice, `observe()` y tests propios. Simplificaciones iniciales eliminadas por instrucción del usuario; Pole Position corregido para poder clasificar.
- **Progresión y variedad:** curvas declarativas, DDA oculto acotado, selector de patrones con bolsa y veto.
- **Correcciones B1-B8:** aplicadas en las versiones migradas, no en el legado.
- **Documentación:** DDT F0/F1/F2/F3, investigación de dificultad, decisiones de skills, README/AGENTS/CLAUDE/CONTRIBUTING actualizados; auditorías obsoletas eliminadas.

**Validado:** 290 tests en verde (29 archivos), `tsc` limpio, build y headless OK. Golden hash `600:3336926330:e22d095e-20`.

## En curso

1. Rediseño minimalista del HUB conservando el juice y la accesibilidad (subagente).
2. Auditoría de bugs en los juegos migrados con evidencia `archivo:línea` (subagente).
3. Aplicación de la revisión documental final (números actualizados, banner histórico en la investigación del Hub, DDT de fases pendientes).

## Pendiente

1. F5 online: `server/` con `ws`, lockstep, salas y detección de desync. El diseño ya está en `docs/DDT-F5-online.md`; falta implementarlo.
2. F6 pulido: revisión de rendimiento y accesibilidad con las skills `accessibility`, `playwright-best-practices` y `game-feel`.
3. Cerrar D1 (nombre), revisar D3/D8 con el DDT F5 y actualizar la matriz D1-D9.
4. Eliminar código residual del antiguo enfoque solo cuando el nuevo esté validado y funcional (plan con rollback y verificación del hash).
5. Añadir test de grafo de imports para hacer cumplir automáticamente la frontera `sim/ai/game` ↔ `render/audio/ui/DOM`.
6. Extender `InputFrame` con puntero para que Missile Command use ratón/stick/táctil en replay/headless.
