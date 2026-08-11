> **End of life — superseded by Spindrift Chess**
>
> This repository is **archived and no longer maintained**. GitHub Pages for this
> project is being turned off.
>
> - **Play:** https://spindriftchess.online
> - **Source:** https://github.com/Nostromo-618/spindrift-chess
>
> Spindrift Chess is the successor to Aurora Polaris Chess.

# Aurora Polaris Chess

A pure client-side chess game that runs entirely in the browser — play against a
configurable AI with no server, ideal for static hosting (e.g. GitHub Pages). The
UI is built with **[Vanduo UI (vd3)](https://github.com/vanduo-oss/vd3)** on Vue 3.

**Version:** see [`package.json`](package.json) · **History:** in-app changelog via the version badge.

## Features

- Full chess rules (castling, en passant, promotion, draws, checkmate / stalemate).
- **Aurora Polaris** AI: a from-scratch search (alpha-beta + PVS, transposition
  table, quiescence with SEE, null-move, LMR, time-managed iterative deepening)
  with difficulty levels 1–6, run in a Web Worker so the UI stays responsive.
- **TomitankChess** (GPL-3.0, vendored) is available as a strong alternative engine.
- Engine Match mode: Aurora vs Aurora / Tomitank with per-side strength, per-move
  time, board perspective, an optional full-strength (uncapped) Tomitank, an
  in-app explainer of the setup, pause/resume/stop, score, and move log.
- Board size slider, theme controls, move history, and persisted settings.

## Quick start

```bash
pnpm install
pnpm dev                  # Vite dev server on http://localhost:5173
pnpm test                 # Playwright suite   (test:quick excludes long AI games)
pnpm run test:baseline    # Aurora engine release gate
pnpm build                # -> dist/ (base defaults to /aurora-polaris-chess/; override with VITE_BASE=/)
```

Requires Node ≥ 20.19 and pnpm 10.

## Documentation

Project specifications live under **[`openspec/`](openspec/)** and are the source
of truth for how the app and engine are meant to behave (engine search,
evaluation, difficulty levels, and the match harness). Contributor guidance for
AI coding agents is in [`CLAUDE.md`](CLAUDE.md).

## Tech stack

- **UI:** Vue 3 + Vite, using Vanduo UI (vd3) for components, tokens, and theming.
  App code is under `src/`; the reactive orchestration is
  [`src/composables/useGameStore.js`](src/composables/useGameStore.js).
- **Board:** [`js/ui/BoardView.js`](js/ui/BoardView.js), a framework-agnostic
  imperative renderer mounted as an island by
  [`src/components/BoardIsland.vue`](src/components/BoardIsland.vue).
- **Engine:** dependency-free move generation, rules, evaluation, and search under
  `js/engine/`; adapter layer [`js/engineAdapter.js`](js/engineAdapter.js). The
  UCI engine [`vendor/tomitankChess.js`](vendor/tomitankChess.js) runs in a
  dedicated worker via [`js/tomitankClient.js`](js/tomitankClient.js).

## Licensing

### This project (MIT)

Application code contributed as part of **Aurora Polaris Chess** (excluding third-party components described below and in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)) is licensed under the **MIT License** — see [LICENSE](LICENSE).

### TomitankChess (GPL-3.0) — read before redistributing

The chess engine file **[`vendor/tomitankChess.js`](vendor/tomitankChess.js)** is **not** MIT-licensed. It is **tomitankChess** (version 7.0) by **Tamas Kuzmics** (see upstream), obtained from [tomitank/tomitankChess](https://github.com/tomitank/tomitankChess), and is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.

- **Copyright:** as stated in the header of `vendor/tomitankChess.js` (© 2017–2026 Tamas Kuzmics).
- **Full GPL-3.0 text:** [licenses/GPL-3.0.txt](licenses/GPL-3.0.txt) (verbatim copy of the license).
- **Attribution, source, and redistribution:** see **[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)** — including how to obtain corresponding source from upstream and what to retain when you ship this engine or a build that includes it.

If you **remove** `vendor/tomitankChess.js` and do not use the Tomitank engine option, you avoid bundling that GPL component; the rest of the app remains governed by [LICENSE](LICENSE) and the other notices in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

### Other third-party material

Piece graphics and other items are listed in **[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)** (including **mpchess** / **AGPL-3.0**).
