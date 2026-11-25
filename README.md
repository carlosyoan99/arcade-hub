# Arcade Engine (+ Arcade Hub legacy)

Este repo tiene dos partes bien separadas:

| Parte | Estado | Tecnología |
| --- | --- | --- |
| **`engine/` — Arcade Engine** | **En desarrollo activo** | TypeScript estricto + Vite + Vitest, plugins nativos |
| `games/`, `shared/`, `index.html` — Arcade Hub | **Congelado como referencia** (32 juegos) | JS vanilla, ES modules, cero dependencias |

El Hub antiguo no se modifica: sus 32 juegos son la referencia de mecánicas y del bugs que el motor nuevo evita por diseño (`docs/Arcade Hub — investigación completa.md`).

## Quick start

```bash
npm install                 # instala workspaces (engine)
npm test -w @arcade/engine  # suite del motor (112 tests)
npm run build -w @arcade/engine
npm run dev -w @arcade/engine          # demo visual Pong / Flappy en Vite
npm run headless -w @arcade/engine -- --ticks 600 --seed 12345
```

El Hub legacy se sirve igual que antes: `python3 -m http.server 8000` y abrir `index.html`.
Sus comprobaciones (`npm run check` en la raíz) siguen disponibles, pero **no se aceptan cambios nuevos en juegos legacy**: las mejoras van al motor y a los juegos migrados en `engine/src/games/`.

## Principios del motor

1. **Simulación determinista:** paso fijo 60 Hz, reloj `tick * dt`, RNG xorshift32 con semilla. Cero `Math.random`, `Date.now` o `setTimeout` dentro de `step()`.
2. **`step()` puro:** no dibuja, no suena, no toca DOM. Emite eventos (`hit`, `score`, `levelUp`) que consumen los plugins de presentación.
3. **Acciones nombradas:** los juegos piden `jump`/`fire`/`flap`; teclado, gamepad, táctil, IA y red inyectan la misma acción.
4. **Plugins nativos:** orden topológico por `requires`, servicios compartidos vía `ctx.services`, hooks `preStep`/`postStep`.
5. **Juegos solo juegan:** `GameDefinition` declara `id`, `meta`, `actions`, `progression`, `init`, `step`, `observe`, `render` y `rules`. Si una función aparece en dos juegos, sube al motor.
6. **Dificultad progresiva y variedad:** curvas declarativas por nivel, DDA oculto y acotado, patrones elegidos con RNG y bolsa sin repetición (`docs/investigacion-dificultad-variedad.md`).
7. **Integridad:** estado serializable, snapshot/restore, hash determinista, replays, cerebros de IA versionados con checksum.

## Arquitectura

```
engine/
  src/
    core/        loop, clock, rng, scheduler, events, state, simulation, plugins
    input/       actions, bindings, entrada virtual (IA/replay/red)
    progression/ curvas de nivel, DDA acotado, selector de patrones
    game/        contrato defineGame + adaptador a simulación
    games/       juegos migrados (pong, flappy, ...)
    ai/          MLP, neuroevolución, agentes, trainer headless, dificultad
    render/      canvas2d, cámara, sprites, partículas, fanout de eventos
    audio/       synth, music, manager
    ui/          shell, hud, help, settings
    store/       storage versionado, scores por modo, achievements
    tools/       headless runner, replay
  test/          Vitest (determinismo, motor, juegos, IA)
  demo/          demo visual Vite
```

### Contrato de un juego

```ts
export const miJuego = defineGame<MiEstado>({
  id: 'mi-juego',
  meta: { title: 'Mi juego', players: [1], modes: ['solo', 'vsAI'] },
  actions: ['left', 'right', 'fire'],
  progression: {
    id: 'mi-juego',
    levels: [{ speed: 1 }, { speed: 1.15 }, { speed: 1.3 }],
    pointsPerLevel: 10,
    patterns: ['a', 'b', 'c'],
  },
  init(seed, ctx) { /* estado inicial, usando ctx.rng */ },
  step(state, ctx) {
    ctx.progression.update(state.score);
    /* lógica del juego; ctx.schedule, ctx.emit, ctx.actions */
  },
  observe(state, playerId) { return new Float32Array([...]); },
  rules: { isOver, winner, score, fitness },
});
```

## Estado de migración

- ✅ Motor F0-F3 validado: 112 tests en verde, build y headless OK.
- ✅ Pong y Flappy migrados con progresión y patrones.
- ⏳ Resto del catálogo en migración por batches; el estado exacto está en `TODO.md`.

## Documentación

| Documento | Contenido |
| --- | --- |
| `AGENTS.md` | Orientación rápida para agentes y colaboradores |
| `CLAUDE.md` | Convenciones técnicas del motor y del legado |
| `CONTRIBUTING.md` | Cómo migrar un juego y checklist |
| `TODO.md` | roadmap activo del motor |
| `docs/Arcade Engine — definición del proyecto (v0).md` | visión, arquitectura, roadmap F0-F7 |
| `docs/Arcade Hub — investigación completa.md` | auditoría de los 32 juegos y bugs B1-B8 |
| `docs/DDT-F0-fundamentos.md` | decisiones y diseño del núcleo/plugins |
| `docs/DDT-F2-primeros-juegos.md` | Pong y Flappy como validación del contrato |
| `docs/investigacion-dificultad-variedad.md` | curvas y adaptación moderna por juego |

## Licencia

MIT. Los juegos legacy se conservan únicamente como referencia histórica; no se aceptan cambios nuevos en ellos.
