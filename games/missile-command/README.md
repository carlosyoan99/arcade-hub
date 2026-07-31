# 🚀 Missile Command

**Versión:** 1.3.0 | **Género:** Defensa | **Última actualización:** 2026-07-30

Defendé tus ciudades de misiles enemigos. Apuntá con el mouse o el stick y dispará interceptores. Misiles inteligentes y satélites desde la oleada 2.

## Captura

![Missile Command en acción](./screenshot.png)

## Controles

| Dispositivo | Acción              | Tecla / Control           |
| ----------- | ------------------- | ------------------------- |
| 🖱️ Mouse    | Apuntar             | Mover el cursor           |
| 🖱️ Mouse    | Disparar            | Click izquierdo / Espacio |
| ⌨️ Teclado  | Empezar / Reiniciar | `Espacio` / `R`           |
| 🕹️ Gamepad  | Apuntar             | Stick izquierdo           |
| 🕹️ Gamepad  | Disparar            | Botón A / X               |
| 👆 Táctil   | Apuntar y disparar  | Tocar la pantalla         |

## Características

- 🚀 Misiles enemigos con estela, desde 3 direcciones
- 💥 Interceptores con explosión de área (daña misiles cercanos)
- 🏙️ 6 ciudades para defender
- 🎯 Misiles inteligentes que cambian de dirección (oleada 2+)
- 🛰️ Satélites que lanzan múltiples misiles (oleada 2+)
- 💥 Game feel: screen shake, hit-stop, partículas neon en explosiones
- 🏆 Récord persistido en `localStorage`
- ♿ Accesibilidad: anuncios `aria-live`, prefers-reduced-motion
- 🎮 Soporte para mouse, teclado, gamepad y táctil

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
- 4 modos de entrada: mouse, teclado (flechas + Espacio + R), táctil (tap), gamepad (polling en loop)
