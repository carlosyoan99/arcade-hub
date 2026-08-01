# 🐍 Snake

**Versión:** 1.5.1 | **Género:** Arcade | **Última actualización:** 2026-07-31

El clásico de la serpiente. Atrapá la comida para crecer y sumar puntos sin chocarte contra las paredes ni contra vos mismo.

## Captura

![Snake en acción](./screenshot.png)

## Controles

| Dispositivo | Acción                        | Tecla / Control         |
| ----------- | ----------------------------- | ----------------------- |
| ⌨️ Teclado  | Mover arriba                  | `↑` / `W`               |
| ⌨️ Teclado  | Mover abajo                   | `↓` / `S`               |
| ⌨️ Teclado  | Mover izquierda               | `←` / `A`               |
| ⌨️ Teclado  | Mover derecha                 | `→` / `D`               |
| ⌨️ Teclado  | Empezar / Pausa               | `Espacio`               |
| 🎮 Gamepad  | Movimiento                    | D-pad / Stick izquierdo |
| 👆 Táctil   | D-pad direccional en pantalla |                         |

## Características

- 🐍 Velocidad progresiva a medida que crecés
- 💥 Game feel: screen shake, hit-stop, partículas neon al comer y al morir
- 📊 Puntaje y récord persistido en `localStorage`
- ♿ Accesibilidad: anuncios `aria-live`, prefers-reduced-motion
- 🎮 Soporte para teclado, táctil y gamepad

## Logros

- 🏆 **Decatlón** — Alcanzá 10 puntos de récord

## Detalles técnicos

- Canvas 2D sin dependencias externas
- Game loop con `shared/loop.js` (`createGameLoop` con RAF + dt + cleanup)
- Canvas responsive con `shared/display.js` (`setupCanvas` con DPR + letterboxing + resize debounce)
- HTML compartido inyectado vía `shared/dom.js` (`injectCommonElements`)
- Estilos neon desde `shared/base.css` (overlay, HUD, touch controls, game bar, noise CRT)
- Audio sintetizado con `shared/audio.js` (Web Audio API: beep, ambient drone)
- Game feel: screen shake por trauma, hit-stop, squash & stretch, partículas con object pool (500), `feedbackBundle` por tiers
- Rendimiento: glow sin `shadowBlur` (`drawGlow`), object pooling
- Accesibilidad: `aria-live` announcements, `trapTab()` focus trapping, prefers-reduced-motion → `setShakeScale(0)`, modal de ayuda accesible (role=dialog + focus trap), canvas con `role="img"`, zoom móvil habilitado, `:focus-visible` global
- Persistencia en `localStorage` con key namespaced
- 3 modos de entrada: teclado (flechas/WASD + Espacio + R), táctil (d-pad responsive), gamepad (polling en loop)

## Changelog

- **1.5.1** (2026-07-31): R1: coordenadas de grid `.z/.dz` renombradas a `.y/.dy` — último vestigio 3D eliminado
- **1.5.0** (2026-07-30): Game feel completo — `feedbackBundle()` integrado + squash & stretch + hit-stop; P0: `shadowBlur` eliminado de loops con `drawGlow()`; lint 0 errores/0 warnings
- **1.4.0** (2026-07-30): Migración a `shared/loop.js`; `shimmerFlow` a `base.css`; `drawGlow()` y `feedbackBundle()`
- **1.3.0** (2026-07-30): Canvas ID unificado + `setupCanvas()` vía `shared/display.js`; HTML compartido vía `shared/dom.js`
- **1.2.0** (2026-07-28): Refactor CSS a estética neon compartida en `base.css`; README con controles y descripción
- **1.1.0** (2026-07-28): Refactor a carpeta individual; botón ayuda + volver al hub; screen shake y partículas
- **1.0.0** (2026-06-05): Versión inicial del juego
