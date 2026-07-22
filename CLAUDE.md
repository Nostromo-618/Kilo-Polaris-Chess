# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Source of truth

Project specifications live under **`openspec/`** (spec-driven; the OpenSpec CLI is
installed). `openspec/specs/` is the current behavioral contract — read the
relevant capability spec (engine-search, engine-evaluation, engine-strength-levels,
engine-match-harness) before changing engine behavior. In-flight proposals live in
`openspec/changes/`. Use `openspec list` / `openspec show <id>` to browse.

## Commands

Uses pnpm (pinned via `packageManager`) and Node ≥ 20.19.

```bash
pnpm dev                  # Vite dev server on http://localhost:5173
pnpm build                # production build -> dist/ (base defaults to /aurora-polaris-chess/; override with VITE_BASE=/)
pnpm test                 # full Playwright suite (auto-starts Vite on port 3000)
pnpm run test:quick       # excludes long "Full Game Tests" — this is what CI runs on PRs
pnpm run test:baseline    # Aurora engine release gate (Node-side, no browser server)
pnpm exec playwright test tests/unit/engine/Board.spec.js   # single file
pnpm exec playwright test --grep "en passant"               # single test
```

There is no lint script; `.eslintrc.json` defines the rules (`eqeqeq`, `no-var` as errors).

### Engine measurement harness (`tests/matches/`, Node ESM)

```bash
node tests/matches/selfplay.mjs --a js/engine --b .baseline/engine --games 40 --level 6 --movetime 300
node tests/matches/vs-tomitank.mjs --games 20 --level 6 --movetime 300   # Playwright; drives Tomitank via UCI (per-level depth cap)
node tests/matches/control-equal-time.mjs --runs 2 --games 20 --movetime 1000   # equal-time control: Tomitank UNCAPPED, reports a 95% CI
node tests/matches/perft-check.mjs      # legality validation vs known perft values
```

## Architecture

Two layers separated by a deliberate framework boundary:

- **`js/` — framework-agnostic vanilla JS** (no Vue imports): `js/engine/` is the
  dependency-free chess engine (`Board.js`, `Move.js`, `Rules.js`, `GameState.js`,
  `Evaluator.js`, `AI.js` = the Aurora search, `fen.js`, `uciMatch.js`); `js/Game.js`
  orchestrates state + engine adapters; `js/engineAdapter.js` is the boundary over
  **Aurora** (`"builtin"`, run in `js/ai.worker.js`) and **Tomitank** (`"tomitank"`,
  vendored UCI engine run via `js/tomitankClient.js`); `js/ui/BoardView.js` is a
  hand-rolled DOM renderer; `js/storage.js` centralizes `kpc-`-namespaced localStorage.
- **`src/` — Vue 3 UI** on Vanduo vd3. `src/composables/useGameStore.js` is the
  module-scope singleton bridging the layers (owns the `Game` instance and the
  engine-vs-engine match loop). `src/components/BoardIsland.vue` mounts the imperative board.

Because `js/engine/` has no DOM/framework deps, specs import it in the browser
(`page.evaluate(() => import('/js/engine/...'))`) or straight into Node.

## Testing patterns

- Everything runs under Playwright, including "unit" tests. Browser specs must
  dismiss the disclaimer first (`localStorage.setItem('kpc-disclaimer-accepted','true')` then reload).
- Long AI games live under describe blocks titled "Full Game Tests" (the grep target for `test:quick`/`test:full-game`).
- Run `test:baseline` and the `tests/matches/` harness (perft + self-play) when touching `js/engine/`.

## Constraints

- **Aurora engine:** levels 1–3 must stay CPU-light (browser game — no fan/battery
  drain). Levels 4–6 are time-managed and may use real CPU. **Never read or borrow
  from `vendor/tomitankChess.js`** for engine ideas — it is another developer's GPL
  work; use only Aurora's own code plus standard public chess-programming technique.
- **Licensing:** app code is MIT, but `vendor/tomitankChess.js` is **GPL-3.0** and
  the mpchess piece SVGs under `public/pieces/` are **AGPL-3.0**. Keep Tomitank
  vendored and loaded as a discrete worker chunk (never inline/mix it into app
  modules), and keep `THIRD_PARTY_NOTICES.md` / `licenses/` accurate.
