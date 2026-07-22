## ADDED Requirements

### Requirement: Equal-time (uncapped) yardstick control

The Aurora-vs-Tomitank harness SHALL support driving TomitankChess **uncapped**
— searching to the shared per-move time budget instead of its per-level depth
cap — so Aurora can be measured against the full-strength engine under an
equal-time control. The per-level depth-capped mode SHALL remain the default,
and both modes SHALL give both engines the identical per-move time budget. The
control SHALL support replication and SHALL report the aggregate score with a
confidence interval.

#### Scenario: Uncapped control reports a comparable score

- **WHEN** the harness plays Aurora against an uncapped TomitankChess for N
  games at a fixed movetime
- **THEN** it reports Aurora's score and a 95% confidence interval so the
  equal-time strength gap to the full engine can be read directly, rather than
  the depth-capped per-level result
