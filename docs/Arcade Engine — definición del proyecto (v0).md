# Arcade Engine — definición del proyecto (v0)

Motor 2D propio + juegos construidos sobre su API, con IA neuronal sencilla, 1 jugador, multijugador y vs IA · borrador para decidir · 24-nov-2026

> **Nombre de trabajo:** "Arcade Engine" (pendiente de decidir, ver D1). Este documento define el *qué* y el *por qué*; el DDT por fases viene después, cuando cerremos las decisiones abiertas de la sección 14.

## 1. Visión y principios

Un **motor de juego 2D en JavaScript vanilla** (módulos ES, cero dependencias en el cliente) y un catálogo pequeño de juegos que **solo usan la API del motor**. El motor resuelve una vez lo que el Arcade Hub actual resolvió 32 veces: bucle, entrada, colisiones, audio, guardado, UI, IA y red.

**Principios (cada uno nace de un problema real del hub actual):**

1. **Simulación determinista.** Paso fijo, RNG con semilla y reloj de simulación. Hoy hay \~290 `Math.random`, varios `Date.now()` y `setTimeout` dentro de la lógica: eso rompió la pausa, los reinicios (B6/B7 del informe) y habría roto el entrenamiento de IA y el multijugador.
2. **La simulación no sabe dibujar y el render no muta el estado.** Un `step()` puro permite entrenar en headless, grabar replays, jugar en red y testear sin DOM.
3. **Acciones nombradas, no teclas.** Los juegos piden `jump`, `pause`, `fire`; el motor decide qué tecla, botón o red las dispara. Elimina de raíz los bugs B1-B4 (Espacio duplicado).
4. **Una sola física.** El mismo `step()` corre en el navegador, en el entrenador de IA y en el servidor. Sin copias de constantes como el `PHYS` del parche de Dino.
5. **Integridad de datos.** Todo lo que se guarda o se recibe (partidas, cerebros de IA, replays, mensajes de red) lleva versión y validación estricta; si no cuadra, se descarta.
6. **Alcance contenido.** Pocos juegos, bien hechos, para validar el motor. Nada de repetir la sobre-ambición de proyectos anteriores.

## 2. Alcance

**Dentro de v1:** motor 2D de ticks fijos, entrada unificada (teclado, gamepad, táctil), colisiones AABB/círculo/tilemap, render Canvas 2D, audio sintetizado, guardado versionado, UI/shell accesible, IA (reglas + red neuronal + neuroevolución), modos 1P / 2P local / vs IA / online por salas, replays, entrenador headless y suite de tests.

**Fuera de v1 (explícitamente):** 3D, editor visual de niveles, física de cuerpos rígidos general, WebGL/shaders, rollback netcode, matchmaking público, cuentas y ranking global, reconexión a partida, frameworks de UI y móviles nativos.

## 3. Qué se reaprovecha del código actual

| Pieza actual | Destino |
| --- | --- |
| `shared/loop.js`, `display.js` (DPR, letterbox) | Base del bucle y del canvas, reescritos a paso fijo |
| `shared/input.js` (gamepad, `bindHoldButton`) | Capa de acciones unificada |
| `shared/audio.js`, `music.js` | Servicio de audio del motor |
| `shared/effects.js` (partículas, pool, `drawGlow`) | Módulo de render/efectos |
| `shared/scores.js`, `storage.js`, `achievements.js` | Guardado versionado y logros |
| `shared/shell.js`, `help.js`, base.css | Shell de UI (menú, overlay, ayuda) |
| `games/dino-runner/ai.js` (MLP + GA + validación de cerebro) | Semilla del módulo de IA |
| Lógica de juego de Pong, Snake, Tetris, Bomberman | Referencia para reescribir como `step()` puro |

**Se descarta:** los `script.js` monolíticos con estado privado, el RNG y el reloj globales, los `setTimeout` de gameplay y el acoplamiento lógica↔dibujo↔audio.

## 4. Arquitectura del motor

```
engine/
  core/     loop (paso fijo), clock, rng, scheduler, events, state (snapshot/restore)
  input/    actions, bindings, virtual-input (IA/replay/red)
  sim/      world, systems, collide (AABB, círculo, tilemap, spatial hash)
  render/   canvas2d, camera, sprites, particles, ui-draw
  audio/    synth, music, manager
  ui/       shell, menus, hud, help, settings
  store/    storage versionado, scores, achievements, migraciones
  ai/       mlp, evolution, agents, sensors, brain-store, trainer
  net/      protocol, lockstep, room-client
  tools/    headless-runner, replay, test-harness
server/     rooms + relay (Node + ws)
games/<id>/ game.js, rules, assets, ai.js, README
```

**Reglas de dependencia:** `sim` y `ai` no importan `render`, `audio` ni DOM (así corren en Node y en Workers). `games` solo importa de `engine`. `net` solo habla en inputs y hashes.

**Bucle:** simulación a **60 Hz fijos** con acumulador; el render interpola entre dos estados con `alpha`. El tiempo es `tick * dt`; nunca se lee el reloj real dentro de la simulación.

**Estado:** serializable (JSON o buffers tipados). Permite snapshot, replay, desync-check y guardado.

## 5. Contrato de juego (la API central)

```js
export default defineGame({
  id: 'pong',
  meta: { title: 'Pong', players: [1, 2], modes: ['solo', 'local', 'vsAI', 'online'] },
  actions: ['up', 'down', 'serve'],
  init(seed, opts) { /* devuelve el estado inicial */ },
  step(state, inputs, ctx) { /* inputs[playerId] -> acciones; puro y determinista */ },
  render(r, state, alpha) { /* solo dibuja */ },
  observe(state, playerId) { /* Float32Array normalizado para IA */ },
  rules: { isOver, winner, score, fitness },
});
```

- **Progresión (añadido):** el juego declara `progression` con niveles, `pointsPerLevel`, DDA acotado y `patterns`; el motor resuelve `ctx.progression.update()`, `speed`, `spawnInterval`, `hazard` y `nextPattern()`. Ver `docs/investigacion-dificultad-variedad.md`.
- **Plugins (añadido):** sistemas reutilizables se instalan como `EnginePlugin` con `requires`, servicios compartidos y hooks `preStep`/`postStep`. Un juego nunca trae mecánicas repetibles.
- **Jugadores:** el motor mantiene una lista de *slots* `{ id, kind: 'human' | 'ai' | 'remote' }`. El juego no sabe quién hay detrás de cada slot.
- **`ctx`** ofrece `rng`, `time`, `emit(event)` (para sonido/efectos) y `schedule(ticks, fn)` (timers de simulación, pausables y reiniciables).
- **Efectos y audio** salen como eventos (`emit('hit', {x, y})`); el render los consume. Así `step()` sigue puro.

## 6. Modos de juego

| Modo | Qué es | Slots |
| --- | --- | --- |
| `solo` | Un jugador, récord propio | 1 humano |
| `local` | Mismo dispositivo, 2-4 jugadores (teclado dividido / gamepads) | N humanos |
| `vsAI` | Humano contra una o varias IAs, con dificultad | humano + ai |
| `online` | Salas por código, 2-4 jugadores | humanos remotos (+ IAs de relleno) |
| `demo` | La IA juega sola (attract mode, también sirve de test visual) | solo ai |

**Regla:** cada juego declara qué modos soporta; el menú solo ofrece esos. Récords y logros se guardan **por modo** y la IA nunca modifica un récord humano.

## 7. Catálogo de referencia para v1

Solo 6 juegos, elegidos para ejercitar cada parte del motor (no los 32):

| Juego | Qué valida | solo | local | vsAI | online | IA principal |
| --- | --- | --- | --- | --- | --- | --- |
| Pong | API mínima, versus 1v1, física de bola | ✓ (vs bot) | ✓ | ✓ | ✓ | Red neuronal + reglas |
| Flappy Bird | Reflejo 1P, neuroevolución pura | ✓ | — | ✓ (carrera contra fantasma IA) | opcional | Neuroevolución |
| Snake | Planificación, multijugador FFA | ✓ | ✓ | ✓ | ✓ | BFS + red neuronal |
| Breakout | Física de colisiones, niveles | ✓ | — | — (demo) | — | Red neuronal + reglas |
| Tetris | Puzzle, versus con basura | ✓ | ✓ | ✓ | ✓ | Heurística + red de evaluación |
| Bomberman | 4 jugadores mixtos humano/IA/remoto | ✓ (vs IAs) | ✓ | ✓ | ✓ | BFS + mapa de peligro |

Después de v1, los demás juegos del hub se migran uno a uno si encajan. Dino Runner entra como juego de reflejo 1P con carrera contra IA fantasma.

## 8. IA con redes neuronales sencillas

### Niveles

- **Nivel 0 — Bots por reglas.** Base de dificultad y baseline para medir. Siempre existe uno por juego.
- **Nivel 1 — MLP pequeño + neuroevolución.** Para juegos de reflejo (Flappy, Dino, Pong, Breakout). Sin datasets ni backprop: se evoluciona jugando.
- **Nivel 2 — Heurística + búsqueda con red como evaluador.** Para planificación (Tetris, Snake, Bomberman): la red puntuá posiciones y una búsqueda corta elige.
- **Nivel 3 — Coevolución/self-play** en juegos versus, con *hall of fame* para evitar sobreajuste a un solo rival.

### API de IA

- **Observación:** `observe(state, playerId) → Float32Array` normalizada, definida por el juego.
- **Acción:** el agente devuelve acciones nombradas (o un vector que el juego mapea); entran por `virtual-input`, igual que un humano.
- **Agente:** `{ act(obs) }`; implementaciones: `RuleBot`, `NeuralBot(brain)`, `SearchBot`.
- **Cerebro:** JSON versionado `{ v, gameId, gameVersion, topology, weights, meta{seed, score} }` con validación de forma y valores finitos al cargar.
- **Entrenador headless:** corre el mismo `step()` en Node o en un Worker; la aptitud la define `rules.fitness`.
- **Evaluación honesta:** el campeón se elige con semillas nunca usadas para entrenar, por mediana y peor caso (lección del parche de Dino).
- **Dificultad vs IA:** *checkpoints* de distintas generaciones (Fácil/Normal/Difícil), más retraso y error humano inyectables sin reentrenar.
- **Juego limpio:** la IA solo ve lo que ve el jugador (`observe` no filtra información oculta).

## 9. Multijugador

- **Local:** entradas por slot; teclado dividido y varios gamepads.
- **vs IA:** slots `ai` con su agente; mismo código que un humano.
- **Online (modelo propuesto):** **servidor relay + lockstep determinista**. El servidor (Node + `ws`) es muy pequeño: gestiona salas y retransmite los inputs de cada tick. Todos los clientes simulan el mismo `step()` con *input delay* de 2-3 ticks y se comparan un **hash del estado cada N ticks** para detectar desincronización.
- **Salas:** código de sala o IP manual (sin descubrimiento automático, como en WebCraft), 2-4 jugadores, nombre visible, espectadores gratis (reciben los mismos inputs). Reconexión fuera de v1.
- **Riesgo conocido:** el lockstep exige determinismo bit a bit entre navegadores. Mitigación: la simulación usa solo `+ - * / sqrt` y tablas precalculadas para trigonometría (nada de `Math.sin/exp` en `step()`), y se testea el hash entre Chromium y Firefox. **Plan B (D3):** servidor autoritativo que corre `step()` y envía snapshots.
- **Hosting:** los clientes son estáticos (GitHub Pages sirve para local/solo/vs IA); online necesita el servidor Node en la misma máquina o en un VPS.

## 10. Datos e integridad

- `store` guarda con **clave y versión**; cada esquema tiene validador y migración. Si falla la validación, se ignora el dato y se avisa.
- Los replays y cerebros llevan **checksum**. Los mensajes de red se validan antes de tocar el estado.
- Récords separados por modo; la IA y los replays no tocan récords ni logros humanos.
- `localStorage` siempre envuelto en `try/catch` (modo privado, políticas corporativas).

## 11. Calidad y herramientas

- **Tests (`node:test`):** unitarios del motor; **determinismo** (misma semilla + mismos inputs ⇒ mismo hash tras N ticks); replays *golden*; fuzz de entradas; todas las acciones documentadas son alcanzables por teclado, gamepad y táctil.
- **Lint y formato:** ESLint + Prettier como devDependencies (ya usados en el hub).
- **Rendimiento:** presupuesto de simulación < 4 ms/tick y 60 FPS en un móvil de gama media.
- **Accesibilidad:** `aria-live`, `prefers-reduced-motion`, remapeo de teclas y soporte de flechas y WASD siempre.
- **Herramientas:** `headless-runner`, grabador/reproductor de replays y CLI de entrenamiento.

## 12. Roadmap por fases

| Fase | Contenido | Criterio de salida |
| --- | --- | --- |
| F0 Fundamentos | Bucle de paso fijo, clock, RNG, scheduler, estado/snapshot, acciones, runner headless | Test de determinismo en verde |
| F1 Presentación | Render Canvas 2D, cámara, partículas, audio, shell/UI, storage versionado | Pantalla de prueba a 60 FPS con menú y ajustes |
| F2 Primer juego | Pong con `solo` (bot de reglas) y `local` | API de juego estable; replay reproduce una partida |
| F3 IA neuronal | MLP, neuroevolución, trainer headless, brain-store, dificultad por checkpoints | Pong y Flappy con IA entrenada que supera al bot de reglas |
| F4 Más juegos | Flappy, Snake, Breakout, Tetris | Cada juego con sus modos y bot |
| F5 Online | Servidor ws, lockstep, salas, detección de desync | Pong, Snake y Tetris VS online sin desync en 10 min |
| F6 Bomberman y pulido | 4 jugadores mixtos, demo mode, rendimiento, docs | Partida 2 humanos + 2 IAs remoto/local estable |
| F7 Migración (opcional) | Portar juegos del hub que encajen | Decisión por juego |

Cada fase tendrá su documento con tareas, cómo hacerlas, cómo validarlas, limitaciones y registro de commits (mismo método que el DDT de WebCraft).

## 13. Qué no haremos

- Un motor genérico para cualquier género: es para **arcade 2D de estado pequeño**.
- ECS completo, motor de física general o editor visual.
- Migrar los 32 juegos antes de que el motor esté probado con 6.
- Añadir dependencias de cliente. La única dependencia de runtime justificada es `ws` en el servidor.

## 14. Decisiones abiertas

| ID | Decisión | Propuesta | Alternativa |
| --- | --- | --- | --- |
| D1 | Nombre del proyecto | "Arcade Engine" (provisional) | Nombre propio |
| D2 | Modelo de entidades | **World + Systems** con objetos planos (simple, suficiente) | ECS completo (más complejo) |
| D3 | Netcode | **Lockstep determinista + relay** | Servidor autoritativo con snapshots (más robusto, más tráfico) |
| D4 | Lenguaje | **TypeScript estricto + Vite + Vitest** (decidido el 25-nov-2026) | ~~JS ES modules + JSDoc + `// @ts-check`~~ (descartado) |
| D5 | Repo | **Monorepo** `engine/` + `server/` + `games/` con npm workspaces | Repos separados |
| D6 | Estilo visual | Neon 2D del hub actual | Estilo nuevo por juego |
| D7 | Catálogo v1 | Los 6 de la sección 7 | Otro conjunto |
| D8 | Hosting online | Servidor Node propio (LAN o VPS) | Servicio gestionado |
| D9 | Ciclo de vida del hub actual | Se congela como referencia | Se mantiene en paralelo |
