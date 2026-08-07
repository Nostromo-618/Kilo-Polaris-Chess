export const CHANGELOG_ENTRIES = [
  {
    version: "v3.4.0",
    date: "August 7, 2026",
    latest: true,
    columns: [
      {
        title: "Engine Match",
        groups: [
          {
            title: "Aurora at full strength",
            items: [
              {
                icon: "ph-lightning",
                title: "Aurora full strength",
                body: "Aurora gets its own full-strength switch, symmetric to Tomitank's: the per-level depth cap is lifted and it searches until the move-time budget is spent (level-6 policy, no jitter). With both switches on, the match is a true equal-time contest between the two real engines.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: "v3.3.0",
    date: "July 29, 2026",
    latest: false,
    columns: [
      {
        title: "Gameplay",
        groups: [
          {
            title: "Human play",
            items: [
              {
                icon: "ph-arrow-counter-clockwise",
                title: "Undo last move",
                body: "Take back your last move together with the computer's reply and try a different line. Available in Human mode — even after the game has ended — and remembered with your saved game; disabled while the computer is thinking.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: "v3.2.0",
    date: "July 22, 2026",
    latest: false,
    columns: [
      {
        title: "Engine",
        groups: [
          {
            title: "Aurora Polaris — stronger again",
            items: [
              {
                icon: "ph-trophy",
                title: "Beats Tomitank level 3",
                body: "Level 6 now wins its head-to-head against the Tomitank level 3 yardstick (63.7% over 40 games at 1 second per move, up from 36.3% before this cycle), and scores 78.8% against Tomitank level 2 (previously 57.1%).",
              },
              {
                icon: "ph-sort-ascending",
                title: "Smarter move ordering",
                body: "The search tries the most promising moves first: exchanges are classified by static exchange evaluation, and quiet refutations are remembered per opponent move (countermove heuristic), so deeper lines are reached in the same time.",
              },
              {
                icon: "ph-scissors",
                title: "Tighter pruning",
                body: "Mate-distance pruning trims branches that cannot improve the checkmate score, and the clock is sampled far less often, freeing real time for searching.",
              },
              {
                icon: "ph-database",
                title: "Evaluation cache",
                body: "Repeated positions are evaluated once and remembered, and quiescence search uses the transposition table — more of the budget goes to positions that matter. Levels 1–3 play exactly as before.",
              },
            ],
          },
        ],
      },
      {
        title: "Engine Match",
        groups: [
          {
            title: "Fairer, clearer engine-vs-engine",
            items: [
              {
                icon: "ph-info",
                title: "How the match works",
                body: "A new info panel explains the setup honestly: engine \"levels\" are search-depth caps, equal move time is not equal thinking when one side is capped, and how Aurora's top level really compares to Tomitank.",
              },
              {
                icon: "ph-lightning",
                title: "Tomitank full strength",
                body: "A new match toggle lets Tomitank ignore its per-level depth cap and search to the move-time budget — the real engine at full strength — for a genuine equal-time yardstick.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: "v3.1.0",
    date: "July 21, 2026",
    latest: false,
    columns: [
      {
        title: "Engine",
        groups: [
          {
            title: "Aurora Polaris — much stronger play",
            items: [
              {
                icon: "ph-bug",
                title: "Fixed evaluation & search bugs",
                body: "Corrected inverted piece-square tables (the engine now advances pawns and keeps its king safe), fixed passed-pawn scoring, and repaired several search bugs (mate-distance handling, aspiration windows, quiescence, and time-out handling). The engine is now dramatically stronger at levels 4–6 — new self-play beats the previous build overwhelmingly.",
              },
              {
                icon: "ph-shield-check",
                title: "Draw awareness",
                body: "The search now understands threefold repetition and the fifty-move rule, so it no longer shuffles a won position into a draw — while still preferring the fastest checkmate.",
              },
              {
                icon: "ph-clock",
                title: "Time-managed thinking",
                body: "Levels 4–6 now deepen to fill a per-move time budget instead of stopping at a fixed depth (level 6 uses its full budget and searches noticeably deeper). Levels 1–3 stay light and fast.",
              },
              {
                icon: "ph-lightning",
                title: "Roughly 2× faster search",
                body: "Allocation-free move legality, a capture-only quiescence generator, principal-variation search, and static exchange evaluation roughly doubled search speed, so the engine reaches greater depth in the same time.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: "v3.0.0",
    date: "July 12, 2026",
    latest: false,
    columns: [
      {
        title: "UI",
        groups: [
          {
            title: "Vanduo UI (vd3) — Vue 3 rebuild",
            items: [
              {
                icon: "ph-rocket-launch",
                title: "Rebuilt on Vue 3 + Vite",
                body: "The interface was re-platformed from the Vanduo Vanilla engine to Vanduo UI (vd3), a Vue 3 design system, built with Vite. The chess engine, rules, and board rendering are unchanged; the header, control panel, dialogs, and theming are now real vd3 components.",
              },
              {
                icon: "ph-paint-roller",
                title: "Refreshed look + theme customizer",
                body: "A polished pass over the side panel, status, and dialogs, plus the full vd3 theme customizer (palette, primary color, neutral, radius, font) alongside the light/dark/system switcher — with your preferences persisted across visits.",
              },
              {
                icon: "ph-package",
                title: "Static build",
                body: "The app now builds to static assets with Vite for GitHub Pages, replacing the buildless setup. Web Workers (Aurora search and the Tomitank UCI engine) are bundled as discrete chunks.",
              },
            ],
          },
        ],
      },
      {
        title: "Engine",
        groups: [
          {
            title: "TomitankChess 7.0",
            items: [
              {
                icon: "ph-cpu",
                title: "Upgraded to 7.0",
                body: "Updated the vendored TomitankChess (GPL-3.0) from 6.0 to 7.0 — a drop-in UCI-compatible update that is roughly 30% faster (bit-manipulation move generation and magic bitboards) with a refined evaluation, for modestly stronger play at every difficulty.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: "v2.2.0",
    date: "July 4, 2026",
    latest: false,
    columns: [
      {
        title: "UI",
        groups: [
          {
            title: "Vanduo Refresh",
            items: [
              {
                icon: "ph-paint-roller",
                title: "Vanduo v1.7.0",
                body: "Refreshed the Vanduo Vanilla engine from v1.3.8 to v1.7.0, now loaded from the @vanduo-oss/framework npm distribution via jsDelivr. Brings upstream fixes and security hardening with no change to the look and feel.",
              },
              {
                icon: "ph-swatches",
                title: "Token namespace shim",
                body: "Vanduo 1.4.1 moved every design token under the strict --vd-* namespace. Added a small styles/vanduo-compat.css layer that maps the app's theme onto the new tokens, verified pixel-identical to the previous release.",
              },
              {
                icon: "ph-shield-check",
                title: "Subresource Integrity",
                body: "Pinned the CDN CSS and JavaScript with SHA-384 integrity hashes and crossorigin, so the browser verifies the Vanduo bundle before executing it.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: "v2.1.3",
    date: "May 9, 2026",
    latest: false,
    columns: [
      {
        title: "Engine",
        groups: [
          {
            title: "Aurora Polaris",
            items: [
              {
                icon: "ph-brain",
                title: "Stronger search",
                body: "Hardened Aurora's search with deterministic hashing, safer transposition-table probes, corrected quiescence scoring, and stronger tactical evaluation.",
              },
              {
                icon: "ph-shield-check",
                title: "Clean-room tuning",
                body: "Added original evaluation terms for loose pieces, king pressure, rook activity, and passed-pawn races without borrowing from external engines.",
              },
              {
                icon: "ph-flag-checkered",
                title: "Baseline gate",
                body: "Added a repeatable v2.1.3 baseline check for fixed tactics, timeout behavior, and short Aurora self-play.",
              },
            ],
          },
        ],
      },
      {
        title: "Match Lab",
        groups: [
          {
            title: "New Mode",
            items: [
              {
                icon: "ph-swords",
                title: "Engine matches",
                body: "Added engine-vs-engine play with Aurora vs Aurora, Aurora vs Tomitank, and Tomitank vs Tomitank pairings, including per-side strength/depth, pause, resume, stop, score, and move-time controls.",
              },
              {
                icon: "ph-paint-roller",
                title: "Vanduo v1.3.8",
                body: "Updated the pinned Vanduo CSS and JavaScript assets from v1.3.3 to v1.3.8.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: "v2.1.2",
    date: "April 11, 2026",
    latest: false,
    columns: [
      {
        title: "Bug Fixes",
        groups: [
          {
            title: "Mobile",
            items: [
              {
                icon: "ph-device-mobile",
                title: "Modal overlay fix",
                body: "Fixed modals being trapped inside the mobile scroll container, causing an unresponsive dark overlay on real device browsers (Safari & Chrome).",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: "v2.1.1",
    date: "April 11, 2026",
    latest: false,
    columns: [
      {
        title: "Gameplay",
        groups: [
          {
            title: "Improvements",
            items: [
              {
                icon: "ph-swap",
                title: "Pawn promotion selector",
                body: "Pawn promotions now respect your selected piece choice (queen, rook, bishop, or knight) instead of always auto-queening.",
              },
              {
                icon: "ph-cpu",
                title: "Simplified AI timing",
                body: "Removed the maximum thinking-time control and switched to a unified internal AI timing policy.",
              },
            ],
          },
        ],
      },
      {
        title: "UI & Product",
        groups: [
          {
            title: "Updates",
            items: [
              {
                icon: "ph-list",
                title: "Mobile side menu",
                body: "Narrow-screen header now uses a hamburger side menu that contains non-theme header actions.",
              },
              {
                icon: "ph-article",
                title: "In-app changelog modal",
                body: "Click the version badge to open a structured changelog modal directly in the app.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: "v2.1.0",
    date: "April 10, 2026",
    latest: false,
    columns: [
      {
        title: "Framework",
        groups: [
          {
            title: "Fixes",
            items: [
              {
                icon: "ph-paint-roller",
                title: "Theme defaults stabilized",
                body: "Theme preference behavior was aligned with framework defaults so the app remains consistent across reloads.",
              },
            ],
          },
        ],
      },
      {
        title: "Application",
        groups: [
          {
            title: "Release",
            items: [
              {
                icon: "ph-chess-piece",
                title: "Aurora Polaris Chess public build",
                body: "Released browser-based chess gameplay with built-in AI and optional Tomitank engine integration.",
              },
            ],
          },
        ],
      },
    ],
  },
];
