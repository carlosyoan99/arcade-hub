# 🦖 Dino Runner

**Versión:** 1.4.0 | **Género:** Plataformas | **Última actualización:** 2026-07-30

Corré, saltá y agachate para esquivar cactus y pterodáctilos. La velocidad aumenta con el tiempo. ¿Cuánto podés durar?

## Captura

![Dino Runner en acción](./screenshot.png)

## Controles

| Dispositivo | Acción                                 | Tecla / Control       |
| ----------- | -------------------------------------- | --------------------- |
| ⌨️ Teclado  | Saltar                                 | `Espacio` / `↑`       |
| ⌨️ Teclado  | Agacharse                              | `↓`                   |
| ⌨️ Teclado  | Empezar                                | `Espacio` / `R`       |
| 🎮 Gamepad  | Saltar                                 | Botón A / X           |
| 🎮 Gamepad  | Agacharse                              | Botón B / stick abajo |
| 👆 Táctil   | Botones Saltar y Agacharse en pantalla |                       |

## Características

- 🏃‍♂️ Velocidad progresiva con el tiempo
- 🌵 Cactus de distintos tamaños y clusters
- 🦅 Pterodáctilos a partir de cierta distancia
- 💥 Game feel: screen shake, hit-stop, partículas neon al chocar y al saltar
- 🏆 Récord persistido en `localStorage`
- ♿ Accesibilidad: anuncios `aria-live`, prefers-reduced-motion
- 🌓 Soporte de tema claro/oscuro
- 🎮 Soporte para teclado, táctil y gamepad

## Consejos

- Agacharse solo funciona en el suelo (no en el aire)
- La velocidad máxima se alcanza gradualmente

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
- 3 modos de entrada: teclado (Espacio/↑/↓ + R), táctil (botones responsive), gamepad (polling en loop)
