# 🏎️ Out Run

**Versión:** 1.0.0 | **Género:** Racing | **Última actualización:** 2026-08-28

Racing pseudo-3D clásico. Cruzá la highway con perspective, esquivá autos, usá turbo y completá 5 stages.

## Controles

| Dispositivo | Acción | Tecla / Control |
| ----------- | ------ | --------------- |
| ⌨️ Teclado | Acelerar | `↑` / `W` |
| ⌨️ Teclado | Frenar | `↓` / `S` |
| ⌨️ Teclado | Girar | `←` `→` / `A` `D` |
| ⌨️ Teclado | Turbo | `Espacio` |
| ⌨️ Teclado | Pausar | `P` |
| ⌨️ Teclado | Reiniciar | `R` |
| 🎮 Gamepad | Acelerar / Frenar | D-pad |
| 🎮 Gamepad | Turbo | Botón A |
| 👆 Táctil | D-pad + turbo en pantalla | |

## Características

- 🛣️ Pseudo-3D road rendering con perspective
- 🌅 Sky gradient con sol
- 🌲 Árboles decorativos con scaling
- 🚗 8 rivales con colores únicos
- ⚡ Turbo (2.5s boost, 6s cooldown)
- ⏱️ Tiempo por stage + bonus al completar
- 💥 Game feel: engine sound, crash shake, turbo flame
- 📊 5 stages con curvas progresivas
- ♿ Accesibilidad: prefers-reduced-motion
- 🎮 Teclado + táctil + gamepad

## Logros

- 🏆 **Primera carrera** — Completá tu primera carrera
- 🏆 **Alto puntaje** — Alcanzá 500 puntos
- 🏆 **Stage clear** — Alcanzá stage 3

## Detalles técnicos

- Canvas 2D, game loop con `shared/loop.js`
- Road rendering: segment-based perspective projection
- Car scaling by distance
- Rival collision detection
- Persistencia en `localStorage` (`outRun`)
- 3 modos de entrada: teclado, táctil, gamepad

## Changelog

- **1.0.0** (2026-08-28): Initial release
