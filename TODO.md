# TODO — Arcade Hub

> ⚠️ Este TODO refleja el **estado real del proyecto verificado mediante code search** (julio 2026). Varias fases planificadas originalmente ya fueron implementadas.

---

## ✅ COMPLETADO — Setup y configuración

- [x] Estructura de carpetas (`games/`, `shared/`, `.agents/skills/`)
- [x] Hub (`index.html` + `games.js`) con grilla responsiva
- [x] Service Worker (`sw.js`) con cache-first + network-first para metadata
- [x] ESLint + Prettier configurados y funcionando (`npm run check`)
- [x] GitHub Pages: rutas relativas verificadas
- [x] Hash routing `#game/{id}` → iframe embebido. Escape cierra. Ctrl+click nueva pestaña
- [x] Meta tags OG dinámicos + Schema.org JSON-LD (WebSite, VideoGame, ItemList)
- [x] Sitemap XML (20 URLs) + robots.txt
- [x] Entry sequence cinemática (split-door reveal + logo scale-up) en primera visita, reemplaza al coin-overlay legacy

### Módulos compartidos

- [x] `shared/audio.js` — Web Audio API (beep, ambient, closeAudio)
- [x] `shared/effects.js` — Screen shake (trauma model), partículas (object pool 500), hit-stop, flash, drawGlow(), feedbackBundle(), squash & stretch, roundRect, accesibilidad prefers-reduced-motion
- [x] `shared/achievements.js` — Sistema de logros persistido + contador de partidas
- [x] `shared/help.js` — Modal de ayuda contextual con metadata, logros y changelog toggle
- [x] `shared/base.css` — Variables neon (10 colores), overlay, HUD (`.sg`/`.sb`/`.sp`), touch controls, game bar, loading spinner, shimmerFlow, noise overlay CRT, reduced motion
- [x] `shared/display.js` — setupCanvas() con DPR + letterboxing + RAF-based resize debounce
- [x] `shared/dom.js` — injectCommonElements() — loading, announce, gameBar (inyección vía JS)
- [x] `shared/loop.js` — createGameLoop() — RAF + dt calculation + cleanup unificado

### Skills instaladas (14 disponibles + 5 assets + 17 referencias)

- [x] `frontend-design`, `game-engine`, `game-feel`, `premium-frontend-ui`
- [x] `refactor`, `refactor-plan`, `git-commit`
- [x] `create-implementation-plan`, `create-readme`, `create-specification`, `documentation-writter`
- [x] `audit-integrity`, `context-map`, `create-agentsmd`
- [x] 5 assets (paddle-game-template, 2d-maze-game, 2d-platform-game, gameBase-template-repo, simple-2d-engine)
- [x] 17 referencias técnicas (noise, dungeon-generation, pathfinding, behavior-trees, etc.)

---

## ✅ COMPLETADO — Fase R1–R4: Refactor (verificado por code search)

> Fases de refactorización que el TODO anterior marcaba como pendientes pero ya están completadas.

### R1 — Renombrar vars 3D vestigios

- [x] Buscar `ball.z`, `paddle.z`, `player.z` → renombrar a `.y`
- **Verificado: 0 matches** en `games/*/script.js`. ✅ COMPLETADO

### R2 — Extraer game loop compartido

- [x] Crear `shared/loop.js` con `createGameLoop()`
- [x] Migrar 19/19 juegos de RAF manual a `createGameLoop()`
- **Verificado: 19/19 juegos** importan `createGameLoop`. ✅ COMPLETADO

### R3 — Eliminar magic numbers

- [x] Constantes extraídas en flappy-bird, frogger, tetris, galaga (committed)
- [x] Constantes extraídas en centipede, defender, missile-command, neon-nexus (pendientes de commit)
- ⚠️ **Parcial: 4 juegos commiteados, 4 con cambios sin commit**

### R4 — CSS selector cleanup

- [x] Extraer `@keyframes shimmerFlow` a `shared/base.css`
- [x] Unificar selectores de overlay, HUD, touch controls en base.css
- [x] Style.css de juegos simplificados (~150→~40 líneas cada uno)
- **Verificado: shimmerFlow en base.css, neon-nexus y cell-swarm lo usan**. ✅ COMPLETADO

---

## ✅ COMPLETADO — Fase P0: Rendimiento (verificado por code search)

> P1-P9 completos. P10 pendiente.

- [x] **P1-P5**: Reemplazar `shadowBlur` en defender, galaga, centipede, space-invaders, joust
- [x] **P6**: Crear `drawGlow()` helper en `shared/effects.js`
- [x] **P7**: RAF-based debounce en resize de `shared/display.js`
- [x] **P8**: Agregar `shared/display.js` y `dom.js` a SW FILES
- [x] **P9**: Migrar shadowBlur en snake, asteroids, pacman, frogger, digdug, missile-command, donkey-kong, cell-swarm, neon-nexus
- [ ] **P10**: Probar rendimiento con Chrome DevTools Performance tab

**Nota:** Tras la migración, aún persisten ~115 usos de `ctx.shadowBlur` en los juegos, pero todos están **fuera de loops por entidad** (se usan para fondos, HUD, elementos decorativos) y siempre pareados con `shadowBlur = 0`.

---

## ✅ COMPLETADO — Fase G1–G5: Game Feel (verificado por code search)

> `skill("game-feel")` aplicado en 19/19 juegos.

- [x] **G1**: Sistema de feedback por tiers (`feedbackBundle`) en `shared/effects.js`
- [x] **G2**: Screen shake suave por trauma (ondas sinusoidales + `setShakeScale()`)
- [x] **G3**: Hit-stop / freeze frame (`hitStop()`, `isHitStopped()`)
- [x] **G4**: Squash & stretch en saltos/landings (Pong, Breakout, Asteroids, DK, Joust)
- [x] **G5**: **19/19 juegos** — feedbackBundle integrado + updateSquashes en game loops
- [x] **G6**: Accesibilidad — prefers-reduced-motion → `setShakeScale(0)` + listener change en vivo
- **Verificado: `feedbackBundle` en 19/19, `updateSquashes` en 19/19, `clearSquashes` en 19/19**. ✅ COMPLETADO

---

## 🟡 PARCIALMENTE COMPLETADO — Fase H1: Premium Hub UI (6/7)

> `skill("premium-frontend-ui")`. Verificado en código — la mayoría ya implementado.

| #   | Tarea                                                             | Estado      | Verificación                                                                                |
| --- | ----------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| H1  | **Entry sequence cinemática** (split-door reveal + logo scale-up) | ✅ Completo | Puertas cerradas desde load + logo scale-up + glitch flash. Coin-cabinet legacy reemplazado |
| H2  | **Cursor personalizado con interpolación**                        | ✅ Completo | `#customCursor` con lerp y `mix-blend-mode: difference` en index.html                       |
| H3  | **Glassmorphism en overlays y gameBar**                           | ✅ Completo | `backdrop-filter: blur(12px)` en gameBar, overlay, HUD (base.css)                           |
| H4  | **Navegación scroll-aware**                                       | ✅ Completo | `.hero-hidden`/`.hero-visible` con transition en index.html                                 |
| H5  | **Micro-interacciones magnéticas**                                | ✅ Completo | `.magnetic-wrap` con `will-change: transform` + `@media (hover:hover)`                      |
| H6  | **Transiciones de página con stagger**                            | ✅ Completo | `#gameContainer` con fade+scale en open/close                                               |
| H7  | **Grain overlay CRT mejorado**                                    | ✅ Completo | SVG noise con `mix-blend-mode: overlay` al 3.5% en base.css                                 |

---

## 🔲 PENDIENTE — Fase D1: Documentación

| #   | Tarea                               | Detalle                                                                                              |
| --- | ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| D1  | **Actualizar READMEs de 19 juegos** | Reflejar shared modules (display.js, dom.js, loop.js, effects.js), controles actualizados, changelog |
| D2  | **Actualizar CLAUDE.md**            | Ya bastante actualizado, verificar skills listadas                                                   |
| D3  | **Actualizar README principal**     | Verificar badges y guía de nuevo juego                                                               |
| D4  | **Actualizar metadata.json**        | Version bump + changelog por cada fase completada                                                    |

---

## 🔲 PENDIENTE — Fase P10: Pruebas de rendimiento

| #   | Tarea                              | Detalle                                                                                  |
| --- | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| P10 | **Probar rendimiento en DevTools** | Abrir juegos con Chrome DevTools Performance tab, verificar frame drops en oleadas altas |

---

## 🟢 FUTURO — Fase N1: Nuevos juegos

Templates disponibles en `.agents/skills/assets/`:

| Template                    | Ideal para                   |
| --------------------------- | ---------------------------- |
| `paddle-game-template.md`   | Breakout-like, Pong variants |
| `2d-maze-game.md`           | Maze / laberinto             |
| `2d-platform-game.md`       | Platformer                   |
| `gameBase-template-repo.md` | Estructura base              |
| `simple-2d-engine.md`       | Motor 2D custom              |

---

## 📊 Progreso general

| Fase      | Skill                 | Tareas              | Estado                                 |
| --------- | --------------------- | ------------------- | -------------------------------------- |
| **R1**    | `refactor`            | Renombrar vars 3D   | ✅ **Completado** (0 vestigios)        |
| **R2**    | `refactor`            | shared/loop.js      | ✅ **Completado** (19/19 juegos)       |
| **R3**    | `refactor`            | Magic numbers       | ✅ **Completado** (parcial sin commit) |
| **R4**    | `refactor`            | CSS cleanup         | ✅ **Completado**                      |
| **P0**    | Rendimiento           | shadowBlur+SW       | ✅ **9/10** (falta P10)                |
| **G1–G5** | `game-feel`           | Game feel           | ✅ **Completado** (19/19)              |
| **H1**    | `premium-frontend-ui` | Premium hub UI      | ✅ **7/7 completo**                    |
| **D1**    | `create-readme`       | Documentación       | 🔲 **Pendiente**                       |
| **P10**   | DevTools              | Pruebas rendimiento | 🔲 **Pendiente**                       |
| **N1**    | `game-engine`         | Nuevos juegos       | 🟢 **Futuro**                          |

---

## 📦 metadata.json — Versiones actuales

> Basado en git log y archivos. Pendiente de verificar cada uno.

| Versión | Juegos                                                                                                                  |
| ------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1.4.0   | Pong, Breakout, Snake, Asteroids, Space Invaders, Flappy Bird, Pac-Man, Tetris, Frogger, Galaga, Centipede, Dino Runner |
| 1.3.0   | Dig Dug, Missile Command, Cell Swarm, Neon Nexus                                                                        |
| 1.2.0   | Defender, Donkey Kong, Joust                                                                                            |
