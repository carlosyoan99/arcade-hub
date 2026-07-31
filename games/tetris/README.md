# 🧊 Tetris

**Versión:** 1.4.0 | **Género:** Puzzle | **Última actualización:** 2026-07-30

Armá líneas con las 7 piezas que caen. Rotación, ghost piece, niveles progresivos. ¡Clásico infinito!

## Captura

![Tetris en acción](./screenshot.png)

## Controles

| Dispositivo | Acción                                   | Tecla / Control     |
| ----------- | ---------------------------------------- | ------------------- |
| ⌨️ Teclado  | Mover izquierda                          | `←` / `A`           |
| ⌨️ Teclado  | Mover derecha                            | `→` / `D`           |
| ⌨️ Teclado  | Rotar                                    | `↑` / `W`           |
| ⌨️ Teclado  | Caída rápida                             | `↓` / `S`           |
| ⌨️ Teclado  | Soltar (hard drop)                       | `Espacio`           |
| ⌨️ Teclado  | Guardar pieza                            | `C`                 |
| ⌨️ Teclado  | Pausa                                    | `P` / `Escape`      |
| 🎮 Gamepad  | Mover / Rotar                            | D-pad + botones A/B |
| 👆 Táctil   | Botones en pantalla (← → rotar ⬇ soltar) |                     |

## Características

- 🟦 7 piezas clásicas (I, O, T, S, Z, J, L)
- 👻 Ghost piece que muestra dónde caerá la pieza
- ⚡ Niveles progresivos que aumentan la velocidad
- 💥 Game feel: screen shake, hit-stop, partículas neon al completar líneas
- 🏆 Récord de líneas persistido en `localStorage`
- ♿ Accesibilidad: anuncios `aria-live`, prefers-reduced-motion
- 🎮 Soporte para teclado, táctil y gamepad

## Detalles técnicos

- Canvas 2D sin dependencias externas
- Game loop con `shared/loop.js` (`createGameLoop` con RAF + dt + cleanup)
- Canvas responsive con `shared/display.js` (`setupCanvas` con DPR + letterboxing + resize debounce)
- HTML compartido inyectado vía `shared/dom.js` (`injectCommonElements`)
- Estilos neon desde `shared/base.css` (overlay, HUD, touch controls, game bar, noise CRT)
- Audio sintetizado con `shared/audio.js` (Web Audio API: beep, ambient drone)
- Game feel: screen shake por trauma, hit-stop, squash & stretch, partículas con object pool (500), `feedbackBundle` por tiers
- Rendimiento: glow sin `shadowBlur` (`drawGlow`), object pooling
- Accesibilidad: `aria-live` announcements, prefers-reduced-motion → `setShakeScale(0)`
- Persistencia en `localStorage` con key namespaced
- 3 modos de entrada: teclado (flechas/WASD + Espacio + C + P), táctil (botones responsive), gamepad (polling en loop)
