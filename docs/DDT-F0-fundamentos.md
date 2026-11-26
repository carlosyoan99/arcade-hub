# DDT F0 — Fundamentos del Arcade Engine

> Documento de diseño técnico de la Fase 0 · 25-nov-2026
> Define el *cómo* de la fase 0 del plan en `docs/Arcade Engine — definición del proyecto (v0).md`.
> Criterio de salida de la fase: **test de determinismo en verde**.

## 1. Contexto

El hub actual (`carlosyoan99/arcade-hub`, 32 juegos, ~30 000 líneas) resolvió 32 veces el mismo bucle, entrada, colisiones, audio, guardado e IA. El informe `docs/Arcade Hub — investigación completa.md` confirma 8 bugs causados por reloj real, `setTimeout` de gameplay y teclas comparadas directamente (`Date.now()` en B7, timers en B6, `Space` duplicado en B1-B4).

F0 construye el núcleo que hace imposibles esos bugs por diseño: **simulación determinista** con paso fijo, RNG con semilla, reloj de simulación, timers dentro del estado, acciones nombradas y estado serializable.

## 2. Decisiones cerradas (sección 14 del documento v0)

| ID | Decisión | Resolución | Nota |
| --- | --- | --- | --- |
| D1 | Nombre | **Arcade Engine** | Cerrado; F2 entregó los primeros juegos jugables. |
| D2 | Modelo de entidades | **World + Systems**, objetos planos | Sin ECS. Suficiente para estado pequeño. |
| D3 | Netcode | **Lockstep determinista + relay** | Plan B: servidor autoritativo con snapshots. F0 solo garantiza el determinismo que lockstep necesita. |
| D4 | Lenguaje | **TypeScript + Vite** | **CAMBIO respecto al borrador**: se descarta JS + JSDoc + `// @ts-check`. Se adopta TS estricto y Vite como bundler/dev-server, como en WebCraft. |
| D5 | Repo | **Monorepo** `engine/` + `server/` | npm workspaces; los juegos viven en `engine/src/games/`, no son un workspace propio. |
| D6 | Estilo visual | Neon 2D del hub actual | Se aplica en F1. |
| D7 | Catálogo v1 | **Los 32 juegos del hub** | Los 6 del piloto más el resto; todos integrados en `engine/src/games/index.ts`. |
| D8 | Hosting online | Servidor Node propio (LAN o VPS) | F5. |
| D9 | Ciclo de vida del hub | **Retirado; referencia histórica en `docs/`** | El legacy se eliminó el 26-nov-2026 tras la paridad; su lógica ya vive en `engine/src/games/`. |

### Consecuencias de D4

- Todo el código del motor es `.ts` con `strict: true`, `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`.
- **Tests con Vitest** (integradas con Vite) en lugar de `node:test` puro; se mantiene la suite de determinismo y se añade cobertura del core.
- El headless runner corre en Node mediante `tsx` (o entrada ESM compilada), sin DOM.
- `engine/` se publica como paquete ESM con `tsc --declaration` para tipos; Vite solo se usa para dev/build de la demo y de los juegos.
- La regla de dependencia se mantiene **por convención**: `sim/`, `ai/`, `progression/` y `game/` no importan `render/`, `audio/`, `ui/` ni DOM. Todavía no hay test automático de grafo de imports (pendiente en `TODO.md`).

### Política de versionado

El motor está en **pre-release**: `0.2.0-beta.0` (`engine/package.json`). Política: F0-F3 `alpha.N`, F4-F6 `beta.N`, y `1.0.0` solo tras validación final en producción (E2E en navegador y despliegue). Estado real: F0-F7 completados; la versión se promocionó a `beta.0` el 26-nov-2026. El hub heredado ya no está en el repo: solo queda su registro histórico en `docs/` y el HUB generado desde `engine/`.

## 3. Alcance de F0

**Dentro:** bucle de paso fijo, `Clock`, `RNG` con semilla, `Scheduler`, bus de eventos, `State` (snapshot/restore/hash), capa de acciones nombradas con entrada virtual, headless runner, tests de determinismo y fixtures de replay golden.

**Fuera (fases posteriores):** Canvas 2D, cámara, partículas, audio, shell/UI, storage, IA neuronal, red, juegos.

## 4. Estructura a crear

```
engine/
  package.json          # workspace @arcade/engine, scripts: dev, build, test
  tsconfig.json         # strict, ESM, declaraciones
  vite.config.ts        # demo + vitest
  src/
    index.ts            # API pública
    core/
      types.ts          # Tick, Delta, ActionName, GameState base
      clock.ts          # tick, dt, time = tick * dt
      rng.ts            # PRNG sembrable y serializable
      scheduler.ts      # timers en ticks, pausables y reiniciables
      events.ts         # cola de eventos por tick
      state.ts          # snapshot, restore, hash determinista
      loop.ts           # acumulador de paso fijo + alpha de interpolación
    input/
      actions.ts        # ActionSet: isDown / wasPressed / consume
      bindings.ts       # mapping de teclas/gamepad/táctil -> acciones
      virtual.ts        # inyección de IA, replay y red
    tools/
      headless.ts       # correr N ticks sin DOM
      replay.ts         # grabar/reproducir (trazas de inputs)
  test/
    determinism.test.ts
    rng.test.ts
    scheduler.test.ts
    loop.test.ts
    actions.test.ts
    replay.test.ts
```

## 5. Plugins nativos y frontera juego/motor

Requisito añadido durante F0: **el motor debe aceptar plugins de forma nativa** y **los juegos no deben arrastrar mecánicas repetibles**. La frontera se hace cumplir en el tipo `GameDefinition`: un juego solo declara `id`, `meta`, `actions`, `init`, `step`, `render`, `observe` y `rules`. Todo lo demás (bucle, entradas, timers, colisiones, audio, guardado, IA, red) llega por `StepContext` o por servicios de plugins.

### API de plugins (`core/plugins.ts`)

```ts
interface EnginePlugin {
  readonly id: string;
  readonly version?: string;
  readonly requires?: readonly string[];       // orden topológico, no orden de declaración
  install(api: PluginAPI): void;
  dispose?(): void;
}
interface PluginAPI {
  readonly clock; readonly rng; readonly events; readonly scheduler; readonly actions;
  readonly services: ServiceRegistry;          // provide/get/has
  onPreStep(hook: () => void): void;
  onPostStep(hook: () => void): void;
  registerAction(name: string): void;
}
```

- `PluginRegistry` instala en orden topológico, detecta ids duplicados, dependencias ausentes y ciclos.
- `simulation.tick()` ejecuta: `clock.advance → inputs → scheduler → plugins.preStep → game.step → plugins.postStep → actions.endTick`.
- El plugin automático `game:<id>` registra las acciones declaradas por el juego; los juegos nunca manipulan `e.code`.
- `ServiceRegistry` permite que un plugin (p. ej. `collision`, `audio`, `scores`) exponga una única implementación que todos los juegos consumen con `ctx.services.get(...)`.
- Regla de oro: **si una función aparece en dos juegos, sube al motor como plugin o servicio**.

### Ajuste al plano de archivos

Se añaden `core/simulation.ts` (composición de servicios + plugins), `game/contract.ts` (`defineGame`), `game/adapter.ts` (traducción a simulación) y `game/example.ts` (juego de prueba, no del catálogo). El `tools/headless.ts` usa `gameSimulationOptions()` para correr cualquier juego real.

## 6. Contrato del core (API de F0)

```ts
export interface Clock { readonly tick: number; readonly dt: number; readonly time: number; }
export interface RNG { next(): number; int(maxExclusive: number): number; fork(salt: number): RNG; snapshot(): number; restore(s: number): void; }

export interface EngineLoop<S> {
  start(): void; stop(): void; pause(): void; resume(): void;
  stepOnce(): void;             // un tick, sin reloj real
  advance(realDeltaMs: number): void; // acumulador -> N ticks + alpha
  get alpha(): number;
}

export interface Scheduler { schedule(ticks: number, fn: () => void): TimerId; cancel(id: TimerId): void; advance(): void; clear(): void; }
export interface Events { emit(type: string, payload?: unknown): void; drain(): GameEvent[]; }
export interface StateOps<S> { snapshot(s: S): S; restore(s: S, snap: S): void; hash(s: S): string; }
export interface Actions { isDown(a: ActionName): boolean; wasPressed(a: ActionName): boolean; consume(a: ActionName): boolean; }
```

**Reglas duras de F0:**

1. `step(state, inputs, ctx)` es puro: no lee `Date.now()`, `Math.random()` ni DOM.
2. `ctx` expone solo `rng`, `clock`, `emit()` y `schedule()`.
3. El reloj avanza `tick * dt`; el tiempo real solo alimenta el acumulador en `advance()`.
4. `alpha` se calcula como `accumulator / dt` y se usa únicamente en render.
5. `RNG` usa xorshift32 con estado en un `number` (entero de 32 bits), sin `Math.random`.
6. `hash` usa FNV-1a sobre una serialización estable (claves ordenadas), no `JSON.stringify` directo.
7. `snapshot` usa `structuredClone` (o clon explícito en Node < 17), sin referencias compartidas mutables.
8. Los timers se guardan como `{ id, dueTick, fn }` dentro del estado y avanzan con `advance()`.

## 7. Tareas

| # | Tarea | Validación |
| --- | --- | --- |
| F0.1 | Inicializar monorepo (npm workspaces) y paquete `engine/` con TS estricto + Vite + Vitest | `npm test` y `npm run build` en verde |
| F0.2 | `clock.ts` y `rng.ts` | Test: misma semilla produce la misma secuencia; `fork` aísla dibujos |
| F0.3 | `events.ts` y `scheduler.ts` | Test: timer no dispara en pausa, se cancela y sobrevive a snapshot/restore |
| F0.4 | `state.ts` (snapshot/restore/hash) | Test: hash estable con distinto orden de claves; restore recupera estado profundo |
| F0.5 | `loop.ts` con acumulador y `alpha` | Test: 1 s simulado = 60 ticks con dt=1/60; `stepOnce` no depende del reloj real |
| F0.6 | `input/actions.ts` + `virtual.ts` | Test: acción nombrada la activan teclado, gamepad y replay por igual |
| F0.7 | `tools/headless.ts` y `replay.ts` | Test: misma semilla + mismos inputs ⇒ mismo hash tras 600 ticks |
| F0.8 | Test de determinismo golden y fixture de replay | `npm test -- determinism` en verde (criterio de salida) |

## 8. Cómo validar la fase

```bash
npm install
npm test          # incluye determinism.test.ts
npm run build     # tsc declara tipos + Vite compila la demo
npm run headless -- --ticks 600 --seed 12345
```

**Criterio de salida:** dos ejecuciones del headless runner con la misma semilla y la misma cinta de inputs producen exactamente el mismo hash a los 600 ticks, y el test falla si se sustituye `rng` por `Math.random` o se lee el reloj real dentro de `step()`.

## 9. Limitaciones de F0

- No hay render: el bucle solo llama a `step()` y expone `alpha`; la interpolación visual se implementa en F1.
- El replay es una cinta de inputs en memoria; aún no hay formato versionado ni checksum (F1 lo añade con `store/`).
- `bindings.ts` define la API de mapeo pero no prueba todavía gamepad/táctil reales (F1).
- El headless runner no tiene aún modo de velocidad ×5/×20 (`timeScale`), previsto para la infraestructura IA.
- El grafo de imports se comprueba solo por convención hasta que F1 active el test automático.

## 10. Registro de commits

| Commit | Contenido |
| --- | --- |
| `F0.1` | Monorepo + tooling TS/Vite/Vitest |
| `F0.2` | Clock y RNG sembrable |
| `F0.3` | Eventos y scheduler de simulación |
| `F0.4` | Snapshot/restore/hash determinista |
| `F0.5` | Bucle de paso fijo con alpha |
| `F0.6` | Acciones nombradas y entrada virtual |
| `F0.7` | Headless runner y replay |
| `F0.8` | Test de determinismo y cierre de fase |
