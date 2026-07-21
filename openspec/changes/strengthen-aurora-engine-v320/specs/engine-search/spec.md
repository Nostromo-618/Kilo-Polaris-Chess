## ADDED Requirements

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
