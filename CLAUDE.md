# CLAUDE.md — Convenciones técnicas del proyecto

Este archivo documenta cómo trabajar en este repo. **Léelo antes de crear o modificar un juego.**

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
│   ├── audio.js          #   Web Audio API: beep(), startAmbient(), stopAmbient()
│   ├── effects.js        #   Screen shake, partículas, flash, roundRect
│   ├── achievements.js   #   Logros + contador de partidas (localStorage)
│   └── help.js           #   Modal de ayuda contextual con metadata y changelog
│
├── games/                # 16 juegos, cada uno con 5 archivos
│   ├── pong/             → index.html, style.css, script.js, metadata.json, README.md
│   ├── breakout/         → (misma estructura)
│   ├── ...               → 16 en total
│   └── legacy-3d/        → Versiones Three.js archivadas (solo referencia)
│
└── .agents/skills/       → Skills instalados para trabajo con IA
    └── frontend-design.md
```

---

## 🎨 Sistema de diseño neon

### Variables CSS compartidas (`shared/base.css`)

```css
--neon-cyan:   #00f0ff;   /* Acento primario del hub */
--neon-pink:   #ff2d78;   /* Acento secundario */
--neon-gold:   #ffb800;   /* Acento terciario */
--neon-green:  #39ff14;   /* Verde arcade (status listo) */
--neon-purple: #c084fc;
--neon-red:    #ff5e7a;
--neon-orange: #ff8a65;
--neon-blue:   #6ec6ff;
--neon-yellow: #ffe066;
--neon-white:  #ffffff;
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

| Componente | Selectores |
|-----------|------------|
| Overlay | `#overlay` con `--accent`, `--accent-glow`, `--overlay-grad-start/end` |
| HUD | `.score-group`/`.sg`, `.score-block`/`.sb`, `.score-sep`/`.sp` |
| Touch controls | `#touchControls`/`#tc`, `.dpad`/`.dp` |
| Game bar | `#gameBar` con botones estilo panel translúcido |
| Loading | `#loading` con spinner animado |
| Reduced motion | `@media (prefers-reduced-motion)` |
| Responsive | Media queries para 520px, 480px |

Cada `style.css` solo necesita elementos únicos: colores de score blocks, touch control accents, leaderboard, name entry, shop, cards...

---

## 🎮 Controles: paridad obligatoria

Todo juego debe soportar desde el primer build:

| Modo | Cómo |
|------|------|
| ⌨️ **Teclado** | Flechas/WASD + tecla de acción (`Espacio`) + `R` reinicio |
| 👆 **Táctil** | Botones visibles solo en táctil (`@media (hover: none) and (pointer: coarse)`) con feedback (`.is-pressed` + `:active`) |
| 🕹️ **Gamepad** | Polling en loop principal: stick/D-pad para movimiento, botón para acción |
| 🔄 **Reinicio** | Tecla `R` + tap en overlay + botón de acción principal |

---

## 🔊 Sonido y partículas

- **Sonido**: `beep({freq, duration, type, volume})` desde `shared/audio.js`. Nunca archivos externos.
- **Ambient**: `startAmbient()` / `stopAmbient()` para música drone de fondo.
- **Partículas**: `spawnParticles()`, `updateParticles()`, `drawParticles()` desde `shared/effects.js`. Física inline solo si es muy especial.
- **Screen shake**: `triggerShake(intensity)` + `getShakeOffset()` desde `shared/effects.js`.

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

| Skill | Cuándo usarla |
|-------|---------------|
| `frontend-design` | Rediseñar hub o juego — paleta, tipografía, layout, elemento signature |
| `game-feel` | Agregar juicio: screen shake, hit-stop, squash & stretch, knockback |
| `game-engine` | Construir o mejorar juegos Canvas 2D — game loop, físicas, colisiones, sprites |
| `refactor` | Refactorizar código: extraer funciones, mejorar tipos, eliminar code smells |
| `git-commit` | Hacer commits con mensajes convencionales semánticos |

### Complementarias

| Skill | Cuándo usarla |
|-------|---------------|
| `premium-frontend-ui` | Diseño UI inmersivo de alto nivel (animaciones, tipografía, micro-interacciones) |
| `create-implementation-plan` | Planificar implementaciones multi-paso antes de codificar |
| `refactor-plan` | Planificar refactors multi-archivo de forma segura |
| `create-readme` | Generar README.md para nuevos juegos |
| `create-specification` | Crear especificaciones técnicas detalladas |
| `documentation-writter` | Redactar documentación técnica |

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

## ⚠️ Anti-tunneling

Si `velocidad_máxima * dt_máximo >= grosor_mínimo_colisión`, subdividir el movimiento en sub-pasos.

---

## 🧪 Flujo de trabajo recomendado

1. Leer `CLAUDE.md` y `TODO.md` primero
2. Identificar la skill relevante y cargarla
3. Ejecutar cambios siguiendo las convenciones
4. Validar con `npm run check`
5. **Commit + push** después de cada tarea
