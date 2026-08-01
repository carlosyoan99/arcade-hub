# CLAUDE.md — Convenciones técnicas del proyecto

Este archivo documenta cómo trabajar en este repo. **Léelo antes de crear o modificar un juego.**

Para la guía de contribución (cómo agregar un juego, estándares de código y checklist de PR), ver **[`CONTRIBUTING.md`](CONTRIBUTING.md)**.

---

## 🎯 Regla de oro: estética 2D/2.5D, no 3D

Los juegos usan **`<canvas>` 2D** como base. Técnicas 2.5D permitidas:

- Paralaje de fondos (capas a distinta velocidad)
- Sombras proyectadas dibujadas a mano
- Perspectiva simulada (escalar sprites por "distancia")
- Ángulos de cámara fijos tipo isométrico

**No** usar motores 3D (Three.js, WebGL). Las versiones 3D antiguas están en `games/legacy-3d/` como referencia de gameplay — no se agregan al manifiesto activo.

---

## 📁 Estructura del proyecto

```
arcade-hub/
├── index.html            # Hub — grilla neon con toolbar, stats, fondo animado
├── games.js              # Manifiesto — metadata (id, title, icon, status) de cada juego
├── sw.js                 # Service Worker — cache-first, offline
│
├── shared/               # Módulos compartidos (import relativo desde cada juego)
│   ├── base.css          #   Neon palette, overlay, HUD, touch controls, game bar
│   ├── audio.js          #   Web Audio API: beep(), ensureAudio(), startAmbient(), stopAmbient(), closeAudio()
│   ├── effects.js        #   feedbackBundle(), shake, hit-stop, squash & stretch, partículas, drawGlow(), roundRect
│   ├── achievements.js   #   Logros + contador de partidas (localStorage)
│   ├── help.js           #   Modal de ayuda contextual con metadata y changelog
│   ├── display.js        #   setupCanvas() con DPR + letterboxing
│   ├── dom.js            #   injectCommonElements() — loading, announce, gameBar
│   ├── loop.js           #   createGameLoop() — RAF + dt + cleanup unificado
│   └── input.js          #   createGamepad() + bindHoldButton() — gamepad y táctil compartidos
│
├── games/                # 19 juegos, cada uno con 5 archivos
│   ├── pong/             → index.html, style.css, script.js, metadata.json, README.md
│   ├── breakout/         → (misma estructura)
│   ├── ...               → 19 en total
│   └── legacy-3d/        → Versiones Three.js archivadas (solo referencia)
│
└── .agents/skills/       → Skills instalados para trabajo con IA
    ├── 26 skills (game-engine, refactor, game-feel, frontend-design, git-commit, ...)
    ├── assets/           → 5 templates de juegos
    └── references/       → 32 referencias técnicas
```

---

## 🎨 Sistema de diseño neon

### Variables CSS compartidas (`shared/base.css`)

```css
--neon-cyan: #00f0ff; /* Acento primario del hub */
--neon-pink: #ff2d78; /* Acento secundario */
--neon-gold: #ffb800; /* Acento terciario */
--neon-green: #39ff14; /* Verde arcade (status listo) */
--neon-purple: #c084fc;
--neon-red: #ff5e7a;
--neon-orange: #ff8a65;
--neon-blue: #6ec6ff;
--neon-yellow: #ffe066;
--neon-white: #ffffff;
```

### Cada juego define solo su acento

```css
:root {
  --accent: var(--neon-pink);
  --accent-glow: rgba(255, 45, 120, 0.3);
  --overlay-grad-start: rgba(20, 10, 30, 0.85);
}
```

### Patrones compartidos en `base.css`

`shared/base.css` ya incluye estilos para todo lo común:

| Componente     | Selectores                                                             |
| -------------- | ---------------------------------------------------------------------- |
| Overlay        | `#overlay` con `--accent`, `--accent-glow`, `--overlay-grad-start/end` |
| HUD            | `.score-group`/`.sg`, `.score-block`/`.sb`, `.score-sep`/`.sp`         |
| Touch controls | `#touchControls`/`#tc`, `.dpad`/`.dp`                                  |
| Game bar       | `#gameBar` con botones estilo panel translúcido                        |
| Loading        | `#loading` con spinner animado                                         |
| Reduced motion | `@media (prefers-reduced-motion)`                                      |
| Responsive     | Media queries para 520px, 480px                                        |

Cada `style.css` solo necesita elementos únicos: colores de score blocks, touch control accents, leaderboard, name entry, shop, cards...

---

## 🎮 Controles: paridad obligatoria

Todo juego debe soportar desde el primer build:

| Modo            | Cómo                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| ⌨️ **Teclado**  | Flechas/WASD + tecla de acción (`Espacio`) + `R` reinicio                                                               |
| 👆 **Táctil**   | Botones visibles solo en táctil (`@media (hover: none) and (pointer: coarse)`) con feedback (`.is-pressed` + `:active`) |
| 🕹️ **Gamepad**  | Polling en loop principal: stick/D-pad para movimiento, botón para acción                                               |
| 🔄 **Reinicio** | Tecla `R` + tap en overlay + botón de acción principal                                                                  |

---

## 🔊 Sonido y partículas

- **Sonido**: `beep({freq, duration, type, volume})` desde `shared/audio.js`. Nunca archivos externos.
- **Audio init**: `ensureAudio()` en `startGame()` (gesto de usuario) y `closeAudio()` en cleanup.
- **Ambient**: `startAmbient()` / `stopAmbient()` para música drone de fondo.
- **Game feel**: `feedbackBundle(tier, x, y, opts)` (sonido + partículas + flash en un solo call), `hitStop()`/`isHitStopped()` para freeze frame, `triggerSquash()/updateSquashes()/clearSquashes()` para squash & stretch — `updateSquashes(dt)` en el game loop, `clearSquashes()` en `startGame()`.
- **Partículas**: `spawnParticles()`, `updateParticles()`, `drawParticles()` desde `shared/effects.js`. Física inline solo si es muy especial.
- **Screen shake**: `triggerShake(intensity)` + `updateShake(dt)` + `getShakeOffset()` desde `shared/effects.js`. `setShakeScale(scale)` para accesibilidad (prefers-reduced-motion → 0).
- **Glow**: `drawGlow(ctx, x, y, r, color)` en vez de `shadowBlur` dentro de loops.

---

## 💾 Persistencia

`localStorage` con key namespaced: `<gameId>_<clave>` (ej. `pong2d_wins`, `breakout2d_best`).  
El sistema de logros usa `ach_data` en `shared/achievements.js`.

---

## 📦 Importaciones

```js
// Desde un juego (games/pong/script.js):
import { beep, startAmbient } from '../../shared/audio.js';
import { spawnParticles } from '../../shared/effects.js';
import { achievements } from '../../shared/achievements.js';
import { showHelp } from '../../shared/help.js';
```

No importar de otros juegos ni de fuera de `shared/`.

---

## 🔧 Skills locales instaladas

Skills disponibles en `.agents/skills/`. **Cargar la skill antes de ejecutar la tarea** con:

```
skill("nombre-de-la-skill")
```

### Core (más usadas)

| Skill             | Cuándo usarla                                                                  |
| ----------------- | ------------------------------------------------------------------------------ |
| `frontend-design` | Rediseñar hub o juego — paleta, tipografía, layout, elemento signature         |
| `game-feel`       | Agregar juicio: screen shake, hit-stop, squash & stretch, knockback            |
| `game-engine`     | Construir o mejorar juegos Canvas 2D — game loop, físicas, colisiones, sprites |
| `refactor`        | Refactorizar código: extraer funciones, mejorar tipos, eliminar code smells    |
| `git-commit`      | Hacer commits con mensajes convencionales semánticos                           |

### Complementarias

| Skill                        | Cuándo usarla                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `premium-frontend-ui`        | Diseño UI inmersivo de alto nivel (animaciones, tipografía, micro-interacciones) |
| `game-ui-ux`                 | UX/UI de juego — menús, HUD, flujos, accesibilidad                               |
| `performance-optimization`   | Optimizar rendimiento Canvas 2D — draw calls, pools, DPR                         |
| `game-ai`                    | IA de enemigos — behavior trees, pathfinding, estados                            |
| `procedural-gen`             | Generación procedural — niveles, ruido, dungeons                                 |
| `audio-design`               | Diseño de sonido — SFX, música adaptativa                                        |
| `physics-tuning`             | Ajuste de físicas — gravedad, fricción, anti-tunneling                           |
| `level-design`               | Diseño de niveles — pacing, dificultad, flow                                     |
| `input-systems`              | Sistemas de entrada — teclado, táctil, gamepad, accesibilidad                    |
| `dialogue-systems`           | Sistemas de diálogo — branching, misiones                                        |
| `save-systems`               | Sistemas de guardado — localStorage, serialización                               |
| `shader-programming`         | Shaders / efectos visuales (WebGL opcional)                                      |
| `camera-systems`             | Cámaras — follow, shake, framing                                                 |
| `create-implementation-plan` | Planificar implementaciones multi-paso antes de codificar                        |
| `refactor-plan`              | Planificar refactors multi-archivo de forma segura                               |
| `create-readme`              | Generar README.md para nuevos juegos                                             |
| `create-specification`       | Crear especificaciones técnicas detalladas                                       |
| `documentation-writter`      | Redactar documentación técnica                                                   |
| `audit-integrity`            | Auditar integridad del código — consistencia, convenciones                       |
| `context-map`                | Mapear contexto del proyecto antes de cambios grandes                            |
| `create-agentsmd`            | Generar/actualizar AGENTS.md                                                     |

### Assets y referencias

- `assets/` (5): `paddle-game-template`, `gameBase-template-repo`, `2d-maze-game`, `2d-platform-game`, `simple-2d-engine`
- `references/` (32): `noise`, `pathfinding`, `behavior-trees`, `dungeon-generation`, `timestep-and-ccd`, `pacing-and-flow`, `game-engine-core-principles`, `web-apis`, `game-publishing`, `feedback-recipes`, `self-reflection-quality-gate` y más (ver `TODO.md`)

---

## 🗺️ Estado de fases (resumen)

> Detalle completo y verificación en `TODO.md`. `npm run check` (lint + prettier) debe pasar en 0/0.

| Fase      | Estado                                                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1–R4** | ✅ Refactor — 19/19 juegos migrados a `shared/loop.js`, 0 vestigios 3D                                                                              |
| **P0**    | ✅ Rendimiento — `shadowBlur` eliminado por completo (0 usos), `fillWithGlow()`/`strokeWithGlow()` en shared/effects.js, SW OK (falta P10 DevTools) |
| **G1–G5** | ✅ Game feel — `feedbackBundle` 19/19, squash & stretch 15/19 (4 juegos sin squash)                                                                 |
| **H1**    | ✅ Hub UI premium — entry sequence split-door, cursor, glassmorphism, 7/7                                                                           |
| **D1–D6** | ✅ Documentación — D1-D4 completado (READMEs 19 juegos + README avanzado + metadata bump), D5 CONTRIBUTING.md nuevo, D6 screenshots 19/19           |
| **P10**   | 🔲 Pruebas de rendimiento con DevTools Performance tab                                                                                              |
| **N1**    | 🟢 Nuevos juegos (templates en `.agents/skills/assets/`)                                                                                            |

---

## ✅ Checklist post-modificación

Después de construir o modificar un juego:

1. ✅ `npm run lint` — 0 errores, 0 warnings
2. ✅ `npm run format` — Prettier sin cambios pendientes
3. ✅ `npm run check` — lint + format combinados
4. ✅ Probar los 3 modos de entrada (teclado/táctil/gamepad)
5. ✅ Verificar anti-tunneling si hay objetos rápidos (`velocidad * dt >= grosor`)
6. ✅ Confirmar que HUD + overlay muestran resultado y récord persistido
7. ✅ Agregar ruta a `FILES` en `sw.js`
8. ✅ Actualizar `README.md` del juego si cambiaron controles o features
9. ✅ Actualizar `metadata.json` con nueva versión y changelog
10. ✅ **Hacer commit** después de cada tarea (mensaje descriptivo)

---

## 📋 Service Worker (`sw.js`)

- Cachea todos los archivos estáticos con estrategia **cache-first**.
- **Al agregar un juego**: agregar ruta a `FILES`.
- **Al actualizar**: incrementar versión en `CACHE` (ej. `arcadehub-v3`).

---

## 🌐 El hub (`index.html` + `games.js`)

- `games.js` es la única fuente de metadata. El hub solo lo lee y renderiza.
- `status: 'listo'` = jugable. `'en-desarrollo'` = placeholder sin enlace.
- Rutas siempre relativas (`./games/...`), nunca absolutas con `/`.
- Cada tarjeta recibe colores del per-game `palette` en el hub.

---

## ⚡ Reglas de rendimiento Canvas 2D

### ❌ `shadowBlur` dentro de loops por entidad

**Prohibido.** `shadowBlur` es una convolución de blur carísima que escala con el número de entidades. Se agrava en DPR alto (móvil con DPR=3 → 9x más píxeles a blurear).

**Alternativa:** glow translúcido con doble `arc()+fill()`, como ya hace `drawParticles()` en `shared/effects.js`:

```js
function drawGlow(ctx, x, y, r, color, alpha = 0.15) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, r * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
```

### ✅ Reglas de rendimiento

- **`requestAnimationFrame`** para el game loop (nunca `setInterval`)
- **`setInterval`/`setTimeout`** solo para UI (efectos de sonido, temporizadores de juego, etc.)
- **Object pooling** para arrays que mutan por frame (partículas, proyectiles, enemigos). Usar flag `alive` en vez de `splice`/`filter`
- **Evitar `getImageData`/`putImageData`** y `ctx.filter` — deshabilitan aceleración gráfica
- **Usar `{ alpha: false }`** en `getContext('2d')` para optimizar el compositor
- **Debounce en resize** (100-150ms) para evitar reasignaciones de `canvas.width/height` en mobile
- **Preferir `transform` y `opacity`** para animaciones CSS — no disparan layout/reflow
- **Siempre parear** `shadowBlur = N` con `shadowBlur = 0` inmediatamente después (nunca dejar contaminado)

### 🧪 Verificación de rendimiento en code review

```
1. ¿Hay shadowBlur dentro de un loop?  →  Reemplazar con drawGlow()
2. ¿Hay splice/filter por frame?       →  Usar object pooling
3. ¿El resize escucha sin debounce?     →  Agregar debounce 150ms
4. ¿El SW tiene todos los shared/ files? →  display.js, dom.js
5. ¿Alpha channel desactivado?          →  { alpha: false }
```

---

## ⚠️ Anti-tunneling

Si `velocidad_máxima * dt_máximo >= grosor_mínimo_colisión`, subdividir el movimiento en sub-pasos.

---

## 🧪 Flujo de trabajo recomendado

1. Leer `CLAUDE.md` y `TODO.md` primero
2. Identificar la skill relevante y cargarla
3. Ejecutar cambios siguiendo las convenciones
4. Validar con `npm run check`
5. **Commit + push** después de cada tarea
