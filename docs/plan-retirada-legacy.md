# Plan de retirada del Hub legacy — ✅ EJECUTADO

> 25-nov-2026 (plan) · **26-nov-2026 (ejecutado)** · Condiciones, pasos y rollback para eliminar `games/`, `shared/` y el hub antiguo.
> Commit: `chore: retirar hub legacy tras paridad` · Hash golden verificado antes y después: `600:3336926330:e22d095e-20`.

## 1. Situación actual

D9 cerró el Hub legacy como **referencia congelada**. El objetivo final del usuario pedía además eliminar el código viejo y residual una vez validado el motor. Tras la paridad de los 32 juegos, el legacy se ha **retirado** y D9 se ha revisado: la referencia histórica queda en `docs/`.

## 2. Condiciones previas (comprobadas antes de borrar)

1. ✅ Los 32 juegos migrados tienen `render()` y son jugables en navegador; verificado por `engine/test/render-all.test.ts`.
2. ✅ `engine/src/input/host.ts` cablea teclado, gamepad, táctil y puntero con `pointerup`/`pointercancel` a las acciones nombradas (`engine/test/input-host.test.ts`).
3. ✅ El HUB nuevo en `engine/index.html` + `engine/demo/` lista y lanza los 32 juegos sin iframes.
4. ✅ `npm test -w @arcade/engine` en verde (334 tests), `tsc` limpio, build de librería y de HUB OK.
5. ✅ Paridad comprobada para cada juego: controles documentados, juice (eventos → partículas/audio), puntuación y dificultad progresiva.
6. ⚠️ La E2E legacy (Playwright) **no se ejecutó en esta retirada**: sus dependencias y su configuración se eliminan con el código viejo. La validación del sitio publicado es por build + inspección del `index.html` generado (sin `<iframe>`, con los `assets/` del build). Queda como riesgo pendiente una E2E del HUB nuevo en navegador real.

## 3. Pasos ejecutados

1. Se copiaron al `engine/index.html` los bloques SEO completos del legacy: Open Graph, Twitter, JSON-LD (`website-schema`, `game-schema`, `itemlist-schema`), `canonical`, `robots`, `sitemap` y `favicon`, con la descripción actualizada a «32 juegos arcade sobre Arcade Engine». Se conservan `lang`, `viewport` y el skip-link del HUB nuevo.
2. `engine/vite.hub.config.ts` publica ahora en la raíz (`outDir: '..'`, `emptyOutDir: false`, `base: './'`). `npm run build:hub -w @arcade/engine` genera `index.html` + `assets/`; el HTML resultante no contiene `<iframe>` y referencia los `assets/` generados.
3. `git rm -r` de `games/`, `shared/`, `asset/`, `test/`, `e2e/`, `scripts/`, `playwright.config.js`, `sw.js`, `sitemap.xml`, `robots.txt` y `games.js`. La raíz `index.html` pasa a ser el artefacto generado.
4. `package.json` de la raíz: scripts `test`, `test:server`, `build`, `build:hub`, `dev`, `start`, `typecheck` y `check`; Eliminados `verify`, `verify:sw`, e2e/jsdom/playwright legacy y los scripts `lint`/`format` (su configuración solo cubría JS, no TS). `description` y `workspaces` actualizados (`engine`, `server`).
5. `sw.js`, `sitemap.xml` y `robots.txt` se eliminan con el resto del legacy (no se regeneran); los enlaces SEO se conservan en el HTML generado. Ver riesgos.
6. D9 (v0 y DDT-F0) pasa a «legacy retirado; referencia histórica en `docs/`». El plan queda marcado como EJECUTADO y el banner de la investigación histórica indica que el legacy ya no existe y que B1-B8 se conservan como registro.
7. Referencias obsoletas eliminadas de README/AGENTS/CLAUDE/CONTRIBUTING/TODO y del resto de `docs/`; añadidas notas de rollback y del hash golden vigente.
8. Commit atómico `chore: retirar hub legacy tras paridad` (sin push desde este ámbito).

## 4. Rollback

La retirada es un único commit atómico. Para deshacerla: `git revert <hash-del-commit>` (o `git revert HEAD` si es el último). Eso restaura el Hub legacy sin tocar `engine/`, `engine/src/**`, `engine/test/**`, `engine/demo/**` ni `server/**`. Antes y después se registró el hash golden `600:3336926330:e22d095e-20` y el número de tests (334 en el engine + los del servidor).

## 5. Riesgos

- `sitemap.xml` y `robots.txt` se han borrado, pero el HTML generado mantiene `rel="sitemap"` y `canonical`: el sitemap devolverá 404 en GitHub Pages hasta que se publique uno nuevo para las rutas del motor.
- El favicon se copió a `favicon.svg` en la raíz para que el enlace y `og:image`/`twitter:image` sigan apuntando a un archivo existente; antes estaba en `asset/icons/favicon.svg`.
- Vite avisa de que `outDir` es padre de la raíz del proyecto; con `emptyOutDir: false` el build no borra fuentes y se ha verificado el resultado.
- Los workflows `.github/workflows/deploy.yml` y `e2e.yml` siguen invocando `npm run lint`, `npm run format`, `npm run verify` y `npx playwright test`, scripts/dependencias ya retirados: **habrá que actualizarlos** antes del próximo push (fuera del ámbito de esta tarea).
- Falta una E2E en navegador real del HUB nuevo, ahora que la suite Playwright legacy no existe.
