# Auditoría de paridad — BATCH CONDUCCIÓN/ACCIÓN (7 juegos)

**Fecha:** 2026-11-27 · **Modo:** solo lectura (único archivo escrito: este documento).
**Juegos:** Defender, Double Dragon, Moon Patrol, Neon Nexus, Out Run, Paperboy, Pole Position.

## 0. Metodología y fuentes

- **Original:** commit de retirada del hub legacy `a8a8093` (`chore: retirar hub legacy tras paridad`); se usa su padre `0ee83c4` = `a8a8093^`. Verificado con `git show a8a8093^:games/<id>/script.js` para los 7 juegos (1564–1794 líneas cada uno) y sus `README.md`/`metadata.json`. El árbol `games/` ya no existe en `HEAD`.
- **Documentación histórica:** `docs/Arcade Hub — investigación completa.md` (fichas #8, #12, #19, #20, #21, #23, #24; bugs B1–B8) y `docs/investigacion-dificultad-variedad.md` (curvas declaradas, §5).
- **Migración:** `engine/src/games/<id>/game.ts` (412–926 líneas) y tests `engine/test/games-driving.test.ts`.
- **Capa de entrada real del hub:** `engine/demo/main.ts` (`ALIASES` líneas 53–68, `bindingsFor()` 111–123, `tapActionFor()` 125–134), `engine/src/input/bindings.ts` (7–19), `engine/src/input/host.ts` (52–64, 148–176). El `index.html`/`assets/` generados contienen la misma lógica (minificada: `t0()`/`d0`).
- **Motor:** `engine/src/game/contract.ts`, `core/simulation.ts` (`StepContext`), `input/actions.ts`, `render/camera.ts`, `sim/collision.ts`, `render/particles.ts`, `audio/manager.ts`, `store/achievements.ts`.
- **Modernas:** OutRun 2006 y Double Dragon Neon verificadas vía Wikipedia indexada con `ctx_index` + `ctx_search`. El resto se marca **conocimiento general (no verificado)**: `websearch` devolvió HTTP 402 y otros `ctx_index` URL fallaron con ECONNREFUSED.
- **Convención de severidad:** **P0** = juego injugable o mecánica central inalcanzable; **P1** = mecánica importante ausente/regresión clara; **P2** = detalle de fidelidad, estética o balance.

## 1. Resumen ejecutivo

| Juego | P0 | P1 | P2 |
| --- | --- | --- | --- |
| Defender | `hyperspace` y `nuclear` sin ninguna entrada; `bomb` sin teclado | logros, hit-stop/shake/partículas, meta-juego | terreno montañoso y edificios eliminados |
| Double Dragon | `punch`/`kick`/`combo` sin ninguna entrada: no se puede atacar | logros, FX, sin cooperativo | hitbox radial vs. caja original |
| Moon Patrol | `fireUp` sin ninguna entrada (↑ solo salta) | logros, FX | nivel cada 500 m vs. 2200 + 600/nivel |
| Neon Nexus | cartas, mejoras y tienda sin entrada: bucle se bloquea tras la 1.ª oleada | `wave preview` ausente; clic → proyectil direccional; **permanentes se resettean**; logros/FX | cartas repetidas al agotar pool |
| Out Run | `turbo` sin teclado ni táctil (B2 reaparece en el hub) | colores de rivales, FX, logros | proyección distinta; colinas/árboles por banda fija |
| Paperboy | — | carriles en ←→ en vez de ↑↓; obstáculos no se reciclan; logros/FX | tasa de suscripción y ventana de entrega |
| Pole Position | `turbo` sin teclado ni táctil | 2 vueltas en vez de 3; colores; curva dibujo ≠ física | clasificación 75 s vs. 35 s (adaptación documentada) |

**Hallazgo transversal P0:** las reglas están migradas, pero el hub no sabe mapear muchas acciones nombradas a teclado/mando/táctil. `bindingsFor()` solo resuelve los alias genéricos (`up`, `down`, `left`, `right`, `primary`, `confirm`); `tapActionFor()` solo conoce una lista corta. Los tests inyectan `InputFrame` directamente, por lo que no detectan el problema.

### 1.1 Acciones inalcanzables (análisis estático de `bindingsFor()` + `tapActionFor()` + `DEFAULT_GAMEPAD_BUTTONS`)

| Juego | Sin teclado | Sin ninguna entrada (teclado, mando ni tap) |
| --- | --- | --- |
| Defender | `bomb`, `hyperspace`, `nuclear` | `hyperspace`, `nuclear` (`bomb` sí en mando botón 1/B) |
| Double Dragon | `punch`, `kick`, `combo` | **`punch`, `kick`, `combo`** |
| Moon Patrol | `fireUp` | `fireUp` |
| Neon Nexus | `upgradeAtk`, `upgradeHp`, `upgradeSpd`, `card1..3`, `shop`, `buy*`, `closeShop` | **las 12 acciones de progresión** |
| Out Run | `turbo` | `turbo` (sí en mando botón 3/7, no en A) |
| Paperboy | — | — (pero ↑↓ no mapean a carril; ver §7) |
| Pole Position | `turbo` | `turbo` (sí en mando botón 3/7) |

Detalle: `Space` se resuelve al **primero** de `ALIASES.primary` registrado por el juego → `fire` en Defender/Moon Patrol/Neon Nexus, `throw` en Paperboy, **nada** en Double Dragon/Out Run/Pole Position. `ALIASES.primary` incluye `boost` pero **no** `turbo`, e `ALIASES.confirm` no incluye `punch`/`kick`/`combo`/`card*`. El `tapAction` por defecto (`primary`) no está registrado en Double Dragon, Out Run ni Pole Position → el toque en pantalla tampoco hace nada en esos juegos. Script de verificación (fuera del repo): `/tmp/opencode/audit-conduccion/reach.js`.

---

## 2. Defender

**Original (evidencia `a8a8093^:games/defender/script.js`):**
- Mundo de 6000 px, terreno procedural montañoso con `generateTerrain()`/`getTerrainHeight()`/`getGroundY()` (líneas 36–65, 141–175), cámara con suavizado, 10 humanos, radar, paracaídas.
- Cuatro armas: láser, bomba inteligente (`useSmartBomb()` 506), hiperspacio con 5 s de cooldown (`useHyperspace()` 536), bomba nuclear 1 por vida (`useNuclear()` 555); teclas Espacio/B/H/N (README v1.6).
- Enemigos lander/bomber/mutant con fases (793–970);mutante al perder humano (901–914); bombas del bombardero (927–938). Oleadas con `setTimeout` (B6, 1036–1088) y `Math.random`.

**Migrado (`engine/src/games/defender/game.ts`):**
- Constantes equivalentes (12–26), 10 humanos (129–140), `scheduleGame()` con generación+pausa (102–110) → **B6 corregido**; RNG `ctx.rng`, `ctx.progression` (276–290).
- Cuatro armas implementadas en lógica: `fire` 341, `bomb` 347, `hyperspace` 360, `nuclear` 368; fases del lander y abducción 425–470, bombas 480–505, rescate en paracaídas 512–548, radar en render (~610+), sub-pasos anti-tunneling 385–420.

**Faltantes / regresiones:**
- **P0.** `hyperspace` y `nuclear` no tienen enlace de teclado, mando ni tap; `bomb` solo mando (botón 1). De las 4 armas del original solo queda operativo el láser (y la bomba con mando). Evidence: `actions` en 273–275 vs. `ALIASES`/`tapActionFor`.
- **P1.** Logros del original (primera baja, 3 bombas, comandante, nuclear, hiperspacio, 5 oleadas) no conectados: `store/achievements.ts` existe pero ningún juego lo usa.
- **P1.** `hit`, `explode`, `smartBomb`, `nuke`, `rescue` se emiten, pero el hub no configura *emitters* de partículas ni hay servo de shake/hit-stop → el *game feel* del README no se reproduce (§9).
- **P2.** Terreno montañoso/editificios eliminados: `groundY` constante 400 y dibujo plano (~570–585) frente a `getGroundY(worldX)` original; el aterrizaje de humanos ya no varía con el relieve.

**Adaptaciones modernas:** (conocimiento general, no verificado) los shooters laterales actuales conservan el "mundo ancho + radar + rescate" pero sustituyen el terreno por capas parallax y añaden los cuatro poderes como *loadout* seleccionable entre oleadas.

**Funciones del motor que faltan:** enlaces por juego (§9.1); `camera` existe (`render/camera.ts`) pero no está registrada como servicio y ningún juego la usa (cámara manual en `state.cameraX`); FX/shake/hit-stop (§9.4); puente eventos→logros (§9.5).

---

## 3. Double Dragon

**Original (`a8a8093^:games/double-dragon/script.js`):**
- 4 actos, 5/7/8/10 enemigos, punk/thug/soldier, boss por acto con HP 80/120/160/250 (constantes 32–53, `spawnEnemies()` 104, `spawnBoss()` 128).
- Puñetazo Z, patada X, combo C (`attack()` 210–270); armas sword/bat/dynamite, vida 15%, cooldowns; daño del jugador 3 vidas.
- Bug B5 (D-pad táctil 80 ms) y B6 (`setTimeout` de 1500 ms para siguiente acto, también en pausa): research doc ficha #12.

**Migrado (`engine/src/games/double-dragon/game.ts`):**
- Constantes y curvas equivalentes (12–44), `scheduleGame()` con generación+pausa (85–92) → **B5 y B6 corregidos** (`isDown` en 331–337; transiciones 393–415).
- 4 actos con jefe, 3 tipos de enemigo, combos/armas/vidas (169–252), `progression` 261–273, `observe()` y eventos de juice.

**Faltantes / regresiones:**
- **P0.** No se puede atacar: `punch`, `kick` y `combo` no son alcanzables por teclado (Space no resuelve a ninguna acción del juego), mando (los botones A/B/X mapean a `primary`/`fire`/`bomb`…) ni tap (`tapAction='primary'` no registrado). El juego queda reducido a moverse hasta morir. Evidence: `engine/demo/main.ts` 53–68/111–134 y `actions` en 258–260.
- **P1.** Sin cooperativo local (metadata declara `players: [1]`) aunque el motor soporta `local`/`vsAI`; los logros (primera pelea, 2000 pts, boss final) no están conectados; sin hit-flash/shake reales (§9.4).
- **P2.** `attack()` usa `dist2 < range²` (225–229) en vez de la caja original `|dx| < range && |dy| < 30`: alcanza enemigos en diagonal que el original no alcanzaba.

**Adaptaciones modernas:** **verificado** — *Double Dragon Neon* (WayForward/Majesco, 2012; PS3/X360/PC/Switch; 1–2 jugadores; Billy y Jimmy; cinco escenarios; Yoshihisa Kishimoto, diseñador del original, como consultor; Wikipedia indexada). El sistema de "mixtapes" de habilidades es **conocimiento general no verificado**. Oportunidad: combos con cancel, *juggle*, co-op y progresión entre actos.

**Funciones del motor que faltan:** enlaces por juego y test de alcanzabilidad (§9.1); soporte explícito de *local co-op* en la capa de entrada (punteros/jugador 2); hit-stop por evento (§9.4).

---

## 4. Moon Patrol

**Original (`a8a8093^:games/moon-patrol/script.js`):**
- Buggy con salto, disparo adelante y disparo arriba con la misma tecla ↑ (ambigüedad documentada en research #19), gravedad 600, 3 tipos de enemigo (rover, UFO que dispara, cráter/mina), triple shot y rapid fire (constantes 30–43; `spawnEnemy()` 135–184; `updateGame()` 424–590).
- Nivel por distancia: `LEVEL_BASE_DIST = 2200`, luego `2200 + (nivel-1)*600`, bonus `500 + (45-tiempo)*10` (39, 433–447). Logros: triple kill, sin saltos, speed run.

**Migrado (`engine/src/games/moon-patrol/game.ts`):**
- Física y armas equivalentes (10–28, 231–277), spawns por patrones sembrados (`ctx.progression.nextPattern()` 118–155), power-ups 287–298, colisiones con `CollisionService`, bonus de tiempo 216–224, `progression` 161–173.

**Faltantes / regresiones:**
- **P0.** `fireUp` no tiene ninguna entrada: ↑/W se resuelve a `jump` (por el alias `up`), y no existe `fireUp` en `ALIASES` ni en el mapeo de mando. El disparo aéreo —una de las dos armas del original— es inalcanzable; además se conserva la ambigüedad ↑ sin haber fusionado ambas acciones.
- **P1.** Logros "triple kill", "sin saltos", "speed run" no conectados; FX (partículas/shake) ausentes en el hub.
- **P2.** Nivel cada **500 m** y distancia constante (27, 216) frente a 2200 m crecientes: ritmo de dificultad ~4–6× más rápido; `observe()` normaliza contra `500*3` (571), no contra la curva real.

**Adaptaciones modernas:** (conocimiento general, no verificado) remakes/remasters mantienen el doble plano de disparo (adelante/arriba) y sustituyen la distancia fija por sectores procedurales con bonus de tiempo y *night variants*.

**Funciones del motor que faltan:** enlaces por juego (§9.1), y una acción compuesta o *chord* (`jump+fireUp`) si se quiere conservar fielmente la tecla ↑; FX (§9.4); logros (§9.5).

---

## 5. Neon Nexus

**Original (`a8a8093^:games/neon-nexus/script.js`, 1794 líneas):**
- TD roguelike: torre automática, 17 cartas (`CARD_POOL` 123–181), 4 ítems de tienda permanente (`SHOP_ITEMS` 183–189), mejoras ATK/HP/Velocidad con teclas 1/2/3, clic = daño extra al enemigo más cercano (0,5×ATK, `clickAttack()` 914–925).
- Enemigos camuflados (necesitan Scanner) y voladores (oleada 6+), boss cada 5 oleadas, **wave preview** con composición de la próxima oleada (`getWavePreview()` 425–448, DOM 511–517), logros y `localStorage` (`neonNexus_coins`, `neonNexus_best`).

**Migrado (`engine/src/games/neon-nexus/game.ts`):**
- 17 cartas y 4 ítems declarados (26–45), `buildWave()` con boss/elite/camo/flying (206–238), tienda (420–448), cartas (454–456), clic direccional (521–531), oleadas y patrones (687–700), todo en estado determinista (sin DOM/localStorage en `step()`).

**Faltantes / regresiones:**
- **P0.** Las 12 acciones de progresión (`card1..3`, `upgradeAtk/Hp/Spd`, `shop`, `buyMaxHp`, `buyAtkBonus`, `buyStartShield`, `buyRegenBonus`, `closeShop`) no tienen teclado, mando ni tap. Peor aún: `step()` retorna mientras `offerPending` (452–457), por lo que tras la primera oleada la partida **se bloquea permanentemente** esperando una carta que nadie puede elegir. La tienda permanente también es inalcanzable.
- **P1.** No hay *wave preview* (el render solo muestra "OLEADA N", ~840–850): se pierde la telegrafía que la investigación considera necesaria para la variedad determinista.
- **P1.** El clic dejó de ser "daño instantáneo al enemigo más cercano" y pasó a ser un proyectil direccional de 0,8×ATK que puede fallar (521–531 vs. original 914–925). El **puntero virtual existe** (`ActionState.pointer`, `input/actions.ts` 8–17) pero solo lo usa `missile-command/game.ts`; aquí no se aprovecha.
- **P1.** La tienda ya no es permanente: `resetNexus()` reescribe `state.perm` a 0 (~185–190). El original persistía monedas y mejoras en `localStorage`; `store/` del motor podría hacerlo vía plugin fuera de `step()`, pero no está conectado.
- **P1.** Logros (primera sangre, oleadas 5/10/20, aniquilador, comprador) no conectados; sin hit-stop/shake.

**Adaptaciones modernas:** (conocimiento general, no verificado) tower-defense roguelikes actuales (p. ej. *Rogue Tower*, *Bloons TD 6* con paragons, y el draft de cartas tipo *Vampire Survivors*) mantienen el auto-ataque + oferta entre oleadas y añaden *rerolls*, sinergias y metaprogresión persistente.

**Funciones del motor que faltan:** UI/overlay de cartas y tienda con selección por actions (el shell tiene `openOverlay`, pero el juego no puede usarlo desde `step()`; haría falta un plugin de UI declarativa); enlaces por juego (§9.1); uso del puntero para apuntar; persistencia de metaprogresión vía `store/`; FX (§9.4).

---

## 6. Out Run

**Original (`a8a8093^:games/out-run/script.js`):**
- Carretera pseudo-3D: 300 segmentos × 12, `CAM_HEIGHT = 100`, `DRAW_DIST = 80`, proyección `scale = 300/relZ` (101–112), 5 tramos, curvas/colinas/árboles, 8 rivales con 5 colores (39, 89–99), turbo 2,5 s / 6 s, límite 75 s y +15 s por tramo (259–312).
- B2 confirmado en research #21: `Espacio` era pausa y `activateTurbo()` por teclado nunca se ejecutaba.

**Migrado (`engine/src/games/out-run/game.ts`):**
- Constantes y física equivalentes (10–25, 170–190), road sembrado (76–90), 8 rivales, turbo 163–168, tramos/patrones 191–207, colisiones por `CollisionService` 210–230, proyección propia en render 232–330.
- El comentario inicial afirma "B2 queda corregido: `turbo` y `pause` son acciones distintas".

**Faltantes / regresiones:**
- **P0.** La corrección es solo interna: en el hub `Space` no resuelve a `turbo` (`ALIASES.primary` no lo incluye) y `tapActionFor()` tampoco lo considera. El turbo sigue inalcanzable por teclado y táctil — es exactamente B2 en la capa de entrada; solo funciona con mando (botón 3/7, no el A que documentaba el README).
- **P1.** Sin sonido de motor/escudo, sin shake en colisión y sin logros (`ou_first_race`, `ou_high_scorer`, `ou_stage_clear`): eventos `crash`/`turbo`/`stage` emitidos pero sin consumidores visuales (§9.4).
- **P2.** Rivales todos rojos en render (~350) frente a la rotación de 5 colores del original. En el bucle de dibujo, `const seg = state.segments[b]` usa el índice de banda, no el segmento del mundo en `camZ + b*SEG_LEN`: colinas/árboles no se desplazan con la carretera. La proyección `t²` con 44 bandas no reproduce `CAM_HEIGHT`/`DRAW_DIST` (no verificado visualmente).

**Adaptaciones modernas:** **verificado** — *OutRun 2006: Coast 2 Coast* (Sumo Digital/Sega, 2006): modos OutRun/Heart Attack/Time Attack más cuatro nuevos, misiones "Coast 2 Coast", desbloqueables con "OutRun Miles", clases de coche y multijugador online de hasta 6 (Wikipedia indexada). Oportunidades: ramificación de rutas, lista de reproducción seleccionable, tableros y reactivación de la serie.

**Funciones del motor que faltan:** servicio de carretera/proyección (§9.3), enlaces por juego (§9.1), FX (§9.4), cámara expuesta como servicio (§9.2).

---

## 7. Paperboy

**Original (`a8a8093^:games/paperboy/script.js`):**
- 3 carriles con ↑/↓, lanzamiento →, casas suscritas (60 %) / no suscritas, 4 obstáculos (coche, camión, valla, perro) que se **reciclan** al salir por la izquierda (`generateObstacles()` 96–110, `updateGame()` 277–344), penalización −20 por fallo, días crecientes.

**Migrado (`engine/src/games/paperboy/game.ts`):**
- 3 carriles y lanzamiento con cooldown (247–255), entregas y penalizaciones AABB (263–300), 4 obstáculos (104–126), días con patrones y `progression` (169–186, 216–229), `safeLaneAhead()` con `PathfindingService` (130–160) como ayuda para la IA.

**Faltantes / regresiones:**
- **P1.** `actions` son `left`/`right` (169) y `step()` mueve carril con esas acciones (239–243). El hub mapea ←→ a `left`/`right`, pero ↑↓ a `up`/`down` (no registrados): **la documentación del original (↑↓) no coincide con el control real**, y el D-pad vertical del mando tampoco mueve de carril. Papers throw y lanes funcionan, pero con semántica cambiada.
- **P1.** Los obstáculos se eliminan al salir de pantalla (305–311) y solo se regeneran al cambiar de día; el original los reciclaba indefinidamente. Tras ~20 obstáculos el día queda sin presión.
- **P1.** Logros (primera entrega, 500 pts, 20 entregas perfectas) no conectados; `deliver`/`crash` sin partículas ni shake reales.
- **P2.** Tasa de suscripción 0,8 en patrón `mailbox` (91) frente al 0,6 fijo original; entrega por AABB sin la ventana `|scrollX-(h.x-GW)|<30` del original.

**Adaptaciones modernas:** (conocimiento general, no verificado) juegos de reparto actuales conservan los 3 carriles y añaden precisión/combos de entrega, casas especiales y tableros por día.

**Funciones del motor que faltan:** alias/remapeo por juego para corregir ↑↓ (§9.1); `spawn/recycle` declarativo (el original reutilizaba; hoy se rellenan casas pero no obstáculos); FX y logros (§9.4/§9.5).

---

## 8. Pole Position

**Original (`a8a8093^:games/pole-position/script.js`):**
- Vista cenital, 480×640, `QUALIFY_TIME = 35`, `RACE_TIME = 60`, **`totalLaps: 3`** (líneas 31–50, 77–78), 8 rivales con 8 colores, 8 pickups (turbo/invencibilidad), curvas por segmento (132–169), clasificación → posición de salida (511–524), vuelta limpia y campeón.

**Migrado (`engine/src/games/pole-position/game.ts`):**
- Igualdad de constantes salvo `qualifySeconds: 75` y **`raceLaps: 2`** (21–23; el comentario justifica solo los 75 s); rivales, pickups y curvas (115–161), turbo y colisiones (229–285), clasificación/vueltas (306–338), render 341+.

**Faltantes / regresiones:**
- **P0.** `turbo` no enlazado a teclado ni tap (idéntico a Out Run): `Space` no resuelve a `turbo`, y `tapAction` no está registrado. El original sí lo tenía en Espacio y en el botón A.
- **P1.** Carrera de **2 vueltas** frente a las 3 del original (23, 324): se acorta la mecánica principal y el ritmo de "vuelta limpia"/campeonato.
- **P1.** Colores de rivales todos rojos (render ~427) frente a los 8 del original; `bend()` del render (348–350) usa frecuencias distintas a `roadCurve()` de la física (112–118), así que la curva dibujada no coincide con la que empuja al coche; no hay sonido de motor, ni shake, ni logros (`pole_position`, `clean_lap`, `champion`).
- **P2.** 75 s de clasificación vs. 35 s (adaptación documentada para hacerla alcanzable): cambia la dificultad percibida, no una regresión.

**Adaptaciones modernas:** (conocimiento general, no verificado) arcade racers modernos tipo *Horizon Chase* / *OutRun 2* conservan clasificación + ladder de rivales y añaden fantasmas, time attack y tableros online. Puente natural con el servidor `server/` (lockstep) ya presente en el repo.

**Funciones del motor que faltan:** carretera/proyección compartida (§9.3), enlaces por juego (§9.1), FX (§9.4), logros (§9.5).

---

## 9. Funciones del motor que faltan (transversales)

### 9.1 Enlaces de entrada por juego (P0)
`GameDefinition.actions` declara *qué* existe, pero no *cómo se pulsa*. `bindingsFor()` (`engine/demo/main.ts` 111–123) solo prueba alias genéricos y `tapActionFor()` (125–134) una lista corta. Propuesta: campo declarativo `controls: { keyboard: Record<code, action>, gamepad?: …, tap?: action }` en `GameDefinition`, consumido por el host; test de "toda acción declarada es alcanzable por algún origen" y test de "teclas documentadas alcanzan su efecto" (el research doc ya lo pedía como mejora transversal #2). Sin esto, los tests `games-driving.test.ts` siguen en verde mientras el juego es injugable: inyectan `['punch']`, `['turbo']`, etc. directamente en `InputFrame`.

### 9.2 Cámara (P2)
`render/camera.ts` ofrece `createCamera()` con `follow`/`clamp`/`snapshot`, pero **ningún juego la usa** y no está registrada en `ServiceRegistry`. Defender lleva `cameraX` en el estado (correcto para determinismo) y la aplica a mano en render; Out Run/Pole Position calculan su propia proyección. Propuesta: plugin de cámara con estado instantáneo en snapshot (o servicio de render, manteniendo el suavizado dentro del estado del juego).

### 9.3 Carretera / proyección (P2)
No hay servicio de road/projection. Out Run y Pole Position duplican lógica de curvas, colinas, segmentos y perspectiva en `render()` con fórmulas distintas a las de `step()` (ver §6 y §8). Propuesta: `roadService` con `curveAt(z)`, `project(z, camera)`, `bandAt(z)` compartidos y deterministas; el render consume el mismo dato que la física.

### 9.4 Hit-stop, shake y partículas (P1)
El motor tiene `EventBus`, `eventFanoutPlugin`, `particlesPlugin` y `audioPlugin`, pero:
- `particlesPlugin` solo emite eventos con *emitter* configurado; el hub lo instancia sin `emitters` → **ninguna partícula aparece**.
- No existe ningún servicio de shake ni de hit-stop (búsqueda `shake|hitstop|trauma` en `engine/src` → solo el evento `freeze` de Neon Nexus).
- `DEFAULT_AUDIO_MAPPING` (`audio/manager.ts` 19–31) usa `gameover` en minúsculas, mientras los juegos emiten `gameOver`; tampoco hay reglas para `deliver`, `turbo`, `pickup`, `smartBomb`, `rescue`, `nuke`, etc. El matching es exacto.
Propuesta: `fxPlugin` declarativo (emitters por evento, shake con decaimiento derivado del tick, hit-stop en ticks vía `ctx.schedule`/clock) + mapping de audio por juego y corrección de mayúsculas.

### 9.5 Logros y persistencia (P1)
`store/achievements.ts`, `store/scores.ts` y `store/storage.ts` existen, pero ningún juego ni el hub los conecta. Los 7 juegos tenían logros y récords en `localStorage`; en la migración solo queda `score` en memoria. La tienda permanente de Neon Nexus es el caso más grave (§5). Propuesta: plugin observador de eventos que desbloquea logros declarados por juego y persiste metaprogresión fuera de `step()`.

### 9.6 Pruebas (P1)
`engine/test/games-driving.test.ts` verifica determinismo/dificultad/`observe()`/juice inyectando acciones directamente; `e2e/hub.spec.js` solo cubre la vitrina. No hay ningún test de teclado/mando/tap por juego, que es justamente donde están los P0.

---

## 10. No verificado / límites de esta auditoría

- **No se jugó** ningún título en navegador: la alcanzabilidad de entradas se deduce estáticamente de `engine/demo/main.ts` (y del `assets/` minificado generado por `build:hub`), no de una sesión real.
- La paridad visual (proyección de Out Run, curvas de Pole Position, terreno de Defender, colinas de Out Run) se comparó por código, no por capturas.
- El audio real (AudioContext) y la intensidad de partículas en el hub no se ejecutaron; el análisis es de configuración de plugins.
- Las referencias modernas de Defender, Moon Patrol, Neon Nexus, Paperboy y Pole Position son **conocimiento general sin verificar**: `websearch` devolvió HTTP 402 y `ctx_index` de otras URL falló con ECONNREFUSED. Solo OutRun 2006 y Double Dragon Neon están verificadas (Wikipedia indexada).
- Los IDs exactos de logros se toman de README/metadata; no se auditó uno por uno en el código original de los 7 juegos.
- No se comprobó si el hub publicado (`index.html`/`assets/`) está reconstruido de la revisión exacta de `engine/demo/main.ts`; el fragmento minificado coincide con `ALIASES`.

---

## 11. Prioridades recomendadas (P0 primero)

1. **Enlaces por juego** (§9.1): mapa `controls` en `GameDefinition` + host + test de alcanzabilidad.
2. **Double Dragon**: Z/X/C (o Space/A/B) → `punch`/`kick`/`combo`; sin esto no hay juego.
3. **Neon Nexus**: 1/2/3 → mejoras, tarjetas y tienda (incluir UI/overlay); desbloquear el bucle tras la oleada 1.
4. **Out Run y Pole Position**: Espacio/tap → `turbo` (B2 real en el hub).
5. **Defender**: H → `hyperspace`, N → `nuclear`, B → `bomb`.
6. **Moon Patrol**: ↑ → `jump + fireUp` (o tecla separada) para recuperar el disparo aéreo.
7. **Paperboy**: ↑↓ → carriles (y D-pad vertical).
8. **Pole Position**: `raceLaps` 3 (o documentar explícitamente la adaptación a 2).
9. **FX y audio** (§9.4) y **logros/persistencia** (§9.5) para recuperar el *game feel* del legacy.
10. **Carretera/cámara** (§9.2/§9.3): unificar física y render antes de añadir nuevos juegos de conducción.
