# Plan de retirada del Hub legacy

> 25-nov-2026 · Condiciones, pasos y rollback para eliminar `games/`, `shared/` y el hub antiguo.

## 1. Situación actual

D9 cerró el Hub legacy como **referencia congelada**. El objetivo final del usuario pide además **eliminar el código viejo y residual cuando el nuevo esté validado y funcional**. Ambas cosas son compatibles así: se mantiene la referencia hasta que el motor pueda servir los 32 juegos por sí mismo; entonces se retira y se revisa D9.

## 2. Condiciones previas (todas deben cumplirse)

1. Los 32 juegos migrados tienen `render()` y son jugables en navegador (no solo en modo lógica).
2. `engine/src/input/host.ts` cablea teclado, gamepad, táctil y puntero con `pointerup`/`pointercancel` a las acciones nombradas.
3. Existe un HUB nuevo servido desde `engine/` que lista y lanza los 32 juegos sin iframes legacy.
4. `npm test -w @arcade/engine` en verde (con los tests de render/input nuevos), `tsc` limpio y build OK.
5. Paridad comprobada para cada juego: controles documentados, juice (eventos → partículas/audio), puntuación y dificultad progresiva.
6. Se ha ejecutado la E2E en navegador real (o se documenta el bloqueo por falta de Chrome).

## 3. Pasos de retirada

1. Publicar el HUB nuevo en la raíz (o servir `engine/dist/`), manteniendo los meta/SEO.
2. Eliminar `games/`, `shared/`, `asset/`, `index.html` legacy, `test/smoke.test.js`, `scripts/verify.js`, `playwright.config.js` y `e2e/` antiguo **solo después** de reescribir sus comprobaciones para el motor.
3. Actualizar `package.json`: quitar scripts legacy (`verify`, `verify:sw`, `test` jsdom, e2e antiguo), dejar los del engine como scripts raíz.
4. Actualizar `sw.js`/`sitemap.xml`/`robots.txt` a las rutas del motor.
5. Revisar D9: de "congelado como referencia" a "retirado; la referencia histórica queda en `docs/`".
6. Borrar referencias obsoletas en README/AGENTS/CLAUDE/CONTRIBUTING/TODO y docs.
7. Commit atómico `chore: retirar hub legacy tras paridad` y push.

## 4. Rollback

Todo se hace con git: cada fase tiene commit propio y se conserva el tag/antecesor anterior. Si una comprobación falla, `git revert <commit>` restaura el legacy sin tocar el motor. Antes y después se registra el hash golden `600:3336926330:e22d095e-20` y el número de tests.

## 5. Riesgos

- El Hub rediseñado actual aún depende de los iframes legacy; el nuevo HUB debe estar listo antes de borrarlos.
- Los meta/SEO de `index.html` deben sobrevivir al cambio de servidor.
- Las rutas publicadas en GitHub Pages cambian: actualizar `canonical`, `sitemap.xml` y `sw.js`.
