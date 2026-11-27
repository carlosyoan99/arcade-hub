# Auditoría de shooters del Arcade Hub (8 juegos) — solo lectura

**Fecha:** 2026-11-27. **Alcance:** Asteroids, Centipede, Galaga, Gradius, Raiden, Space Invaders, Tempest, Missile Command.
**Método:** sin cambios de código. Se consultaron `docs/Arcade Hub — investigación completa.md` (§6, fichas 1/6/15/16/18/28/30/31) y `docs/investigacion-dificultad-variedad.md` (§5); el legacy borrado en `a8a8093` se recuperó con `git show a8a8093^:games/<id>/script.js` y `.../README.md` (padre = `0ee83c4`); la migración se leyó en `engine/src/games/<id>/game.ts`.

**Convenciones de evidencia**
- `script.js:NN` = número de línea del fichero legacy recuperado de git (no existe ya en el árbol de trabajo).
- `game.ts:NN` = número de línea de la implementación actual.
- Las citas web proceden de páginas indexadas con `ctx_index` + `ctx_search`: Wikipedia de los ocho originales y de *Space Invaders Infinity Gene*, *Tempest 2000*, *Gradius V*, *Raiden V*; *Centipede: Infestation* / *Centipede Chaos* se verificaron desde el artículo de Centipede. **No verificadas:** *Asteroids Redux* y *Galaga Wars* (Wikipedia devolvió 404 y el buscador web falló con HTTP 402) → se marcan explícitamente como "conocimiento general, sin fuente verificada". *Missile Command Delta* tampoco se verificó; el análisis de ciudad/multiplicador se apoya en el artículo de Wikipedia del original.
- P0 = rompe la identidad del juego · P1 = importante · P2 = mejora.
- "Regresión" = el legacy sí lo tenía y la migración no; "brecha heredada" = tampoco estaba en el legacy (no es culpa de la migración).

## Resumen de hallazgos P0

| Juego | P0 | Naturaleza |
| --- | --- | --- |
| Galaga | Formación que no oscila: la posición se reinicia a `homeX` cada tick | **Regresión** (`game.ts:642`) |
| Gradius | `Espacio` con medidor en 0 regala SPD (+100 pts) | **Regresión** (`game.ts:138-151` vs `script.js:195`) |
| Asteroids | No existen los platillos voladores (ni en legacy ni en migración) | Brecha heredada, identidad arcade |
| Missile Command | Todas las ciudades se restauran cada oleada; no hay ciudades bonus ni multiplicador | Brecha heredada, identidad arcade |

---

## 1. Asteroids

**Mecánicas originales verificadas**
- Nave con rotación, empuje, inercia, fricción, tope de velocidad y `wrap` con margen: `script.js:45-51`, `script.js:128-131`, `script.js:492-528`.
- Asteroides grandes → medianos → pequeños, radios 45/25/13 y puntos 20/50/100: `script.js:57-61`, `script.js:136-151`, `script.js:177-194`.
- Disparo con dispersión aleatoria y herencia de velocidad de la nave, cadencia 0.15 s: `script.js:199-212`.
- Hiperspacio con teletransporte aleatorio, 5 s de enfriamiento y 1.5 s de invulnerabilidad: `script.js:479-490`.
- 3 vidas, 2 s de invulnerabilidad al morir, reaparición en el centro: `script.js:53`, `script.js:63`, `script.js:443-457`.
- Anti-tunneling por sub-pasos para balas rápidas: `script.js:530-576`.
- Oleada nueva al vaciar el campo, con número de asteroides creciente con la puntuación: `script.js:165-175`, `script.js:554-558`, `script.js:601-605`.
- Del original arcade (Wikipedia, verificado): los asteroides se parten al ser disparados y **dos platillos voladores** aparecen periódicamente — el grande dispara al azar y el pequeño apunta con precisión creciente; la oleada termina al eliminar también los platillos. Ni el legacy ni la migración los implementan (búsqueda exhaustiva de `saucer|ovni|ufo|platillo` en ambos ficheros: 0 coincidencias).
- Ficha interna: §6.1 recomienda "hiperspacio con riesgo de explosión como el original" y señala ausencia de pausa.

**Estado migrado**
- Constantes y `wrap` equivalentes: `game.ts:9-30`, `game.ts:71-77`; física y disparo: `game.ts:234-264`.
- Fragmentación fiel (2 hijos, herencia parcial de velocidad): `game.ts:126-143`, `game.ts:310`.
- Hiperespacio **mejorado** con riesgo de explosión `0.1 + 0.15·hazard` y enfriamiento: `game.ts:266-279`.
- Vidas, invulnerabilidad y `gameOver`: `game.ts:167-181`, `game.ts:337-352`.
- Anti-tunneling con sub-pasos y `CollisionService.circleAabb`: `game.ts:281-317`.
- `progression` declarativo (4 oleadas, DDA, patrones split/drift/swarm) y `observe()` de 11 entradas: `game.ts:187-199`, `game.ts:361-382`.
- Render determinista con estrellas fijas, copias en los bordes y parpadeo de invulnerabilidad: `game.ts:384-482`.

**Faltantes / regresiones**
- **P0 (brecha heredada):** no hay platillos voladores; desaparece el cazador que obliga a moverte y el ciclo completo de oleada del arcade. No es regresión: tampoco estaban en `script.js`.
- **P1:** el riesgo del hiperspacio es una invención nueva (documentada como mejora), no un comportamiento del original; con `hazard=0.5` la probabilidad es 0.175. Conviene declararlo como parámetro, no como constante oculta en `step()` (`game.ts:275`).
- **P2:** los asteroides se dibujan como círculos concéntricos (`game.ts:413-423`) frente a los polígonos irregulares del legacy (`script.js:154-163`): se pierde la silueta vectorial.
- **P2:** no hay récord/localStorage ni logros en el motor (son servicios del hub legacy, no del motor); no verificado si el hub actual los cubre.

**Adaptaciones modernas recomendadas**
1. **Platillo "cazador" con precisión creciente** (verificado en Wikipedia): restaura la amenaza que falta y da un objetivo de bonus; beneficio concreto: el jugador ya puede quedarse quieto tras limpiar rocas. Requiere un `spawner` declarativo con temporizador en estado (ver § transversal).
2. **Asteroids Redux / modo "throttle monkey"** — *conocimiento general, sin fuente verificada* (Wikipedia sí documenta el modo "throttle monkey" en el port XBLA de 2007, `Asteroids (video_game)`): oleadas densas y ritmo alto como modo opcional. No requiere nueva función del motor: es otro nivel de `progression`.
3. **Hiperspacio con telegrafía** (anillo de alerta antes del salto): hace legible el riesgo ya implementado; requiere evento `hit` con payload tipado o un campo de estado (`hyperWarning`).

**Funciones del motor que faltan**
- `CollisionService.sweepCircleAabb` / CCD de segmento: hoy el sub-stepping está reimplementado en el juego (`game.ts:281-317`); `sim/collision.ts:19-25` solo ofrece solapamiento instantáneo.
- Spawner de oleadas con cooldown en ticks (para los platillos): no existe servicio; `ctx.progression.nextPattern()` (`game.ts:103`) solo elige patrones.

---

## 2. Centipede

**Mecánicas originales verificadas**
- Rejilla 40×30 de 16 px, jugador confinado al tercio inferior (`PLAYER_TOP_RATIO = 0.66`): `script.js:36-40`, `script.js:56-58`.
- Ciempiés de 8 segmentos que serpentea, baja al chocar con borde/hongo e invierte dirección: `script.js:59-64`, `script.js:481-549`.
- **Split clásico:** al destruir un segmento, la cola se convierte en un ciempiés independiente con nueva cabeza; el segmento muerto deja un hongo: `script.js:674-696`.
- Araña saltarina que rebota en bordes y cambia de dirección al azar: `script.js:215-222`, `script.js:809-839`.
- Pulgas que caen dejando hongos y escorpión que envenena hongos → el ciempiés baja 4 filas en lugar de 1: `script.js:193-211`, `script.js:601-627`, `script.js:503-522`.
- Vidas, 2 s de invulnerabilidad y limpieza de amenazas al reaparecer: `script.js:41`, `script.js:268-285`.
- Oleada con más segmentos yadio de aparición más corto: `script.js:308-326`. Bug B6 documentado: nueva oleada vía `setTimeout(...,500)` en `script.js:530-533`, `script.js:725-728`, `script.js:754-757`.
- Ficha interna §6.6 y Wikipedia: *Centipede: Infestation* (2011, 3DS/Wii), remaster *Centipede Chaos* (2019) y remake 3D de 1998 — verificados.

**Estado migrado**
- Rejilla, constantes, zonas y puntuaciones idénticas: `game.ts:9-43`.
- Hongos en coordenadas de celda, con envenenamiento: `game.ts:56-60`, `game.ts:126-142`, `game.ts:494-498`.
- Split del ciempiés y creación de hongo: `game.ts:281-305`; movimiento follow-the-leader y descenso por hongo venenoso: `game.ts:400-445`.
- Araña, pulga y escorpión con temporizadores en estado: `game.ts:171-200`, `game.ts:447-503`.
- B6 resuelto: `waveTimer` determinista y pausable en `game.ts:367-374`, `game.ts:304`, `game.ts:426`.
- Balas con sub-pasos, colisiones y erosión de hongos: `game.ts:505-584`; `progression` con 3 niveles y patrones snake/spider/mushroom: `game.ts:311-322`.

**Faltantes / regresiones**
- **P0:** ninguna detectada.
- **P1:** `spawnCentipede` añade 2 segmentos solo con el patrón `snake` (`game.ts:149-150`), de modo que la longitud depende del RNG de variedad y no solo de la oleada; puede romper la curva declarada en `investigacion-dificultad-variedad.md` (§5: 8/10/12…).
- **P2:** el README legacy promete "hongos que crecen con cada impacto" (`README.md:26` vía git), pero ni legacy (`script.js:474-479`) ni migración (`game.ts:130-134`) tienen niveles de daño: un impacto crea un hongo, no lo refuerza.
- **P2:** `spawnMushrooms` de la migración no usa el `Set` anti-duplicados del legacy (`script.js:155-170`) — lo compensa `addMushroom` (`game.ts:130-134`), así que el resultado es equivalente; no es regresión.

**Adaptaciones modernas recomendadas**
1. **Hongos con 4 estados de daño** (como los originales y *Centipede Chaos*, verificado en Wikipedia): más control táctico al erosionar; requiere añadir `hp` al tipo `Mushroom` (modelo de datos del juego, sin función nueva del motor).
2. **Oleadas temáticas (spider / mushroom / snake)** ya implementadas como patrones; benefit: variedad sin ruido. Sin nueva función del motor (usa `ctx.progression.nextPattern()`, `game.ts:149`).
3. **Modo "centripede" / pantalla partida** — *conocimiento general, sin fuente verificada*: dos cabezas desde lados opuestos como variante avanzada; requiere `spawner` con múltiples emisores en el estado.

**Funciones del motor que faltan**
- `CollisionService.sweepCircleAabb`: los sub-pasos están duplicados en `game.ts:505-541` (misión del motor, ver AGENTS.md regla 2).
- Spawner/servicio de oleadas: los tres temporizadores de enemigos se gestionan a mano en `game.ts:447-503`.

---

## 3. Galaga

**Mecánicas originales verificadas**
- Formación 10×5 con tres tipos (boss/abeja/mariposa), puntos y HP por fila: `script.js:42-64`, `script.js:59`; tres filas de abeja y dos de mariposa.
- **8 formaciones** y 4 secuencias de entrada: `script.js:81-134`, `script.js:135-173`; formación que se desplaza 8 px y baja 4 al llegar al borde, acelerando al morir enemigos: `script.js:781-819` (índice de velocidad en `script.js:791`).
- Picados en grupo, guiados hacia la nave, con vaivén senoidal y disparos: `script.js:821-856`, `script.js:938-972`.
- **Rayo tractor** en oleadas pares: descenso, haz pulsante, captura de nave y rescate al derribar al portador (+500 y doble disparo): `script.js:825-845`, `script.js:873-936`.
- Bonus stage cada 5 oleadas, 15 s, 40 cazadores: `script.js:174-177`, `script.js:486-583`.
- Vidas extra en 10.000/30.000/60.000: `script.js:974-985`.
- Bug B7: `Date.now()` dentro de `update` para el vaivén (`script.js:528`, `script.js:888`, `script.js:954`).
- Wikipedia (verificado): los Boss Galaga capturan la nave con rayo tractor; rescatarla da un "dual fighter" con más potencia **y hitbox mayor**; si se destruye al portador en formación, la nave capturada se vuelve enemiga.
- *Galaga Wars*: **conocimiento general, sin fuente verificada** (404/402 en las consultas).

**Estado migrado**
- Formaciones, entradas, tipos, bonus y vidas extra: `game.ts:152-201`, `game.ts:232-245`, `game.ts:278-346`, `game.ts:348-358`.
- B7 corregido con `ctx.clock.time` en vaivén de bonus, rayo y picados: `game.ts:489-490`, `game.ts:497`, `game.ts:659`, `game.ts:689`.
- Rayo tractor, captura, rescate (+500, doble disparo) e interrupción (+300): `game.ts:573-609`, `game.ts:646-684`, `game.ts:737-749`.
- Picados, disparos enemigos y colisiones con sub-pasos: `game.ts:571-612`, `game.ts:687-701`, `game.ts:717-759`.
- `progression` (3 niveles, patrones spiral/split/boss), `observe()` de 10 entradas y render de doble nave: `game.ts:419-430`, `game.ts:784-810`, `game.ts:876-891`.

**Faltantes / regresiones**
- **P0 (regresión): la formación ya no oscila.** `game.ts:554-569` mueve los invasores ±8 px por paso, pero `game.ts:640-644` vuelve a asignar `enemy.x = enemy.homeX + state.formationDir * 0` en el mismo tick para cada enemigo no picado; el `* 0` anula el desplazamiento y el borde nunca se alcanza. El legacy sí lo movía (`script.js:797-808`). Se pierde el patrón respiratorio/bajada de formación, pieza central de la identidad de Galaga.
- **P1:** el dual fighter no agranda la hitbox (Wikipedia `Galaga (video_game)`): la migración usa el mismo rectángulo de 28×22 en `game.ts:707-710` y solo duplica las balas (`game.ts:481`).
- **P1:** no existe la variante "nave capturada se vuelve enemiga" documentada en Wikipedia; al rescatar siempre se obtiene doble disparo (`game.ts:743-748`).
- **P2:** la frecuencia de disparo enemigo cambió de probabilidad por frame (`script.js:958`) a `fireTimer` fijo de 2.5 s (`game.ts:691-695`): más predecible, menos tensión.
- **P2:** `finishDive` ya no recoloca al enemigo en la altura media de la formación (`script.js:866-870` vs `game.ts:398-403`).

**Adaptaciones modernas recomendadas**
1. **Formación con desplazamiento persistente** (corregir el P0): beneficio inmediato, restaura ritmo y tensión; no requiere motor nuevo, solo no sobrescribir `x`.
2. **Dual fighter con hitbox agrandada y nave capturada hostil**: fidelidad verificada en Wikipedia; requiere que el `CollisionService` acepte una hitbox por entidad (ya lo hace, `sim/collision.ts:19-25`) y un flag `capturedHostile` en el estado.
3. **Galaga Wars** — *conocimiento general, sin fuente verificada*: oleadas rápidas por nivel y poderes acumulables como modo alternativo; se modela con otro `progression` + patrones, sin motor nuevo.

**Funciones del motor que faltan**
- `CollisionService.sweepCircleAabb`: sub-pasos duplicados en `game.ts:720-758`.
- Eventos tipados: `game/events.ts:36-42` declara `levelUp` con `{level}` y `gameOver` con `{winner}`, pero el juego emite `{wave,…}` (`game.ts:301`) y `{score}` (`game.ts:675`); conviene un mapa de payloads por juego o validación en Tests.

---

## 4. Gradius

**Mecánicas originales verificadas**
- 7 sectores con jefe por sector y parámetros de HP/velocidad crecientes: `script.js:322-353`, `script.js:153-161`, README legacy §Stages.
- Medidor de 5 ranuras SPD/MSL/DBL/OPT/SHD; las cápsulas avanzan el cursor y `Espacio` activa la ranura Seleccionada: `script.js:184-192`, `script.js:194-220`, `script.js:222-250`, `script.js:604-616`.
- **Guarda `if (gauge === 0) return` en `activatePower()`**: sin cápsulas no se activa nada (`script.js:195`).
- SPD máximo 4, OPT máximo 2, escudo que absorbe un golpe; al morir se pierde todo el poder: `script.js:130-138`, `script.js:618-641`.
- Disparo doble base + diagonales con DBL + misiles arqueados + disparos de los Options: `script.js:420-448`.
- Cadencia 0.09 s si se mantiene el botón, 0.16 s si no (autofire): `script.js:450-458`.
- Cola de eventos de spawn por sector con reloj de simulación: `script.js:254-267`, `script.js:304-314`.
- Ficha §6.16 y Wikipedia *Gradius V* (verificado): cápsula amarilla mueve el cursor del medidor, cápsula azul limpia pantalla, el jugador elige la "Weapon Array" antes de la partida; el orden del medidor incluye Speed Up/Missile/Double/Laser/Multiple/Shield.

**Estado migrado**
- 7 sectores, `BOSS_PARAMS` por sector y jefes con abanico + ráfaga apuntada: `game.ts:119-127`, `game.ts:221-271`, `game.ts:522-540`.
- Medidor, activación y reset de poder al morir: `game.ts:129-161`, `game.ts:322-343`, `game.ts:611-620`.
- Cola de eventos (`cue`) y timers de fase en estado (B6): `game.ts:163-200`, `game.ts:428-450`.
- Disparo base, DBL, misiles y Options: `game.ts:466-494`; colisiones y cápsulas: `game.ts:542-620`.
- B7 corregido: movimiento del jefe con `ctx.clock.time` (`game.ts:524-527`).
- `progression` con 3 niveles y patrones capsule/wall/boss: `game.ts:361-372`; `observe()` de 9 entradas: `game.ts:634-658`.

**Faltantes / regresiones**
- **P0 (regresión): poder gratis.** `activatePower()` (`game.ts:138-161`) no comprueba `gauge === 0`; con el medidor a 0, la ranura 0 (SPD) está disponible (`game.ts:141`), así que pulsar `Espacio` al empezar da +1 velocidad y +100 puntos (`game.ts:151-160`). El legacy sí lo impedía (`script.js:195`). Rompe la regla central del juego: reunir cápsulas para elegir mejoras.
- **P1:** no hay cápsula azul que limpie pantalla, presente en *Gradius V* (Wikipedia) — el legacy tampoco la tenía (brecha heredada).
- **P2:** la cadencia de disparo es fija 0.09 s (`game.ts:467`) en lugar de 0.09/0.16 según se mantenga `fire` (`script.js:453`).
- **P2:** no hay Selection/Weapon Array editable tipo *Gradius V*; el orden es fijo (`game.ts:138-145`).

**Adaptaciones modernas recomendadas**
1. **Restaurar la guarda `gauge === 0`** (corrección del P0): beneficio directo, sin motor nuevo.
2. **Cápsula azul de "clear screen" de *Gradius V*** (Wikipedia): válvula de escape en pantallas saturadas; requiere un evento `powerUp` tipado con subtipo y un servicio de "clear" en el motor (o un flag de estado + filtro de balas, hoy reimplementado por juego).
3. **Weapon Array seleccionable** (*Gradius V*, Wikipedia): aumenta la agencia y la rejugabilidad; requiere datos de configuración en `defineGame` y un menú del hub (fuera de `step()`).

**Funciones del motor que faltan**
- Servicio `clearScreen` (eliminar balas/enemigos por evento) compartido por Gradius/Raiden; hoy cada juego filtra sus propios arrays (`game.ts:550-551`, `game.ts:607-609`).
- Eventos tipados con payloads por subtipo de power-up (`game/events.ts:36-42` es solo informativo).

---

## 5. Raiden

**Mecánicas originales verificadas**
- Shmup vertical, área de juego de 480 px centrada en 720, 7 sectores, vidas y 3 bombas: `script.js:29-36`, `script.js:151`, `script.js:585-598`.
- Selección de arma al inicio de cada ronda con ↑/↓ y confirmación: `script.js:616-622`, `script.js:79-94`; al morir se vuelve a "twin": `script.js:585-598`.
- Cinco armas (twin, laser, proton, missile, shield) con patrones de bala propios: `script.js:408-441`, `script.js:607`.
- Bomba expansiva que daña enemigos y jefe en radio, 0.8 s de duración: `script.js:546-560`, `script.js:574-583`.
- Oleadas de naves con vueltas aleatorias, drones a partir de sector 3 y jefes con 7 patrones (espiral, apuntado, anillo, ondas, doble espiral, etc.): `script.js:194-255`, `script.js:304-407`.
- Puntuación: 100/nave, 200/drone, 5000+500×sector por jefe, 1000 por sector: README legacy §Scores; `script.js:1012-1016`.
- Ficha §6.28; Wikipedia *Raiden V* (verificado): Cheer System — los jugadores en red animan a otros, "Cheer Call" cancela todas las balas enemigas y potencia las sub-armas temporalmente.

**Estado migrado**
- Constantes, selección de arma, 5 armas y 7 sectores: `game.ts:9-32`, `game.ts:128-177`, `game.ts:358-366`.
- `stageParams`, jefes con 7 patrones y movimiento con `ctx.clock.time` (B7): `game.ts:107-125`, `game.ts:179-232`, `game.ts:480-529`.
- Oleadas, drones, disparos y colisiones: `game.ts:417-477`, `game.ts:539-579`.
- Bombas como anillo expansivo en estado, pickups de arma y pérdida de arma al morir: `game.ts:273-284`, `game.ts:410-415`, `game.ts:581-628`.
- `progression` con 3 niveles y patrones weave/turret/boss, `observe()` de 10 entradas: `game.ts:305-316`, `game.ts:631-656`.

**Faltantes / regresiones**
- **P0:** ninguna detectada.
- **P1:** `if (state.bossIntro) state.bossIntro = false;` (`game.ts:369`) convierte la intro del jefe en un solo tick, mientras el legacy también la apagaba en un tick (`script.js:1000-1002`). Equivalente; no es regresión, pero la intro no tiene duración visible (P2).
- **P2:** el README legacy afirma que la bomba "clears bullets" (`README.md:10` vía git), pero ni `script.js:546-560` ni `game.ts:581-604` eliminan balas enemigas: es una discrepancia de documentación heredada.
- **P2:** el misil no es "homing-ish" como describe el README legacy: va con vx fijo (`game.ts:160-170`, `script.js:433-436`).
- **P2:** no hay Cheer Call / cancelación de balas ni sub-armas potenciables (*Raiden V*, Wikipedia).

**Adaptaciones modernas recomendadas**
1. **Bomba que cancele balas** (como *Raiden V*, Wikipedia): hace real la promesa del README legacy y da un recurso defensivo claro; requiere servicio `clearScreen` o un evento `bomb` que el motor propague a los subsistemas de proyectiles.
2. **Weapon switch en vuelo** estilo *Raiden V* (Wikipedia): hoy solo se puede elegir entre oleadas (`game.ts:358-366`); requiere acción `cycleWeapon` en el mapa de acciones (ya existe `cycleWeapon()` internamente en `game.ts:128`).
3. **Cheer Call offline como "overdrive" por medidor** (*Raiden V*, Wikipedia): recompensa jugar sin recibir daño; requiere un recurso declarativo en el estado y un evento tipado `powerUp`.

**Funciones del motor que faltan**
- Servicio `clearScreen` / `bulletCancel` (compartir con Gradius).
- Spawner de oleadas y patrones de jefe como datos: `game.ts:417-457` implementa contadores a mano; `ctx.progression.nextPattern()` se consume en `game.ts:418` pero no gobierna el tipo de enemigo.

---

## 6. Space Invaders

**Mecánicas originales verificadas**
- Formación 5×11, intervalo de movimiento por número de supervivientes y bajada de 8 px al borde: `script.js:35-47`, `script.js:60`, `script.js:134-157`, `script.js:296-308`, `script.js:342+`.
- **Un solo disparo del jugador en pantalla** y velocidad de bala creciente al morir invasores: `script.js:284-293`; README legacy §Características.
- 4 escudos de bloques erosionables por radio: `script.js:159-193`, `script.js:685-693`.
- Disparos enemigos desde el invasor más bajo de cada columna, máximo 3 en pantalla: `script.js:310-325`.
- Nave misteriosa con puntos aleatorios 50/100/150/300: `script.js:51`, `script.js:327-339`, `script.js:697-709`.
- Oleada nueva al limpiar la formación, con filas iniciales progresivamente más bajas: `script.js:269-276`, `script.js:138-140`.
- Ficha §6.30; Wikipedia *Space Invaders Infinity Gene* (verificado): evolución de la jugabilidad y modo musical con estética retro-futurista y banda Zuntata; no es una recreación fiel sino una reinterpretación.

**Estado migrado**
- Formación, intervalos por ratio y oleada, bajada y disparo único: `game.ts:9-33`, `game.ts:91-118`, `game.ts:269-315`.
- Escudos de bloques (8×5 con recorte en forma de U) y erosión: `game.ts:120-161`, `game.ts:375-376`, `game.ts:396`, `game.ts:399-411`.
- Nave misteriosa con puntos elegidos al aparecer y temporizador: `game.ts:31`, `game.ts:317-329`, `game.ts:338-351`.
- Disparos enemigos con `ctx.rng`, vidas extra a 1000 puntos y `reachedBottom`: `game.ts:297-314`, `game.ts:366-370`, `game.ts:413-416`.
- `progression` con 4 niveles y patrones dive/sweep/shield, `observe()` de 10 entradas: `game.ts:213-225`, `game.ts:432-464`.

**Faltantes / regresiones**
- **P0:** ninguna detectada.
- **P1:** los puntos de la nave misteriosa se eligen al **aparecer** (`game.ts:320`), no al ser derribada (`script.js:699`): con replay/semilla esto altera la secuencia de RNG y la puntuación esperada.
- **P2:** el patrón `dive` de `progression` (`game.ts:223`) no produce picados reales de invasores: solo multiplica el intervalo de movimiento cuando el patrón es `sweep` (`game.ts:281`); `dive` y `shield` son etiquetas sin efecto observable en `step()`.
- **P2:** no hay animación de dos fotogramas por invasor presente en el legacy (`script.js:297`, `script.js:604-632`).

**Adaptaciones modernas recomendadas**
1. **Modo evolución / música tipo *Infinity Gene*** (Wikipedia): cada oleada cambia regla (formaciones que se fusionan, balas que siguen partituras); beneficio: variedad sin perder la silueta arcade. Requiere un sistema de reglas por nivel en `progression` (patrones ya existen, pero hoy no se consumen todos).
2. **DDA oculto ya previsto** (`investigacion-dificultad-variedad.md` §5: 1/1.12/1.25/1.4): implementado en `game.ts:216-224`; solo falta telegrafía del cambio de patrón (evento `levelUp` con `pattern`, como en Asteroids `game.ts:123`).
3. **Escudos restaurables por oleada con "vida" visible**: el legacy ya los reconstruye (`script.js:272`); añadir contador de bloques en HUD mejora la legibilidad. Sin motor nuevo.

**Funciones del motor que faltan**
- Spawner de patrones de formación: `game.ts:280-281` consume `nextPattern()`, pero solo un valor tiene efecto; conviene un despachador de patrones declarativo en `progression/variety.ts`.
- Eventos tipados para `levelUp` con `pattern` (payload real vs `JuiceEventPayloads.levelUp = {level}`, `game/events.ts:40`).

---

## 7. Tempest

**Mecánicas originales verificadas**
- Tubo de 16 caras con perspectiva, rotación de 1 lado por pulso y proyectiles hacia el centro: `script.js:31-40`, `script.js:188-195`, `script.js:304-313`.
- Enemigos fuseball, spiker (→ "flipper" en la migración) y pulsar que suben desde el centro al borde; llegar al borde mata al jugador salvo que esté saltando: `script.js:115-136`, `script.js:349-374`.
- Jump: salto de 2 caras durante 0.5 s para esquivar: `script.js:315-324`, `script.js:328-338`.
- Oleadas de `4 + 2·wave`, nivel = `wave/3 + 1`: `script.js:115-136`.
- Bug B1 documentado en ficha §6.31: `Espacio` estaba enlazado a iniciar/pausar, no a disparar (`script.js:203-207`); `shoot()` existía pero no se invocaba desde el teclado (`script.js:304-313`).
- Wikipedia *Tempest 2000* (verificado): la secuela añade power-ups (Particle Laser, AI Droid), jump y bonus levels; el salto evita fuseballs y Pulsars electrificados.

**Estado migrado**
- Tubo de 16 caras, rotación, disparo y jump con duration/cara en estado: `game.ts:9-18`, `game.ts:57-59`, `game.ts:154-178`.
- **B1 corregido**: acciones separadas `fire`, `jump`, `left/right` (`game.ts:107`, `game.ts:164-178`).
- Enemigos con profundidad, colisión en el borde, fuseballs letales y salto que salva: `game.ts:61-81`, `game.ts:183-199`.
- Balas, ColisionService, refuerzos por `hazard` y oleadas con delay de 1.5 s: `game.ts:180-247`.
- `progression` con 3 niveles y patrones flipper/tank/scramble; `observe()` de 7 entradas; HUD y render del tubo: `game.ts:108-119`, `game.ts:250-277`, `game.ts:280-391`.

**Faltantes / regresiones**
- **P0:** ninguna detectada (B1 resuelto).
- **P1:** los spikers/flippers ya no "excavan" ni dejan púas en el borde (`script.js:370-373` era solo un comentario visual, pero el original arcade y *Tempest 2000* las usan como obstáculo persistente); la migración solo comprueba alineación instantánea (`game.ts:188-199`).
- **P2:** no hay power-ups (Particle Laser / AI Droid de *Tempest 2000*, verificado en Wikipedia); el patrón `tank` solo cambia el tipo de enemigo (`game.ts:74`).
- **P2:** no se contabilizan los logros del legacy (360°, 10 jumps, oleada 10); `state.level` y `wave` están (`game.ts:44-45`) pero no se emite evento dedicado.

**Adaptaciones modernas recomendadas**
1. **Power-ups de *Tempest 2000*** (Wikipedia): Particle Laser y AI Droid como mejoras temporales; beneficio: recompensa la precisión. Requiere un tipo `powerUps` en el estado y evento `powerUp` tipado (`game/events.ts:17`).
2. **Púas persistentes en el borde** (verificado en *Tempest 2000*): merge con la mecánica de flipper; beneficio: el jump deja de ser gratuito. Requiere una cuadrícula de 16 celdas en el estado (ya hay `sim/grid.ts`).
3. **Superjump / warp desbloqueable** — *conocimiento general, sin fuente verificada*: salto mayor con enfriamiento como atajo de dificultad. Sin motor nuevo (timers en estado).

**Funciones del motor que faltan**
- Servicio de "persistent hazard" / cuadrícula circular de 16 zonas: `sim/grid.ts` existe para rejillas rectangulares, no para anillos.
- Eventos tipados `powerUp` con subtipo (payload map actual en `game/events.ts:36-42`).

---

## 8. Missile Command

**Mecánicas originales verificadas**
- 6 ciudades, 3 baterías, 30 misiles iniciales y +5 por oleada: `script.js:36-49`, `script.js:112-153`.
- Misiles entrantes desde `x` aleatorio hacia ciudad (70 %) o suelo, con velocidad creciente y estela: `script.js:189-206`, `script.js:386-425`.
- Interceptores desde la batería más cercana con munición, explosión de radio 40 y 0.4 s: `script.js:155-187`, `script.js:428-469`.
- Puntos: 25 por misil derribado, 5 por ciudad superviviente × oleada: `script.js:47-48`, `script.js:471-499`.
- Fin de partida al destruir las 6 ciudades: `script.js:402-415`.
- v1.6 eliminó misiles guiados/inteligentes y satélites por fidelidad al arcade: README legacy §Changelog (línea 55 vía git).
- Wikipedia (verificado): al final de cada nivel se dan bonus por misiles y ciudades restantes; **a intervalos de puntuación se gana una ciudad de reserva para reemplazar una destruida**; el multiplicador sube 1× cada dos niveles hasta 6×. La migración (y el legacy) reconstruyen las 6 ciudades en cada oleada y no tienen multiplicador.
- Ficha §6.18 y `investigacion-dificultad-variedad.md` §5 (progreso por ciudad, patrones straight/split/smart).

**Estado migrado**
- Constantes, ciudades, baterías y munición: `game.ts:9-29`, `game.ts:81-105`, `game.ts:107-118`.
- **Puntero en la cinta de inputs**: `ctx.actions.pointer` se lee en `step()` y se refleja en `cursor`, con fallback de acciones de mirilla (`game.ts:221-235`). El módulo `engine/src/input/actions.ts:43,70-77,107-113` hace `snapshot()`/`restore()` del puntero, así que el replay lo cubre (no verificado con test específico).
- Disparo desde la batería más cercana con munición: `game.ts:237-264`.
- Misiles entrantes, **split** y patrones straight/split/smart: `game.ts:133-152`, `game.ts:266-279`, `game.ts:302-313`, `game.ts:183-185`.
- Interceptores con llegada exacta al objetivo, explosiones radiales y destrucción de misiles: `game.ts:281-355`.
- Bonus por ciudades supervivientes, fin de oleada tras 1.5 s y `observe()` de 9 entradas: `game.ts:159-168`, `game.ts:357-365`, `game.ts:368-392`.

**Faltantes / regresiones**
- **P0 (brecha heredada): las ciudades destruidas "resucitan".** `initLevel()` (`game.ts:81-85`, llamada desde `nextWave` en `game.ts:166`) reconstruye las 6 ciudades en cada oleada, igual que el legacy (`script.js:112-118`); el original arcade conserva las pérdidas y solo repone con ciudades bonus ganadas por puntuación (Wikipedia, verificado). Sin este mecanismo, la gestión de ciudades deja de ser el eje del juego.
- **P1 (brecha heredada): sin multiplicador de puntuación** (1×→6× cada dos niveles, Wikipedia), que es parte de la curva de score del original.
- **P1:** los patrones `smart` y `split` son **añadidos nuevos** (el legacy los había eliminado deliberadamente en v1.6 por fidelidad, README legacy línea 55). `smart` fuerza el 100 % de misiles hacia ciudades (`game.ts:137`); conviene marcarlos como "modo moderno" para no confundir con el arcade.
- **P2:** la explosión elimina misiles durante toda la duración del blast (`game.ts:333-355`), mientras el legacy los eliminaba una sola vez al detonar (`script.js:453-464`): más permisivo.
- **P2:** no hay bonus por misiles sobrantes al terminar el nivel (Wikipedia).

**Adaptaciones modernas recomendadas**
1. **Ciudades persistentes + reserva por umbral de puntos** (Wikipedia): restaura la tensión acumulativa y hace que cada oleada importe; requiere mover `cities` a estado persistente entre oleadas (no reiniciar en `initLevel`) y un campo `cityReserve`.
2. **Multiplicador por nivel** (Wikipedia, hasta 6×): hace legible la progresión; se modela con `ctx.progression` (nivel → multiplicador), sin motor nuevo.
3. **Missile Command Delta** — *conocimiento general, sin fuente verificada* (no se encontró fuente accesible): reinterpretación puzle/roguelike; como modo opcional, beneficia la rejugabilidad. Requiere un generador de oleadas declarativo (`spawner`).

**Funciones del motor que faltan**
- El puntero **ya existe** con snapshot/restore (`engine/src/input/actions.ts:43,70-77,107-113`); falta verificarlo con un test de replay (no verificado en esta auditoría).
- Spawner de oleadas con "patrón → secuencia de misiles" como datos (`game.ts:266-279` usa un contador simple); `ctx.progression.nextPattern()` ya está (`game.ts:134`).
- Eventos tipados para `hit` con `kind` ('city', 'split', 'incoming', 'shield', …): hoy se abusa de `ctx.emit('hit', {kind})` (`game.ts:157`, `game.ts:277`, `game.ts:312`, `game.ts:320`) y `game/events.ts:36-42` no los describe.

---

## Funciones del motor que faltan (transversal, shooters)

1. **CCD / sweep tests.** `engine/src/sim/collision.ts:19-25` solo expone solapamiento instantáneo; Asteroids (`game.ts:281-317`), Centipede (`game.ts:505-541`), Galaga (`game.ts:720-758`) y Space Invaders (balas de jugador sin sub-pasos en `game.ts:331-377`) reimplementan sub-stepping a mano. Proponer `CollisionService.sweepCircleAabb(a, b, motion)` o `segmentCircle()` con punto/rectángulo en movimiento.
2. **Spawner declarativo.** No hay servicio de spawns; cada juego gestiona timers y contadores en `step()` (Centipede `game.ts:447-503`, Raiden `game.ts:417-457`, Tempest `game.ts:224-247`, Missile Command `game.ts:266-279`). `ctx.progression.nextPattern()` elige patrones pero no los ejecuta; varios patrones declarados no tienen efecto (Space Invaders `dive`/`shield`, Tempest `scramble`, Raiden `weave`/`turret`). Proponer `ctx.services.get('spawner')` con `scheduleWave(pattern, atTick)` y veto de repetición ya resuelto en `progression/variety.ts`.
3. **Eventos tipados por juego / payloads ricos.** `engine/src/game/events.ts:3-24` define el catálogo, pero `JuiceEventPayloads` (`events.ts:36-42`) solo cubre 5 eventos y usa firmas que no coinciden con lo emitido (`levelUp` → `{wave}`, `gameOver` → `{score}`, `hit` → `{kind}`). Proponer un mapa por juego o un `emitTyped` con validación en Tests.
4. **`clearScreen` / cancelación de proyectiles.** Necesario para Gradius (cápsula azul de *Gradius V*) y Raiden (bomba fiel al README y Cheer Call de *Raiden V*); hoy cada juego filtra sus propios arrays (`game.ts:550-551`, `game.ts:617-618`).
5. **Cuadrícula circular / "hazard persistente".** `sim/grid.ts` es rectangular; Tempest necesita 16 sectores anulares para púas de flipper.
6. **Puntero en replay: presente, no verificado.** `engine/src/input/actions.ts` ya guarda/restaura el puntero; conviene añadir un test determinista que alimente `frame.pointer` (`input/virtual.ts:19-29`) en Missile Command.

## Notas de honestidad / no verificado
- No se ejecutaron tests ni se comprobó el hash golden; el análisis es estático.
- No se verificó en navegador el efecto visual de la regresión de Galaga (`game.ts:642`); la conclusión se basa en lectura de código y en que `homeX` no se actualiza en ningún otro punto (7 referencias inspeccionadas).
- *Asteroids Redux*, *Galaga Wars* y *Missile Command Delta* no pudieron verificarse con fuente: se marcan como conocimiento general.
- No se comprobó si el hub publicado (`index.html`/`assets/`, generados) ya ofrece récords/logros que el motor no implementa.
