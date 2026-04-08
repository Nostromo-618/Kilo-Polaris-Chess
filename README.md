# Kilo Aurora Chess v2.0.6

A pure client-side chess game that runs entirely in the browser. Play against a configurable AI with no server—ideal for static hosting (e.g. GitHub Pages).

**Version:** see [`package.json`](package.json) · **History:** Change Log TBA some time later; TODO.

## Features

- Full chess rules (castling, en passant, promotion, draws, checkmate / stalemate)
- AI search with difficulty levels (button presets), optional thinking-time presets (5s–60s), and Web Worker–based search so the UI stays responsive
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

## Third-party assets

Board pieces are SVGs from the **mpchess** set used by [Lichess](https://lichess.org/), vendored from [lila `public/piece/mpchess`](https://github.com/lichess-org/lila/tree/master/public/piece/mpchess). Upstream **lila** is licensed under **AGPL-3.0**; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution and redistribution notes.

## License

MIT — see [LICENSE](LICENSE).
