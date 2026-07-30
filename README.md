# 🕹️ Arcade Hub

**19 juegos clásicos recreados** con estética 2D/2.5D neon.  
Cero dependencias, sin build step, un archivo HTML por juego.  
Abrí y jugá.

---

## ✨ Filosofía

| Principio | Por qué |
|-----------|---------|
| **Cero dependencias** | Se abre en el navegador y listo. No hay `npm install`, no hay bundlers, no hay toolchain. |
| **Sin build step** | Cada juego es HTML + CSS + JS estáticos. Editar y recargar. |
| **Modular** | Cada juego vive en su carpeta (`games/pong/`) e importa módulos compartidos (`shared/`). Para jugar necesitás servir la carpeta raíz con un servidor HTTP local. |
| **Canvas 2D / 2.5D** | `canvas` 2D con paralaje, sombras proyectadas y partículas. Nada de motores 3D. |
| **Módulos compartidos** | Sonido, partículas, logros, estilos base y ayuda se importan desde `shared/`. |

---

## 🚀 Cómo correrlo

```bash
python3 -m http.server 8000
# o con Node:
npx serve .
```

Abrir [`http://localhost:8000`](http://localhost:8000) en el navegador.

> ⚠️ Los juegos usan `type="module"` en los scripts, por lo que requieren un servidor HTTP (no funcionan con `file://` en todos los navegadores).

---

## 🏗️ Estructura del proyecto

```
arcade-hub/
│
├── index.html              # Hub — grilla de juegos con toolbar y stats
├── games.js                # Manifiesto — metadata de cada juego
├── sw.js                   # Service Worker — offline cache-first
│
├── shared/                 # ← Módulos compartidos entre todos los juegos
│   ├── base.css            #   Variables neon, overlay, HUD, touch controls
│   ├── audio.js            #   Web Audio API: beep(), startAmbient()
│   ├── effects.js          #   Screen shake, partículas, flash, roundRect
│   ├── achievements.js     #   Logros persistidos en localStorage
│   └── help.js             #   Modal de ayuda contextual
│
├── games/                  # ← Un directorio por juego
│   ├── pong/
│   │   ├── index.html      #   HTML del juego (loading, canvas, HUD, overlay)
│   │   ├── style.css       #   Solo acentos neon y estilos únicos del juego
│   │   ├── script.js       #   Módulo ES con lógica completa
│   │   ├── metadata.json   #   Versión, fechas, changelog
│   │   └── README.md       #   Controles, descripción y características
│   ├── breakout/
│   ├── snake/
│   ├── ...                 #   16 juegos en total
│   └── legacy-3d/          #   Versiones Three.js archivadas (solo referencia)
│
├── .agents/
│   └── skills/
│       └── frontend-design.md   # Skill de diseño visual instalada
│
└── README.md, CLAUDE.md, TODO.md   # Documentación del proyecto
```

### 📦 Anatomía de un juego

Cada juego tiene exactamente **5 archivos**:

| Archivo | Rol | Contenido típico |
|---------|-----|------------------|
| `index.html` | Estructura | Canvas, loading spinner, HUD, overlay, game bar, touch controls, módulos compartidos |
| `style.css` | Estilo específico | Solo `:root { --accent: ... }` y elementos únicos del juego |
| `script.js` | Lógica | Módulo ES con constantes, estado, entrada, física, render y bucle principal |
| `metadata.json` | Metadatos | Versión, fechas, changelog (se muestra en el modal de ayuda) |
| `README.md` | Documentación | Descripción, tabla de controles (teclado + gamepad + táctil), características |

---

## 🎮 Juegos disponibles

| # | Juego | Género | Descripción |
|---|-------|--------|-------------|
| 1 | 🏓 **Pong** | Deportes | Tenis de mesa con IA. Primero en llegar a 7 puntos gana. |
| 2 | 🧱 **Breakout** | Arcade | Rompe ladrillos con la pelota. 5 filas, niveles progresivos. |
| 3 | 🐍 **Snake** | Arcade | La serpiente clásica. Crece al comer, game over al chocar. |
| 4 | 🦖 **Dino Runner** | Plataformas | Side-scroller. Saltá y agachate para esquivar obstáculos. |
| 5 | 🚀 **Asteroids** | Space Shooter | Asteroides que se fragmentan, nave con inercia y wrapping. |
| 6 | 👾 **Space Invaders** | Space Shooter | Oleadas de invasores, escudos, nave misteriosa. |
| 7 | 🐤 **Flappy Bird** | Arcade | Volá esquivando tubos con gravedad y aleteo. |
| 8 | 🟡 **Pac-Man** | Laberinto | 4 IAs de fantasmas, power pellets, fruta bonus. |
| 9 | 🧊 **Tetris** | Puzzle | 7 piezas, ghost piece, next preview, niveles. |
| 10 | 🐸 **Frogger** | Arcade | Cruzá calle y río, 5 zonas seguras. |
| 11 | 🛸 **Galaga** | Space Shooter | Invasores en formación con picados en espiral. |
| 12 | 🐛 **Centipede** | Arcade | Ciempiés, hongos, araña, pulgas, escorpiones. |
| 13 | ⛏️ **Dig Dug** | Arcade | Excavá túneles, inflá enemigos, derrumbá rocas. |
| 14 | 🚀 **Missile Command** | Defensa | Defendé ciudades con interceptores y misiles inteligentes. |
| 15 | ◈ **Neon Nexus** | Tower Defense Roguelike | Defiende tu torre, mejora con estrellas, elige cartas de poder. |
| 16 | 🟣 **Cell Swarm** | Battle Royale | Crecé comiendo células, dividite, eyectá masa. |

> Todos los juegos son **100% funcionales** (status: `listo`).

---

## 🧩 Cómo agregar un juego nuevo

Agregar un juego al Arcade Hub es un proceso de 5 pasos:

### 1. Crear la carpeta y archivos

```bash
mkdir games/mi-juego
```

Dentro de `games/mi-juego/` crear 5 archivos:

```
index.html        → estructura HTML con canvas, loading, game bar y overlay
style.css         → definir :root { --accent: ...; --accent-glow: ... }
script.js         → módulo ES importando desde ../../shared/
metadata.json     → versión 1.0.0, fecha, changelog inicial
README.md         → descripción y tabla de controles
```

### 2. Seguir las convenciones técnicas

| Aspecto | Regla |
|---------|-------|
| **Renderizado** | `<canvas>` 2D — nada de Three.js ni WebGL |
| **Paleta neon** | Usar variables `var(--neon-cyan)`, `var(--neon-pink)`, etc. de `shared/base.css` |
| **Entrada** | Teclado (flechas/WASD + acción) + Táctil (`.is-pressed` + `@media hover:none`) + Gamepad (polling en loop) |
| **Overlay** | Estructura `#overlay` de `base.css` con `--accent` y `--overlay-grad-start` |
| **Ayuda** | Importar `showHelp` de `../../shared/help.js` y conectarlo al `#helpBtn` |
| **Módulos** | Importar desde `../../shared/` — no importar de otros juegos |
| **Persistencia** | `localStorage` con key namespaced: `<gameId>_<clave>` |
| **Sonido** | `beep({freq, duration, type, volume})` desde `shared/audio.js` — nunca archivos externos |
| **Partículas** | `spawnParticles()` + `updateParticles()` + `drawParticles()` desde `shared/effects.js` |

### 3. Registrar el juego en el hub

En `games.js` agregar una entrada como esta:

```js
{
  id: 'mi-juego',
  title: 'Mi Juego',
  description: 'Una breve descripción del juego.',
  file: './games/mi-juego/index.html',
  icon: '🎮',
  status: 'listo',       // o 'en-desarrollo' para placeholder
  genre: 'arcade',
}
```

### 4. Agregar al Service Worker

En `sw.js`:
- Agregar la ruta `'./games/mi-juego/index.html'` al array `FILES`
- Incrementar la versión en `CACHE` si ya hay usuarios en producción

### 5. Validar

```bash
npm run lint          # ESLint — 0 errores
npm run format        # Prettier — formato consistente
npm run check         # lint + format combinados
```

---

## 🧠 Cómo funciona

### Ciclo de vida de un juego

```
1. Usuario abre games/mi-juego/index.html
2. Se muestra el loading spinner (#loading)
3. Se importan los módulos shared (audio, effects, achievements, help)
4. Se inicializa el canvas y el bucle de animación (requestAnimationFrame)
5. Se oculta el loading y se muestra el overlay de inicio
6. El usuario presiona Espacio / clic / botón de gamepad para empezar
7. El juego corre en su bucle principal (input → update → render)
8. Al terminar, se muestra el overlay de fin de partida (puntaje, récord)
9. El usuario puede reiniciar (R / clic en overlay / botón de acción)
```

### Módulos compartidos

Cada módulo en `shared/` provee funciones exportadas que los juegos importan:

```
shared/audio.js       → beep(), startAmbient(), stopAmbient()
shared/effects.js     → spawnParticles(), updateParticles(), drawParticles(),
                        triggerShake(), getShakeOffset(), triggerFlash(), drawFlash()
shared/achievements.js → unlockAchievement(), getAchievements(), trackPlay()
shared/help.js        → showHelp(gameId)
shared/base.css       → Variables neon, overlay, HUD, touch controls, game bar
```

### Diseño del hub

El hub (`index.html`) es una página estática que:

1. **Lee `games.js`** — carga el manifiesto con metadata de cada juego
2. **Renderiza tarjetas** — cada juego se muestra como una card con icono, título y descripción
3. **Ofrece toolbar** — búsqueda por nombre, orden (defecto/nombre/nuevos/más jugados), vista grilla/lista
4. **Muestra stats** — contadores animados, logros desbloqueados, Top 3 de juegos más jugados
5. **Fondo animado** — canvas con nebulosas, estrellas y grid que transiciona con el tema
6. **Tema oscuro/claro** — con persistencia en `localStorage` y transición suave

---

## 🎨 Sistema de diseño

El proyecto usa un sistema de tokens visuales:

| Variable | Valor | Uso |
|----------|-------|-----|
| `--neon-cyan` | `#00f0ff` | Acento primario del hub |
| `--neon-pink` | `#ff2d78` | Acento secundario |
| `--neon-gold` | `#ffb800` | Acento terciario |
| `--neon-green` | `#39ff14` | Estado "jugable" |
| `--accent` | *(por juego)* | Color principal del juego |

**Tipografía**: Bungee (display, solo títulos) + Inter (body) en el hub.  
**Courier New** (monoespaciada, estilo terminal) en los juegos.

---

## 🧠 Stack técnico

| Componente | Tecnología |
|------------|------------|
| Renderizado | `<canvas>` 2D |
| Sonido | Web Audio API (osciladores sintetizados) |
| Estilos | CSS vanilla con variables + neon palette |
| Persistencia | `localStorage` |
| Service Worker | `sw.js` — cache-first offline |
| Sin dependencias | Sin frameworks, sin librerías externas |

---

## 📄 Licencia

MIT — Arcade Hub
