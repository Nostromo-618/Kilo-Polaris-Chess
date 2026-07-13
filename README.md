# Aurora Polaris Chess v3.0.0

A pure client-side chess game that runs entirely in the browser. Play against a configurable AI with no server—ideal for static hosting (e.g. GitHub Pages). The UI is built with **[Vanduo UI (vd3)](https://github.com/vanduo-oss/vd3)** on Vue 3.

**Version:** see [`package.json`](package.json) · **History:** in-app changelog via the version badge.

## Features

- Full chess rules (castling, en passant, promotion, draws, checkmate / stalemate)
- Stronger Aurora Polaris AI search with difficulty levels, deterministic transposition hashing, corrected tactical quiescence, and Web Worker-based search so the UI stays responsive
- **TomitankChess** is the strong default engine ([tomitankChess](https://github.com/tomitank/tomitankChess) 7.0 vendored under [`vendor/tomitankChess.js`](vendor/tomitankChess.js)); Aurora Polaris AI remains available as an alternative in **Computer engine**
- Engine Match mode: run Aurora vs Aurora, Aurora vs Tomitank, or Tomitank vs Tomitank with per-side strength/depth, selectable per-move time, board perspective, pause/resume/stop, score, and move log
- Aurora v2.1.3 baseline gate for fixed tactics, timeout behavior, and short self-play (`pnpm run test:baseline`)
- Board size slider (desktop), theme controls, move history, and persisted settings via `localStorage`
- Accessible controls (labeled groups, screen-reader text) and responsive layout (mobile board fits the viewport while keeping square cells)
- In-check feedback: the checked king’s square is highlighted in red for the side to move

## Quick start

The UI is a Vue 3 + Vite app; run the dev server:

```bash
pnpm install
pnpm dev                  # Vite dev server on http://localhost:5173
```

> Requires Node ≥ 20.19 (developed on Node 24) and pnpm 10. The UI depends on
> **[Vanduo UI (vd3)](https://github.com/vanduo-oss/vd3)** — currently a local
> `link:` dependency to a sibling checkout; see **Building & deploying**.

## Tests

```bash
pnpm test                 # full Playwright suite (serves the app via Vite)
pnpm run test:quick       # excludes long “full game” AI tests
pnpm run test:baseline    # Aurora v2.1.3 engine release gate
```

## Building & deploying

```bash
pnpm build                # Vite build -> dist/ (base defaults to /aurora-polaris-chess/)
pnpm preview              # serve the built output locally
```

- **Base path:** the production build uses `base: /aurora-polaris-chess/` (a GitHub
  Pages project site). Override with `VITE_BASE=/` (user/organization site) or a
  custom-domain root before building.
- **GitHub Pages:** [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
  builds and publishes `dist/` to Pages on push to `main`.
- **vd3 dependency gate:** while `@vanduo-oss/vd3` is a local `link:../../0_vanduo/vd3`
  dependency (pre-publish), `pnpm install` only works where that sibling checkout
  exists, so CI and the deploy workflow cannot install on a clean runner. Once vd3
  is published to npm, flip the dependency in [`package.json`](package.json) to a
  published range (e.g. `^0.1.0`) and commit the updated lockfile to activate CI/CD.

## Tech stack

- **UI:** [Vue 3](https://vuejs.org/) (composition API, SFCs) built with [Vite](https://vite.dev/),
  using **[Vanduo UI (vd3)](https://github.com/vanduo-oss/vd3)** — a Vue-3 design system —
  for components (`VdButton`, `VdModal`, `VdSelect`, `VdSlider`, `VdThemeSwitcher`,
  `VdThemeCustomizer`, …), design tokens, and CSS. App code lives under `src/`;
  the reactive game orchestration is `src/composables/useGameStore.js`.
- **Board:** [`js/ui/BoardView.js`](js/ui/BoardView.js) is a framework-agnostic imperative
  renderer mounted as an island by [`src/components/BoardIsland.vue`](src/components/BoardIsland.vue).
- **Engine:** move generation, rules, evaluation, and AI search under `js/engine/` (unchanged
  by the UI migration); adapter layer [`js/engineAdapter.js`](js/engineAdapter.js).
- **UCI engine:** [`vendor/tomitankChess.js`](vendor/tomitankChess.js), loaded in a dedicated
  Web Worker via [`js/tomitankClient.js`](js/tomitankClient.js).

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
