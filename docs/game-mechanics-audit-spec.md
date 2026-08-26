# Game Mechanics Audit — Arcade Hub

> Auditoría de mecánicas de los 19 juegos contra sus originales arcade.
> Fecha: 2026-08-24 | Estado: **Decisiones aprobadas por el usuario**

---

## Resumen de decisiones por juego

| Juego           | Cambios aprobados                                                                |
| --------------- | -------------------------------------------------------------------------------- |
| Pong            | Mantener score 7, Agregar modo 2P local, Hacer IA más humana                     |
| Breakout        | Agregar anti-stuck, Layout 8×14 original, Mantener 1 bola + 3 vidas              |
| Snake           | Clásico puro (sin cambios)                                                       |
| Asteroids       | Agregar Hiperspacio, Mantener invulnerabilidad al respawn                        |
| Space Invaders  | 1 bala a la vez, Puntos misteriosos variables (50-300)                           |
| Flappy Bird     | Sin cambios                                                                      |
| Pac-Man         | Scatter/chase cycles + Frutas bonus + Animación muerte                           |
| Tetris          | Agregar Hold piece + Rotación SRS                                                |
| Frogger         | Agregar timer 60s + Tortugas que se sumergen                                     |
| Galaga          | Agregar tractor beam (atrapón)                                                   |
| Centipede       | Restringir jugador al tercio inferior + Ciempiés se divide al destruir segmentos |
| Dig Dug         | Enemigos sin phase-through + Física de rocas más fiel                            |
| Missile Command | Quitar misiles teledirigidos y satélites (solo misiles normales)                 |
| Donkey Kong     | Agregar las 4 fases originales (barriles, fuego, elevador, piezas móviles)       |
| Defender        | Agregar hyperspace + bomba nuclear (4 armas originales)                          |
| Joust           | Agregar vultures + pterodactyls + lava subiendo                                  |
| Neon Nexus      | Sin cambios (juego original)                                                     |
| Cell Swarm      | Sin cambios (juego original)                                                     |
| Dino Runner     | Sin cambios (juego original)                                                     |

---

## Detalle por juego

### 1. PONG

**Original:** Atari Pong (1972)

**Hallazgos:**

- Score para ganar = 7 (original usaba 21, luego 11)
- Solo 1 jugador vs IA (original era 2P exclusivo)
- IA demasiado perfecta, sin errores humanos

**Decisiones:**

- ✅ **Mantener score 7** — Más casual, ideal para web
- ✅ **Agregar modo 2 PvP local** — Teclado dividido o turnos
- ✅ **Hacer IA más humana** — Retrasos ocasionales, ángulos imperfectos, que a veces pierda bola

**Implementación sugerida:**

- Modo 2P: Dividir teclado (W/S vs ↑/↓) o turnos con indicador visual
- IA: Agregar `aiReactionDelay` (0.05-0.2s random), `aiAimError` (offset angular ±5°), `aiSpeedVariation` (±15%)
- Mantener las mejoras existentes (partículas, squash, audio)

---

### 2. BREAKOUT

**Original:** Atari Breakout (1976)

**Hallazgos:**

- Layout 5×9 vs original 8×14
- Sin detección de pelota atascada
- 1 bola + 3 vidas (original tenía 3 bolas)

**Decisiones:**

- ✅ **Agregar anti-stuck** — Timer que fuerza rebote hacia arriba si la pelota no golpea ladrillos en 5s
- ✅ **Layout 8×14 original** — Más filas y columnas para dificultad progresiva
- ✅ **Mantener 1 bola + 3 vidas** — Más moderno y menos frustrante

**Implementación sugerida:**

- Agregar `ballStuckTimer` en game loop, resetear al golpear ladrillo/paleta
- Rediseñar `buildBricks()` con 8 filas × 14 columnas
- Ajustar `BRICK_W` y `BRICK_GAP` para el nuevo layout

---

### 3. SNAKE

**Original:** Nokia Snake (1997)

**Hallazgos:**

- Muros = muerte (correcto, como el Nokia clásico)
- Velocidad progresiva (correcto)
- Sin power-ups

**Decisiones:**

- ✅ **Clásico puro** — Sin cambios, fiel al Nokia

---

### 4. ASTEROIDS

**Original:** Atari Asteroids (1979)

**Hallazgos:**

- Falta Hiperspacio (teletransporte aleatorio)
- Invulnerabilidad 2s al respawnear (original no tenía)
- 4 asteroides iniciales, puntos 20/50/100 (correctos)

**Decisiones:**

- ✅ **Agregar Hiperspacio** — Botón que teletransporta a posición aleatoria
- ✅ **Mantener invulnerabilidad** — QoL válida para web

**Implementación sugerida:**

- Nuevo input: `KeyH` o botón táctil
- `hyperspace()` → `ship.x = random(0, COURT_W)`, `ship.y = random(0, COURT_H)`
- Cooldown de 3s, consumir 1 vida si se usa en peligro (o simplemente teleportear)
- Mantener `state.invincibleTimer` tras respawn

---

### 5. SPACE INVADERS

**Original:** Taito Space Invaders (1978)

**Hallazgos:**

- Jugador dispara 2 balas simultáneas (original: 1)
- Misil misterioso da 100 pts fijos (original: 50-300 variable)
- 5×11 invasores, shields, mystery ship (correctos)

**Decisiones:**

- ✅ **1 bala a la vez** — Más fiel, mayor strategia
- ✅ **Puntos misteriosos variables** — 50, 100, 150, 200, 250, 300 random

**Implementación sugerida:**

- Limitar `plyBullets.length <= 1` antes de disparar
- En `mysteryShip` hit: `score += [50,100,150,200,250,300][Math.floor(Math.random()*6)]`
- Actualizar sonido de mystery ship según puntos

---

### 6. FLAPPY BIRD

**Original:** .GEARS Flappy Bird (2013)

**Hallazgos:**

- Sin errores mecánicos significativos
- Física correcta (gravedad, flap, tubos)

**Decisiones:**

- ✅ **Sin cambios**

---

### 7. PAC-MAN

**Original:** Namco Pac-Man (1980)

**Hallazgos:**

- Laberinto custom (no el original)
- Sin ciclos scatter/chase de fantasmas
- Sin frutas bonus
- Sin animación de muerte de Pac-Man

**Decisiones:**

- ✅ **Scatter/chase cycles** — Fantasmas alternan entre perseguir (chase) e ir a esquinas (scatter)
- ✅ **Frutas bonus** — Fresas, naranjas, etc. aparecen en el laberinto
- ✅ **Animación muerte** — Pac-Man se contrae/desaparece al morir

**Implementación sugerida:**

- Timer de ciclo: 7s chase → 20s scatter → 7s chase → 20s scatter → 5s chase → 5s scatter → 5s chase → ∞ chase
- Frutas: Spawnear en posición fija (centro del laberinto) tras comer 70 y 170 puntos
- Animación muerte: Loop de frames que contrae la boca de Pac-Man hasta desaparecer

---

### 8. TETRIS

**Original:** Electronorgtechnica Tetris (1984)

**Hallazgos:**

- Sin Hold piece
- Rotación simplificada (no SRS)
- Scoring, niveles, ghost piece: correctos

**Decisiones:**

- ✅ **Hold piece** — Tecla para guardar pieza y usarla después
- ✅ **Rotación SRS** — Sistema de rotación oficial del Tetris Guideline

**Implementación sugerida:**

- Nuevo input: `KeyC` o botón táctil para hold
- `holdPiece()` → intercambiar pieza actual con hold
- SRS: Implementar tabla de wall kicks para cada pieza (I, O, T, S, Z, J, L)
- Mantener DAS y lock delay existentes

---

### 9. FROGGER

**Original:** Konami Frogger (1981)

**Hallazgos:**

- Sin timer (original: 60s por vida)
- Sin tortugas que se sumergen
- Log carrying correcto, 5 zonas seguras correctas

**Decisiones:**

- ✅ **Timer 60s** — Presión de tiempo por vida
- ✅ **Tortugas que se sumergen** — En filas de río, algunas tortugas se hunden temporalmente

**Implementación sugerida:**

- `frogTimer = 60` al respawnear, decrementar en game loop
- Si `frogTimer <= 0` → `loseLife()`
- En filas de río: agregar tortugas como obstáculos que se sumergen cada 3-5s (ciclo visible)
- HUD: mostrar timer restante

---

### 10. GALAGA

**Original:** Namco Galaga (1981)

**Hallazgos:**

- Sin tractor beam (atrapón)
- Sin animación warp-in de enemigos
- Formación, picados, shooting: correctos

**Decisiones:**

- ✅ **Tractor beam** — Mecánica icónica donde un enemigo captura la nave del jugador

**Implementación sugerida:**

- En oleadas pares: 1 enemigo desciende con "beam" visual
- Si el jugador no lo destruye a tiempo → nave capturada (se vuelve enemigo)
- Al destruir al captor → nave recuperada (doble disparo temporal)
- Animación del beam: rectángulo semitransparente que se expande/contrae

---

### 11. CENTIPEDE

**Original:** Atari Centipede (1981)

**Hallazgos:**

- Jugador se mueve por toda la pantalla (original: tercio inferior)
- Al destruir segmento, solo se elimina (original: genera ciempiés nuevo)
- Spider, flea, scorpion: presentes y correctos

**Decisiones:**

- ✅ **Restringir movimiento** — Jugador limitado al tercio inferior
- ✅ **Splitting del ciempiés** — Al destruir un segmento, los restantes se convierten en ciempiés independientes

**Implementación sugerida:**

- `PLAYER_TOP_RATIO = 0.55` → ajustar a `0.66` (tercio inferior)
- En `updateBullets`: al destruir segmento `i`, crear nuevo segmento head en `segments[i+1]` si existe
- El nuevo ciempiés hereda dirección del segmento destruido

---

### 12. DIG DUG

**Original:** Namco Dig Dug (1982)

**Hallazgos:**

- Enemigos atraviesan tierra (phase through) — original no
- Física de rocas cayendo simplificada
- Pump mechanic correcto

**Decisiones:**

- ✅ **Sin phase-through** — Enemigos caminan por túneles (no atraviesan tierra)
- ✅ **Física de rocas más fiel** — Ro caen gradualmente, pueden aplastar enemigos y jugador

**Implementación sugerida:**

- En `updateEnemies`: eliminar `Math.random() < 0.3` que permite phase-through
- Enemigos solo pueden moverse a celdas `T.EMPTY`
- Rocas: gradientes de velocidad (aceleración gravitacional), colisión más precisa

---

### 13. MISSILE COMMAND

**Original:** Atari Missile Command (1980)

**Hallazgos:**

- 6 ciudades (original: 3)
- Misiles teledirigidos y satélites (no existían en el original)

**Decisiones:**

- ✅ **Quitar teledirigidos y satélites** — Solo misiles normales
- ⚠️ **6 ciudades se mantienen** — El usuario no pidió reducir a 3

**Implementación sugerida:**

- Eliminar `smartMissiles[]`, `satellites[]`, `guidedMissile`
- Eliminar `fireGuided()`, `spawnSmartMissile()`, `spawnSatellite()`
- Eliminar `state.guidedKills`, `state.guidedCharge`
- Simplificar lógica de oleadas: solo `missiles[]`

---

### 14. DONKEY KONG

**Original:** Nintendo Donkey Kong (1981)

**Hallazgos:**

- Solo 1 fase (barriles) repetitiva
- Original tenía 4 fases

**Decisiones:**

- ✅ **Agregar las 4 fases originales:**
  1. **Fase 1 — Barriles** (actual): DK lanza barriles, Mario escala
  2. **Fase 2 — Fuego**: Fireballs persiguen a Mario en plataformas
  3. **Fase 3 — Elevador**: Plataformas móviles, Mario debe saltar entre ellas
  4. **Fase 4 — Piezas**: Piezas del andamio que Mario debe completar

**Implementación sugerida:**

- Crear `Phases` enum: `BARRELS`, `FIRE`, `ELEVATOR`, `CONSTRUCTION`
- Cada fase con su propia lógica de spawning y movimiento
- Transición animada entre fases
- DK aparece en la cima en todas las fases

---

### 15. DEFENDER

**Original:** Williams Defender (1981)

**Hallazgos:**

- Solo 2 armas (laser + smart bomb)
- Original tenía 4: laser, nuclear bomb, hyperspace, smart bomb
- Mutantes presentes al perder humanos (correcto)

**Decisiones:**

- ✅ **Agregar hyperspace** — Teletransporte a posición aleatoria
- ✅ **Agregar bomba nuclear** — Destruye todos los enemigos en pantalla (1 uso por vida)

**Implementación sugerida:**

- Hyperspace: `KeyH` → `player.x = random(WORLD_W)`, cooldown 5s
- Nuclear: `KeyN` → destruir todos los enemigos, 1 uso por vida
- UI: Mostrar usos restantes de nuclear en HUD
- Ambos consumibles: se regeneran al perder vida

---

### 16. JOUST

**Original:** Williams Joust (1982)

**Hallazgos:**

- Sin vultures (enemigos sin jinete)
- Sin pterodactyls
- Sin lava que sube

**Decisiones:**

- ✅ **Agregar vultures** — Enemigos que vuelan sin jinete, más rápidos
- ✅ **Agregar pterodactyls** — Aparecen en oleadas altas, vuelan recto y rápido
- ✅ **Agregar lava subiendo** — Lava visual que sube gradualmente, tocarla = muerte

**Implementación sugerida:**

- Vultures: enemigos rápidos sin平台, se mueven en patrones erráticos
- Pterodactyls: spawnear a partir de oleada 5, vuelan horizontal a alta velocidad
- Lava: `lavaY` que sube 1px/frame, colisión con jugador = loseLife
- Lava puede empujar huevos y enemigos hacia arriba

---

## Juegos sin cambios

### Neon Nexus

- Juego original (tower defense roguelike)
- Sin comparación con arcade clásico
- **Sin cambios**

### Cell Swarm

- Juego original (battle royale de células, estilo Agar.io)
- Sin comparación con arcade clásico
- **Sin cambios**

### Dino Runner

- Juego original (inspirado en Chrome Dino)
- Sin comparación con arcade clásico
- **Sin cambios**

---

## Prioridad de implementación sugerida

### Alta prioridad (mecánicas icónicas faltantes)

1. **Pac-Man** — Scatter/chase + frutas + animación muerte
2. **Tetris** — Hold piece + SRS
3. **Donkey Kong** — 4 fases
4. **Galaga** — Tractor beam

### Media prioridad (correcciones de fidelidad)

5. **Space Invaders** — 1 bala + puntos variables
6. **Centipede** — Restricción de movimiento + splitting
7. **Frogger** — Timer + tortugas
8. **Defender** — Hyperspace + nuclear
9. **Joust** — Vultures + pteros + lava

### Baja prioridad (mejoras QoL)

10. **Pong** — Modo 2P + IA humana
11. **Breakout** — Anti-stuck + layout 8×14
12. **Asteroids** — Hiperspacio
13. **Dig Dug** — Sin phase-through + rocas
14. **Missile Command** — Quitar teledirigidos/satélites

---

## Notas de implementación

- Todos los cambios deben mantener el **estilo visual neon/CRT** existente
- Usar las funciones de `shared/effects.js` (fillWithGlow, strokeWithGlow, etc.)
- Mantener **input parity**: keyboard + touch + gamepad
- Actualizar `shared/help.js` con nuevas teclas/controles
- Actualizar `metadata.json` version de cada juego modificado
- Ejecutar `npm run check` después de cada cambio
- Commits con prefijo `fix(games):` o `feat(games):` según corresponda
