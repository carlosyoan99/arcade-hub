# 👊 Double Dragon

**Versión:** 1.0.0 | **Género:** Beat 'em up | **Última actualización:** 2026-08-28

Beat 'em up clásico. Derrotá enemigos en 4 actos con puñetazos, patadas, combos y armas. Enfrentá un boss al final de cada acto.

## Controles

| Dispositivo | Acción | Tecla / Control |
| ----------- | ------ | --------------- |
| ⌨️ Teclado | Mover | `←` `→` `↑` `↓` / `W` `A` `S` `D` |
| ⌨️ Teclado | Puñetazo | `Z` |
| ⌨️ Teclado | Patada | `X` |
| � компьюso| Combo | `C` |
| ⌨️ Teclado | Pausar | `Espacio` / `P` |
| ⌨️ Teclado | Reiniciar | `R` |
| 🎮 Gamepad | Mover | D-pad / Stick |
| 🎮 Gamepad | Puñetazo / Patada / Combo | A / B / X |
| 👆 Táctil | D-pad + botones en pantalla | |

## Características

- 👊 3 ataques: puñetazo, patada, combo (3-hit)
- 🗡️ Armas: espada, bate, dinamita (drops de enemigos)
- 👾 3 tipos de enemigos: punk (fácil), thug (medio), soldier (difícil)
- 🦍 Boss con HP bar al final de cada acto
- ❤️ Drops de vida (15% chance)
- 💥 Game feel: screen shake, hit flash, partículas
- 📊 4 actos con dificultad progresiva
- ♿ Accesibilidad: prefers-reduced-motion
- 🎮 Teclado + táctil + gamepad

## Logros

- 🏆 **Primera pelea** — Completá tu primera partida
- 🏆 **Alto puntaje** — Alcanzá 2000 puntos
- 🏆 **Boss final** — Derrotá al boss del Acto 4

## Detalles técnicos

- Canvas 2D, game loop con `shared/loop.js`
- 4-dirección movement, attack cooldowns
- Enemy AI: chase + attack at range
- Weapon pickup system with timer
- Persistencia en `localStorage` (`doubleDragon`)
- 3 modos de entrada: teclado, táctil, gamepad

## Changelog

- **1.0.0** (2026-08-28): Initial release
