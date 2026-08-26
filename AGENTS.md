# AGENTS.md — Arcade Hub

Quick orientation for AI agents. Read **`CLAUDE.md`** (full technical conventions:
2D-only Canvas, neon design system, input parity, performance rules) and
**`CONTRIBUTING.md`** (9-step process for adding a game) before creating or modifying a
game. This file only adds facts they don't state or state wrong.

Requires Node ≥ 22 (tooling + smoke tests; CI pins 22). Run everything from repo root.

## Commands

- `npm run check` — the gate: ESLint (0 err / 0 warn) + Prettier `--check` + `verify` + tests. Must pass before commit.
- `npm run verify` — consistency checker. Fails if: a game dir/file on disk is missing from `games.js` (or a manifest entry has no folder), a game/shared/hub file is missing from `sw.js` `FILES`, or a `metadata.json` lacks `"version"` / has an `id` that differs from `games.js`. Warns on `shared/` entries no game imports. Hub JS modules under `asset/*.js` must also be in `FILES`.
- `npm run verify:sw` — regenerates the `const FILES = [...]` block in `sw.js` automatically (`node scripts/verify.js --update-sw`). Prefer this over hand-editing `FILES`; still bump `STATIC_CACHE` manually afterwards — verify does not check the cache version.
- `npm test` — jsdom smoke tests importing every game's `script.js`; asserts `#gameCanvas`, `#overlay`, `#helpBtn` exist. One game: `node --test --test-name-pattern='smoke: pong' test/smoke.test.js`.
- `node scripts/profile.js [--game=<id>] [--duration=8000]` — perf profiling via Chrome DevTools Protocol. Prereqs: Chrome running with `--remote-debugging-port=9222` and the site served on `localhost:8000`. Without `--game` it profiles only the 5 heavy games.
- `npm run lint:fix` / `npm run format:fix` — autofix, then re-run `npm run check`.

## Running the site

No build step: games are static HTML/CSS/JS served from the repo root (they use ES
modules, so `file://` won't work): `python3 -m http.server 8000`. Hub entry: `index.html`
renders the `games.js` manifest and loads each game in an iframe via hash routing
(`#game/{id}`). `games.js` is the single source of game metadata — paths are always
relative (`./games/...`). Hub card thumbnails render as canvas scenes via
`asset/hub-cards.js`, falling back to the SVG thumbnail when no scene exists for the id.

## Adding / modifying a game

- Each game folder needs exactly 5 files: `index.html`, `style.css`, `script.js`, `metadata.json` (must include `"version"`), `README.md`; `screenshot.png` optional. Copy an existing game as a starting point (`cp -r games/pong games/<id>`).
- `script.js` may import only from `../../shared/*.js`. Never import from another game or from outside `shared/`.
- After any game change: add the game paths to `sw.js` `FILES` (easiest: `npm run verify:sw`) and bump `STATIC_CACHE` (pattern `arcadehub-static-vN`). `npm run verify` catches forgotten entries. `metadata.json` is served network-first, so it doesn't need a cache bump.
- Bump `metadata.json` version and add a `changelog` entry with each change.
- Music (`shared/music.js`): call `startMusic('<gameId>')` in `startGame()` after `startAmbient()` and `stopMusic()` in `cleanup()`. The 🎵 toggle lives in the shared game bar; don't add per-game audio UI.

## Project status & next steps

Roadmap source of truth: **`TODO.md`** (phases R/P/G/H/D/M/P10 all complete). Before
starting work, run `git status` — work is often in progress uncommitted.

- **Done (music rollout):** `shared/music.js` is integrated in all 19 games (`startMusic('<gameId>')` after `startAmbient()` in `startGame()`, `stopMusic()` in `cleanup()`); pilots pong/tetris + 17-game rollout commit `b5e4f13`.
- **Approved, not started:** `docs/game-mechanics-audit-spec.md` — arcade-fidelity changes per game with user-approved decisions. Suggested order: Pac-Man (scatter/chase + fruits + death anim), Tetris (Hold piece + SRS), Donkey Kong (4 phases), Galaga (tractor beam); then fidelity fixes (Space Invaders, Centipede, Frogger, Defender, Joust) and QoL (Pong 2P, Breakout anti-stuck, Asteroids hyperspace, Dig Dug, Missile Command).
- **Future:** phase N1 — new games (templates in `.agents/skills/assets/`).
- Every gameplay change must keep input parity (keyboard/touch/gamepad), neon style via `shared/effects.js` helpers, and end with `npm run check`.

## Traps

- `CLAUDE.md`'s skill table lists 26 skills, but most were deleted from the working tree. Only the autoskills recorded in `skills-lock.json` are installed: `accessibility`, `frontend-design`, `nodejs-backend-patterns`, `nodejs-best-practices`, `seo`. Verify a skill exists under `.agents/skills/` before loading it.
- `games/legacy-3d/` is archived 3D reference — excluded from ESLint, `verify`, and the hub. Never add those games to `games.js`.
- Zero runtime dependencies; `package.json`/`package-lock.json`/`node_modules` are dev-only tooling (ESLint, Prettier, jsdom, `ws` for `scripts/profile.js`).
- `localStorage` keys are namespaced `<gameId>_<key>`; achievements live under `ach_data` (`shared/achievements.js`) — all 19 games already have achievements.
- CI (`.github/workflows/deploy.yml`) runs lint → format → verify → tests on every PR and deploys to GitHub Pages only on push to `main`. A green local `npm run check` is required for PRs.

## Conventions

- Commit after each task using conventional-commit style (log uses `feat:`, `fix:`, `refactor:`, `perf:`, `docs:`, `chore:`, `ci:`).
