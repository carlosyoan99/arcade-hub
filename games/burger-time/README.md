# 🍔 BurgerTime

**Versión:** 1.0.0 | **Género:** Plataformas | **Última actualización:** 2026-08-28

Plataformas y cooking. Caminá sobre los ingredientes para hacerlos caer y armar las burgers. Esquivá a los enemigos y usá pepper para congelarlos.

## Controles

| Dispositivo | Acción                     | Tecla / Control   |
| ----------- | -------------------------- | ----------------- |
| ⌨️ Teclado  | Mover                      | `←` `→` / `A` `D` |
| ⌨️ Teclado  | Escaleras                  | `↑` `↓` / `W` `S` |
| ⌨️ Teclado  | Pepper                     | `Z`               |
| ⌨️ Teclado  | Pausar                     | `Espacio` / `P`   |
| ⌨️ Teclado  | Reiniciar                  | `R`               |
| 🎮 Gamepad  | Mover / Escaleras          | D-pad             |
| 🎮 Gamepad  | Pepper                     | Botón A           |
| 👆 Táctil   | D-pad + pepper en pantalla |                   |

## Características

- 🍔 Ingredient stacking: caminá sobre ingredientes para empujarlos
- 🌶️ Pepper: congela enemigos cercanos (3 usos por nivel)
- 👾 3 tipos de enemigos: hot dog, pickle, egg
- 📊 Burger completion scoring (200 pts por burger)
- 💥 Game feel: screen shake, partículas
- ♿ Accesibilidad: prefers-reduced-motion
- 🎮 Teclado + táctil + gamepad

## Logros

- 🏆 **Primer chef** — Completá tu primera partida
- 🏆 **Alto puntaje** — Alcanzá 1000 puntos
- 🏆 **Speed cook** — Completá 3 burgers

## Detalles técnicos

- Canvas 2D, game loop con `shared/loop.js`
- 5 plataformas con gaps, ingredientes con física de caída
- Enemy AI: chase + ladder pathfinding
- Persistencia en `localStorage` (`burgerTime`)
- 3 modos de entrada: teclado, táctil, gamepad

## Changelog

- **1.0.0** (2026-08-28): Initial release
