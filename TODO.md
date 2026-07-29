# TODO — Arcade Hub

## ✅ Completado

### Setup

- [x] Estructura de carpetas (`games/`, `games/legacy-3d/`)
- [x] Hub (`index.html` + `games.js`)
- [x] README.md / CLAUDE.md / TODO.md
- [x] Cada juego en `games/<nombre>/` con `index.html` + `style.css` + `script.js`
- [x] `shared/` con módulos reutilizables: `effects.js`, `audio.js`, `achievements.js`, `help.js`, `base.css`

### Juegos implementados (14/14)

| Juego              | Detalle                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| 🏓 Pong            | Cancha vista de arriba, paletas y pelota en canvas 2D. IA, partículas, teclado/táctil/gamepad.      |
| 🧱 Breakout        | Paleta abajo, ladrillos arriba. 5 filas de colores, niveles progresivos, récord persistido.         |
| 🦖 Dino Runner     | Side-scroller clásico: saltar y agacharse, velocidad progresiva.                                    |
| 🐍 Snake           | La serpiente clásica. Crece al comer, game over al chocar.                                          |
| 🚀 Asteroids       | Nave espacial, asteroides que se fragmentan, vidas.                                                 |
| 👾 Space Invaders  | Oleadas de invasores, escudos, nave misteriosa, velocidad progresiva.                               |
| 🐤 Flappy Bird     | Volá esquivando tubos con gravedad y aleteo.                                                        |
| 🟡 Pac-Man         | Laberinto completo, 4 IAs de fantasmas con comportamientos distintos, power pellets.                |
| 🧊 Tetris          | 7 piezas (tetrominós), ghost piece, next preview, niveles, puntaje con combos.                      |
| 🐸 Frogger         | Calle con tráfico, río con troncos/tortugas, 5 zonas seguras, temporizador.                         |
| 🛸 Galaga          | Oleadas de invasores en formación, picados en espiral, disparos, puntaje.                           |
| 🐛 Centipede       | Ciempiés serpenteante, hongos, araña, pulgas, escorpiones, hongos venenosos.                        |
| ⛏️ Dig Dug         | Excavación de túneles, inflar enemigos, rocas que caen, frutas bonus.                               |
| 🚀 Missile Command | Defensa de ciudades con misiles interceptores, misiles inteligentes, satélites, misil teledirigido. |

### Hub — mejoras

- [x] Grilla responsiva de tarjetas con estado "listo" / "en-desarrollo"
- [x] Rutas relativas para compatibilidad con GitHub Pages
- [x] Diseño moderno: animaciones, hover effects, tipografía Orbitron, gradientes neon
- [x] Fondo animado con canvas (nebulosas, estrellas, grid)
- [x] Favicon personalizado (SVG arcade neon con D-Pad + botones)
- [x] Meta tags Open Graph + Twitter Card
- [x] Selector de tema oscuro/claro con persistencia en localStorage
- [x] Animaciones de entrada con fade-in + scale en overlays de todos los juegos
- [x] Música de fondo ambiente (drone sintetizado con Web Audio API) en cada juego
- [x] Sistema de logros/achievements con persistencia compartida en localStorage
- [x] Toolbar con selector de orden (defecto, nombre, nuevos, más jugados)
- [x] Toggle vista grilla / lista con persistencia
- [x] Búsqueda por texto con debounce + tecla Escape para limpiar
- [x] Contador de partidas en tarjetas del hub (vista grilla)
- [x] Ranking Top 3 de juegos más jugados
- [x] Indicador visual de juego más jugado en estadísticas
- [x] Modal de ayuda contextual con descripción, controles y logros
- [x] Versión, fecha y changelog desde metadata.json en modal de ayuda
- [x] metadata.json por juego con versión, fechas y changelog

### Juegos — mejoras y correcciones

- [x] Limpieza de recursos: `cancelAnimationFrame` + `removeEventListener` + `audioCtx.close()` en todos los juegos
- [x] `preventDefault` condicional en Snake (ya no bloquea atajos del navegador)
- [x] Refactorización de variables: Space Invaders, Pac-Man y Tetris con nombres legibles
- [x] Favicon individual (SVG inline) para cada juego
- [x] Loading spinner con animación CSS en cada juego
- [x] Tema oscuro/claro aplicado a todos los juegos
- [x] Botón "Volver al Arcade Hub" en cada juego
- [x] Botón de pantalla completa en cada juego
- [x] Botón de ayuda (❓) en cada juego
- [x] Screen shake y roundRect extraídos a `shared/effects.js`
- [x] Sub-pasos de colisión anti-tunneling en Dino Runner y Asteroids
- [x] Logros definidos para todos los juegos (15 logros en total)
- [x] Service Worker (`sw.js`) con cache-first para jugar offline
- [x] Missil teledirigido en Missile Command (cada 8 kills)

---

## 📋 Pendientes

### 🟡 Auditoría — Hallazgos IMPORTANTES

| Prioridad | Hallazgo                                  | Juegos afectados   | Detalle técnico                                                                                                                                                                                         |
| --------- | ----------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~🟡 1~~  | **Partículas → shared/effects.js**        | ~~8 juegos~~       | ✅ **CORREGIDO**: Todos los juegos ahora usan `spawnParticles`/`updateParticles`/`drawParticles` de `shared/effects.js`. `shared/effects.js` mejorado con soporte de gravedad y fricción por partícula. |
| ~~🟡 2~~  | **Achievements → shared/achievements.js** | ~~3 juegos~~       | ✅ **CORREGIDO**: Código inline eliminado de asteroids, space-invaders y snake. Todos los juegos importan `achievements` de `shared/achievements.js`.                                                   |
| ~~🟡 3~~  | **Beep `vol` → `volume`**                 | ~~space-invaders~~ | ✅ **CORREGIDO**: Typo `vol:0.15` → `volume:0.15` en space-invaders.                                                                                                                                    |

### 🟢 Auditoría — Hallazgos MENORES

| Prioridad | Hallazgo                               | Juegos afectados      | Detalle                                                                                                                                                                                                                                  |
| --------- | -------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~🟢 4~~  | **roundRect duplicado**                | ~~3 juegos~~          | ✅ **CORREGIDO**: No hay funciones `roundRect` locales — la refactorización anterior ya las había eliminado.                                                                                                                             |
| ~~🟢 5~~  | **achievements.unlock() en endGame()** | ~~5 juegos~~          | ✅ **CORREGIDO**: Agregado `achievements.unlock()` dentro de `endGame()` después de actualizar `state.best`. El logro se desbloquea en la misma partida donde se alcanza el umbral. El check en `startGame()` se mantiene como fallback. |
| ~~🟢 6~~  | **Missile Command HUD**                | ~~missile-command~~   | 🟡 **NO SE CORRIGE**: Las ciudades ya se muestran visualmente con puntos (●●●●●●) en el HUD. Suficiente para el gameplay.                                                                                                                |
| ~~🟢 7~~  | **Pac-Man tecla R**                    | ~~pacman~~            | ✅ **YA ESTABA CORREGIDO**: El handler `KeyR` ya existía en el keydown de Pac-Man.                                                                                                                                                       |
| ~~🟢 8~~  | **Partículas sin límite**              | ~~shared/effects.js~~ | ✅ **CORREGIDO**: Agregado `if (particles.length > 500) break;` en `spawnParticles()` de `shared/effects.js`.                                                                                                                            |

### Ideas para features futuros

- [ ] Joust
- [ ] Defender
- [ ] Paperboy
- [ ] Ícono/thumbnail real por juego en vez de emoji (solo si el hub crece)
- [ ] Probar el deploy en GitHub Pages (rutas relativas, no absolutas)
- [ ] Badge "¡Nuevo!" en juegos lanzados en los últimos 30 días
- [ ] Transición suave entre temas claro/oscuro en todo el hub
