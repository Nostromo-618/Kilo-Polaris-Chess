export const CHANGELOG_ENTRIES = [
  {
    version: "v2.1.3",
    date: "May 9, 2026",
    latest: true,
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
