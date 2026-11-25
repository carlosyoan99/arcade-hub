# TODO — Arcade Engine

> Estado: motor F0-F3 validado. Hub legacy congelado como referencia.

## Hecho

- **F0 Fundamentos:** bucle de paso fijo, clock, RNG sembrable, scheduler, eventos, snapshot/restore/hash, acciones nombradas, entrada virtual, headless runner, plugins nativos con orden topológico y servicios. 21 tests.
- **F1 Presentación:** canvas2d/DPR/letterbox, cámara, sprites, partículas, fanout de eventos, synth/music/manager de audio, shell/HUD/help/settings, storage versionado, scores por modo y achievements. 44 tests.
- **F2 Primeros juegos:** Pong y Flappy Bird sobre `defineGame`, con progresión, patrones y IA observable. 12 tests.
- **F3 IA neuronal:** MLP, cerebros v1 con checksum, neuroevolución, agentes, sensores, brain-store, trainer headless con validación honesta y dificultad por checkpoints. 26 tests + 2 de integración.
- **Progresión y variedad:** curvas declarativas por juego, DDA oculto acotado y selector de patrones con bolsa. 6 tests.
- **Documentación:** DDT F0/F2, investigación de dificultad, README/AGENTS/CLAUDE/CONTRIBUTING actualizados; audits antiguos eliminados.

**Total validado:** 112 tests en verde, `tsc` limpio, build y headless OK.

## En curso

- Migración de los 30 juegos restantes en 4 batches (shooters, laberintos, puzzles, conducción/acción). Cada batch entrega tests propios y un informe de duplicados / funciones del motor no usadas / funciones que faltan.

## Pendiente después de la migración

1. Integrar los 30 juegos en `engine/src/games/index.ts` y correr la suite completa.
2. Decidir, con los informes de los subagentes, qué duplicados suben al motor.
3. Corregir los bugs B1-B8 en las versiones migradas (no en el legado).
4. Rediseñar la interfaz del HUB de forma minimalista y sencilla, conservando el "juice" (partículas/audio/eventos) del motor.
5. Revisión final de documentación: actualizar DDT por fase, quitar referencias obsoletas y verificar que no quede código residual del antiguo enfoque.
6. Eliminar código viejo/residual una vez el nuevo esté validado y funcional.
