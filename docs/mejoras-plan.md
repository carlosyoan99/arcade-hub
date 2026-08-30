# Plan de Mejoras — Priorizado por Impacto

Estado del proyecto al documentarlo:

| Métrica         | Valor                  |
| --------------- | ---------------------- |
| Líneas de juego | 30,533                 |
| Módulos shared  | 3,156                  |
| Tests           | 2,604 (320 assertions) |
| Hub             | 3,344 (inline CSS+JS)  |
| Juegos          | 32                     |

Criterio de aceptación de cada mejora: `npm run check` verde (lint 0 err/0 warn + format + verify + tests) y, si toca el hub o el arranque de un juego, `npm run test:e2e` verde (66 checks).

---

## 🔴 P1 — Seguridad y Robustez

### 1. CSP sin `unsafe-inline`

`index.html:17` usa `script-src 'self' 'unsafe-inline'` y `style-src 'self' 'unsafe-inline'`. Eso anula la protección CSP contra XSS: cualquier `innerHTML` inyectado puede ejecutar scripts.

- Enlace: con el punto 5, tras extraer el CSS y JS a `asset/hub.css` y `asset/hub.js`, quitar ambos `unsafe-inline` del CSP.
- Nota: el inline `document.documentElement.dataset.theme` (anti-FOUC de tema) y el OG/favicon data-URI quedan cubiertos por `script-src 'self'`/`data:` según corresponda; verificar que no rompa el tema claro/oscuro ni el SW.
- Esfuerzo: medio (2,000+ líneas JS + 1,200 líneas CSS a mover, ver punto 5). Verifica: E2E hub + offline-pwa.

### 2. `shared/storage.js` con try/catch (30/32 juegos expuestos)

Solo `pong` y `neon-nexus` manejan errores de `localStorage`. Los otros 30 crashean si el storage está bloqueado (modo incógnito, políticas corporativas, Safari privado).

- Crear `shared/storage.js` con `lsGet(key, fallback)` / `lsSet(key, value)` envolviendo en try/catch, y reemplazar los accesos directos en los 30 juegos + `shared/` + hub.
- Conservar prefijos históricos (`<gameId>_*`, `arcadehub_*`, `ach_data`, `<prefix>_best`).
- Esfuerzo: bajo (helper ~10 líneas + reemplazo mecánico). Agregar el módulo a `sw.js` FILES (`npm run verify:sw`) y subir `STATIC_CACHE`.

### 3. Cleanup de event listeners (0/32 juegos)

Los juegos agregan `keydown`/`keyup`/`touchstart` a `window` y nunca los remueven. Corren en iframes, así que no hay leaks reales, pero dificulta el testing y la re-entrada.

- Agregar un `cleanup()` en el shell compartido (`shared/shell.js`) que remueva listeners al salir (ya existe `shell.cleanup()` para loop/música; extenderlo al input).
- Enmarcar cada `addEventListener` del juego para poder removerlo; refactor del patrón de input en cada juego vía `shared/input.js` (`createGamepad` ya existe).
- Esfuerzo: medio.

---

## 🟡 P2 — Calidad del Código

### 4. `rnd()` / `wrap()` duplicados → `shared/collide.js`

`gradius` y `raiden` definen `rnd(a, b)` idéntico; `asteroids` y `pole-position` tienen `wrap()` similar. `shared/collide.js` ya existe como módulo de helpers.

- Exportar `rnd(a, b)` y `wrap(n, min, max)` desde `shared/collide.js` y reemplazar las definiciones locales.
- Esfuerzo: bajo. Verificar que `verify` no marque `collide.js` como no-usado tras el cambio (sí lo importan raiden/gradius/double-dragon).

### 5. Separar el hub inline → `asset/hub.css` y `asset/hub.js`

`index.html` mezcla CSS (~1,200 líneas), JS (~1,500 líneas) y HTML. Dificulta mantenimiento y obliga a `unsafe-inline` (punto 1).

- Mover a `asset/hub.css` y `asset/hub.js`; dejar solo HTML en `index.html` (más el anti-FOUC del tema y meta tags).
- En `dev` cargarlos con `<link>`/`<script src>`; agregarlos a `sw.js` FILES (`npm run verify:sw`) y subir `STATIC_CACHE`.
- Esfuerzo: alto, mayor mantenibilidad. ⚠ Los archivos `asset/hub.css` / `asset/hub.js` ya existen como WIP (untracked) de otro agente; coordinar para no pisarlos.

---

## 🟡 P3 — Cobertura y Seguridad

### 6. Tests de lógica de gameplay

Los tests actuales solo verifican existencia de canvas, occlusion del overlay y teclas. No verifican colisiones, scoring, niveles ni game over (salvo los `gameplay-frames` que ejercitan frames).

- Agregar assertions de lógica: `score` sube al colisionar, el nivel avanza, `game over` ocurre correctamente. Idealmente por `games.js` (los jsdom smoke tests ya iteran el manifest).
- Esfuerzo: alto (requiere entender la lógica de cada juego).

### 7. `innerHTML` → `textContent` + CSS (hint text)

10+ juegos usan `innerHTML` para renderizar texto con `<kbd>`. Es XSS-safe (contenido estático), pero `textContent` + CSS para styling de `<kbd>` sería más segura y consistente.

- Esfuerzo: bajo.

---

## 🟢 P4 — Pulido

### 8. Documentar imports indirectos de `shared/help.js` y `shared/settings.js`

No son importados por juegos directamente (se cargan vía `shell.js`); `verify` los reporta como warning (falso positivo ya documentado en AGENTS.md). Opciones: documentar, o re-exportarlos desde `shell.js`.

- Esfuerzo: bajo.

### 9. Comprimir screenshots

Los PNG pesan 300–575KB cada uno; 32 × ~400KB ≈ 12MB en total (regenerados por `scripts/shots.js`).

- Comprimir con `pngquant` o convertir a WebP apuntando desde `games.js`/hub-cards (el SW `FILES` debe referir los formatos finales); meta a ~50KB por screenshot.
- Esfuerzo: bajo. Verificar visualmente el resultado (las capturas son escenas neón oscuras; no perder contraste del estilo qbert/raiden).

---

## Resumen Priorizado

| #   | Mejora                          | Impacto           | Esfuerzo | Prioridad |
| --- | ------------------------------- | ----------------- | -------- | --------- |
| 1   | CSP sin `unsafe-inline`         | 🔴 Seguridad      | Medio    | P1        |
| 2   | `shared/storage.js` (try/catch) | 🔴 Robustez       | Bajo     | P1        |
| 3   | Cleanup de event listeners      | 🔴 Buena práctica | Medio    | P2        |
| 4   | `rnd()`/`wrap()` a `shared/`    | 🟡 DRY            | Bajo     | P2        |
| 5   | Separar hub inline              | 🟡 Mantenibilidad | Alto     | P3        |
| 6   | Tests de gameplay logic         | 🟡 Cobertura      | Alto     | P3        |
| 7   | `innerHTML` → `textContent`     | 🟢 Seguridad      | Bajo     | P3        |
| 8   | Documentar imports indirectos   | 🟢 Claridad       | Bajo     | P4        |
| 9   | Comprimir screenshots           | 🟢 Performance    | Bajo     | P4        |

Reglas de trabajo: commits por tarea (conventional commits, logs en español), tocar solo lo asignado a cada agente, y nunca commitear archivos mid-edit de otro agente. Cada cambio termina con `npm run check`.
