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

### 🔴 Alta prioridad

| #   | Tarea                               | Archivos                                                                         | Detalle                                                                                                                                                                                   |
| --- | ----------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **High-DPI scaling (Retina)**       | Todos `games/*/script.js`                                                        | Multiplicar `canvas.width/height` por `devicePixelRatio` y aplicar `ctx.scale(dpr, dpr)`. Sin esto los juegos se ven borrosos en pantallas Retina/HiDPI.                                  |
| 2   | **Alpha channel desactivado**       | Todos `games/*/script.js`                                                        | Agregar `{ alpha: false }` en `canvas.getContext('2d', { alpha: false })`. Permite al compositor del browser optimizar el renderizado significativamente.                                 |
| 3   | **Memory leaks — cleanup faltante** | `games/asteroids/script.js`, `games/frogger/script.js`, `games/tetris/script.js` | Algunos juegos no cancelan `requestAnimationFrame` ni limpian event listeners en `beforeunload`/`pagehide`. Verificar y agregar función `cleanup()`.                                      |
| 4   | **Object pooling para partículas**  | `shared/effects.js`                                                              | Las partículas se crean/destruyen constantemente → GC pressure → micro-stutters. Implementar pool reutilizable, especialmente para juegos con muchas partículas (Neon Nexus, Cell Swarm). |

### 🟡 Media prioridad

| #   | Tarea                                          | Archivos                                                                             | Detalle                                                                                                                                                                                |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | **Accesibilidad canvas**                       | Todos `games/*/` + `index.html`                                                      | Sin `aria-label` en canvas, sin `aria-live` para puntajes, sin skip links, sin focus trapping. Los juegos son inaccesibles para lectores de pantalla. Prioridad alta de accesibilidad. |
| 6   | **Anti-tunneling inconsistente**               | Todos `games/*/script.js`                                                            | Dt cap varía entre juegos (0.05, 0.03, etc.). Unificar criterio y verificar fórmula `v_max * dt_max < min_collider_thickness`. Agregar sub-pasos donde sea necesario.                  |
| 7   | **Service Worker — estrategias diferenciadas** | `sw.js`                                                                              | Todo se cachea igual (cache-first). Separar estrategias: network-first para `metadata.json`, cache-first para assets estáticos. Agrupar por game.                                      |
| 8   | **Hash routing hub↔juego**                     | `index.html`                                                                         | Cada juego abre como página independiente (pérdida de estado del hub). Implementar History API + hash routing para navegación fluida sin recarga completa.                             |
| 9   | **Variable `particles` local muerta**          | `games/cell-swarm/script.js`, `games/neon-nexus/script.js`, `games/digdug/script.js` | Declaran `let particles = []` local que sombrea el array interno de `shared/effects.js`. Eliminar declaración muerta.                                                                  |
| 10  | **Modo claro — contraste bajo**                | `shared/base.css`                                                                    | Textos `--text-secondary` con opacidad 0.4 sobre fondo claro → contraste < 4.5:1 WCAG AA. Ajustar opacidad o color.                                                                    |

### 🟢 Baja prioridad / Ideas

| #   | Tarea                                    | Archivos            | Detalle                                                                         |
| --- | ---------------------------------------- | ------------------- | ------------------------------------------------------------------------------- |
| 11  | **Título HTML dinámico por juego**       | `index.html`        | Cambiar `<title>` según el contexto (hub vs juego específico). Mejora SEO y UX. |
| 12  | **Meta tags dinámicos por juego**        | `index.html`        | Open Graph tags dinámicos al compartir un juego específico.                     |
| 13  | **Schema.org / JSON-LD (VideoGame)**     | `index.html`        | Agregar schema markup para que los juegos aparezcan en rich snippets de Google. |
| 14  | **Sitemap XML**                          | Raíz del proyecto   | Para que los 18 juegos sean indexables por buscadores.                          |
| 15  | **Pantalla de carga progresiva**         | `index.html`        | Barra de progreso al cargar módulos del hub (mejora perceived performance).     |
| 16  | **Animación "inserción de moneda"**      | `index.html`        | Secuencia nostálgica animada al cargar el hub.                                  |
| 17  | **Juego aleatorio / "Sorpresa"**         | `index.html`        | Botón que lleve a un juego al azar. Bueno para retention.                       |
| 18  | **Efecto hover sonoro**                  | `index.html`        | Sonido sutil al hover sobre tarjetas del hub.                                   |
| 19  | **Ícono/thumbnail real por juego**       | `games/*/`          | SVG/PNG por juego si el hub crece.                                              |
| 20  | **Tema visual más distintivo por juego** | `games/*/style.css` | Algunos juegos podrían tener tema propio más diferenciado.                      |
