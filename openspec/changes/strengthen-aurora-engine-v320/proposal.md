## Why

After the 3.1.0 strengthening, Aurora level 6 beats Tomitank level 2 (57% at
300ms) but only draws/loses against Tomitank level 3 (measured 36.3%, Elo -98,
over 40 games at 1000ms on the v3.2.0 baseline). Level 6 is meant to be
maximally strong, so the next milestone is a verified win against Tomitank
level 3. The work uses only Aurora's own code plus standard public
chess-programming technique — never reading or borrowing from the vendored GPL
engine.

## What Changes (as landed so far — see tasks.md for gate results)

- **Time usage:** throttle wall-clock sampling (one `Date.now()` per ~256 node
  visits instead of per node) and skip starting a new deepening iteration when
  under 25ms of budget remains.
- **Move ordering (levels 4-6):** countermove heuristic (quiet refutation
  indexed by the opponent's previous move) and SEE-classified captures in the
  main search — winning/even exchanges above killers, losing exchanges below
  all quiet moves.
- **Pruning (levels 4-6):** mate-distance pruning (clamp the window to the
  reachable mate bound at each node).
- **Eval speed (levels 4-6):** Zobrist-keyed evaluation cache (identical
  scores, memoized) and transposition-table probe/store inside quiescence
  (depth-0 entries; never clobbers deeper entries).
- **Move generation speed:** dedicated capture/promotion-only pseudo-move
  generator for quiescence (verified move-for-move identical to the previous
  generate-all-then-filter approach over 3658 random + 5 edge-case positions).
- **Tried and REVERTED after self-play regression (-44 Elo):** razoring at
  depth <= 2 and adaptive null-move reduction (R = 3 + depth/6). Both are
  documented as failed experiments; they are not part of this change.
- Levels 1-3 keep their exact behavior (verified: identical node counts at
  levels 1-3 vs the 3.1.0 baseline).

## Non-goals

- No evaluation-term changes or retuning yet (king-safety weights, outposts,
  history malus, IIR are candidates for a follow-up if the milestone gate still
  fails). No structural rewrite (bitboards/0x88/integer moves), no opening
  book, no tablebases, no parallel search.
- No changes to the vendored engine, the worker protocol, or the UI.
- Levels 1-3 are untouched.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `engine-search`: add requirements for throttled time checks + tail guard,
  countermove ordering, SEE-ordered captures, mate-distance pruning, the
  evaluation cache, and quiescence transposition-table use.
- `engine-strength-levels`: no requirement text changes; the levels 1-3
  CPU-light and determinism requirements are re-verified, not modified.

## Impact

- Code: `js/engine/AI.js`, `js/engine/Rules.js`.
- Measurement: `tests/matches/` self-play vs refreshed 3.1.0 baseline
  (`.baseline/engine`, gitignored) and `vs-tomitank` at levels 2-3; perft,
  engine unit specs, and the release baseline gate must pass.
- Success metric: Aurora level 6 scores >= 60% over 40+ games vs Tomitank
  level 3 at 1000ms/move (stretch: same at 300ms), with no regression vs
  Tomitank level 2 and no levels 1-3 behavior change.
- Results so far (details in tasks.md): self-play +168 Elo vs 3.1.0 after
  Phase A; TT3 36.3% -> 41.3% (Elo -98 -> -61) at 1000ms — improved, gate not
  yet met; the 41.3% was measured under extreme external system load and is a
  lower bound to be re-measured on an idle machine.
