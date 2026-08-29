# 📰 Paperboy

**Versión:** 1.0.0 | **Género:** Action | **Última actualización:** 2026-08-28

Side-scroll delivery clásico. Entregá periódicos a las casas suscritas mientras esquivás autos, vallas y perros en 3 carriles.

## Controles

| Dispositivo | Acción                     | Tecla / Control    |
| ----------- | -------------------------- | ------------------ |
| ⌨️ Teclado  | Carril arriba              | `↑` / `W`          |
| ⌨️ Teclado  | Carril abajo               | `↓` / `S`          |
| ⌨️ Teclado  | Lanzar periódico           | `→` / `D`          |
| ⌨️ Teclado  | Pausar                     | `Espacio` / `P`    |
| ⌨️ Teclado  | Reiniciar                  | `R`                |
| 🎮 Gamepad  | Carriles                   | D-pad arriba/abajo |
| 🎮 Gamepad  | Lanzar                     | Botón A            |
| 👆 Táctil   | D-pad + lanzar en pantalla |                    |

## Características

- 📰 3 carriles con movimiento fluido
- 🏠 Casas suscritas (verde) y no suscritas (gris)
- 🚗 4 tipos de obstáculos: autos, camiones, vallas, perros
- 📊 Puntaje por distancia + bonus por entregas
- 💥 Game feel: screen shake al chocar, partículas
- 📅 Días progresivos con nuevos obstáculos
- ♿ Accesibilidad: prefers-reduced-motion
- 🎮 Teclado + táctil + gamepad

## Logros

- 🏆 **Primera entrega** — Completá tu primera partida
- 🏆 **Alto puntaje** — Alcanzá 500 puntos
- 🏆 **Entrega perfecta** — Entregá 20 periódicos

## Detalles técnicos

- Canvas 2D, game loop con `shared/loop.js`
- 3 carriles con interpolación de movimiento
- Procedural house/obstacle generation
- Persistencia en `localStorage` (`paperboy`)
- 3 modos de entrada: teclado, táctil, gamepad

## Changelog

- **1.0.0** (2026-08-28): Initial release
