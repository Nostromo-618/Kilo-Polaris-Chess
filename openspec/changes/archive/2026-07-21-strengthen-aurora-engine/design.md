## Context

Aurora's search is a `rootColor`-relative minimax (not negamax) with alpha-beta,
a BigInt-Zobrist transposition table, null-move, LMR, and quiescence. A verified
23-agent audit + Node benchmark established the facts this design builds on:

- Measured ~47k NPS (M4); ~74% of time in `generateLegalMoves` + `evaluate`;
  84-93% of nodes are quiescence nodes. BigInt hashing is NOT a bottleneck (<2%).
- Level 6 reaches its fixed depth-7 cap in ~5.3s of a 10s budget in a middlegame
  (0.44s from the opening), so the depth cap — not time — bounds it.
- Confirmed correctness bugs (eval orientation, quiescence ±Infinity, TT mate
  distance, aspiration reset, timed-out root overwrite, color-poisoned TT).

## Goals / Non-Goals

Goals: fix correctness bugs; make level 6 use its time budget; raise NPS with
behavior-preserving throughput work + PVS/SEE; measure before/after.

Non-Goals: a full bitboard/0x88 rewrite (out of scope here — noted as future
headroom); changing levels 1-3; opening books or endgame tablebases; touching
the vendored engine.

## Decisions

### Keep the minimax (rootColor-relative) formulation

The search is `rootColor`-relative rather than negamax. Rewriting to negamax
would touch every pruning branch and risk sign bugs. Decision: keep the existing
formulation and fix bugs in place. PVS and SEE are added within it. Mate scores
stay in the `±(MATE - ply)` family but become ply-corrected on TT store/probe.

### Draw detection via a path/history hash list

`SearchState.makeMove`/`undoMove` push/pop `hash` onto a path array.
`Game.computeAIMove` passes the list of position hashes since the last
irreversible move to the worker; `minimax` returns 0 at entry when
`halfmoveClock >= 100` or the current hash appears in path ∪ history. This is the
minimal correct fix and needs worker-protocol plumbing (new `history` field).

### Per-level policy table replaces fixed depth-per-level

Introduce a policy map: `{ level: { depthCap, timeMs } }`. Levels 1-3 keep tiny
fixed depths and effectively unlimited time (they finish instantly), preserving
their CPU profile exactly. Levels 4-6 get `{4: ~1.5s, 5: ~4s, 6: full budget}`
with depth caps raised so time binds (L6 cap ~20). Time budget still flows from
`engineAdapter`/`Game` as today; the adapter passes the level so `AI.findBestMove`
can select both the depth cap and (when the caller does not override) the level's
time budget. Match mode continues to pass an explicit movetime.

### Throughput: allocation-free, behavior-preserving first

Order of throughput work, each independently verifiable and score-identical
except where noted:
1. `leavesKingInCheck`: mutate the real board, test, revert — no `slice()`/clone
   per pseudo-move. Track king index incrementally in `SearchState`.
2. Capture/promotion-only generator for quiescence (skip full legal-gen+filter).
3. Decorate-then-sort move ordering (score once per move, not per comparison).
4. Remove the dead second `JSON.parse(JSON.stringify(castlingRights))` in
   `makeMove`; replace remaining deep clones with shallow structured copies.
5. Lazy `staticEval` (compute only when a consumer needs it).

Then the strength-adding search technique:
6. PVS: zero-window scout + re-search for non-first moves.
7. SEE: prune losing captures in quiescence and demote them in ordering.

### Measurement design

Progress is measured two ways. Primary: new-Aurora vs baseline-Aurora self-play
at equal movetime (direct "is it stronger"). Yardstick: Aurora vs TomitankChess
before and after, comparing the score gap. Self-play runs in pure Node (engine
is dependency-free); the Tomitank harness runs under Playwright because the
vendored engine is a browser Web Worker, reusing `js/tomitankClient.js` /
`uciMatch.js` so the GPL source is never read.

## Risks / Trade-offs

- Eval-orientation fixes change scores globally; the v2.1.3 baseline gate and
  self-play guard against regressions. Expected net positive (audit est. +150-250
  Elo self-play).
- PVS/SEE are the highest-risk-for-bugs changes; they land last, each gated by
  self-play vs the pre-PVS build so a regression is caught and revertable.
- Slow-hardware safety: time-managed deepening self-adapts (one ply fewer)
  instead of timing out, which is strictly safer than today's fixed cap.

## Migration

No user-facing migration. Saved games remain compatible (difficulty is re-read;
the added worker `history` field is optional and defaults to empty). Engine
scores change but there is no persisted eval.
