# Game Mechanics Audit — Arcade Hub

> Auditoría de mecánicas de los 19 juegos contra sus originales arcade.
> Fecha: 2026-08-24 | Última actualización: 2026-08-26
> Estado: **9/19 completados, 1 en progreso, 4 pendientes**

---

## Estado de implementación

| #   | Juego           | Estado             | Commit      |
| --- | --------------- | ------------------ | ----------- |
| 1   | Pong            | ❌ **Pendiente**   | —           |
| 2   | Breakout        | ❌ **Pendiente**   | —           |
| 3   | Snake           | ⏭️ Sin cambios     | —           |
| 4   | Asteroids       | ❌ **Pendiente**   | —           |
| 5   | Space Invaders  | ✅ **Completado**  | `a834abd`   |
| 6   | Flappy Bird     | ⏭️ Sin cambios     | —           |
| 7   | Pac-Man         | ✅ **Completado**  | `76ec543`   |
| 8   | Tetris          | ✅ **Completado**  | `55ec803`   |
| 9   | Frogger         | ✅ **Completado**  | `71753a1`   |
| 10  | Galaga          | ✅ **Completado**  | `67bf7be`   |
| 11  | Centipede       | ✅ **Completado**  | `304075d`   |
| 12  | Dig Dug         | ✅ **Completado**  | `14e8184`   |
| 13  | Missile Command | ✅ **Completado**  | `7042fab`   |
| 14  | Donkey Kong     | ❌ **Pendiente**   | —           |
| 15  | Defender        | ✅ **Completado**  | `f5570a5`   |
| 16  | Joust           | 🔧 **En progreso** | otro agente |
| 17  | Neon Nexus      | ⏭️ Sin cambios     | —           |
| 18  | Cell Swarm      | ⏭️ Sin cambios     | —           |
| 19  | Dino Runner     | ⏭️ Sin cambios     | —           |

---

## Detalle por juego

### 1. PONG — ❌ Pendiente

**Original:** Atari Pong (1972)

**Hallazgos:**

- Score para ganar = 7 (original usaba 21, luego 11)
- Solo 1 jugador vs IA (original era 2P exclusivo)
- IA demasiado perfecta, sin errores humanos

**Decisiones:**

- ✅ **Mantener score 7** — Más casual, ideal para web
- ✅ **Agregar modo 2 PvP local** — Teclado dividido o turnos
- ✅ **Hacer IA más humana** — Retrasos ocasionales, ángulos imperfectos, que a veces pierda bola

**Estado de implementación:**

- ❌ Modo 2P: No existe segundo jugador, paddle, score, ni input separado
- ❌ IA humana: Sin `aiReactionDelay`, `aiAimError`, ni `aiSpeedVariation`

**Implementación sugerida:**

- Modo 2P: Dividir teclado (W/S vs ↑/↓) o turnos con indicador visual
- IA: Agregar `aiReactionDelay` (0.05-0.2s random), `aiAimError` (offset angular ±5°), `aiSpeedVariation` (±15%)
- Mantener las mejoras existentes (partículas, squash, audio)

---

### 2. BREAKOUT — ❌ Pendiente

**Original:** Atari Breakout (1976)

**Hallazgos:**

- Layout 5×9 vs original 8×14
- Sin detección de pelota atascada
- 1 bola + 3 vidas (original tenía 3 bolas)

**Decisiones:**

- ✅ **Agregar anti-stuck** — Timer que fuerza rebote hacia arriba si la pelota no golpea ladrillos en 5s
- ✅ **Layout 8×14 original** — Más filas y columnas para dificultad progresiva
- ✅ **Mantener 1 bola + 3 vidas** — Más moderno y menos frustrante

**Estado de implementación:**

- ❌ Anti-stuck: Sin `ballStuckTimer`, sin reset al golpear ladrillo/paleta, sin force-up
- ❌ Layout 8×14: Actualmente 5×9 (`BRICK_ROWS=5`, `BRICK_COLS=9`), arrays de colores/puntos con 5 entradas

**Implementación sugerida:**

- Agregar `ballStuckTimer` en game loop, resetear al golpear ladrillo/paleta
- Rediseñar `buildBricks()` con 8 filas × 14 columnas
- Ajustar `BRICK_W` y `BRICK_GAP` para el nuevo layout

---

### 3. SNAKE — ⏭️ Sin cambios

**Original:** Nokia Snake (1997)

- ✅ **Clásico puro** — Sin cambios, fiel al Nokia

---

### 4. ASTEROIDS — ❌ Pendiente

**Original:** Atari Asteroids (1979)

**Hallazgos:**

- Falta Hiperspacio (teletransporte aleatorio)
- Invulnerabilidad 2s al respawnear (original no tenía)
- 4 asteroides iniciales, puntos 20/50/100 (correctos)

**Decisiones:**

- ✅ **Agregar Hiperspacio** — Botón que teletransporta a posición aleatoria
- ✅ **Mantener invulnerabilidad** — QoL válida para web

**Estado de implementación:**

- ❌ Hiperspacio: Sin función `hyperspace()`, sin `KeyH`, sin cooldown, sin touch/gamepad binding
- ✅ Invulnerabilidad: Implementada (`INVINCIBLE_TIME = 2.0`, blinking visual)

**Implementación sugerida:**

- Nuevo input: `KeyH` o botón táctil
- `hyperspace()` → `ship.x = random(0, COURT_W)`, `ship.y = random(0, COURT_H)`
- Cooldown de 3s, consumir 1 vida si se usa en peligro (o simplemente teleportear)
- Mantener `state.invincibleTimer` tras respawn

---

### 5. SPACE INVADERS — ✅ Completado

**Original:** Taito Space Invaders (1978)

**Commit:** `a834abd` · **Versión:** 1.7.0

**Hallazgos:**

- Jugador dispara 2 balas simultáneas (original: 1)
- Misil misterioso da 100 pts fijos (original: 50-300 variable)
- 5×11 invasores, shields, mystery ship (correctos)

**Decisiones:**

- ✅ **1 bala a la vez** — Más fiel, mayor strategia
- ✅ **Puntos misteriosos variables** — 50, 100, 150, 200, 250, 300 random

**Implementado:**

- ✅ `plyBullets.length === 0` como guard — un solo proyectil en pantalla
- ✅ `MYSTERY_POINTS = [50,100,150,200,250,300]` + anuncio de puntos

---

### 6. FLAPPY BIRD — ⏭️ Sin cambios

**Original:** .GEARS Flappy Bird (2013)

- ✅ **Sin cambios** — Sin errores mecánicos significativos

---

### 7. PAC-MAN — ✅ Completado

**Original:** Namco Pac-Man (1980)

**Commit:** `76ec543` · **Versión:** 1.7.0

**Hallazgos:**

- Laberinto custom (no el original)
- Sin ciclos scatter/chase de fantasmas
- Sin frutas bonus
- Sin animación de muerte de Pac-Man

**Decisiones:**

- ✅ **Scatter/chase cycles** — Fantasmas alternan entre perseguir (chase) e ir a esquinas (scatter)
- ✅ **Frutas bonus** — Fresas, naranjas, etc. aparecen en el laberinto
- ✅ **Animación muerte** — Pac-Man se contrae/desaparece al morir

**Implementado:**

- ✅ Timer de ciclo: 7s chase → 20s scatter → etc.
- ✅ Frutas en posición fija tras comer puntos
- ✅ Animación muerte con frames de contração

---

### 8. TETRIS — ✅ Completado

**Original:** Electronorgtechnica Tetris (1984)

**Commit:** `55ec803` · **Versión:** 1.7.0

**Hallazgos:**

- Sin Hold piece
- Rotación simplificada (no SRS)
- Scoring, niveles, ghost piece: correctos

**Decisiones:**

- ✅ **Hold piece** — Tecla para guardar pieza y usarla después
- ✅ **Rotación SRS** — Sistema de rotación oficial del Tetris Guideline

**Implementado:**

- ✅ Hold piece con `KeyC`
- ✅ SRS con tabla de wall kicks para I, O, T, S, Z, J, L

---

### 9. FROGGER — ✅ Completado

**Original:** Konami Frogger (1981)

**Commit:** `71753a1` · **Versión:** 1.6.0

**Hallazgos:**

- Sin timer (original: 60s por vida)
- Sin tortugas que se sumergen
- Log carrying correcto, 5 zonas seguras correctas

**Decisiones:**

- ✅ **Timer 60s** — Presión de tiempo por vida
- ✅ **Tortugas que se sumergen** — En filas de río, algunas tortugas se hunden temporalmente

**Implementado:**

- ✅ `frogTimer = 60` al respawnear, HUD muestra tiempo
- ✅ Tortugas con ciclo de sumergimiento visible

---

### 10. GALAGA — ✅ Completado

**Original:** Namco Galaga (1981)

**Commit:** `67bf7be` · **Versión:** 1.7.0

**Hallazgos:**

- Sin tractor beam (atrapón)
- Sin animación warp-in de enemigos
- Formación, picados, shooting: correctos

**Decisiones:**

- ✅ **Tractor beam** — Mecánica icónica donde un enemigo captura la nave del jugador

**Implementado:**

- ✅ Tractor beam en oleadas pares
- ✅ Captura → nave enemiga → destruir captor → recuperar (doble disparo)
- ✅ Animación del beam

---

### 11. CENTIPEDE — ✅ Completado

**Original:** Atari Centipede (1981)

**Commit:** `304075d` · **Versión:** 1.6.0

**Hallazgos:**

- Jugador se mueve por toda la pantalla (original: tercio inferior)
- Al destruir segmento, solo se elimina (original: genera ciempiés nuevo)
- Spider, flea, scorpion: presentes y correctos

**Decisiones:**

- ✅ **Restringir movimiento** — Jugador limitado al tercio inferior
- ✅ **Splitting del ciempiés** — Al destruir un segmento, los restantes se convierten en ciempiés independientes

**Implementado:**

- ✅ `PLAYER_TOP_RATIO` ajustado a ~0.66 (tercio inferior)
- ✅ Splitting real: segmento destruido genera nuevo ciempiés cabeza

---

### 12. DIG DUG — ✅ Completado

**Original:** Namco Dig Dug (1982)

**Commit:** `14e8184` · **Versión:** 1.6.0

**Hallazgos:**

- Enemigos atraviesan tierra (phase through) — original no
- Física de rocas cayendo simplificada
- Pump mechanic correcto

**Decisiones:**

- ✅ **Sin phase-through** — Enemigos caminan por túneles (no atraviesan tierra)
- ✅ **Física de rocas más fiel** — Rocas caen gradualmente, pueden aplastar enemigos y jugador

**Implementado:**

- ✅ `isEmpty()` como único gate de movimiento — sin `Math.random() < 0.3` para dirt
- ✅ `fallingRocks[]` array — múltiples rocas cayendo simultáneamente

---

### 13. MISSILE COMMAND — ✅ Completado

**Original:** Atari Missile Command (1980)

**Commit:** `7042fab` · **Versión:** 1.6.0

**Hallazgos:**

- 6 ciudades (original: 3)
- Misiles teledirigidos y satélites (no existían en el original)

**Decisiones:**

- ✅ **Quitar teledirigidos y satélites** — Solo misiles normales
- ⚠️ **6 ciudades se mantienen** — El usuario no pidió reducir a 3

**Implementado:**

- ✅ Eliminados: `smartMissiles[]`, `satellites[]`, `guidedMissile`, `fireGuided()`, `spawnSmartMissile()`, `spawnSatellite()`, `state.guidedKills`, `state.guidedCharge`
- ✅ Solo queda `missiles[]` (amenaza normal)
- ✅ Badge guiado removido del HTML

---

### 14. DONKEY KONG — ❌ Pendiente

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

**Estado de implementación:**

- ✅ Fase 1 (barriles): Implementada — DK lanza barriles, colisión, física
- ❌ Fase 2 (fuego): Sin `fireballs[]`, sin AI de persecución
- ❌ Fase 3 (elevador): Plataformas todas estáticas (`PLATFORMS` const), sin movimiento
- ❌ Fase 4 (construcción): Sin piezas de andamio, sin mecánica de completar
- ❌ Sin enum de fases, sin transiciones animadas, sin level cycling

**Implementación sugerida:**

- Crear `Phases` enum: `BARRELS`, `FIRE`, `ELEVATOR`, `CONSTRUCTION`
- Cada fase con su propia lógica de spawning y movimiento
- Transición animada entre fases
- DK aparece en la cima en todas las fases

---

### 15. DEFENDER — ✅ Completado

**Original:** Williams Defender (1981)

**Commit:** `f5570a5` · **Versión:** 1.5.0

**Hallazgos:**

- Solo 2 armas (laser + smart bomb)
- Original tenía 4: laser, nuclear bomb, hyperspace, smart bomb
- Mutantes presentes al perder humanos (correcto)

**Decisiones:**

- ✅ **Agregar hyperspace** — Teletransporte a posición aleatoria
- ✅ **Agregar bomba nuclear** — Destruye todos los enemigos en pantalla (1 uso por vida)

**Implementado:**

- ✅ `KeyH` → `useHyperspace()` — teleport random, cooldown 5s, invulnerabilidad 0.5s
- ✅ `KeyN` → `useNuclear()` — destruye todos los enemigos + libera cautivos, 1 uso/vida
- ✅ Regeneran al morir (`loseLife()` resetea ambos)
- ✅ HUD: `nuclearDisplay` + `hyperspaceDisplay` con cooldown
- ✅ Touch: ☢️ (nuclear) + ⚡ (hiperspacio)
- ✅ Gamepad: botón X (hyperspace) + botón Y (nuclear)

---

### 16. JOUST — 🔧 En progreso (otro agente)

**Original:** Williams Joust (1982)

**Hallazgos:**

- Sin vultures (enemigos sin jinete)
- Sin pterodactyls
- Sin lava que sube

**Decisiones:**

- ✅ **Agregar vultures** — Enemigos que vuelan sin jinete, más rápidos
- ✅ **Agregar pterodactyls** — Aparecen en oleadas altas, vuelan recto y rápido
- ✅ **Agregar lava subiendo** — Lava visual que sube gradualmente, tocarla = muerte

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

## Trabajo restante

### Pendientes de implementar (4 juegos)

| Juego           | Cambios requeridos                                                      | Prioridad |
| --------------- | ----------------------------------------------------------------------- | --------- |
| **Donkey Kong** | 3 fases faltantes (fuego, elevador, construcción) + enum + transiciones | Alta      |
| **Pong**        | Modo 2P local + IA más humana                                           | Baja      |
| **Breakout**    | Anti-stuck (5s timer) + Layout 8×14                                     | Baja      |
| **Asteroids**   | Hiperspacio (KeyH, cooldown 3s)                                         | Baja      |

### En progreso (1 juego)

| Juego     | Cambios requeridos                      | Agente      |
| --------- | --------------------------------------- | ----------- |
| **Joust** | Vultures + pterodactyls + lava subiendo | Otro agente |

---

## Notas de implementación

- Todos los cambios deben mantener el **estilo visual neon/CRT** existente
- Usar las funciones de `shared/effects.js` (fillWithGlow, strokeWithGlow, etc.)
- Mantener **input parity**: keyboard + touch + gamepad
- Actualizar `shared/help.js` con nuevas teclas/controles
- Actualizar `metadata.json` version de cada juego modificado
- Ejecutar `npm run check` después de cada cambio
- Commits con prefijo `fix(games):` o `feat(games):` según corresponda
