export const CHANGELOG_ENTRIES = [
  {
    version: "v2.1.1",
    date: "April 11, 2026",
    latest: true,
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
