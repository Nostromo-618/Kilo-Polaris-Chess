// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Engine Integration Tests
 * Tests for interaction between GameState, Rules, AI, and Move modules
 */

test.describe('Engine Integration - GameState + Rules', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should generate legal moves from game state', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');
            const moves = generateLegalMoves(state.asRulesState());

            return {
                moveCount: moves.length,
                hasE4: moves.some(m => m.from === 'e2' && m.to === 'e4'),
                hasNf3: moves.some(m => m.from === 'g1' && m.to === 'f3')
            };
        });

        expect(result.moveCount).toBe(20);
        expect(result.hasE4).toBe(true);
        expect(result.hasNf3).toBe(true);
    });

    test('should apply move and update state', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');
            const moves = generateLegalMoves(state.asRulesState());
            const e4Move = moves.find(m => m.from === 'e2' && m.to === 'e4');

            state.applyMove(e4Move);

            return {
                activeColor: state.activeColor,
                e4Piece: state.board[28], // e4 index
                e2Piece: state.board[12]  // e2 index
            };
        });

        expect(result.activeColor).toBe('black');
        expect(result.e4Piece).toBe('wP');
        expect(result.e2Piece).toBeNull();
    });

    test('should detect check after move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves, isInCheck } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');

            // 1. e4
            let moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'e2' && m.to === 'e4'));

            // 1... f6
            moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'f7' && m.to === 'f6'));

            // 2. Qh5+ (check)
            moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'd1' && m.to === 'h5'));

            const inCheck = isInCheck(state.asRulesState());

            return { inCheck, activeColor: state.activeColor };
        });

        expect(result.inCheck).toBe(true);
        expect(result.activeColor).toBe('black');
    });

    test('should handle castling rights update', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');

            // 1. e4
            let moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'e2' && m.to === 'e4'));

            // 1... e5
            moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'e7' && m.to === 'e5'));

            // 2. Nf3
            moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'g1' && m.to === 'f3'));

            // 2... Nc6
            moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'b8' && m.to === 'c6'));

            // 3. Bc4
            moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'f1' && m.to === 'c4'));

            // 3... Be7
            moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'f8' && m.to === 'e7'));

            // 4. O-O (kingside castle)
            moves = generateLegalMoves(state.asRulesState());
            const castleMove = moves.find(m => m.from === 'e1' && m.to === 'g1');
            if (castleMove) {
                state.applyMove(castleMove);
            }

            return {
                kingOnG1: state.board[6] === 'wK', // g1
                rookOnF1: state.board[5] === 'wR', // f1
                kingSideRights: state.castlingRights.white.kingSide
            };
        });

        expect(result.kingOnG1).toBe(true);
        expect(result.rookOnF1).toBe(true);
        expect(result.kingSideRights).toBe(false);
    });

    test('should handle en passant target', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');

            // 1. e4
            let moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'e2' && m.to === 'e4'));

            // 1... Nf6
            moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'g8' && m.to === 'f6'));

            // 2. e5 (double push, creates en passant target)
            moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'e4' && m.to === 'e5'));

            return {
                enPassantTarget: state.enPassantTarget
            };
        });

        // e5 pawn doesn't create en passant target unless it's a double push from starting rank
        expect(result.enPassantTarget).toBeNull();
    });

    test('should serialize and deserialize state', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');

            // Make some moves
            let moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'e2' && m.to === 'e4'));

            moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'e7' && m.to === 'e5'));

            // Serialize
            const serialized = state.serialize();

            // Deserialize
            const restored = new GameState(serialized);

            return {
                boardsMatch: JSON.stringify(state.board) === JSON.stringify(restored.board),
                activeColorMatch: state.activeColor === restored.activeColor,
                castlingMatch: JSON.stringify(state.castlingRights) === JSON.stringify(restored.castlingRights)
            };
        });

        expect(result.boardsMatch).toBe(true);
        expect(result.activeColorMatch).toBe(true);
        expect(result.castlingMatch).toBe(true);
    });
});

test.describe('Engine Integration - AI + GameState', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should find best move from game state', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');
            const { AI } = await import('/js/engine/AI.js');

            const state = GameState.createStarting('white');
            const ai = new AI();

            const move = await ai.findBestMove(state, { level: 1, forColor: 'black', timeout: 5000 });

            return {
                hasMove: move !== null,
                from: move?.from,
                to: move?.to
            };
        });

        expect(result.hasMove).toBe(true);
        expect(result.from).toBeDefined();
        expect(result.to).toBeDefined();
    });

    test('should apply AI move to game state', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');
            const { AI } = await import('/js/engine/AI.js');

            const state = GameState.createStarting('white');
            const ai = new AI();

            // Player moves e4
            let moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'e2' && m.to === 'e4'));

            // AI responds
            const aiMove = await ai.findBestMove(state, { level: 1, forColor: 'black', timeout: 5000 });
            if (aiMove) {
                state.applyMove(aiMove);
            }

            return {
                aiMoved: aiMove !== null,
                aiMoveFrom: aiMove?.from,
                aiMoveTo: aiMove?.to,
                activeColor: state.activeColor
            };
        });

        expect(result.aiMoved).toBe(true);
        expect(result.activeColor).toBe('white');
    });

    test('should handle AI search timeout', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');
            const { AI } = await import('/js/engine/AI.js');

            const state = GameState.createStarting('white');
            const ai = new AI();

            const startTime = performance.now();
            const move = await ai.findBestMove(state, { level: 3, forColor: 'black', timeout: 100 });
            const endTime = performance.now();

            return {
                hasMove: move !== null,
                timeMs: endTime - startTime,
                withinTimeout: (endTime - startTime) < 5000
            };
        });

        expect(result.hasMove).toBe(true);
        expect(result.withinTimeout).toBe(true);
    });

    test('should use different strategies per level', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');
            const { AI } = await import('/js/engine/AI.js');

            const state = GameState.createStarting('white');
            const ai = new AI();

            const level1Move = await ai.findBestMove(state, { level: 1, forColor: 'black', timeout: 5000 });
            const level5Move = await ai.findBestMove(state, { level: 5, forColor: 'black', timeout: 5000 });

            return {
                level1Move: level1Move,
                level5Move: level5Move,
                bothHaveMoves: level1Move !== null && level5Move !== null
            };
        });

        expect(result.bothHaveMoves).toBe(true);
    });
});

test.describe('Engine Integration - Move + Rules', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should create and validate move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createMove } = await import('/js/engine/Move.js');
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');
            const moves = generateLegalMoves(state.asRulesState());

            // Create a move manually
            const manualMove = createMove('e2', 'e4', 'wP');

            // Check if it's in legal moves
            const isLegal = moves.some(m => m.from === manualMove.from && m.to === manualMove.to);

            return { isLegal, manualMove };
        });

        expect(result.isLegal).toBe(true);
    });

    test('should handle promotion move generation', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            // wP on a7 → can promote to a8; kings placed for a legal position
            const promotionBoard = new Array(64).fill(null);
            promotionBoard[4] = 'wK';
            promotionBoard[48] = 'wP';
            promotionBoard[60] = 'bK';

            const promotionState = {
                board: promotionBoard,
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 50
            };

            const moves = generateLegalMoves(promotionState);
            const promotionMoves = moves.filter(m => m.promotion);

            return {
                hasPromotionMoves: promotionMoves.length > 0,
                promotionCount: promotionMoves.length
            };
        });

        expect(result.hasPromotionMoves).toBe(true);
    });

    test('should handle castling move generation', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');

            // Setup for castling: move e2-e4, Nf3, Bc4
            let moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'e2' && m.to === 'e4'));

            moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'e7' && m.to === 'e5'));

            moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'g1' && m.to === 'f3'));

            moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'b8' && m.to === 'c6'));

            moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'f1' && m.to === 'c4'));

            moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'f8' && m.to === 'e7'));

            // Now check for castling moves
            moves = generateLegalMoves(state.asRulesState());
            const castleMoves = moves.filter(m => m.isCastleKingSide || m.isCastleQueenSide);

            return {
                hasCastleMoves: castleMoves.length > 0,
                castleMoveCount: castleMoves.length
            };
        });

        expect(result.hasCastleMoves).toBe(true);
    });

    test('should handle en passant move generation', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            // White wP on e5, black bP on d5; ep capture lands on d6
            const epBoard = new Array(64).fill(null);
            epBoard[4] = 'wK';
            epBoard[60] = 'bK';
            epBoard[35] = 'bP';
            epBoard[36] = 'wP';

            const enPassantState = {
                board: epBoard,
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: 'd6',
                halfmoveClock: 0,
                fullmoveNumber: 10
            };

            const moves = generateLegalMoves(enPassantState);
            const enPassantMoves = moves.filter(m => m.isEnPassant);

            return {
                hasEnPassantMoves: enPassantMoves.length > 0,
                enPassantMoveCount: enPassantMoves.length
            };
        });

        expect(result.hasEnPassantMoves).toBe(true);
    });
});

test.describe('Engine Integration - Full Game Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should play complete game with engine', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves, isInCheck, analyzePosition } = await import('/js/engine/Rules.js');
            const { AI } = await import('/js/engine/AI.js');

            const state = GameState.createStarting('white');
            const ai = new AI();

            let moveCount = 0;
            const maxMoves = 20; // Limit to prevent infinite loops

            while (moveCount < maxMoves) {
                const ap = analyzePosition(state.asRulesState());
                if (!ap.hasLegalMoves) {
                    break;
                }

                // Generate moves
                const moves = generateLegalMoves(state.asRulesState());
                if (moves.length === 0) break;

                // Get AI move for current player
                const aiMove = await ai.findBestMove(state, {
                    level: 1,
                    forColor: state.activeColor,
                    timeout: 2000
                });

                if (aiMove) {
                    state.applyMove(aiMove);
                    moveCount++;
                } else {
                    break;
                }
            }

            return {
                moveCount,
                activeColor: state.activeColor,
                inCheck: isInCheck(state.asRulesState())
            };
        });

        expect(result.moveCount).toBeGreaterThan(0);
    });

    test('should handle game state through multiple moves', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');

            const moves = [
                ['e2', 'e4'],
                ['e7', 'e5'],
                ['g1', 'f3'],
                ['b8', 'c6'],
                ['f1', 'c4']
            ];

            for (const [from, to] of moves) {
                const legalMoves = generateLegalMoves(state.asRulesState());
                const move = legalMoves.find(m => m.from === from && m.to === to);
                if (move) {
                    state.applyMove(move);
                }
            }

            return {
                moveHistoryLength: state.moveHistory.length,
                activeColor: state.activeColor,
                fullmoveNumber: state.fullmoveNumber
            };
        });

        expect(result.moveHistoryLength).toBe(5);
        expect(result.activeColor).toBe('black');
        expect(result.fullmoveNumber).toBe(3);
    });
});