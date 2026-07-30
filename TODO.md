# TODO — Arcade Hub

## ✅ Completado

### Setup y configuración

- [x] Estructura de carpetas (`games/`, `shared/`, `.agents/skills/`)
- [x] Hub (`index.html` + `games.js`) con grilla responsiva
- [x] Service Worker (`sw.js`) con cache-first
- [x] ESLint + Prettier configurados y funcionando
- [x] GitHub Pages: rutas relativas verificadas

### Módulos compartidos

- [x] `shared/audio.js` — Web Audio API (beep, ambient)
- [x] `shared/effects.js` — Screen shake, partículas, flash, roundRect
- [x] `shared/achievements.js` — Sistema de logros persistido
- [x] `shared/help.js` — Modal de ayuda contextual con metadata y changelog
- [x] `shared/base.css` — Variables neon, overlay, HUD, touch controls, game bar
- [x] `shared/display.js` — setupCanvas() con DPR + letterboxing
- [x] `shared/dom.js` — injectCommonElements() — loading, announce, gameBar

### Skills instalados (14 disponibles)

- [x] `frontend-design`, `game-engine`, `game-feel`, `premium-frontend-ui`
- [x] `refactor`, `refactor-plan`, `git-commit`
- [x] `create-implementation-plan`, `create-readme`, `create-specification`, `documentation-writter`
- [x] `audit-integrity`, `context-map`, `create-agentsmd`
- [x] 5 assets (templates de juegos) + 17 referencias técnicas

### Hub — diseño y experiencia

- [x] Diseño neon con marquee chase-light border animado en el título
- [x] Tipografía Bungee (display) + Inter (body)
- [x] Paleta intencional: cyan-neon, pink-neon, gold-neon, green-neon
- [x] Contadores animados tipo máquina tragamonedas en stats del hero
- [x] Scroll reveal con IntersectionObserver en achievements/stats
- [x] Fondo animado con canvas (nebulosas, estrellas, grid) con transición de tema
- [x] Selector de tema oscuro/claro con persistencia y transición suave
- [x] Toolbar: búsqueda, orden (defecto/nombre/nuevos/más jugados), toggle grilla/lista
- [x] Ranking Top 3 de juegos más jugados
- [x] Badge "✦ 16 juegos clásicos"
- [x] Scanline overlay CRT subtle
- [x] Meta tags Open Graph + Twitter Card
- [x] Per-game accent colors en tarjetas del hub

### Juegos implementados (19/19)

| Juego              | Estado   | Versión |
| ------------------ | -------- | ------- |
| 🏓 Pong            | ✅ listo | 1.3.0   |
| 🧱 Breakout        | ✅ listo | 1.3.0   |
| 🐍 Snake           | ✅ listo | 1.3.0   |
| 🦖 Dino Runner     | ✅ listo | 1.3.0   |
| 🚀 Asteroids       | ✅ listo | 1.3.0   |
| 👾 Space Invaders  | ✅ listo | 1.3.0   |
| 🐤 Flappy Bird     | ✅ listo | 1.3.0   |
| 🟡 Pac-Man         | ✅ listo | 1.3.0   |
| 🧊 Tetris          | ✅ listo | 1.3.0   |
| 🐸 Frogger         | ✅ listo | 1.3.0   |
| 🛸 Galaga          | ✅ listo | 1.3.0   |
| 🐛 Centipede       | ✅ listo | 1.3.0   |
| ⛏️ Dig Dug         | ✅ listo | 1.2.0   |
| 🚀 Missile Command | ✅ listo | 1.2.0   |
| ◈ Neon Nexus       | ✅ listo | 1.2.0   |
| 🟣 Cell Swarm      | ✅ listo | 1.2.0   |
| 🦍 Donkey Kong     | ✅ listo | 1.1.0   |
| 🚀 Defender        | ✅ listo | 1.1.0   |
| 🦅 Joust           | ✅ listo | 1.1.0   |

### Refactor CSS — base.css + paleta neon

- [x] Variables neon en `shared/base.css` (10 colores)
- [x] Overlay compartido con variables `--overlay-grad-start/end`, `--accent`, `--accent-glow`
- [x] HUD compartido: `.score-group`/`.sg`, `.score-block`/`.sb`, `.score-sep`/`.sp`
- [x] Touch controls compartidos: `#touchControls`/`#tc`, `.dpad`/`.dp`
- [x] Game bar, loading spinner, reduced motion en base.css
- [x] 16 style.css simplificados (~150→~40 líneas cada uno)

### Mejoras por juego

- [x] **Neon Nexus**: 4 cartas nuevas (Drenar, Torreta Aux, Escudo Regenerativo, Ralentización Global)
- [x] **Neon Nexus**: Fix multishot (dispara a diferentes enemigos)
- [x] **Neon Nexus**: Balance — HP escalado reducido 0.35→0.28 por oleada
- [x] **Cell Swarm**: IA con 5 personalidades (aggressive, timid, balanced, hunter, coward)
- [x] **Cell Swarm**: Esquiva de proyectiles por bots
- [x] **Cell Swarm**: Sistema de skins (países, emojis, degradados)
- [x] **Cell Swarm**: Split/Eject con coordenadas mundo corregidas
- [x] **Ayuda**: Fix modal en Neon Nexus y Cell Swarm (faltaban en el objeto GAMES de help.js)

### Deuda técnica — ESLint

- [x] Variables/funciones sin usar eliminadas en asteroids, dino-runner, flappy-bird, frogger, space-invaders, tetris
- [x] Imports sin usar (stopAmbient, clearParticles) eliminados
- [x] `catch(e)` → `catch {}` en shared/audio.js
- [x] `let` → `const` donde correspondía (gP, prevGamepad)
- [x] 23 warnings → 0 en total

### Documentación

- [x] README.md del proyecto con descripción, estructura, guía de nuevo juego
- [x] CLAUDE.md con convenciones, skills y flujo de trabajo
- [x] TODO.md con tareas completadas y pendientes priorizados
- [x] 19 README.md por juego con controles y descripción
- [x] 19 metadata.json actualizados con versiones y changelog

---

## 📋 Pendientes

### ✅ Completados (ronda crítica)

- [x] **Commit + push** — Todos los cambios acumulados en GitHub (commit `75fa438`)
- [x] **Capturas en README.md** — 18 screenshots tomadas con Chrome headless
- [x] **Prettier — index.html** — Pasa `prettier --check` sin problemas
- [x] **Nuevo juego: Joust** — Implementado con 5 archivos, registrado en hub + SW + ayuda
- [x] **Logros de Joust** — 3 logros (Primera justa, Cazador de huevos, Imbatible) en help.js + script.js

### ✅ Completados (ronda rendimiento + accesibilidad)

| #   | Tarea                                 | Archivos                        | Logrado                                                                                                            |
| --- | ------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | **High-DPI scaling (Retina)**         | 19 `games/*/script.js`          | `devicePixelRatio` en todos los canvas. Eliminado blur en Retina.                                                  |
| 2   | **Alpha channel desactivado**         | 19 `games/*/script.js`          | `{ alpha: false }` en todos los contextos 2D. Optimización compositor.                                             |
| 3   | **Memory leaks — cleanup**            | asteroids, frogger, tetris      | `cleanup()` + `stopAmbient()` + `closeAudio()` en `beforeunload`/`pagehide`.                                       |
| 4   | **Object pooling partículas**         | `shared/effects.js`             | Pool de 500 partículas, `allocParticle()` recicla. Sin GC pressure.                                                |
| 5   | **Accesibilidad canvas**              | 19 `games/*/` + `index.html`    | `aria-label`, `aria-live`, focus trapping con `trapTab()`, `say()` helper.                                         |
| 6   | **Anti-tunneling inconsistente**      | 7 juegos rápidos                | Sub-pasos en Asteroids, Defender, Space Invaders, Galaga, Centipede, Neon Nexus. Joust dt cap 0.03→0.05 unificado. |
| 7   | **Service Worker — estrategias**      | `sw.js`                         | Network-first para metadata, cache-first para assets. Múltiples cachés.                                            |
| 8   | **Hash routing hub↔juego**            | `index.html` + 19 scripts       | `#game/{id}` → iframe. Escape para cerrar. Ctrl+click para new tab.                                                |
| 9   | **Variable `particles` local muerta** | cell-swarm, neon-nexus, digdug  | Eliminadas declaraciones locales que sombreaban el pool.                                                           |
| 10  | **Modo claro — contraste WCAG AA**    | `shared/base.css`, `index.html` | `--text-secondary` 0.4→0.55 (~4.58:1). `--text-dim` #6a6890→#5d5b7a (~5.45:1).                                     |

### ✅ Completados (ronda hub — UX)

| #   | Tarea                      | Archivos     | Logrado                                                                                 |
| --- | -------------------------- | ------------ | --------------------------------------------------------------------------------------- |
| 11  | **Título HTML dinámico**   | `index.html` | `document.title` se actualiza con el nombre del juego al abrir vía hash routing.        |
| 12  | **Meta tags OG dinámicos** | `index.html` | `og:title`, `og:description`, `twitter:title`, `twitter:description` cambian por juego. |
| 15  | **Botón Sorpresa**         | `index.html` | 🎲 en toolbar → juego al azar de los disponibles.                                       |
| 16  | **Hover sonoro**           | `index.html` | Sine tone 660±220Hz, gain 0.04, 0.08s. AudioContext lazy, throttle 100ms.               |

### ✅ Completados (ronda SEO + nostalgia)

| #   | Tarea                               | Archivos                                  | Logrado                                                                                                           |
| --- | ----------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 14  | **Animación "inserción de moneda"** | `index.html`                              | Overlay retro con cabinet arcade, 🪙 animada, INSERT COIN parpadeante, glitch flash. Solo una vez (localStorage). |
| 17  | **Schema.org / JSON-LD**            | `index.html`                              | WebSite + VideoGame (dinámico por juego) + ItemList. Rich snippets de Google.                                     |
| 18  | **Sitemap XML + robots.txt**        | `sitemap.xml`, `robots.txt`, `index.html` | 20 URLs (hub + 19 juegos). Prioridades, frecuencias, lastmod. Link en `<head>`.                                   |

### ✅ Completados (Fase de refactor — shared modules)

| #   | Tarea                                   | Archivos                       | Logrado                                                                                      |
| --- | --------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------- |
| F1  | **Canvas ID unificado + setupCanvas()** | `shared/display.js`, 18 juegos | Unificado #gc→#gameCanvas + extraído resizeCanvas() a setupCanvas(). ~150 líneas eliminadas. |
| F2  | **HUD IDs unificados**                  | 9 juegos (HTML+JS)             | sc→scoreValue, lv→livesValue, bst→bestValue, etc. Nombres legibles.                          |
| F3  | **HTML compartido inyectado via DOM**   | `shared/dom.js`, 19 juegos     | loading+announce+gameBar inyectados vía JS. ~228 líneas HTML eliminadas.                     |

### 📦 metadata.json actualizados (19 juegos)

| Versión     | Juegos                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1.2.0→1.3.0 | pong, asteroids, snake, dino-runner, space-invaders, flappy-bird, pac-man, tetris, breakout, centipede, galaga, frogger |
| 1.1.0→1.2.0 | digdug, missile-command, cell-swarm, neon-nexus                                                                         |
| 1.0.0→1.1.0 | defender, donkey-kong, joust                                                                                            |

---

## 🔥 Fase P0 — Rendimiento: shadowBlur, resize debounce y SW

> Auditoría de rendimiento (julio 2026). **Problema crítico:** 192 usos de `ctx.shadowBlur` en 19 juegos. En 5 juegos se activa **dentro de loops por entidad**, haciendo que el costo del blur escale con la cantidad de enemigos. Se agrava en pantallas DPR altas. **Fix:** reemplazar por glow translúcido con doble `arc()+fill()`, misma técnica que ya usa `shared/effects.js`.

| #   | Tarea                                             | Archivos                         | Detalle técnico                                                                                                           |
| --- | ------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| P1  | **Reemplazar shadowBlur en defender**             | `games/defender/script.js`       | ✅ 22 usos reemplazados por drawGlow() en drawEnemies(), drawHumans(), drawEnemyLasers().                                 |
| P2  | **Reemplazar shadowBlur en galaga**               | `games/galaga/script.js`         | ✅ 12 usos reemplazados en formación, diving, bullets loops.                                                              |
| P3  | **Reemplazar shadowBlur en centipede**            | `games/centipede/script.js`      | ✅ 15+ usos reemplazados en mushrooms, segments, bullets, flea, scorpion, spider.                                         |
| P4  | **Reemplazar shadowBlur en space-invaders**       | `games/space-invaders/script.js` | ✅ 12 usos reemplazados en drawInvader() (per-invader) y bullets loops.                                                   |
| P5  | **Reemplazar shadowBlur en joust**                | `games/joust/script.js`          | ✅ 15+ usos reemplazados en plataformas, huevos, enemigos loops.                                                          |
| P6  | **Crear drawGlow() helper en shared/effects.js**  | `shared/effects.js`              | ✅ `drawGlow(ctx, x, y, r, color, alpha, mult)` — doble `arc()+fill()` sin shadowBlur.                                    |
| P7  | **Debounce en resize de display.js**              | `shared/display.js`              | ✅ RAF-based debounce + fix destroy() (elimina listener correcto + cancela timer pendiente).                              |
| P8  | **Agregar shared/display.js y dom.js a SW FILES** | `sw.js`                          | ✅ Agregados al array FILES. STATIC_CACHE v4→v5. Arregla offline.                                                         |
| P9  | **Migrar shadowBlur en otros 9 juegos**           | 9 `games/*/script.js`            | ✅ snake, asteroids, pacman, frogger, digdug, missile-command, donkey-kong, cell-swarm, neon-nexus migrados a drawGlow(). |
| P10 | **Probar rendimiento**                            | Todos los juegos                 | 🔲 Pendiente — abrir con Chrome DevTools Performance tab para verificar frame drops en oleadas altas.                     |

---

## 🚀 Plan de mejoras — Skills aplicados

> Basado en auditoría de los **14 skills** disponibles en `.agents/skills/`. Cada fase usa `skill("nombre")` antes de implementar.

### 🔴 Fase G1 — Game Feel: jugosidad en los 19 juegos

**Skill a cargar:** `game-feel` → agrega screen shake, hit-stop, squash & stretch, knockback y retroalimentación visual multicapa.

**Objetivo:** Transformar mecánicas funcionales → experiencias satisfactorias.

| #   | Tarea                                   | Archivos impactados                           | Detalle técnico                                                                                          |
| --- | --------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| G1  | **Sistema de feedback por tiers**       | `shared/effects.js`                           | ✅ `feedbackBundle(tier, x, y, opts)` con small/medium/large presets                                      |
| G2  | **Screen shake suave por trauma**       | `shared/effects.js`                           | ✅ Refactor a trauma decayente con ondas sinusoidales + `setShakeScale()`                                 |
| G3  | **Hit-stop / freeze frame**             | `shared/effects.js`                           | ✅ `hitStop(duration)` + `isHitStopped()` — real-time, no bloquea input                                  |
| G4  | **Squash & stretch en saltos/landings** | Pong, Breakout, Asteroids, DK, Joust          | ✅ `triggerSquash()`, `updateSquashes()`, `getSquash()`, `drawWithSquash()` en 5 juegos                   |
| G5  | **Feedback por juego**                  | 19 `games/*/script.js`                        | ✅ **19/19** — feedbackBundle integrado en todos los juegos con updateSquashes en game loops             |
| G6  | **Accesibilidad**                       | `shared/effects.js`                           | ✅ `prefers-reduced-motion` → `setShakeScale(0)` + listener change en vivo                               |

**Skills assets útiles:** `references/feedback-recipes.md` (recetas de feedback por tier).

---

### 🔴 Fase H1 — Premium Hub: UI inmersiva de alto nivel

**Skill a cargar:** `premium-frontend-ui` → entry sequence, micro-interacciones, glassmorphism, navegación fluida.

**Objetivo:** Elevar el hub de "funcional" a "inolvidable" con detalles de estudio AAA.

| #   | Tarea                                      | Archivos          | Detalle técnico                                                                                            |
| --- | ------------------------------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| H1  | **Entry sequence cinemática**              | `index.html`      | Reemplazar coin-insert por preloader animado con split-door reveal + logo scale-up + staggered text sweep  |
| H2  | **Cursor personalizado con interpolación** | `index.html`      | Custom cursor con lerp suave, magnetic hover en botones (pointer-fine only). `will-change: transform`      |
| H3  | **Glassmorphism en overlays y gameBar**    | `shared/base.css` | `backdrop-filter: blur(12px)` + bordes semitransparentes + noise overlay sutil (`mix-blend-mode: overlay`) |
| H4  | **Navegación scroll-aware**                | `index.html`      | Header sticky se oculta al scrollear abajo, reaparece al scrollear arriba (no en móvil)                    |
| H5  | **Micro-interacciones magnéticas**         | `index.html`      | Botones del toolbar y tarjetas: se acercan al cursor dentro de un radio de 80px con lerp suave             |
| H6  | **Transiciones de página con stagger**     | `index.html`      | Al abrir/cerrar un juego: overlay con fade + scale. Elemtos del hub entran con cascade delay               |
| H7  | **Grain overlay CRT mejorado**             | `index.html`      | SVG noise overlay sutil (opacity 0.02-0.04) para eliminar esterilidad digital. Respetar reduced-motion     |

**⚠️ Rendimiento:** Solo animar `transform` y `opacity`. Usar `will-change` con moderación. Todo cursor magnetico envuelto en `@media (hover: hover) and (pointer: fine)`.

---

### 🟡 Fase R1 — Refactor: limpieza de deuda técnica

**Skills a cargar:** `refactor-plan` (planificar) → `refactor` (ejecutar).

**Objetivo:** Eliminar code smells y unificar patrones entre juegos.

| #   | Tarea                                  | Archivos impactados            | Detalle técnico                                                                         |
| --- | -------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------- |
| R1  | **Renombrar vars 3D: ball.z → ball.y** | 19 `games/*/script.js`         | Buscar `ball.z`, `paddle.z`, `player.z` → renombrar a `.y` (eran vestigios de Three.js) |
| R2  | **Extraer game loop compartido**       | `shared/`                      | Unificar patrón `requestAnimationFrame` + `dt` + `update()` + `draw()` en un helper     |
| R3  | **Eliminar magic numbers**             | 19 `games/*/script.js`         | Constantes nombradas para velocidades, tamaños, colores, timers                         |
| R4  | **CSS selector cleanup**               | `shared/base.css`, game styles | Detectar y corregir selectores que se cancelan entre sí (especificidad conflictiva)     |
| R5  | **Unificar naming de game state**      | 19 `games/*/script.js`         | Estandarizar objeto de estado: `state.score`, `state.lives`, `state.best` en todos      |

**Invocar** `skill("refactor-plan")` antes de empezar R1 para crear un plan estructurado multi-archivo.

---

### 🟡 Fase D1 — Documentación: READMEs actualizados

**Skills a cargar:** `create-readme` (por juego) + `documentation-writter` (documentación general).

**Objetivo:** READMEs de los 19 juegos reflejando la arquitectura actual (display.js, dom.js, Fases 1-3).

| #   | Tarea                                       | Archivos                | Detalle técnico                                                      |
| --- | ------------------------------------------- | ----------------------- | -------------------------------------------------------------------- |
| D1  | **Actualizar READMEs de 19 juegos**         | `games/*/README.md`     | Reflejar shared modules, controles actualizados, changelog por juego |
| D2  | **Actualizar CLAUDE.md**                    | `CLAUDE.md`             | Skills reales listados (14), estructura actual, convenciones         |
| D3  | **Actualizar README principal**             | `README.md`             | Skills disponibles, guía de nuevo juego actualizada, badges          |
| D4  | **Actualizar metadata.json si corresponde** | `games/*/metadata.json` | Version bump + changelog por cada fase completada                    |

---

### 🟢 Fase N1 — Nuevos juegos (futuro)

**Skills a cargar:** `game-engine` (usar templates de `assets/`) + `frontend-design` (identidad visual).

**Objetivo:** Agregar juegos usando los 5 templates disponibles.

| Template en `assets/`       | Ideal para                         |
| --------------------------- | ---------------------------------- |
| `paddle-game-template.md`   | Breakout-like, Pong variants       |
| `2d-maze-game.md`           | Maze / laberinto                   |
| `2d-platform-game.md`       | Platformer (Phaser)                |
| `gameBase-template-repo.md` | Estructura base para juegos nuevos |
| `simple-2d-engine.md`       | Motor 2D custom                    |

---

## 📊 Progreso general

| Fase | Skills                          | Tareas | Estado       |
| ---- | ------------------------------- | ------ | ------------ |
| P0   | Rendimiento (shadowBlur+SW)     | 10     | ✅ **9/10**  |
| G1   | `game-feel`                     | 6      | ✅ **6/6 COMPLETADO** |
| H1   | `premium-frontend-ui`           | 7      | 🔲 Pendiente |
| R1   | `refactor-plan`+`refactor`      | 5      | 🔲 Pendiente |
| D1   | `create-readme`+`doc-writter`   | 4      | 🔲 Pendiente |
| N1   | `game-engine`+`frontend-design` | —      | 🟢 Futuro    |

**Total tareas planificadas:** 32 | **Completadas:** 9/32

---

## ✅ Completados anteriores

### ✅ Completados (Fase de refactor — shared modules)

| #   | Tarea                                   | Archivos                       | Logrado                                                                                      |
| --- | --------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------- |
| F1  | **Canvas ID unificado + setupCanvas()** | `shared/display.js`, 18 juegos | Unificado #gc→#gameCanvas + extraído resizeCanvas() a setupCanvas(). ~150 líneas eliminadas. |
| F2  | **HUD IDs unificados**                  | 9 juegos (HTML+JS)             | sc→scoreValue, lv→livesValue, bst→bestValue, etc. Nombres legibles.                          |
| F3  | **HTML compartido inyectado via DOM**   | `shared/dom.js`, 19 juegos     | loading+announce+gameBar inyectados vía JS. ~228 líneas HTML eliminadas.                     |

### 📦 metadata.json actualizados (19 juegos)

| Versión     | Juegos                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1.2.0→1.3.0 | pong, asteroids, snake, dino-runner, space-invaders, flappy-bird, pac-man, tetris, breakout, centipede, galaga, frogger |
| 1.1.0→1.2.0 | digdug, missile-command, cell-swarm, neon-nexus                                                                         |
| 1.0.0→1.1.0 | defender, donkey-kong, joust                                                                                            |
