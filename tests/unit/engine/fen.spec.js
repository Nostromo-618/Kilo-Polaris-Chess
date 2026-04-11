// @ts-check
import { test, expect } from '@playwright/test';

/**
 * FEN Module Tests
 * Tests for gameStateToFen — converting internal board state to FEN strings.
 */

test.describe('FEN - gameStateToFen', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
    });

    test('should produce standard starting FEN', async ({ page }) => {
        const fen = await page.evaluate(async () => {
            const { gameStateToFen } = await import('/js/engine/fen.js');
            const { GameState } = await import('/js/engine/GameState.js');
            const state = GameState.createStarting('white');
            return gameStateToFen(state.asRulesState());
        });

        expect(fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    });

    test('should reflect side to move after one ply', async ({ page }) => {
        const fen = await page.evaluate(async () => {
            const { gameStateToFen } = await import('/js/engine/fen.js');
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');
            const moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'e2' && m.to === 'e4'));
            return gameStateToFen(state.asRulesState());
        });

        expect(fen).toContain(' b ');
        expect(fen).toMatch(/^rnbqkbnr\/pppppppp\/8\/8\/4P3\/8\/PPPP1PPP\/RNBQKBNR b /);
    });

    test('should include en passant target after double pawn push', async ({ page }) => {
        const fen = await page.evaluate(async () => {
            const { gameStateToFen } = await import('/js/engine/fen.js');
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');
            const moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'e2' && m.to === 'e4'));
            return gameStateToFen(state.asRulesState());
        });

        expect(fen).toContain(' e3 ');
    });

    test('should show dash for en passant when no target', async ({ page }) => {
        const fen = await page.evaluate(async () => {
            const { gameStateToFen } = await import('/js/engine/fen.js');
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');
            const moves = generateLegalMoves(state.asRulesState());
            // Single pawn push — no en passant
            state.applyMove(moves.find(m => m.from === 'e2' && m.to === 'e3'));
            return gameStateToFen(state.asRulesState());
        });

        expect(fen).toMatch(/ - \d+ \d+$/);
    });

    test('should update castling rights when king moves', async ({ page }) => {
        const fen = await page.evaluate(async () => {
            const { gameStateToFen } = await import('/js/engine/fen.js');
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');
            let moves;

            // 1. e4
            moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'e2' && m.to === 'e4'));
            // 1... e5
            moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'e7' && m.to === 'e5'));
            // 2. Ke2 (king moves — loses white castling)
            moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'e1' && m.to === 'e2'));

            return gameStateToFen(state.asRulesState());
        });

        // White castling gone, black still has both
        expect(fen).toMatch(/ kq /);
    });

    test('should encode empty board as 8/8/8/8/8/8/8/8', async ({ page }) => {
        const fen = await page.evaluate(async () => {
            const { gameStateToFen } = await import('/js/engine/fen.js');
            return gameStateToFen({
                board: new Array(64).fill(null),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false },
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 1,
            });
        });

        expect(fen).toBe('8/8/8/8/8/8/8/8 w - - 0 1');
    });

    test('should handle board passed as object (non-array)', async ({ page }) => {
        const fen = await page.evaluate(async () => {
            const { gameStateToFen } = await import('/js/engine/fen.js');
            const board = {};
            for (let i = 0; i < 64; i++) board[i] = null;
            board[4] = 'wK';  // e1
            board[60] = 'bK'; // e8
            return gameStateToFen({
                board,
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false },
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 1,
            });
        });

        expect(fen).toBe('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    });
});
