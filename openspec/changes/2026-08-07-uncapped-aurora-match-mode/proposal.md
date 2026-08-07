## Why

Engine Match can already run TomitankChess **uncapped** (no per-level depth
cap, searching to the shared move-time budget), but Aurora is always capped by
its per-level depth table (`depthForLevel`, max 22 at level 6). In simple or
endgame positions Aurora reaches its cap early and leaves most of the budget
unused while uncapped Tomitank keeps thinking — so the equal-time control is
not symmetric. An uncapped Aurora mode lets both engines spend the full budget
and makes the control measurement honest in both directions.

## What Changes

- **Aurora uncapped search mode:** `AI.findBestMove` accepts an `uncapped`
  option. When set, the search uses the level-6 feature set (deterministic,
  all pruning/ordering, large TT) but drops the depth ceiling, deepening
  iteratively until the per-move time budget is spent (sampled clock + tail
  guard unchanged). Levels 1-6 behave exactly as before.
- **Adapter/worker plumbing:** the Aurora path of `engineAdapter` and
  `ai.worker.js` forward `uncapped`, mirroring the existing Tomitank path.
- **Engine Match UI:** a symmetric "Aurora full strength" toggle
  (`kpc-match-aurora-uncapped`) alongside the existing Tomitank one; side
  labels already render "full strength". Match-info modal copy updated to
  describe both toggles.
- **Match harness:** `--aurora-uncapped` flag on `control-equal-time.mjs`
  (default off, preserving comparability with recorded baselines) and
  `vs-tomitank.mjs`; the control run reports the both-uncapped score with its
  95% CI under a distinct label.

## Non-goals

- No search/evaluation strength changes (move ordering, pruning margins, eval
  terms are untouched; this is a policy mode, not a strengthening cycle).
- No human-play exposure: difficulty levels 1-6 keep their exact contract.
- No changes to the vendored TomitankChess engine or its capped/uncapped
  behavior; capped Tomitank remains the default yardstick mode.
- No new difficulty level in the UI; uncapped is a match-only modifier.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `engine-strength-levels`: add a requirement for the uncapped full-strength
  mode (match-only; level-6 features; time budget binding; deterministic;
  levels 1-6 unchanged).
- `engine-match-harness`: extend the equal-time control so either or both
  engines can run uncapped, and require the match UI to expose a per-engine
  full-strength toggle.

## Impact

- Code: `js/engine/AI.js`, `js/engineAdapter.js`, `js/ai.worker.js`,
  `js/storage.js`, `src/composables/useGameStore.js`,
  `src/components/controls/MatchSettings.vue`,
  `src/components/modals/MatchInfoModal.vue`.
- Harness: `tests/matches/control-equal-time.mjs`,
  `tests/matches/vs-tomitank.mjs`.
- Tests: uncapped-mode cases in `tests/unit/engine/AI.spec.js` (depth beyond
  the level-6 cap, determinism, timeout compliance) and a store-level test for
  the per-engine uncapped mapping.
- Gates: `test:quick`, `test:baseline`, perft check, `openspec validate`.
- Measurement: an uncapped-vs-uncapped control run (95% CI) is recorded for
  the v3.4.0 changelog.
