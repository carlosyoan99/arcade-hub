# 🦍 Donkey Kong

**Versión:** 1.3.0 | **Género:** Plataformas | **Última actualización:** 2026-07-30

Ayudá a Mario a escalar la obra en construcción. Esquivá los barriles que lanza Donkey Kong, subí por las escaleras y llegá hasta la cima.

## Captura

![Donkey Kong en acción](./screenshot.png)

## Controles

| Dispositivo | Acción                                       | Tecla / Control         |
| ----------- | -------------------------------------------- | ----------------------- |
| ⌨️ Teclado  | Mover izquierda                              | `←` / `A`               |
| ⌨️ Teclado  | Mover derecha                                | `→` / `D`               |
| ⌨️ Teclado  | Saltar                                       | `Espacio` / `↑` / `W`   |
| ⌨️ Teclado  | Reiniciar                                    | `R`                     |
| 🎮 Gamepad  | Movimiento                                   | Stick izquierdo / D-pad |
| 🎮 Gamepad  | Saltar                                       | Botón A                 |
| 👆 Táctil   | Botones ◀ ▲ ▶ en pantalla (visible en móvil) |                         |

## Características

- 🦍 Donkey Kong en la cima lanzando barriles
- 🪜 4 niveles de plataformas con escaleras
- ⏱️ Temporizador por nivel (60 segundos)
- 💥 Game feel: screen shake, hit-stop, squash & stretch, partículas neon al saltar y al morir
- 🏆 Puntaje y vidas persistidos
- ♿ Accesibilidad: anuncios `aria-live`, prefers-reduced-motion
- 🌓 Soporte de tema claro/oscuro
- 🎮 Soporte para teclado, táctil y gamepad

## Logros

- 🏆 **Manos firmes** — Alcanzá 5.000 puntos en una partida
- 🏆 **Escalador maestro** — Llegá al nivel 10
- 🏆 **Primer piso** — Llegá al nivel 2

## Detalles técnicos

- Canvas 2D sin dependencias externas
- Game loop con `shared/loop.js` (`createGameLoop` con RAF + dt + cleanup)
- Canvas responsive con `shared/display.js` (`setupCanvas` con DPR + letterboxing + resize debounce)
- HTML compartido inyectado vía `shared/dom.js` (`injectCommonElements`)
- Estilos neon desde `shared/base.css` (overlay, HUD, touch controls, game bar, noise CRT)
- Audio sintetizado con `shared/audio.js` (Web Audio API: beep, ambient drone)
- Game feel: screen shake por trauma, hit-stop, squash & stretch, partículas con object pool (500), `feedbackBundle` por tiers
- Rendimiento: glow sin `shadowBlur` (`drawGlow`), object pooling
- Física: coyote time + jump buffering para salto responsive
- Accesibilidad: `aria-live` announcements, `trapTab()` focus trapping, prefers-reduced-motion → `setShakeScale(0)`, modal de ayuda accesible (role=dialog + focus trap), canvas con `role="img"`, zoom móvil habilitado, `:focus-visible` global
- Persistencia en `localStorage` con key namespaced
- 3 modos de entrada: teclado (flechas/WASD + Espacio + R), táctil (botones responsive), gamepad (polling en loop)

## Changelog

- **1.3.0** (2026-07-30): Game feel completo — `feedbackBundle()` integrado + squash & stretch + hit-stop; P0: `shadowBlur` eliminado de loops con `drawGlow()`; lint 0 errores/0 warnings
- **1.2.0** (2026-07-30): Migración a `shared/loop.js`; `shimmerFlow` a `base.css`; `drawGlow()` y `feedbackBundle()`
- **1.1.0** (2026-07-30): Canvas ID unificado + `setupCanvas()` vía `shared/display.js`; HTML compartido vía `shared/dom.js`
- **1.0.0** (2026-07-28): Versión inicial del juego
