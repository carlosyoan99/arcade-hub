# Auditoría de paridad — BATCH PUZZLES (7 juegos)

> 27-nov-2026 · Análisis **solo lectura**. No se modificó código ni se ejecutó la suite.
> Juegos: Breakout, Snake, Tetris, Columns, Puyo Puyo, Dino Runner, Joust.

## 0. Metodología y fuentes

| Fuente | Uso |
| --- | --- |
| `git show a8a8093^:games/<id>/script.js` | Original legacy. **`a8a8093`** = `chore: retirar hub legacy tras paridad`; su padre es **`0ee83c4`**. Verificado: en `0ee83c4` convivían `games/<id>/script.js` **y** `engine/src/games/<id>/game.ts`, por lo que la retirada no fue la migración en sí, sino su borrado tras la paridad. Las citas `script.js:NN` se refieren al padre. |
| `engine/src/games/<id>/game.ts` | Implementación actual (migrada). Citas `game.ts:NN`. |
| `docs/Arcade Hub — investigación completa.md` | Fichas históricas de cada juego y registro de bugs B1–B8 (índices: Breakout §3, Columns §7, Dino §10, Joust §17, Puyo §26, Snake §29, Tetris §32). |
| `docs/investigacion-dificultad-variedad.md` | Curvas `progression` previstas y criterios de aceptación. |
| `engine/src/{progression,game,core,input,sim}` | Semántica real de `progression.update/observe`, `handleLifecycle`, `scheduler`, bindings y reglas. |
| `engine/test/games-puzzle.test.ts` | Cobertura existente (determinismo, juice, B3/B4/B6/B7/B8, 7-bag/SRS/T-spin/hold). |

Convención de severidad: **P0** = mecánica documentada inaccesible en el hub publicado; **P1** = regla del original cambiada de forma sustancial o capacidad anunciada no implementada; **P2** = detalle de feel/presentación o desviación menor. **「No verificado」** = no se ha podido contrastar en código ni con fuente externa consultada; tratar como hipótesis.

**Nota de alcance:** los tests del motor inyectan acciones directamente en la cinta (`sim.tick(['hardDrop'])`), por lo que **no detectan** los problemas de mapeo de teclado del hub; estos se verificaron leyendo `engine/demo/main.ts:47-69,111-139` y confirmando que el bundle generado `assets/index-B6DfW3BW.js` contiene la misma tabla `ALIASES` y `bindingsFor()`.

---

## 0.1 Hallazgo transversal P0 — acciones con nombre sin enlace de teclado/táctil en el hub

`bindingsFor()` (`engine/demo/main.ts:111-122`) solo recorre `DEFAULT_BINDINGS` (`engine/src/input/bindings.ts:7-21`: `Space→primary`, `↑/W→up`, `↓/S→down`, `KeyP/Esc→pause`, `KeyR→restart`, `Enter→confirm`) y resuelve cada genérico contra la primera acción registrada del juego según `ALIASES` (`engine/demo/main.ts:48-69`). No existen enlaces para `KeyC`, `ShiftLeft`, `KeyZ`, ni para `hold`, `hardDrop`, `rotateCCW`, `launch` cuando hay otra acción que gana el alias.

Consecuencias verificadas (teclado del hub):

| Juego | `Space` resuelve a | Acciones **sin enlace** | `tapAction` (táctil) |
| --- | --- | --- | --- |
| Tetris | `rotate` (por `ALIASES.primary`, `main.ts:65`) | **`hardDrop`, `hold`, `rotateCCW`**; ↑ tampoco rota | `rotate` |
| Columns | `rotate` | **`hardDrop`**; ↑ tampoco rota | `rotate` |
| Puyo Puyo | `rotate` | **`hardDrop`**; ↑ tampoco rota | `rotate` |
| Snake | *(ninguna: no hay acción `primary`)* | `Espacio` para pausar | `primary` **no registrado** → el tap no hace nada |
| Breakout | `launch` ✔ | — | `launch` ✔ |
| Dino Runner | `jump` ✔ | — | `jump` ✔ |
| Joust | `flap` ✔ | — | `flap` ✔ |

Esto **anula en la práctica** las correcciones B3/B4 implementadas en `columns/game.ts:301-311` y `puyo-puyo/game.ts:304-315`: el juego consume `hardDrop`, pero el hub nunca lo produce con Espacio. Es el P0 dominante del batch.

Correlacionado: no hay botones táctiles por juego en `engine/demo/` (solo un `tapAction` global, `main.ts:290-295`), frente a los botones del legacy (`script.js` de cada juego, p. ej. `breakout.js:205-258`, `tetris.js:658-704`). La research doc ya advertía «verificar táctil» en Tetris (§32).

### Funciones del motor que faltan (transversal)

- **Enlazado por juego**: no hay `bindingsFor(game)` extendible ni per-game override en la definición (`defineGame` solo declara `actions: string[]`, `engine/src/game/contract.ts:31`). El remapeo de `ui/settings.ts` tampoco incluye `hold`/`hardDrop`.
- **Controles táctiles por juego**: `InputHost` solo soporta un `tapAction` (`input/host.ts:30-31,216-236`).
- **Servicio de match-3**: `findMatches` está reimplementado en Columns (`game.ts:99-128`), Puyo (`game.ts:107-136`) y parcialmente en Tetris (`clearLines`, `game.ts:183-217`); `sim/grid.ts` solo ofrece acceso a celdas y conversión de coordenadas.
- **Servicio de piezas/queue/ghost**: las hay **dentro de Tetris** (`takeFromBag` `game.ts:122-135`, `ghostYFor` `147-151`, `state.hold/next` `74-100`) pero no son reutilizables; Columns/Puyo no tienen cola de piezas (el original tampoco).
- **Timers serializables**: **sí existen** (`core/scheduler.ts:19-83`, snapshot en `:66-80`; integrados en `core/simulation.ts:60-67,161-177`), y B3/B4/B6 los usan vía estado. No falta infraestructura, falta usarla más (p. ej. flash de Puyo).
- **Reglas 2P**: `singlePlayerRules` (`game/rules.ts:10-18`) es la única regla estándar; Puyo declara `players: [1,2]` pero no tiene reglas ni input de P2 humano.

---

## 1. Breakout

**Original (`script.js` @ `0ee83c4`)**
- 8×14 ladrillos con puntos por fila `80…10` (`script.js:58-77,309-331`); 3 vidas y velocidad de bola `290`, tope `700`, crecimiento por golpe `×1.01` y por nivel `×1.08` (`script.js:50-56,381-389,518`).
- Lanzamiento con ángulo aleatorio ±0.3 rad y bola aparcada en la pala (`script.js:333-352`); rebote en pala con ángulo `offset*0.7` (`script.js:504-522`).
- Subpasos anti-tunneling (`script.js:455-470`); detección del eje de impacto con la posición previa (`script.js:529-539`); pérdida y reaparcado (`script.js:556-560,391-406`).
- **Nivel se completa al romper todos los ladrillos** (`script.js:548-551`); anti-stuck fijo de **5 s** (`script.js:65,770-777`).

**Migrado (`game.ts`)**
- Constantes equivalentes (`game.ts:8-30`), `buildBricks` (`63-80`), `parkBall`/launch con `ctx.rng` (`82-89,169-183`), física con subpasos (`185-267`), anti-stuck (`269-277`), eventos `wallHit/paddleHit/brickBreak/lifeLost/levelUp/fanfare` (`198-275`), `observe` (`281-295`), `progression` con `patterns: ['straight','bank','power']` (`116-128`).

**Regresiones / faltantes**
- **P1** — Subida de nivel cada **12 ladrillos rotos**, no al vaciar el tablero: `handleLifecycle(state, ctx, state.bricksBroken, …)` (`game.ts:137`) + `pointsPerLevel: 12` (`game.ts:124`) + `progression.update` (`game/lifecycle.ts:34`). El tablero se reconstruye a mitad de partida (`game.ts:148-159`) y se pierden los ladrillos restantes. El plan de dificultad (`investigacion-dificultad-variedad.md` §5) proponía 12, pero el original es «todos».
- **P1** — Anti-stuck ya no es 5 s fijos: usa `progress.spawnInterval` (`game.ts:272`), que baja a 210 ticks (3.5 s) en nivel 4 (`game.ts:119-122`). El `BREAKOUT.antiStuckTicks=300` (`game.ts:28`) queda como reserva.
- **P2** — `hazard` reduce el ancho de pala (`game.ts:161`): DDA nuevo, no presente en el original.
- **P2** — `power` solo duplica puntos (`game.ts:70,74,321-324`); no hay cápsulas/efectos temporales. Colores y glow por fila del original (`script.js:67-87,634-662`) sustituidos por paleta plana (`game.ts:307-325`); logros/récords locales y partículas desaparecen por diseño de motor (eventos centralizados).
- **P2** — «No verificado»: colisión con ladrillos usa `circleAabb` del motor (`game.ts:240`) en vez del test AABB expandido del original; puede diferir en esquinas. Sin test de paridad de rebotes.

**Adaptaciones modernas**
- **Arkanoid** (verificado, Wikipedia *Breakout (video game)* §Re-releases): introdujo power-ups y enemigos distintos; **Super Breakout** añadió multibola y 3 modos; **Breakout 2000** añadió 3D y multijugador. Justifica un servicio de power-ups y un modo multibola.
- **Breakout: Recharged** (conocimiento general, **no verificado**): reintérpretes "Recharged", logros y pantallas por niveles.

**Funciones del motor que faltan**: effects/power-ups con duración y snapshot, layout de ladrillos como datos con bolsa (los patrones genéricos ya existen), soporte multibola en un solo `state` (hoy `ball` es singular, `game.ts:32-37,48`).

---

## 2. Snake

**Original**
- 20×16 celdas, longitud 3, dirección RIGHT inicial (`script.js:38-49,327-358`); anti-reversa contra `direction` (`script.js:299-307`).
- Comida uniforme entre celdas libres (`script.js:309-325`); intervalo `160 ms → 60 ms` en 10 niveles de 10 comidas (`script.js:45-47,336-344,417-426`); victoria al llenar el tablero (`script.js:468-472`).

**Migrado**
- Estado serializable (`game.ts:31-47`), `placeFood` con bolsa de patrones `rush/corner/weave`, BFS del motor para descartar comida inalcanzable y RNG sembrado (`game.ts:72-123`), anti-reversa contra `state.dir` (`game.ts:185-197`), colisión con pared/cuerpo (`game.ts:217-235`), victoria (`game.ts:90-95`), velocidad combinada de curva + `speedLevel` (`game.ts:199-211`), `observe` con rayos y BFS (`game.ts:251-272`).

**Regresiones / faltantes**
- **P1 (hub)** — Sin control táctil: `tapActionFor()` devuelve `primary` (`demo/main.ts:125-140`), acción que Snake no registra (`game.ts:145`); el tap no hace nada.
- **P2 (hub)** — `Espacio` ya no pausa (research §29): no hay acción `primary`/`confirm` en Snake, por lo que `Space` no se enlaza; solo `P`/`Esc`.
- **P2** — La comida ya no es uniforme: patrón + BFS (`game.ts:98-120`) cambia la distribución y la dificultad respecto al original. Es una mejora deliberada, pero debe documentarse.
- **P2** — Intervalo mínimo real 4 ticks ≈ 66 ms (`game.ts:17,206-210`) vs 60 ms originales; la research doc proponía 5 comidas/nivel (`game.ts:154`) mientras que la velocidad sigue subiendo cada 10 (`game.ts:201-205`): dos escalas simultáneas.

**Adaptaciones modernas**
- **Snake.io / Slither.io** (verificados, Wikipedia *Snake (video game genre)* §Legacy): `.io` multijugador, tablero compartido, skins y tablas; 2023 Apple Arcade / 2024 Netflix & Switch para Snake.io.
- **Snake Rewind** (verificado en la misma fuente, ref. Engadget): modernización táctil del Nokia original.

**Funciones del motor que faltan**: modo de campo abierto/wrap y colisión con otros jugadores, servicio de spawn con veto (el RNG y `PATHFINDING_SERVICE` ya existen), registro de récords por modo (ya existe `store/scores.ts`, pero los juegos no lo usan).

---

## 3. Tetris

**Original**
- 10×20 + 2 filas ocultas, escalera de velocidad `1 s → 0.05 s` (`script.js:37-47,342-344`), 7-bag Fisher–Yates (`script.js:281-293`), cola visible de 3 (`script.js:267,782`), SRS completo con tablas JLSTZ/I (`script.js:131-248,506-528`), T-Spin full/mini (`script.js:535-555`), B2B y tabla de puntos (`script.js:397-457`), hold de un uso por pieza (`script.js:557-567`), hard drop `2 pts/celda` (`script.js:569-580`), ghost (`script.js:582-587`), lock delay `0.5 s / 15 resets` (`script.js:270-279,870-879`), soft drop `1 pt/celda` (`script.js:863-892`), DAS (`script.js:853-861`).

**Migrado**
- Tablas SRS y piezas (`game.ts:29-63`), `rotateBlocks` (`102-109`), bolsa sembrada (`122-135`), `ghostYFor` (`147-151`), garbage (`153-163`), línea/B2B/combo (`183-217`), T-Spin (`219-238`), lock/spawn (`240-254,165-181`), hold/hardDrop/gravity (`382-421`), `progression` a 8 líneas/nivel con 5 niveles (`293-306`), `observe` con alturas/huecos/hold/next/ghost (`434-465`).

**Regresiones / faltantes**
- **P0 (hub)** — `Space` se enlaza a `rotate`, no a `hardDrop` (`demo/main.ts:48-67,111-122`); **`hardDrop`, `hold` y `rotateCCW` no tienen tecla**, y ↑ tampoco rota. La research doc (§32) describe a Tetris como «modelo a seguir: Espacio hard drop sin conflicto» y el backend lo implementa (`game.ts:382-404`) pero el hub no lo expone. El tap táctil también rota (`main.ts:125-139`).
- **P1** — Inyección de basura por patrón `holes`/`hazard` al subir de nivel (`game.ts:328-331`), con riesgo de game over (`game.ts:153-162`). Mecánica moderna apta para versus, pero ausente en el Tetris del original y en la ficha §32.
- **P2** — Cola interna de 5 (`game.ts:11,166`) vs 3 visibles en el original; se renderizan 4 (`game.ts:547-549`). Combo `+25×n` (`game.ts:211`) y DAS con cooldown 8/4 ticks (`game.ts:339-357`) frente a los valores del original.
- **P2** — «No verificado»: precisión de la conversión `1 s → 60 ticks` al usar `progress.speed` como divisor (`game.ts:407-411`) y si el golden hash cubre la ruta de `hold`+`hardDrop` (los tests sí la cubren, `games-puzzle.test.ts:252-265`).

**Adaptaciones modernas**
- **Tetris Effect / Effect: Connected** (verificado, Wikipedia): misma base de tetrominós con 30 escenarios, música sincronizada, meta-progresión y mecánica **Zone** que detiene el tiempo para limpiar más de 4 líneas.
- **Tetris 99** (verificado, Wikipedia): 99 jugadores, envío de líneas-basura, selección de objetivo (aleatorio/quien te ataca/casi eliminado/con insignias), insignias que potencian el envío hasta +100 %, y modos Marathon/CPU Battle/Local Arena.

**Funciones del motor que faltan**: cola/ghost/hold **sí están resueltas dentro del juego**, pero no como servicio reutilizable; no hay enrutado de basura entre jugadores ni `timeScale`/Zona en `StepContext`; no hay botón de IA/demo para el modo attract (la research doc lo pedía).

---

## 4. Columns

**Original**
- 6×13, 3 gemas por pieza, rotación circular y movimiento con comprobación de celdas (`script.js:32-47,242-280`); match-3 en horizontal, vertical y **ambas diagonales** (`script.js:139-195`).
- Power-ups `FLASH/LIGHTNING/POISON` (`script.js:49-56,321-375`), generación tras cascada con probabilidad `0.12→0.35` (`script.js:377-388`), flash de **0.5 s** antes de limpiar (`script.js:310-319,638-645`), lock delay de **80 ms** (`script.js:638-662`).
- Puntuación `count*10 + chain*20 + level*5` y nivel cada **25 gemas** (`script.js:233-239,401-433`); spawn en columna `floor(6/2)-1 = 2` (`script.js:242-257`).

**Migrado**
- 6×**12** (`game.ts:7-14`), `findMatches` en 4 direcciones (`game.ts:99-128`), efectos de poder (`game.ts:130-179`), resolución de cascadas (`game.ts:181-245`), `rollGem` con probabilidad de especial **en la pieza que cae** (`game.ts:46-58,84-97`), spawn y hard drop (`game.ts:247-275`), `progression` (`281-292`).
- B3 resuelto en la lógica: `hardDrop` se consume antes que `pause` (`game.ts:301-311,356-360`) y flash en estado (`game.ts:328-334`).

**Regresiones / faltantes**
- **P0 (hub)** — `Space→rotate` (`demo/main.ts:48-67`): **hard drop inaccesible** por teclado/táctil y el parche B3 (`game.ts:301-311`) nunca se activa desde el hub. ↑ tampoco rota.
- **P1** — Dos sistemas de nivel en conflicto: `progression` sube cada **20 gemas** (`game.ts:288`, vía `handleLifecycle` en `:304`) y `clearAndCollapse` asigna `state.level = floor(gemsCleared/25)+1` (`game.ts:207`). Según el orden de ejecución, el nivel y el bonus `level*5` (`game.ts:204`) oscilan; el original usaba solo 25.
- **P1** — Gemas especiales pueden aparecer **dentro de la pieza en caída** (`game.ts:46-58,88`), mientras el original solo las generaba en el tablero tras una cascada (`script.js:377-388,431-432`). Cambia el balance de cadenas.
- **P2** — Tablero de 12 filas vs 13 del original; spawn en columna 3 vs 2 (`game.ts:9,86`); sin lock delay: bloquea en cuanto no puede bajar (`game.ts:368-376`). Se pierde `checkColorCollector` (`script.js:390-399`), solo logro.
- **P2** — «No verificado»: `findMatches` empieza el escaneo en cada celda (`game.ts:107-126`) y podría contar un run más de una vez desde distintos orígenes; el conjunto deduplica, pero el coste y algún caso de solapamiento diagonals deben validarse con tests de paridad.

**Adaptaciones modernas**
- **Puyo Puyo Tetris / PPT2** (verificado, Wikipedia): los modos Swap/Fusion y el envío de basura entre estilos son la evolución natural de Columns como «match-3 de caída»; el follow-up de 2020 (PPT2) amplía modos y batallas por habilidades (esta última, **no verificada** en la fuente consultada).
- **`Columns III`/recopilatorios Sega Ages** (conocimiento general, **no verificado**): multijugador y variantes de rotación.

**Funciones del motor que faltan**: `findMatches` genérico (4 direcciones, configurable `matchMin`) compartido con Puyo; servicio de power-ups condicionados a cadena; preview de pieza (en Columns el original no la tenía; el motor no ofrece uno genérico); timers de flash ya resueltos en estado (`game.ts:36-38`).

---

## 5. Puyo Puyo

**Original**
- 6×12, 4 colores, par de puyos, caída base 500 ms (`script.js:24-35,96-118`); **match de 4 en línea recta** horizontal/vertical (`script.js:127-148`), flash de 0.35 s (`script.js:351-358,500-508`).
- Basura `-2` sobre la columna con puyos, **retardada 2 s** (`script.js:35,183-193,367-372`); cadena ×2 basura, puntuación `count*10 + chain*30 + level*5`, nivel cada 200 puntos (`script.js:195-197,352-375,523`).
- CPU voraz que prueba columnas y maximiza puyos emparejados (`script.js:200-243`). **Bug B4**: `Space` se capturaba como pausa antes de `hardDrop` (`script.js:304-331`).

**Migrado**
- `findMatches` por **componente conexo** ≥4 (`game.ts:107-136`), resolución de cadenas **inmediata** en un bucle (`game.ts:184-201`), garbage en estado con `garbageDelayTicks=120` (`game.ts:7-14,163-182,339-347`), CPU (`game.ts:236-271`), patrones `chain/garbage/color` (`game.ts:318-331`), `progression` cada 3 cadenas (`game.ts:284-295`).
- B4 resuelto en la lógica (`game.ts:301-315,375-379`) y B6 con timer en estado (`game.ts:339-347`; test `games-puzzle.test.ts:311-330`).

**Regresiones / faltantes**
- **P0 (hub)** — Igual que Columns: `Space→rotate` (`demo/main.ts:48-67`), **hard drop inaccesible** por teclado/táctil; el fix B4 queda inoperante en el hub publicado.
- **P1** — `meta.players: [1,2]` (`game.ts:282`) pero no hay P2 humano: no hay acciones `p2*`, el tablero CPU es la única oposición y `rules` es `singlePlayerRules` (`game.ts:504-506`). Capacidad anunciada no implementada.
- **P1** — Regla de match cambiada: el original exigía 4 **en línea**; el motor usa grupos conexos en cruz (`game.ts:122-132`). Aceptable como modernización (es el estándar de Puyo actual), pero cambia cadenas y puntuación; la research doc §26 no lo menciona.
- **P1** — Nivel por cadenas (`pointsPerLevel: 3`, `game.ts:291`) en lugar de cada 200 puntos (`script.js:523`); el nivel afecta directamente la puntuación de cadena (`game.ts:190`).
- **P2** — Se pierde el telegrafiado visual de 0.35 s del flash: `resolveChains` limpia todo en el mismo tick (`game.ts:184-201`). El timer de basura sí se conserva.
- **P2** — «No verificado»: `addGarbage` busca la primera celda ocupada de abajo arriba (`game.ts:164-175`) y coloca encima; el original buscaba huecos `board[r] === -1 && board[r-1] !== -1` (`script.js:185-191`). Casos límite con columnas vacías podrían diferir.

**Adaptaciones modernas**
- **Puyo Puyo Tetris** (verificado, Wikipedia): hasta 4 jugadores locales/online, cada uno elige Puyo o Tetris, cadenas/líneas envían basura cruzada, modos Versus/Swap/Fusion/Big Bang, campaña Adventure y 6 retos individuales.
- **Puyo Puyo Tetris 2** (verificado solo como secuela de 2020, Wikipedia; resto de mecánicas **no verificadas**): evolución con batallas de habilidades/intercambio en combate.

**Funciones del motor que faltan**: servicio de match-3/components compartido con Columns, cancelación/enrutado de basura entre tableros, reglas y enrutado de entrada para 2 jugadores humanos, y un timer de flash serializable (el scheduler ya existe).

---

## 6. Dino Runner

**Original**
- Física `gravity 1800`, `jumpVelocity -620`, `fastFall ×2.5`, hitboxes 30×55 / 45×30 (`script.js:44-52,102-108,303-327`); distancia `speed*dt*0.04` y rampa `280→680` a `2.8 px/s²` (`script.js:53-62,913-916`).
- Cactus de 1–3 racimos y pájaros en 3 alturas; página >50 m con 35 % de pájaro (`script.js:471-508`); spawn `0.9–1.9 s` con factor de dificultad (`script.js:953-959`); subpasos anti-tunneling (`script.js:436-458`).
- Día/noche cada 100 m (`script.js:918-927`); colisión con **margen de tolerancia de 6 px** (`script.js:510-533`); parpadeo, sombrero huevo, nubes y squash (`script.js:929-947,684-833`). **Bug B8**: hitbox del cactus centrada en el suelo (`script.js:474-484`).

**Migrado**
- Constantes (`game.ts:8-25`), spawn con patrones `cactus/bird/night` y RNG (`game.ts:79-96`), física y fast fall (`game.ts:166-184`), distancia (`game.ts:158-164`), ciclo día/noche (`game.ts:186-193`), spawn (`game.ts:195-200`), colisión con `aabbOverlap` (`game.ts:202-218`). B8 corregido apoyando la base del cactus en `groundY` (`game.ts:93-94`; test `games-puzzle.test.ts:355-364`).

**Regresiones / faltantes**
- **P1** — Desaparece el margen de tolerancia de 6 px (`script.js:520-530` vs `game.ts:211`): la colisión es más estricta y cambia la sensación de salto, especialmente en pájaros.
- **P1** — Spawn y ritmo: el original usaba `0.9–1.9 s × max(0.5, 1-elapsed/90)` y pájaro solo tras 50 m al 35 % (`script.js:953-959,471-508`); el motor usa `spawnInterval 100/86/72` ticks con `lerp(0.8,1.25)` y `birdChance = 0.1 + hazard*0.5` (`game.ts:81-82,195-200`), además de patrón `night`. Ritmo distinto, no documentado en research §10.
- **P2** — Sin subpasos anti-tunneling (`script.js:439-450` vs `game.ts:203-218`). A 60 Hz el desplazamiento máximo es ~11 px, por debajo del umbral original de 15 px; «no verificado» con `dt` mayor.
- **P2** — Se pierden parpadeo, sombrero, nubes y squash/estiramiento (efectos visuales, ahora derivados de `ticks` en `render`, `game.ts:246-325`). Por diseño del motor (juice centralizado), pero sin eventos dedicados.
- **P2** — Pausa añadida (`actions` incluye `pause`, `game.ts:111`): mejora frente al original.

**Adaptaciones modernas**
- **Google Dino / Chrome Dino** (conocimiento general, **no verificado** por URL 404 en la wikipedia consultada): modo nocturno, obstáculos alternos y variantes locales.
- **Clones .io / "Dino Runner" móviles con retos diarios y tablas** (conocimiento general, **no verificado**): daily seeds, skins y multijugador asíncrono. El motor ya tiene `net/lockstep.ts` y `store/scores.ts` para ello.

**Funciones del motor que faltan**: generador de obstáculos por bolsa con telegraph (los patrones y RNG existen), hitboxes configurables por tolerancia (el `CollisionService` solo ofrece AABB/círculo), eventos de animación (`squash`, `blink`) para el fanout de juice.

---

## 7. Joust

**Original**
- 7 plataformas, lava que sube de `500` a `380` a `1.5 px/s`, física del jugador `accel 600 / max 200 / friction 0.92 / flap -280 / gravity 900` y **wrapping horizontal** (`script.js:38-67,429-485,1211-1212`).
- 5 tipos de enemigo con IA propia: bounder, hunter, vulture, shadow-lord y pterodactyl con fases fly/dive/climb; buitre con vaivén por `Date.now()` (`script.js:313-351,487-675`). **B7**.
- Justa gana quien tiene el centro más alto (`script.js:605-650`); **colisiones jinete contra jinete** (`script.js:653-670`); huevos que rebotan, eclosionan en 5 s y se recogen con combo ×250 (`script.js:634-641,675-761`).
- Oleada: se generan **todos** los enemigos al inicio (`script.js:300-311`) y se reponen hasta `wave*2+3` (`script.js:1214-1222`); avance inmediato al vaciar (`script.js:1224-1228`); +1 vida cada 3 oleadas (`script.js:382-391`).

**Migrado**
- Constantes y puntos por tipo (`game.ts:8-40`), `startWave` y `makeRider` (`game.ts:98-151`), IA con `ctx.clock.time` en el vaivén —B7 corregido— (`game.ts:218-291`), física del jugador (`game.ts:363-397`), justa/huevos (`game.ts:399-468`), avance de oleada con `waveTimer` y `ctx.schedule` (`game.ts:329-361,470-474`).

**Regresiones / faltantes**
- **P1** — **Wrapping horizontal eliminado**: jugador, enemigos y huevos se limitan con `clamp` (`game.ts:284,386,438-440`) frente al original (`script.js:469-472,580-583,698-700`). Cambia rutas de escape y tácticas de justa.
- **P1** — Spawn de oleada gradual: el motor genera 1–2 enemigos cada `spawnInterval` ticks (`game.ts:329-344`) frente al spawn inicial completo (`script.js:306-309`). Cambia la presión y la dificultad de la oleada; research §17 no lo contempla.
- **P2** — Se eliminan las justas entre enemigos (`script.js:653-670`).
- **P2** — Enemigos **rebotan** al aterrizar (`vy = -180`, `game.ts:287-290`) frente al original (`vy = 0` y subida por flap, `script.js:410-423,494-508`).
- **P2** — Invulnerabilidad tras perder vida también protege contra la lava (`game.ts:187-188,396`), mientras el original llamaba a `loseLife()` por lava sin mirar `invincible` (`script.js:481-484`); y el combo aumenta al ganar justas (`game.ts:416`), no solo al recoger huevos (`script.js:748-755`).
- **P2** — Bonus `100*wave` al limpiar oleada (`game.ts:352`) no existe en el original. «No verificado»: correspondencia exacta de los huevos eclosionados (elige tipo por `state.wave`, no por umbrales del original `script.js:715-723`).

**Adaptaciones modernas**
- **Joust 2: Survival of the Fittest** (verificado, Wikipedia *Joust (video game)*): secuela de 1986 con nuevo jinete/montura; el artículo señala que los intentos de remake moderno han sido infructuosos.
- **Joust con cooperativo 2P** (verificado en la misma fuente): segundo jugador con cisne azul; es la adaptación natural que el motor no implementa.

**Funciones del motor que faltan**: servicio de plataformas/colisión lateral con wrapping (hoy `landOnPlatform` es local, `game.ts:203-216`), spawner de oleadas reutilizable, reglas de cooperación/competencia 2P, y canal de eventos para lava/eclosión (ya se emiten `hatch`, `explode`, `joust`).

---

## 8. Resumen ejecutivo

| id | P0 | P1 | P2 |
| --- | --- | --- | --- |
| Breakout | — | nivel cada 12 ladrillos; anti-stuck 3.5 s en LV4 | hazard encoge pala; power brick sin efecto |
| Snake | — | sin tap táctil en el hub | `Espacio` no pausa; comida sesgada; dos escalas de velocidad |
| Tetris | **`hardDrop`/`hold`/`rotateCCW` sin tecla; `Espacio=rotate`** | garbage por patrón/hazard | cola 5 vs 3; DAS/combo distintos |
| Columns | **`hardDrop` sin tecla; `Espacio=rotate` (B3 inactivo)** | niveles 20 vs 25 gemas; especiales en la pieza | 12 filas; sin lock delay; spawn col 3 |
| Puyo Puyo | **`hardDrop` sin tecla; `Espacio=rotate` (B4 inactivo)** | `players:[1,2]` sin P2; match por componente; nivel por cadenas | sin flash; garbage "no verificado" |
| Dino Runner | — | sin margen de colisión 6 px; ritmo de spawn distinto | sin subpasos; efectos visuales perdidos |
| Joust | — | sin wrapping; spawn gradual en vez de masivo | sin justas entre enemigos; rebote; invulnerabilidad/bono |

**Acción P0 recomendada (fuera de este análisis, no ejecutada):** extender `bindingsFor()`/`ALIASES` en `engine/demo/main.ts` (y regenerar `assets/` con `npm run build:hub`) para asignar `Espacio→hardDrop/launch/flap/jump` según el juego, `↑→rotate` en puzzle, `C→hold`, `Z→rotateCCW`, y añadir botones táctiles por juego o un `tapActions` en `InputHost`. Añadir un test de bindings que recorra las teclas documentadas por juego: la suite actual valida la lógica pero no el mapeo del hub.
