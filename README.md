# Arcade Hub

Un hub que reúne **10 recreaciones de juegos clásicos** (Pong, Breakout, Snake, Asteroids, Space Invaders, Flappy Bird, Dino Runner, Pac-Man, Tetris y Frogger) con **estética 2D o ligeramente 2.5D**. Cada juego es un único archivo HTML autocontenido; el hub (`index.html`) solo enlaza a cada uno.

## Filosofía

- **Cero dependencias de build.** Se abre `index.html` en el navegador y listo.
- **Un archivo por juego.** Cada `games/*.html` es HTML + CSS + JS vanilla en un solo archivo, sin imports entre juegos. Se puede compartir o abrir suelto sin necesitar el resto del proyecto.
- **Estética 2D / 2.5D.** Los juegos usan `<canvas>` 2D (o, cuando aporta profundidad real, una ligera perspectiva/paralaje). Nada de motores 3D: la carpeta `games/legacy-3d/` guarda las primeras versiones (Dino Runner, Pong, Breakout) hechas con Three.js — quedan documentadas como referencia de patrones de gameplay, pero no son parte del hub activo porque no encajan con la dirección visual del proyecto.

## Cómo correrlo

No requiere instalación. Alcanza con:

```bash
# cualquier servidor estático simple, por ejemplo:
python3 -m http.server 8000
```

y abrir `http://localhost:8000`. También funciona abriendo `index.html` directo desde el filesystem (`file://`), salvo en los juegos que usen `type="module"` con rutas relativas, que en algunos navegadores requieren servirse por HTTP.

## Estructura

```
arcade-hub/
├── index.html       # el hub: lee games.js y arma la grilla de tarjetas
├── games.js         # manifiesto de juegos (metadata, no lógica de juego)
├── games/           # un .html autocontenido por juego
│   ├── legacy-3d/   # versiones 3D previas, fuera del roster activo
│   └── game/        # juego 2d completo
│       ├── index.html    # punto de entrada de cada juego
│       ├── metadata.json # metadatos de cada juego
│       ├── script.js     # javascript
│       └── style.css     # estilo CSS del juego
├── asset/           # contenido multimedia
│   └── icons/       # iconos del juego
├── README.md
├── CLAUDE.md        # convenciones técnicas para trabajar con IA en este repo
└── TODO.md          # próximas tareas a realizar
```

## Agregar un juego nuevo

1. Crear `games/<nombre>.html` — un solo archivo, JS vanilla, sin dependencias externas salvo que sea estrictamente necesario y esté justificado.
2. Agregar una entrada en `games.js` con `status: 'listo'`.
3. Listo — el hub lo va a mostrar automáticamente en la próxima carga.

Ver `CLAUDE.md` para las convenciones de código, sonido, controles y
persistencia que deberían mantener todos los juegos del hub.

## Estado actual

Todos los **10 juegos planeados están implementados y jugables** ✅

| #   | Juego                 | Descripción                                          |
| --- | --------------------- | ---------------------------------------------------- |
| 1   | 🏓 **Pong**           | Tenis de mesa con IA, partículas, 3 modos de control |
| 2   | 🧱 **Breakout**       | Rompe ladrillos con 5 filas, niveles progresivos     |
| 3   | 🐍 **Snake**          | La serpiente clásica, crece al comer                 |
| 4   | 🦖 **Dino Runner**    | Side-scroller, esquivá cactus y pterodáctilos        |
| 5   | 🚀 **Asteroids**      | Asteroides que se fragmentan, nave con inercia       |
| 6   | 👾 **Space Invaders** | Oleadas de invasores, escudos, nave misteriosa       |
| 7   | 🐤 **Flappy Bird**    | Volá esquivando tubos con gravedad                   |
| 8   | 🟡 **Pac-Man**        | Laberinto con 4 IAs de fantasmas, power pellets      |
| 9   | 🧊 **Tetris**         | 7 piezas, ghost piece, hold, next preview            |
| 10  | 🐸 **Frogger**        | Cruzá calle y río, 5 zonas seguras                   |

Cada juego soporta **teclado, táctil y gamepad**, incluye sonido sintetizado con Web Audio API, partículas y persistencia de récords en localStorage.

Las versiones 3D (Three.js) de Pong, Breakout y Dino Runner están archivadas en `games/legacy-3d/` como referencia técnica, pero no forman parte del hub activo.

Ver `TODO.md` para el backlog de mejoras futuras.
