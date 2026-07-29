# TODO — Arcade Hub

## ✅ Completado

### Setup

- [x] Estructura de carpetas (`games/`, `shared/`, `.agents/skills/`)
- [x] Hub (`index.html` + `games.js`) con grilla responsiva
- [x] README.md / CLAUDE.md / TODO.md actualizados
- [x] Service Worker (`sw.js`) con cache-first
- [x] Sistema de logros (`shared/achievements.js`)
- [x] Efectos compartidos (`shared/effects.js`)
- [x] Audio sintetizado (`shared/audio.js`)
- [x] Ayuda contextual (`shared/help.js`)
- [x] ESLint + Prettier configurados y funcionando

### Hub — diseño y experiencia

- [x] Diseño neon con marquee chase-light border animado en el título
- [x] Tipografía Bungee (display) + Inter (body) — carga más rápida que Orbitron
- [x] Paleta intencional: cyan-neon, pink-neon, gold-neon, green-neon
- [x] Contadores animados tipo máquina tragamonedas en stats del hero
- [x] Scroll reveal con IntersectionObserver en achievements/stats
- [x] Rutas relativas para compatibilidad con GitHub Pages
- [x] Fondo animado con canvas (nebulosas, estrellas, grid) con transición de tema
- [x] Selector de tema oscuro/claro con persistencia en localStorage
- [x] Toolbar: búsqueda, orden (defecto/nombre/nuevos/más jugados), toggle grilla/lista
- [x] Ranking Top 3 de juegos más jugados
- [x] Indicador visual de juego más jugado en estadísticas
- [x] Modal de ayuda contextual con descripción, controles y logros
- [x] Versión, fecha y changelog desde metadata.json en modal de ayuda
- [x] Badge "✦ 16 juegos clásicos"
- [x] Scanline overlay CRT subtle
- [x] Meta tags Open Graph + Twitter Card
- [x] Per-game accent colors en tarjetas del hub

### Juegos implementados (16/16)

| Juego | Estado | Versión |
|-------|--------|---------|
| 🏓 **Pong** | ✅ listo | 1.1.0 |
| 🧱 **Breakout** | ✅ listo | 1.1.0 |
| 🐍 **Snake** | ✅ listo | 1.1.0 |
| 🦖 **Dino Runner** | ✅ listo | 1.1.0 |
| 🚀 **Asteroids** | ✅ listo | 1.1.0 |
| 👾 **Space Invaders** | ✅ listo | 1.1.0 |
| 🐤 **Flappy Bird** | ✅ listo | 1.1.0 |
| 🟡 **Pac-Man** | ✅ listo | 1.1.0 |
| 🧊 **Tetris** | ✅ listo | 1.1.0 |
| 🐸 **Frogger** | ✅ listo | 1.1.0 |
| 🛸 **Galaga** | ✅ listo | 1.1.0 |
| 🐛 **Centipede** | ✅ listo | 1.1.0 |
| ⛏️ **Dig Dug** | ✅ listo | 1.0.0 |
| 🚀 **Missile Command** | ✅ listo | 1.0.0 |
| ◈ **Neon Nexus** | ✅ listo | 1.0.0 |
| 🟣 **Cell Swarm** | ✅ listo | 1.0.0 |

### Juegos — mejoras y correcciones

- [x] Limpieza de recursos: `cancelAnimationFrame` + `closeAudio()` en todos los juegos
- [x] `preventDefault` condicional (no bloquea atajos del navegador)
- [x] Nombres de variables legibles en todos los juegos
- [x] Favicon individual (SVG inline) por juego
- [x] Loading spinner con animación CSS
- [x] Tema oscuro/claro aplicado a todos los juegos
- [x] Botón "Volver al Arcade Hub" + pantalla completa + ayuda en cada juego
- [x] Screen shake y roundRect extraídos a `shared/effects.js`
- [x] Sub-pasos de colisión anti-tunneling en Dino Runner y Asteroids
- [x] Logros definidos para todos los juegos (15 logros)
- [x] Música de fondo ambiente (drone) en cada juego
- [x] metadata.json por juego con changelog
- [x] README.md por juego con controles y descripción

### Refactor CSS — base.css + paleta neon

- [x] Variables neon en `shared/base.css`: --neon-cyan, --neon-pink, --neon-gold, --neon-green, --neon-purple, --neon-red, --neon-blue, --neon-yellow
- [x] Overlay compartido en base.css con variables --overlay-grad-start/end, --accent, --accent-glow
- [x] HUD compartido: .score-group/.sg, .score-block/.sb, .score-sep/.sp
- [x] Touch controls compartidos: #touchControls/#tc, .dpad/.dp
- [x] Game bar, loading spinner, reduced motion en base.css
- [x] 16 style.css simplificados (~150→~40 líneas cada uno)

### Cartas y balance — Neon Nexus

- [x] 4 cartas nuevas: Drenar, Torreta Auxiliar, Escudo Regenerativo, Ralentización Global
- [x] Fix multishot: dispara a diferentes enemigos o direcciones aleatorias
- [x] Balance: HP escalado reducido (0.35→0.28 por oleada)

### Cell Swarm

- [x] IA de bots con 5 personalidades (aggressive, timid, balanced, hunter, coward)
- [x] Esquiva de proyectiles por parte de los bots
- [x] Sistema de skins: banderas de países, emojis, degradados, colores especiales
- [x] Split/Eject con coordenadas mundo corregidas

### Deuda técnica — ESLint

- [x] Variables/funciones sin usar eliminadas en asteroids, dino-runner, flappy-bird, frogger, space-invaders, tetris
- [x] Imports sin usar (stopAmbient, clearParticles) eliminados de juegos
- [x] catch(e) → catch{} en shared/audio.js
- [x] let → const donde correspondía (gP, prevGamepad)
- [x] Parámetros de callback sin usar renombrados con prefijo _

---

## 📋 Pendientes

### 🔴 Alta prioridad

| # | Tarea | Archivos | Detalle |
|---|-------|----------|---------|
| 1 | **Commit + push** | Todos | Hay cambios pendientes de shared/base.css, 16 style.css, 16 README.md y documentación sin commitear |
| 2 | **Agregar capturas a README.md** | `games/*/README.md` | Cada juego necesita al menos 1 screenshot (p.ej. `screenshot.png` en su carpeta) para ilustrar el gameplay |
| 3 | **Actualizar metadata.json** | `games/digdug/` `games/missile-command/` `games/neon-nexus/` `games/cell-swarm/` | Subir versión a 1.1.0 y agregar changelog del refactor CSS + mejoras |

### 🟡 Media prioridad

| # | Tarea | Archivos | Detalle |
|---|-------|----------|---------|
| 4 | **Nuevos juegos** | `games/*/` | Posibles candidatos: Joust, Defender, Paperboy, Bubble Bobble, Donkey Kong |
| 5 | **Badge "¡Nuevo!"** | `index.html` + `games.js` | Mostrar badge en juegos lanzados en los últimos 30 días |
| 6 | **Prettier — verificar index.html** | `index.html` | Asegurar que el hub pase `prettier --check` sin cambios |
| 7 | **Ícono/thumbnail real por juego** | `games/*/` | Reemplazar emojis por SVG/PNG reales si el hub crece mucho |

### 🟢 Baja prioridad / Ideas

| # | Tarea | Archivos | Detalle |
|---|-------|----------|---------|
| 8 | **Secuencia de título animada** | `index.html` | Breve animación de "inserción de moneda" al cargar el hub |
| 9 | **Efecto hover en cards** | `index.html` | Sonido sutil al hacer hover sobre las tarjetas del hub |
| 10 | **Modo de juego aleatorio** | `index.html` | Botón "Juego sorpresa" que lleve a un juego al azar |
| 11 | **Pantalla de carga progresiva** | `index.html` | Barra de progreso mientras cargan los módulos compartidos |
| 12 | **Tema por juego** | `games/*/style.css` | Algunos juegos podrían tener tema propio (digdug tierra, missile command militar) |
