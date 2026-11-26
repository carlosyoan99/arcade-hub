# Arcade Engine

El repo contiene el motor determinista con los 32 juegos migrados, el servidor de salas online y el HUB estático generado desde `engine/`. El Arcade Hub legacy fue **retirado** el 26-nov-2026; su registro histórico queda en `docs/`.

| Parte | Estado | Tecnología |
| --- | --- | --- |
| **`engine/` — Arcade Engine** | Activo: 32 juegos y HUB sin iframes | TypeScript estricto + Vite + Vitest |
| `server/` — salas online | Activo (F5) | Node + `ws`, lockstep determinista |
| `index.html` + `assets/` (raíz) | Generados por `npm run build:hub` | HTML estático, sin build step en producción |

El HUB publicado conserva los meta/SEO del sitio anterior. No edites `index.html` ni `assets/` a mano: se regeneran desde `engine/index.html` y `engine/demo/`.

## Quick start

```bash
npm install
npm test                    # Vitest del engine (334 tests)
npm run test:server         # tests del servidor de salas
npm run typecheck
npm run build               # librería del engine
npm run build:hub           # publica el HUB en la raíz (index.html + assets/)
npm run dev                 # demo visual en Vite
npm start                   # servidor de salas
npm run check               # toda la verificación
```

### Rollback

Si la retirada del legacy se ha de deshacer, `git revert <hash-del-commit>` (o `git revert HEAD` si es el último commit) restaura el Hub anterior sin tocar `engine/` ni `server/`. El hash golden vigente es `600:3336926330:e22d095e-20`; no cambiarlo sin una razón de física/RNG documentada.

## Principios del motor

1. **Simulación determinista:** paso fijo 60 Hz, reloj `tick * dt`, RNG xorshift32 con semilla. Cero `Math.random`, `Date.now` o `setTimeout` dentro de `step()`.
2. **`step()` puro:** no dibuja, no suena, no toca DOM. Emite eventos (`hit`, `score`, `levelUp`) que consumen los plugins de presentación.
3. **Acciones nombradas:** los juegos piden `jump`/`fire`/`flap`; teclado, gamepad, táctil, IA y red inyectan la misma acción.
4. **Plugins nativos:** orden topológico por `requires`, servicios compartidos vía `ctx.services`, hooks `preStep`/`postStep`.
5. **Juegos solo juegan:** `GameDefinition` declara `id`, `meta`, `actions`, `init`, `step` y `rules`; `progression`, `observe` y `render` son opcionales. Si una función aparece en dos juegos, sube al motor.
6. **Dificultad progresiva y variedad:** curvas declarativas por nivel, DDA oculto y acotado, patrones elegidos con RNG y bolsa sin repetición (`docs/investigacion-dificultad-variedad.md`).
7. **Integridad:** estado serializable, snapshot/restore, hash determinista, replays, cerebros de IA versionados con checksum.

## Arquitectura

```
engine/
  src/
    core/        loop, clock, rng, scheduler, events, state, simulation, plugins, math
    input/       actions (con puntero y axis), bindings, entrada virtual (IA/replay/red)
    sim/         grid, collision, pathfinding (servicios compartidos)
    progression/ curvas de nivel, DDA acotado, selector de patrones
    game/        contrato defineGame, adaptador, lifecycle, reglas, eventos
    games/       los 32 juegos migrados (`engine/src/games/<id>/game.ts`)
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

- ✅ Catálogo completo: los 32 juegos migrados e integrados en `engine/src/games/index.ts` (`GAME_IDS`).
- ✅ 334 tests en verde, `tsc` limpio, build de librería y del HUB OK. Golden hash `600:3336926330:e22d095e-20`.
- ✅ HUB nuevo sin iframes publicado en la raíz; legacy retirado (ver `docs/plan-retirada-legacy.md`).
- ⏳ Pendientes: F5 online y F6 pulido (ver `TODO.md`).

## Documentación

| Documento | Contenido |
| --- | --- |
| `AGENTS.md` | Orientación rápida para agentes y colaboradores |
| `CLAUDE.md` | Convenciones técnicas del motor y del servidor |
| `CONTRIBUTING.md` | Cómo migrar un juego y checklist |
| `TODO.md` | roadmap activo del motor |
| `docs/Arcade Engine — definición del proyecto (v0).md` | visión, arquitectura, roadmap F0-F7 |
| `docs/Arcade Hub — investigación completa.md` | auditoría de los 32 juegos y bugs B1-B8 |
| `docs/arquitectura.md` | fuente canónica de la arquitectura actual |
| `docs/DDT-F0-fundamentos.md` | decisiones, diseño del núcleo/plugins y política de versionado (`0.1.0-alpha.0`) |
| `docs/DDT-F1-presentacion.md` | render, audio, UI y store como plugins |
| `docs/DDT-F2-primeros-juegos.md` | Pong y Flappy como validación del contrato |
| `docs/DDT-F3-IA.md` | MLP, neuroevolución, trainer y dificultad |
| `docs/DDT-F5-online.md` | diseño pendiente de salas ws + lockstep |
| `docs/investigacion-dificultad-variedad.md` | curvas y adaptación moderna por juego |
| `docs/decisiones-skills.md` | inventario y decisiones sobre skills del repo |
| `docs/plan-retirada-legacy.md` | plan ejecutado de retirada del Hub legacy, con rollback |

## Licencia

MIT. El código legacy ya no está en el repo; B1-B8 y el resto de la auditoría se conservan solo como referencia histórica en `docs/`.
