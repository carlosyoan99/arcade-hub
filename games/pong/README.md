# 🏓 Pong

**Versión:** 1.4.0 | **Género:** Deportes | **Última actualización:** 2026-07-30

El clásico de tenis de mesa recreado en canvas 2D. Primero en llegar a 7 puntos gana.

## Captura

![Pong en acción](./screenshot.png)

## Controles

| Dispositivo | Acción                                     | Tecla / Control         |
| ----------- | ------------------------------------------ | ----------------------- |
| ⌨️ Teclado  | Mover arriba                               | `↑` / `W`               |
| ⌨️ Teclado  | Mover abajo                                | `↓` / `S`               |
| ⌨️ Teclado  | Empezar / Sacar                            | `Espacio` / `Enter`     |
| ⌨️ Teclado  | Reiniciar                                  | `R`                     |
| 🎮 Gamepad  | Movimiento                                 | Stick izquierdo / D-pad |
| 🎮 Gamepad  | Acción                                     | Botón A / Start         |
| 👆 Táctil   | Botones ▲ ▼ en pantalla (visible en móvil) |                         |

## Características

- 🎯 IA de la paleta rival con seguimiento progresivo
- 💥 Game feel: screen shake, hit-stop, squash & stretch, partículas neon al golpear la pelota y al anotar
- 📊 Contador de victorias persistido en `localStorage`
- ♿ Accesibilidad: anuncios `aria-live`, focus trapping, prefers-reduced-motion
- 🌓 Soporte de tema claro/oscuro
- 🎮 Soporte para teclado, táctil y gamepad

## Consejos

- Tratá de mantener la pelota en el centro de la paleta para tener más control de la dirección
- La velocidad de la pelota aumenta con cada golpe

## Detalles técnicos

- Canvas 2D sin dependencias externas
- Game loop con `shared/loop.js` (`createGameLoop` con RAF + dt + cleanup)
- Canvas responsive con `shared/display.js` (`setupCanvas` con DPR + letterboxing + resize debounce)
- HTML compartido inyectado vía `shared/dom.js` (`injectCommonElements`)
- Estilos neon desde `shared/base.css` (overlay, HUD, touch controls, game bar, noise CRT)
- Audio sintetizado con `shared/audio.js` (Web Audio API: beep, ambient drone)
- Game feel: screen shake por trauma, hit-stop, squash & stretch, partículas con object pool (500), `feedbackBundle` por tiers
- Rendimiento: glow sin `shadowBlur` (`drawGlow`), anti-tunneling en sub-pasos, object pooling
- Accesibilidad: `aria-live` announcements, `trapTab()` focus trapping, prefers-reduced-motion → `setShakeScale(0)`
- Persistencia en `localStorage` con key namespaced (`pong2d_wins`)
- 3 modos de entrada: teclado (flechas/WASD + Espacio + R), táctil (botones responsive), gamepad (polling en loop)
