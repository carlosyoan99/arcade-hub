# 🦅 Joust

**Versión:** 1.2.0 | **Género:** Acción | **Última actualización:** 2026-07-30

Montá tu avestruz y derrotá a los jinetes enemigos en justas aéreas clásicas. Golpeá desde arriba para vencer, recolectá huevos para puntos extra y sobreviví oleadas cada vez más difíciles.

## Captura

![Joust en acción](./screenshot.png)

## Controles

| Dispositivo | Acción                                 | Tecla / Control         |
| ----------- | -------------------------------------- | ----------------------- |
| ⌨️ Teclado  | Mover izquierda                        | `←` / `A`               |
| ⌨️ Teclado  | Mover derecha                          | `→` / `D`               |
| ⌨️ Teclado  | Aletear / Ascender                     | `Espacio` / `↑` / `W`   |
| ⌨️ Teclado  | Reiniciar                              | `R`                     |
| 🎮 Gamepad  | Movimiento                             | Stick izquierdo / D-pad |
| 🎮 Gamepad  | Aletear                                | Botón A                 |
| 👆 Táctil   | Botones en pantalla (visible en móvil) |                         |

## Características

- 🦅 Física de aleteo con inercia horizontal y gravedad
- ⚔️ Justas aéreas: golpeá desde arriba para eliminar enemigos
- 👾 3 tipos de enemigos: Bounders, Hunters y Shadow Lords
- 🥚 Huevos que rebotan en plataformas y eclosionan si no los recolectás
- 🌋 Lago de lava en la base con mano troll que atrapa
- 📈 Oleadas progresivas con dificultad creciente
- 💥 Game feel: screen shake, hit-stop, squash & stretch, partículas neon en colisiones
- 🏆 Puntaje y récord persistidos
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
- Rendimiento: glow sin `shadowBlur` (`drawGlow`), anti-tunneling en sub-pasos, object pooling
- Accesibilidad: `aria-live` announcements, prefers-reduced-motion → `setShakeScale(0)`
- Persistencia en `localStorage` con key namespaced
- 3 modos de entrada: teclado (flechas/WASD + Espacio + R), táctil (botones responsive), gamepad (polling en loop)
