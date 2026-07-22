# strengthen-aurora-engine-v320 — tasks & running log

## 1. Setup & baseline

- [x] 1.1 Branch `dev-v320` from latest `main`
- [x] 1.2 Refresh `.baseline/engine` to the 3.1.0 engine (self-play reference; gitignored)
- [x] 1.3 BEFORE match recorded: **Aurora L6 vs TT3, 40 games @1000ms = 36.3% (12W-23L-5D, Elo -98)**

## 2. Phase A — time usage & search refinements

- [x] 2.1 Throttled wall-clock checks (`isTimeUp`, every 256 calls) + <25ms iteration tail guard
- [x] 2.2 Countermove heuristic (level >= 4): table by prev-move piece+target; stored on quiet cutoffs; ordered at 8500 (after killers 9000, before history)
- [x] 2.3 SEE-ordered captures in main search (level >= 4): SEE >= 0 -> `10000+see+victim`; SEE < 0 -> `-5000+see` (below quiets)
- [x] 2.4 Mate-distance pruning (level >= 4): clamp window to |MATE - ply - 1|
- [x] 2.5 ~~Adaptive null-move reduction (R = 3 + depth/6)~~ — **REVERTED**
- [x] 2.6 ~~Razoring at depth <= 2 (margins 250/450)~~ — **REVERTED**

### Phase A gate results

- Full bundle (2.1-2.6) self-play 40 @300ms vs 3.1.0: **43.8% (Elo -44) — FAIL**
- Without 2.5+2.6 (2.1-2.4 only): **72.5% (22W-4L-14D, Elo +168) — PASS**
  Lesson: razoring and deeper null cuts lose tactical self-play at this scale.
- perft OK; 286 engine unit tests OK; baseline gate OK; levels 1-3 node counts
  IDENTICAL (L2 533, L3 3848); L6 bench depth 9 -> 10 @10s.
- TT3 milestone (Phase A), 40 @1000ms: **41.3% (9W-16L-15D, Elo -61)** — improved
  from -98 but gate (>=60%) not met. **CAVEAT:** measured under extreme external
  system load (coreaudiod runaway, load avg >20). Depth-capped tomitank is
  load-immune while time-capped Aurora loses plies — treat 41.3% as a LOWER
  BOUND; re-run on an idle machine.

## 3. Phase B — eval/NPS speed (implemented, gate pending)

- [x] 3.1 Evaluation cache (levels 4-6 hot paths): 64k Zobrist-keyed always-replace memo; identical scores
- [x] 3.2 Quiescence TT probe/store (level >= 4, depth 0; deeper entries satisfy probes; depth-0 stores never clobber deeper entries)
- [x] 3.3 Dedicated capture/promotion-only pseudo-move generator in Rules.js
  (verified identical to generate-all-then-filter: 3658 random-game positions + EP/promotion/pin/check edge cases, 0 mismatches)
- [x] 3.4 Self-play gate for Phase B bundle: 40 @300ms vs 3.1.0 — see day-2 log
  below (mixed result; resolved by milestone-truth rule)
- [x] 3.5 Re-run TT3 @1000ms: **63.7% — GATE PASSED** (see day-2 log)

## 4. Milestone gates (remaining)

- [x] 4.1 TT3 gate: >= 60% over 40 games @1000ms — **PASS 63.7% (18W-7L-15D, Elo +98)**
- [x] 4.2 Non-regression: TT2 @300ms stays >= 55% — **PASS 78.8% (29W-6L-5D, Elo +228)** (3.1.0 scored 57.1%)
- [ ] 4.3 Stretch: TT3 @300ms — deferred to next session

## Day-2 log (2026-07-22)

### Environment saga

- Morning canary: BASELINE ~150-170k nodes @10s vs expected ~900k — machine
  loaded (Malwarebytes post-boot scan ~68% CPU, GeForceNOW ~29%; load avg 3.6-5).
  User vetoed waiting; proceeded under load (measurements = lower bounds).
- vs-tomitank harness died twice ("browser has been closed" at ~15-17 min).
  Root cause not proven (an unrelated agent session on the same machine runs
  its own dev servers/pkills; memory was also tight). **Fix landed:**
  vs-tomitank.mjs now relaunches the browser session and retries the in-flight
  game (up to 3x), and persists results JSON after every game.
- Midday: the day-1 coreaudiod runaway returned (185% CPU, load avg 16.95).
  User killed it; canary then healthy (baseline depth 9 / ~948k nodes @10s).
  All "clean" results below were measured after this fix.

### Results

- **TT3 @1000ms, 40 games, committed Phase A+B build (71122de): 63.7%
  (18W-7L-15D, Elo +98) — MILESTONE GATE PASSED.** One browser relaunch
  mid-match (harness recovered). Machine load fluctuated early in the match
  (score rose as it idled) — treat as a valid pass, mildly conservative.
- Phase B self-play gate @300ms (criterion ~70%, Phase-A-only was 72.5%):
  - with qsearch-TT: **57.5% (loaded, load avg ~17)** and **60.0% (clean)**
  - qsearch-TT reverted (experiment per plan step 3): **65.0% (clean)**
  - Interpretation: revert recovers ~5 points at 300ms; residual gap to 72.5%
    is ~1 sigma (40-game matches). qsearch-TT buys ~0 NPS at L6 bench
    (1.007M vs 1.011M nodes @10s) but its 1000ms-milestone effect is
    UNMEASURED — the 63.7% pass belongs to the build that includes it.
- **Decision (milestone-truth rule + escalation policy): ship the committed
  71122de build (with qsearch-TT) as 3.2.0.** Rationale: TT3 matches are the
  only milestone truth; the reverted build has no 1000ms measurement; the
  300ms self-play difference (60.0% vs 65.0%) is within noise of a keep/revert
  call and both builds are comfortably stronger than 3.1.0 (+70 to +108 Elo).
- **Backlog (next session):** TT3 @1000ms A/B with qsearch-TT reverted
  (candidate: keep it out if it also wins at 1000ms); TT3 @300ms stretch;
  then Batch 1/2 candidates only if a future gate fails.

### Validation after qsearch-TT revert experiment (build restored to 71122de)

- perft OK; 286 engine unit tests OK; L1-3 node counts identical (533/3848);
  L6 bench depth 10 / ~1.0M nodes @10s on the cleaned machine.

## 5. Next candidates if gate still fails (ordered by expected value)

1. History malus (penalize quiets that failed to cut when a later quiet cuts)
2. IIR (reduce depth 1 at depth >= 4 nodes with no TT move)
3. King-safety retune — losses are mostly checkmates (14/23 TT wins by mate);
   raise king-ring attack / loose-square penalties, possibly attacker-count scaling
4. Knight outpost term (supported knight on ranks 4-6, unattackable by enemy pawns)
5. Qsearch checks at the first qnode level (evasion-quality pressure)
6. Re-test adaptive null-move at 1000ms+ only (it was only proven harmful @300ms)

## 6. Release

- [x] 6.1 `openspec validate` — `strengthen-aurora-engine-v320` valid (strict)
- [x] 6.2 Version 3.2.0 + `js/data/changelogData.js` entry; full suite green:
  904/904 test:quick, perft OK, 3/3 test:baseline, 286 engine unit tests,
  L1-3 node counts identical (533/3848), L6 bench depth 10 / ~950k nodes @10s
- [ ] 6.3 Archive change; merge `dev-v320` — left for the user (no push/merge/tag per plan)

## Environment note for future runs

Benchmarks/matches are time-based: run them on an otherwise idle machine.
External load (e.g. the 2026-07-21 coreaudiod runaway, load avg >20) depresses
Aurora disproportionately (tomitank is depth-capped and unaffected). The
before/phaseA TT3 comparison (+37 Elo) was measured under different load
levels and should be re-confirmed.
