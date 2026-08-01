# 🤝 Contributing — Arcade Hub

¡Gracias por querer contribuir! 🕹️

Este documento resume cómo trabajar en el proyecto. Se apoya en dos fuentes:

- **`CLAUDE.md`** — convenciones técnicas detalladas (léelo antes de crear o modificar un juego)
- **`README.md`** — documentación avanzada del proyecto (arquitectura, módulos, accesibilidad, rendimiento)

---

## 📋 TL;DR

| Quiero…                               | Hacé esto                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| **Agregar un juego nuevo**            | Seguí [Cómo agregar un juego nuevo](#-cómo-agregar-un-juego-nuevo)                |
| **Modificar un juego existente**      | Seguí el [workflow](#-workflow-de-desarrollo) y la [checklist](#-checklist-de-pr) |
| **Tocar `shared/`** (módulos comunes) | Cargá las skills `refactor` + `context-map` y avisá en el PR (impacta 19 juegos)  |
| **Rediseñar el hub o un juego**       | Cargá la skill `frontend-design` o `premium-frontend-ui`                          |
| **Agregar game feel**                 | Cargá la skill `game-feel`                                                        |
| **Reportar un bug**                   | Abrí un issue con: pasos para reproducir, navegador/OS y consola                  |

---

## 🚀 Setup de desarrollo

**Requisitos:** Node.js ≥ 22 (para tooling) + un navegador moderno. El proyecto no necesita build: los juegos son HTML/CSS/JS estáticos.

```bash
# 1. Clonar
git clone git@github.com:carlosyoan99/arcade-hub.git
cd arcade-hub

# 2. Instalar devDependencies (eslint, prettier, jsdom)
npm install

# 3. Servir la raíz (los juegos usan type="module", no funcionan con file://)
python3 -m http.server 8000
# o: npx serve .

# 4. Abrir http://localhost:8000
```

> ⚠️ **Regla de oro del proyecto: estética 2D/2.5D, no 3D.** Los juegos usan `<canvas>` 2D (paralaje, sombras proyectadas, perspectiva simulada). **No** usar motores 3D (Three.js, WebGL). Las versiones 3D antiguas viven en `games/legacy-3d/` solo como referencia de gameplay y **no** se agregan al manifiesto.

---

## 🎮 Cómo agregar un juego nuevo

Agregar un juego es un proceso de **9 pasos**. La referencia rápida está en el README (sección _"Cómo agregar un juego nuevo"_); acá está la versión extendida con los detalles de implementación.

### 1. Crear la carpeta con los 5 archivos (+ screenshot)

```bash
mkdir games/mi-juego
```

Cada juego tiene **5 archivos requeridos** (+ `screenshot.png` recomendado):

| Archivo          | Rol               | Contenido típico                                                                |
| ---------------- | ----------------- | ------------------------------------------------------------------------------- |
| `index.html`     | Estructura        | Canvas (`role="img"` + `aria-label`), loading, HUD, overlay, touch controls     |
| `style.css`      | Estilo específico | Solo `:root { --accent: ...; --accent-glow: ... }` + elementos únicos           |
| `script.js`      | Lógica            | Módulo ES que importa desde `../../shared/`                                     |
| `metadata.json`  | Metadatos         | Versión SemVer, fechas, `changelog[]` (se muestra en el modal de ayuda)         |
| `README.md`      | Documentación     | Template con descripción, controles, características, logros, detalles técnicos |
| `screenshot.png` | Captura _(opc.)_  | 1024×768 del juego en acción (se muestra en el README)                          |

**Sugerencia:** copiá un juego existente como punto de partida (`cp -r games/pong games/mi-juego`) y reemplazá el contenido — es más rápido que empezar de cero y garantiza que respetás la estructura.

### 2. Seguir las convenciones técnicas

| Aspecto           | Regla                                                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Renderizado**   | `<canvas>` 2D — nada de Three.js ni WebGL                                                                                                                      |
| **Paleta neon**   | Usar variables `var(--neon-cyan)`, `var(--neon-pink)`, etc. de `shared/base.css`; cada juego define solo `--accent`                                            |
| **Entrada**       | Paridad obligatoria desde el primer build: teclado (flechas/WASD + acción + `R`) + táctil (`.is-pressed` + `@media (hover: none)`) + gamepad (polling en loop) |
| **Overlay**       | Estructura `#overlay` de `base.css` con `--accent`, `--accent-glow`, `--overlay-grad-start`                                                                    |
| **Ayuda**         | Importar `showHelp` de `../../shared/help.js` y conectarlo al `#helpBtn`                                                                                       |
| **Módulos**       | Importar desde `../../shared/` — **nunca** importar de otros juegos ni de fuera de `shared/`                                                                   |
| **Persistencia**  | `localStorage` con key namespaced: `<gameId>_<clave>` (ej. `pong2d_wins`)                                                                                      |
| **Sonido**        | `beep({freq, duration, type, volume})` desde `shared/audio.js` — nunca archivos externos                                                                       |
| **Game feel**     | `feedbackBundle(tier, x, y, opts)`, `hitStop()`, `triggerSquash()`, `triggerShake()` desde `shared/effects.js`                                                 |
| **Game loop**     | `createGameLoop()` desde `shared/loop.js` — RAF con dt + cleanup (nunca `setInterval`)                                                                         |
| **Rendimiento**   | Sin `shadowBlur` dentro de loops — usar `drawGlow()` / `fillWithGlow()` de `shared/effects.js`                                                                 |
| **Accesibilidad** | Canvas con `role="img"`, viewport sin `user-scalable=no`, `aria-live`, `prefers-reduced-motion`, `:focus-visible`                                              |

**Estructura mínima del `script.js`** (mismo orden que los 19 juegos existentes):

```js
import { showHelp } from '../../shared/help.js';
import { ensureAudio, beep, startAmbient, stopAmbient, closeAudio } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements } from '../../shared/dom.js';
import { setupCanvas } from '../../shared/display.js';
import { createGameLoop } from '../../shared/loop.js';
import { createGamepad } from '../../shared/input.js';
// + lo que necesites de shared/effects.js

injectCommonElements();

// ── CONSTANTES ──  (sin magic numbers)
// ── ESTADO ──
// ── CANVAS SETUP ──  (setupCanvas + getContext('2d', { alpha: false }))
// ── ENTRADA ──  (teclado + bindHoldButton táctil + polling de gamepad)
// ── LÓGICA ──  (update con dt)
// ── RENDER ──  (draw)
// ── BUCLE PRINCIPAL ──  (createGameLoop + loop.start())
// ── CLEANUP ──  (loop.stop() + closeAudio() en beforeunload/pagehide)
```

### 3. Registrar el juego en el hub (`games.js`)

`games.js` es la **única fuente de verdad** de metadata. El hub solo lo lee y renderiza. Agregá una entrada:

```js
{
  id: 'mi-juego',
  title: 'Mi Juego',
  description: 'Una breve descripción del juego.',
  file: 'games/mi-juego/index.html',
  icon: '🎮',
  thumbnail: './asset/icons/game-mi-juego.svg',
  status: 'listo',       // o 'en-desarrollo' para placeholder sin enlace
  created: '2026-08-01',
}
```

- Rutas siempre **relativas** (`./games/...`), nunca absolutas con `/`
- `status: 'listo'` = jugable con enlace activo; `'en-desarrollo'` = placeholder
- Actualizá también la tabla de juegos del `README.md` principal (versión, género, descripción)

### 4. Agregar al Service Worker (`sw.js`)

- Agregar las rutas del juego (`./games/mi-juego/index.html`, `style.css`, `script.js`, `metadata.json`) al array `FILES`
- Si ya hay usuarios en producción, incrementar la versión en `CACHE` (ej. `arcadehub-v3` → `arcadehub-v4`)
- **No olvidar los archivos de `shared/` nuevos** — `scripts/verify.js` detecta automáticamente imports de `shared/` que falten en `FILES`

### 5. Accesibilidad desde el primer build

| Requisito              | Implementación                                                                |
| ---------------------- | ----------------------------------------------------------------------------- |
| Anuncios               | `#announce` con `aria-live="polite"` (lo inyecta `injectCommonElements()`)    |
| Focus trap en overlays | `trapTab()` sobre el overlay de fin de partida                                |
| Reduced motion         | `@media (prefers-reduced-motion)` + `setShakeScale(0)`/`setParticlesScale(0)` |
| Zoom móvil             | Viewport **sin** `user-scalable=no` (WCAG 1.4.4)                              |
| Canvas semántico       | `role="img"` + `aria-label` en el `<canvas>`                                  |
| Foco visible           | `:focus-visible` global ya incluido en `shared/base.css`                      |
| Touch targets          | Botones ≥ 44×40px (game bar y touch controls)                                 |

### 6. Logros (opcional)

```js
import { achievements } from '../../shared/achievements.js';
// En la condición del logro:
achievements.unlock('mi_juego_logro');
```

Se persisten en `localStorage` (`ach_data`) y se anuncian con un beep. Documentalos en el `README.md` del juego (sección **Logros**) con la condición exacta.

### 7. README del juego + metadata.json

- **`metadata.json`**: versión `1.0.0`, `created` (fecha), `lastModified`, `changelog[]` con `{ version, date, changes[] }`
- **`README.md`**: seguí el template de los juegos existentes:
  `# título` → **Versión/Género/Última actualización** → descripción → `## Captura` (con `![X en acción](./screenshot.png)`) → `## Controles` (tabla) → `## Características` → `## Logros` → `## Detalles técnicos` → `## Changelog`
  (`## Consejos` es opcional — pong, breakout, dino-runner, flappy-bird y asteroids la incluyen)
- Cada bump de versión debe reflejarse en: `metadata.json` (changelog), `README.md` (versión + changelog) y, si aplica, el modal de ayuda ya lo muestra automáticamente

### 8. Screenshot (recomendado)

- Capturá el juego **en acción** (no la pantalla de menú) a **1024×768** PNG
- Los 19 juegos actuales tienen `screenshot.png` — mantené la consistencia

### 9. Validar

```bash
npm run check    # lint + format + verify + test (todo en uno)
```

---

## 📏 Estándares de código

### Módulos compartidos

| Módulo                   | Exports principales                                                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/audio.js`        | `ensureAudio()`, `beep()`, `startAmbient()`, `stopAmbient()`, `closeAudio()`                                                                                |
| `shared/effects.js`      | `triggerShake()`, `hitStop()`, `feedbackBundle()`, `spawnParticles()`, `drawGlow()`, `fillWithGlow()`, `strokeWithGlow()`, `triggerSquash()`, `roundRect()` |
| `shared/achievements.js` | `achievements.unlock()`, `.has()`, `.incrementPlays()`, `.getPlays()`                                                                                       |
| `shared/help.js`         | `showHelp(gameId)` — modal accesible con focus trap y restauración de foco                                                                                  |
| `shared/display.js`      | `setupCanvas()` — DPR + letterboxing + resize con debounce                                                                                                  |
| `shared/dom.js`          | `injectCommonElements()` — loading, `#announce` aria-live, game bar                                                                                         |
| `shared/loop.js`         | `createGameLoop()` — RAF + dt + cleanup unificado                                                                                                           |
| `shared/input.js`        | `createGamepad()`, `bindHoldButton()`                                                                                                                       |

**Reglas:**

- Si modificás un export de `shared/`, buscá y actualizá **todas** sus referencias (los 19 juegos) — `npm run verify` + los smoke tests ayudan a detectar roturas
- No dupliques lógica que ya existe en `shared/` — reutilizala
- Cambios en `shared/` impactan a los 19 juegos: probá más que el juego que estás tocando

### Rendimiento Canvas 2D

| Antipatrón                             | Problema                            | Alternativa                                                   |
| -------------------------------------- | ----------------------------------- | ------------------------------------------------------------- |
| `shadowBlur` dentro de loops           | Blur escala con #entidades          | `drawGlow()` / `fillWithGlow()` (doble `arc()+fill()`)        |
| `setInterval` para game loop           | Sin sincronización con el monitor   | `requestAnimationFrame` (`createGameLoop`)                    |
| `getImageData`/`putImageData`          | Lectura/escritura lenta de píxeles  | Canvas 2D regular                                             |
| `ctx.filter`                           | Deshabilita aceleración gráfica     | Efectos manuales con `globalAlpha`/`globalCompositeOperation` |
| `splice`/`filter` en arrays cada frame | Fragmenta memoria (GC pressure)     | Object pooling con flag `alive`                               |
| Resize sin debounce                    | Recrea el backing buffer del canvas | Debounce 100-150ms (ya en `setupCanvas`)                      |

**Además:** `getContext('2d', { alpha: false })` y preferir `transform`/`opacity` para animaciones CSS.

### Anti-tunneling

Si `velocidad_máxima * dt_máximo >= grosor_mínimo_colisión`, subdividí el movimiento en sub-pasos.

```js
// Ejemplo: mover en sub-pasos para no atravesar paredes
const steps = Math.ceil((maxSpeed * dt) / minThickness);
for (let i = 0; i < steps; i++) {
  entity.x += (vx * dt) / steps;
  checkCollisions();
}
```

### Persistencia

`localStorage` con keys namespaced: `<gameId>_<clave>` (ej. `pong2d_wins`, `breakout2d_best`). El sistema de logros usa `ach_data` (no lo toques a mano).

### Sonido y partículas

- Sonido: `beep({freq, freqEnd, duration, type, volume})` — nunca archivos de audio externos
- Init de audio: `ensureAudio()` en `startGame()` (gesto de usuario) y `closeAudio()` en cleanup
- Ambient: `startAmbient()` / `stopAmbient()` para drone de fondo
- Game feel: `feedbackBundle(tier, x, y, opts)` (sonido + partículas + flash en un call), `hitStop()`, `triggerSquash()` — y `updateSquashes(dt)` en el loop, `clearSquashes()` en `startGame()`
- Glow: `drawGlow(ctx, x, y, r, color)` en vez de `shadowBlur` dentro de loops

### Estilos CSS

- `shared/base.css` ya cubre: variables neon, overlay, HUD, touch controls, game bar, `:focus-visible`, `prefers-reduced-motion`, responsive
- Cada `style.css` solo necesita: `--accent`/`--accent-glow`, colores de score blocks, touch control accents y elementos únicos (leaderboard, shop, cards…)
- No repitas estilos que ya están en `base.css`

### Skills de IA disponibles

El repo incluye skills en `.agents/skills/` para trabajar con IA: `game-engine`, `game-feel`, `frontend-design`, `refactor`, `performance-optimization`, `game-ai`, `procedural-gen`, `save-systems`, `audio-design`, etc. Cargá la skill relevante antes de ejecutar una tarea (ver `CLAUDE.md`).

---

## 🧪 Validación

| Comando          | Qué hace                                                                 |
| ---------------- | ------------------------------------------------------------------------ |
| `npm run lint`   | ESLint sobre todos los `.js` — **0 errores, 0 warnings**                 |
| `npm run format` | Prettier check sobre `js/mjs/css/html/json/md`                           |
| `npm run verify` | `scripts/verify.js` — consistencia manifiesto ↔ disco ↔ sw.js ↔ metadata |
| `npm test`       | `node --test` — smoke tests con jsdom para los **19 juegos**             |
| `npm run check`  | Pipeline completa: lint + format + verify + test                         |

> ⚠️ **`npm run check` debe pasar en 0 errores / 0 warnings antes de abrir un PR.** La CI (`deploy.yml`) corre la pipeline completa (`npm run lint` + `npm run format` + `npm run verify` + `npm test`) en cada push a `main` y despliega a GitHub Pages automáticamente.

---

## 🛠️ Workflow de desarrollo

1. Creá una rama: `git checkout -b feat/mi-juego` (o `fix/...`, `refactor/...`)
2. Implementá siguiendo las convenciones de este documento
3. `npm run check` hasta que pase 0/0
4. Probá manualmente los **3 modos de entrada** (teclado/táctil/gamepad)
5. Verificá anti-tunneling si hay objetos rápidos
6. Confirmá que HUD + overlay muestran resultado y récord persistido
7. Actualizá `sw.js` (`FILES` + `CACHE`) si agregaste/modificaste archivos
8. Actualizá `README.md` y `metadata.json` del juego (versión + changelog)
9. Hacé commit con mensaje semántico (ver abajo)
10. Abrí el PR contra `main`

### Mensajes de commit

Usá [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: agrega juego nuevo X
fix: corrige colisión en pong
refactor: extrae constantes de tetris
perf: reemplaza shadowBlur por drawGlow
docs: actualiza README de snake
a11y: mejora focus trap del modal de ayuda
```

---

## ✅ Checklist de PR

### Antes de abrir el PR

- [ ] `npm run check` pasa (lint 0/0, prettier OK, verify OK, 19/19 tests)
- [ ] Juego nuevo: 5 archivos requeridos + `screenshot.png` en `games/<id>/`
- [ ] Juego nuevo: entrada registrada en `games.js` con `status: 'listo'`
- [ ] `sw.js`: rutas del juego en `FILES` (y bump de `CACHE` si aplica)
- [ ] `metadata.json`: versión, fechas y changelog actualizados
- [ ] `README.md` del juego: versión sincronizada con `metadata.json`, template completo
- [ ] Probar teclado, táctil y gamepad
- [ ] Verificar anti-tunneling (objetos rápidos)
- [ ] HUD + overlay muestran resultado y récord persistido
- [ ] Accesibilidad: canvas `role="img"`, viewport sin `user-scalable=no`, `aria-live`, reduced-motion
- [ ] Sin `shadowBlur` dentro de loops
- [ ] No quedan archivos temporales ni logs de debug

### Descripción del PR

```markdown
## Qué cambia

<Resumen en 2-3 líneas>

## Cómo probar

1. `python3 -m http.server 8000`
2. Abrir el juego / el hub
3. Probar controles (teclado/táctil/gamepad)

## Validación

- [ ] npm run check pasa
- [ ] Tests: 19/19
```

### CI

Al hacer push a `main`, GitHub Actions ejecuta la pipeline completa (`npm run lint` + `npm run format` + `npm run verify` + `npm test`) y despliega a GitHub Pages. Si el deploy falla, revisá los logs del workflow antes de reabrir el PR.

---

## 📚 Recursos

- **`CLAUDE.md`** — convenciones técnicas completas del proyecto
- **`README.md`** — arquitectura, módulos compartidos, accesibilidad, FAQ
- **`TODO.md`** — estado de fases y tareas pendientes
- **`.agents/skills/`** — skills de IA instaladas (26 skills + templates de juegos)
