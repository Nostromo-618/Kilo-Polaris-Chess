// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Engine Logic Tests - GameState Module
 * Tests the chess game state management directly via page.evaluate()
 */

test.describe('Engine Logic - GameState', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
    });

    test('should create starting position correctly', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');

            const state = GameState.createStarting('white');
            const snapshot = state.getSnapshot();

            return {
                activeColor: snapshot.activeColor,
                isGameOver: snapshot.gameOver,
                pieceCount: Object.values(snapshot.board).filter(p => p !== null).length
            };
        });

        expect(result.activeColor).toBe('white');
        expect(result.isGameOver).toBe(false);
        expect(result.pieceCount).toBe(32);
    });

    test('should track active color correctly', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');

            // Get e2-e4 move
            const moves = generateLegalMoves(state.asRulesState());
            const e4Move = moves.find(m => m.from === 'e2' && m.to === 'e4');

            state.applyMove(e4Move);

            return state.activeColor;
        });

        expect(result).toBe('black');
    });

    test('should update halfmove clock on non-pawn non-capture', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');

            // Knight move (non-pawn, non-capture)
            const moves = generateLegalMoves(state.asRulesState());
            const knightMove = moves.find(m => m.from === 'g1' && m.to === 'f3');

            const clockBefore = state.halfmoveClock;
            state.applyMove(knightMove);
            const clockAfter = state.halfmoveClock;

            return { before: clockBefore, after: clockAfter };
        });

        expect(result.before).toBe(0);
        expect(result.after).toBe(1);
    });

    test('should reset halfmove clock on pawn move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');

            // First, knight move (increases clock)
            let moves = generateLegalMoves(state.asRulesState());
            const knightMove = moves.find(m => m.from === 'g1' && m.to === 'f3');
            state.applyMove(knightMove);

            // Black knight move
            moves = generateLegalMoves(state.asRulesState());
            const blackKnight = moves.find(m => m.from === 'b8' && m.to === 'c6');
            state.applyMove(blackKnight);

            const clockBeforePawn = state.halfmoveClock;

            // Now pawn move (should reset clock)
            moves = generateLegalMoves(state.asRulesState());
            const pawnMove = moves.find(m => m.from === 'e2' && m.to === 'e4');
            state.applyMove(pawnMove);

            const clockAfterPawn = state.halfmoveClock;

            return { before: clockBeforePawn, after: clockAfterPawn };
        });

        expect(result.before).toBe(2);
        expect(result.after).toBe(0);
    });

    test('should track castling rights', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');

            const state = GameState.createStarting('white');

            return {
                whiteKingSide: state.castlingRights.white.kingSide,
                whiteQueenSide: state.castlingRights.white.queenSide,
                blackKingSide: state.castlingRights.black.kingSide,
                blackQueenSide: state.castlingRights.black.queenSide
            };
        });

        expect(result.whiteKingSide).toBe(true);
        expect(result.whiteQueenSide).toBe(true);
        expect(result.blackKingSide).toBe(true);
        expect(result.blackQueenSide).toBe(true);
    });

    test('should lose castling rights when king moves', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');

            // Make room for king move: e2-e4
            let moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'e2' && m.to === 'e4'));

            // Black move
            moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'e7' && m.to === 'e5'));

            // King move: e1-e2
            moves = generateLegalMoves(state.asRulesState());
            const kingMove = moves.find(m => m.from === 'e1' && m.to === 'e2');
            state.applyMove(kingMove);

            return {
                whiteKingSide: state.castlingRights.white.kingSide,
                whiteQueenSide: state.castlingRights.white.queenSide
            };
        });

        expect(result.whiteKingSide).toBe(false);
        expect(result.whiteQueenSide).toBe(false);
    });

    test('should serialize and deserialize state correctly', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');

            // Make a move
            const moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'e2' && m.to === 'e4'));

            // Serialize
            const serialized = state.serialize();

            // Deserialize
            const restored = new GameState(serialized);

            return {
                originalColor: state.activeColor,
                restoredColor: restored.activeColor,
                originalE4: state.board[state.board.indexOf('wP')],
                boardsMatch: JSON.stringify(state.board) === JSON.stringify(restored.board)
            };
        });

        expect(result.originalColor).toBe(result.restoredColor);
        expect(result.boardsMatch).toBe(true);
    });
});
