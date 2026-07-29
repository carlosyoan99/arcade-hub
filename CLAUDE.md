# CLAUDE.md — Convenciones técnicas del proyecto

Este archivo documenta cómo trabajar en este repo. Leerlo antes de crear o tocar un juego.

## Regla de oro: estética 2D / 2.5D, no 3D

Los juegos de este hub usan **`<canvas>` 2D** como base. Está permitido dar sensación de profundidad ("2.5D") con técnicas como:

- paralaje de fondos (capas que se mueven a distinta velocidad),
- sombras proyectadas dibujadas a mano,
- una leve perspectiva/inclinación simulada (ej. escalar sprites por "distancia"),
- ángulos de cámara fijos tipo isométrico.

Lo que **no** corresponde acá es un motor 3D real (Three.js, WebGL con cámara libre, geometría/luces/materiales 3D). Esas primeras versiones existen en `games/legacy-3d/` (Dino Runner, Pong, Breakout hechos con Three.js) y quedan solo como referencia de patrones de gameplay/física/sonido — no se agregan al manifiesto activo (`games.js`) ni se enlazan desde el hub.

Si se retoma alguno de esos juegos, la tarea es **rehacer el renderizado en canvas 2D**, no portar la escena 3D.

## Estructura del proyecto

```
arcade-hub/
├── index.html          ← Hub principal (grilla de juegos)
├── games.js            ← Manifiesto con metadata de cada juego
├── sw.js               ← Service Worker (cache-first, offline)
├── shared/
│   ├── base.css        ← Estilos base compartidos
│   ├── audio.js        ← Web Audio API (beep, ambient)
│   ├── achievements.js ← Logros + contador de partidas
│   └── effects.js      ← Screen shake, partículas, flash, roundRect
├── games/
│   ├── pong/
│   │   ├── index.html  ← HTML del juego (estructura + etiquetas)
│   │   ├── style.css   ← Estilos específicos del juego
│   │   └── script.js   ← Lógica completa del juego (type="module")
│   ├── breakout/
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   └── … (misma estructura para cada juego)
└── scripts/
    └── restructure.js  ← Script de migración (uso único)
```

Cada juego ocupa una carpeta propia con tres archivos:

- **`index.html`**: estructura HTML (loading, HUD, overlay, game bar, touch controls). Sin CSS ni JS inline.
- **`style.css`**: estilos específicos del juego. Importa variables de `shared/base.css` si las necesita.
- **`script.js`**: lógica completa como módulo ES (`type="module"`). Importa desde `../../shared/` (audio, achievements, effects).

Este diseño permite compartir cada juego individualmente (`games/pong/`) y mantiene el hub como punto de entrada.

## Importaciones entre juegos

- Los juegos pueden importar de los módulos compartidos en `shared/` usando rutas relativas desde su carpeta: `import { ... } from '../../shared/audio.js'`.
- No importar de otros juegos ni de archivos fuera de `shared/`.
- JS organizado en secciones claras: constantes, estado, entrada, física/lógica, render, bucle principal.

## El hub (`index.html` + `games.js`)

- `games.js` es el único lugar con metadata de juegos (`id`, `title`, `description`, `file`, `icon`, `status`). `index.html` solo lee ese array y renderiza tarjetas — no hardcodear juegos ahí.
- `status: 'en-desarrollo'` muestra la tarjeta sin enlace activo. Cuando un juego está jugable, pasar a `'listo'`.
- Rutas siempre relativas (`./games/...`), nunca absolutas con `/` al principio — el proyecto debe poder servirse desde un subpath (ej. GitHub Pages).

## Controles: paridad obligatoria

Todo juego jugable (`status: 'listo'`) debe soportar, desde el primer build (no como parche después):

- **Teclado** (flechas / WASD según corresponda + una tecla de acción).
- **Táctil**: botones on-screen visibles solo en dispositivos táctiles (`@media (hover: none) and (pointer: coarse)`), con feedback visual al presionar (clase `.is-pressed` + `:active`).
- **Gamepad**: polling de la Gamepad API en el loop principal (stick y/o D-pad para movimiento, un botón para iniciar/acción principal).
- Reinicio accesible por más de una vía: tecla `R`, tap/clic en el overlay de fin de partida, y el botón de acción principal.

## Sonido y partículas

- Sonido **sintetizado con Web Audio API** (osciladores + envolvente de ganancia), nunca archivos de audio externos. Un helper `beep({freq, ...})` reutilizable por juego alcanza.
- Efectos de partículas con geometría/objetos livianos, opacidad decayendo con el tiempo de vida, limpieza (`splice` + dispose si aplica) al llegar a vida cero. No dejar acumular partículas sin límite.
- Los juegos pueden importar `spawnParticles`, `updateParticles` y `drawParticles` desde `shared/effects.js` para el sistema de partículas estándar. Si un juego necesita física de partículas especial (gravedad, rotación), puede mantener su propio sistema inline.

## Efectos visuales compartidos (`shared/effects.js`)

`shared/effects.js` provee utilidades reutilizables entre juegos:

- **Screen shake**: `triggerShake(intensity)`, `updateShake(dt)`, `getShakeOffset()` — llamar en el bucle principal y aplicar `ctx.translate(so.x, so.y)` en el render.
- **Partículas**: `spawnParticles(x, y, color, count, opts)`, `updateParticles(dt)`, `drawParticles(ctx, ox, oy, sc)` — sistema genérico de partículas con decaimiento y glow.
- **Flash**: `triggerFlash(intensity)`, `updateFlash(dt)`, `drawFlash(ctx, w, h)` — destello blanco para transiciones o explosiones grandes.
- **roundRect**: `roundRect(ctx, x, y, w, h, r)` — rectángulo con esquinas redondeadas.

## Física y colisiones: cuidado con el "tunneling"

Si un objeto se mueve rápido y el `dt` del frame es grande, puede saltarse la detección de colisión en un solo frame (atravesar una paleta o un obstáculo delgado). Antes de subir la velocidad máxima de algo, verificar: `velocidad_máxima * dt_máximo` contra el grosor mínimo de colisión de la escena. Si es comparable o mayor, subdividir el movimiento del frame en sub-pasos limitados en distancia en vez de solo agrandar márgenes de hitbox.

## Persistencia

`localStorage` namespaced por juego: `<gameId>_<clave>` (ej. `breakout2d_best`, `pong2d_wins`). No usar claves genéricas que puedan chocar entre juegos.

## Service Worker (`sw.js`)

El proyecto incluye un Service Worker que cachea todos los archivos estáticos para jugar offline.

- Al agregar un juego nuevo, actualizar `FILES` en `sw.js` con la ruta al nuevo `.html`.
- Para forzar una actualización del caché en los navegadores ya visitados, incrementar la versión en `CACHE` (ej: `arcadehub-v2`).
- El SW se registra automáticamente desde `index.html` y sigue una estrategia **cache-first**.

## Después de construir un juego: auditoría

Antes de marcar un juego como `'listo'` en `games.js`:

1. Revisar que no queden funciones o constantes sin usar.
2. Revisar los tres modos de entrada (teclado/táctil/gamepad).
3. Revisar el caso de velocidad máxima para tunneling (ver arriba).
4. Confirmar que el HUD y el overlay de fin de partida muestran el resultado y el récord persistido.
5. Validar la sintaxis del `<script>` antes de entregar.
6. Agregar la ruta del nuevo juego a la lista `FILES` en `sw.js`.

## Distinción con el otro proyecto "GameHub"

Este repo es independiente del hub modular de Canvas más grande (con `Game Interface`, `StorageManager`, `import()` dinámico y suite de tests `jsdom`) y también del proyecto full-stack GameHub (SvelteKit + Express + Prisma + Supabase). Este es deliberadamente más simple: un directorio de juegos autocontenidos enlazados desde una página estática, sin arquitectura de motor compartido.
