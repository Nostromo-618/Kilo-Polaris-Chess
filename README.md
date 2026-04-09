# Kilo Aurora Chess v2.1.0

A pure client-side chess game that runs entirely in the browser. Play against a configurable AI with no server—ideal for static hosting (e.g. GitHub Pages).

**Version:** see [`package.json`](package.json) · **History:** Change Log TBA some time later; TODO.

## Features

- Full chess rules (castling, en passant, promotion, draws, checkmate / stalemate)
- AI search with difficulty levels (button presets), optional thinking-time presets (5s–60s), and Web Worker–based search so the UI stays responsive
- Optional **TomitankChess** opponent ([tomitankChess](https://github.com/tomitank/tomitankChess) 6.0 vendored under [`vendor/tomitankChess.js`](vendor/tomitankChess.js)), selected in **Computer engine**; falls back to the built-in AI if the external engine fails to load
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
```

## Tech stack

- Vanilla ES modules (no framework)
- UI: [Vanduo](https://github.com/vanduo-oss/framework) (loaded from [jsDelivr](https://www.jsdelivr.com/) in `index.html`)
- Engine: move generation, rules, evaluation, and AI search under `js/engine/`
- Optional UCI engine: [`vendor/tomitankChess.js`](vendor/tomitankChess.js), loaded in a dedicated Web Worker via [`js/tomitankClient.js`](js/tomitankClient.js)

## Licensing

### This project (MIT)

Application code contributed as part of **Kilo Aurora Chess** (excluding third-party components described below and in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)) is licensed under the **MIT License** — see [LICENSE](LICENSE).

### TomitankChess (GPL-3.0) — read before redistributing

The optional chess engine file **[`vendor/tomitankChess.js`](vendor/tomitankChess.js)** is **not** MIT-licensed. It is **tomitankChess** (version 6.0) by **Tamas Kuzmics** (see upstream), obtained from [tomitank/tomitankChess](https://github.com/tomitank/tomitankChess), and is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.

- **Copyright:** as stated in the header of `vendor/tomitankChess.js` (© 2017–2026 Tamas Kuzmics).
- **Full GPL-3.0 text:** [licenses/GPL-3.0.txt](licenses/GPL-3.0.txt) (verbatim copy of the license).
- **Attribution, source, and redistribution:** see **[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)** — including how to obtain corresponding source from upstream and what to retain when you ship this engine or a build that includes it.

If you **remove** `vendor/tomitankChess.js` and do not use the Tomitank engine option, you avoid bundling that GPL component; the rest of the app remains governed by [LICENSE](LICENSE) and the other notices in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

### Other third-party material

Piece graphics and other items are listed in **[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)** (including **mpchess** / **AGPL-3.0**).
