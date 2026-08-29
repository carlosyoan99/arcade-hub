# Spec: Nuevos Juegos Retro — Arcade Hub

> **Fecha:** 2026-08-28
> **Estado:** ✅ COMPLETADO (2026-08-29)
> **Alcance:** 13 juegos nuevos (de 19 originales, eliminados 7 redundantes/complejos)
> **Catálogo total tras implementación:** 32 juegos

---

## ✅ Estado de implementación

| Fase | Juegos                                       | Estado        | Commit     |
| ---- | -------------------------------------------- | ------------- | ---------- |
| 1    | Columns, Pole Position, Moon Patrol, Tempest | ✅ Completado | `b3e78d4`  |
| 2    | Bomberman, Raiden, Gradius, Q*bert           | ✅ Completado | `ac4674b`+ |
| 3    | Double Dragon, BurgerTime, Paperboy          | ✅ Completado | `6ff2751`  |
| 4    | Puyo Puyo, Out Run                           | ✅ Completado | `20c27be`  |

**Total:** 13/13 juegos implementados. 320/320 tests pasando.

---

## 1. Visión General

Agregar 13 juegos retro clásicos al catálogo de 19, priorizando los más simples primero para generar momentum rápido y cubrir géneros faltantes.

### Decisiones de diseño

| Decisión         | Elección                                                            | Razón                                                                 |
| ---------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Estilo**       | Fieles al original + estética neon                                  | Consistencia con los 19 actuales                                      |
| **Perspectiva**  | 2D/2.5D (pseudo-3D e isométrico permitidos)                         | Sin WebGL/Three.js                                                    |
| **Entrada**      | Teclado + táctil + gamepad desde día 1                              | Paridad obligatoria (CONTRIBUTING.md)                                 |
| **Achievements** | 2-3 por juego                                                       | Consistencia con catálogo actual                                      |
| **Música**       | Shooter/action/racing (8 de 13); puzzles e isométricos solo ambient | Excepción: Bomberman (acción) sí recibe tema a pesar de ser laberinto |
| **Co-op**        | No por ahora                                                        | Simplificar implementación inicial                                    |

### Juegos eliminados (7)

| Juego            | Razón de eliminación                                   |
| ---------------- | ------------------------------------------------------ |
| Galaxian         | Redundante con Space Invaders + Galaga                 |
| Dig Dug 2        | Dig Dug ya existe, estilo muy similar                  |
| Pac Championship | Pac-Man ya existe, variante menor                      |
| Combat 1942      | Top-down shooter genérico, no aporta nada nuevo        |
| Mega Blast       | Demasiado complejo (6 armas, 6 bosses, slide dodge)    |
| Dungeon Explorer | Requiere inventario, mapas, puzzles — es otro proyecto |
| Bubble Bobble    | 100 niveles es overkill, demasiado tiempo              |

---

## 2. Catálogo Final (13 juegos nuevos)

### Por prioridad (usuario seleccionó: Columns, Bomberman, Raiden, Pole Position)

> **Nota de orden:** los 4 ⭐ Alta (Columns, Bomberman, Raiden, Pole Position) no se implementan todos primero. El orden de fases prioriza "simples primero" para generar momentum: Columns y Pole Position abren (Fase 1), mientras que Bomberman y Raiden van en Fase 2 por su complejidad moderada. Esto no cambia el alcance, solo el orden de entrega.

| #   | ID              | Nombre        | Género              | Dificultad | Prioridad | Perspectiva     |
| --- | --------------- | ------------- | ------------------- | ---------- | --------- | --------------- |
| 1   | `columns`       | Columns       | Puzzle              | Simple     | ⭐ Alta   | Grid vertical   |
| 2   | `bomberman`     | Bomberman     | Laberinto/Acción    | Moderado   | ⭐ Alta   | Top-down grid   |
| 3   | `raiden`        | Raiden        | Vertical shooter    | Moderado   | ⭐ Alta   | Vertical scroll |
| 4   | `pole-position` | Pole Position | Racing              | Simple     | ⭐ Alta   | Top-down 2D     |
| 5   | `tempest`       | Tempest       | Tube shooter        | Simple     | Media     | 3D simulado     |
| 6   | `qbert`         | Q*bert        | Acción/Puzzle       | Simple     | Media     | Isométrico      |
| 7   | `moon-patrol`   | Moon Patrol   | Side-scroll shooter | Simple     | Media     | Side-scroll 2D  |
| 8   | `gradius`       | Gradius       | Side-scroll shooter | Moderado   | Media     | Side-scroll 2D  |
| 9   | `double-dragon` | Double Dragon | Beat 'em up         | Moderado   | Media     | Side-scroll 2D  |
| 10  | `out-run`       | Out Run       | Racing              | Moderado   | Media     | Pseudo-3D       |
| 11  | `paperboy`      | Paperboy      | Action/Carreras     | Moderado   | Baja      | Side-scroll 2D  |
| 12  | `burger-time`   | BurgerTime    | Plataformas/Acción  | Moderado   | Baja      | Side-scroll 2D  |
| 13  | `puyo-puyo`     | Puyo Puyo     | Puzzle competitivo  | Moderado   | Baja      | Grid vertical   |

### Cobertura de géneros (antes → después)

| Género            | Antes (19 juegos)        | Después (+13)                   |
| ----------------- | ------------------------ | ------------------------------- |
| Paddle/Ball       | Pong, Breakout           | =                               |
| Snake/Grid        | Snake, Pac-Man           | =                               |
| Endless runner    | Dino Runner, Flappy Bird | =                               |
| Shooter (fixed)   | Space Invaders, Galaga   | +Tempest, +Q*bert               |
| Shooter (moving)  | Asteroids, Defender      | +Gradius, +Raiden, +Moon Patrol |
| Shoot 'em up grid | Centipede                | =                               |
| Puzzle            | Tetris                   | +Columns, +Puyo Puyo            |
| Maze/Chase        | =                        | +Bomberman                      |
| Beat 'em up       | =                        | +Double Dragon                  |
| Racing            | =                        | +Out Run, +Pole Position        |
| Platformer        | Donkey Kong              | +BurgerTime, +Paperboy          |
| Tower Defense     | Neon Nexus               | =                               |
| Battle Royale     | Cell Swarm               | =                               |
| Action/Strategy   | Dig Dug, Missile Command | =                               |
| Joust/Platformer  | Joust                    | =                               |

---

## 3. Fases de Implementación (orden: simples primero)

### Fase 1 — Fundamentos (4 juegos simples)

Los 4 más fáciles. Generan momentum rápido. Cubren 4 géneros nuevos.

| Juego             | Días | Género nuevo        | Template base             |
| ----------------- | ---- | ------------------- | ------------------------- |
| **Columns**       | 3-4  | Puzzle de colores   | `paddle-game-template.md` |
| **Pole Position** | 3-4  | Racing top-down     | Nuevo                     |
| **Moon Patrol**   | 2-3  | Side-scroll shooter | `simple-2d-engine.md`     |
| **Tempest**       | 3-4  | Tube shooter        | Nuevo                     |

**Criterios de completion:**

- Cada juego: 5 archivos + screenshot en `games/<id>/`
- Registrado en `games.js` con `status: 'listo'`
- 2-3 achievements funcionando
- 3 modos de entrada (teclado/táctil/gamepad)
- `npm run check` pasa
- `sw.js` FILES + STATIC_CACHE bump

**Música:** Moon Patrol + Tempest reciben temas procedurales (añadir sus entradas al objeto `SONGS` de `shared/music.js`).

**Criterios de calidad:**

- 60 FPS verificados (profile.js si disponible)
- HUD + overlay funcional
- Récord persistido en localStorage
- `role="img"` + `aria-label` en canvas
- reduced-motion soportado

---

### Fase 2 — Shooters & Maze (4 juegos)

Shooters clásicos + Bomberman (el más esperado).

| Juego         | Días | Género nuevo        | Template base         |
| ------------- | ---- | ------------------- | --------------------- |
| **Bomberman** | 4-5  | Laberinto/Acción    | `2d-maze-game.md`     |
| **Raiden**    | 4-5  | Vertical shooter    | `simple-2d-engine.md` |
| **Gradius**   | 4-5  | Side-scroll shooter | `simple-2d-engine.md` |
| **Q\*bert**   | 3-4  | Isométrico          | Nuevo                 |

**Criterios de completion:**

- Bomberman: grid 13×11, bombas con range, 4 power-ups, 2+ tipos de enemigos IA
- Raiden: power-up bar (twin/laser/missile/bomb), 7 stages, boss fights
- Gradius: power-up bar (speed/missile/double/option/shield), 7 stages
- Q*bert: cubos isométricos, jumping logic, color-changing, Coily AI

**Música:** Raiden + Gradius reciben temas procedurales (añadir su entrada al objeto `SONGS` de `shared/music.js` y verificarlo en `npm run verify`).

---

### Fase 3 — Action Clásicos (3 juegos)

Juegos con física y patrones de enemigos más complejos.

| Juego             | Días | Género nuevo        | Template base         |
| ----------------- | ---- | ------------------- | --------------------- |
| **Double Dragon** | 5-6  | Beat 'em up         | `2d-platform-game.md` |
| **BurgerTime**    | 3-4  | Plataformas/Cooking | `2d-platform-game.md` |
| **Paperboy**      | 3-4  | Side-scroll Action  | `simple-2d-engine.md` |

**Criterios de completion:**

- Double Dragon: 4 direcciones, jab/kick/combo, 3+ tipos de enemigos, boss fights
- BurgerTime: ingredientes con física, escaleras, 2+ tipos de enemigos
- Paperboy: 3 carriles, lanzamiento de periódico, obstáculos procedural

**Música:** Double Dragon recibe tema procedural (añadir su entrada al objeto `SONGS` de `shared/music.js`).

---

### Fase 4 — Racing Pseudo-3D + Puzzle vs CPU (2 juegos)

Los más visualmente desafiantes (road rendering) más un puzzle competitivo.

| Juego         | Días | Género nuevo     | Template base             |
| ------------- | ---- | ---------------- | ------------------------- |
| **Out Run**   | 5-6  | Racing pseudo-3D | Nuevo (road rendering)    |
| **Puyo Puyo** | 4-5  | Puzzle vs CPU    | `paddle-game-template.md` |

**Criterios de completion:**

- Out Run: road scrolling con perspectiva, 5 stages, branching paths, turbo drift
- Puyo Puyo: grid 6×12, chain detection, AI con evaluación, garbage system

**Música:** Out Run recibe tema procedural (prioridad alta — el juego es famoso por su música; añadir su entrada al objeto `SONGS` de `shared/music.js`).

**Nota técnica — Out Run pseudo-3D:**

- Road formada por segmentos con curvatura (dx por segmento)
- Cada segmento se proyecta con perspectiva: `scale = fov / z`, `screenX = worldX * scale + cx`
- Sprite scaling para árboles, posts, edificios
- 60 FPS: solo dibujar segmentos visibles (~50), skip si `y < horizon`

---

## 4. Especificación por Juego

### 4.1 Columns (Fase 1 — Prioridad ⭐)

**Mecánica core:**

- Grid 6×13, piezas de 3 gemas caen verticalmente
- Rotación: gemas rotan en ciclo (rojo→verde→azul→rojo...)
- Match: 3+ gemas iguales en línea (vertical, horizontal, diagonal) = clear
- Flash warning: gemas parpadean 0.5s antes de clear
- Nivel: velocidad +1 cada 25 gems cleared
- Game over: gemas llegan al tope

**Power-ups:**

- Flash gem: transforma gemas adyacentes en el mismo color
- Lightning: elimina toda una fila
- Poison: cambia color de gemas al azar

**Modo vs CPU (Fase 2):**

- CPU envía basura (gemas grises) después de cada clear
- Basura se convierte en gems normales tras 3 segundos
- Cadenas largas = más basura al rival

**Logros:**

- `chain_master`: Hacer cadena de 3+ clears en un solo move
- `color_collector`: Tener 6 colores en el grid simultáneamente
- `marathon`: Sobrevivir 50 niveles

**Touch controls:** Rotate (tap), Move left/right (swipe or buttons), Hard drop (swipe down)

---

### 4.2 Pole Position (Fase 1 — Prioridad ⭐)

**Mecánica core:**

- Top-down racing, vista cenital
- Calificación: completar vuelta en <35s para empezar en pole position
- 8 coches rivales con IA simple (follow road + avoid collisions)
- Vuelta limitada a 60s (se acaba = lose)
- Turbo: meter gas da boost temporal (se recarga lentamente)

**Circuitos:**

- 3 circuitos con diferente dificultad
- Curvas: derecha, izquierda, chicane
- Power-ups en pista: turbo (boost), invencibility (10s)

**Touch controls:** Left/right buttons, accelerate (hold), brake (tap)

**Logros:**

- `pole_position`: Qualificar en 1ra posición
- `clean_lap`: Completar vuelta sin chocar
- `champion`: Ganar carrera en los 3 circuitos

---

### 4.3 Moon Patrol (Fase 1)

**Mecánica core:**

- Side-scroll lunar, 3 carriles (arriba/medio/abajo)
- Disparo: horizontal (hacia la derecha) + techo (hacia arriba)
- Saltar cráteres, rocas
- Enemigos: rovers enemigos, mines, UFOs
- Power-ups: triple shot (3 direcciones), rapid fire
- Tiempo bonus: completar rápido = +puntos

**Touch controls:** Jump (tap up), Shoot forward (tap right), Shoot up (tap up-right), Switch lane (swipe)

**Logros:**

- `triple_kill`: Matar 3 enemigos con 1 triple shot
- `no_jump_clear`: Completar nivel sin saltar
- `speed_run`: Completar nivel en <45s

---

### 4.4 Tempest (Fase 1)

**Mecánica core:**

- Tube shooter: nave en el borde de un tubo (16 lados)
- Disparar hacia el centro del tubo
- Rotar alrededor del tubo (izq/der)
- Jump: salir del tubo y re-entrar en otra posición
- Enemigos suben por el tubo: fuseballs (invulnerables), spikers, pulsars

**Rendering:**

- Tubo dibujado como polígono con 16 vértices
- Perspectiva: vértices cercanos más grandes, lejanos más pequeños
- Nave = punto brillante en el borde activo

**Touch controls:** Rotate left/right, Shoot (tap center), Jump (swipe up)

**Logros:**

- `spin_master`: Rotar 360° sin perder vida
- `jump_pro`: Usar jump 10 veces en un nivel
- `survivor`: Sobrevivir 10 oleadas

---

### 4.5 Q*bert (Fase 1)

**Mecánica core:**

- Grid isométrico de cubos (pirámide 7×7 base)
- Saltar entre cubos (4 diagonales: arriba-izq, arriba-der, abajo-izq, abajo-der)
- Cambiar color del cubo al saltar
- Completar nivel = todos los cubos del mismo color

**Enemigos:**

- Coily: serpiente que persigue al jugador (aparece tras 10 saltos)
- Slick/Sam: cambian colores de cubos al pasar
- Ugg/Wrongway: saltan por debajo de la pirámide

**Power-ups:**

- Fontana: temporal, mata Coily al pasar por el tubo
- Turbo: velocidad x2 temporal

**Rendering isométrico:**

- Cada cubo = 3 faces (top, left, right) con colores diferentes
- Coordenadas del grid → pantalla: `sx = (gx - gy) * tileW/2 + offsetX`, `sy = (gx + gy) * tileH/4 + offsetY`
- Cubos superiores se dibujan después (z-ordering)

**Touch controls:** 4 botones diagonales (↗↘↙↖), Shoot (n/a), Jump (swipe)

**Logros:**

- `perfect_level`: Completar nivel sin que Coily cambie cubos
- `coily_catcher`: Activar fontana 3 veces
- `speed_cuber`: Completar nivel en <30s

---

### 4.6 Bomberman (Fase 2 — Prioridad ⭐)

**Mecánica core:**

- Grid 13×11, jugador se mueve libremente (4 direcciones)
- Poner bombas: 1 a la vez (upgradeable a 2-8)
- Bombas: detonan tras 2.5s, explosion en cruz (range 1-8)
- Bloques destructibles: destruidos por explosión, drop power-ups
- Bloques indestructibles: forman el laberinto

**Power-ups:**

- Bomb +1: bombas simultáneas +1
- Fire range +1: explosión +1 tile
- Speed +1: movimiento más rápido
- Power kick: patear bombas
- Detonator: detonar bombas manualmente
- Full fire: range máximo

**Enemigos IA:**

- Ballon: movimiento aleatorio (fácil)
- Oneal: persigue al jugador (medio)
- Dahl: zigzag + persigue (difícil)
- Minvo: persigue + salta bloques (difícil)

**Modo single player:** destruir todos los enemigos → puerta aparece → pasar al siguiente nivel

**Touch controls:** D-pad (4 direcciones), Bomb (botón acción)

**Logros:**

- `bomb_first_kill`: Primera kill con bomba
- `speed_demon`: Completar nivel sin ser tocado
- `power_collector`: Tener todos los power-ups simultáneamente

---

### 4.7 Raiden (Fase 2 — Prioridad ⭐)

**Mecánica core:**

- Vertical scrolling shooter
- Avión se mueve en 8 direcciones
- Disparo automático + bomb (destroy all on screen)

**Power-up bar (seleccionar con SPACE):**

- Twin cannon: 2 disparos paralelos
- Laser: disparo potente y rápido
- Proton beam: rayo continuo (daño alto, lento)
- Missile: misiles guiados
- Shield: protección 1 hit

**Enemigos:**

- Aviones (patrones de vuelo)
- Tanks (en ground)
- Buildings (destruibles)
- Bosses cada stage (patrones complejos)

**7 stages** con boss final

**Touch controls:** D-pad (8 direcciones), Bomb (botón)

**Logros:**

- `bomb_save`: Completar stage sin usar bomba
- `laser_master`: Matar 100 enemigos con laser
- `no_damage`: Completar stage sin daño

---

### 4.8 Gradius (Fase 2)

**Mecánica core:**

- Side-scroll shooter, nave se mueve en 8 direcciones
- Power-up bar (seleccionar con SPACE):

**Power-up bar:**

```
[Speed Up] → [Missile] → [Double] → [Option] → [Shield]
     ↑                                                  |
     └───────────── (cicla) ──────────────────────────────┘
```

- Speed Up: velocidad +1 (max 4)
- Missile: misiles hacia abajo
- Double: disparo doble (horizontal + diagonal)
- Option: drone que sigue la nave y dispara (max 2)
- Shield: protección 1 hit

**Enemigos:**

- Formaciones estáticas
- Diving enemies (bajan y disparan)
- Bosses con patrones (centro de pantalla)

**7 stages** con boss final

**Touch controls:** D-pad (8 direcciones), Power-up select (tap bar), Fire (botón)

**Logros:**

- `option_master`: Tener 2 Options activos
- `no_damage_clear`: Completar stage sin daño
- `speed_demon`: Speed Up al máximo

---

### 4.9 Double Dragon (Fase 3)

**Mecánica core:**

- Beat 'em up side-scroll, 4 direcciones
- Golpes:
  - Jab: A (daño bajo, rápido)
  - Kick: B (daño medio, lento)
  - Combo: A+A+A (3 hits, daño alto)
  - Jump kick: A+arriba (daño alto, arriesgado)
  - Special: A+B (megaton punch, 1 uso por vida)

**Enemigos:**

- Punk: patada básica (fácil)
- Thug: golpe + patada (medio)
- Soldier: patada voladora + golpe (difícil)
- Boss: combo largo + grapple

**Power-ups (drops):**

- Espada: +50% daño
- Bate: +daño, range
- Dinamita: explosion AOE
- Poción: +1 vida

**4 actos** con boss final cada uno

**Touch controls:** D-pad (4 direcciones), Punch (A), Kick (B), Special (A+B)

**Logros:**

- `combo_king`: 10 hits sin recibir daño
- `weapon_master`: 5 kills con misma arma
- `final_boss`: Derrotar al boss final

---

### 4.10 Out Run (Fase 4)

**Mecánica core:**

- Pseudo-3D: road con perspective scrolling
- 5 segmentos visibles, coche se mueve izq/der
- Turbo: meter gas da boost temporal
- 5 stages con branching (checkpoint → elegir izq/der)
- Power-ups: turbo, time extension
- Tiempo limitado: 75s por stage

**Road rendering (pseudo-3D):**

- Segmentos con curvatura (dx por segmento)
- Proyección: `scale = fov / z`, `screenX = worldX * scale + cx`
- Sprite scaling para árboles, posts, edificios
- Solo dibujar segmentos visibles (~50)

**Canciones:** 5 temas (una por stage), cambiando en branching

**Touch controls:** Left/Right (steer), Gas (hold), Brake (tap)

**Logros:**

- `perfect_run`: Completar sin chocar
- `branch_explorer`: Tomar ambos caminos
- `time_master`: Completar con >60s restantes

---

### 4.11 Paperboy (Fase 3)

**Mecánica core:**

- Side-scroll: bicicleta en 3 carriles
- Lanzar periódico a casas (izq/der)
- Esquivar: carros, vallas, perros, skaters, cement trucks
- Objetivo: entregar a casas suscritas = mantener subscribers
- Fail delivery = lose subscriber
- 7 días (niveles) con dificultad creciente

**Touch controls:** Move up/down (swipe or buttons), Throw left (tap left), Throw right (tap right)

**Logros:**

- `perfect_delivery`: Entregar a todas las casas
- `no_crash`: Completar nivel sin chocar
- `subscriber_king`: Todas las casas suscritas

---

### 4.12 BurgerTime (Fase 3)

**Mecánica core:**

- Plataformas con escaleras
- Caminar sobre ingredientes para hacerlas caer
- Orden: pan → lechuga → tomate → pan = burger completa
- Score: ingredientes aplastados = puntos
- 6 niveles con más ingredientes y enemigos

**Enemigos:**

- Mr. Hot Dog: persigue por plataformas
- Mr. Pickle: persigue por escaleras
- Mr. Egg: persigue + lanza huevos

**Power-ups:**

- Pepper: congela enemigos temporalmente
- Mr. Egg (bonus): aplasta enemigos cercanos

**Touch controls:** Left/Right (move), Up/Down (escaleras), Pepper (botón)

**Logros:**

- `stack_master`: Completar burger sin mover ingredientes extra
- `pepper_master`: Congelar 3 enemigos con 1 pepper
- `speed_cook`: Completar nivel en <60s

---

### 4.13 Puyo Puyo (Fase 4)

**Mecánica core:**

- Grid 6×12, puyos de 4 colores caen en pares
- Rotar, mover, hard drop
- Match 4+ iguales = pop (encadenar = combo)
- Combos envían basura al rival (CPU o futuro 2P)

**Garbage system:**

- Basura = bloques grises que caen después de 2 segundos
- Cantidad de basura depende del chain size
- Counter: muestra basura pendiente

**AI (CPU rival):**

- Evalúa cada movimiento posible
- Prioriza chains largas
- Dificultad ajustable (3 niveles)

**Touch controls:** Rotate (tap), Move left/right (buttons), Hard drop (swipe down)

**Logros:**

- `chain_master`: Hacer cadena de 4+ pops
- `gtr_builder`: Hacer GTR pattern
- `cpu_destroyer`: Ganar al CPU en nivel difícil

---

## 5. Requisitos Compartidos (todos los 13 juegos)

### Imports mínimos (script.js)

```js
import { showHelp } from '../../shared/help.js';
import { ensureAudio, beep, startAmbient, stopAmbient, closeAudio } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements } from '../../shared/dom.js';
import { setupCanvas } from '../../shared/display.js';
import { createGameLoop } from '../../shared/loop.js';
import { createGamepad } from '../../shared/input.js';
import { feedbackBundle, triggerShake, spawnParticles, drawGlow } from '../../shared/effects.js';
import { startMusic, stopMusic } from '../../shared/music.js'; // solo si aplica
```

### Estructura de archivos

```
games/<id>/
├── index.html      # Canvas + HUD + overlay + touch controls
├── style.css       # Solo --accent + elementos únicos
├── script.js       # Lógica, imports desde ../../shared/
├── metadata.json   # v1.0.0, changelog, fechas
├── README.md       # Template completo
└── screenshot.png  # 1024×768 gameplay capture
```

### Performance

- Object pooling para projectiles, enemigos, partículas
- `drawGlow()` en vez de `shadowBlur` en loops
- Anti-tunneling para proyectiles rápidos
- `createGameLoop()` con dt + RAF
- `getContext('2d', { alpha: false })`
- 60 FPS en todos los juegos

### Accesibilidad

- Canvas con `role="img"` + `aria-label`
- `@media (prefers-reduced-motion)` + `setShakeScale(0)`
- Viewport sin `user-scalable=no`
- Touch targets ≥ 44×40px
- `aria-live` para anuncios

### Music assignment

| Juego         | Música | Ambient      |
| ------------- | ------ | ------------ |
| Columns       | ❌     | ✅           |
| Pole Position | ✅     | ✅           |
| Moon Patrol   | ✅     | ✅           |
| Tempest       | ✅     | ✅           |
| Q*bert        | ❌     | ✅           |
| Bomberman     | ✅     | ✅           |
| Raiden        | ✅     | ✅           |
| Gradius       | ✅     | ✅           |
| Double Dragon | ✅     | ✅           |
| Out Run       | ✅     | ✅ (5 temas) |
| Paperboy      | ❌     | ✅           |
| BurgerTime    | ❌     | ✅           |
| Puyo Puyo     | ❌     | ✅           |

### Integración con hub, música y gamepad

- **Música (`shared/music.js`):** cada juego con música ✅ según la tabla debe añadir su **entrada al objeto `SONGS`** con un tema procedural concreto. Un `startMusic('<id>')` sin entrada en `SONGS` no suena (regresiona en silencio). Verificar que `npm run verify` no detecte un id sin tema al integrar el juego.
- **Miniatura del hub:** añadir una **escena canvas** en `asset/hub-cards.js` (patrón `'<id>'(ctx)` con helpers `backdrop/rect/disc/poly`) **o** un SVG de respaldo por id en la tarjeta. Sin escena ni SVG, la tarjeta del hub queda sin thumbnail.
- **Gamepad:** definir el mapa de botones por juego (p. ej. Bomberman: D-pad + botón "bomb"; Raiden/Gradius: D-pad 8 dir + botón "fire" + "power-select") usando `createGamepad` con `prevGamepad` para flancos, igual que los juegos actuales.

---

## 6. Checklist de Validación por Juego

- [ ] `npm run lint` — 0 errores, 0 warnings
- [ ] `npm run format` — Prettier OK
- [ ] `npm run verify` — consistente
- [ ] `npm test` — smoke test pasa
- [ ] 5 archivos en `games/<id>/`
- [ ] Entrada en `games.js` con `status: 'listo'`
- [ ] `sw.js` FILES actualizado
- [ ] `STATIC_CACHE` bumpado
- [ ] `metadata.json` v1.0.0 + changelog
- [ ] `README.md` template completo
- [ ] 3 modos de entrada probados
- [ ] 2-3 achievements funcionando
- [ ] HUD + overlay funcionando
- [ ] Récord persistido en localStorage
- [ ] Canvas con `role="img"` + `aria-label`
- [ ] reduced-motion soportado
- [ ] 60 FPS verificado
- [ ] Mapa de gamepad definido (si aplica) y probado
- [ ] Entrada en `SONGS` de `shared/music.js` si el juego lleva música (y `npm run verify` OK)
- [ ] Miniatura del hub disponible (escena canvas en `hub-cards.js` o SVG de respaldo)

---

## 7. Timeline Estimada

| Fase      | Juegos                                       | Días           | Acumulado |
| --------- | -------------------------------------------- | -------------- | --------- |
| **1**     | Columns, Pole Position, Moon Patrol, Tempest | 11-15          | 11-15     |
| **2**     | Bomberman, Raiden, Gradius, Q*bert           | 14-18          | 25-33     |
| **3**     | Double Dragon, BurgerTime, Paperboy          | 11-14          | 36-47     |
| **4**     | Out Run, Puyo Puyo                           | 9-11           | 45-58     |
| **Total** | **13 juegos**                                | **45-58 días** | —         |

**Nota:** Estimación para 1 desarrollador dedicado. Con 2 desarrolladores, se puede reducir ~40%.

---

## 8. Riesgos y Mitigaciones

| Riesgo                                      | Impacto | Probabilidad | Mitigación                                                 |
| ------------------------------------------- | ------- | ------------ | ---------------------------------------------------------- |
| Out Run pseudo-3D es lento                  | Alto    | Media        | Optimizar: segment counting, skip invisible, pre-calculate |
| Q*bert isométrico confuso en táctil         | Medio   | Alta         | Touch controls con flechas diagonales claras               |
| Bomberman AI muy compleja                   | Medio   | Baja         | Empezar con AI simple (random walk), iterar                |
| Double Dragon combos difíciles de balancear | Medio   | Media        | Testear con usuarios, ajustar hitboxes                     |
| 13 juegos = mucho código nuevo              | Alto    | Alta         | Reutilizar patterns, emparejar por tipo                    |

---

_Spec revisado v3 — 2026-08-28. Pendiente de aprobación antes de iniciar Fase 1._
