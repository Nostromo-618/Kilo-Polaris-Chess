// @ts-check
import { test, expect } from '@playwright/test';

/**
 * UCI Match Module Tests
 * Tests for matchUciToLegalMove and parseBestMoveLine.
 */

test.describe('UCI - matchUciToLegalMove', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
    });

    test('should match a simple pawn move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { matchUciToLegalMove } = await import('/js/engine/uciMatch.js');
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');
            const moves = generateLegalMoves(state.asRulesState());
            const matched = matchUciToLegalMove('e2e4', moves);
            return matched ? { from: matched.from, to: matched.to } : null;
        });

        expect(result).toEqual({ from: 'e2', to: 'e4' });
    });

    test('should match a knight move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { matchUciToLegalMove } = await import('/js/engine/uciMatch.js');
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');
            const moves = generateLegalMoves(state.asRulesState());
            const matched = matchUciToLegalMove('g1f3', moves);
            return matched ? { from: matched.from, to: matched.to } : null;
        });

        expect(result).toEqual({ from: 'g1', to: 'f3' });
    });

    test('should return null for (null) sentinel', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { matchUciToLegalMove } = await import('/js/engine/uciMatch.js');
            return matchUciToLegalMove('(null)', []);
        });

        expect(result).toBeNull();
    });

    test('should return null for 0000 sentinel', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { matchUciToLegalMove } = await import('/js/engine/uciMatch.js');
            return matchUciToLegalMove('0000', []);
        });

        expect(result).toBeNull();
    });

    test('should return null for "null" string', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { matchUciToLegalMove } = await import('/js/engine/uciMatch.js');
            return matchUciToLegalMove('null', []);
        });

        expect(result).toBeNull();
    });

    test('should return null for invalid UCI format', async ({ page }) => {
        const results = await page.evaluate(async () => {
            const { matchUciToLegalMove } = await import('/js/engine/uciMatch.js');
            return [
                matchUciToLegalMove('xyz', []),
                matchUciToLegalMove('', []),
                matchUciToLegalMove('e2', []),
                matchUciToLegalMove('e2e4e6', []),
            ];
        });

        for (const r of results) {
            expect(r).toBeNull();
        }
    });

    test('should return null when no matching legal move exists', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { matchUciToLegalMove } = await import('/js/engine/uciMatch.js');
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');
            const moves = generateLegalMoves(state.asRulesState());
            return matchUciToLegalMove('e2e5', moves);
        });

        expect(result).toBeNull();
    });

    test('should handle promotion suffix', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { matchUciToLegalMove } = await import('/js/engine/uciMatch.js');
            const fakeMoves = [
                { from: 'e7', to: 'e8', promotion: 'Q' },
                { from: 'e7', to: 'e8', promotion: 'R' },
                { from: 'e7', to: 'e8', promotion: 'B' },
                { from: 'e7', to: 'e8', promotion: 'N' },
            ];
            const matched = matchUciToLegalMove('e7e8r', fakeMoves);
            return matched ? matched.promotion : null;
        });

        expect(result).toBe('R');
    });

    test('should prefer non-promotion when no suffix given and multiple candidates', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { matchUciToLegalMove } = await import('/js/engine/uciMatch.js');
            const fakeMoves = [
                { from: 'e7', to: 'e8', promotion: 'Q' },
                { from: 'e7', to: 'e8', promotion: undefined },
            ];
            const matched = matchUciToLegalMove('e7e8', fakeMoves);
            return matched ? matched.promotion : 'NONE';
        });

        expect(result).toBeUndefined();
    });

    test('should trim and lowercase input', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { matchUciToLegalMove } = await import('/js/engine/uciMatch.js');
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');
            const moves = generateLegalMoves(state.asRulesState());
            const matched = matchUciToLegalMove('  E2E4  ', moves);
            return matched ? { from: matched.from, to: matched.to } : null;
        });

        expect(result).toEqual({ from: 'e2', to: 'e4' });
    });
});

test.describe('UCI - parseBestMoveLine', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
    });

    test('should parse a normal bestmove line', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { parseBestMoveLine } = await import('/js/engine/uciMatch.js');
            return parseBestMoveLine('bestmove e2e4');
        });

        expect(result).toBe('e2e4');
    });

    test('should parse bestmove with ponder', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { parseBestMoveLine } = await import('/js/engine/uciMatch.js');
            return parseBestMoveLine('bestmove e2e4 ponder e7e5');
        });

        expect(result).toBe('e2e4');
    });

    test('should return null for bestmove (null)', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { parseBestMoveLine } = await import('/js/engine/uciMatch.js');
            return parseBestMoveLine('bestmove (null)');
        });

        expect(result).toBeNull();
    });

    test('should return null for bestmove NULL', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { parseBestMoveLine } = await import('/js/engine/uciMatch.js');
            return parseBestMoveLine('bestmove NULL');
        });

        expect(result).toBeNull();
    });

    test('should return undefined for non-bestmove lines', async ({ page }) => {
        const results = await page.evaluate(async () => {
            const { parseBestMoveLine } = await import('/js/engine/uciMatch.js');
            return [
                parseBestMoveLine('info depth 10 score cp 30'),
                parseBestMoveLine('uciok'),
                parseBestMoveLine('readyok'),
                parseBestMoveLine(''),
            ];
        });

        for (const r of results) {
            expect(r).toBeUndefined();
        }
    });

    test('should handle leading/trailing whitespace', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { parseBestMoveLine } = await import('/js/engine/uciMatch.js');
            return parseBestMoveLine('  bestmove g1f3  ');
        });

        expect(result).toBe('g1f3');
    });
});
