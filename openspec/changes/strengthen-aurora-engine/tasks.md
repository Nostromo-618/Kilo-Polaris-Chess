## 1. Harness & baseline

- [ ] 1.1 Snapshot the current engine as a baseline build for old-vs-new play
- [ ] 1.2 Node self-play harness: two engine builds, fixed movetime, play to a terminal result with draw/adjudication, report W/L/D + score
- [ ] 1.3 Playwright Aurora-vs-Tomitank harness via the existing UCI client (never read the vendored source)
- [ ] 1.4 Run BEFORE matches: baseline Aurora vs Tomitank (levels 4/5/6) as the yardstick

## 2. Phase 1 — evaluation correctness

- [ ] 2.1 Reverse the vertically-inverted pawn MG/EG and king MG piece-square tables (and knight rank rows) to match a1=0
- [ ] 2.2 Fix passed-pawn advancement indexing
- [ ] 2.3 Fix `rayAttacked` early-return so blocked rays fall through to other directions
- [ ] 2.4 Fix rook-on-7th enemy-back-rank test (separate king-confinement rank from pawn-target rank)
- [ ] 2.5 Add unit assertions: passer e2<e7, king MG back-rank>center, start position ≈ 0

## 3. Phase 1 — search correctness

- [ ] 3.1 Quiescence: bounded in-check init, propagate null on timeout, guard TT store against non-finite/out-of-range scores
- [ ] 3.2 Mate scores: ply-adjust on TT store/probe; give quiescence mates real distance
- [ ] 3.3 Aspiration: proper fail-low/high re-search that resets best move/score per window
- [ ] 3.4 Root: keep last completed iteration's best on abort; store root in TT each iteration
- [ ] 3.5 Randomness (levels 2-5): jitter over search scores, not static eval
- [ ] 3.6 Draw awareness: path/history hash stack in make/undo; return draw score on repetition or fifty-move
- [ ] 3.7 Worker protocol: pass game history since last irreversible move into the search
- [ ] 3.8 TT perspective: clear (or reject) on root-color change; call `clearSearchData` between searches (keep TT within a game)

## 4. Phase 1 — integration fixes

- [ ] 4.1 Fix worker-ready race so the first AI move runs in the worker, not on the main thread
- [ ] 4.2 Match-mode depth display reads `depthCompleted`
- [ ] 4.3 Restored-game difficulty default aligns with the UI default
- [ ] 4.4 Verify Phase 1: baseline gate + engine unit specs pass; self-play new-vs-baseline shows improvement

## 5. Phase 2 — time management

- [ ] 5.1 Introduce per-level policy `{ depthCap, timeMs }`; levels 1-3 unchanged
- [ ] 5.2 Level 6 high depth cap + full budget; levels 4/5 scaled budgets via time-managed iterative deepening
- [ ] 5.3 Stop deepening when the next iteration cannot fit the remaining budget; return promptly when the depth cap is hit early
- [ ] 5.4 Verify Phase 2: levels 1-3 node counts unchanged; level 6 uses its budget; self-play vs Phase-1 build

## 6. Phase 3 — throughput & search technique

- [ ] 6.1 Allocation-free `leavesKingInCheck` (mutate/test/revert) + incremental king tracking
- [ ] 6.2 Capture/promotion-only quiescence move generator
- [ ] 6.3 Decorate-then-sort move ordering
- [ ] 6.4 Remove dead JSON castling clone; lighten per-node allocations
- [ ] 6.5 Lazy `staticEval`
- [ ] 6.6 Principal-variation search (zero-window scout + re-search)
- [ ] 6.7 Static exchange evaluation (SEE) for quiescence pruning and capture ordering
- [ ] 6.8 Cooperative abort signal in the worker protocol
- [ ] 6.9 Verify Phase 3: baseline gate + unit specs; NPS before/after; self-play vs Phase-2 build

## 7. Measurement & docs

- [ ] 7.1 Run AFTER matches: full self-play new-vs-baseline + Aurora vs Tomitank (levels 4/5/6)
- [ ] 7.2 Record before/after results (self-play score, NPS, time-to-depth, Tomitank gap)
- [ ] 7.3 Archive this change into `openspec/specs/`; establish OpenSpec as source of truth
- [ ] 7.4 Trim README to a short intro + pointer; keep a short CLAUDE.md pointing at openspec; keep license notices
