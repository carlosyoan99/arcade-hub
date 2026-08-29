# Raiden

**Versión:** 1.0.0 | **Última actualización:** 2026-08-29

Vertical shooter ("shmup") recreated in **canvas 2D**. Fly through 7 sectors, destroy enemy waves and defeat the boss of each stage.

## How to play

- **Move:** arrows / WASD / d-pad / left stick. Fire is automatic.
- **Bomb:** Space (clears bullets and damages everything on screen). 3 per game.
- **Pause:** P (gamepad: Start).
- At the start of each round you pick a weapon (↑/↓ or confirm with Space).

## Weapons

- **Twin** — balanced twin bolt. Default.
- **Laser** — piercing narrow beam.
- **Proton** — five-way spread.
- **Missile** — heavy homing-ish pair.
- **Shield** — heavy single frontal shot.

Taking a hit reverts your weapon to **Twin**. You can play the whole run with the starter weapon without ever picking upgrades.

## Stages

Each of the 7 sectors has a distinct boss: spiral, aimed, ring, waves, double-spiral, aimed + ring, and a final pattern. Boss HP, enemy count and bullet speed scale with the sector.

## Scores

- 100 per ship, 200 per drone, +5000 + 500×sector for a boss, +1000 for clearing a sector.

## Local best

Persisted in `localStorage` under the key `raiden2d_best`.

## Files

`index.html`, `style.css`, `script.js`, `metadata.json`, `screenshot.png`.
