# Auditoría de paridad — BATCH LABERINTOS (8 juegos)

> 27-nov-2026 · Análisis **solo lectura**. No se modificó código; solo se escribe este documento.
> Juegos: Bomberman, Pac-Man, Q\*bert, Frogger, Dig Dug, Burger Time, Donkey Kong, Cell Swarm.

## 0. Metodología y fuentes

| Fuente | Uso y verificación |
| --- | --- |
| `docs/Arcade Hub — investigación completa.md` | Fichas §2, §22, §27, §14, §9, §4, §11, §5 y registro histórico B1–B8. Advertencia propia del doc (línea 233): las fichas no verificadas en código se apoyan en README/escaneo estático. |
| `docs/investigacion-dificultad-variedad.md` | Curvas previstas por juego (§5, líneas 44–77) y criterios de aceptación (§6, líneas 79–85). |
| `git show a8a8093^:games/<id>/script.js` y `README.md` | Original legacy. Confirmado con `git log --oneline \| grep 'retirar hub legacy'`: **`a8a8093`** = `chore: retirar hub legacy tras paridad`; su padre es **`0ee83c4`**. En el padre convivían `games/<id>/` y `engine/src/games/<id>/`: la retirada fue un borrado tras paridad, no la migración. Citas `script.js:NN` = número de línea del padre. |
| `engine/src/games/<id>/game.ts` | Implementación actual. Citas `game.ts:NN`. |
| `engine/src/{progression,game,core,input,sim,store,render}` | Semántica real de `progression.update/observe`, `handleLifecycle`, scheduler, bindings, puntero y plugins de juice. |
| `engine/test/games-maze.test.ts` | 41 tests (4 por juego: determinismo, subida de dificultad, `observe()` finito, evento de juice + prueba específica). Ejecutados: **41/41 en verde**. |
| Wikipedia (vía `ctx_index`+`ctx_search`, red disponible) | Alternativas modernas: *Bomberman Live: Battlefest*, *Pac-Man Championship Edition 2*, *Q\*bert*, *Frogger (series)*, *Dig Dug*, *BurgerTime*, *Mario vs. Donkey Kong*, *Agar.io*. |

Convención: **P0** = mecánica documentada inaccesible en el hub publicado; **P1** = regla del original cambiada de forma sustancial, progresión mal anclada o capacidad anunciada no implementada; **P2** = detalle de feel/presentación o desviación menor. **「No verificado」** = hipótesis sin contraste en código/fuente; tratar con cautela.

**Estado de los enlaces de entrada (importante).** La tabla de teclado del hub vive en `engine/src/ui/hub-model.ts` (`GAME_BINDINGS` en `:140-189`, `bindingsFor()` en `:231`, `tapActionFor()` en `:197`) y **está siendo modificada por otro agente en el árbol de trabajo** (`git diff` muestra `hub-model.ts` y `hub-model.test.ts` como sin confirmar). Los hallazgos de Control más abajo describen el árbol observado al auditar y deben revalidarse tras integrar ese cambio. El doc *puzzles.md §0.1* cubre el mismo frente transversal para su batch.

**Verificación de pureza:** `grep -E 'Math\.random|Date\.now|setTimeout|setInterval|document\.|window\.|performance\.now|innerHTML'` sobre los 8 `game.ts` → **0 coincidencias** (solo un comentario en `cell-swarm/game.ts:93`). `step()` usa `ctx.clock.dt`, `ctx.rng`, `ctx.emit`, `ctx.progression` y servicios; `render()` es dibujo puro del adaptador y no afecta al hash. B6 y B7 del legacy quedan resueltos con timers en estado / `simTime`.

---

## 0.1 Síntesis transversal

| Ítem | Severidad | Evidencia |
| --- | --- | --- |
| Enlaces de teclado/táctil incompletos para acciones específicas del batch (Q/E de Q\*bert, `eject`/`boost` de Cell Swarm, `Z` de Burger Time). Sujeto al cambio en curso en `hub-model.ts`. | **P0** (Q\*bert táctil, Cell Swarm) / **P1** (resto) | `hub-model.ts:140-189`, `:231-244`; `ACTION_LABELS` en `demo/main.ts:82-114`; gamepad `host.ts:53-56`. |
| Logros y récords del legacy desaparecidos: los módulos `store/scores.ts` y `store/achievements.ts` existen y están testeados, pero **ningún juego ni host los invoca** (`grep createScores/createAchievements` solo halla definiciones y tests). | **P1** (8/8) | `engine/src/store/{scores,achievements}.ts`; `git grep`. |
| `hazard` declarado y nunca consultado en 5 juegos (Bomberman, Pac-Man, Q\*bert, Dig Dug, Burger Time): la curva solo aplica `speed` global vía `dt`. | **P2** (5/8) | `grep 'state.hazard'` → 0 usos en esos archivos; usos reales en `frogger/game.ts:122`, `donkey-kong/game.ts:544,557`, `cell-swarm/game.ts:160,168`. |
| `GRID_SERVICE` (`sim/grid.ts:3-44`) existe pero ninguno de los 8 lo usa: todos acceden a sus grids en crudo. No es una función que falte; es infraestructura infrautilizada. | **P2** | `grep GRID_SERVICE` en `games/` → 0. |
| `PATHFINDING_SERVICE` sí existe y se usa en 3 juegos: `bomberman/game.ts:482`, `pac-man/game.ts:386`, `dig-dug/game.ts:331`. Carece de vecindad diagonal/isométrica para Q\*bert. | **P2** (extensión) | `sim/pathfinding.ts:6-27`, `NEIGHBORS` en `sim/grid.ts:26-30`. |
| `ctx.schedule()` existe (`core/simulation.ts:49`) pero los 8 usan timers numéricos en estado. Determinista; no falta infraestructura. | **P2** | `grep ctx.schedule` en `games/` → 0 en este batch. |
| `ctx.actions.pointer` (normalizado, `input/actions.ts:8,70-77`; inyectado por `input/virtual.ts:27-31`) existe y **Cell Swarm no lo usa**. Falta de adaptación, no función de motor ausente. | **P1** | `cell-swarm/game.ts:441-452`. |

---

## 1. Bomberman

**Original verificado (`0ee83c4:games/bomberman/script.js`)**
- Grid 13×11 con borde `SOLID`, patrón de muros pares y ladrillos aleatorios (`:30-58`, `:146-160`); puerta trasera bajo ladrillo en `(8,5)` (`:58`, `:159`).
- Bombas con temporizador 2.5 s, rango, rotura de ladrillos en cruz, **cadena de detonación** y drop de power-ups ≤3 por explosión (`:44-49`, `:257-346`).
- 5 power-ups: +1 bomba, +2 rango, +velocidad, FULL y **detonador** (`:348-405`); probabilidades `:349-355`.
- Enemios `balloon` (dirección aleatoria) y `oneal` (persigue por distancia de Manhattan), `2 + ⌊(nivel−1)/2⌋` hasta 6 (`:176-254`); 3 vidas, invulnerabilidad 2.2 s y respawn 1.2 s (`:425-448`).
- La puerta se abre solo al eliminar todos los enemigos (`:768`, `:775`); +500×nivel al limpiar, 100+10×nivel por enemigo (`:333`, `:508`).

**Migrado (`engine/src/games/bomberman/game.ts`)**
- Mismas constantes y generación (`game.ts:9-31`, `:121-142`), spawn y todos los power-ups (`144-164`, `209-234`), explosión en cruz + cadena + drops (`236-292`), puerta (`317-327`), vidas (`294-315`).
- `oneal` usa `pathfinding.greedyStep` con `manhattan` como fallback (`482-498`); colisión de explosión vía `collision.aabbOverlap` (`286-288`).
- `progression` 1/1.1/1.2 · 0/.2/.4, patrones `cross/corridor/rush`, DDA 300/0.08 (`333-344`) — **idéntico a la curva prevista** (`investigacion-dificultad-variedad.md:51`).

**Faltantes / regresiones**
- **P1** — Logros `bomberman_first_kill`, `bomberman_power_collector` y `bomberman_speed_demon` del legacy (`script.js:338,396-404,505`) no tienen equivalente ni wiring.
- **P2** — `hazard` y `spawnInterval` declarados (`game.ts:336-338`) pero no consultados en la lógica; solo `speed` escala `dt` (`:384`).
- **P2** — `cross`/`corridor`/`rush` sí alteran densidad/tipos de enemigos (`:123,149,159`), pero `observe()` no expone inmunidad/detonador; rango de sensor 8 floats (`:521-545`).
- **No verificado** — paridad de las tablas README del legacy (la ficha §2 ya advertía que faltaba).

**Adaptación moderna recomendada**
- *Bomberman Live: Battlefest* (2010, XBLA): hasta 8 jugadores online, equipos, arenas y power-ups (Wikipedia, `wiki-bomblive`). El motor ya declara `modes: ['solo','vsAI','demo']` (`game.ts:331`) pero `singlePlayerRules` es la única regla estándar (`game/rules.ts:10-18`): falta regla de victoria multijugador para acercarse a este modelo.

**Funciones del motor que faltan**
- Reglas de partida 1v1/equipos y service de poder compartido (no existe `rules` multijugador ni `score` de match). Grid y pathfinding sí están disponibles.

---

## 2. Pac-Man

**Original verificado (`0ee83c4:games/pacman/script.js`)**
- Laberinto 28×31, 244 puntos, 4 fantasmas con IAs distintas, túnel con wrap, 3 vidas (`:37-43`, `:84-117`, `:295-299`).
- Schedule scatter/chase `[7,20,7,20,5,5,5]` con inversión de dirección y pausa durante fright (`:59-60`, `:374-390`); Cruise Elroy con umbrales 20/10 puntos y velocidades 84/88 (`:51-52`, `:448-466`); release por puntos 30/60 (`:54-58`, `:415-433`).
- targets: Blinky=jugador, Pinky=4 casillas delante **con bug de desbordamiento hacia arriba**, Inky=vector doblado desde Blinky, Clyde=tímido (`:589-614`); fright 6 s, combo 200/400/800/1600 y pausa de 1 s al comer fantasma (`:46-47`, `:616-639`, `:627`).
- Frutas a 70 y 170 puntos (100…1000 pts), vidas extra a 10.000/20.000 (`:61-71`, `:561-587`, `:1160-1168`).

**Migrado (`engine/src/games/pac-man/game.ts`)**
- **Mismo maze byte a byte** verificado (31 filas idénticas a `script.js:87-117`, `game.ts:37-67`); mismas constantes y schedule (`:9-34`, `:448-464`); 4 IAs y bug de Pinky conservados (`:321-340`, `:325-330`); Cruise Elroy y release (`:363-368`, `:304-318`).
- Frutas, combos, vidas extra, túnel y muerte diferida (`:466-513`, `:594-617`); `pathfinding.greedyStep` para volver a casa con ojos (`:386-392`).
- `progression` 1/1.08/1.16/1.25 · 0/.1/.2/.3, patrones `chase/scatter/ambush`, DDA 400/0.08 (`:519-531`) = previsto (`investigacion-dificultad-variedad.md:52`). El patrón `ambush` cambia el objetivo de Pinky de 4 a 5 casillas (`:326`) — variante nueva, no del original.

**Faltantes / regresiones**
- **P1** — Logros `pacman_twothousand`, `pacman_fruit`, `pacman_ghostbusters` (`script.js:743,574,626`) y récord local sin wiring.
- **P1** — `winGame()` original (`script.js:737-755`) terminaba la partida al vaciar el laberinto; ahora se encadena nivel infinito (`game.ts:620-627`). Es una decisión moderna razonable, pero **cambia el contrato de victoria** documentado; marcar como adaptación, no corregir a ciegas.
- **P2** — `hazard` y `spawnInterval` declarados pero sin uso; la dificultad real solo escala `dt`.
- **P2** — `render()` propio del juego (`game.ts:701+`) duplica presentación que el hub debería derivar de eventos; no afecta al determinismo.

**Adaptación moderna recomendada**
- *Pac-Man Championship Edition 2* (2016, PS4/Windows/Xbox One; `CE2 Plus` con co-op 2P): mazes que cambian al comer puntos, **ghosts que aguantan hasta 3 golpes** y estado *Angry*, estela de fantasmas (Wikipedia `wiki-pmce2`). Ideas importables como patrones `chase/scatter/ambush` más un cuarto patrón `angry`, sin tocar `step()` puro.

**Funciones del motor que faltan**
- Service de eventos de nivel (`levelStart/levelUp` ya se emiten) para que el hub pueda cambiar el maze y la paleta por nivel; no hace falta uno nuevo para la lógica.

---

## 3. Q\*bert

**Original verificado (`0ee83c4:games/qbert/script.js`)**
- Pirámide `k=0..6` (28 cubos), coordenadas isométricas y `inPyramid` (`:30`, `:79-98`); cada aterrizaje pinta el cubo (+25) y se completa al pintar los 28 (`:190-199`, `:96-98`, `:293-303`).
- **Diagonales Q/E/A/D** = ↖/↗/↙/↘; salirse del borde hace caer y quitar una vida (`:202-234`, `:254-258`); salto 0.22 s y turbo ⚡ ×2 durante 8 s (`:243-245`, `:277-280`).
- Huevo tras 10 saltos → Coily eclosiona en 4 s (`:231-233`, `:335-351`); Slick/Sam (0, 1 o 2 según nivel) revierten cubos y se aplastan por +500 (`:353-385`); fontana elimina Coily (+1000) y tirarlo fuera +1500 (`:269-276`, `:387-395`).
- +1000+500×nivel por nivel; 3 vidas (`:164-169`, `:125`).

**Migrado (`engine/src/games/qbert/game.ts`)**
- Misma geometría y reglas (`game.ts:8-22`, `:118-152`, `:345-400`), incluyendo huevo a 10 saltos, Slick/Sam, fontana, turbo y scoring (`:199-247`, `:370-383`).
- `progression` 1/1.1/1.25 · 0/.2/.4, patrones `cube/coil/sam` (`:406-417`) = previsto (§5, línea 68). Patrón `sam` fuerza 2 Slick (`:207`).
- 41 tests del batch cubren pirámide de 28 cubos y huevo (`games-maze.test.ts:101-112`).

**Faltantes / regresiones**
- **P0 (sujeto al cambio en curso)** — Controles: el hub enlaza las diagonales a **flechas/WASD** (`hub-model.ts:181-188`) y no enlaza **Q ni E**, que son los documentados en el README legacy (`script.js` README:9) y en la ficha §27. A/D sí funcionan como ↙/↘. Además `tapActionFor()` cae a `game.actions[0]` (`hub-model.ts:197-205`) = solo `upLeft`: **3 de 4 diagonales inaccesibles por táctil**. Revalidar tras integrar `hub-model.ts`.
- **P1** — Logros `qbert_perfect_level`, `qbert_coily_catcher`, `qbert_speed_cuber` (`script.js:298-299,272-274,294-297`) sin wiring.
- **P2** — `hazard` y `spawnInterval` declarados pero sin uso; `inv` tras muerte 2.2 s vs 1.2 s al inicio (`:136`, `:189`) — «No verificado» si es intencional.
- **P2** — Vecindad isométrica propia en `HOPS` (`game.ts:86`); `PATHFINDING_SERVICE` solo ofrece 4 vecinos ortogonales (`sim/grid.ts:26-30`).

**Adaptación moderna recomendada**
- *Q\*bert: Rebooted* (anunciado 2014, Steam/iOS/Android y consolas 2015-16) y el remake 3D de 1999 (Wikipedia `wiki-qbert`): conservar la pirámide y añadir capas/rotación de cámara como variante visual, manteniendo el grid lógico actual.
- Alternativa barata: aceptar **Q/E además de flechas** y un D-pad táctil de 4 diagonales; es la mejora que ya pedía la ficha §27.

**Funciones del motor que faltan**
- Pathfinding con vecinos diagonales/grafo arbitrario (para pirámides), y soporte de **múltiples acciones táctiles por juego** (`InputHost` solo tiene un `tapAction`, `input/host.ts:30,123`).

---

## 4. Frogger

**Original verificado (`0ee83c4:games/frogger/script.js`)**
- 15 carriles: meta, pasto, 5 río (2 troncos, 2 tortugas, 1 cocodrilo), pasto, 5 carretera (camión lento/largo, auto, race car rápido/angosto), pasto, salida (`:37-78`); 5 zonas seguras, vidas extra a 10.000/20.000 y bonus 10 pts×segundo (`:44-46`, `:398-425`, `:465-477`).
- Tortugas con ciclo de inmersión calculado con **`Date.now()/1000` (B7)** (`:252-254`); cocodrilo con boca que se abre/cierra y mata, transporte sobre troncos/tortugas y muerte al salir del borde (`:262-265`, `:486-509`).
- Timer global de 60 s (`:46`), bonus items mosca 200 / mariposa 100 / serpiente muerte con tipo aleatorio ponderado (`:231-249`).
- **Incoherencia documental verificada:** el README v1.7 afirma «timer global por nivel (no resetea por vida)» (README:62), pero `resetFrog()` lo reinicia al reaparecer (`:274`, llamado desde `loseLife()` `:331`).

**Migrado (`engine/src/games/frogger/game.ts`)**
- Mismos 15 carriles y constantes (`game.ts:8-44`); obstáculos y cocodrilos (`121-183`); colisiones, goals y bonus (`264-341`).
- **B7 resuelto**: `submerged(obstacle, time)` usa `state.simTime` (`:239-244`), incrementado en `step()` (`:414`); test explícito en `games-maze.test.ts:115-126`.
- `progression` 1/1.08/1.18 · 0/.15/.3 con `hazard` aplicado a la velocidad de carril (`:122,128`) y patrón `car` sumando un vehículo (`:130`); `pointsPerLevel: 5` = 5 goals por nivel (`:372-383`).

**Faltantes / regresiones**
- **P1** — Logros `frogger_thousand`, `frogger_hero`, `frogger_collector` (`script.js:318-320,404,390`) y récord sin wiring.
- **P2** — El tipo de bonus ya no es aleatorio ponderado: `kinds[i % 3]` (`game.ts:171-179`) frente a `:239` del legacy. Menos variedad, cuando el doc de dificultad pide «bolsa sembrada + veto» (§3).
- **P2** — Se conserva el reinicio del timer por vida (`game.ts:190`), contradiciendo el README v1.7; herencia del legacy, no regresión nueva.
- **P2** — `isCrocDangerous` requiere `type === 'croc'` (`game.ts:245-247`): los troncos con `hasCroc` solo animan la boca, igual que en el legacy (`:262-265`). Sin cambio.

**Adaptación moderna recomendada**
- *Frogger 2* (XBLA 2008), *Frogger Returns* (2009), *Frogger: Hyper Arcade Edition* (2012) y *Frogger in Toy Town* (2019, Apple Arcade) — Wikipedia `wiki-frogger-series`. Para el motor: patrones `log/turtle/car` ya existen; añadir un cuarto patrón `croc` y DDA que acorte huecos entre plataformas (hoy solo escala velocidad) sin romper `simTime`.

**Funciones del motor que faltan**
- `ctx.actions.pointer` no es necesario aquí; sí sería útil un **servicio de "carril/grid temporal"** (fila, columna, tiempo) para bots BFS, recomendado por la ficha §14. Hoy cada juego hace su propio `frogRow()`.

---

## 5. Dig Dug

**Original verificado (`0ee83c4:games/digdug/script.js`)**
- Grid 20×22, 3 filas libres arriba/2 abajo, rocas en pares y área de spawn despejada (`:37-42`, `:115-152`).
- Pooka y Fygar alternos, `2 + wave` hasta 6; Pooka se disfraza de hongo cada 4-8 s, quieto y revertable con proximidad ≤2 o bomba (`:175-204`, `:586-603`); Fygar escupe fuego en línea 4 casillas con p 0.02 (`:655-668`).
- Inflado en 13 pasos de 0.08 con `PUMP_RATE 0.12`; +1000 Pooka / +2000 Fygar (`:43-46`, `:490-550`). Enemigos solo por túneles vacíos (`:628-653`, change v1.6).
- Rocas caen si debajo hay hueco, aplastan enemigos **y al jugador** (`:672-733`); frutas con timer 8 s y +500 (`:206-213`, `:734-738`).
- **B6**: siguiente oleada vía `setTimeout(...,600)` (`:533-537`).

**Migrado (`engine/src/games/dig-dug/game.ts`)**
- Grid, spawn, disfraz, inflado, fuego, rocas y frutas equivalentes (`:75-146`, `:148-162`, `:226-301`, `:303-380`, `:382-443`).
- **B6 resuelto**: `state.waveTimer += dt` y umbral `waveDelay: 0.6` en `step()` (`:490-510`, constante `:21`); test `games-maze.test.ts:131-155` lo comprueba.
- `pathfinding.greedyStep` para perseguir por túneles (`:331-344`); colisión de rocas con `collision.aabbOverlap` (`:410-417`).
- `progression` 1/1.1/1.25 · 0/.2/.4, patrones `tunnel/rock/chase` (`:449-460`) = previsto (§5, línea 60); `chase` añade dirección aleatoria (`:345`).

**Faltantes / regresiones**
- **P1** — Logros `digdug_thousand`, `digdug_rock`, `digdug_deep` (`script.js:248,290,301`) y récord sin wiring.
- **P2** — **Código muerto**: en `:248-252`, `isEmpty(nc,nr)` y `isDirt(nc,nr)` son mutuamente excluyentes, así que `state.score += 1` y el evento `'dig'` nunca se emiten. El legacy solo tenía sonido `pDig()` (`:72`, `:486`); aquí se perdió el juice de excavación.
- **P2** — `hazard`/`spawnInterval` declarados y sin uso; `waveDelay` fijo 0.6.
- **P2** — `+1000` por limpiar oleada (`game.ts:501`) no existía en el legacy (`pWaveClear()` solo audio, `:102`, `:302`): mejora nueva, documentar.

**Adaptación moderna recomendada**
- *Dig Dug Deeper* (remake 3D, Infogrames/Atari, 2001) y *Dig Dug: Digging Strike* (DS, 2005), con *Dig Dug Island* (MMO 2008) como referencia de escala online — Wikipedia `wiki-digdug`. Importable: más de un tipo de roca y oleadas con **patrones anunciados**, no solo `tunnel/rock/chase`.

**Funciones del motor que faltan**
- Ninguna bloqueante: grid + pathfinding + scheduler disponibles. Sugerencia P2: helper `digCeiling`/`fallingBody` compartido si se replica en otro juego de terraforming.

---

## 6. Burger Time

**Original verificado (`0ee83c4:games/burger-time/script.js`)**
- 5 plataformas con 2 huecos aleatorios por plataforma y **5 ingredient×4 plataformas = 20** (`:24-41`, `:86-112`); escaleras en el primer hueco (`:130-132`).
- Caminar sobre un ingrediente lo hace caer a la plataforma inferior (`:350-377`); hamburguesa completa cuando los 5 tipos están aterrizados y alineados <20 px (+200) y al vaciar todos los ingredientes sube de nivel (`:379-416`).
- 3 enemigos (hotdog 35 / pickle 25 / egg 30, +3×nivel) patrullan y suben escaleras con p 0.005 (`:42-46`, `:113-127`, `:418-435`); pimienta **3 usos**, congela 3 s en la misma plataforma y <50 px (`:283-291`).
- 3 vidas, −50 puntos al ser tocado y stun 1 s (`:437-443`).
- **B5**: el D-pad táctil usa `setTimeout(...,80)` para soltar teclas (`:235-247`).

**Migrado (`engine/src/games/burger-time/game.ts`)**
- Plataformas, ingredientes, cascada, completado de burgers, pepper y enemigos equivalentes (`:8-34`, `:86-139`, `:175-219`, `:264-370`).
- `progression` 1/1.1/1.22 · 0/.2/.4 y patrones `ingredient/enemy/pepper` (`:225-236`) = previsto (§5, línea 74). Los patrones son reales: +1 bunBot (`:112-123`), +1 enemigo (`:127`) y +1 pimienta (`:148`).
- B5 desaparece: todo es `ctx.actions.isDown/consume`, sin `setTimeout`.

**Faltantes / regresiones**
- **P1** — **Anclaje de progresión incorrecto**: `state.progress++` **por hamburguesa** (`:206`) con `pointsPerLevel: 1` (`:232`), mientras `state.level++` ocurre solo al vaciar los 20 ingredientes (`:212-216`). La dificultad del motor sube ~4× más rápido que el nivel del juego y se satura en el nivel 1; el doc prevé «nivel (cada 1)». Debería ser `state.progress = state.level` como en los otros 7 juegos.
- **P1** — Logros `bt_first_cook`, `bt_high_scorer`, `bt_speed_cook` (`script.js:166-168`) y récord sin wiring.
- **P2** — `ENEMY_TYPES[kind].score` (`:28-31`) es configuración muerta: los enemigos no se pueden eliminar (solo aturdir), igual que en el legacy.
- **P2** — `hazard`/`spawnInterval` sin uso.

**Adaptación moderna recomendada**
- *BurgerTime World Tour* (2011, XBLA/PSN; WiiWare 2012) y *BurgerTime Party!* (2019, Switch, con nuevos modos) — Wikipedia `wiki-burgertime`. El patrón `pepper` ya es una primitiva moderna barata; extender a un cuarto patrón `chain` (ingredientes en cascada) encaja con el doc de variedad.

**Funciones del motor que faltan**
- No falta motor; sobra configuración muerta. Corregir el anclaje de `progress` y, si se quiere elimination de enemigos, subir la regla a un helper compartido (no existe hoy).

---

## 7. Donkey Kong

**Original verificado (`0ee83c4:games/donkey-kong/script.js`)**
- 6 plataformas y 4 escaleras (`:41-56`); salto con coyote 0.1 s, buffer 0.12 s, altura 3.2 tiles y gravedad de caída ×1.8 (`:61-67`, `:608-665`).
- 4 fases arcade rotativas por nivel — Barriles (25 m), Fuego (50 m), Elevador (75 m), Construcción (100 m) — (`:74-84`, `:286-288`); barriles con física y rebote en bordes (`:751-834`).
- Fase Construcción: girder con hueco central aleatorio, power-up martillo 4.5 s y 100 pts por barril destruido (`:410-472`, `:779-799`); temporizador 60 s por nivel (`:30`, `:548-558`).
- README:11-21 documenta ←/→ mover y **Espacio/↑/W saltar** (misma tecla para subir y saltar); la ficha §11 pedía separarlos «por verificar».

**Migrado (`engine/src/games/donkey-kong/game.ts`)**
- Plataformas/escaleras, fases, barriles, fuego, elevadores, girder y martillo equivalentes (`:36-50`, `:136-172`, `:316-382`, `:384-483`).
- **Acciones separadas**: `actions` incluye `jump` **y** `up` (`:488`); en el hub, Espacio→`jump` y ↑/W→`up` (`hub-model.ts:207,209`). Resuelve la ambigüedad que la ficha marcaba como pendiente.
- `progression` 1/1.1/1.22 · 0/.2/.4, patrones `barrel/fire/spring` (`:489-500`) = previsto (§5, línea 59). `hazard` y `pattern` acortan el intervalo de barriles (`:544,557`); `observe()` incluye peligros (`:586-596`).

**Faltantes / regresiones**
- **P1** — Logros `dk_hammer`, `dk_first_win`, `dk_first_floor`, `dk_five_thousand` (README:37-43) y vidas/puntaje persistidos sin wiring.
- **P2** — `loseLife()` rehace `setupPhase()` (`game.ts:196`), que vuelve a elegir patrón (`ctx.progression.nextPattern()`, `:137`); el legacy solo reiniciaba entidades (`script.js:290-300`). Cambio de variante tras muerte: «No verificado» si es deseable.
- **P2** — `state.timeLeft = Math.max(30, state.timeLeft)` al morir (`:197`) no tiene equivalente exacto en el legacy (`:548-558` solo resetea al completar nivel).
- **P2** — `gapX` se recalcula **cada tick** con `ctx.rng.next()` (`:468`), igual que en el legacy con `Math.random()` (`:440`): ahora es determinista, pero el hueco «parpadea». Heredado, no regresión.

**Adaptación moderna recomendada**
- *Mario vs. Donkey Kong* (GBA 2004; **remake Switch 16-feb-2024**, puzzle-platform, Nintendo Software Technology) — Wikipedia `wiki-mvdks`: mantiene escaleras + peligros rodantes pero sustituye el cronómetro por puzles cortos. Para el hub: un cuarto patrón `spring` ya declarado puede materializarse como plataformas elásticas; no requiere cambiar `step()`.

**Funciones del motor que faltan**
- Ninguna bloqueante. Opcional P2: servicio de **física de plataformas/AABB** reutilizable (hoy `updatePlayer` y `updateBarrels` duplican resolución de superficies, `game.ts:212-314` vs `:327-381`).

---

## 8. Cell Swarm

**Original verificado (`0ee83c4:games/cell-swarm/script.js`)**
- Mundo 5000×5000, 600 comidas, 20 bots con 5 personalidades, 8 virus (masa 120) y 15 chasers (`:34-54`, `:414-454`).
- División en 2 con `SPLIT_MIN_MASS 36`, proyecto a 600 u/s, máximo 4 células, merge a los 5 s (`:42-44`, `:824-857`); eyección de 5 masa a 250 u/s (`:45`, `:859-888`); boost ×1.8 consumiendo 8 masa/s (`:48-49`, `:1200-1218`).
- Comer exige masa ≥1.15× la presa y solapamiento de radios (`:600-607`); virus divide en 3+1 piezas por encima de 0.9×120 (`:745-779`); chasers huyen y dan ×3 con boost (`:781-802`); **mass decay** 1.5 %/tick por encima de 12 (`:804-818`).
- **Apuntado con puntero/ratón/dedo**: `state.targetX/targetY` se convertían a coordenadas de mundo en `doSplit()`/`doEject()` (`:834-841`, `:867-874`) y `moveCell` seguía ese objetivo (`:566-595`).
- **B6**: 5 `setTimeout` de reaparición (`:658-663`, `:696-701`, `:735-740`, `:793-798`, `:1256-1261`). README v1.6 anuncia «border kill», pero el código **solo hace clamp** en `:586-587`: **afirmación no verificada en código**.
- Skins (banderas/emoji/degradados `:250-332`), ranking de 10 células y 6 logros (README:37-52).

**Migrado (`engine/src/games/cell-swarm/game.ts`)**
- Constantes y población equivalentes (`:7-27`, `:158-177`); comer, virus, chasers y decay (`:280-389`); split/eject/merge y boost (`:437-541`).
- **B6 resuelto**: `state.timers[]` en ticks, sin `setTimeout` (`:93-94`, `:301,325,350,382,510,545-554`); comentario explícito en `:93`.
- `progression` 1/1.1/1.25 · 0/.2/.4, `pointsPerLevel: 100`, patrones `split/eject/hunt` (`:395-405`) = previsto (§5, línea 75); `hazard` añade virus (`:168`).
- Igual que el legacy, las células se **clampan** al borde (`:201-202`), no mueren.

**Faltantes / regresiones**
- **P0 (sujeto al cambio en curso)** — **`eject` y `boost` sin enlace de entrada**: en `hub-model.ts:207-220` Espacio resuelve a `split` (primera acción registrada de la lista) y no hay candidato para `KeyE` ni `ShiftLeft`; `tapActionFor()` devuelve `split` y el tap tampoco ofrece eject/boost; en gamepad el botón 0 da `split` y el 1 da `eject` (`host.ts:53-54`), pero `boost` no tiene botón. Es el núcleo del juego (README:15-23) inaccesible por teclado/táctil. Revalidar tras integrar `hub-model.ts`.
- **P1** — **Apuntado con puntero perdido**: `step()` deriva `targetX/targetY` de las teclas de dirección a 400 u delante (`:441-452`); sin dirección pulsada, `normalize2(0,0)` deja `split`/`eject` con velocidad 0 (`:469-472`, `:478-483`). El motor **sí expone** `ctx.actions.pointer` (`input/actions.ts:8,70-77`; `input/virtual.ts:27-31`): hay que usarlo para recuperar el mouse/táctil del original.
- **P1** — **`gained` no se reinicia al subir de nivel**: `resetGame()` lo pone a 0 (`:182`), pero `startLevel()` (`:158-177`) no lo toca; el umbral `gained >= (level+1)*100` (`:565`) se alcanza cada vez más rápido en niveles superiores. Debería residir en `state` y resetearse por nivel.
- **P1** — Logros `cellswarm_first_kill/hunter/splitter/...`, skins, ranking y récord de masa sin equivalente ni wiring.
- **P2** — «Border kill» del README no implementado ni en legacy ni en la migración (clamp en ambos): **no verificado como mecánica real**.
- **P2** — `hazard` sí se usa (`:160,168`), pero `spawnInterval` no; los 20 bots y 15 chasers son fijos.

**Adaptación moderna recomendada**
- *Agar.io* (Valadares/Miniclip, 2015; iOS/Android 7-8 jul 2015): mismo bucle de «comer células más pequeñas, dividirse para cazar, evitar las grandes» y popularizó el género .io (Wikipedia `wiki-agar`). Recomendación concreta: **el `ctx.actions.pointer` ya existente** para recuperar el control con ratón/dedo y patrones `split/eject/hunt` para telegrafiar presión; el modo online del servidor (`server/` lockstep) encaja con el MMO de referencia.

**Funciones del motor que faltan**
- No falta un servicio de puntero (existe). Falta **documentar/exponer acciones analógicas por juego** en la definición (`defineGame.actions` solo `string[]`, `game/contract.ts:31`) y el **reset de contadores por nivel** (responsabilidad del juego). Para skins/ranking haría falta un servicio de presentación por entidad, hoy resuelto con eventos.

---

## 9. Resumen ejecutivo

1. **Todos los juegos migraron con pureza verificada**: 0 usos de `Math.random`/`Date.now`/`setTimeout`/DOM en `step()`, 41/41 tests del batch en verde.
2. **P0 — Cell Swarm**: `eject` y `boost` sin enlace de teclado/táctil/gamepad; parte central del juego inaccesible (`hub-model.ts:207-220`, `game.ts:394`). Sujeto al cambio en curso en `hub-model.ts`.
3. **P0 — Q\*bert**: Q/E no enlazados y el tap táctil solo alcanza `upLeft`; 3 de 4 diagonales inaccesibles (`hub-model.ts:181-188,197-205`). Sujeto al cambio en curso.
4. **P1 — 8/8 juegos**: logros y récords del legacy no conectados (los módulos `store/scores.ts` y `store/achievements.ts` existen, pero nadie los invoca).
5. **P1 — Burger Time**: `progress` sube por hamburguesa, no por nivel; la curva de dificultad se agota en el nivel 1 (`game.ts:206,212-216,232`).
6. **P1 — Cell Swarm**: puntero ignorado (`game.ts:441-452`) aunque `ctx.actions.pointer` existe; y `gained` no se reinicia por nivel (`:158-177` vs `:565`).
7. **P1 — Bomberman/Pac-Man/Q\*bert/Frogger/Dig Dug/Burger Time/Donkey Kong**: change de contrato secundario (win infinito en Pac-Man, separación ↑/salto en DK, timers ya deterministas en Frogger/Dig Dug) documentado, no corregible a ciegas.
8. **P2 — 5/8 juegos**: `hazard` declarado sin uso; DDA solo escala `dt` (Bomberman, Pac-Man, Q\*bert, Dig Dug, Burger Time).
9. **P2 — Dig Dug**: evento `'dig'` y +1 punto son código muerto por condición contradictoria (`game.ts:248-252`). Frogger pierde variedad de bonus (`:171-179`).
10. **Alternativas modernas verificadas con fuente**: Bomberman Live: Battlefest, Pac-Man CE2, Q\*bert Rebooted, Frogger 2/Returns, Dig Dug Deeper, BurgerTime World Tour/Party!, Mario vs. Donkey Kong (2024) y Agar.io; todas con URL en §0 y cita por juego.
