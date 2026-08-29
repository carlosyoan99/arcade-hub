# Q*bert

**Versión:** 1.0.0 | **Última actualización:** 2026-08-29

Isometric action-puzzle recreated in **canvas 2D**. Hop around a pyramid of cubes: every cube you land on changes color. Clear the level by coloring all 28 cubes, then dodge (or outsmart) the enemies.

## How to play

- **Hop:** Q (up-left), E (up-right), A (down-left), D (down-right).
- **Pause:** P (gamepad: Start). Classic behavior — hopping to an edge that doesn't exist makes Q*bert fall off the pyramid and lose a life.
- Touch: four diagonal buttons (↖ ↗ ↘ ↙). Gamepad: left stick / d-pad diagonals.

## Enemies

- **Coily:** hatches from an egg after 10 jumps and hops relentlessly down the pyramid. Avoid it — or lure it off the bottom edge, or use a fontana.
- **Slick/Sam:** hop around and revert cubes back to their base color. Land on them to squash them for points.

## Power-ups

- **Fontana:** a purple-and-green disc. Landing on it instantly defeats Coily (+1000 pts).
- **Turbo (⚡):** doubles Q*bert's hop speed for ~8 seconds.

## Scores

- +25 per cube colored, +500 per Slick/Sam squashed, +1500 for driving Coily off the pyramid (or +1500 when it falls), +1000+500×level for clearing a level.

## Achievements

- `qbert_perfect_level` — clear a level without taking a hit.
- `qbert_coily_catcher` — collect 3 fontanas across your runs.
- `qbert_speed_cuber` — clear a level in less than 30 seconds.

## Local best

Persisted in `localStorage` under the key `qbert2d_best`.

## Files

`index.html`, `style.css`, `script.js`, `metadata.json`, `screenshot.png`.
