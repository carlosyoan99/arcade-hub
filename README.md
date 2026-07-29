# 🕹️ Arcade Hub

**16 juegos clásicos recreados** con estética 2D/2.5D neon. Un archivo HTML por juego, cero dependencias, sin build step. Abrí y jugá.

---

## ✨ Filosofía

- **Cero dependencias.** Se abre `index.html` en el navegador y listo.
- **Sin build step.** No hay npm install, no hay bundlers, no hay toolchain.
- **Un archivo por juego.** Cada juego es autocontenido en su carpeta (`games/pong/`, etc.). Se puede compartir o abrir suelto sin el hub.
- **Estética 2D/2.5D.** Canvas 2D con paralaje, sombras proyectadas y partículas. Nada de motores 3D (las versiones Three.js antiguas están archivadas en `games/legacy-3d/`).
- **Cada juego importa módulos compartidos** (`shared/audio.js`, `shared/effects.js`, `shared/achievements.js`, `shared/base.css`) para sonido, partículas, logros y estilos base.

---

## 🚀 Cómo correrlo

```bash
# Servidor estático simple:
python3 -m http.server 8000
# O con Node:
npx serve .
```

Abrir `http://localhost:8000`. También funciona con `file://` directo, aunque algunos navegadores requieren HTTP para los `type="module"`.

---

## 🏗️ Estructura del proyecto

```
arcade-hub/
├── index.html              # Hub principal — grilla de juegos, toolbar, stats
├── games.js                # Manifiesto: metadata de cada juego (id, title, icon, status)
├── sw.js                   # Service Worker — cache-first, offline
│
├── shared/                 # Módulos compartidos entre todos los juegos
│   ├── base.css            # Variables CSS (neon palette), overlay, HUD, touch controls
│   ├── audio.js            # Web Audio API: beep(), startAmbient(), stopAmbient()
│   ├── effects.js          # Screen shake, partículas, flash, roundRect
│   ├── achievements.js     # Sistema de logros persistidos en localStorage
│   └── help.js             # Modal de ayuda contextual
│
├── games/                  # Un directorio por juego
│   ├── pong/
│   │   ├── index.html      # HTML del juego (estructura + etiquetas)
│   │   ├── style.css       # Estilos específicos del juego
│   │   ├── script.js       # Lógica completa del juego (ES module)
│   │   ├── metadata.json   # Versión, fechas, changelog
│   │   └── README.md       # Controles, descripción, features
│   ├── breakout/
│   │   └── ...
│   ├── snake/
│   │   └── ...
│   └── ... (16 juegos en total)
│
├── .agents/                # Skills instalados para trabajo con IA
│   └── skills/
│       └── frontend-design.md
│
└── README.md, CLAUDE.md, TODO.md
```

## 📦 Cada juego contiene

| Archivo | Propósito |
|---------|-----------|
| `index.html` | Estructura HTML: loading, canvas, HUD, overlay, touch controls, game bar. Sin CSS ni JS inline. |
| `style.css` | Estilos específicos del juego. Usa variables de `shared/base.css`. |
| `script.js` | Módulo ES (`type="module"`). Importa de `../../shared/*.js`. |
| `metadata.json` | Versión, fechas, changelog para el modal de ayuda. |
| `README.md` | Descripción, controles (teclado/gamepad/táctil), características. |

---

## 🎮 Juegos disponibles (16)

| # | Juego | Género | Descripción |
|---|-------|--------|-------------|
| 1 | 🏓 **Pong** | Deportes | Tenis de mesa con IA. Primero en llegar a 7 puntos gana. |
| 2 | 🧱 **Breakout** | Arcade | Rompe ladrillos con la pelota. 5 filas, niveles progresivos. |
| 3 | 🐍 **Snake** | Arcade | La serpiente clásica. Crece al comer, game over al chocar. |
| 4 | 🦖 **Dino Runner** | Plataformas | Side-scroller. Saltá y agachate para esquivar obstáculos. |
| 5 | 🚀 **Asteroids** | Space Shooter | Asteroides que se fragmentan, nave con inercia y wrapping. |
| 6 | 👾 **Space Invaders** | Space Shooter | Oleadas de invasores, escudos, nave misteriosa. |
| 7 | 🐤 **Flappy Bird** | Arcade | Volá esquivando tubos con gravedad y aleteo. |
| 8 | 🟡 **Pac-Man** | Laberinto | 4 IAs de fantasmas distintas, power pellets, fruta bonus. |
| 9 | 🧊 **Tetris** | Puzzle | 7 piezas, ghost piece, next preview, niveles progresivos. |
| 10 | 🐸 **Frogger** | Arcade | Cruzá calle y río, 5 zonas seguras, temporizador. |
| 11 | 🛸 **Galaga** | Space Shooter | Invasores en formación con picados en espiral. |
| 12 | 🐛 **Centipede** | Arcade | Ciempiés, hongos, araña, pulgas, escorpiones venenosos. |
| 13 | ⛏️ **Dig Dug** | Arcade | Excavá túneles, inflá enemigos, derrumbá rocas. |
| 14 | 🚀 **Missile Command** | Defensa | Defendé ciudades con interceptores, misiles inteligentes. |
| 15 | ◈ **Neon Nexus** | Tower Defense Roguelike | Defiende tu torre, mejora con estrellas, elige cartas de poder. |
| 16 | 🟣 **Cell Swarm** | Battle Royale | Crecé comiendo células, dividite, eyectá masa. ¡Sé el más grande! |

---

## 🧩 Cómo agregar un juego nuevo

### 1. Crear la carpeta del juego

```bash
mkdir games/mi-juego
```

### 2. Crear los archivos

```
games/mi-juego/
├── index.html        # Estructura HTML + import de shared/base.css + script.js
├── style.css         # Variables neon (--accent, --accent-glow), estilos específicos
├── script.js         # Módulo ES: import { beep } from '../../shared/audio.js'
├── metadata.json     # Versión, fechas, changelog
└── README.md         # Descripción y controles
```

### 3. Seguir las convenciones

Ver `CLAUDE.md` para reglas detalladas. Resumen rápido:

- **Canvas 2D** — nada de Three.js ni motores 3D
- **Paleta neon** — usar variables `var(--neon-cyan)`, `var(--neon-pink)`, etc. de `shared/base.css`
- **3 modos de entrada** — teclado (flechas/WASD + acción), táctil (`.is-pressed` + media query), gamepad (polling en el loop)
- **Módulos compartidos** — importar `audio.js`, `effects.js`, `achievements.js` desde `../../shared/`
- **Persistencia** — `localStorage` con key namespaced: `<gameId>_<key>`
- **Overlay** — usar la estructura `#overlay` de `shared/base.css` con variable `--accent`
- **Ayuda** — importar `showHelp` de `../../shared/help.js` y llamarlo desde `helpBtn`

### 4. Registrar el juego

- Agregar entrada en `games.js` con `status: 'listo'` o `'en-desarrollo'`
- Agregar la ruta al `index.html` en `FILES` de `sw.js`
- Listo — el hub lo muestra automáticamente

### 5. Validar

```bash
npm run lint          # ESLint — sin errores
npm run format        # Prettier — formato consistente
npm run check         # Ambos
```

---

## 🧠 Stack técnico

| Componente | Tecnología |
|------------|------------|
| Renderizado | `<canvas>` 2D |
| Sonido | Web Audio API (osciladores sintetizados) |
| Estilos | CSS vanilla con variables + neon palette |
| Persistencia | `localStorage` |
| Logros | `shared/achievements.js` |
| Service Worker | `sw.js` para offline |
| Tipografía | Bungee (display) + Inter (body) en el hub, Courier New en juegos |
| Sin dependencias | Sin frameworks, sin librerías externas |

---

## 📐 Diseño visual

El hub está diseñado con la skill `frontend-design` (`.agents/skills/frontend-design.md`) que define:

- **Paleta**: 4 colores intencionales (cyan-neon `#00f0ff`, pink-neon `#ff2d78`, gold-neon `#ffb800`, green-neon `#39ff14`)
- **Tipografía**: Bungee para display, Inter para body en el hub
- **Elemento signature**: Marquee chase-light border animado en el título del hub
- **Riesgo estético**: Contadores animados tipo máquina tragamonedas en las stats del hero

Cada juego tiene su propio color de acento (`--accent`) heredado del sistema de tokens.

---

## 📄 Licencia

MIT — Arcade Hub
