# Game Mechanics Audit — Arcade Hub

> Auditoría de mecánicas de los 19 juegos contra sus originales arcade.
> Fecha: 2026-08-24 | Última actualización: 2026-08-26
> Estado: **9/19 completados (fase 1), 1 en progreso, 4 pendientes**

---

## Estado de implementación

### Fase 1 — Decisiones iniciales (completadas)

| # | Juego | Decisiones | Commit |
|---|-------|-----------|--------|
| 5 | Space Invaders | 1 bala + puntos variables | `a834abd` |
| 7 | Pac-Man | Scatter/chase + frutas + muerte | `76ec543` |
| 8 | Tetris | Hold + SRS | `55ec803` |
| 9 | Frogger | Timer 60s + tortugas | `71753a1` |
| 10 | Galaga | Tractor beam | `67bf7be` |
| 11 | Centipede | Tercio inferior + splitting | `304075d` |
| 12 | Dig Dug | Sin phase-through + rocas | `14e8184` |
| 13 | Missile Command | Quitar guiados/smart/satélites | `7042fab` |
| 15 | Defender | Hyperspace + nuclear | `f5570a5` |

### Fase 2 — Paridad arcade (pendiente)

Ver [## Paridad arcade por juego](#paridad-arcade-por-juego) más abajo.

### Pendientes de implementar (sin fase 1)

| Juego | Cambios requeridos |
|-------|-------------------|
| **Donkey Kong** | 3 fases faltantes (fuego, elevador, construcción) |
| **Pong** | Modo 2P + IA más humana |
| **Breakout** | Anti-stuck + Layout 8×14 |
| **Asteroids** | Hiperspacio |

### En progreso

| Juego | Agente |
|-------|--------|
| **Joust** | Vultures + pterodactyls + lava — otro agente |

---

## Detalle por juego — Fase 1 completada

### 1. PONG — ❌ Pendiente

**Original:** Atari Pong (1972)

**Decisiones:**

- ✅ **Mantener score 7** — Más casual, ideal para web
- ✅ **Agregar modo 2 PvP local** — Teclado dividido (W/S vs ↑/↓)
- ✅ **Hacer IA más humana** — `aiReactionDelay`, `aiAimError`, `aiSpeedVariation`

**Estado:** Sin implementar. No existe segundo jugador ni IA humana.

---

### 2. BREAKOUT — ❌ Pendiente

**Original:** Atari Breakout (1976)

**Decisiones:**

- ✅ **Agregar anti-stuck** — Timer 5s que fuerza rebote hacia arriba
- ✅ **Layout 8×14 original** — Más filas y columnas
- ✅ **Mantener 1 bola + 3 vidas**

**Estado:** Sin implementar. Layout actual 5×9, sin anti-stuck.

---

### 3. SNAKE — ⏭️ Sin cambios

---

### 4. ASTEROIDS — ❌ Pendiente

**Original:** Atari Asteroids (1979)

**Decisiones:**

- ✅ **Agregar Hiperspacio** — `KeyH`, cooldown 3s
- ✅ **Mantener invulnerabilidad al respawn**

**Estado:** Solo invulnerabilidad implementada. Sin hiperspacio.

---

### 5. SPACE INVADERS — ✅ Fase 1 completada

**Original:** Taito Space Invaders (1978) · **Commit:** `a834abd` · **v1.7.0**

**Fase 1 — implementado:**

- ✅ 1 bala a la vez (`plyBullets.length === 0`)
- ✅ Puntos variables `[50,100,150,200,250,300]`

**Verificar paridad →** [Space Invaders paridad](#space-invaders--paridad)

---

### 6. FLAPPY BIRD — ⏭️ Sin cambios

---

### 7. PAC-MAN — ✅ Fase 1 completada

**Original:** Namco Pac-Man (1980) · **Commit:** `76ec543` · **v1.7.0**

**Fase 1 — implementado:**

- ✅ Scatter/chase cycles (7s→20s→7s→20s→5s→5s→5s→∞)
- ✅ Frutas bonus (cereza→melón, spawns a 70/170 dots)
- ✅ Animación muerte (boca se abre hasta desaparecer, 1.4s)

**Verificar paridad →** [Pac-Man paridad](#pac-man--paridad)

---

### 8. TETRIS — ✅ Fase 1 completada

**Original:** Electronorgtechnica Tetris (1984) · **Commit:** `55ec803` · **v1.7.0**

**Fase 1 — implementado:**

- ✅ Hold piece (`KeyC`, one-use-per-piece)
- ✅ Rotación SRS con wall kicks completos (I + JLSTZ)

**Verificar paridad →** [Tetris paridad](#tetris--paridad)

---

### 9. FROGGER — ✅ Fase 1 completada

**Original:** Konami Frogger (1981) · **Commit:** `71753a1` · **v1.6.0**

**Fase 1 — implementado:**

- ✅ Timer 60s por vida (`state.timeLeft`, `TIME_LIMIT = 60`)
- ✅ Tortugas que se sumergen (ciclo visual con blink warning)

**Verificar paridad →** [Frogger paridad](#frogger--paridad)

---

### 10. GALAGA — ✅ Fase 1 completada

**Original:** Namco Galaga (1981) · **Commit:** `67bf7be` · **v1.7.0**

**Fase 1 — implementado:**

- ✅ Tractor beam (captura → nave enemiga → rescate → doble disparo)
- ✅ Animación del beam

**Verificar paridad →** [Galaga paridad](#galaga--paridad)

---

### 11. CENTIPEDE — ✅ Fase 1 completada

**Original:** Atari Centipede (1981) · **Commit:** `304075d` · **v1.6.0**

**Fase 1 — implementado:**

- ✅ Restricción al tercio inferior (`PLAYER_TOP_RATIO = 0.66`)
- ✅ Splitting real (segmento destruido → ciempiés nuevo independiente)

---

### 12. DIG DUG — ✅ Fase 1 completada

**Original:** Namco Dig Dug (1982) · **Commit:** `14e8184` · **v1.6.0**

**Fase 1 — implementado:**

- ✅ Sin phase-through (`isEmpty()` único gate)
- ✅ Múltiples rocas cayendo (`fallingRocks[]` array)

---

### 13. MISSILE COMMAND — ✅ Fase 1 completada

**Original:** Atari Missile Command (1980) · **Commit:** `7042fab` · **v1.6.0**

**Fase 1 — implementado:**

- ✅ Eliminados: guided, smart, satellites
- ✅ Solo `missiles[]` (amenaza normal)
- ✅ 6 ciudades se mantienen (decisión del usuario)

---

### 14. DONKEY KONG — ❌ Pendiente

**Original:** Nintendo Donkey Kong (1981)

**Decisiones:**

- ✅ **4 fases:** Barriles ✓ · Fuego ✗ · Elevador ✗ · Construcción ✗

**Estado:** Solo fase 1 (barriles) implementada.

---

### 15. DEFENDER — ✅ Fase 1 completada

**Original:** Williams Defender (1981) · **Commit:** `f5570a5` · **v1.5.0**

**Fase 1 — implementado:**

- ✅ Hyperspace (`KeyH`, cooldown 5s, teleport random)
- ✅ Nuclear (`KeyN`, 1 uso/vida, destruye todos los enemigos)
- ✅ Regeneran al morir
- ✅ HUD + touch + gamepad

---

### 16. JOUST — 🔧 En progreso

**Original:** Williams Joust (1982)

**Decisiones:**

- ✅ Vultures + pterodactyls + lava subiendo

**Estado:** Otro agente trabajando.

---

## Juegos sin cambios

- **Neon Nexus** — Juego original, sin comparación arcade
- **Cell Swarm** — Juego original, sin comparación arcade
- **Dino Runner** — Juego original, sin comparación arcade

---

## Paridad arcade por juego

> Análisis detallado de mecánicas faltantes contra los originales arcade.
> Los juegos de la Fase 1 completaron las decisiones iniciales, pero
> presentan brechas significativas de paridad con el arcade original.

---

### Space Invaders — Paridad

**Original:** Taito Space Invaders (1978)

| Mecánica | Original | Actual | Estado |
|----------|----------|--------|--------|
| Escudos con erosión espacial | Daño radial por punto de impacto | Bloques con HP que desaparecen enteros | ❌ |
| Daño de escudo: jugador vs enemigo | Enemigos destruyen ~2× más material | Ambos hacen `hp--` idéntico | ❌ |
| Enemigos destruyen escudos al caminar | Sí, borran bloques que tocan | No, atraviesan escudos sin daño | ❌ |
| Velocidad: solo basada en enemigos vivos | Función escalonada discreta | Lineal + extra basado en score | ❌ |
| Velocidad por fila | 4 tasas distintas por tipo | Todas las filas comparten un timer | ❌ |
| Disparo: solo el más bajo de cada columna | Sí | Cualquier enemigo vivo al azar | ❌ |
| Máx 3 balas enemigas | 3 | Sin límite | ❌ |
| Vida extra a 1000 pts | Sí | Ninguna | ❌ |
| Velocidad de bala del jugador aumenta | Sí, con menos enemigos | Constante 500 | ❌ |
| Progresión de oleadas (enemigos más bajos) | Sí, cada oleada empieza 1 fila más abajo | Siempre misma posición | ❌ |
| Puntos mystery ship | [50,100,150,300] | [50,100,150,200,250,300] | ⚠️ |
| Invulnerabilidad al respawn | No existía | 2 segundos | ⚠️ QoL |

**Prioridad:** Shields (erosión + contacto) y disparo por columna son los más icónicos.

---

### Pac-Man — Paridad

**Original:** Namco Pac-Man (1980)

| Mecánica | Original | Actual | Estado |
|----------|----------|--------|--------|
| Scatter targets por fantasma | Blinky=top-right, Pinky=top-left, Inky=bottom-right, Clyde=bottom-left | Todos intercambiados | ❌ |
| Puerta del ghost house solo para eyes | Sí, chase/scatter no pueden entrar | chase mode puede pasar (línea 452) | ❌ |
| Eyes re-entran al house por la puerta | Sí, navegan hasta el centro | Se teleportan a (14,11) | ❌ |
| Release por dot-count (30/60/100) | Sí, con fallback temporal | Solo timers (0s/2s/4s/6s) | ❌ |
| Cruise Elroy (Blinky se acelera) | Sí, cuando quedan <100 y <30 dots | No existe | ❌ |
| Duración fright: 6s nivel 1 | 6s, escala por nivel | 7s fijo | ❌ |
| Pause al comer fantasma | ~1 segundo de freeze | Inmediato | ❌ |
| Vida extra a 10,000 pts | Sí | No | ❌ |
| Maze asimetría | Simétrico horizontalmente | 12 filas con 27 chars (deben ser 28), bottom wall faltante | ❌ |
| Pinky overflow bug | +4 tiles up +4 tiles left al mirar arriba | No implementado | ❌ |

**Prioridad:** Scatter targets, ghost gate, y vida extra son los más impactantes.

---

### Tetris — Paridad

**Original:** Electronorgtechnica Tetris (1984) / Tetris Guideline

| Mecánica | Original/Guideline | Actual | Estado |
|----------|-------------------|--------|--------|
| Lock delay correcto | 0.5s wall-clock, max 15 resets | Acumulado por gravity-tick, sin límite | ❌ |
| Soft drop scoring | 1 pt/cell | Sin puntos | ❌ |
| 7-bag randomizer | Guideline: shuffle 7 piezas | `Math.random()` puro | ❌ |
| Hidden spawn rows | 2 filas arriba del visible | Spawna en fila 0 (visible) | ❌ |
| Next piece: original no muestra | 1984: nada; Guideline: 3-6 | Muestra 1 | ⚠️ |
| T-Spin detection | Guideline sí | No implementado | ❌ |
| Back-to-back bonus | Guideline sí | No implementado | ❌ |

**Prioridad:** 7-bag randomizer y lock delay arreglado son esenciales para competitividad.

---

### Frogger — Paridad

**Original:** Konami Frogger (1981)

| Mecánica | Original | Actual | Estado |
|----------|----------|--------|--------|
| Crocodiles en el río | Sí, abren boca y matan | No existen | ❌ |
| Bonus items (fly, butterfly, snake) | Sí, puntos extra | No existen | ❌ |
| Vida extra a 10,000 y 20,000 pts | Sí | No | ❌ |
| Timer global (no por vida) | Continuo, muerte cuesta tiempo restante | Reset a 60s por vida | ❌ |
| Time bonus al llegar a goal | Sí, 1000 pts + bonificación | No | ❌ |
| Progresión de niveles | Infinito, más rápido cada ronda | Termina después de 1 ronda | ❌ |
| Velocidad de trucks (inversión) | Trucks = lentos y largos | Trucks = rápidos (invertido) | ❌ |
| Race cars | Sí, muy rápidos y angostos | No existen | ❌ |

**Prioridad:** Niveles infinitos y timer global son los más icónicos.

---

### Galaga — Paridad

**Original:** Namco Galaga (1981)

| Mecánica | Original | Actual | Estado |
|----------|----------|--------|--------|
| 3 tipos de enemigo (Boss/Bee/Butterfly) | Distintos sprites, HP, comportamiento | Solo colores diferentes, 1 HP todos | ❌ |
| Boss Galaga: 2 HP en formación | Sí | 1 HP | ❌ |
| Doble disparo: permanente hasta morir | Sí, dura hasta perder vida | Timer de 10 segundos | ❌ |
| Vida extra a 10K/30K/60K | Sí | No | ❌ |
| Formaciones por stage (40 stages) | Patrones únicos | Siempre la misma grilla 10×5 | ❌ |
| Entry sequences (stages 1-4) | Vuelos scriptados a formación | Enemigos aparecen estáticos | ❌ |
| Bonus/challenge stages | Sí, stages de shoot-em-up | No | ❌ |
| Row 2 points | 150 (Boss) | 100 | ⚠️ |
| Shoot frequency escala con wave | Sí | Constante 0.008 | ❌ |

**Prioridad:** 3 tipos de enemigo + doble disparo permanente + formaciones variables.

---

### Centipede — Paridad

**Original:** Atari Centipede (1981)

| Mecánica | Original | Actual | Estado |
|----------|----------|--------|--------|
| Flea (cae cuando faltan hongos) | Sí, deja hongos al caer | Existe (verificar spawn condición) | ⚠️ Verificar |
| Scorpion (aparece en oleadas altas) | Sí, envenena hongos | Existe (verificar) | ⚠️ Verificar |
| Spider (movimiento errático) | Sí, rebota en zona inferior | Existe | ✅ |

**Nota:** Centipede parece tener la paridad más completa de los completados.

---

### Dig Dug — Paridad

**Original:** Namco Dig Dug (1982)

| Mecánica | Original | Actual | Estado |
|----------|----------|--------|--------|
| Pump: enemigos se inflan y explotan | Sí | Funciona | ✅ |
| Rocas: aplastan enemigos y jugador | Sí | Funciona | ✅ |
| Enemigos: caminan por túneles | Sí | Implementado (fase 1) | ✅ |
| Pooka: se disfraza de hongo | Sí | Verificar | ⚠️ Verificar |
| Fygar: breath de fuego horizontal | Sí | Verificar | ⚠️ Verificar |
| Bonus items (vegetales) | Sí, aparecen entre oleadas | Verificar | ⚠️ Verificar |

---

### Missile Command — Paridad

**Original:** Atari Missile Command (1980)

| Mecánica | Original | Actual | Estado |
|----------|----------|--------|--------|
| 3 ciudades (original) | 3 | 6 (decisión del usuario) | ⚠️ |
| Misiles enemigos normales | Sí | Sí | ✅ |
| Smart bombs / guided | No existían | Eliminados (fase 1) | ✅ |
| Bonus por sobrevivir oleada | Sí, puntos por ciudad | Verificar | ⚠️ Verificar |
| Niveles: misiles más rápidos | Sí | Verificar | ⚠️ Verificar |

---

### Defender — Paridad

**Original:** Williams Defender (1981)

| Mecánica | Original | Actual | Estado |
|----------|----------|--------|--------|
| 4 armas (laser, bomb, hyperspace, nuclear) | Sí | Implementadas (fase 1) | ✅ |
| hyperspace: posición aleatoria | Sí | Implementado | ✅ |
| nuclear: 1 por vida | Sí | Implementado | ✅ |
| Mutantes al perder humanos | Sí | Verificar | ⚠️ Verificar |
| Radar de humanos | Sí | Verificar | ⚠️ Verificar |

---

## Trabajo restante — Resumen

### Fase 1 completada, paridad pendiente (9 juegos)

| Juego | Decisiones Fase 1 | Paridad arcade |
|-------|-------------------|---------------|
| Space Invaders | ✅ | 11 mecánicas faltantes |
| Pac-Man | ✅ | 10 mecánicas faltantes |
| Tetris | ✅ | 7 mecánicas faltantes |
| Frogger | ✅ | 8 mecánicas faltantes |
| Galaga | ✅ | 9 mecánicas faltantes |
| Centipede | ✅ | ~2 por verificar |
| Dig Dug | ✅ | ~3 por verificar |
| Missile Command | ✅ | ~2 por verificar |
| Defender | ✅ | ~2 por verificar |

### Fase 1 sin implementar (4 juegos)

| Juego | Cambios |
|-------|---------|
| Donkey Kong | 3 fases |
| Pong | 2P + IA |
| Breakout | Anti-stuck + 8×14 |
| Asteroids | Hiperspacio |

### En progreso (1)

| Juego | Agente |
|-------|--------|
| Joust | Vultures + pteros + lava |

---

## Notas de implementación

- Todos los cambios deben mantener el **estilo visual neon/CRT** existente
- Usar las funciones de `shared/effects.js` (fillWithGlow, strokeWithGlow, etc.)
- Mantener **input parity**: keyboard + touch + gamepad
- Actualizar `shared/help.js` con nuevas teclas/controles
- Actualizar `metadata.json` version de cada juego modificado
- Ejecutar `npm run check` después de cada cambio
- Commits con prefijo `fix(games):` o `feat(games):` según corresponda
