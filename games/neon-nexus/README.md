# ◈ Neon Nexus

**Versión:** 1.3.0 | **Género:** Tower Defense Roguelike | **Última actualización:** 2026-07-30

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
- 🃏 Sistema de cartas roguelike entre oleadas (15 cartas únicas)
- ⭐ Mejoras en tiempo real (ATK, HP, Velocidad) con estrellas
- 🏪 Tienda permanente con mejoras entre runs
- 🔄 Combinaciones de cartas: Cadena, Vampirismo, Multishot, Explosión, Escudo, Drenar, Torreta, Ralentización Global y más
- 💥 Game feel: screen shake, hit-stop, partículas neon en impactos y kills
- 🏆 Récord de oleada persistido en `localStorage`
- ♿ Accesibilidad: anuncios `aria-live`, prefers-reduced-motion
- 🎮 Soporte para mouse, teclado, táctil y gamepad

## Detalles técnicos

- Canvas 2D sin dependencias externas
- Game loop con `shared/loop.js` (`createGameLoop` con RAF + dt + cleanup)
- Canvas responsive con `shared/display.js` (`setupCanvas` con DPR + letterboxing + resize debounce)
- HTML compartido inyectado vía `shared/dom.js` (`injectCommonElements`)
- Estilos neon desde `shared/base.css` (overlay, HUD, touch controls, game bar, noise CRT)
- Audio sintetizado con `shared/audio.js` (Web Audio API: beep, ambient drone)
- Game feel: screen shake por trauma, hit-stop, squash & stretch, partículas con object pool (500), `feedbackBundle` por tiers
- Rendimiento: glow sin `shadowBlur` (`drawGlow`), anti-tunneling en sub-pasos, object pooling
- Accesibilidad: `aria-live` announcements, prefers-reduced-motion → `setShakeScale(0)`
- Persistencia en `localStorage` con key namespaced (`neonNexus_coins`, `neonNexus_best`)
- 4 modos de entrada: mouse/click, teclado (1/2/3 + Espacio + R + T), táctil (tap + botones), gamepad (polling en loop)
