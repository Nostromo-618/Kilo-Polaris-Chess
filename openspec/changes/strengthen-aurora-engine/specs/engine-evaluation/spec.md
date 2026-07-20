## ADDED Requirements

### Requirement: Board-oriented piece-square tables

Static evaluation SHALL apply piece-square tables consistent with the board's
`a1=0` indexing (index 0 = a1, index 63 = h8), for both colors via rank
mirroring. Every table SHALL reward advancement in the correct direction: a
white pawn's value SHALL increase as it approaches the 8th rank, and a king's
middlegame table SHALL favor a castled back-rank position over an advanced one.

#### Scenario: A passed pawn is worth more as it advances

- **WHEN** a lone white passed pawn is evaluated on e2 versus on e7
- **THEN** the evaluation on e7 is strictly greater than on e2

#### Scenario: King prefers safety in the middlegame

- **WHEN** the king's middlegame piece-square value is compared between a castled back-rank square and a centralized advanced square, with full material on the board
- **THEN** the back-rank square scores higher

### Requirement: Passed-pawn valuation

The passed-pawn bonus SHALL be indexed by the pawn's true advancement (distance
toward promotion) so that more advanced passers receive larger bonuses, and this
SHALL be consistent with the passed-pawn-race and king-proximity terms.

#### Scenario: Advancement bonus increases toward promotion

- **WHEN** the passed-pawn bonus is computed for a passer on the 6th rank versus the 3rd rank
- **THEN** the 6th-rank passer receives the larger bonus

### Requirement: Correct attack detection in evaluation

Evaluation terms that test whether a square is attacked (loose-piece and
king-pressure terms) SHALL consider all attacking directions independently; a
blocker in one direction SHALL NOT suppress detection of attackers along other
directions.

#### Scenario: Slider attack seen despite a blocker elsewhere

- **WHEN** a square is attacked by a rook along one ray while another ray from that square is blocked by an unrelated piece
- **THEN** the square is still reported as attacked

### Requirement: Rook activity on the seventh rank

The rook-on-seventh bonus SHALL reward a rook that confines the enemy king to
its back rank by testing the enemy king against its actual back rank (rank 8 for
a white rook's target, rank 1 for a black rook's target), distinct from the
rook's own rank used for the pawn-target condition.

#### Scenario: Back-rank king triggers the confinement bonus

- **WHEN** a white rook is on the 7th rank and the black king is on the 8th rank
- **THEN** the king-confinement component of the rook-on-seventh bonus applies

### Requirement: Evaluation perspective consistency

Evaluation SHALL return a score in centipawns from the perspective of the
requested color (positive = good for that color), and all terms SHALL be sign-
consistent with that convention. Terms scaled by game phase SHALL be tapered
between middlegame and endgame without double-counting.

#### Scenario: Symmetric start position is balanced

- **WHEN** the standard starting position is evaluated for either color
- **THEN** the score is within a small tempo margin of zero (no structural imbalance)
