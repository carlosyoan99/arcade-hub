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
- [x] `.agents/skills/frontend-design.md` — Skill de diseño visual instalada

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

### Juegos implementados (18/18)

| Juego              | Estado   | Versión |
| ------------------ | -------- | ------- |
| 🏓 Pong            | ✅ listo | 1.2.0   |
| 🧱 Breakout        | ✅ listo | 1.2.0   |
| 🐍 Snake           | ✅ listo | 1.2.0   |
| 🦖 Dino Runner     | ✅ listo | 1.2.0   |
| 🚀 Asteroids       | ✅ listo | 1.2.0   |
| 👾 Space Invaders  | ✅ listo | 1.2.0   |
| 🐤 Flappy Bird     | ✅ listo | 1.2.0   |
| 🟡 Pac-Man         | ✅ listo | 1.2.0   |
| 🧊 Tetris          | ✅ listo | 1.2.0   |
| 🐸 Frogger         | ✅ listo | 1.2.0   |
| 🛸 Galaga          | ✅ listo | 1.2.0   |
| 🐛 Centipede       | ✅ listo | 1.2.0   |
| ⛏️ Dig Dug         | ✅ listo | 1.1.0   |
| 🚀 Missile Command | ✅ listo | 1.1.0   |
| ◈ Neon Nexus       | ✅ listo | 1.1.0   |
| 🟣 Cell Swarm      | ✅ listo | 1.1.0   |
| 🦍 Donkey Kong     | ✅ listo | 1.0.0   |
| 🚀 Defender        | ✅ listo | 1.0.0   |
| 🦅 **Joust**       | ✅ listo | 1.0.0   |

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
- [x] 18 README.md por juego con controles y descripción
- [x] 18 metadata.json actualizados con versiones y changelog

---

## 📋 Pendientes

### ✅ Completados (ronda crítica)

- [x] **Commit + push** — Todos los cambios acumulados en GitHub (commit `75fa438`)
- [x] **Capturas en README.md** — 18 screenshots tomadas con Chrome headless
- [x] **Prettier — index.html** — Pasa `prettier --check` sin problemas
- [x] **Nuevo juego: Joust** — Implementado con 5 archivos, registrado en hub + SW + ayuda
- [x] **Logros de Joust** — 3 logros (Primera justa, Cazador de huevos, Imbatible) en help.js + script.js

### ✅ Completados (ronda rendimiento + accesibilidad)

| #  | Tarea | Archivos | Logrado |
|----|-------|----------|---------|
| 1  | **High-DPI scaling (Retina)** | 19 `games/*/script.js` | `devicePixelRatio` en todos los canvas. Eliminado blur en Retina. |
| 2  | **Alpha channel desactivado** | 19 `games/*/script.js` | `{ alpha: false }` en todos los contextos 2D. Optimización compositor. |
| 3  | **Memory leaks — cleanup** | asteroids, frogger, tetris | `cleanup()` + `stopAmbient()` + `closeAudio()` en `beforeunload`/`pagehide`. |
| 4  | **Object pooling partículas** | `shared/effects.js` | Pool de 500 partículas, `allocParticle()` recicla. Sin GC pressure. |
| 5  | **Accesibilidad canvas** | 19 `games/*/` + `index.html` | `aria-label`, `aria-live`, focus trapping con `trapTab()`, `say()` helper. |
| 6  | **Anti-tunneling inconsistente** | 7 juegos rápidos | Sub-pasos en Asteroids, Defender, Space Invaders, Galaga, Centipede, Neon Nexus. Joust dt cap 0.03→0.05 unificado. |
| 7  | **Service Worker — estrategias** | `sw.js` | Network-first para metadata, cache-first para assets. Múltiples cachés. |
| 8  | **Hash routing hub↔juego** | `index.html` + 19 scripts | `#game/{id}` → iframe. Escape para cerrar. Ctrl+click para new tab. |
| 9  | **Variable `particles` local muerta** | cell-swarm, neon-nexus, digdug | Eliminadas declaraciones locales que sombreaban el pool. |
| 10 | **Modo claro — contraste WCAG AA** | `shared/base.css`, `index.html` | `--text-secondary` 0.4→0.55 (~4.58:1). `--text-dim` #6a6890→#5d5b7a (~5.45:1). |

### ✅ Completados (ronda hub — UX)

| #  | Tarea | Archivos | Logrado |
|----|-------|----------|---------|
| 11 | **Título HTML dinámico** | `index.html` | `document.title` se actualiza con el nombre del juego al abrir vía hash routing. |
| 12 | **Meta tags OG dinámicos** | `index.html` | `og:title`, `og:description`, `twitter:title`, `twitter:description` cambian por juego. |
| 15 | **Botón Sorpresa** | `index.html` | 🎲 en toolbar → juego al azar de los disponibles. |
| 16 | **Hover sonoro** | `index.html` | Sine tone 660±220Hz, gain 0.04, 0.08s. AudioContext lazy, throttle 100ms. |

### 🟡 Próximas (media prioridad)

| #  | Tarea | Archivos | Detalle |
|----|-------|----------|---------|
| 13 | **Pantalla de carga progresiva** | `index.html` | Barra de progreso al cargar módulos del hub (mejora perceived performance). |
| 14 | **Animación \"inserción de moneda\"** | `index.html` | Secuencia nostálgica animada al cargar el hub. |

### 🟢 Ideas / Mejora continua

| #  | Tarea | Archivos | Detalle |
|----|-------|----------|---------|
| 17 | **Schema.org / JSON-LD (VideoGame)** | `index.html` | Schema markup para rich snippets de Google. |
| 18 | **Sitemap XML** | Raíz del proyecto | Indexación por buscadores. |
| 19 | **Ícono/thumbnail real por juego** | `games/*/` | SVG/PNG por juego. |
| 20 | **Tema visual más distintivo por juego** | `games/*/style.css` | Temas propios más diferenciados. |
