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

### Juegos implementados (16/16)

| Juego | Estado | Versión |
|-------|--------|---------|
| 🏓 Pong | ✅ listo | 1.2.0 |
| 🧱 Breakout | ✅ listo | 1.2.0 |
| 🐍 Snake | ✅ listo | 1.2.0 |
| 🦖 Dino Runner | ✅ listo | 1.2.0 |
| 🚀 Asteroids | ✅ listo | 1.2.0 |
| 👾 Space Invaders | ✅ listo | 1.2.0 |
| 🐤 Flappy Bird | ✅ listo | 1.2.0 |
| 🟡 Pac-Man | ✅ listo | 1.2.0 |
| 🧊 Tetris | ✅ listo | 1.2.0 |
| 🐸 Frogger | ✅ listo | 1.2.0 |
| 🛸 Galaga | ✅ listo | 1.2.0 |
| 🐛 Centipede | ✅ listo | 1.2.0 |
| ⛏️ Dig Dug | ✅ listo | 1.1.0 |
| 🚀 Missile Command | ✅ listo | 1.1.0 |
| ◈ Neon Nexus | ✅ listo | 1.1.0 |
| 🟣 Cell Swarm | ✅ listo | 1.1.0 |

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
- [x] 16 README.md por juego con controles y descripción
- [x] 16 metadata.json actualizados con versiones y changelog

---

## 📋 Pendientes

### 🔴 Alta prioridad

| # | Tarea | Archivos | Detalle |
|---|-------|----------|---------|
| 1 | **Commit + push** | Todos | Cambios acumulados sin commitear (base.css, style.css, READMEs, metadata, docs, fix ayuda) |
| 2 | **Agregar capturas a README.md** | `games/*/README.md` | Cada juego necesita al menos 1 screenshot ilustrando el gameplay |
| 3 | **Prettier — index.html** | `index.html` | Verificar que el hub pase `prettier --check` sin problemas |

### 🟡 Media prioridad

| # | Tarea | Archivos | Detalle |
|---|-------|----------|---------|
| 4 | **Nuevos juegos** | `games/*/` | Candidatos: Joust, Defender, Paperboy, Bubble Bobble, Donkey Kong |
| 5 | **Badge "¡Nuevo!"** | `index.html` + `games.js` | Mostrar badge en juegos lanzados en los últimos 30 días |
| 6 | **Ícono/thumbnail real** | `games/*/` | SVG/PNG por juego si el hub crece |

### 🟢 Baja prioridad / Ideas

| # | Tarea | Archivos | Detalle |
|---|-------|----------|---------|
| 7 | **Secuencia título animada** | `index.html` | Animación de "inserción de moneda" al cargar el hub |
| 8 | **Efecto hover sonoro** | `index.html` | Sonido sutil al hover sobre las tarjetas |
| 9 | **Modo juego aleatorio** | `index.html` | Botón "Juego sorpresa" que lleve a un juego al azar |
| 10 | **Pantalla de carga progresiva** | `index.html` | Barra de progreso mientras cargan los módulos |
| 11 | **Tema visual por juego** | `games/*/style.css` | Algunos juegos podrían tener tema propio más distintivo |
