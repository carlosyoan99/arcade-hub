# Investigación — dificultad progresiva, variedad y adaptación moderna

> 25-nov-2026 · Base para las curvas de `GameDefinition.progression` del Arcade Engine.
> Fuentes consultadas: Wikipedia *Dynamic game difficulty balancing* y *Pac-Man* y *Tetris* (2026).

## 1. Qué hacía el arcade original

- **Pac-Man:** al comer todos los puntos se avanza de nivel; se muestran frutas indicadoras y cortas escenas entre niveles. Los cuatro fantasmas tienen comportamientos distintos, no uno solo.
- **Tetris:** la velocidad de caída aumenta al limpiar líneas; aparecen cola (queue), soft drop, hard drop y hold como mejoras aceptadas por el estándar posterior.
- **DDA clásico (Wikipedia):** los parámetros que se ajustan son velocidad de enemigos, vida, frecuencia de aparición, frecuencia de power-ups, poder del jugador/enemigo y duración de la partida.

## 2. La trampa del DDA (lección importante)

Rollings y Adams (citados en Wikipedia): un juego que ajustaba la dificultad según el rendimiento previo fue **explotado** por jugadores que jugaban mal a propósito para facilitarse el nivel siguiente. Conclusiones para nuestro motor:

1. La progresión **visible por nivel** (puntos, líneas, oleadas) es la columna vertebral: es justa y legible.
2. La adaptación dinámica debe ser **oculta, acotada y lenta** (`window` de cientos de ticks, `maxAdjust` ≤ 0.08-0.1). El jugador no ve un indicador de "el juego te está ayudando".
3. Nunca se reescribe la física para favorecer al jugador (eso sería *cheating AI*); solo se modulan parámetros declarados.

## 3. Variedad sin perder determinismo

- Patrón elegido con RNG sembrado y **bolsa (bag)** + veto de repetición: misma semilla, misma secuencia; nunca `Math.random`.
- Variedad = mezcla de patrones, no ruido: se telegrafía el cambio (p. ej. color del proyecto, pitido) y se evitan situaciones inevitables.
- Los patrones son datos del juego (`patterns: [...]`), la selección la hace el motor (`ctx.progression.nextPattern()`).

## 4. Adaptación a la era actual (sin perder la similitud)

| Original | Nuestro motor |
| --- | --- |
| Dificultad fija por nivel | Niveles declarativos + DDA oculto y acotado |
| Secuencias fijas de enemigos | Bolsa sembrada de patrones, veto de repetición |
|Una sola tabla de controles | Acciones nombradas: teclado, gamepad, táctil, IA y red idénticos |
| Puntuación local | Récords por modo, la IA no escribe récords humanos |
| Reinicio duro | Snapshot/restore, replay y semilla compartible ("daily seed") |
| Sonido y partículas por juego | Eventos del motor: `emit('hit')` → audio y partículas centralizados |
| Dificultad elegible a ojo | Perfiles Fácil/Normal/Difícil desde checkpoints de IA y curva base |

**Juice se conserva:** los eventos (`hit`, `score`, `explode`, `win`, `levelUp`) alimentan partículas, shake y audio del motor. Los juegos no los implementan: solo los emiten.

## 5. Curvas propuestas por juego (valores concretos)

`pointsPerLevel` = cada cuántas unidades de progreso sube el nivel. `speed` = multiplicador. `hazard` = intensidad 0..1 (reduce huecos, aumenta enemigos).

| Juego | Progreso | Niveles (speed / hazard) | Patrones de variedad |
| --- | --- | --- | --- |
| Pong | puntos (cada 2) | 1 / 1.12 / 1.25 / 1.4 · 0/.1/.25/.4 | center, left, right, high, low |
| Flappy | puntos (cada 5) | 1 / 1.1 / 1.22 / 1.35 · 0/.1/.2/.35 | high, center, low, zigzag |
| Snake | comida (cada 5) | 1 / 1.08 / 1.18 / 1.3 · 0/.1/.2/.3 | rush, corner, weave |
| Breakout | ladrillos (cada 12) | 1 / 1.08 / 1.16 / 1.28 · 0/.1/.2/.35 | straight, bank, power |
| Tetris | líneas (cada 8) | 1 / 1.1 / 1.22 / 1.38 / 1.55 · 0/.1/.2/.3/.45 | queue7, tspin, holes |
| Bomberman | oleadas (cada 1) | 1 / 1.1 / 1.2 · 0/.2/.4 | cross, corridor, rush |
| Pac-Man | laberinto (cada 1) | 1 / 1.08 / 1.16 / 1.25 · 0/.1/.2/.3 | chase, scatter, ambush |
| Space Invaders | oleadas (cada 1) | 1 / 1.12 / 1.25 / 1.4 · 0/.15/.3/.45 | dive, sweep, shield |
| Galaga | oleadas (cada 1) | 1 / 1.1 / 1.25 · 0/.2/.4 | spiral, split, boss |
| Asteroids | oleadas (cada 1) | 1 / 1.1 / 1.2 / 1.35 · 0/.15/.3/.5 | split, drift, swarm |
| Centipede | oleadas (cada 1) | 1 / 1.12 / 1.25 · 0/.2/.4 | snake, spider, mushroom |
| Tempest | nivel (cada 15 puntos) | 1 / 1.12 / 1.28 · 0/.2/.4 | flipper, tank, scramble |
| Frogger | filas (cada 1) | 1 / 1.08 / 1.18 · 0/.15/.3 | log, turtle, car |
| Donkey Kong | nivel (cada 1) | 1 / 1.1 / 1.22 · 0/.2/.4 | barrel, fire, spring |
| Dig Dug | nivel (cada 1) | 1 / 1.1 / 1.25 · 0/.2/.4 | tunnel, rock, chase |
| Joust | oleada (cada 1) | 1 / 1.12 / 1.25 · 0/.2/.4 | egg, dive, swarm |
| Defender | oleada (cada 1) | 1 / 1.1 / 1.25 · 0/.2/.45 | lander, smartbomb, swarm |
| Double Dragon | acto (cada 1) | 1 / 1.1 / 1.22 · 0/.2/.4 | grunt, weapon, boss |
| Out Run | tramo (cada 1) | 1 / 1.08 / 1.18 · 0/.15/.3 | curve, traffic, night |
| Pole Position | circuito (cada 1) | 1 / 1.1 / 1.22 · 0/.15/.3 | curve, traffic, rain |
| Moon Patrol | distancia (cada 500) | 1 / 1.1 / 1.22 · 0/.2/.4 | crater, rock, ufo |
| Paperboy | calle (cada 1) | 1 / 1.1 / 1.2 · 0/.15/.3 | mailbox, obstacle, lawn |
| Q*bert | nivel (cada 1) | 1 / 1.1 / 1.25 · 0/.2/.4 | cube, coil, sam |
| Columns | piezas (cada 20) | 1 / 1.1 / 1.22 · 0/.15/.3 | gem, power, chain |
| Puyo Puyo | cadenas (cada 3) | 1 / 1.1 / 1.25 · 0/.2/.4 | chain, garbage, color |
| Raiden | sector (cada 1) | 1 / 1.1 / 1.25 · 0/.2/.45 | weave, turret, boss |
| Gradius | sector (cada 1) | 1 / 1.1 / 1.22 · 0/.2/.4 | capsule, wall, boss |
| Missile Command | ciudad (cada 1) | 1 / 1.12 / 1.25 · 0/.2/.4 | straight, split, smart |
| Burger Time | nivel (cada 1) | 1 / 1.1 / 1.22 · 0/.2/.4 | ingredient, enemy, pepper |
| Cell Swarm | masa (cada 100) | 1 / 1.1 / 1.25 · 0/.2/.4 | split, eject, hunt |
| Neon Nexus | oleada (cada 1) | 1 / 1.1 / 1.25 · 0/.2/.45 | wave, shop, elite |
| Dino Runner | distancia (cada 300 m) | 1 / 1.12 / 1.28 · 0/.2/.4 | cactus, bird, night |

## 6. Criterio de aceptación para cada juego migrado

1. `progression` declarado con al menos 3 niveles crecientes y patrones variados.
2. `step()` usa `ctx.progression.update()`, `ctx.progression.state.speed` y `nextPattern()` cuando aplica.
3. Emite eventos de juice (`hit`, `score`, `levelUp`, `explode`) en lugar de dibujar/sonar desde la lógica.
4. Cero `Math.random`, `Date.now`, `setTimeout` y DOM dentro de `step()`.
5. Tests de determinismo, de subida de dificultad y de patrón dentro de la bolsa.
