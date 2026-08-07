## ADDED Requirements

### Requirement: Uncapped full-strength mode

The engine SHALL support an opt-in **uncapped** search mode for engine-vs-engine
matches. In uncapped mode the engine SHALL use the level-6 search policy
(deterministic, all level 4-6 features, level-6 transposition table) but SHALL
NOT apply the per-level depth cap: iterative deepening SHALL continue until the
per-move time budget is spent, subject to a fixed internal ceiling that keeps
search tables safely sized. The mode SHALL be deterministic and SHALL respect
the same time-management and cooperative-abort behavior as capped searches.
Difficulty levels 1-6 SHALL be unaffected by the existence of this mode.

#### Scenario: Uncapped search deepens past the level-6 cap

- **WHEN** an uncapped search runs on a position that a capped level-6 search
  resolves to its depth cap well within the budget
- **THEN** it continues deepening beyond the level-6 cap until the time budget
  (or the fixed internal ceiling) stops it

#### Scenario: Uncapped search respects the time budget

- **WHEN** an uncapped search is given a fixed per-move timeout
- **THEN** it returns a legal best move promptly after the budget is spent,
  without exceeding the budget beyond the usual sampling/tail-guard tolerance

#### Scenario: Levels 1-6 unchanged

- **WHEN** levels 1 through 6 search a position with `uncapped` off
- **THEN** their behavior (depth, node counts, move choice) is identical to the
  pre-change engine
