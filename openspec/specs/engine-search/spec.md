# engine-search Specification

## Purpose
TBD - created by archiving change strengthen-aurora-engine. Update Purpose after archive.
## Requirements
### Requirement: Alpha-beta search with principal-variation search

The engine SHALL search game trees with negamax/minimax alpha-beta pruning and
SHALL use principal-variation search (PVS): after the first move at a node
establishes the bound, remaining moves SHALL first be searched with a
zero-width (null) window and re-searched with the full window only when the
zero-window score falls inside `(alpha, beta)`.

#### Scenario: Zero-window scout then re-search

- **WHEN** a non-first move at an interior node returns a zero-window score `s` with `alpha < s < beta`
- **THEN** the engine re-searches that move with the full `(alpha, beta)` window before trusting `s`

#### Scenario: First move searched with full window

- **WHEN** the first (best-ordered) move at a node is searched
- **THEN** it is searched with the full `(alpha, beta)` window, not a zero window

### Requirement: Transposition table correctness

The engine SHALL cache node results in a transposition table keyed by Zobrist
hash with a depth and a bound flag (exact / lower / upper). Stored scores SHALL
be valid for reuse only when the stored depth is at least the requested depth
and the bound is compatible with the current window. The table SHALL NOT return
a score computed for a different search perspective (root color) than the
current search.

#### Scenario: Depth-insufficient entry not used for cutoff

- **WHEN** a probe finds an entry whose stored depth is less than the requested depth
- **THEN** the entry's score is not returned as a cutoff (its best move MAY still be used for ordering)

#### Scenario: Perspective change invalidates the table

- **WHEN** a new search begins for a different root color than the previous search
- **THEN** the transposition table is cleared (or perspective-mismatched entries are treated as misses) so no wrong-sign score is returned

### Requirement: Mate-score distance handling

Mate scores SHALL encode distance-to-mate relative to the search root. When a
mate score is stored in the transposition table it SHALL be adjusted by the
current node's ply so the stored value is root-independent, and it SHALL be
re-adjusted back on retrieval. Quiescence-detected mates SHALL carry the same
ply-adjusted distance rather than a flat constant.

#### Scenario: Mate score survives a transposition

- **WHEN** a mate-in-N score is stored at one node and probed at a node a different distance from the root
- **THEN** the returned score reflects the correct distance-to-mate from the probing node, so the engine prefers shorter mates

### Requirement: Draw detection inside search

The search SHALL treat a position as a draw (score 0, root-relative) when the
fifty-move counter has reached 100 half-moves or when the position repeats a
position already seen on the current search path or in the game history supplied
to the search. Game history up to the last irreversible move SHALL be provided
to the engine worker so repetitions spanning played moves are detected.

#### Scenario: Winning side avoids repeating into a draw

- **WHEN** the side to move is winning and a candidate line repeats a position from the game history or search path
- **THEN** that line is scored as 0 (draw) so the engine does not shuffle a won position into a threefold or fifty-move draw

### Requirement: Quiescence search returns bounded scores

Quiescence search SHALL resolve tactical sequences (captures, promotions, and
check evasions) and SHALL only ever return finite, in-range scores. On abort
(timeout) it SHALL propagate the abort signal upward rather than returning a
partial or sentinel (±Infinity) value, and aborted nodes SHALL NOT be written to
the transposition table.

#### Scenario: Timeout during quiescence does not corrupt results

- **WHEN** the move-time budget expires while quiescence is evaluating captures in an in-check node
- **THEN** the search reports an abort (no ±Infinity or partial score is stored or returned as a real evaluation)

### Requirement: Iterative deepening preserves the last completed best move

Root search SHALL use iterative deepening. If a deeper iteration is aborted
before any root move is fully searched, the engine SHALL keep the best move from
the last fully completed iteration rather than substituting an unsearched,
move-ordering-only guess. The root position SHALL be stored in the transposition
table after each completed iteration.

#### Scenario: Aborted deeper iteration keeps the proven move

- **WHEN** iteration at depth D+1 is aborted before its first root move completes
- **THEN** the move returned is the best move proven at depth D, not `ordered[0]` of depth D+1

### Requirement: Cooperative search abort

The engine SHALL support aborting an in-progress search cooperatively via an
abort signal, in addition to worker termination, so a running search can be
stopped without destroying and rebuilding the worker.

#### Scenario: Abort signal stops the search

- **WHEN** an abort is requested during a search
- **THEN** the search stops promptly and returns the best move found so far (or null if none), without requiring the worker to be terminated

### Requirement: Throttled wall-clock checks inside search

The engine SHALL enforce its per-move time budget with a sampled clock check
(approximately once per 256 node visits) rather than a clock read at every
node, so clock sampling does not measurably reduce search throughput. The
budget SHALL still be enforced within a few milliseconds of expiry.

#### Scenario: Search respects the budget with sampled checks

- **WHEN** a search runs with a per-move timeout
- **THEN** it aborts promptly after the budget expires (within sampling
  granularity) and returns the best move from the last completed iteration

### Requirement: Deepening tail guard

Iterative deepening SHALL NOT start a new (deeper) iteration when less than
25ms of the per-move budget remains, since such an iteration cannot complete
even its first root move. Partially completed iterations started earlier with
real time left SHALL still contribute their result.

#### Scenario: Doomed iteration is skipped

- **WHEN** an iteration completes with less than 25ms of budget remaining
- **THEN** the engine returns the best move already proven instead of starting
  an iteration that is guaranteed to abort

### Requirement: Countermove move ordering

At levels 4-6 the engine SHALL maintain a countermove table indexed by the
opponent's previous move (moved piece and target square). A quiet move that
caused a beta cutoff SHALL be recorded as the refutation of the previous move,
and matching quiet moves SHALL be ordered after killer moves and before
history-only moves at later nodes. Levels 1-3 SHALL NOT use the countermove
table.

#### Scenario: Refutation move is tried early

- **WHEN** a quiet move produced a cutoff as a reply to the opponent's previous
  move and the same previous move is encountered at another node
- **THEN** the recorded countermove is ordered ahead of ordinary quiet moves

### Requirement: SEE-ordered captures in the main search

At levels 4-6, captures in the main (non-quiescence) search SHALL be
classified by static exchange evaluation: captures with a non-negative SEE
score SHALL be ordered above killer moves; captures with a negative SEE score
SHALL be ordered below all quiet moves. Levels 1-3 and quiescence ordering
SHALL keep MVV-LVA-only capture ordering.

#### Scenario: Losing capture is deferred

- **WHEN** a capture loses material by static exchange evaluation at a main
  search node at level >= 4
- **THEN** it is searched after all quiet moves at that node

### Requirement: Mate-distance pruning

At levels 4-6, at every non-root node the engine SHALL clamp the alpha-beta
window to the mate scores reachable from that node (|score| <= MATE - ply - 1).
When the clamped window is empty the node SHALL return a bound consistent with
the transposition-table flag semantics (upper/lower/exact).

#### Scenario: Window clamped to reachable mate

- **WHEN** a node is searched with a window wider than the mate scores
  reachable from its ply
- **THEN** the window is narrowed to the reachable range before searching,
  producing cutoffs that would otherwise be missed

### Requirement: Evaluation cache

At levels 4-6 the engine SHALL memoize full static evaluations in a
Zobrist-keyed cache. Cached scores SHALL be identical to recomputation (the
cache changes only evaluation cost, never evaluation values). Levels 1-3 SHALL
continue to call the evaluator directly.

#### Scenario: Repeated position eval is free

- **WHEN** the same position is statically evaluated twice within a search or
  across moves of a game
- **THEN** the second evaluation returns the cached score without recomputing

### Requirement: Transposition table use in quiescence

At levels 4-6, quiescence nodes SHALL probe the transposition table with depth
0 and SHALL store their results with depth 0. A depth-0 store SHALL NOT
replace an entry stored at greater depth, and probes at quiescence nodes MAY
be satisfied by deeper main-search entries. Stored mate scores SHALL remain
ply-adjusted as in the main search.

#### Scenario: Quiescence result reused through the table

- **WHEN** a quiescence position is reached again via a transposition within a
  search
- **THEN** a compatible table entry supplies the score or bound without
  re-running the capture search

