## Why

The Aurora Polaris engine (levels 4-6) is materially weaker than it should be. A
verified audit found evaluation tables that are vertically inverted for the
board's `a1=0` indexing (the engine actively resists advancing pawns), several
search-correctness bugs that occasionally throw away won games, and a fixed
depth-per-level cap that leaves roughly half of level 6's 10-second budget
unused. Raw throughput (~47k NPS) also leaves 3-30x of headroom. None of this
requires borrowing from the vendored GPL engine — the fixes are Aurora's own
bugs plus standard public chess-programming technique.

## What Changes

- Fix evaluation orientation bugs: reverse the inverted pawn/king piece-square
  tables and the passed-pawn advancement index; fix `rayAttacked` early-return
  and the rook-on-7th rank test. **BREAKING** to eval scores (intended).
- Fix search-correctness bugs: quiescence ±Infinity leak, mate scores stored in
  the transposition table without ply adjustment, aspiration re-search that
  never resets the best move, timed-out root iteration overwriting the verified
  best, and level 2-5 randomness comparing static eval against a search score.
- Make the search draw-aware: detect threefold repetition and the fifty-move
  rule inside search (plumb game history into the worker).
- Fix transposition-table poisoning across engine color changes and call the
  existing `clearSearchData` between searches.
- Replace fixed depth-per-level with a per-level (time budget, depth cap) policy
  so level 6 uses its full budget via time-managed iterative deepening. Levels
  1-3 keep their current tiny fixed depths and CPU profile unchanged.
- Raise throughput with allocation-free legality checking, a capture-only
  quiescence generator, incremental king tracking, decorate-sort move ordering,
  principal-variation search (PVS), and static exchange evaluation (SEE).
- Fix the worker-ready race that runs the first AI move on the main thread, and
  the match-mode depth display.
- Add a headless match harness (Aurora vs Aurora, Aurora vs TomitankChess) for
  before/after strength measurement.

## Capabilities

### New Capabilities
- `engine-search`: search algorithm requirements — alpha-beta/PVS, transposition
  table, quiescence, pruning/reductions, mate handling, draw detection, abort.
- `engine-evaluation`: static evaluation requirements — material, piece-square
  tables, pawn structure, king safety, mobility, orientation correctness.
- `engine-strength-levels`: difficulty levels 1-6 — depth caps, time budgets,
  and the CPU constraint that levels 1-3 stay light.
- `engine-match-harness`: reproducible headless engine-vs-engine measurement.

### Modified Capabilities
- (none — no prior `openspec/specs/` existed before this change.)

## Impact

- Code: `js/engine/AI.js`, `js/engine/Evaluator.js`, `js/engine/Rules.js`,
  `js/engine/GameState.js`, `js/ai.worker.js`, `js/engineAdapter.js`, `js/Game.js`,
  `src/composables/useGameStore.js`.
- Tests: new `tests/matches/` harness; existing baseline gate
  (`tests/unit/engine/AuroraBaseline.spec.js`) and engine unit specs must pass.
- Behavior: engine scores and level 4-6 move choices change (stronger). Levels
  1-3 are unchanged. No dependency or API changes; still pure client-side.
