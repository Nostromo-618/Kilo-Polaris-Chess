## ADDED Requirements

### Requirement: Uncapped Aurora in matches

The match tooling SHALL support running **Aurora uncapped** — level-6 search
policy with no depth ceiling, bounded only by the shared per-move time budget —
so the equal-time control is symmetric when TomitankChess is also uncapped.
Uncapping Aurora SHALL be opt-in (a CLI flag on the harness and a per-engine
toggle in the match UI) and SHALL NOT change the default behavior of existing
match modes or recorded baselines.

#### Scenario: Both-uncapped control reports a comparable score

- **WHEN** the equal-time control is run with Aurora uncapped against uncapped
  TomitankChess for N games at a fixed movetime
- **THEN** it reports Aurora's score with a 95% confidence interval under a
  label distinct from the Aurora-capped control, so the symmetric equal-time
  comparison can be read without contaminating earlier baselines

#### Scenario: Match UI exposes a per-engine full-strength toggle

- **WHEN** a match side uses the built-in Aurora engine
- **THEN** the match setup offers an "Aurora full strength" toggle for that
  engine, symmetric to the existing Tomitank toggle, and the chosen setting
  persists across sessions
