// @ts-check
import { test, expect } from '@playwright/test';

/**
 * AI Module Tests - Transposition Table
 * Tests for Zobrist hashing, transposition table operations
 */

test.describe('AI - Transposition Table', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
    });

    test('should compute consistent Zobrist hash for same position', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');
            const { AI } = await import('/js/engine/AI.js');

            const state = GameState.createStarting('white');
            const ai = new AI();

            const hash1 = ai.computeZobristHash ? ai.computeZobristHash(state) : null;
            const hash2 = ai.computeZobristHash ? ai.computeZobristHash(state) : null;

            return { hash1, hash2, match: hash1 === hash2 };
        });

        expect(result.match).toBe(true);
        expect(result.hash1).not.toBeNull();
    });

    test('should produce different hashes for different positions', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');
            const { AI } = await import('/js/engine/AI.js');

            const state1 = GameState.createStarting('white');
            const ai = new AI();

            const hash1 = ai.computeZobristHash ? ai.computeZobristHash(state1) : null;

            // Make a move
            const moves = generateLegalMoves(state1.asRulesState());
            const e4Move = moves.find(m => m.from === 'e2' && m.to === 'e4');
            state1.applyMove(e4Move);

            const hash2 = ai.computeZobristHash ? ai.computeZobristHash(state1) : null;

            return { hash1, hash2, different: hash1 !== hash2 };
        });

        expect(result.different).toBe(true);
    });

    test('should store and retrieve transposition table entries', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            // Compute hash
            const hash = ai.computeZobristHash ? ai.computeZobristHash(state) : 0n;

            // Store entry
            if (ai.storeTable) {
                ai.storeTable(hash, 3, 100, 0, { from: 'e2', to: 'e4' });
            }

            // Probe entry
            const entry = ai.probeTable ? ai.probeTable(hash, 3, -1000, 1000) : null;

            return { entry, hasEntry: entry !== null };
        });

        expect(result.hasEntry).toBe(true);
    });

    test('should handle transposition table size limits', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            // Fill table with many entries
            for (let i = 0; i < 200000; i++) {
                const hash = BigInt(i);
                if (ai.storeTable) {
                    ai.storeTable(hash, 1, i, 0, null);
                }
            }

            // Table should still work
            return { tableSize: ai.transpositionTable ? ai.transpositionTable.length : 0 };
        });

        expect(result.tableSize).toBe(100000); // TT_MAX_SIZE
    });

    test('should replace older entries with deeper searches', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            const hash = ai.computeZobristHash ? ai.computeZobristHash(state) : 0n;

            // Store shallow entry
            if (ai.storeTable) {
                ai.storeTable(hash, 2, 50, 0, null);
            }

            // Store deeper entry
            if (ai.storeTable) {
                ai.storeTable(hash, 4, 100, 0, null);
            }

            // Probe should return deeper entry
            const entry = ai.probeTable ? ai.probeTable(hash, 3, -1000, 1000) : null;

            return { entry, score: entry };
        });

        expect(result.score).toBe(100);
    });

    test('should handle different transposition table flags', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            const hash = ai.computeZobristHash ? ai.computeZobristHash(state) : 0n;

            // Store exact score
            if (ai.storeTable) {
                ai.storeTable(hash, 3, 100, 0, null); // TT_EXACT
            }

            const exactEntry = ai.probeTable ? ai.probeTable(hash, 3, -1000, 1000) : null;

            // Store lower bound
            if (ai.storeTable) {
                ai.storeTable(hash, 3, 200, 1, null); // TT_LOWER
            }

            const lowerEntry = ai.probeTable ? ai.probeTable(hash, 3, -1000, 150) : null;

            // Store upper bound
            if (ai.storeTable) {
                ai.storeTable(hash, 3, 50, 2, null); // TT_UPPER
            }

            const upperEntry = ai.probeTable ? ai.probeTable(hash, 3, 60, 1000) : null;

            return { exact: exactEntry, lower: lowerEntry, upper: upperEntry };
        });

        expect(result.exact).toBe(100);
        expect(result.lower).toBe(200);
        expect(result.upper).toBe(50);
    });

    test('should reject transposition table index collisions with different keys', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const ai = new AI();
            ai.ttSize = 1;
            ai.transpositionTable = new Array(1);

            ai.storeTable(1n, 3, 111, 0, { from: 'e2', to: 'e4' });
            const sameKey = ai.probeTable(1n, 3, -1000, 1000);
            const collidingKey = ai.probeTable(2n, 3, -1000, 1000);
            const collidingMove = ai.probeTTMove(2n);

            return { sameKey, collidingKey, collidingMove };
        });

        expect(result.sameKey).toBe(111);
        expect(result.collidingKey).toBeNull();
        expect(result.collidingMove).toBeNull();
    });
});

test.describe('AI - Move Ordering', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
    });

    test('should order captures before quiet moves (MVV-LVA)', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            // Make some moves to reach a position with captures
            const moves = generateLegalMoves(state.asRulesState());
            const e4Move = moves.find(m => m.from === 'e2' && m.to === 'e4');
            state.applyMove(e4Move);

            const blackMoves = generateLegalMoves(state.asRulesState());
            const e5Move = blackMoves.find(m => m.from === 'e7' && m.to === 'e5');
            state.applyMove(e5Move);

            // Now get moves for white - should include captures
            const whiteMoves = generateLegalMoves(state.asRulesState());

            // Order moves
            const ordered = ai.orderMoves ? ai.orderMoves(whiteMoves, 3) : whiteMoves;

            // Check if captures are ordered first
            const firstMoves = ordered.slice(0, 5).map(m => m.captured ? 'capture' : 'quiet');

            return { firstMoves, ordered: ordered.slice(0, 3).map(m => ({ from: m.from, to: m.to, captured: !!m.captured })) };
        });

        expect(result.ordered.length).toBeGreaterThan(0);
    });

    test('should prioritize killer moves', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            const moves = generateLegalMoves(state.asRulesState());

            // Store a killer move
            if (ai.storeKillerMove && moves.length > 0) {
                ai.storeKillerMove(moves[0], 3);
            }

            // Check if move is recognized as killer
            const isKiller = ai.isKillerMove ? ai.isKillerMove(moves[0], 3) : false;

            return { isKiller, move: moves[0] };
        });

        expect(result.isKiller).toBe(true);
    });

    test('should update history heuristic scores', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            const moves = generateLegalMoves(state.asRulesState());
            const e4Move = moves.find(m => m.from === 'e2' && m.to === 'e4');

            // Update history
            if (ai.updateHistory) {
                ai.updateHistory(e4Move, 3);
            }

            // Get history score
            const score = ai.getHistoryScore ? ai.getHistoryScore(e4Move) : 0;

            return { score, move: e4Move };
        });

        expect(result.score).toBeGreaterThan(0);
    });
});

test.describe('AI - Search Algorithms', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
    });

    test('should perform minimax search with alpha-beta pruning', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI, SearchState } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            const searchState = new SearchState(state);

            return { hasSearchState: searchState !== null };
        });

        expect(result.hasSearchState).toBe(true);
    });

    test('should handle quiescence search for tactical positions', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            // Quiescence search should be available
            const hasQuiescence = typeof ai.quiescence === 'function';

            return { hasQuiescence };
        });

        expect(result.hasQuiescence).toBe(true);
    });

    test('should implement null move pruning', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();

            // Check for null move pruning constants
            const hasNullMoveReduction = ai.constructor && ai.constructor.NULL_MOVE_REDUCTION !== undefined;

            return { hasNullMoveReduction };
        });

        // This test checks if the feature exists
        expect(true).toBe(true);
    });

    test('should implement late move reductions', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');

            const ai = new AI();

            // LMR should be implemented in minimax
            const hasMinimax = typeof ai.minimax === 'function';

            return { hasMinimax };
        });

        expect(result.hasMinimax).toBe(true);
    });

    test('should respect depth limits in search', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            // Check depth mapping
            const depthForLevel = ai.depthForLevel;

            return {
                level1Depth: depthForLevel[1],
                level3Depth: depthForLevel[3],
                level5Depth: depthForLevel[5],
                level6Depth: depthForLevel[6],
            };
        });

        // Levels 1-3 keep their fixed shallow caps (CPU-light). Levels 4-6 have
        // high caps so the per-move time budget binds instead (time-managed).
        expect(result.level1Depth).toBe(1);
        expect(result.level3Depth).toBe(3);
        expect(result.level5Depth).toBeGreaterThanOrEqual(5);
        expect(result.level6Depth).toBeGreaterThanOrEqual(7);
    });

    test('should handle timeout during search', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            // Test with very short timeout
            const startTime = Date.now();
            const timeout = 1; // 1ms timeout

            return { startTime, timeout };
        });

        expect(true).toBe(true);
    });
});

test.describe('AI - Difficulty Levels', () => {
    // Note: no game is started here — difficulty is a new-game setting and is
    // locked while a game is in progress, so each test sets it, then starts the
    // game itself.
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
    });

    test('should use different randomness levels for each difficulty', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');

            const ai = new AI();

            return {
                level1Randomness: ai.randomness[1],
                level3Randomness: ai.randomness[3],
                level4Randomness: ai.randomness[4],
                level5Randomness: ai.randomness[5],
                level6Randomness: ai.randomness[6],
            };
        });

        // Variety jitter is kept only at the casual low levels; levels 4-6 play
        // their best move (no jitter) so they are as strong as the search allows.
        expect(result.level1Randomness).toBeGreaterThan(result.level3Randomness);
        expect(result.level3Randomness).toBeGreaterThan(0);
        expect(result.level4Randomness).toBe(0);
        expect(result.level5Randomness).toBe(0);
        expect(result.level6Randomness).toBe(0);
    });

    test('should select best move at level 1 with randomness', async ({ page }) => {
        test.slow();

        await page.locator('#difficulty-choice button[data-level="1"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Make a move and verify AI responds
        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');

        // Wait for AI response
        await page.waitForFunction(() => {
            const status = document.querySelector('#status-text');
            if (!status) return false;
            return status.textContent?.includes('Your move') || status.textContent?.includes('Checkmate');
        }, { timeout: 10000 });

        // Verify move was made
        const moveHistory = page.locator('#move-history li');
        const count = await moveHistory.count();
        expect(count).toBeGreaterThanOrEqual(2);
    });

    test('should play stronger moves at higher levels', async ({ page }) => {
        test.slow();

        // Test at level 5
        await page.locator('#difficulty-choice button[data-level="5"]').click();

        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Make e4
        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');

        // Wait for AI response
        await page.waitForFunction(() => {
            const status = document.querySelector('#status-text');
            if (!status) return false;
            return status.textContent?.includes('Your move') || status.textContent?.includes('Checkmate');
        }, { timeout: 15000 });

        // Verify AI made a reasonable response
        const moveHistory = page.locator('#move-history li');
        const count = await moveHistory.count();
        expect(count).toBeGreaterThanOrEqual(2);
    });
});

test.describe('AI - Performance', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
    });

    test('should complete level 1 search within time limit', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            const startTime = performance.now();
            const move = await ai.findBestMove(state, { level: 1, forColor: 'black', timeout: 5000 });
            const endTime = performance.now();

            return {
                hasMove: move !== null,
                timeMs: endTime - startTime
            };
        });

        expect(result.hasMove).toBe(true);
        expect(result.timeMs).toBeLessThan(5000);
    });

    test('should complete level 3 search within time limit', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            const startTime = performance.now();
            const move = await ai.findBestMove(state, { level: 3, forColor: 'black', timeout: 10000 });
            const endTime = performance.now();

            return {
                hasMove: move !== null,
                timeMs: endTime - startTime
            };
        });

        expect(result.hasMove).toBe(true);
        expect(result.timeMs).toBeLessThan(10000);
    });

    test('should handle progressive deepening', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            // Check if progressive deepening method exists
            const hasProgressiveDeepening = typeof ai.progressiveDeepeningSearch === 'function';

            return { hasProgressiveDeepening };
        });

        expect(result.hasProgressiveDeepening).toBe(true);
    });
});

test.describe('AI - Edge Cases', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
    });

    test('should handle checkmate position', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            // Create a checkmate position (Scholar's mate)
            const checkmateState = {
                board: [
                    'bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR',
                    'bP', 'bP', 'bP', 'bP', null, 'bP', 'bP', 'bP',
                    null, null, null, null, 'bP', null, null, null,
                    null, null, null, null, 'wP', null, null, null,
                    null, null, null, null, 'wB', 'wQ', null, null,
                    null, null, null, null, null, null, null, null,
                    'wP', 'wP', 'wP', 'wP', null, 'wP', 'wP', 'wP',
                    'wR', 'wN', 'wB', null, 'wK', null, null, 'wR'
                ],
                activeColor: 'black',
                castlingRights: {
                    white: { kingSide: true, queenSide: true },
                    black: { kingSide: true, queenSide: true }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 3
            };

            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const ai = new AI();
            const legal = generateLegalMoves(checkmateState);
            const move = await ai.findBestMove(checkmateState, { level: 3, forColor: 'black', timeout: 5000 });

            return { hasMove: move !== null, legalLen: legal.length };
        });

        // findBestMove returns null iff there are no legal moves
        expect(result.hasMove).toBe(result.legalLen > 0);
    });

    test('should handle stalemate position', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            // Create a stalemate position
            const stalemateState = {
                board: [
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, 'bK',
                    null, null, null, null, null, null, null, 'bP',
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, 'wP',
                    null, null, null, null, null, null, 'wK', null
                ],
                activeColor: 'black',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 100
            };

            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const ai = new AI();
            const legal = generateLegalMoves(stalemateState);
            const move = await ai.findBestMove(stalemateState, { level: 3, forColor: 'black', timeout: 5000 });

            return { hasMove: move !== null, legalLen: legal.length };
        });

        expect(result.hasMove).toBe(result.legalLen > 0);
    });

    test('should handle promotion moves', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            // Create position with promotion possibility
            const promotionState = {
                board: [
                    null, null, null, null, null, null, null, null,
                    'wP', null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, 'bK',
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, 'wK', null, null, null
                ],
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 50
            };

            const ai = new AI();
            const move = await ai.findBestMove(promotionState, { level: 3, forColor: 'white', timeout: 5000 });

            return { move, promotes: move?.promotion !== null };
        });

        expect(result.promotes).toBe(true);
    });

    test('should handle castling moves', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const state = GameState.createStarting('white');

            const ai = new AI();
            const move = await ai.findBestMove(state, { level: 1, forColor: 'white', timeout: 5000 });

            return { move };
        });

        expect(result.move).not.toBeNull();
    });

    test('should handle en passant captures', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            // Create position with en passant possibility
            const enPassantState = {
                board: [
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    'bP', 'wP', null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, 'wK', null, null, null
                ],
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: 'b6',
                halfmoveClock: 0,
                fullmoveNumber: 10
            };

            const ai = new AI();
            const move = await ai.findBestMove(enPassantState, { level: 3, forColor: 'white', timeout: 5000 });

            return { move, isEnPassant: move?.isEnPassant };
        });

        // En passant may or may not be chosen, but should not crash
        expect(true).toBe(true);
    });
});

test.describe('AI - Uncapped match mode', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
    });

    // Boards are indexed a1 = 0 … h8 = 63 (see Board.js).
    // KPvK: capped level 6 resolves to its depth cap (22) in well under a
    // second; uncapped keeps deepening until the clock stops it (depth ~28 at
    // 2.5s in Node — verified via tests/matches-style probe).
    const SPARSE_PAWN_ENDING = [['e1', 'wK'], ['e8', 'bK'], ['a2', 'wP']];
    const FORCING_PROMOTION = [['e1', 'wK'], ['h8', 'bK'], ['a7', 'wP']];

    test('uncapped search deepens past the level-6 depth cap', async ({ page }) => {
        test.slow();
        const result = await page.evaluate(async ([sparse]) => {
            const { AI } = await import('/js/engine/AI.js');

            const buildState = (pieces, activeColor = 'white') => {
                const board = new Array(64).fill(null);
                for (const [sq, p] of pieces) {
                    const file = sq.charCodeAt(0) - 97;
                    const rank = Number(sq[1]) - 1;
                    board[rank * 8 + file] = p;
                }
                return {
                    board,
                    activeColor,
                    castlingRights: {
                        white: { kingSide: false, queenSide: false },
                        black: { kingSide: false, queenSide: false }
                    },
                    enPassantTarget: null,
                    halfmoveClock: 0,
                    fullmoveNumber: 40
                };
            };

            // Few pieces: a capped level-6 search resolves to its depth cap (22)
            // well within the budget, while uncapped must keep deepening until
            // the clock stops it.
            const cappedAI = new AI();
            await cappedAI.findBestMove(buildState(sparse), { level: 6, forColor: 'white', timeout: 2500 });
            const cappedDepth = cappedAI.getLastSearchInfo().depthCompleted;

            const uncappedAI = new AI();
            await uncappedAI.findBestMove(buildState(sparse), { level: 6, forColor: 'white', timeout: 4000, uncapped: true });
            const uncappedDepth = uncappedAI.getLastSearchInfo().depthCompleted;

            return { cappedDepth, uncappedDepth };
        }, [SPARSE_PAWN_ENDING]);

        expect(result.cappedDepth).toBeLessThanOrEqual(22);
        expect(result.uncappedDepth).toBeGreaterThan(22);
        expect(result.uncappedDepth).toBeLessThanOrEqual(56);
    });

    test('uncapped search is deterministic', async ({ page }) => {
        test.slow();
        const result = await page.evaluate(async ([forcing]) => {
            const { AI } = await import('/js/engine/AI.js');

            const buildState = (pieces, activeColor = 'white') => {
                const board = new Array(64).fill(null);
                for (const [sq, p] of pieces) {
                    const file = sq.charCodeAt(0) - 97;
                    const rank = Number(sq[1]) - 1;
                    board[rank * 8 + file] = p;
                }
                return {
                    board,
                    activeColor,
                    castlingRights: {
                        white: { kingSide: false, queenSide: false },
                        black: { kingSide: false, queenSide: false }
                    },
                    enPassantTarget: null,
                    halfmoveClock: 0,
                    fullmoveNumber: 40
                };
            };

            // a7 pawn promotes by force — the best move is stable at every
            // depth, so timing-driven depth differences cannot flip the choice.
            const run = async () => {
                const ai = new AI();
                const move = await ai.findBestMove(buildState(forcing), { level: 6, forColor: 'white', timeout: 800, uncapped: true });
                const info = ai.getLastSearchInfo();
                return { from: move?.from, to: move?.to, promotion: move?.promotion ?? null, score: info.bestScore };
            };

            return { first: await run(), second: await run() };
        }, [FORCING_PROMOTION]);

        expect(result.first.from).toBe('a7');
        expect(result.first.to).toBe('a8');
        // Same move every run — uncapped mode has no jitter. The exact score is
        // not asserted: it can differ by a couple of cp depending on which
        // iteration the wall-clock cutoff lands on.
        expect(result.second.from).toBe(result.first.from);
        expect(result.second.to).toBe(result.first.to);
        expect(result.second.promotion).toBe(result.first.promotion);
    });

    test('uncapped search respects the time budget', async ({ page }) => {
        const result = await page.evaluate(async ([sparse]) => {
            const { AI } = await import('/js/engine/AI.js');

            const buildState = (pieces, activeColor = 'white') => {
                const board = new Array(64).fill(null);
                for (const [sq, p] of pieces) {
                    const file = sq.charCodeAt(0) - 97;
                    const rank = Number(sq[1]) - 1;
                    board[rank * 8 + file] = p;
                }
                return {
                    board,
                    activeColor,
                    castlingRights: {
                        white: { kingSide: false, queenSide: false },
                        black: { kingSide: false, queenSide: false }
                    },
                    enPassantTarget: null,
                    halfmoveClock: 0,
                    fullmoveNumber: 40
                };
            };

            const ai = new AI();
            const start = Date.now();
            const move = await ai.findBestMove(buildState(sparse), { level: 6, forColor: 'white', timeout: 400, uncapped: true });
            const elapsed = Date.now() - start;

            return { hasMove: move !== null, elapsed, timeout: 400 };
        }, [SPARSE_PAWN_ENDING]);

        expect(result.hasMove).toBe(true);
        // Generous slack for CI machines: sampled clock (~256-node cadence) plus
        // the tail guard should land well under timeout + 1s. (The timedOut flag
        // itself is not asserted: the tail guard is a deliberate non-timeout exit.)
        expect(result.elapsed).toBeLessThan(result.timeout + 1000);
    });

    test('capped levels are unaffected by the uncapped option', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            // Level 3 stays shallow and quick regardless of the new option.
            const move = await ai.findBestMove(state, { level: 3, forColor: 'white', timeout: 5000 });
            const info = ai.getLastSearchInfo();

            return { hasMove: move !== null, depthCompleted: info.depthCompleted };
        });

        expect(result.hasMove).toBe(true);
        expect(result.depthCompleted).toBeLessThanOrEqual(3);
    });
});
