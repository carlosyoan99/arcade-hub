# ⛏️ Dig Dug

**Versión:** 1.3.0 | **Género:** Arcade | **Última actualización:** 2026-07-30

Excavá túneles en la tierra, inflá a los enemigos hasta que exploten o derrumbá rocas sobre ellos. Dos tipos de enemigos con IA propia.

## Captura

![Dig Dug en acción](./screenshot.png)

## Controles

| Dispositivo | Acción              | Tecla / Control       |
| ----------- | ------------------- | --------------------- |
| ⌨️ Teclado  | Mover               | `↑ ↓ ← →` / `W A S D` |
| ⌨️ Teclado  | Inflar / Bomba      | `Espacio`             |
| ⌨️ Teclado  | Empezar / Reiniciar | `R`                   |
| 🎮 Gamepad  | Movimiento          | D-pad / Stick         |
| 🎮 Gamepad  | Acción              | Botón A               |
| 👆 Táctil   | Botones en pantalla |                       |

## Características

- ⛏️ Sistema de excavación de túneles en terreno sólido
- 🎈 Inflar enemigos hasta que exploten
- 🪨 Rocas que caen y aplastan enemigos
- 👾 Dos tipos de enemigos: Pooka (redondo) y Fygar (dragón)
- 💥 Game feel: screen shake, hit-stop, partículas neon al inflar y explotar
- 🏆 Récord persistido en `localStorage`
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
- 3 modos de entrada: teclado (flechas/WASD + Espacio + R), táctil (botones responsive), gamepad (polling en loop)
