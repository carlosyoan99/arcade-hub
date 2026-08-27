# ◈ Neon Nexus

**Versión:** 1.7.0 | **Género:** Tower Defense Roguelike | **Última actualización:** 2026-08-26

Defiende tu torre geométrica contra oleadas de formas neon. La torre dispara automáticamente, haz clic para daño extra, mejora con estrellas y elige cartas de poder entre oleadas.

## Captura

![Neon Nexus en acción](./screenshot.png)

## Controles

| Dispositivo          | Acción                                  | Tecla / Control       |
| -------------------- | --------------------------------------- | --------------------- |
| 🖱️ Mouse / 👆 Táctil | Click de daño extra                     | Click / Tap en canvas |
| ⌨️ Teclado           | Mejorar ATK                             | `1`                   |
| ⌨️ Teclado           | Mejorar HP                              | `2`                   |
| ⌨️ Teclado           | Mejorar Velocidad                       | `3`                   |
| ⌨️ Teclado           | Empezar / Reiniciar                     | `Espacio` / `R`       |
| ⌨️ Teclado           | Tienda (tras game over)                 | `T`                   |
| 🎮 Gamepad           | Click daño                              | Botón A               |
| 🎮 Gamepad           | Empezar                                 | Start                 |
| 👆 Táctil            | Botones de mejora + disparo en pantalla |                       |

## Características

- 🗼 Torre que dispara automáticamente a los enemigos
- 🃏 Sistema de cartas roguelike entre oleadas (17 cartas únicas)
- ⭐ Mejoras en tiempo real (ATK, HP, Velocidad) con estrellas
- 🏪 Tienda permanente con mejoras entre runs
- 🎯 Enemigos camuflados (requieren la card Scanner para verlos) y voladores (oleada 6+)
- 👑 Boss waves cada 5 oleadas (HP ×8, daño ×3)
- 👁️ Wave preview: muestra la composición de la próxima oleada
- 🔍 Card Prioridad: la torre apunta al enemigo con más HP
- 🎯 Card Francotirador (×2 daño, ×0.5 cadencia) y 📡 Card Scanner (detecta camuflados)
- 🔄 Combinaciones de cartas: Cadena, Vampirismo, Multishot, Explosión, Escudo, Drenar, Torreta, Ralentización Global y más
- 💥 Game feel: screen shake, hit-stop, partículas neon en impactos y kills
- 🏆 Récord de oleada persistido en `localStorage`
- 🎖️ 5 logros desbloqueables (primer kill, oleadas 5/10/20, aniquilador, comprador)
- ♿ Accesibilidad: anuncios `aria-live`, prefers-reduced-motion
- 🎮 Soporte para mouse, teclado, táctil y gamepad

## Logros

- 🎯 **Primera sangre** — Eliminá tu primer enemigo
- 🌊 **Sobreviviente** — Llegá a la oleada 5
- 🏰 **Imbatible** — Llegá a la oleada 10
- ☠️ **Aniquilador** — Eliminá 50 enemigos en una partida
- 🛒 **Comprador** — Hacé tu primera compra en la tienda
- 🗿 **Coloso** — Llegá a la oleada 20

## Detalles técnicos

- Canvas 2D sin dependencias externas
- Game loop con `shared/loop.js` (`createGameLoop` con RAF + dt + cleanup)
- Canvas responsive con `shared/display.js` (`setupCanvas` con DPR + letterboxing + resize debounce)
- HTML compartido inyectado vía `shared/dom.js` (`injectCommonElements`)
- Estilos neon desde `shared/base.css` (overlay, HUD, touch controls, game bar, noise CRT)
- Audio sintetizado con `shared/audio.js` (Web Audio API: beep, ambient drone)
- Game feel: screen shake por trauma, hit-stop, squash & stretch, partículas con object pool (500), `feedbackBundle` por tiers
- Rendimiento: glow sin `shadowBlur` (`drawGlow`), anti-tunneling en sub-pasos, object pooling
- Accesibilidad: `aria-live` announcements, `trapTab()` focus trapping, prefers-reduced-motion → `setShakeScale(0)`, modal de ayuda accesible (role=dialog + focus trap), canvas con `role="img"`, zoom móvil habilitado, `:focus-visible` global
- Persistencia en `localStorage` con key namespaced (`neonNexus_coins`, `neonNexus_best`)
- 4 modos de entrada: mouse/click, teclado (1/2/3 + Espacio + R + T), táctil (tap + botones), gamepad (polling en loop)

## Changelog

- **1.7.0** (2026-08-27): stopMusic/stopAmbient + ambient drone único
- **1.6.0** (2026-08-26): TD genre parity — enemigos camuflados (requieren Scanner), voladores (oleada 6+), boss waves cada 5 oleadas (HP ×8, daño ×3), wave preview y targeting priority (Prioridad → más HP); nuevas cards Francotirador, Scanner y Prioridad; logro de oleada 20
- **1.5.0** (2026-08-26): Refactor — shell compartido `shared/shell.js` (game-bar, trampa de Tab y cleanup unificados); fix: libera la trampa de Tab al terminar partida y el botón hub funciona dentro del iframe del hub
- **1.4.2** (2026-08-26): Música lofi procedural vía `shared/music.js` + toggle 🎵 en game-bar (preferencia global persistida)
- **1.4.1** (2026-08-12): Sistema de logros completo — 5 logros con `achievements.unlock()` (primer kill, oleada 5, oleada 10, aniquilador, comprador)
- **1.4.0** (2026-07-30): Game feel completo — `feedbackBundle()` integrado + squash & stretch + hit-stop; P0: `shadowBlur` eliminado de loops con `drawGlow()`; lint 0 errores/0 warnings; R3: constantes extraídas (spawn, escudo, upgrades); fix `injectCommonElements()` restaurado
- **1.3.0** (2026-07-30): Migración a `shared/loop.js`; `shimmerFlow` a `base.css`; `drawGlow()` y `feedbackBundle()`
- **1.2.0** (2026-07-30): Canvas ID unificado + `setupCanvas()` vía `shared/display.js`; HTML compartido vía `shared/dom.js`
- **1.1.0** (2026-07-28): Refactor CSS a estética neon compartida en `base.css`; README con controles y descripción; nuevas cartas (Drenar, Torreta Auxiliar, Escudo Regenerativo, Ralentización Global); balance de oleadas; fix botón de ayuda
- **1.0.0** (2026-07-28): Versión inicial del juego
