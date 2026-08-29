# 🟣 Puyo Puyo

**Versión:** 1.0.0 | **Género:** Puzzle | **Última actualización:** 2026-08-28

Puzzle competitivo. Encajá puyos de colores para hacer cadenas de 4+. Modo vs CPU con garbage system.

## Controles

| Dispositivo | Acción | Tecla / Control |
| ----------- | ------ | --------------- |
| ⌨️ Teclado | Mover | `←` `→` / `A` `D` |
| ⌨️ Teclado | Rotar | `↑` / `W` |
| ⌨️ Teclado | Caída suave | `↓` / `S` |
| ⌨️ Teclado | Hard drop | `Espacio` |
| ⌨️ Teclado | Pausar | `P` |
| ⌨️ Teclado | Reiniciar | `R` |
| 🎮 Gamepad | Mover / Rotar | D-pad |
| 🎮 Gamepad | Hard drop | Botón A |
| 👆 Táctil | D-pad + botones en pantalla | |

## Características

- 🟣 Grid 6×12 con 4 colores de puyos
- 🔗 Chain detection: cadenas de 4+ puyos
- 🗑️ Garbage system: cadenas envían basura al rival
- 🤖 CPU AI con evaluación de tablero
- ⚡ Nivel progresivo (velocidad + garbage)
- 💥 Game feel: partículas neon, screen shake
- 📊 Puntaje y récord persistido
- ♿ Accesibilidad: prefers-reduced-motion
- 🎮 Teclado + táctil + gamepad

## Logros

- 🏆 **Primera partida** — Jugá tu primera partida
- 🏆 **Alto puntaje** — Alcanzá 1000 puntos
- 🏆 **Maestro de cadenas** — Hacé una cadena de 4+

## Detalles técnicos

- Canvas 2D, game loop con `shared/loop.js`
- Chain detection en filas, columnas y diagonales
- CPU AI: evalúa cada movimiento, prioriza chains
- Garbage delay system (2s antes de caer)
- Persistencia en `localStorage` (`puyoPuyo`)
- 3 modos de entrada: teclado, táctil, gamepad

## Changelog

- **1.0.0** (2026-08-28): Initial release
