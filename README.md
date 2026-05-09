# Aurora Polaris Chess v2.1.3

A pure client-side chess game that runs entirely in the browser. Play against a configurable AI with no server—ideal for static hosting (e.g. GitHub Pages).

**Version:** see [`package.json`](package.json) · **History:** in-app changelog via the version badge.

## Features

- Full chess rules (castling, en passant, promotion, draws, checkmate / stalemate)
- Stronger Aurora Polaris AI search with difficulty levels, deterministic transposition hashing, corrected tactical quiescence, and Web Worker-based search so the UI stays responsive
- **TomitankChess** is the strong default engine ([tomitankChess](https://github.com/tomitank/tomitankChess) 6.0 vendored under [`vendor/tomitankChess.js`](vendor/tomitankChess.js)); Aurora Polaris AI remains available as an alternative in **Computer engine**
- Engine Match mode: run Aurora vs Aurora, Aurora vs Tomitank, or Tomitank vs Tomitank with per-side strength/depth, selectable per-move time, board perspective, pause/resume/stop, score, and move log
- Aurora v2.1.3 baseline gate for fixed tactics, timeout behavior, and short self-play (`pnpm run test:baseline`)
- Board size slider (desktop), theme controls, move history, and persisted settings via `localStorage`
- Accessible controls (labeled groups, screen-reader text) and responsive layout (mobile board fits the viewport while keeping square cells)
- In-check feedback: the checked king’s square is highlighted in red for the side to move

## Quick start

Serve the repo root as static files (the app loads ES modules from `/js`):

```bash
npx serve . -p 3000
```

Open `http://localhost:3000` (or your host). For development, any static file server works.

## Tests

```bash
pnpm install
pnpm test                 # full Playwright suite
pnpm run test:quick       # excludes long “full game” AI tests
pnpm run test:baseline    # Aurora v2.1.3 engine release gate
```

## Tech stack

- Vanilla ES modules (no framework)
- UI: [Vanduo](https://github.com/vanduo-oss/framework) v1.3.8 (loaded from [jsDelivr](https://www.jsdelivr.com/) in `index.html`)
- Engine: move generation, rules, evaluation, and AI search under `js/engine/`
- Engine adapter layer: [`js/engineAdapter.js`](js/engineAdapter.js), used by human play and engine matches
- UCI engine integration: [`vendor/tomitankChess.js`](vendor/tomitankChess.js), loaded in a dedicated Web Worker via [`js/tomitankClient.js`](js/tomitankClient.js)

## Licensing

### This project (MIT)

Application code contributed as part of **Aurora Polaris Chess** (excluding third-party components described below and in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)) is licensed under the **MIT License** — see [LICENSE](LICENSE).

### TomitankChess (GPL-3.0) — read before redistributing

The chess engine file **[`vendor/tomitankChess.js`](vendor/tomitankChess.js)** is **not** MIT-licensed. It is **tomitankChess** (version 6.0) by **Tamas Kuzmics** (see upstream), obtained from [tomitank/tomitankChess](https://github.com/tomitank/tomitankChess), and is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.

- **Copyright:** as stated in the header of `vendor/tomitankChess.js` (© 2017–2026 Tamas Kuzmics).
- **Full GPL-3.0 text:** [licenses/GPL-3.0.txt](licenses/GPL-3.0.txt) (verbatim copy of the license).
- **Attribution, source, and redistribution:** see **[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)** — including how to obtain corresponding source from upstream and what to retain when you ship this engine or a build that includes it.

If you **remove** `vendor/tomitankChess.js` and do not use the Tomitank engine option, you avoid bundling that GPL component; the rest of the app remains governed by [LICENSE](LICENSE) and the other notices in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

### Other third-party material

Piece graphics and other items are listed in **[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)** (including **mpchess** / **AGPL-3.0**).
