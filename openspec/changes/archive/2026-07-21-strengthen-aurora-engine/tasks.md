## 1. Harness & baseline

- [x] 1.1 Snapshot the current engine as a baseline build for old-vs-new play
- [x] 1.2 Node self-play harness: two engine builds, fixed movetime, play to a terminal result with draw/adjudication, report W/L/D + score
- [x] 1.3 Playwright Aurora-vs-Tomitank harness via the existing UCI client (never read the vendored source)
- [x] 1.4 Run BEFORE matches: baseline Aurora vs Tomitank (levels 4/5/6) as the yardstick

## 2. Phase 1 — evaluation correctness

- [x] 2.1 Reverse the vertically-inverted pawn MG/EG and king MG piece-square tables (and knight rank rows) to match a1=0
- [x] 2.2 Fix passed-pawn advancement indexing
- [x] 2.3 Fix `rayAttacked` early-return so blocked rays fall through to other directions
- [x] 2.4 Fix rook-on-7th enemy-back-rank test (separate king-confinement rank from pawn-target rank)
- [x] 2.5 Add unit assertions: passer e2<e7, king MG back-rank>center, start position ≈ 0

## 3. Phase 1 — search correctness

- [x] 3.1 Quiescence: bounded in-check init, propagate null on timeout, guard TT store against non-finite/out-of-range scores
- [x] 3.2 Mate scores: ply-adjust on TT store/probe; give quiescence mates real distance
- [x] 3.3 Aspiration: proper fail-low/high re-search that resets best move/score per window
- [x] 3.4 Root: keep last completed iteration's best on abort; store root in TT each iteration
- [x] 3.5 Randomness: exact full-window root scores for jitter (levels 2-3); no jitter at 4-6
- [x] 3.6 Draw awareness: path/history hash stack in make/undo; return draw score on repetition or fifty-move (checkmate precedes fifty-move)
- [x] 3.7 Worker protocol: pass game history since last irreversible move into the search
- [x] 3.8 TT perspective: clear on root-color change; call `clearSearchData` between searches (keep TT within a game)

## 4. Phase 1 — integration fixes

- [x] 4.1 Fix worker-ready race so the first AI move runs in the worker, not on the main thread
- [x] 4.2 Match-mode depth display reads `depthCompleted`
- [x] 4.3 Restored-game difficulty default aligns with the UI default
- [x] 4.4 Verify Phase 1: baseline gate + engine unit specs pass; self-play new-vs-baseline shows improvement (L4 14-0, L6 20-0)

## 5. Phase 2 — time management

- [x] 5.1 Introduce per-level policy: raised depth caps (4/5/6 → 8/12/22); levels 1-3 unchanged
- [x] 5.2 Level 6 high depth cap + full budget; levels 4/5 scaled budgets (Game.moveTimeForDifficulty)
- [x] 5.3 Simple positions return at the depth cap; complex positions run to the time budget (last completed depth retained on timeout)
- [x] 5.4 Verify Phase 2: levels 1-3 node counts <= baseline; level 6 uses its budget (depth 7→8 at 10s)

## 6. Phase 3 — throughput & search technique

- [x] 6.1 Allocation-free `moveLeavesKingInCheck` (mutate/test/revert) + find king once per position
- [x] 6.2 Capture/promotion-only quiescence move generator
- [x] 6.3 Decorate-then-sort move ordering
- [x] 6.4 Remove dead JSON castling clone; shallow structured copies on the hot path
- [x] 6.5 Lazy `staticEval`
- [x] 6.6 Principal-variation search (zero-window scout + re-search); validated exact vs pre-PVS
- [x] 6.7 Static exchange evaluation (SEE) for quiescence pruning; validated vs known exchange values
- [x] 6.8 Cooperative abort signal in the worker protocol
- [x] 6.9 Verify Phase 3: baseline gate + perft + NPS (~2x); self-play validation

## 7. Measurement & docs

- [ ] 7.1 Run AFTER matches: full self-play new-vs-baseline + Aurora vs Tomitank (levels 4/5/6)
- [ ] 7.2 Record before/after results (self-play score, NPS, time-to-depth, Tomitank gap)
- [ ] 7.3 Archive this change into `openspec/specs/`; establish OpenSpec as source of truth
- [x] 7.4 Trim README to a short intro + pointer; keep a short CLAUDE.md pointing at openspec; keep license notices
