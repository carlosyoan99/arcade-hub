# Gradius

Side-scroll shooter recreated in **canvas 2D**. Fly through 7 sectors, collect capsules to
advance the power gauge, activate upgrades with Space, and defeat the boss of each sector.

## How to play

- **Move:** arrows / WASD / d-pad / left stick (8 directions).
- **Fire:** X (hold; gamepad A). Autofire works even without firing.
- **Power:** Space activates the currently highlighted slot of the power bar (gamepad B; tap
  the bar on touch).
- **Pause:** P (gamepad: Start).

## Power bar

Pickups ("capsules") drop from destroyed enemies and advance the gauge:

- **SPD — Speed Up:** +1 ship speed (max 4).
- **MSL — Missile:** reloads the ship with downward arcing missiles.
- **DBL — Double:** adds diagonal shots.
- **OPT — Option:** adds a drone that follows the ship and fires forward (max 2).
- **SHD — Shield:** absorbs one hit and is consumed.

Taking a hit resets your power to base. Speed, missiles, double, options and shield are lost.

## Stages

7 sectors with increasing difficulty. Each stage ends with a boss: fans + aimed bursts scale
with the sector.

## Achievements

- `gradius_option_master` — reach 2 active Options.
- `gradius_speed_demon` — reach max Speed Up.
- `gradius_no_damage_clear` — clear a sector without taking a hit.

## Local best

Persisted in `localStorage` under the key `gradius2d_best`.

## Files

`index.html`, `style.css`, `script.js`, `metadata.json`, `screenshot.png`.
