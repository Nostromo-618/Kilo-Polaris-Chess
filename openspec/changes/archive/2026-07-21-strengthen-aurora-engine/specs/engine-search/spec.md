## ADDED Requirements

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
