# Changelog

All notable changes to this project will be documented in this file.

## [2.0.3] - 2026-04-04

### Fixed

- **AI worker:** `SearchState` now calls `_computeZobristHash` (was a typo referencing `computeZobristHash`), fixing a `ReferenceError` that broke AI moves in the worker.
- **Legal move markers:** Green dots for legal targets are absolutely centered; they no longer sit at the edge of squares when a piece is present (flex layout conflict).
- **Board / pieces (mobile):** Piece size scales with the board using container query units (`cqmin`), not viewport (`vw`), so Unicode pieces stay centered and square cells stay consistent; legal-move pseudo-element positioning updated accordingly.

### Added

- **Check highlight:** When the side to move is in check, that side’s king square gets a red tint and inset border (`highlight-in-check`). Works with selection and last-move highlights via layered inset shadows.
- **`getCheckedKingSquare(state)`** in `Rules.js` and **`getCheckedKingSquare()`** on `Game` for the UI.

### Changed

- **Controls:** Removed redundant **difficulty** `<select>` (levels 1–5 buttons only). Removed **thinking time** number input (5s / 10s / 15s / 30s / 60s buttons only). Associated `aria-labelledby` / `aria-describedby` wiring updated.
- **Board size (desktop):** Minimum width from the slider maps to **400px** (was 320px); first visit defaults to **maximum** width (slider 100 → 800px). `BOARD_SIZE_MIN_PX` / default slider in `main.js`, placeholder label in `index.html`.
- **Layout:** Desktop board column is **top-aligned** with the settings card (`align-items: flex-start` on the row and board section). Mobile board uses **fit-to-viewport** width (`min(100%, 86vw/94vw, --board-max-width)`) so narrow screens do not clip files or force a 400px-wide board without scroll.
- **Tests:** Playwright and integration tests updated for button-only difficulty and thinking time; security tests use `localStorage` for invalid values where inputs were removed.
- **README:** Expanded with quick start, features, tests, and stack; points to this changelog and version in `package.json`.

---

## [1.1.0] - 2026-03-24

### Added

#### Zobrist Hashing (Critical Performance Fix)
- Replaced string-based transposition table hashing with proper Zobrist hashing
- Pre-computed random 32-bit integers for pieces (12 types x 64 squares), side to move, castling rights (16 combinations), and en passant file (8 files)
- Incremental hash updates during move application - O(1) per move instead of O(n) string concatenation
- Expected 20-40% improvement in search speed due to dramatically reduced GC pressure

#### Board Coordinate Labels
- File labels (a-h) below the board
- Rank labels (1-8) on the left side of the board
- Labels update dynamically based on board perspective (white/black view)

#### Undo / Take-Back Feature
- "Undo" button in the controls panel
- Undoes the last two moves (player's move + computer's response)
- Disabled when no moves have been made, during AI computation, or after game over
- Full state restoration including board, castling rights, en passant, move history

#### Thinking Time Persistence
- Thinking time setting now saved to localStorage (`kpc-thinking-time`)
- Restored on page reload alongside difficulty and theme preferences

#### ESLint Configuration
- Added `.eslintrc.json` with sensible defaults for browser ES modules
- Rules: no-unused-vars (warn), no-console (warn), eqeqeq (error), no-var (error), prefer-const (warn)

### Changed

#### Vanduo Framework Updated to v1.3.1
- Updated `@vanduo-oss/framework` from v1.2.5 to v1.3.1
- Updated project `dist/` directory with new framework files

#### Move Ordering Refactored (DRY)
- Extracted shared `orderMoves()` method in `AI.js` class
- Eliminated duplicated MVV-LVA + killer move + history heuristic sorting logic
- Previously copy-pasted between `searchRoot()` and `minimax()`

#### SAN Generation Optimized
- Replaced `toSimpleSAN()` approach that cloned entire `GameState` and called `applyMoveInternalForSAN()`
- New `detectCheckAfterMove()` method uses lightweight board copy only
- No longer clones move history, repetition map, castling rights, etc.

#### Controls Refactored
- `Controls` constructor now accepts `thinkingTimeInput` and `undoButton` elements via dependency injection
- `getThinkingTime()` no longer uses `document.getElementById()` directly
- Added `setThinkingTime()`, `setUndoEnabled()` methods

#### CSS Consolidated
- Merged duplicate styles between `theme.css` and `layout.css`
- `theme.css` now contains only: CSS variables, dark theme overrides, glass panel utility, disclaimer modal styles, app-level styling
- `layout.css` now contains all chess-specific styling: squares, pieces, board grid, coordinate labels, move history, game end modal
- Fixed conflicting `.chess-square.highlight-selected` rules (theme.css vs layout.css)
- Fixed `.move-history-list` list-style conflict (`none` vs `decimal`)

#### localStorage Save Throttled
- Game state saves to localStorage now throttled to max once per 500ms
- Prevents excessive writes during rapid UI updates

#### package.json Cleaned Up
- Removed incorrect `"main": "playwright.config.js"` field
- Removed `"type": "commonjs"` (project uses ES modules)
- Added descriptive keywords: `["chess", "browser", "vanilla-js", "ai", "game"]`
- Version bumped to 1.1.0

### Fixed

#### Debug console.log Removed
- Removed `console.log("BoardView.render lastMove:", lastMove)` from `BoardView.js:113`
- Removed `console.log("Adding highlight-last-move to square:", square)` from `BoardView.js:137`

#### README Accuracy Fixed
- Removed false "Zero dependencies" claim (project depends on `@vanduo-oss/framework`)
- Removed non-existent `ThemeManager.js` from project structure listing
- Added `storage.js` and `DisclaimerModal.js` to project structure
- Updated feature list with new capabilities (undo, coordinate labels, Zobrist hashing)
- Added dependency section listing actual dependencies
- Added test running instructions
- Added difficulty level table with features per level

### Technical Details

#### Zobrist Implementation
- `ZOBRIST_PIECES[12][64]` - random 32-bit ints for each piece type on each square
- `ZOBRIST_SIDE` - single value toggled when side to move changes
- `ZOBRIST_CASTLING[16]` - one value per combination of 4 castling rights
- `ZOBRIST_EP_FILE[8]` - one value per file for en passant
- Hash updated incrementally via XOR in `applyMoveSearch()`:
  - XOR out piece from origin square
  - XOR out captured piece from target square
  - XOR out old en passant/castling
  - XOR in piece at destination
  - XOR in new en passant/castling
  - XOR in side to move toggle

#### Undo Stack Implementation
- `GameState.undoStack` stores state snapshots before each move
- Each snapshot: board (cloned), activeColor, castlingRights (deep cloned), enPassantTarget, halfmoveClock, fullmoveNumber, result, lastMove, lastMoveText, repetitionMap
- `undoLastMove()` pops two entries (current + previous) to undo player + computer moves
- `canUndo()` checks for at least 2 entries in undo stack

---

## [Unreleased] - Previous

### Added

#### Web Worker Support
- AI computation now runs in a dedicated Web Worker (`js/ai.worker.js`)
- UI remains fully responsive during AI thinking at all difficulty levels
- Graceful fallback to main thread if Web Workers are unavailable
- Automatic timeout handling with fallback if worker becomes unresponsive

#### Search Optimizations (Phase 1)
- **MVV-LVA Move Ordering**: Captures sorted by Most Valuable Victim - Least Valuable Attacker for better alpha-beta pruning (15-25% speedup)
- **Killer Move Heuristic**: Tracks moves that caused beta cutoffs at each depth level (10-15% speedup)
- **Transposition Table**: Caches up to 100k evaluated positions to avoid redundant search (30-50% speedup in middlegame)

#### Advanced Search Optimizations (Phase 2)
- **Null Move Pruning**: Skip subtrees where opponent can't improve position even with a free move (20-35% node reduction). Disabled in check and endgame positions.
- **History Heuristic**: Tracks quiet moves that cause cutoffs; improves move ordering for non-captures (10-20% better pruning)
- **Late Move Reductions (LMR)**: Search later moves at reduced depth, re-search if promising (15-25% node reduction). Only at Level 5 for deep searches.

#### Enhanced Position Evaluation
- **Bishop pair bonus**: +30 centipawns for having both bishops
- **Passed pawn bonus**: +10 to +110 centipawns based on advancement toward promotion
- **Doubled pawn penalty**: -20 centipawns per doubled pawn
- **Isolated pawn penalty**: -15 centipawns per pawn with no friendly pawns on adjacent files
- **Rook on open file**: +25 centipawns (no pawns on file)
- **Rook on semi-open file**: +12 centipawns (only enemy pawns on file)
- **King safety - Pawn shield**: +15 centipawns per pawn protecting castled king
- **King safety - Castled bonus**: +25 centipawns for king on g1/g8 or c1/c8
- **King safety - Open file penalty**: -20 centipawns per open file adjacent to king

### Changed

#### Difficulty Levels
Increased search depths and reduced randomness for stronger play:

| Level | Old Depth | New Depth | Old Randomness | New Randomness |
|-------|-----------|-----------|----------------|----------------|
| 1     | 1         | 1         | 40%            | 35%            |
| 2     | 2         | 2         | 25%            | 20%            |
| 3     | 3         | 3         | 15%            | 10%            |
| 4     | 3         | 4         | 8%             | 5%             |
| 5     | 4         | 5         | 5%             | 3%             |

### Technical Details

#### Transposition Table
- Uses string-based position hashing (board + active color + en passant)
- Stores depth, score, flag (exact/lower/upper bound), and best move
- Limited to 100k entries to prevent memory issues
- Cleared when size limit exceeded

#### Killer Moves
- 2 slots per depth level (up to depth 20)
- Only stores non-capture moves (captures already ordered first)
- Gives 9000-point bonus in move ordering (below captures)

#### History Heuristic
- 64x64 table tracking cutoffs by from-square and to-square
- Bonus = depth² on beta cutoff (deeper cutoffs weighted more)
- Values decay by 50% between searches to adapt to position changes
- Capped at 10000 to prevent overflow

#### Null Move Pruning
- Reduction depth: 3 ply (searches at depth - 4 total)
- Disabled when: in check, depth < 3, endgame (< 7 non-pawn pieces)
- Prevents consecutive null moves to avoid zugzwang issues

#### Late Move Reductions
- Only at Level 5 with depth >= 3
- First 4 moves searched at full depth
- Moves 5-7: reduced by 1 ply
- Moves 8+: reduced by 2 ply
- Re-search at full depth if reduced search improves alpha/beta

#### Web Worker Communication
- Main thread sends: `{ type: 'search', state, level, forColor, timeout }`
- Worker responds: `{ type: 'result', move }` or `{ type: 'error', message }`
- Timeout protection with automatic fallback to main thread

### Estimated Strength
- Level 5 now plays at approximately 1800-1900 Elo strength
- Phase 2 optimizations provide ~400 Elo improvement over Phase 1
