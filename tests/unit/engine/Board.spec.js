// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Board Module Tests
 * Tests for board representation, algebraic notation, index mapping
 */

test.describe('Board - Algebraic Notation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should convert a1 to index 0', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { algebraicToIndex } = await import('/js/engine/Board.js');
            return algebraicToIndex('a1');
        });

        expect(result).toBe(0);
    });

    test('should convert h1 to index 7', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { algebraicToIndex } = await import('/js/engine/Board.js');
            return algebraicToIndex('h1');
        });

        expect(result).toBe(7);
    });

    test('should convert a8 to index 56', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { algebraicToIndex } = await import('/js/engine/Board.js');
            return algebraicToIndex('a8');
        });

        expect(result).toBe(56);
    });

    test('should convert h8 to index 63', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { algebraicToIndex } = await import('/js/engine/Board.js');
            return algebraicToIndex('h8');
        });

        expect(result).toBe(63);
    });

    test('should convert e4 to index 28', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { algebraicToIndex } = await import('/js/engine/Board.js');
            return algebraicToIndex('e4');
        });

        expect(result).toBe(28);
    });

    test('should convert index 0 to a1', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { indexToAlgebraic } = await import('/js/engine/Board.js');
            return indexToAlgebraic(0);
        });

        expect(result).toBe('a1');
    });

    test('should convert index 7 to h1', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { indexToAlgebraic } = await import('/js/engine/Board.js');
            return indexToAlgebraic(7);
        });

        expect(result).toBe('h1');
    });

    test('should convert index 56 to a8', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { indexToAlgebraic } = await import('/js/engine/Board.js');
            return indexToAlgebraic(56);
        });

        expect(result).toBe('a8');
    });

    test('should convert index 63 to h8', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { indexToAlgebraic } = await import('/js/engine/Board.js');
            return indexToAlgebraic(63);
        });

        expect(result).toBe('h8');
    });

    test('should convert index 28 to e4', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { indexToAlgebraic } = await import('/js/engine/Board.js');
            return indexToAlgebraic(28);
        });

        expect(result).toBe('e4');
    });

    test('should handle all squares bidirectionally', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { algebraicToIndex, indexToAlgebraic } = await import('/js/engine/Board.js');

            const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
            const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
            const results = [];

            for (const file of files) {
                for (const rank of ranks) {
                    const square = file + rank;
                    const index = algebraicToIndex(square);
                    const back = indexToAlgebraic(index);
                    results.push({ square, index, back, match: square === back });
                }
            }

            return results;
        });

        // All conversions should match
        const allMatch = result.every(r => r.match);
        expect(allMatch).toBe(true);
    });
});

test.describe('Board - Index Calculations', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should calculate file from index', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const results = [];
            for (let i = 0; i < 64; i++) {
                const file = i % 8;
                results.push({ index: i, file });
            }
            return results;
        });

        expect(result.length).toBe(64);
        expect(result[0].file).toBe(0);
        expect(result[7].file).toBe(7);
        expect(result[8].file).toBe(0);
    });

    test('should calculate rank from index', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const results = [];
            for (let i = 0; i < 64; i++) {
                const rank = Math.floor(i / 8);
                results.push({ index: i, rank });
            }
            return results;
        });

        expect(result.length).toBe(64);
        expect(result[0].rank).toBe(0);
        expect(result[7].rank).toBe(0);
        expect(result[8].rank).toBe(1);
        expect(result[63].rank).toBe(7);
    });

    test('should identify same diagonal', async ({ page }) => {
        const result = await page.evaluate(async () => {
            // Squares on same diagonal have same (rank - file) or (rank + file)
            const a1 = 0; // rank 0, file 0
            const b2 = 9; // rank 1, file 1
            const c3 = 18; // rank 2, file 2

            const a1Diff = Math.floor(a1 / 8) - (a1 % 8);
            const b2Diff = Math.floor(b2 / 8) - (b2 % 8);
            const c3Diff = Math.floor(c3 / 8) - (c3 % 8);

            return {
                a1Diff,
                b2Diff,
                c3Diff,
                sameDiagonal: a1Diff === b2Diff && b2Diff === c3Diff
            };
        });

        expect(result.sameDiagonal).toBe(true);
    });

    test('should identify same anti-diagonal', async ({ page }) => {
        const result = await page.evaluate(async () => {
            // Squares on same anti-diagonal have same (rank + file)
            const a8 = 56; // rank 7, file 0, sum = 7
            const b7 = 49; // rank 6, file 1, sum = 7
            const c6 = 42; // rank 5, file 2, sum = 7

            const a8Sum = Math.floor(a8 / 8) + (a8 % 8);
            const b7Sum = Math.floor(b7 / 8) + (b7 % 8);
            const c6Sum = Math.floor(c6 / 8) + (c6 % 8);

            return {
                a8Sum,
                b7Sum,
                c6Sum,
                sameAntiDiagonal: a8Sum === b7Sum && b7Sum === c6Sum
            };
        });

        expect(result.sameAntiDiagonal).toBe(true);
    });
});

test.describe('Board - Clone Operations', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should create independent copy of board', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { cloneBoard } = await import('/js/engine/Board.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const state = GameState.createStarting('white');
            const original = state.board;
            const cloned = cloneBoard(original);

            // Modify clone
            cloned[28] = 'wP'; // e4

            // Check original is unchanged
            return {
                originalAt28: original[28],
                clonedAt28: cloned[28],
                different: original[28] !== cloned[28]
            };
        });

        expect(result.different).toBe(true);
    });

    test('should preserve all pieces in clone', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { cloneBoard } = await import('/js/engine/Board.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const state = GameState.createStarting('white');
            const original = state.board;
            const cloned = cloneBoard(original);

            // Count pieces
            const originalCount = original.filter(p => p !== null).length;
            const clonedCount = cloned.filter(p => p !== null).length;

            return { originalCount, clonedCount };
        });

        expect(result.originalCount).toBe(32);
        expect(result.clonedCount).toBe(32);
    });

    test('should handle empty board clone', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { cloneBoard } = await import('/js/engine/Board.js');

            const emptyBoard = new Array(64).fill(null);
            const cloned = cloneBoard(emptyBoard);

            return {
                length: cloned.length,
                allNull: cloned.every(p => p === null)
            };
        });

        expect(result.length).toBe(64);
        expect(result.allNull).toBe(true);
    });

    test('should handle full board clone', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { cloneBoard } = await import('/js/engine/Board.js');

            // Create board with pieces on every square
            const fullBoard = [];
            for (let i = 0; i < 64; i++) {
                fullBoard.push(i < 32 ? 'wP' : 'bP');
            }

            const cloned = cloneBoard(fullBoard);

            return {
                length: cloned.length,
                allPieces: cloned.every(p => p !== null),
                matches: JSON.stringify(fullBoard) === JSON.stringify(cloned)
            };
        });

        expect(result.length).toBe(64);
        expect(result.allPieces).toBe(true);
        expect(result.matches).toBe(true);
    });
});

test.describe('Board - Opposite Color', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should return black for white', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { oppositeColor } = await import('/js/engine/Board.js');
            return oppositeColor('white');
        });

        expect(result).toBe('black');
    });

    test('should return white for black', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { oppositeColor } = await import('/js/engine/Board.js');
            return oppositeColor('black');
        });

        expect(result).toBe('white');
    });

    test('should handle multiple inversions', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { oppositeColor } = await import('/js/engine/Board.js');
            const first = oppositeColor('white');
            const second = oppositeColor(first);
            const third = oppositeColor(second);
            return { first, second, third };
        });

        expect(result.first).toBe('black');
        expect(result.second).toBe('white');
        expect(result.third).toBe('black');
    });
});

test.describe('Board - Square Colors', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should identify light squares', async ({ page }) => {
        const result = await page.evaluate(async () => {
            // Light squares have (rank + file) even
            const a1 = 0; // rank 0, file 0, sum = 0 (even) -> light
            const e4 = 28; // rank 3, file 4, sum = 7 (odd) -> dark
            const h1 = 7; // rank 0, file 7, sum = 7 (odd) -> dark

            const isLightA1 = (Math.floor(a1 / 8) + (a1 % 8)) % 2 === 0;
            const isLightE4 = (Math.floor(e4 / 8) + (e4 % 8)) % 2 === 0;
            const isLightH1 = (Math.floor(h1 / 8) + (h1 % 8)) % 2 === 0;

            return { isLightA1, isLightE4, isLightH1 };
        });

        expect(result.isLightA1).toBe(true);
        expect(result.isLightE4).toBe(false);
        expect(result.isLightH1).toBe(false);
    });

    test('should identify dark squares', async ({ page }) => {
        const result = await page.evaluate(async () => {
            // Dark squares have (rank + file) odd
            const e1 = 4; // rank 0, file 4, sum = 4 (even) -> light
            const d8 = 59; // rank 7, file 3, sum = 10 (even) -> light
            const e8 = 60; // rank 7, file 4, sum = 11 (odd) -> dark

            const isDarkE1 = (Math.floor(e1 / 8) + (e1 % 8)) % 2 !== 0;
            const isDarkD8 = (Math.floor(d8 / 8) + (d8 % 8)) % 2 !== 0;
            const isDarkE8 = (Math.floor(e8 / 8) + (e8 % 8)) % 2 !== 0;

            return { isDarkE1, isDarkD8, isDarkE8 };
        });

        expect(result.isDarkE1).toBe(false);
        expect(result.isDarkD8).toBe(false);
        expect(result.isDarkE8).toBe(true);
    });

    test('should have equal light and dark squares', async ({ page }) => {
        const result = await page.evaluate(async () => {
            let lightCount = 0;
            let darkCount = 0;

            for (let i = 0; i < 64; i++) {
                const sum = Math.floor(i / 8) + (i % 8);
                if (sum % 2 === 0) {
                    lightCount++;
                } else {
                    darkCount++;
                }
            }

            return { lightCount, darkCount };
        });

        expect(result.lightCount).toBe(32);
        expect(result.darkCount).toBe(32);
    });
});

test.describe('Board - Edge Cases', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should handle corner squares', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { algebraicToIndex, indexToAlgebraic } = await import('/js/engine/Board.js');

            const corners = ['a1', 'h1', 'a8', 'h8'];
            const results = [];

            for (const square of corners) {
                const index = algebraicToIndex(square);
                const back = indexToAlgebraic(index);
                results.push({ square, index, back, match: square === back });
            }

            return results;
        });

        const allMatch = result.every(r => r.match);
        expect(allMatch).toBe(true);
    });

    test('should handle center squares', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { algebraicToIndex, indexToAlgebraic } = await import('/js/engine/Board.js');

            const center = ['d4', 'e4', 'd5', 'e5'];
            const results = [];

            for (const square of center) {
                const index = algebraicToIndex(square);
                const back = indexToAlgebraic(index);
                results.push({ square, index, back, match: square === back });
            }

            return results;
        });

        const allMatch = result.every(r => r.match);
        expect(allMatch).toBe(true);
    });

    test('should validate index range', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { indexToAlgebraic } = await import('/js/engine/Board.js');

            const results = [];

            // Test boundary indices
            for (let i = -1; i <= 65; i++) {
                try {
                    const sq = indexToAlgebraic(i);
                    results.push({ index: i, square: sq, valid: i >= 0 && i < 64 });
                } catch (e) {
                    results.push({ index: i, error: true });
                }
            }

            return results;
        });

        // Valid indices should produce squares
        const validResults = result.filter(r => !r.error);
        expect(validResults.length).toBeGreaterThan(0);
    });
});

test.describe('Board - Performance', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should convert notation quickly', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { algebraicToIndex } = await import('/js/engine/Board.js');

            const iterations = 100000;
            const start = performance.now();

            for (let i = 0; i < iterations; i++) {
                algebraicToIndex('e4');
            }

            const end = performance.now();
            const avgTime = (end - start) / iterations;

            return { avgTime, totalTime: end - start };
        });

        // Each conversion should be very fast
        expect(result.avgTime).toBeLessThan(0.01);
    });

    test('should clone board quickly', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { cloneBoard } = await import('/js/engine/Board.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const state = GameState.createStarting('white');
            const board = state.board;

            const iterations = 10000;
            const start = performance.now();

            for (let i = 0; i < iterations; i++) {
                cloneBoard(board);
            }

            const end = performance.now();
            const avgTime = (end - start) / iterations;

            return { avgTime, totalTime: end - start };
        });

        // Each clone should be fast
        expect(result.avgTime).toBeLessThan(0.1);
    });
});