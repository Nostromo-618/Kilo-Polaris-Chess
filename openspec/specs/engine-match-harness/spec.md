# engine-match-harness Specification

## Purpose
TBD - created by archiving change strengthen-aurora-engine. Update Purpose after archive.
## Requirements
### Requirement: Headless Aurora-vs-Aurora self-play

The project SHALL provide a headless harness that plays complete games between
two Aurora engine builds (e.g. a baseline snapshot vs. the current tree) at a
fixed per-move time budget, and reports win/loss/draw counts and a score. This
runs in Node against the dependency-free engine modules.

#### Scenario: Self-play match reports a result

- **WHEN** the harness is run for N games between two engine builds at a fixed movetime
- **THEN** it plays each game to a terminal result (checkmate, stalemate, or draw/adjudication) and prints the aggregate score

### Requirement: Aurora-vs-Tomitank measurement

The project SHALL provide a harness that plays Aurora against the vendored
TomitankChess engine as an external strength yardstick, driven through the
existing UCI worker client without reading or copying the vendored engine's
source. Because TomitankChess runs as a browser Web Worker, this harness MAY run
under a browser automation context.

#### Scenario: Yardstick match produces a comparable score

- **WHEN** the harness plays Aurora against TomitankChess for N games at a fixed movetime, before and after an engine change
- **THEN** it reports each side's score so the before/after gap to the yardstick can be compared

### Requirement: Fair and terminating games

Harness games SHALL use identical time budgets for both sides and SHALL
terminate: they SHALL apply the standard draw rules and MAY adjudicate a game as
decided when one side holds a large, stable evaluation advantage or as drawn
after an inactivity threshold, so a match cannot run forever.

#### Scenario: Games do not run unbounded

- **WHEN** a game reaches a long shuffling sequence with no captures or pawn moves
- **THEN** the harness adjudicates the game (draw or decisive) rather than continuing indefinitely

