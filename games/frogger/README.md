# 🐸 Frogger

**Versión:** 1.4.0 | **Género:** Arcade | **Última actualización:** 2026-07-30

Cruzá la calle y el río esquivando autos, camiones y cayendo al agua. ¡Llegá a las 5 zonas seguras!

## Captura

![Frogger en acción](./screenshot.png)

## Controles

| Dispositivo | Acción                        | Tecla / Control |
| ----------- | ----------------------------- | --------------- |
| ⌨️ Teclado  | Mover arriba                  | `↑` / `W`       |
| ⌨️ Teclado  | Mover abajo                   | `↓` / `S`       |
| ⌨️ Teclado  | Mover izquierda               | `←` / `A`       |
| ⌨️ Teclado  | Mover derecha                 | `→` / `D`       |
| ⌨️ Teclado  | Empezar / Reiniciar           | `Espacio` / `R` |
| 🎮 Gamepad  | Movimiento                    | D-pad / Stick   |
| 👆 Táctil   | D-pad direccional en pantalla |                 |

## Características

- 🚗 Múltiples carriles con vehículos (autos, camiones)
- 🪵 Troncos flotantes y tortugas para cruzar el río
- 🏆 5 zonas seguras para completar el nivel
- 💥 Game feel: screen shake, hit-stop, partículas neon al morir y al completar nivel
- 🏆 Récord persistido en `localStorage`
- ♿ Accesibilidad: anuncios `aria-live`, prefers-reduced-motion
- 🎮 Soporte para teclado, táctil y gamepad

## Detalles técnicos

- Canvas 2D sin dependencias externas
- Game loop con `shared/loop.js` (`createGameLoop` con RAF + dt + cleanup)
- Canvas responsive con `shared/display.js` (`setupCanvas` con DPR + letterboxing + resize debounce)
- HTML compartido inyectado vía `shared/dom.js` (`injectCommonElements`)
- Estilos neon desde `shared/base.css` (overlay, HUD, touch controls, game bar, noise CRT)
- Audio sintetizado con `shared/audio.js` (Web Audio API: beep)
- Game feel: screen shake por trauma, hit-stop, squash & stretch, partículas con object pool (500), `feedbackBundle` por tiers
- Rendimiento: glow sin `shadowBlur` (`drawGlow`), object pooling
- Accesibilidad: `aria-live` announcements, prefers-reduced-motion → `setShakeScale(0)`
- Persistencia en `localStorage` con key namespaced
- 3 modos de entrada: teclado (flechas/WASD + Espacio + R), táctil (d-pad responsive), gamepad (polling en loop)
