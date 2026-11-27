# Auditoría — HUB y estándar obligatorio por juego

> 27-nov-2026 · **Análisis de solo lectura.** No se modificó código, tests ni configuración.
> Este documento define el estándar que debe cumplir **cada juego** y el **HUB** antes de promocionar `rc`/`1.0.0`.

## Alcance, método y convenciones

- **Fuentes actuales:** `index.html`, `assets/*` (artefacto generado), `engine/index.html`, `engine/demo/main.ts`, `engine/demo/hub.css`, `engine/src/ui/hub-model.ts`, `engine/src/render/canvas2d.ts`, `engine/src/input/host.ts`, `engine/src/game/events.ts`, `engine/src/progression/curve.ts`, `engine/src/core/simulation.ts`, `engine/test/*`, `e2e/hub.spec.js`.
- **Fuente legacy:** el commit de retirada es `a8a8093` (`chore: retirar hub legacy tras paridad`); su padre es `a8a8093^ = 0ee83c4`. Las citas Legacy usan la forma `a8a8093^:<archivo>:<línea>` (el archivo ya no existe en el árbol de trabajo).
- **Skills:** `.agents/skills/frontend-design/SKILL.md`, `.agents/skills/accessibility/SKILL.md`, `docs/decisiones-skills.md`.
- **Evidencia:** `archivo:línea` de código leído. **No ejecuté** `npm test`, `npm run build:hub` ni Playwright: todo lo que depende de ejecución se marca **[NO VERIFICADO]**. La E2E citada es la que existe en el repo (`e2e/hub.spec.js`), no una corrida por esta auditoría.

### Hallazgo de fondo

El motor **ya tiene** la capacidad de letterbox (`engine/src/render/canvas2d.ts:27-62`, `97-127`) y los juegos **ya declaran** su tamaño lógico (19 juegos con `width`/`height` propios, p. ej. `engine/src/games/asteroids/game.ts:10-11`). El HUB **no las conecta**: `engine/demo/main.ts:39-43` sólo especializa `pong` y `flappy`; los otros 30 reciben un canvas fijo `960×600` (`engine/demo/main.ts:279-281`). `engine/demo/` no importa `canvas2d` en ningún sitio **[verificado por búsqueda]**. La regresión no es falta de motor, es falta de cableado en la demo.

---

## 1. Estándar obligatorio por juego (checklist medible)

Aplicable a los **32** juegos de `engine/src/games/index.ts`. La columna «Estado» es el estado observado en el HUB publicado; `parcial` significa que el motor lo provee pero la vista del juego no lo usa.

| # | Requisito | Criterio medible | Cómo verificarlo (test / E2E) | Estado actual y evidencia |
| --- | --- | --- | --- | --- |
| 1 | **Ajuste responsive / letterbox** | El canvas usa el tamaño lógico declarado por el juego, escala `min(vw/W, vh/H)`, conserva la proporción, sin recorte ni scroll horizontal en 360×640, 1280×720 y 1920×1080. | Unit: `computeLetterbox` ya cubierto en `engine/test/render.test.ts:89+`; **nuevo** test paramétrico sobre los 32 juegos comparando `game.width/height` con el canvas montado. E2E: 3 viewports, `scrollWidth <= clientWidth` y bounding box del world centrado. | **Regresión.** `engine/demo/main.ts:39-43` sólo `pong`/`flappy`; `engine/demo/main.ts:279-281` fija 960×600; `engine/demo/hub.css:201-209` escala con `width:100%` pero sin letterbox. Asteroids dibuja en 800×600 (`engine/src/games/asteroids/game.ts:384-391`) dentro de un canvas 960×600 → banda muerta. |
| 2 | **Pantalla completa** | Botón visible y atajo `F`/`F11`; `document.fullscreenElement !== null`; el world escala al viewport sin deformar; `Esc` sale y devuelve el foco al botón. | E2E: click en `[data-testid=fullscreen]`, esperar `fullscreenElement`, comparar `letterbox.css` con el viewport, `Escape` y comprobar foco restaurado. Unit: el cálculo de escala ya es puro. | **Perdido.** No hay `requestFullscreen` ni botón en `index.html` ni en `engine/demo/main.ts`. Legacy: `a8a8093^:shared/dom.js:94-102` (`fsBtn`), `a8a8093^:shared/shell.js:47-50`. |
| 3 | **Captura / thumbnail en el HUB** | Los 32 juegos tienen imagen real generada desde su propio `render()`: dataURL no vacío, distinto entre juegos, estable para `(id, seed, tick)`. | Unit: `captureThumbnail(game, seed, tick)` × 32; aserciones `startsWith('data:image/')`, hash estable, differ entre ids. E2E: una imagen por tarjeta con `alt` no vacío y `naturalWidth > 0`. | **Perdido.** `engine/demo/main.ts:150-173` crea sólo número, título y meta. No existe `toDataURL`/`captureThumbnail` en `engine/` **[verificado por búsqueda]**. Legacy: `a8a8093^:asset/hub.js:293-312`, `a8a8093^:asset/hub-cards.js:739-750`, 19 escenas dibujadas (`a8a8093^:asset/hub-cards.js:64+`) y 32 PNG (`a8a8093^:games/*/screenshot.png`). |
| 4 | **Juice vía eventos** (partículas/audio/shake) | Cada juego emite al menos un evento de `JUICE_EVENTS`; el fanout lo drena una sola vez y alimenta partículas/audio; `prefers-reduced-motion` atenúa pero no elimina la información. | Unit: test de evento por juego (ya exigido en `AGENTS.md`), `engine/test/engine-services.test.ts`; E2E: reduced-motion + inspección de que el evento sigue produciendo feedback no dependiente sólo de color/audio. | **Parcial.** Catálogo `engine/src/game/events.ts:3-22`, plugins cableados en `engine/demo/main.ts:45` y `216-245`. **Shake/trauma no existe en el motor** **[verificado por búsqueda]**; queda como P2. |
| 5 | **Pausa y reinicio** | `P`/`Esc` pausa; `R` reinicia desde cero con la misma semilla; timers y `generation` se anulan; el anuncio por `aria-live` coincide con el estado real. | Unit: `engine/src/game/lifecycle.ts:24-25` + tests de timers en pausa/reinicio. E2E: pausar → el tick no avanza; reiniciar → `hash()` vuelve al del tick 0 de la misma semilla. | **Regresión funcional.** Pausa correcta (`engine/demo/main.ts:298-302`), pero `restart` en `engine/demo/main.ts:303-306` **sólo cambia el texto de estado**: no re-monta ni resetea la simulación, aunque la ayuda anuncia «R reinicio» (`engine/demo/main.ts:148`). |
| 6 | **Controles teclado / gamepad / táctil** | Toda acción declarada en `game.actions` es alcanzable por los tres dispositivos; puntero normalizado al mundo (no al canvas) cuando hay letterbox. | Unit: `engine/test/input-host.test.ts`, `engine/test/actions.test.ts`; matriz `actions declaradas` vs `ALIASES` en `engine/demo/main.ts:48-69`. E2E: sintetizar teclado, `Gamepad` y `pointerdown` y comparar la cinta resultante. | **Parcial.** Host real en `engine/src/input/host.ts:41-46,104-110,183-213`. Pero `pointerCoords` normaliza contra `getBoundingClientRect()` del canvas (`engine/src/input/host.ts:183-199`), no contra el rectángulo del world: con letterbox, las coordenadas del puntero quedarán desplazadas. Los alias son heurísticos y no garantizan cobertura de las 32 tablas de acciones. |
| 7 | **Dificultad progresiva** | `progression` declarativo con ≥3 niveles, `pointsPerLevel`, `hazard`/`patterns` y DDA acotado; ninguna curva escrita dentro de `step()`. | Unit: `engine/test/progression.test.ts`, `engine/test/catalog.test.ts`, test por juego de subida de nivel; `engine/test/import-graph.test.ts`. | **OK en motor** (`engine/src/progression/curve.ts:17-36`; selector Fácil/Normal/Difícil en `engine/demo/main.ts:195-196,331-333`). **[NO VERIFICADO]** cobertura de los 32 juegos con ≥3 niveles. |
| 8 | **Semilla compartible** | La semilla se muestra, se copia y viaja en la URL; al abrir `#game/<id>?seed=<n>` se reproduce el mismo hash y la misma cinta. | Unit: `engine/test/determinism.test.ts`, `tools/replay.ts`. E2E: dos contextos con la misma URL → mismo `hash()` a los N ticks. | **Regresión.** `const SEED = 12345` embebido (`engine/demo/main.ts:38`) y `parseRoute` sólo acepta `#game/<id>` (`engine/src/ui/hub-model.ts:74-88`). No hay UI de semilla ni parámetro de URL. |
| 9 | **Accesibilidad WCAG 2.2 AA** | Foco visible, skip link, `aria-live`, contraste 4.5:1 (3:1 UI), objetivos ≥24×24 px, `forced-colors`, sin depender sólo de color/audio, `prefers-reduced-motion`. | E2E: axe/Lighthouse en `e2e/hub.spec.js` (gate actualmente ausente); revisión de tokens con los criterios de `.agents/skills/accessibility/SKILL.md:90-116,220-242,265-279`. | **Parcial.** Foco y reduced motion OK (`engine/demo/hub.css:50-52,217-223`, `e2e/hub.spec.js:86-112`), `aria-live` en `index.html:125-126`. Sin `forced-colors` (legacy `a8a8093^:asset/hub.css:694-708`), sin axe automatizado **[NO VERIFICADO el contraste de los tokens actuales]**. |
| 10 | **Determinismo e integridad** | Mismo seed + misma cinta ⇒ mismo hash; `step()` sin `Math.random`, `Date.now`, DOM, render ni audio; `snapshot()`/`restore()` conservan todo el estado. | `engine/test/determinism.test.ts` (golden `600:3336926330:e22d095e-20`), `engine/test/import-graph.test.ts`, `npm run headless -w @arcade/engine -- --ticks 600 --seed 12345`. | **OK en motor** (`engine/src/core/simulation.ts:81-83,158-177`). **[NO VERIFICADO]** en esta sesión: no ejecuté la suite. |

### Observaciones transversales del checklist

- El golden hash y el número de tests que se citan en `docs/arquitectura.md:56` y `TODO.md:16` corresponden a la rama de trabajo, no a una corrida de esta auditoría **[NO VERIFICADO]**.
- `docs/arquitectura.md:60` afirma que «El HUB conserva thumbnails canvas»; el código actual lo desmiente (`engine/demo/main.ts:150-173`). **Corregir la documentación es parte del P0-07**, porque hoy la documentación invalida la auditoría.
- El HUB publicado perdió la meta CSP que tenía el legacy (`a8a8093^:index.html:11-14`); no hay `http-equiv="Content-Security-Policy"` en `index.html`.

---

## 2. Comparativa HUB legacy vs actual

### 2.1 Qué se conservó

| Capacidad | Legacy | Actual | Verdict |
| --- | --- | --- | --- |
| 32 juegos en vitrina y búsqueda | `a8a8093^:index.html:117-131`, `a8a8093^:asset/hub.js:280-320` | `index.html:88-101`, `engine/demo/main.ts:176-183`, `engine/src/ui/hub-model.ts:32-59` | ✅ conservado (búsqueda por todas las palabras, contador y estado vacío). |
| Skip link y foco visible | `a8a8093^:index.html:86`, `a8a8093^:asset/hub.css:84-87` | `index.html:79`, `engine/demo/hub.css:50-52` | ✅ conservado y cubierto por E2E (`e2e/hub.spec.js:101-109`). |
| `aria-live` | `a8a8093^:index.html:187,191` | `index.html:125-126`; `engine/src/ui/shell.ts:80,121` | ✅ conservado (`e2e/hub.spec.js:41-43,75-77`). |
| `prefers-reduced-motion` | `a8a8093^:asset/hub.css:679-693`, `a8a8093^:asset/hub.js:117` | `engine/demo/hub.css:217-223`, `e2e/hub.spec.js:86-100` | ✅ conservado (incluso con mejor cobertura E2E). |
| SEO (canonical, OG, Twitter, JSON-LD, favicon, sitemap, robots) | `a8a8093^:index.html:9-75` | `index.html:8-72` | ✅ conservado en el HTML generado (ver `docs/plan-retirada-legacy.md:21-22`). |
| Meta / pitch visual «vitrina» | `a8a8093^:asset/hub.css:1-3` | `engine/demo/hub.css:1`, `index.html:100` | ✅ conservada como idea, aunque empobrecida (ver 2.2). |
| Sin frameworks y build estático | `a8a8093^:index.html:84` | `package.json:15-17`, `docs/plan-retirada-legacy.md:22` | ✅ conservado y ahora con Vite; 0 `<iframe>` (`e2e/hub.spec.js:22`). |

### 2.2 Qué se perdió

| Pérdida | Evidencia legacy | Evidencia actual | Impacto |
| --- | --- | --- | --- |
| **Capturas por juego** | 32 `games/<id>/screenshot.png` en `a8a8093^` (verificable con `git ls-tree`); miniatura canvas por tarjeta en `a8a8093^:asset/hub.js:293-312`; 19 escenas dibujadas a mano en `a8a8093^:asset/hub-cards.js:64-738`, API `drawGameThumb` en `739-750`; SVG de fallback en `a8a8093^:asset/icons/game-*.svg` y `a8a8093^:games.js:21-357`. | Tarjeta de sólo texto: `engine/demo/main.ts:150-173` (`number`, `title`, `meta`). Sin `thumbnail`, sin `toDataURL`, sin `<img>` en tarjetas. Artefacto `assets/` sólo contiene JS+CSS. | **P0.** El HUB dejó de ser una vitrina; es una lista. Además contradice `docs/arquitectura.md:60`. |
| **Temas claro / oscuro / retro** | Tokens `:root` y `:root[data-theme='light']` en `a8a8093^:asset/hub.css:5-29`; anti-FOUC en `a8a8093^:asset/theme-init.js:1-4` (cargado en `a8a8093^:index.html:7`); toggle con persistencia `arcadehub_theme` en `a8a8093^:asset/hub.js:21-42`; transición en `a8a8093^:asset/hub.css:74-82`. | Un único tema oscuro: `engine/demo/hub.css:4-10` (`color-scheme: dark`, 6 tokens). No hay `data-theme`, no hay toggle, no hay persistencia. El «retro» nunca existió en el legacy: es un requisito **nuevo**, no una restauración. | **P0.** Regresión claro/oscuro + nueva capacidad retro. |
| **Ajuste a pantalla / letterbox en juego** | Helper compartido `setupCanvas()` con DPR y letterbox centralizado en `a8a8093^:shared/display.js:28-88`, con `resize` + `destroy`. | Canvas fijo en `index.html:118`, `engine/demo/main.ts:279-281`; CSS `width:100%;height:auto` en `engine/demo/hub.css:201-209`. El motor tiene `computeLetterbox`, pero la demo no lo importa. | **P0.** «Los juegos no se ajustan a la pantalla». |
| **Pantalla completa** | Botón `fsBtn` en la game-bar (`a8a8093^:shared/dom.js:94-102`,.icon en `shared/icons.js:38-42`) y `requestFullscreen`/`exitFullscreen` en `a8a8093^:shared/shell.js:47-50`; `<iframe allowfullscreen>` en `a8a8093^:index.html:209`. | Sin `fullscreen` en `index.html`, `engine/demo/main.ts` ni `assets/` **[verificado por búsqueda en el bundle]**. | **P0.** Regresión directa reportada. |
| **Densidad visual / animación** | Entry overlay (`a8a8093^:index.html:89-94`, `asset/hub.css:619-629`); font Chakra Petch (`a8a8093^:index.html:77-82`); orden por nombre/nuevos/más jugados (`133-140`); vista grilla/lista (`141-160`); botón sorpresa (`163-165`); logros y estadísticas en footer (`194-205`); estados `new-badge`, `plays-count`, `pending` (`asset/hub.js:280-303`, `asset/hub.css:295-299,369-399`). | Sólo `buscar` en `index.html:88-96`; grilla uniforme `engine/demo/hub.css:100-107`; tarjeta mínima `109-140`; una animación `reveal` (`212-216`). No hay orden, vista lista, sorpresa, logros ni estadísticas. | **P1.** Simplificación excesiva reportada. Recuperar densidad **sin** volver al iframe: captura + metadatos + filtros. |
| **forbidden: `forced-colors` y CSP** | `a8a8093^:asset/hub.css:694-708`; CSP en `a8a8093^:index.html:11-14`. | Ausentes en `engine/demo/hub.css` e `index.html`. | **P0/P1** (según impacto): `forced-colors` es AA; CSP es defensa en profundidad. |
| **Reinicio real en la vista de juego** | Cada juego legacy recreaba su estado con `R` (contrato histórico documentado en `docs/Arcade Hub — investigación completa.md`). | `engine/demo/main.ts:303-306` sólo anuncia «reiniciado». | **P0.** La ayuda miente al jugador (`engine/demo/main.ts:148`). |

### 2.3 Qué se añadió (mantener)

- Selector de dificultad Fácil/Normal/Difícil: `index.html:103-113`, `engine/demo/main.ts:185-196,331-333`.
- Enlaces profundos `#game/<id>` sin iframes: `engine/src/ui/hub-model.ts:74-93`, `e2e/hub.spec.js:52-84`.
- Render de los 32 juegos sin mutar estado: `engine/test/render-all.test.ts:28-43`.
- Host real de teclado/gamepad/táctil/puntero: `engine/src/input/host.ts:104-110,183-236`.
- Gate E2E de errores de consola: `e2e/hub.spec.js:3-14`.

---

## 3. Propuesta de HUB objetivo

**Principio:** minimalista *pero completo*. Una vitrina con capturas reales y metadatos útiles, sobria en croma y rica en información. Se mantiene el build sin iframes (`docs/plan-retirada-legacy.md:22`) y la paleta de 6 tokens (`docs/decisiones-skills.md:25`), pero se extiende a 3 temas y se recupera la densidad informativa sin copiar el legacy.

> Fuente a editar: **`engine/index.html` + `engine/demo/*`**. La raíz `index.html`/`assets/` es generada (`AGENTS.md`: «no editar a mano»; verificado en `diff engine/index.html index.html`).

### 3.1 Dónde vive cada función

| Función | Capa | Ubicación concreta | Justificación |
| --- | --- | --- | --- |
| Cálculo de letterbox, DPR, transform, `toWorld` | **Motor** | `engine/src/render/canvas2d.ts` (ya existe: `computeLetterbox:27-62`, `createCanvasRenderer:97+`) | Matemática pura y testeable; no reimplementar. |
| Generación de capturas por juego | **Motor (nuevo)** | `engine/src/render/thumbnail.ts` — `captureThumbnail(game, seed, tick, options?)` | Usa `GameDefinition.render()`; pertenece a `render/`, no a la UI ni al juego. |
| Simulación headless para la captura | **Motor** | `createGameSimulation` (`engine/src/game/adapter.ts`), `createDifficultySimulation` (`engine/src/ai/difficulty.ts:210+`) | Mismo seed/tick que la partida; sin plugins de audio. |
| Eventos → partículas/audio | **Motor** | `engine/src/render/event-fanout.ts`, `particles.ts`, `engine/src/audio/manager.ts` (ya cableados en `engine/demo/main.ts:45`) | Regla 4 de `AGENTS.md`. |
| Input teclado/gamepad/táctil y su normalización | **Motor** | `engine/src/input/host.ts` + `engine/src/ui/hub-model.ts` (rutas/parseo puro) | Un único punto de contacto con DOM. |
| Persistencia de tema / ajustes | **Motor (store versionado)** | `engine/src/store/storage.ts` (`StorageSchema` con `version`/`migrate`, líneas 26-34,112-123) | El legacy usaba `localStorage` directo; sube al motor con validación. |
| Resolución del parámetro `seed` en la URL | **Motor (modelo puro)** | Extender `parseRoute()`/`routeFor()` en `engine/src/ui/hub-model.ts:74-93` | Testeable sin DOM; la UI sólo consume el resultado. |
| Render de tarjetas, filtros y temas en DOM | **UI de la demo** | `engine/demo/main.ts`, `engine/demo/hub.css` | Presentación, no reglas. |
| Fullscreen API y foco | **UI de la demo** | `engine/demo/main.ts` (botón + tecla `F`), `engine/index.html` | Es una capacidad del navegador; la escala la calcula el motor. |
| `aria-live`, skip link, reduced-motion, `forced-colors` | **UI de la demo** | `engine/index.html`, `engine/demo/hub.css` | Ya hay base; completar AA. |

### 3.2 Nueva función del motor requerida

```ts
// engine/src/render/thumbnail.ts  (NEW)
export interface ThumbnailOptions {
  readonly width?: number;    // default: world width del juego (o 320)
  readonly height?: number;   // default: world height (o 200)
  readonly format?: 'png' | 'webp';
  readonly withParticles?: boolean; // default: false (evita audio/ruido)
}

/** Captura determinista del estado del juego en `tick` con `seed`. */
export function captureThumbnail<S extends object>(
  game: GameDefinition<S>,
  seed: number = 12345,
  tick: number = 60,
  options: ThumbnailOptions = {},
): string; // dataURL lista para <img src>
```

Contrato de implementación (a respetar al ejecutar):

1. `createGameSimulation(game, { seed })` y avanzar `tick` pasos con cinta vacía (o una cinta corta fija por juego); **sin** `audioPlugin`/`particlesPlugin` para no introducir efectos no deterministas.
2. Canvas offscreen (`document.createElement('canvas')` en navegador; `OffscreenCanvas` si se usa en build Node, con fallback) y `createCanvasRenderer` para aplicar el mismo letterbox que la partida; llamar a `game.render(ctx, state, 0)`.
3. delegar en `canvas.toDataURL(...)`; devolver `${id}:${seed}:${tick}` estable — `engine/test/render-all.test.ts:37-39` ya garantiza que `render()` no muta el estado, así que la captura es reproducible.
4. Caché en `Map<string,string>` por clave `${game.id}|${seed}|${tick}|${w}x${h}`.
5. **Estrategia de publicación:** generar las 32 miniaturas en `npm run build:hub` y escribirlas en `assets/thumbs/<id>.webp`; la tarjeta usa el archivo estático y `captureThumbnail` queda como fallback en runtime. Así se evita generar 32 dataURLs en cada carga y se mantiene el sitio 100 % estático.

### 3.3 Temas con tokens

- `:root` (oscuro, por defecto), `:root[data-theme='light']`, `:root[data-theme='retro']` con los mismos nombres de token: `--bg`, `--panel`, `--ink`, `--muted`, `--line`, `--accent` (+ `--accent-soft`, `--radius`). El tema retro usa tipografía monoespaciada y acento ámbar/verde fósforo sobre fondo casi negro; es una **evolución** del composite actual (`engine/demo/hub.css:22`), no una copia del claro.
- Anti-FOUC: script inline mínimo en `engine/index.html` lee el tema persistido antes del CSS, como `a8a8093^:asset/theme-init.js:1-4`.
- Toggle con `aria-label="Cambiar tema"` y `aria-pressed` o grupo radiobutton («Oscuro / Claro / Retro»), teclado y foco visible; persistencia en `store/` con versión y migración (`engine/src/store/storage.ts:26-34,112-123`).
- Respetar `prefers-color-scheme` si no hay preferencia guardada, y `prefers-reduced-motion` para la transición (`engine/demo/hub.css:217-223`).

### 3.4 Vitrina, fullscreen y accesibilidad

- **Tarjeta:** imagen generada (`<img loading="lazy" alt="...">` o `<canvas role="img">`), número, título, metadatos (`1–2 jug · solo / local`) ya provistos por `gameCard()` (`engine/src/ui/hub-model.ts:61-72`). Densidad equilibrada: una sola fila de metadatos + captura, sin volver a los badges del legacy.
- **Filtros/utilidades:** búsqueda actual (mantener) + filtro por `GameMode` (ya soportado en `filterGames(..., mode)`, `engine/src/ui/hub-model.ts:33-37`) + orden por título/novedades. Vista lista y «juego al azar» son P2 (densidad, no bloqueante).
- **Fullscreen:** botón en `stage__top` junto a dificultad (`index.html:106-116`) y tecla `F`; usa `requestFullscreen()` sobre `#stage` y `createCanvasRenderer.resize()` en el evento `fullscreenchange`; `Esc` devuelve el foco al botón.
- **Pointer:** convertir coordenadas con `CanvasRenderer.toWorld` (`engine/src/render/canvas2d.ts:199-203`) antes de `actions.setPointer`, para que el letterbox no desplace la mirilla (`engine/src/input/host.ts:183-199`).
- **Semilla:** `#game/<id>?seed=<n>` parseado en `hub-model.ts`, mostrado en la vista de juego con botón «Copiar enlace»; `mount()` usa esa semilla en lugar de `SEED = 12345` (`engine/demo/main.ts:38`).
- **AA:** conservar skip link/foco/`aria-live`/reduced motion, añadir `forced-colors`, objetivos ≥24×24 px, contraste verificado en los 3 temas y gate axe en E2E (según `.agents/skills/accessibility/SKILL.md:90-116,220-242,384-405`).

---

## 4. Prioridades y criterios de aceptación medibles

### P0 — bloqueantes antes de `rc`/`1.0.0`

| ID | Acción | Criterio de aceptación | Verificación |
| --- | --- | --- | --- |
| **P0-01** | Cablear letterbox responsive para los 32 juegos | Los 32 usan su `width/height` declarado; sin scroll horizontal en 360×640, 1280×720, 1920×1080; el pointer usa `toWorld`. | Test paramétrico 32 juegos + E2E de 3 viewports. |
| **P0-02** | Pantalla completa en la vista de juego | Botón + tecla `F`; `fullscreenElement` no nulo; sin deformación; `Esc` restaura foco. | E2E dedicada. |
| **P0-03** | Capturas reales generadas por el motor | 32 miniaturas en `assets/thumbs/`, generadas por `captureThumbnail`; dataURL/archivo no vacío y distinto por juego; `alt` no vacío. | Unit × 32 + E2E (`img naturalWidth > 0`). |
| **P0-04** | Temas claro / oscuro / retro con tokens | 3 `[data-theme]` con los mismos tokens; toggle accesible; persisted y sin FOUC; contraste AA en los 3. | E2E de cambio y recarga + axe/Lighthouse. |
| **P0-05** | Reinicio funcional | `R` vuelve al `hash()` del tick 0 con la misma semilla y reanuda el bucle; el mensaje de `aria-live` coincide. | Unit lifecycle + E2E de hash antes/después. |
| **P0-06** | Semilla compartible | Semilla visible/copiable y en la URL; dos contextos con la misma URL producen el mismo hash a N ticks. | Unit determinismo + E2E de dos contextos. |
| **P0-07** | Auditabilidad honesta | `docs/arquitectura.md:60` deja de afirmar thumbnails inexistentes; todo P0 tiene evidencia `archivo:línea` o test que lo demuestre. | Revisión de doc + checklist de esta auditoría. |
| **P0-08** | Regresiones cubiertas por E2E | `e2e/hub.spec.js` añade casos de letterbox, fullscreen, thumbnails, temas, reinicio y semilla; 0 errores de consola. | `npm run test:e2e` en verde **[NO VERIFICADO en esta sesión]**. |
| **P0-09** | CSP y `forced-colors` | `http-equiv="Content-Security-Policy"` equivalente al legacy y bloque `@media (forced-colors: active)` con foco visible. | Inspección del HTML/CSS generados + E2E con `forcedColors:'active'`. |
| **P0-10** | Objetivos táctiles AA | Todos los controles interactivos del HUB miden ≥24×24 px (recomendado 44×44). | axe + E2E `getBoundingClientRect()` sobre botones/selects. |

### P1 — importantes, después de estabilizar P0

| ID | Acción | Criterio de aceptación |
| --- | --- | --- |
| P1-01 | Filtro por modo y orden en la vitrina | `filterGames(games, q, mode)` usado desde la UI; orden por título/novedades; `aria-live` anuncia el recuento. |
| P1-02 | Densidad visual recuperada (meta + captura + estado) | Cada tarjeta muestra captura + metadatos; comparativa visual frente a `a8a8093^` sin iframe. |
| P1-03 | Juice verificado juego a juego | Los 32 emiten ≥1 evento de `JUICE_EVENTS` y se consume sin `step()` contaminado; reduced motion atenúa. |
| P1-04 | Cobertura de >3 niveles y patrones en los 32 juegos | Test paramétrico de `progression.levels.length >= 3` y `patterns` no vacío donde aplique. |
| P1-05 | Persistencia de tema versionada en `store/` | `StorageSchema` con `version` y `migrate`; dato inválido cae al tema por defecto sin romper el HUB. |
| P1-06 | Regenerar `sitemap.xml`/`robots.txt` para las rutas del motor | El `rel="sitemap"` actual deja de devolver 404 (riesgo documentado en `docs/plan-retirada-legacy.md:36`). |

### P2 — deseables

| ID | Acción | Criterio de aceptación |
| --- | --- | --- |
| P2-01 | Vista lista y «juego al azar» del legacy | Controles con `aria-pressed`/`aria-label`; preferencia persistida. |
| P2-02 | Shake/trauma y hit-stop como servicios del motor | Implementados en `render/`/`audio/`, nunca en `step()`; modulados por reduced motion. |
| P2-03 | Logros y estadísticas en el HUB | Consumo de `engine/src/store/achievements.ts` y `scores.ts`, sin volver a `localStorage` directo. |
| P2-04 | Regeneración de miniaturas en CI | `build:hub` falla si falta la captura de algún juego o si dos capturas son idénticas. |

---

## 5. No verificado y límites de esta auditoría

- **No ejecuté** suites, builds ni navegador; todos los estados «OK en motor» se basan en lectura de código y en la existencia de tests, no en una corrida propia. Marcar **[NO VERIFICADO]** en el registro de aceptación hasta ejecutar `npm run check` y `npm run test:e2e`.
- **No verificada** la reproducibilidad visual de las 32 capturas (la función propuesta no existe todavía).
- **No medido** el contraste real de los tokens de `engine/demo/hub.css:4-10` ni el tamaño de objetivos: requiere axe/Lighthouse sobre el sitio servido.
- **No revisado** el comportamiento en GitHub Pages tras el push (pendiente en `TODO.md:24`).
- No se modificó ningún archivo de código, test o configuración. Este documento es el único artefacto nuevo de esta auditoría.
