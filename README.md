# 🕹️ Arcade Hub

![GitHub Pages](https://img.shields.io/github/deployments/carlosyoan99/arcade-hub/github-pages?label=GitHub%20Pages&logo=github&logoColor=white)
![Juegos](https://img.shields.io/badge/juegos-19-ff2d78)
![Dependencias](https://img.shields.io/badge/dependencias-0-00f0ff)
![Tests](https://img.shields.io/badge/tests-19%2F19-39ff14)
![Accesibilidad](https://img.shields.io/badge/accesibilidad-WCAG%20A%2B-c084fc)
![Licencia](https://img.shields.io/badge/licencia-MIT-blue)
[![Contribuir](https://img.shields.io/badge/contribuir-gu%C3%ADa-ffb800)](CONTRIBUTING.md)

**19 juegos clásicos recreados** con estética 2D/2.5D neon.  
Cero dependencias, sin build step, un archivo HTML por juego.  
Abrí y jugá.

---

## ✨ Filosofía

| Principio                | Por qué                                                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cero dependencias**    | Se abre en el navegador y listo. No hay `npm install`, no hay bundlers, no hay toolchain.                                                                        |
| **Sin build step**       | Cada juego es HTML + CSS + JS estáticos. Editar y recargar.                                                                                                      |
| **Modular**              | Cada juego vive en su carpeta (`games/pong/`) e importa módulos compartidos (`shared/`). Para jugar necesitás servir la carpeta raíz con un servidor HTTP local. |
| **Canvas 2D / 2.5D**     | `canvas` 2D con paralaje, sombras proyectadas y partículas. Nada de motores 3D.                                                                                  |
| **Módulos compartidos**  | Sonido, partículas, logros, estilos base y ayuda se importan desde `shared/`.                                                                                    |
| **Accesible por diseño** | Anuncios `aria-live`, focus trapping, `prefers-reduced-motion`, zoom móvil y `role="img"` en todos los juegos.                                                   |

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
├── index.html              # Hub — grilla de juegos con toolbar, stats y fondo animado
├── games.js                # Manifiesto — metadata de cada juego (única fuente de verdad)
├── sw.js                   # Service Worker — offline cache-first
├── sitemap.xml             # Sitemap XML para buscadores
├── robots.txt              # Robots exclusion rules
│
├── shared/                 # ← Módulos compartidos entre todos los juegos
│   ├── base.css            #   Variables neon, overlay, HUD, touch controls, :focus-visible
│   ├── audio.js            #   Web Audio API: beep(), startAmbient(), stopAmbient()
│   ├── effects.js          #   Screen shake, hit-stop, squash & stretch, partículas, drawGlow(), fillWithGlow()
│   ├── achievements.js     #   Logros persistidos en localStorage + contador de partidas
│   ├── help.js             #   Modal de ayuda accesible (role=dialog, focus trap)
│   ├── display.js          #   setupCanvas() con DPR + letterboxing + resize debounce
│   ├── dom.js              #   injectCommonElements() para HTML compartido
│   ├── loop.js             #   createGameLoop() — RAF + dt + cleanup unificado
│   └── input.js            #   createGamepad() + bindHoldButton() — gamepad y táctil
│
├── games/                  # ← Un directorio por juego (19 en total)
│   ├── pong/               #   index.html, style.css, script.js, metadata.json, README.md, screenshot.png
│   ├── breakout/
│   ├── ...
│   └── legacy-3d/          #   Versiones Three.js archivadas (solo referencia)
│
├── test/
│   └── smoke.test.js       # Smoke tests con jsdom para los 19 juegos
├── scripts/
│   └── verify.js           # Verificación de consistencia (manifiesto ↔ disco ↔ sw.js)
│
├── .agents/
│   └── skills/             # Skills de IA instaladas (ver CLAUDE.md)
│
└── README.md, CLAUDE.md, TODO.md   # Documentación del proyecto
```

### 📦 Anatomía de un juego

Cada juego tiene **5 archivos requeridos** (+ `screenshot.png` recomendado):

| Archivo          | Rol               | Contenido típico                                                               |
| ---------------- | ----------------- | ------------------------------------------------------------------------------ |
| `index.html`     | Estructura        | Canvas (`role="img"`), loading spinner, HUD, overlay, game bar, touch controls |
| `style.css`      | Estilo específico | Solo `:root { --accent: ... }` y elementos únicos del juego                    |
| `script.js`      | Lógica            | Módulo ES con constantes, estado, entrada, física, render y bucle principal    |     | `metadata.json` | Metadatos | Versión, fechas, changelog (se muestra en el modal de ayuda) |
| `README.md`      | Documentación     | Descripción, controles, características, logros, consejos, detalles técnicos   |
| `screenshot.png` | Captura _(opc.)_  | Imagen del juego en acción (se muestra en el README)                           |

---

## 🎮 Juegos disponibles

| #   | Juego                  | Versión | Género                  | Descripción                                                     |
| --- | ---------------------- | ------- | ----------------------- | --------------------------------------------------------------- |
| 1   | 🏓 **Pong**            | 1.5.0   | Deportes                | Tenis de mesa con IA. Primero en llegar a 7 puntos gana.        |
| 2   | 🧱 **Breakout**        | 1.5.0   | Arcade                  | Rompe ladrillos con la pelota. 5 filas, niveles progresivos.    |
| 3   | 🐍 **Snake**           | 1.5.1   | Arcade                  | La serpiente clásica. Crece al comer, game over al chocar.      |
| 4   | 🦖 **Dino Runner**     | 1.5.0   | Plataformas             | Side-scroller. Saltá y agachate para esquivar obstáculos.       |
| 5   | 🚀 **Asteroids**       | 1.5.0   | Space Shooter           | Asteroides que se fragmentan, nave con inercia y wrapping.      |
| 6   | 👾 **Space Invaders**  | 1.5.0   | Space Shooter           | Oleadas de invasores, escudos, nave misteriosa.                 |
| 7   | 🐤 **Flappy Bird**     | 1.5.0   | Arcade                  | Volá esquivando tubos con gravedad y aleteo.                    |
| 8   | 🟡 **Pac-Man**         | 1.5.0   | Laberinto               | 4 IAs de fantasmas, power pellets, fruta bonus.                 |
| 9   | 🧊 **Tetris**          | 1.5.0   | Puzzle                  | 7 piezas, ghost piece, next preview, niveles.                   |
| 10  | 🐸 **Frogger**         | 1.5.0   | Arcade                  | Cruzá calle y río, 5 zonas seguras.                             |
| 11  | 🛸 **Galaga**          | 1.5.0   | Space Shooter           | Invasores en formación con picados en espiral.                  |
| 12  | 🐛 **Centipede**       | 1.5.0   | Arcade                  | Ciempiés, hongos, araña, pulgas, escorpiones.                   |
| 13  | ⛏️ **Dig Dug**         | 1.4.0   | Arcade                  | Excavá túneles, inflá enemigos, derrumbá rocas.                 |
| 14  | 🚀 **Missile Command** | 1.4.0   | Defensa                 | Defendé ciudades con interceptores y misiles inteligentes.      |
| 15  | ◈ **Neon Nexus**       | 1.4.0   | Tower Defense Roguelike | Defiende tu torre, mejora con estrellas, elige cartas de poder. |
| 16  | 🟣 **Cell Swarm**      | 1.4.0   | Battle Royale           | Crecé comiendo células, dividite, eyectá masa.                  |
| 17  | 🦍 **Donkey Kong**     | 1.3.0   | Plataformas             | Escalá la obra esquivando barriles que lanza Donkey Kong.       |
| 18  | 🚀 **Defender**        | 1.3.0   | Shooter                 | Side-scrolling shooter. Rescatá humanos de los alienígenas.     |
| 19  | 🦅 **Joust**           | 1.3.0   | Acción                  | Justas aéreas sobre avestruz. Golpeá desde arriba para vencer.  |

> Todos los juegos son **100% funcionales** (status: `listo`).

---

## 🧩 Cómo agregar un juego nuevo

Agregar un juego al Arcade Hub es un proceso de 5 pasos:

### 1. Crear la carpeta y archivos

```bash
mkdir games/mi-juego
```

Dentro de `games/mi-juego/` crear 5 archivos (+ `screenshot.png` opcional):

```
index.html        → estructura HTML con canvas, loading, game bar y overlay
style.css         → definir :root { --accent: ...; --accent-glow: ... }
script.js         → módulo ES importando desde ../../shared/
metadata.json     → versión 1.0.0, fecha, changelog inicial
README.md         → descripción y tabla de controles
screenshot.png    → captura del juego (opcional al inicio, recomendada)
```

### 2. Seguir las convenciones técnicas

| Aspecto           | Regla                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| **Renderizado**   | `<canvas>` 2D — nada de Three.js ni WebGL                                                                  |
| **Paleta neon**   | Usar variables `var(--neon-cyan)`, `var(--neon-pink)`, etc. de `shared/base.css`                           |
| **Entrada**       | Teclado (flechas/WASD + acción) + Táctil (`.is-pressed` + `@media hover:none`) + Gamepad (polling en loop) |
| **Overlay**       | Estructura `#overlay` de `base.css` con `--accent` y `--overlay-grad-start`                                |
| **Ayuda**         | Importar `showHelp` de `../../shared/help.js` y conectarlo al `#helpBtn`                                   |
| **Módulos**       | Importar desde `../../shared/` — no importar de otros juegos                                               |
| **Persistencia**  | `localStorage` con key namespaced: `<gameId>_<clave>`                                                      |
| **Sonido**        | `beep({freq, duration, type, volume})` desde `shared/audio.js` — nunca archivos externos                   |
| **Partículas**    | `spawnParticles()` + `updateParticles()` + `drawParticles()` desde `shared/effects.js`                     |
| **Game loop**     | `createGameLoop()` desde `shared/loop.js` — RAF con dt + cleanup (nunca `setInterval`)                     |
| **Rendimiento**   | Sin `shadowBlur` dentro de loops por entidad — usar `drawGlow()` / `fillWithGlow()` de `shared/effects.js` |
| **Accesibilidad** | Canvas con `role="img"`, viewport sin `user-scalable=no`, anuncios `aria-live`, `prefers-reduced-motion`   |

### 3. Registrar el juego en el hub

En `games.js` agregar una entrada como esta:

```js
{
  id: 'mi-juego',
  title: 'Mi Juego',
  description: 'Una breve descripción del juego.',
  file: 'games/mi-juego/index.html',
  icon: '🎮',
  thumbnail: './asset/icons/game-mi-juego.svg',
  status: 'listo',       // o 'en-desarrollo' para placeholder
  created: '2026-07-31',
}
```

### 4. Agregar al Service Worker

En `sw.js`:

- Agregar la ruta `'./games/mi-juego/index.html'` al array `FILES`
- Incrementar la versión en `CACHE` si ya hay usuarios en producción

### 5. Validar

```bash
npm run check         # lint + format + verify + tests (todo en uno)
```

---

## 🧠 Cómo funciona

### Ciclo de vida de un juego

```
1. Usuario abre games/mi-juego/index.html
2. Se muestra el loading spinner (#loading)
3. Se importan los módulos shared (audio, effects, achievements, help)
4. Se inicializa el canvas y el bucle de animación (`createGameLoop` → `loop.start()`)
5. Se oculta el loading y se muestra el overlay de inicio
6. El usuario presiona Espacio / clic / botón de gamepad para empezar
7. El juego corre en su bucle principal (input → update → render)
8. Al terminar, se muestra el overlay de fin de partida (puntaje, récord)
9. El usuario puede reiniciar (R / clic en overlay / botón de acción)
```

### Módulos compartidos

Cada módulo en `shared/` provee funciones exportadas que los juegos importan:

```
shared/audio.js        → ensureAudio(), beep(), startAmbient(), stopAmbient(), closeAudio()
shared/effects.js      → triggerShake(), updateShake(), getShakeOffset(), setShakeScale(),
                         setParticlesScale(), hitStop(), isHitStopped(), feedbackBundle(),
                         spawnParticles(), updateParticles(), drawParticles(), clearParticles(),
                         triggerFlash(), updateFlash(), drawFlash(), drawGlow(), fillWithGlow(),
                         strokeWithGlow(), triggerSquash(), updateSquashes(), getSquash(),
                         drawWithSquash(), clearSquashes(), roundRect()
shared/achievements.js → achievements.unlock(), .has(), .incrementPlays(), .getPlays(), .getAllPlays()
shared/help.js         → showHelp(gameId) — modal accesible con focus trap y restauración de foco
shared/display.js      → setupCanvas() — DPR-aware + letterboxing + resize debounce
shared/dom.js          → injectCommonElements() — loading, announce (aria-live), gameBar
shared/loop.js         → createGameLoop() — RAF + dt calculation + cleanup
shared/input.js        → createGamepad() + bindHoldButton() — gamepad y táctil compartidos
shared/base.css        → Variables neon, overlay, HUD, touch controls, game bar, :focus-visible
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

| Variable       | Valor         | Uso                       |
| -------------- | ------------- | ------------------------- |
| `--neon-cyan`  | `#00f0ff`     | Acento primario del hub   |
| `--neon-pink`  | `#ff2d78`     | Acento secundario         |
| `--neon-gold`  | `#ffb800`     | Acento terciario          |
| `--neon-green` | `#39ff14`     | Estado "jugable"          |
| `--accent`     | _(por juego)_ | Color principal del juego |

**Tipografía**: Bungee (display, solo títulos) + Inter (body) en el hub.  
**Courier New** (monoespaciada, estilo terminal) en los juegos.

---

## ♿ Accesibilidad

El proyecto incorpora accesibilidad por diseño (auditoría A11y documentada en `TODO.md`):

| Área                 | Implementación                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| **Anuncios**         | `#announce` con `aria-live="polite"` + `aria-atomic` inyectado por `shared/dom.js` en los 19 juegos    |
| **Focus trap**       | `trapTab()` en los 19 juegos + modal de ayuda con focus trap y restauración de foco (`shared/help.js`) |
| **Reduced motion**   | `@media (prefers-reduced-motion)` en `base.css` + `setShakeScale(0)`/`setParticlesScale(0)` en JS      |
| **Zoom móvil**       | Viewport sin `user-scalable=no` (WCAG 1.4.4) + `touch-action: manipulation` en canvas                  |
| **Canvas semántico** | `role="img"` + `aria-label` en los 19 juegos                                                           |
| **Foco visible**     | `:focus-visible` global con `--accent` + ring especial para gameBar y touch controls                   |
| **Touch targets**    | Botones de game bar y touch controls ≥ 44×40px                                                         |
| **Modal de ayuda**   | `role="dialog"`, `aria-modal`, `aria-labelledby`, botón cerrar con `aria-label`, sin listener leaks    |
| **Contraste**        | Paleta neon sobre fondos oscuros con textos de alto contraste                                          |

---

## ⚡ Recomendaciones de rendimiento

### Regla de oro: evitar `shadowBlur` dentro de loops

`ctx.shadowBlur` es una de las operaciones **más costosas** del Canvas 2D (calcula una convolución de blur por cada forma dibujada).

**❌ Mal:**

```js
// shadowBlur se activa UNA VEZ POR ENEMIGO por frame
function drawEnemies(enemies) {
  for (const e of enemies) {
    ctx.shadowBlur = 10;
    ctx.fillRect(e.x, e.y, 20, 20);
    ctx.shadowBlur = 0;
  }
}
```

**✅ Bien — glow sin shadowBlur:**

```js
function drawGlow(ctx, x, y, radius, color, alpha = 0.15) {
  // Círculo sólido
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  // Glow translúcido 3x más grande
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
```

Usar la función `drawGlow()` de `shared/effects.js` (si está disponible) o la técnica de doble `arc()`. Esto elimina el costo del blur nativo y escala linealmente sin degradación en DPR alto.

> ✅ **Estado P0:** la migración `shadowBlur` → `drawGlow()`/`fillWithGlow()`/`strokeWithGlow()` está **completa en 19/19 juegos** (0 usos de `shadowBlur` restantes, verificado por grep).

**⚠️ Si usás `shadowBlur` (legado):**

- Activarlo **fuera de loops** (una vez por frame, no por entidad)
- Siempre parear con `ctx.shadowBlur = 0` después
- Preferir valores bajos (< 8) si no se puede evitar
- En juegos nuevos, **no usar `shadowBlur` en absoluto** — usar la técnica de glow translúcido

### Debounce en resize

El listener de `resize` de `shared/display.js` debe tener debounce (100-150ms) para evitar reasignaciones redundantes de `canvas.width/height` en mobile (rotación, teclado, barra de direcciones). Cada reasignación recrea el backing buffer del canvas.

### Antipatrones a evitar

| Antipatrón                             | Problema                           | Alternativa                                                   |
| -------------------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| `shadowBlur` dentro de loops           | Blur escala con #entidades         | Glow translúcido con doble `arc()+fill()`                     |
| `setInterval` para game loop           | Sin sincronización con el monitor  | `requestAnimationFrame`                                       |
| `getImageData`/`putImageData`          | Lectura/escritura lenta de píxeles | Canvas 2D regular o WebGL                                     |
| `ctx.filter`                           | Deshabilita aceleración gráfica    | Efectos manuales con `globalAlpha`/`globalCompositeOperation` |
| `splice`/`filter` en arrays cada frame | Fragmenta memoria (GC pressure)    | Object pooling con flag `alive` (ver `shared/effects.js`)     |

### Service Worker: siempre mantener actualizado

Al agregar un archivo compartido nuevo (`shared/`), agregarlo al array `FILES` en `sw.js`. Olvidarlo rompe el soporte offline y puede causar errores 404 en caché. `scripts/verify.js` detecta automáticamente los imports de `shared/` que faltan en `FILES`.

---

## 🧪 Testing y validación

El proyecto tiene una pipeline de validación completa sin dependencias externas (solo Node + jsdom):

| Comando          | Qué hace                                                                 |
| ---------------- | ------------------------------------------------------------------------ |
| `npm run lint`   | ESLint sobre todos los `.js` — **0 errores, 0 warnings**                 |
| `npm run format` | Prettier check sobre `js/mjs/css/html/json/md`                           |
| `npm run verify` | `scripts/verify.js` — consistencia manifiesto ↔ disco ↔ sw.js ↔ metadata |
| `npm test`       | `node --test` — smoke tests con jsdom para los **19 juegos**             |
| `npm run check`  | Pipeline completa: lint + format + verify + test                         |

### Qué verifica `scripts/verify.js`

1. **Manifiesto ↔ disco** — cada carpeta en `games/` tiene su entrada en `games.js` y viceversa
2. **Archivos por juego** — cada juego tiene `index.html`, `style.css`, `script.js`, `metadata.json`, `README.md`
3. **Imports ↔ sw.js** — cada import de `shared/*.js` usado está en el `FILES` del Service Worker
4. **sw.js ↔ juegos** — cada juego tiene sus 3 archivos en `FILES`
5. **metadata.json** — versión presente y `id` consistente con `games.js`

### Qué cubren los smoke tests (`test/smoke.test.js`)

Para cada juego, con jsdom y un mock no-op de `getContext('2d')`:

- El `index.html` carga sin errores
- `#gameCanvas`, `#overlay` y `#helpBtn` existen
- El `script.js` se importa como módulo ES real sin lanzar excepciones (detecta imports rotos, null sin chequear, referencias a globals inexistentes)

---

## 📦 Versionado y changelog

- **SemVer** (`MAJOR.MINOR.PATCH`) en `metadata.json` de cada juego — fuente de verdad para la versión
- Cada juego mantiene un `changelog` en `metadata.json` con entradas `{ version, date, changes[] }`
- El changelog se muestra en el **modal de ayuda** (`shared/help.js`) dentro del juego
- El `README.md` de cada juego refleja la **versión actual** y el changelog resumido
- La tabla de juegos del hub se sincroniza manualmente con `games.js` (única fuente de metadata)

---

## 🛠️ Workflow de desarrollo

Después de construir o modificar un juego:

1. `npm run check` — lint + format + verify + tests
2. Probar los 3 modos de entrada (teclado/táctil/gamepad)
3. Verificar anti-tunneling si hay objetos rápidos (`velocidad * dt >= grosor`)
4. Confirmar que HUD + overlay muestran resultado y récord persistido
5. Agregar ruta a `FILES` en `sw.js`
6. Actualizar `README.md` y `metadata.json` del juego (versión + changelog)
7. Hacer commit con mensaje descriptivo

---

## 🧠 Stack técnico

| Componente       | Tecnología                               |
| ---------------- | ---------------------------------------- |
| Renderizado      | `<canvas>` 2D                            |
| Sonido           | Web Audio API (osciladores sintetizados) |
| Estilos          | CSS vanilla con variables + neon palette |
| Persistencia     | `localStorage`                           |
| Service Worker   | `sw.js` — cache-first offline            |
| Tests            | `node:test` + jsdom                      |
| Sin dependencias | Sin frameworks, sin librerías externas   |

---

## ❓ FAQ

**¿Por qué no puedo abrir un juego con doble clic (`file://`)?**
Los juegos usan `type="module"` — los navegadores bloquean los módulos ES vía `file://`. Serví la carpeta con `python3 -m http.server 8000` o `npx serve .`.

**¿Cómo agrego logros a un juego?**
Importá `achievements` de `../../shared/achievements.js` y llamá `achievements.unlock('mi_logro')` cuando se cumpla la condición. Se persiste en `localStorage` (`ach_data`) y se anuncia con un beep.

**¿Puedo usar `shadowBlur` para un efecto puntual?**
Sí, fuera de loops, con valores bajos y siempre pareando `shadowBlur = 0` después. En loops usá `drawGlow()`/`fillWithGlow()`.

**¿Los juegos funcionan offline?**
Sí — el Service Worker (`sw.js`) cachea todos los archivos estáticos con estrategia cache-first. Requiere al menos una visita online previa.

**¿Qué significa `status: 'en-desarrollo'` en `games.js`?**
Un juego registrado en el manifiesto pero sin enlace activo en el hub (placeholder). `'listo'` = jugable.

---

## 🤝 Contribuir

¿Querés agregar un juego o mejorar uno existente? La guía completa está en **[`CONTRIBUTING.md`](CONTRIBUTING.md)**: cómo agregar un juego nuevo (9 pasos), estándares de código y checklist de PR.

---

## 📄 Licencia

MIT — Arcade Hub
