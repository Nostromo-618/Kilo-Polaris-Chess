// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Engine Logic Tests - Rules Module
 * Tests the chess engine logic directly via page.evaluate()
 * No UI interaction - purely testing the Rules.js module
 */

test.describe('Engine Logic - Rules', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        // Start game to ensure modules are loaded
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
    });

    test('should generate legal pawn moves from starting position', async ({ page }) => {
        const result = await page.evaluate(async () => {
            // Import modules dynamically
            const { generateLegalMoves } = await import('/js/engine/Rules.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const state = GameState.createStarting('white');
            const moves = generateLegalMoves(state.asRulesState());

            // Filter moves from e2
            const e2Moves = moves.filter(m => m.from === 'e2');
            return e2Moves.map(m => m.to);
        });

        expect(result).toContain('e3');
        expect(result).toContain('e4');
        expect(result.length).toBe(2);
    });

    test('should generate correct knight moves', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { generateLegalMoves } = await import('/js/engine/Rules.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const state = GameState.createStarting('white');
            const moves = generateLegalMoves(state.asRulesState());

            // Filter moves from g1 knight
            const g1Moves = moves.filter(m => m.from === 'g1');
            return g1Moves.map(m => m.to).sort();
        });

        expect(result).toEqual(['f3', 'h3']);
    });

    test('should detect check correctly', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { isInCheck } = await import('/js/engine/Rules.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const state = GameState.createStarting('white');

            // Starting position - not in check
            return isInCheck(state.asRulesState());
        });

        expect(result).toBe(false);
    });

    test('should count 20 legal moves for white at start', async ({ page }) => {
        const count = await page.evaluate(async () => {
            const { generateLegalMoves } = await import('/js/engine/Rules.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const state = GameState.createStarting('white');
            const moves = generateLegalMoves(state.asRulesState());

            return moves.length;
        });

        // White has 20 possible moves at start (16 pawn + 4 knight)
        expect(count).toBe(20);
    });

    test('should identify when king is attacked', async ({ page }) => {
        // Test attack detection indirectly via isInCheck
        // We can verify that check detection works by setting up a position
        // where the king would be in check
        const result = await page.evaluate(async () => {
            const { isInCheck, generateLegalMoves } = await import('/js/engine/Rules.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const state = GameState.createStarting('white');

            // Starting position - king should not be in check
            const notInCheck = !isInCheck(state.asRulesState());

            // Make moves to put black king in check: 1.e4 f6 2.Qh5+ (check)
            let moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'e2' && m.to === 'e4'));

            moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'f7' && m.to === 'f6'));

            moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'd1' && m.to === 'h5'));

            // Now black king is in check from Qh5
            const inCheck = isInCheck(state.asRulesState());

            return { notInCheck, inCheck };
        });

        expect(result.notInCheck).toBe(true);
        expect(result.inCheck).toBe(true);
    });
});
