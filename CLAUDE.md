# CLAUDE.md — Convenciones técnicas del proyecto

Este archivo documenta cómo trabajar en este repo. **Léelo antes de crear o modificar un juego.**

---

## 🎯 Regla de oro: estética 2D/2.5D, no 3D

Los juegos usan **`<canvas>` 2D** como base. Está permitido dar sensación de profundidad con:
- Paralaje de fondos (capas a distinta velocidad)
- Sombras proyectadas dibujadas a mano
- Perspectiva/inclinación simulada (escalar sprites por "distancia")
- Ángulos de cámara fijos tipo isométrico

**No** usar motores 3D (Three.js, WebGL). Las versiones 3D antiguas están en `games/legacy-3d/` como referencia de gameplay/física, pero no se agregan al manifiesto activo (`games.js`).

---

## 📁 Estructura del proyecto

```
arcade-hub/
├── index.html            # Hub principal (grilla de juegos, neon, marquee)
├── games.js              # Manifiesto con metadata de cada juego
├── sw.js                 # Service Worker (cache-first, offline)
│
├── shared/
│   ├── base.css          # NEON PALETTE + overlay, HUD, touch controls compartidos
│   ├── audio.js          # Web Audio API (beep, ambient)
│   ├── achievements.js   # Logros + contador de partidas
│   ├── effects.js        # Screen shake, partículas, flash, roundRect
│   └── help.js           # Modal de ayuda contextual
│
├── games/
│   ├── pong/             → index.html, style.css, script.js, metadata.json, README.md
│   ├── breakout/         → (misma estructura)
│   ├── snake/
│   ├── ...               # 16 juegos en total
│   └── legacy-3d/        # Versiones Three.js antiguas (solo referencia)
│
└── .agents/skills/
    └── frontend-design.md  # Skill de diseño visual instalada
```

Cada juego tiene **5 archivos**:

| Archivo | Propósito |
|---------|-----------|
| `index.html` | Estructura HTML (loading, HUD, overlay, game bar, touch controls). Sin CSS/JS inline. |
| `style.css` | Estilos específicos: solo define `:root { --accent: ... }` y colores particulares. |
| `script.js` | Módulo ES (`type="module"`). Importa desde `../../shared/`. |
| `metadata.json` | Versión, fechas, changelog. |
| `README.md` | Descripción, controles y características. |

---

## 🎨 Sistema de diseño neon

### Variables CSS compartidas (`shared/base.css`)

```css
--neon-cyan:   #00f0ff;   /* Acento primario */
--neon-pink:   #ff2d78;   /* Acento secundario */
--neon-gold:   #ffb800;   /* Acento terciario */
--neon-green:  #39ff14;   /* Acento verde arcade */
--neon-purple: #c084fc;   /* Acento púrpura */
--neon-red:    #ff5e7a;   /* Acento rojo */
--neon-blue:   #6ec6ff;   /* Acento azul */
--neon-yellow: #ffe066;   /* Acento amarillo */
```

### Por juego: definir `--accent`

Cada `style.css` debe definir su acento y glow:

```css
:root {
  --accent: var(--neon-pink);
  --accent-glow: rgba(255, 45, 120, 0.3);
  --overlay-grad-start: rgba(20, 10, 30, 0.85);
}
```

### Patrones compartidos en `base.css`

`shared/base.css` ya incluye estilos base para:
- **Overlay** (`#overlay`) — con variables `--accent`, `--accent-glow`, `--overlay-grad-start`
- **HUD** — `.score-group`/`.sg`, `.score-block`/`.sb`, `.score-sep`/`.sp`
- **Touch controls** — `#touchControls`/`#tc`, `.dpad`/`.dp`
- **Game bar** — `#gameBar` con botones
- **Loading spinner** — `#loading` con animación
- **Reduced motion** — media query `prefers-reduced-motion`
- **Responsive** — media queries para 520px, 480px

Cada juego solo necesita definir **lo que es único**: colores de score blocks, touch control accent colors, y elementos especiales (leaderboard, name entry, shop).

---

## 🎮 Controles: paridad obligatoria

Todo juego debe soportar desde el primer build:

| Modo | Implementación |
|------|----------------|
| ⌨️ **Teclado** | Flechas/WASD + tecla de acción (`Espacio`) |
| 👆 **Táctil** | Botones on-screen visibles solo en táctil (`@media (hover: none) and (pointer: coarse)`) con feedback (`.is-pressed` + `:active`) |
| 🕹️ **Gamepad** | Polling en el loop principal (stick + D-pad + botón de acción) |
| 🔄 **Reinicio** | Tecla `R` + tap en overlay + botón de acción |

---

## 🔊 Sonido y partículas

- **Sonido**: Web Audio API con `beep({freq, duration, type, volume})` desde `shared/audio.js`. Nunca archivos externos.
- **Ambient**: `startAmbient()` / `stopAmbient()` del mismo módulo para música de fondo drone.
- **Partículas**: `spawnParticles()`, `updateParticles()`, `drawParticles()` desde `shared/effects.js`. Física inline solo si es muy especial.
- **Screen shake**: `triggerShake(intensity)` + `getShakeOffset()` desde `shared/effects.js`.

---

## 💾 Persistencia

`localStorage` con key namespaced: `<gameId>_<clave>` (ej. `pong2d_wins`, `breakout2d_best`).

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

## 🔧 Skills locales recomendadas

El proyecto incluye skills instaladas en `.agents/skills/`. Estas skills proporcionan guías detalladas para tareas específicas. **Usarlas siempre que sea relevante.**

| Skill | Cuándo usarla |
|-------|---------------|
| `frontend-design` | Rediseñar el hub o un juego — define paleta, tipografía, layout y elemento signature |
| `game-feel` | Agregar juicio (juice): screen shake, hit-stop, squash & stretch, knockback |
| `game-ui-ux` | Diseñar HUDs, menús, overlays responsivos y navegación por foco |
| `audio-design` | Diseñar sonido adaptativo, mezcla, ducking, SFX variation |
| `physics-tuning` | Ajustar física: fixed timestep, CCD anti-tunneling, gravedad, drag |
| `input-systems` | Arquitectura de input: action mapping, rebinding, deadzones, accesibilidad |
| `performance-optimization` | Optimizar rendimiento: object pooling, draw-call batching, GC |
| `save-systems` | Diseñar save/load: slots, migración de schemas, escritura atómica |
| `game-balance` | Analizar y balancear economía, dificultad, progresión y reward schedules |
| `itch-publish` | Publicar en itch.io con butler |
| `steam-publish` | Publicar en Steam con SteamPipe |

Para cargar una skill: `skill("nombre-de-skill")`

---

## ✅ Después de construir/modificar un juego

1. ✅ Correr `npm run lint` — 0 errores, 0 warnings
2. ✅ Correr `npm run format` — Prettier sin cambios pendientes
3. ✅ Correr `npm run check` — lint + format combinados
4. ✅ Revisar los 3 modos de entrada (teclado/táctil/gamepad)
5. ✅ Verificar anti-tunneling si hay objetos rápidos
6. ✅ Confirmar que HUD + overlay muestran resultado y récord
7. ✅ Agregar ruta a `FILES` en `sw.js`
8. ✅ Actualizar `README.md` del juego si cambiaron controles, características o metadata
9. ✅ Actualizar `metadata.json` con nueva versión y changelog
10. ✅ **Hacer commit** después de cada tarea completada con mensaje descriptivo

---

## 🧪 Flujo de trabajo sugerido

1. Leer este archivo (`CLAUDE.md`) y `TODO.md` antes de empezar
2. Identificar la skill relevante y cargarla con `skill("nombre")`
3. Ejecutar cambios siguiendo las convenciones
4. Validar con `npm run check`
5. **Commit + push** después de cada tarea

---

## 📐 El hub (`index.html` + `games.js`)

- `games.js` es la única fuente de metadata. El hub solo lo lee.
- `status: 'listo'` = jugable, `'en-desarrollo'` = placeholder sin enlace.
- Rutas siempre relativas (`./games/...`), nunca absolutas.

---

## ⚠️ Anti-tunneling

Si `velocidad_máxima * dt_máximo` es mayor o igual al grosor mínimo de colisión, subdividir el movimiento del frame en sub-pasos.

---

## 📋 Service Worker (`sw.js`)

- Cachea todos los archivos estáticos para offline.
- **Al agregar un juego**: agregar ruta a `FILES`.
- **Al actualizar**: incrementar versión en `CACHE` (ej. `arcadehub-v3`).
- Estrategia: **cache-first**.

---

## Distinción con otros proyectos

Este repo es **deliberadamente simple**: directorio de juegos autocontenidos desde un hub estático. No usa arquitectura de motor compartido, SvelteKit, Express, Prisma ni Supabase como otros proyectos similares.
