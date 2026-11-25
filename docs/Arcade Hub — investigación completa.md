# Arcade Hub — investigación completa

> **Documento histórico (24-nov-2026).** Solo la sección 3 (bugs B1-B8) se conserva como referencia para las **versiones migradas** en `engine/src/games/`. Por D9 el Hub (`games/`, `shared/`) está congelado: **no ejecutar** las propuestas de las secciones 4-5 sobre el código legacy. Los 8 bugs están corregidos en el motor, con evidencia en los tests por juego.

Instrucciones, análisis, bugs, mejoras y plan de modo IA para los 32 juegos de `carlosyoan99/arcade-hub` · 24-nov-2026

## 1. Resumen ejecutivo

- **Estado general sólido:** 32 juegos, \~30 000 líneas, cero dependencias. Un fuzz con entradas aleatorias (3000 frames × 32 juegos, en jsdom) no produjo **ninguna excepción**.
- **Bugs confirmados leyendo el código: 8.** Los más graves: **Tempest no se puede disparar con el teclado**, y en **Out Run, Columns y Puyo Puyo** la acción de la tecla Espacio (turbo / hard drop) es inalcanzable porque el handler de pausa la captura antes.
- **Mobile:** en Burger Time y Double Dragon el D-pad táctil solo da un empujón de 80 ms por toque; mantener pulsado no mueve de forma continua.
- **Modo IA para los 32 es viable**, pero necesita 3 piezas de infraestructura: RNG con semilla (hay \~290 llamadas a `Math.random`), reloj de simulación (hay lógica que usa `Date.now()`) y una API común de bots. La mayoría (≈24) se resuelve con **reglas/planificación sin entrenar**; la neuroevolución (como en Dino) conviene solo en 4-5.
- **Documentación desfasada (dato histórico del 24-nov):** Breakout decía 5 filas y el código tenía 8; CLAUDE.md/package.json decían "19 juegos"; 4 READMEs no tenían tabla de controles y el de Double Dragon tenía texto corrupto. **Estado actual:** esos archivos legacy están congelados y la documentación del repo ya fue reescrita; no aplicar estas correcciones sobre `games/`.

## 2. Método y alcance (qué sí y qué no)

- **Hecho:** lectura de README y metadata de los 32; escaneo estático comparativo (loop, gamepad, pausa, timers, RNG, reloj, storage, innerHTML); lectura de código de los puntos sospechosos; fuzz de 3000 frames por juego; lectura de los audits previos en `docs/`.
- **No hecho:** no jugué visualmente ni probé en dispositivos reales; no leí las \~30 000 líneas completas. Las fichas por juego se basan en README + escaneo + los fragmentos que verifiqué. Cada hallazgo marca si está **confirmado** (leí el código) o **por verificar**.
- **Ya resueltos en audits previos (no repetir):** Frogger timeout, Donkey Kong escaleras, regen/HP de Neon Nexus, XSS y ranking de Cell Swarm, canvas del hub, `winGame()` de Pac-Man.

## 3. Bugs confirmados

| ID | Juego | Problema | Impacto |
| --- | --- | --- | --- |
| B1 | Tempest | El handler de pausa atrapa `Espacio` y devuelve antes; `shoot()` por teclado es inalcanzable (solo funciona vía táctil/gamepad). El README dice Espacio = disparar, P = pausa. | **Alto**: injugable con teclado |
| B2 | Out Run | Mismo patrón: `Espacio` pausa y `activateTurbo()` por teclado nunca se ejecuta. | Alto |
| B3 | Columns | `Espacio` pausa; la rama de hard drop (línea \~517) es código muerto. | Medio |
| B4 | Puyo Puyo | Igual que B3 (línea \~328). | Medio |
| B5 | Burger Time, Double Dragon | El D-pad táctil pone la tecla en `true` y la suelta a los 80 ms; no hay `touchend`. Mantener pulsado no mueve de forma continua. | Medio (móvil) |
| B6 | Centipede, Dig Dug, Double Dragon, Defender | Callbacks `setTimeout` (nueva oleada 500/600 ms, acto 1500 ms, aterrizadores `i*600`) solo comprueban `state.running`. Si reinicias con R o pausas en ese intervalo, actúan sobre la partida nueva (spawns dobles, salto de acto) o durante la pausa. Cell Swarm tiene 5 timers similares **sin verificar**. | Medio |
| B7 | Frogger, Galaga, Joust | Lógica de juego dependiente de `Date.now()`: las tortugas de Frogger se sumergen por reloj real (no pausable, no reproducible); el vaivén de enemigos en Galaga y Joust usa el reloj real dentro del `update`. | Bajo-medio; **bloquea entrenar IA** |
| B8 | Dino Runner | El hitbox del cactus está centrado en el suelo con `halfH = h/2`: solo cuenta la mitad inferior del cactus dibujado y se extiende bajo el suelo. | Bajo (jugabilidad permisiva) |

**Arreglo de B1-B4 (mismo patrón):** quitar `'Space'` del handler de pausa y dejar solo `P` (como ya hace Tetris). Añadir un test que pulse cada tecla documentada y verifique su efecto, para que no vuelva a pasar.

### Por verificar (no confirmados)

- **Táctil sin botones en el HTML:** Centipede, Dig Dug, Flappy Bird, Frogger, Galaga, Missile Command, Tetris y Space Invaders no tienen botones en `index.html`; usan gestos en canvas. Tetris y Centipede prometen "botones en pantalla" en su README. Probar en móvil.
- **Sin pausa:** 14 juegos no mencionan pausa en su código (Asteroids, Breakout, Cell Swarm, Centipede, Defender, Dig Dug, Dino, Donkey Kong, Flappy, Frogger, Galaga, Joust, Pong, Space Invaders).
- **Sin auto-pausa al ocultar la pestaña:** `visibilitychange` aparece 0 veces en los juegos (el hub sí lo maneja).
- **`innerHTML`** en Gradius y Raiden (1 uso c/u): revisar que no reciba texto del usuario.
- **Ambigüedad de controles:** Moon Patrol asigna ↑ a saltar y a disparar arriba; Donkey Kong usa ↑ para saltar y para trepar.

### Documentación

- Breakout: metadata dice 5 filas; README y código, 8 filas × 14 columnas.
- CLAUDE.md y package.json: "19 juegos" (hay 32); TODO.md: "320 tests" (la suite actual corre \~390).
- Double Dragon README: la fila de Combo tiene texto corrupto en cirílico.
- Sin tabla de controles: Bomberman, Gradius, Q\*bert, Raiden (las deduje del código, ver fichas).
- Q\*bert solo acepta Q/E/A/D para las diagonales; no hay flechas (usabilidad/accesibilidad).

## 4. Mejoras transversales

1. **Acciones nombradas en `shared/input.js`** (`pause`, `primary`, `secondary`…) en lugar de comparar `e.code` en cada juego: elimina de raíz B1-B4.
2. **Test de "teclas documentadas alcanzables"** generado desde la tabla de controles de cada README.
3. **Pausa universal** y **auto-pausa por `visibilitychange`** en `shared/shell.js` (también silencia música/ambient).
4. **Temporizadores de juego dentro del estado** (`state.timers`, avanzados por `dt`), no `setTimeout`: pausables, reiniciables y deterministas (arregla B6).
5. **`shared/rng.js` con semilla** y **reloj de simulación** (`state.time += dt`) para reemplazar `Math.random` y `Date.now` en la lógica (arregla B7, habilita IA, replays y tests reproducibles).
6. **Dificultad seleccionable** (Fácil/Normal/Difícil) como parámetro compartido; Pong ya tiene la base (delay y error de la IA).
7. **Remapeo de teclas** en `shared/settings.js` y soporte de flechas en Q\*bert.
8. **Modo demo (attract mode)** con la IA cuando el overlay lleva inactivo unos segundos: da vida al hub.
9. **Cleanup de listeners** (pendiente en el código legacy congelado; resuelto en los juegos migrados con `handleLifecycle` y plugins).
10. **Verificar táctil real** en los 8 juegos sin botones y unificar con `bindHoldButton` (corrige B5).

## 5. Plan del modo IA para los 32 juegos

### Arquitectura propuesta

- **`shared/ai.js`:** contrato `Bot { id, observe(view), decide(view, dt) → acciones }`, registro por juego y botón 🤖 en la game-bar.
- **Cada juego expone `getAIView()`:** snapshot de solo lectura de su estado (no leer el DOM). El bot juega **el juego real en vivo**, así no se duplica la física (solo los bots entrenados necesitan simulador, como en Dino).
- **Entrada virtual:** el bot emite las mismas acciones que un humano a través de `shared/input.js` (`virtualKey(code, down)`). Lección del Dino: usar `jump()`/`setDuck()` evita comportamientos que un humano no podría hacer.
- **Aislamiento:** el modo IA no toca récords ni logros (igual que en el parche de Dino).
- **Velocidad ×1/×5/×20:** `timeScale` en `shared/loop.js` con sub-pasos (dt máx. 0.05) para ver y evaluar bots rápido.
- **Juego limpio:** los bots no leen información oculta (ej. objetivos privados de los fantasmas) salvo que sea la misma que ve el jugador.

### Tres familias de bots

- **A. Reglas / planificación (sin entrenar), ≈24 juegos:** Snake, Pong, Breakout, Tetris, Columns, Puyo Puyo, Pac-Man, Bomberman, Q\*bert, Frogger, Missile Command, Space Invaders, Galaga, Asteroids, Tempest, Centipede, Joust, Donkey Kong, Burger Time, Dig Dug, Defender, Double Dragon, Cell Swarm, Neon Nexus.
- **B. Controladores de conducción/umbral:** Out Run, Pole Position, Paperboy, Moon Patrol.
- **C. Neuroevolución (como Dino):** Flappy Bird, Moon Patrol, y opcionalmente Asteroids, Gradius y Raiden con sensores de rayos. Requieren extraer un simulador headless.

### Esfuerzo y orden recomendado

1. **Infraestructura** (rng, reloj, `getAIView`, `virtualKey`, botón 🤖, timeScale): M.
2. **Fáciles (S):** Flappy Bird, Snake, Pong, Breakout, Paperboy, Missile Command.
3. **Puzzle (S-M):** Tetris, Columns, Puyo Puyo (Puyo ya tiene CPU para reutilizar).
4. **Shooters (M):** Space Invaders, Galaga, Asteroids, Tempest, Centipede, Raiden, Gradius.
5. **Laberintos y planificación (M-L):** Pac-Man, Bomberman, Q\*bert, Frogger, Burger Time, Dig Dug.
6. **Complejos (L):** Defender, Joust, Double Dragon, Cell Swarm, Donkey Kong, Neon Nexus, Out Run, Pole Position, Moon Patrol.

## 6. Ficha por juego (1-16)

Esfuerzo IA: **S** = pequeño, **M** = medio, **L** = grande.

### 1. Asteroids

**Cómo se juega:** ←/→ (A/D) rotar · ↑ (W) acelerar · Espacio disparar · H hiperespacio · R reiniciar. Destruye asteroides (grande → mediano → chico) con una nave con inercia y wrap en los bordes; tienes invulnerabilidad breve tras perder una vida. **Mejoras:** añadir pausa; hiperespacio con riesgo de explosión como el original. **Bugs:** sin pausa (por verificar auto-pausa). **IA (M):** calcular el tiempo hasta colisión de cada asteroide, apuntar con predicción de tiro (lead) al más amenazante y esquivar con empuje; alternativa: sensores de rayos + neuroevolución.

### 2. Bomberman

**Cómo se juega:** flechas/WASD mover · Espacio poner bomba · P pausa · R reiniciar. Rompe ladrillos, elimina enemigos y abre la salida. **Mejoras:** falta la tabla de controles en el README. **Bugs:** ninguno confirmado. **IA (M-L):** BFS en la cuadrícula con un mapa de peligro por tiempo (explosiones y mechas); poner bomba solo si existe ruta de escape.

### 3. Breakout

**Cómo se juega:** ←/→ (A/D) mover la pala · Espacio lanzar · R. Tablero de **8 × 14** ladrillos, niveles con velocidad progresiva, anti-stuck a los 5 s. **Mejoras:** corregir metadata (dice 5 filas); power-ups; ángulo de salida según el punto de impacto ya es tip del README. **Bugs:** solo documentación. **IA (S):** predecir la x de llegada con rebotes en las paredes y golpear con el borde de la pala para dirigir la bola a la columna con más ladrillos.

### 4. Burger Time

**Cómo se juega:** ←/→ mover · ↑/↓ escaleras · Z pimienta · Espacio/P pausa · R. Camina sobre los ingredientes para que caigan y armen las hamburguesas. **Mejoras:** D-pad táctil continuo (B5). **Bugs:** **B5**. **IA (M-L):** grafo de pisos y escaleras con camino al ingrediente más cercano sin pisar, evitar enemigos y usar pimienta cuando uno esté a ≤ 2 casillas.

### 5. Cell Swarm

**Cómo se juega:** ratón/dedo mover · Espacio dividir · E eyectar masa · Shift impulso (gasta masa) · gamepad. Battle royale de células: crece comiendo comida y células más pequeñas. **Mejoras:** es de los más grandes (1607 líneas); candidato a dividir en módulos. **Bugs:** 5 `setTimeout` por verificar (B6). **IA (M):** campo de potencial: atraer comida y células menores, repeler mayores; dividir para cazar cuando la masa > 2×.

### 6. Centipede

**Cómo se juega:** flechas/WASD mover · Espacio disparar · R. Dispara al ciempiés que serpentea entre hongos; arañas y demás. **Mejoras:** pausa; verificar táctil. **Bugs:** **B6** (nueva oleada tras 500 ms). **IA (M):** apuntar al segmento más bajo o a la araña, mantenerse en la zona inferior y evitar enemigos.

### 7. Columns

**Cómo se juega:** ←/→ mover · ↑ rotar · ↓ caída suave · **P pausa** · Espacio **debería** ser hard drop pero hoy pausa (B3). Forma líneas de 3+ gemas del mismo color; hay power-ups. **Mejoras:** separar pausa (P) de hard drop (Espacio). **Bugs:** **B3**. **IA (M):** probar las colocaciones (columna × rotación), simular gravedad y combos y puntuar por cadenas y altura.

### 8. Defender

**Cómo se juega:** flechas/WASD mover · Espacio disparar · B bomba inteligente · H hiperespacio (5 s de enfriamiento) · N bomba nuclear (1 por vida) · R. Protege a los humanos de los aterrizadores. **Mejoras:** pausa. **Bugs:** **B6** (aterrizadores programados con timers). **IA (L):** prioridades: interceptar al aterrizador que lleva un humano, atrapar humanos que caen, bomba si hay muchos enemigos.

### 9. Dig Dug

**Cómo se juega:** flechas/WASD mover/excavar · Espacio inflar/bomba · R. Excava túneles, infla enemigos hasta que exploten o derriba rocas sobre ellos. **Mejoras:** los docs indican Fygar y bonus pendientes. **Bugs:** **B6** (nueva oleada tras 600 ms). **IA (M-L):** pathfinding en los túneles, alinearse y bombear; atraer enemigos bajo rocas.

### 10. Dino Runner

**Cómo se juega:** Espacio/↑ saltar · ↓ agacharse (en el aire: caída rápida) · Espacio/R empezar. Esquiva cactus y pterodáctilos (3 alturas); ciclo día/noche cada 100 m. **Mejoras:** corregir hitbox del cactus; pausa. **Bugs:** **B8**. **IA:** **ya hecha** (parche `dino-ai.patch`: teclas T entrenar, I jugar con IA).

### 11. Donkey Kong

**Cómo se juega:** ←/→ mover · ↑/W trepar escaleras (y también salta) · Espacio salta · R. Escala la obra esquivando barriles. **Mejoras:** separar "saltar" (Espacio) de "trepar" (↑) para evitar saltos accidentales en escaleras (por verificar); pausa. **Bugs:** ninguno confirmado (escaleras ya corregidas en audit). **IA (M-L):** reglas de salto ante barriles según distancia + navegación por escaleras; es un sistema de reglas como Dino pero con grafo de niveles.

### 12. Double Dragon

**Cómo se juega:** flechas/WASD mover · Z puñetazo · X patada · C combo · Espacio/P pausa · R. 4 actos con combos, armas y jefe final. **Mejoras:** arreglar la fila corrupta del README; D-pad táctil continuo. **Bugs:** **B5**, **B6** (siguiente acto tras 1,5 s, también durante la pausa). **IA (M):** máquina de estados: acercarse al enemigo más cercano, atacar en rango, retirarse con poca vida.

### 13. Flappy Bird

**Cómo se juega:** Espacio/↑/toque aletear · R. Vuela entre tubos con espaciado variable. **Mejoras:** pausa; dificultad progresiva ya existe (v1.7). **Bugs:** ninguno confirmado. **IA (S):** la mejor candidata para neuroevolución (entradas: distancia al hueco, altura relativa, velocidad vertical) o regla simple: aletear si el pájaro cae por debajo del centro del hueco.

### 14. Frogger

**Cómo se juega:** flechas/WASD salto por casilla · Espacio/R. Cruza la calle y el río sobre troncos y tortugas. **Mejoras:** pausa; reloj de simulación. **Bugs:** **B7** (tortugas por `Date.now()`). **IA (M):** planificador BFS sobre (fila, columna, tiempo); necesita B7 corregido para ser determinista.

### 15. Galaga

**Cómo se juega:** ←/→ (A/D) mover · Espacio disparar · R. Oleadas de invasores en formación con picados en espiral. **Mejoras:** pausa. **Bugs:** **B7** (vaivén enemigo por `Date.now()`). **IA (M):** mapa de peligro de balas y picados, objetivo en la fila que baja.

### 16. Gradius

**Cómo se juega:** flechas/WASD mover · X/Z (mantener) disparar · **Espacio activa el power-up seleccionado del medidor** · P pausa · R. 7 sectores, jefe en cada uno. **Mejoras:** falta tabla de controles en el README. **Bugs:** revisar el `innerHTML` (por verificar). **IA (M-L):** esquivar con sensores, recoger cápsulas y activar el medidor con una política fija de mejoras.

## 6 (cont.). Ficha por juego (17-32)

### 17. Joust

**Cómo se juega:** ←/→ (A/D) mover · Espacio/↑/W aletear · R. Montado en tu avestruz derrota jinetes: en una colisión gana el que está más alto. **Mejoras:** pausa; reloj de simulación. **Bugs:** **B7** (el vaivén de enemigos usa `Date.now()` dentro del `update`). **IA (M-L):** control de altitud (aletear para quedar por encima del objetivo), embestir cuando `dy > 0`, recoger huevos antes de que eclosionen.

### 18. Missile Command

**Cómo se juega:** ratón apuntar · clic o Espacio disparar · gamepad: stick + A/X · táctil: tocar la pantalla · Espacio/R empezar. Defiende tus ciudades con interceptores. **Mejoras:** verificar el táctil (no hay botones en el HTML). **Bugs:** ninguno confirmado. **IA (S-M):** intercepción predictiva: para cada misil calcular el punto de explosión que lo alcance, elegir la batería más cercana con munición y priorizar los que amenazan ciudades. Es de los bots deterministas más eficaces.

### 19. Moon Patrol

**Cómo se juega:** ↑/W saltar · →/D disparar adelante (mantener) · ↑/W disparar arriba (mantener) · Espacio/P pausa · R. Niveles por distancia con bonus de tiempo. **Mejoras:** aclarar la ambigüedad de ↑ (saltar y disparar arriba a la vez). **Bugs:** ninguno confirmado. **IA (S-M):** umbral de distancia para saltar cráteres y rocas (igual que Dino) y disparo a los enemigos aéreos; candidato a neuroevolución.

### 20. Neon Nexus

**Cómo se juega:** defensa de torre contra oleadas de formas neón · clic/toque = daño extra · 1/2/3 mejorar ATK/HP/Velocidad · Espacio/R empezar · T tienda tras el game over. **Mejoras:** es el juego más grande (1794 líneas); candidato a modularizar. **Bugs:** ninguno confirmado (regen y HP ya corregidos). Un `setTimeout` de UI (vista previa de oleada) es inocuo. **IA (S-M):** política de mejoras: elegir la que dé mayor ΔDPS por coste, con un piso de HP, y clics automáticos con límite de cadencia humana.

### 21. Out Run

**Cómo se juega:** ↑/W acelerar · ↓/S frenar · ←/→ girar · **Espacio turbo (hoy no funciona por teclado, B2)** · P pausa · R. Carretera pseudo-3D con 5 tramos. **Mejoras:** arreglar B2; el turbo por táctil y gamepad sí funciona. **Bugs:** **B2**. **IA (M):** controlador: seguir el centro de la pista anticipando la curva, cambiar de carril si el tráfico está cerca y usar turbo en rectas despejadas.

### 22. Pac-Man

**Cómo se juega:** flechas/WASD mover · Espacio/R empezar. Come todos los puntos esquivando 4 fantasmas con IAs distintas. **Mejoras:** pausa; el juego es casi determinista (solo 1 `Math.random`), ideal para tests y bots. **Bugs:** ninguno confirmado (`winGame()` ya corregido). **IA (M-L):** búsqueda de profundidad limitada (expectimax) con las reglas conocidas de los fantasmas, prioridad a píldoras de poder cuando hay fantasmas cerca.

### 23. Paperboy

**Cómo se juega:** ↑/↓ cambiar de carril · →/D lanzar el periódico · Espacio/P pausa · R. Reparte periódicos y esquiva obstáculos. **Mejoras:** ninguna crítica. **Bugs:** ninguno confirmado. **IA (S):** lanzar cuando el buzón o la ventana objetivo entra en rango; cambiar de carril ante obstáculos.

### 24. Pole Position

**Cómo se juega:** ↑/W acelerar · ↓/S frenar · ←/→ girar · Espacio turbo · P pausa · R. 3 circuitos de dificultad creciente con clasificación. **Mejoras:** no se detectó el patrón de Espacio duplicado de Out Run; confirmar jugando. **Bugs:** ninguno confirmado. **IA (M):** mismo controlador que Out Run, ajustado a la vista cenital.

### 25. Pong

**Cómo se juega:** W/S (o ↑/↓ en 1P) mover · Tab alterna 1P/2P · Espacio sacar · R. El primero en llegar a 7 gana. **Mejoras:** dificultad seleccionable reutilizando el retraso y el error de la IA rival; pausa. **Bugs:** ninguno confirmado. **IA (S):** ya tiene un rival humanizado; reutilizar esa lógica para un autoplay de P1 (modo demo).

### 26. Puyo Puyo

**Cómo se juega:** ←/→ mover · ↑ rotar · ↓ caída suave · **P pausa** · Espacio **debería** ser hard drop pero hoy pausa (B4) · R. Cadenas de puyos; incluye modo vs CPU. **Mejoras:** arreglar B4. **Bugs:** **B4**. **IA (M):** ya existe la CPU del modo vs; extraerla a `ai.js` y reutilizarla para autoplay.

### 27. Q\*bert

**Cómo se juega:** **Q/E/A/D** = diagonales ↖/↗/↙/↘ · Espacio/Enter empezar · P pausa · R. Salta por la pirámide para cambiar el color de los cubos, evita a Coily y atrapa a Slick/Sam. **Mejoras:** aceptar también flechas; falta tabla de controles. **Bugs:** ninguno confirmado. **IA (S-M):** BFS sobre la pirámide hacia el cubo sin pintar más cercano evitando casillas adyacentes a Coily.

### 28. Raiden

**Cómo se juega:** flechas/WASD mover · Espacio lanzar bomba (en partida) · ↑/↓ elegir arma y Espacio/Enter confirmar (pantalla de selección) · P pausa · R. 7 sectores con jefe y varias armas. **Mejoras:** falta tabla de controles; revisar `innerHTML`. **Bugs:** ninguno confirmado. **IA (M-L):** mapa de peligro para esquivar y una política fija de armas; opcional: neuroevolución con sensores.

### 29. Snake

**Cómo se juega:** flechas/WASD mover · Espacio/P pausa · R. Come para crecer sin chocar. **Mejoras:** ninguna crítica; velocidad progresiva ya incluida. **Bugs:** ninguno confirmado. **IA (S):** BFS hacia la comida comprobando que quede ruta hacia la cola; si no, seguir la cola. Casi no muere. **Ideal como primer bot.**

### 30. Space Invaders

**Cómo se juega:** ←/→ (A/D) mover · Espacio disparar (un solo tiro en pantalla a la vez) · R. Escudos que se deterioran y nave misteriosa de 50-300 puntos. **Mejoras:** pausa; verificar táctil. **Bugs:** ninguno confirmado. **IA (S-M):** apuntar a la columna con el invasor más bajo, esquivar con un mapa de peligro y priorizar la nave misteriosa.

### 31. Tempest

**Cómo se juega:** ←/→ (A/D) rotar por el tubo de 16 lados · **Espacio disparar (hoy no funciona por teclado, B1)** · ↑/W saltar · P pausa · R. **Mejoras:** arreglar B1; sin esto solo se puede disparar con táctil o gamepad. **Bugs:** **B1**. **IA (S-M):** rotar al carril con el enemigo más cercano, disparar y saltar cuando un flipper alcanza el carril del jugador.

### 32. Tetris

**Cómo se juega:** ←/→ mover · ↑ rotar horario · Z antihorario · ↓ caída rápida · Espacio hard drop · C/Shift guardar (hold) · P pausa. Pieza fantasma y niveles; v2.0.0. **Mejoras:** verificar táctil (el README promete botones, el HTML no los tiene). Es el modelo a seguir: P para pausa y Espacio para hard drop sin conflicto. **Bugs:** ninguno confirmado. **IA (S-M):** heurística clásica (altura agregada, huecos, rugosidad, líneas) sobre las 4 rotaciones × columnas, con hold opcional. Es muy fiable y la más vistosa para un modo demo.

## 7. Prioridades sugeridas

1. **Corregir B1-B4** (una línea por juego, alto impacto): Tempest y Out Run primero.
2. **B5** (táctil continuo) y **B6** (timers de oleadas) en los 5 juegos afectados.
3. **Docs**: README de Breakout/metadata, tablas de controles de los 4 juegos, CLAUDE.md/package.json/TODO.
4. **Infraestructura IA**: `rng`, reloj de simulación, `getAIView`, `virtualKey`, `timeScale`; resolver B7 de paso.
5. **Bots fáciles** (Flappy, Snake, Pong, Breakout, Tetris) y luego el resto según el orden de la sección 5.

**Nota de honestidad:** las fichas de juegos que no verifiqué en código se apoyan en README y escaneo estático; conviene validarlas jugando antes de implementar.
