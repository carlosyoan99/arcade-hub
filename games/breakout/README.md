# 🧱 Breakout

**Versión:** 1.4.0 | **Género:** Arcade | **Última actualización:** 2026-07-30

Rompe todos los ladrillos con la pelota. 5 filas de colores, niveles progresivos y récord persistido.

## Captura

![Breakout en acción](./screenshot.png)

## Controles

| Dispositivo | Acción                           | Tecla / Control         |
| ----------- | -------------------------------- | ----------------------- |
| ⌨️ Teclado  | Mover izquierda                  | `←` / `A`               |
| ⌨️ Teclado  | Mover derecha                    | `→` / `D`               |
| ⌨️ Teclado  | Lanzar / Empezar                 | `Espacio`               |
| ⌨️ Teclado  | Reiniciar                        | `R`                     |
| 🎮 Gamepad  | Movimiento                       | Stick izquierdo / D-pad |
| 🎮 Gamepad  | Lanzar                           | Botón A                 |
| 👆 Táctil   | Botones ◀ ▶ + Lanzar en pantalla |                         |

## Características

- 🧱 5 filas de ladrillos con puntajes decrecientes
- ⚡ Velocidad progresiva por nivel
- 💥 Game feel: screen shake, hit-stop, squash & stretch, partículas neon al romper ladrillos
- 🏆 Récord persistido en `localStorage`
- ♿ Accesibilidad: anuncios `aria-live`, prefers-reduced-motion
- 🎮 Soporte para teclado, táctil y gamepad

## Consejos

- Tratá de mantener la pelota en el centro de la paleta para tener más control de la dirección
- Los ladrillos más altos dan más puntos

## Detalles técnicos

- Canvas 2D sin dependencias externas
- Game loop con `shared/loop.js` (`createGameLoop` con RAF + dt + cleanup)
- Canvas responsive con `shared/display.js` (`setupCanvas` con DPR + letterboxing + resize debounce)
- HTML compartido inyectado vía `shared/dom.js` (`injectCommonElements`)
- Estilos neon desde `shared/base.css` (overlay, HUD, touch controls, game bar, noise CRT)
- Audio sintetizado con `shared/audio.js` (Web Audio API: beep)
- Game feel: screen shake por trauma, hit-stop, squash & stretch, partículas con object pool (500), `feedbackBundle` por tiers
- Rendimiento: glow sin `shadowBlur` (`drawGlow`), anti-tunneling en sub-pasos, object pooling
- Accesibilidad: `aria-live` announcements, prefers-reduced-motion → `setShakeScale(0)`
- Persistencia en `localStorage` con key namespaced
- 3 modos de entrada: teclado (flechas + Espacio + R), táctil (botones responsive), gamepad (polling en loop)
