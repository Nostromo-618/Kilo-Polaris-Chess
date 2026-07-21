# engine-strength-levels Specification

## Purpose
TBD - created by archiving change strengthen-aurora-engine. Update Purpose after archive.
## Requirements
### Requirement: Six difficulty levels

The engine SHALL expose difficulty levels 1 through 6 of monotonically
increasing strength. Each level SHALL map to a search policy consisting of a
depth cap and a per-move time budget. Level selection SHALL be clamped to the
1-6 range.

#### Scenario: Higher level is at least as strong

- **WHEN** the same position is searched at level N and level N+1
- **THEN** level N+1 searches at least as deep / as long as level N (never weaker by policy)

### Requirement: Levels 1-3 stay CPU-light

Levels 1-3 SHALL remain shallow, fixed-depth searches whose per-move computation
is small enough for a low-power browser device (no fans/battery drain). Changes
to strengthen higher levels SHALL NOT increase the node count or wall-clock of
levels 1-3.

#### Scenario: Low levels unchanged after strengthening

- **WHEN** levels 1, 2, and 3 search a position before and after the engine-strength change
- **THEN** their search depth and approximate node counts are unchanged

### Requirement: Levels 4-6 use time-managed iterative deepening

Levels 4-6 SHALL deepen iteratively until either the depth cap or the per-move
time budget is reached, whichever comes first. Level 6 SHALL have a high depth
cap so that its per-move time budget is the binding constraint in typical
middlegame positions, allowing it to use its full budget rather than stopping
early at a fixed depth.

#### Scenario: Level 6 spends its budget in the middlegame

- **WHEN** level 6 searches a typical middlegame position with a full move-time budget
- **THEN** it continues deepening until close to the time budget instead of halting at a fixed shallow depth

#### Scenario: Fast positions still return promptly

- **WHEN** level 6 searches a position it can resolve to its depth cap well within the budget (e.g. few pieces)
- **THEN** it returns as soon as the depth cap is reached without busy-waiting for the remaining time

### Requirement: Deterministic strength at the top level

The highest level SHALL be deterministic (no evaluation jitter). Any randomness
used at lower levels for variety SHALL compare moves by their search scores, not
by static evaluation, so that a move losing to a shallow tactic is never chosen
as an equal alternative.

#### Scenario: Top level plays the searched best move

- **WHEN** level 6 selects a move
- **THEN** it plays the move with the best search score with no random substitution

