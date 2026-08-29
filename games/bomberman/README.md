# Bomberman

**Versión:** 1.0.0 | **Última actualización:** 2026-08-29

Arcade classic recreated in **canvas 2D** with the neon Arcade Hub style. Place bombs to break soft bricks, collect power-ups, and eliminate every enemy to open the exit and advance to the next level.

## How to play

- **Move:** arrows or WASD (gamepad: d-pad / left stick)
- **Bomb:** Space (gamepad: A)
- **Pause:** P (gamepad: Start)
- Touch: on-screen d-pad and a bomb button in the center.

## Mechanics

- Breaking bricks can drop power-ups: **+1 bomb**, **+2 range**, **speed**, **FULL** (max range), and **detonator** (Space detonates placed bombs instead of laying new ones).
- Each new level spawns more enemies (up to 6). Balloon enemies wander randomly; Oneal enemies chase the player.
- 3 lives per game. Getting hit within an invincible window after death is prevented.

## Scores

- 100 + level × 10 per enemy, +500 × level for clearing a stage.

## Local best

Persisted in `localStorage` under the key `bomberman2d_best`.

## Files

`index.html`, `style.css`, `script.js`, `metadata.json`, `screenshot.png`.
