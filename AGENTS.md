# AGENTS.md — Arcade Hub

Quick orientation for AI agents. Read **`CLAUDE.md`** (full technical conventions:
2D-only Canvas, neon design system, input parity, performance rules) and
**`CONTRIBUTING.md`** (9-step process for adding a game) before creating or modifying a
game. For a new game, also read **`docs/new-games-spec.md`** (current 13-game roadmap +
per-game decisions). This file only adds facts they don't state or state wrong.

Requires Node ≥ 22 (tooling + smoke tests; CI pins 22). Run everything from repo root.

## Commands

- `npm run check` — the gate: ESLint (0 err / 0 warn) + Prettier `--check` + `verify` + tests. Must pass before commit/PR.
- `npm run verify` — consistency checker. Fails if: a game dir/file on disk is missing from `games.js` (or a manifest entry has no folder), a game/shared/hub file is missing from `sw.js` `FILES`, or a `metadata.json` lacks `"version"` / has an `id` that differs from `games.js`. Warns (non-fatal) on `shared/` entries no game imports directly — `help.js`/`settings.js` are imported transitively via `shell.js`, so that warning is a false positive.
- `npm run verify:sw` — regenerates the `const FILES = [...]` block in `sw.js` automatically (`node scripts/verify.js --update-sw`). Prefer this over hand-editing `FILES`; still bump `STATIC_CACHE` (pattern `arcadehub-static-vN`) manually afterwards — verify does not check the cache version.
- `npm test` — jsdom smoke tests. They iterate **`games.js`**, so a newly registered game is covered automatically (each imports `script.js` and asserts `#gameCanvas`, `#overlay`, `#helpBtn`). One game: `node --test --test-name-pattern='smoke: pong' test/smoke.test.js`.
- `node scripts/profile.js [--game=<id>] [--duration=8000]` — perf profiling via Chrome DevTools Protocol. Prereqs: Chrome running with `--remote-debugging-port=9222` and the site served on `localhost:8000`. Without `--game` it profiles only the 5 heavy games.
- `npm run lint:fix` / `npm run format:fix` — autofix, then re-run `npm run check`.

## Running the site

No build step: games are static HTML/CSS/JS served from the repo root (they use ES
modules, so `file://` won't work): `python3 -m http.server 8000`. Hub entry: `index.html`
renders the `games.js` manifest and loads each game in an iframe via hash routing
(`#game/{id}`). `games.js` is the single source of game metadata — paths are always
relative (`./games/...`). Hub card thumbnails render as canvas scenes via
`asset/hub-cards.js` (`SCENES`), falling back to the SVG thumbnail when no scene exists.

## Adding / modifying a game

- Each game folder needs exactly 5 files: `index.html`, `style.css`, `script.js`, `metadata.json` (must include `"version"`), `README.md`; `screenshot.png` (1024×768) optional but every existing game has one. Copy an existing game as a starting point (`cp -r games/pong games/<id>`).
- `script.js` may import only from `../../shared/*.js`. Never import from another game or from outside `shared/`.
- **Modern scaffold (all games use it):** import `setupGameShell('<id>')` from `../../shared/shell.js` right after `injectCommonElements()`, and `loadBest`/`saveBest` from `../../shared/scores.js`. `shell` wires the game bar (`#hubBtn`/`#fsBtn`/`#helpBtn`), the settings panel, the Tab trap (`enableTabTrap()`/`disableTabTrap()` in start/game-over) and cleanup (`onCleanup(() => loop.stop())`). **Do not** call `stopMusic()`/`closeAudio()` yourself — `shell.cleanup()` does. `CLAUDE.md`'s import sample imports `showHelp` from `help.js` directly; that predates shell.js and no game does it anymore.
- Music (`shared/music.js`): call `startMusic('<gameId>')` in `startGame()` after `startAmbient()`. **A game id with no entry in the `SONGS` map silently produces no music** — either add a theme for the id or omit the call. (Columns deliberately has no theme, ambient only — see spec.) The 🎵 toggle lives in the shared game bar; don't add per-game audio UI.
- Hub thumbnail: add a scene for the id in `asset/hub-cards.js` `SCENES` (or ship `asset/icons/game-<id>.svg` as fallback), or the hub card renders without a thumbnail.
- After any game change: add the game paths to `sw.js` `FILES` (easiest: `npm run verify:sw`) and bump `STATIC_CACHE`. `metadata.json` is served network-first, so it doesn't need a cache bump.
- Bump `metadata.json` version and add a `changelog` entry with each change.

## Project status & next steps

Roadmap sources of truth: **`TODO.md`** (legacy phases R/P/G/H/D/M/P10 all complete) and
**`docs/`** (current work). Before starting work, run `git status` — work is often in
progress uncommitted.

- **Done:** `docs/game-mechanics-audit-spec.md` is **complete** — 14/14 arcade games brought to arcade parity (Space Invaders 11/11, Pac-Man 8/10, Tetris Guideline 4/7, Frogger 8/8, Galaga 9/9, etc.) plus 3 non-arcade verified. Music is integrated and **themed in all 19 games** (`SONGS` has all 19 ids).
- **In progress:** `docs/new-games-spec.md` (Fase 1 of 13 planned games). `games/columns/`, `games/pole-position/`, `games/moon-patrol/` exist but are **untracked and unregistered** — not in `games.js`, `sw.js`, `hub-cards.js`, or `SONGS`, so **`npm run verify` currently exits 1** (expected mid-WIP; registering the games makes it green again). Moon Patrol is missing `README.md` (a required file). Remaining Fase 1: **Tempest**. Per spec: Columns = ambient only; Pole Position + Moon Patrol need `SONGS` themes. Registering a game in `games.js` auto-adds it to the smoke tests.
- Every gameplay change must keep input parity (keyboard/touch/gamepad), neon style via `shared/effects.js` helpers, and end with `npm run check`.

## Traps

- `CLAUDE.md`'s skill table lists 26 skills, but most were deleted from the working tree. Only the autoskills recorded in `skills-lock.json` are installed: `accessibility`, `frontend-design`, `nodejs-backend-patterns`, `nodejs-best-practices`, `seo`. Verify a skill exists under `.agents/skills/` before loading it.
- `games/legacy-3d/` is archived 3D reference — excluded from ESLint, `verify`, and the hub. Never add those games to `games.js`.
- Zero runtime dependencies; `package.json`/`package-lock.json`/`node_modules` are dev-only tooling (ESLint, Prettier, jsdom, `ws` for `scripts/profile.js`).
- `localStorage` keys are namespaced `<gameId>_<key>`; achievements live under `ach_data` (`shared/achievements.js`); best scores use `<prefix>_best` via `shared/scores.js`. Keep a game's historical prefix when migrating (e.g. `snake2d`, `joust`, `neonNexus`) so saved data survives.
- `shared/scores.js`, `shared/settings.js`, and `shared/shell.js` are not documented in `CLAUDE.md`/`README.md` — those docs only list the original 10 `shared/` JS modules.
- CI (`.github/workflows/deploy.yml`) runs lint → format → verify → tests on every PR and deploys to GitHub Pages only on push to `main`. A green local `npm run check` is required for PRs.

## Conventions

- Commit after each task using conventional-commit style (log uses `feat:`, `fix:`, `refactor:`, `perf:`, `docs:`, `chore:`, `ci:`; per-game fixes use `fix(games):`).
