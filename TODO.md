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
- [x] `shared/input.js` — createGamepad() + bindHoldButton() — gamepad y táctil compartidos (acepta elemento o id string)

### Skills instaladas (26 disponibles + 5 assets + 32 referencias)

- [x] Core: `frontend-design`, `game-engine`, `game-feel`, `refactor`, `git-commit`
- [x] UI/UX: `premium-frontend-ui`, `game-ui-ux`, `performance-optimization`
- [x] Juego: `game-ai`, `procedural-gen`, `audio-design`, `physics-tuning`, `level-design`, `input-systems`, `dialogue-systems`, `save-systems`, `shader-programming`, `camera-systems`
- [x] Docs/plan: `create-implementation-plan`, `refactor-plan`, `create-readme`, `create-specification`, `documentation-writter`
- [x] Calidad: `audit-integrity`, `context-map`, `create-agentsmd`
- [x] 5 assets (paddle-game-template, 2d-maze-game, 2d-platform-game, gameBase-template-repo, simple-2d-engine)
- [x] 32 referencias técnicas (noise, dungeon-generation, pathfinding, behavior-trees, etc.)

---

## ✅ COMPLETADO — Fase R1–R4: Refactor (verificado por code search)

> Fases de refactorización que el TODO anterior marcaba como pendientes pero ya están completadas.

### R1 — Renombrar vars 3D vestigios

- [x] Buscar `ball.z`, `paddle.z`, `player.z` → renombrar a `.y`
- [x] **2026-07-31**: Snake migrado por completo — coordenadas de grid `.z`/`.dz` → `.y`/`.dy` (último vestigio 3D)
- **Verificado: 0 matches** en `games/*/script.js`. ✅ COMPLETADO

### R2 — Extraer game loop compartido

- [x] Crear `shared/loop.js` con `createGameLoop()`
- [x] Migrar 19/19 juegos de RAF manual a `createGameLoop()`
- **Verificado: 19/19 juegos** importan `createGameLoop`. ✅ COMPLETADO

### R3 — Eliminar magic numbers

- [x] Constantes extraídas en flappy-bird, frogger, tetris, galaga (commit b413f74)
- [x] Constantes extraídas en centipede, defender, missile-command, neon-nexus, dino-runner (commit 6ae619e)
- **Verificado: extracción R3 documentada en 9 juegos**. ✅ COMPLETADO

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
- [x] **P0-extra (2026-07-31)**: Migración total de `ctx.shadowBlur` → glows sin blur en 19/19 juegos — `fillWithGlow()`/`strokeWithGlow()` nuevos en `shared/effects.js` + `drawGlow()` para círculos. Verificado: **0 usos de `shadowBlur` restantes** en `games/*/script.js`.
- [ ] **P10**: Probar rendimiento con Chrome DevTools Performance tab

**Nota:** Tras la migración de P9 quedaban ~115 usos decorativos de `ctx.shadowBlur` (fondos, HUD, bordes, entidades fuera de loops) — todos migrados a la técnica de halo translúcido (`fillWithGlow`/`strokeWithGlow`) el 2026-07-31.

---

## ✅ COMPLETADO — A11y: Auditoría de accesibilidad (2026-07-31)

Auditoría de hub + 19 juegos (foco, contraste, reduced-motion, ARIA, touch targets) con arreglos priorizados implementados.

- [x] **A11y-1**: Modal de ayuda (`shared/help.js`) → `role="dialog"`, `aria-modal`, `aria-labelledby`, botón cerrar con `aria-label`, **focus trap con Tab/Shift+Tab**, foco movido al abrir y **restaurado al cerrar**, changelog como `<button>` real con `aria-expanded`
- [x] **A11y-2**: Quitar `user-scalable=no` del viewport en **19/19** juegos (permite zoom/pinch en móvil) + `touch-action: manipulation` en canvas (mantiene pinch-zoom, evita doble-tap) en `shared/base.css`
- [x] **A11y-3**: `role="img"` en el canvas de **19/19** juegos (aria-label anunciado correctamente)
- [x] **A11y-4**: `:focus-visible` global con `--accent` + ring especial en gameBar/touchControls (`shared/base.css`); touch targets gameBar ≥ 44×40px
- [x] **A11y-5**: Hub — badge corregido a 19 juegos, `aria-label` en `sortSelect`, `:focus-visible` en toolbar (themeToggle, view-btn, select)

**Ya presente (verificado):** `aria-live`/`aria-atomic` en `#announce` (dom.js), `aria-label` en botones táctiles 19/19, `prefers-reduced-motion` en hub + base.css + `setShakeScale(0)`, `trapTab` en 19/19, focus-visible en cards del hub, `lang="es"`, alt en thumbnails.

---

## ✅ COMPLETADO — Fase G1–G5: Game Feel (verificado por code search)

> `skill("game-feel")` aplicado en 19/19 juegos.

- [x] **G1**: Sistema de feedback por tiers (`feedbackBundle`) en `shared/effects.js`
- [x] **G2**: Screen shake suave por trauma (ondas sinusoidales + `setShakeScale()`)
- [x] **G3**: Hit-stop / freeze frame (`hitStop()`, `isHitStopped()`)
- [x] **G4**: Squash & stretch en saltos/landings (Pong, Breakout, Asteroids, DK, Joust)
- [x] **G5**: **19/19 juegos** — feedbackBundle integrado; updateSquashes en game loops de 15/19 (4 juegos sin squash: cell-swarm, neon-nexus, missile-command, dino-runner)
- [x] **G6**: Accesibilidad — prefers-reduced-motion → `setShakeScale(0)` + listener change en vivo
- **Verificado: `feedbackBundle` en 19/19, `updateSquashes` en 15/19, `clearSquashes` en 19/19**. ✅ COMPLETADO

---

## ✅ COMPLETADO — Fase H1: Premium Hub UI (7/7)

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

## ✅ COMPLETADO — Fase D: Documentación (6/6)

> Fase D1–D4 completada y **expandida (2026-08-01)** con documentación avanzada: README principal reescrito, CONTRIBUTING.md nuevo, 19 READMEs sincronizados y screenshot 19/19.

| #   | Tarea                               | Estado      | Detalle                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | **Actualizar READMEs de 19 juegos** | ✅ Completo | Reescritos con versión sincronizada con `metadata.json`, sección Logros (condiciones reales del código), Changelog y accesibilidad (2026-08-01)                                                                                                                          |
| D2  | **Actualizar CLAUDE.md**            | ✅ Completo | Skills listadas (26+5+32), fases verificadas, sección de estado de fases añadida                                                                                                                                                                                         |
| D3  | **Actualizar README principal**     | ✅ Completo | **Estado: pendiente → completado (2026-08-01).** Reescrito con documentación avanzada: badges, tabla de 19 juegos con versiones, anatomía (5 archivos + screenshot), módulos `shared/` con exports reales, accesibilidad, testing/validación, versionado, workflow y FAQ |
| D4  | **Actualizar metadata.json**        | ✅ Completo | Version bump (12×1.5.0, 4×1.4.0, 3×1.3.0) + changelog G1-G5/P0/lint por juego                                                                                                                                                                                            |
| D5  | **CONTRIBUTING.md (nuevo)**         | ✅ Completo | Guía de contribución: TL;DR, setup, 9 pasos para agregar un juego, estándares de código, validación, workflow y checklist de PR (2026-08-01)                                                                                                                             |
| D6  | **Screenshot 19/19**                | ✅ Completo | `screenshot.png` de joust generado (último faltante, 1024×768 gameplay vía Chrome headless) — los 19 juegos tienen captura                                                                                                                                               |

---

## ✅ COMPLETADO — Mejoras menores: validación e infraestructura (7/7)

> Implementado a partir del documento de mejoras priorizadas (julio 2026). Cierra el punto "un `npm run check` completo dejaría de ser solo lint/format y pasaría a validar que el proyecto realmente funciona".

| #   | Mejora                               | Estado | Detalle                                                                                                                                                                                                           |
| --- | ------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | **`shared/input.js`** (nuevo)        | ✅     | `createGamepad()` (listeners internos + getter `pad`) y `bindHoldButton()` unificado (elemento **o** id string, `onUp?.()`) — cubre las 4 variantes de pong/breakout/pacman/space-invaders. 19/19 juegos migrados |
| M2  | **`scripts/verify.js`** (nuevo)      | ✅     | Consistencia: juego en disco ↔ `games.js`, archivos requeridos por juego, imports `shared/*.js` ↔ `sw.js` FILES, ruta del juego en FILES + warning `staleShared`. Corre en CI antes del deploy                    |
| M3  | **`test/smoke.test.js`** (nuevo)     | ✅     | 19 smoke tests jsdom — cada juego importa sin error y valida `#gameCanvas`/`#overlay`/`#helpBtn`. Canvas mockeado con Proxy, `window.matchMedia` parcheado, globals restaurados                                   |
| M4  | **prefers-reduced-motion en canvas** | ✅     | `initAccessibility()` en `shared/effects.js` escucha `matchMedia` y apaga shake + partículas (`setShakeScale(0)`/`setParticlesScale(0)`) en un solo lugar (no solo CSS)                                           |
| M5  | **`package-lock.json` versionado**   | ✅     | Quitado del `.gitignore` → instalaciones reproducibles en CI y clones                                                                                                                                             |
| M6  | **CLAUDE.md con skills completas**   | ✅     | `audit-integrity`, `context-map`, `create-agentsmd` documentadas — 21/21 complementarias en CLAUDE.md                                                                                                             |
| M7  | **`.prettierignore`**                | ✅     | `.agents/skills/` ignorado (docs de IA que nunca pasaron Prettier — 48 archivos); el resto del repo queda formateado                                                                                              |

### 🔧 Flujo de validación (nuevo)

| Script           | Qué valida                                                                   | Exit |
| ---------------- | ---------------------------------------------------------------------------- | ---- |
| `npm run lint`   | ESLint — 0 errores, 0 warnings                                               | 0    |
| `npm run format` | Prettier — todos los archivos formateados (`**/*.{js,mjs,css,html,json,md}`) | 0    |
| `npm run verify` | Consistencia: `games.js` ↔ disco ↔ imports shared ↔ `sw.js` FILES            | 0    |
| `npm test`       | 19 smoke tests jsdom (`node --test test/**/*.test.js`)                       | 0    |
| `npm run check`  | **lint + format + verify + test en serie**                                   | 0    |

> ✅ Verificado: lint 0/0, prettier OK, verify consistente (19 juegos / 8 shared / 69 SW FILES), 19/19 tests.

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
| **D**     | `create-readme`       | Documentación       | ✅ **Completado** (D1-D6)              |
| **M**     | `audit-integrity`     | Mejoras menores     | ✅ **Completado** (7/7)                |
| **P10**   | DevTools              | Pruebas rendimiento | 🔲 **Pendiente**                       |
| **N1**    | `game-engine`         | Nuevos juegos       | 🟢 **Futuro**                          |

---

## 📦 metadata.json — Versiones actuales

> Verificado: 19/19 juegos bumpados (Fase D4, 2026-07-30) con changelog de G1-G5, P0 y lint fixes.

| Versión | Juegos                                                                                                                  |
| ------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1.5.0   | Pong, Breakout, Snake, Asteroids, Space Invaders, Flappy Bird, Pac-Man, Tetris, Frogger, Galaga, Centipede, Dino Runner |
| 1.4.0   | Dig Dug, Missile Command, Cell Swarm, Neon Nexus                                                                        |
| 1.3.0   | Defender, Donkey Kong, Joust                                                                                            |
