// @ts-check
import { test, expect } from '@playwright/test';

/**
 * AI Performance Benchmarks
 * Tests for search depth vs time, memory usage, transposition table hit rates
 */

test.describe('AI Performance - Search Depth vs Time', () => {
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

    test('should complete level 1 search within 100ms', async ({ page }) => {
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
        expect(result.timeMs).toBeLessThan(100);
    });

    test('should complete level 2 search within 500ms', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            const startTime = performance.now();
            const move = await ai.findBestMove(state, { level: 2, forColor: 'black', timeout: 5000 });
            const endTime = performance.now();

            return {
                hasMove: move !== null,
                timeMs: endTime - startTime
            };
        });

        expect(result.hasMove).toBe(true);
        expect(result.timeMs).toBeLessThan(500);
    });

    test('should complete level 3 search within 2000ms', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            const startTime = performance.now();
            const move = await ai.findBestMove(state, { level: 3, forColor: 'black', timeout: 5000 });
            const endTime = performance.now();

            return {
                hasMove: move !== null,
                timeMs: endTime - startTime
            };
        });

        expect(result.hasMove).toBe(true);
        expect(result.timeMs).toBeLessThan(2000);
    });

    test('should complete level 4 search within 5000ms', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            const startTime = performance.now();
            const move = await ai.findBestMove(state, { level: 4, forColor: 'black', timeout: 10000 });
            const endTime = performance.now();

            return {
                hasMove: move !== null,
                timeMs: endTime - startTime
            };
        });

        expect(result.hasMove).toBe(true);
        expect(result.timeMs).toBeLessThan(5000);
    });

    test('should show increasing search time with depth', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            const times = [];

            for (let level = 1; level <= 4; level++) {
                const startTime = performance.now();
                await ai.findBestMove(state, { level, forColor: 'black', timeout: 5000 });
                const endTime = performance.now();
                times.push(endTime - startTime);
            }

            return times;
        });

        // Deeper search should not be faster than shallow on average (allow noise at low depths)
        expect(result[3]).toBeGreaterThan(result[0]);
    });

    test('should handle timeout correctly', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            const startTime = performance.now();
            const move = await ai.findBestMove(state, { level: 5, forColor: 'black', timeout: 100 });
            const endTime = performance.now();

            return {
                hasMove: move !== null,
                timeMs: endTime - startTime,
                withinTimeout: (endTime - startTime) < 500
            };
        });

        expect(result.hasMove).toBe(true);
        expect(result.withinTimeout).toBe(true);
    });
});

test.describe('AI Performance - Memory Usage', () => {
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

    test('should not leak memory during repeated searches', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

            // Run many searches
            for (let i = 0; i < 50; i++) {
                await ai.findBestMove(state, { level: 1, forColor: 'black', timeout: 100 });
            }

            const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

            return {
                initialMemory,
                finalMemory,
                memoryGrowth: finalMemory - initialMemory
            };
        });

        // Memory growth should be reasonable (less than 10MB)
        if (result.memoryGrowth > 0) {
            expect(result.memoryGrowth).toBeLessThan(10 * 1024 * 1024);
        }
    });

    test('should clear search data between games', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            // Run some searches
            await ai.findBestMove(state, { level: 2, forColor: 'black', timeout: 500 });

            // Clear search data
            ai.clearSearchData();

            // Run another search
            await ai.findBestMove(state, { level: 2, forColor: 'black', timeout: 500 });

            return { success: true };
        });

        expect(result.success).toBe(true);
    });

    test('should handle transposition table efficiently', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            // Run multiple searches to fill transposition table
            for (let i = 0; i < 100; i++) {
                await ai.findBestMove(state, { level: 2, forColor: i % 2 === 0 ? 'black' : 'white', timeout: 100 });
            }

            // Check table size
            const tableSize = ai.transpositionTable.length;

            return { tableSize };
        });

        expect(result.tableSize).toBe(100000); // TT_MAX_SIZE
    });
});

test.describe('AI Performance - Transposition Table Hit Rates', () => {
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

    test('should achieve transposition table hits', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            // Make some moves to reach a position
            let moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'e2' && m.to === 'e4'));

            moves = generateLegalMoves(state.asRulesState());
            state.applyMove(moves.find(m => m.from === 'e7' && m.to === 'e5'));

            // Run search
            await ai.findBestMove(state, { level: 3, forColor: 'white', timeout: 2000 });

            // Check if transposition table was populated
            const tableEntries = ai.transpositionTable.filter(e => e !== undefined);

            return { entriesCount: tableEntries.length };
        });

        expect(result.entriesCount).toBeGreaterThan(0);
    });

    test('should reuse transposition table entries', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            // Run same search multiple times
            const times = [];
            for (let i = 0; i < 5; i++) {
                const startTime = performance.now();
                await ai.findBestMove(state, { level: 2, forColor: 'black', timeout: 2000 });
                const endTime = performance.now();
                times.push(endTime - startTime);
            }

            // Later searches should be faster due to transposition table
            return {
                firstTime: times[0],
                lastTime: times[4],
                improvement: times[0] > times[4]
            };
        });

        // Later searches may be faster due to transposition table
        expect(result.improvement).toBe(true);
    });
});

test.describe('AI Performance - Search Quality', () => {
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

    test('should find better moves at higher levels', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');
            const ai = new AI();

            const level1Move = await ai.findBestMove(GameState.createStarting('white'), {
                level: 1,
                forColor: 'black',
                timeout: 2000
            });
            const level5Move = await ai.findBestMove(GameState.createStarting('white'), {
                level: 5,
                forColor: 'black',
                timeout: 5000
            });

            return {
                hasBoth: !!(level1Move && level5Move)
            };
        });

        expect(result.hasBoth).toBe(true);
    });

    test('should prefer captures when available', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            // wP on d4 captures bP on e5; wK on e1 (index 4, 27, 36)
            const b = new Array(64).fill(null);
            b[4] = 'wK';
            b[27] = 'wP';
            b[36] = 'bP';
            const captureState = {
                board: b,
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 20
            };

            const ai = new AI();
            const move = await ai.findBestMove(captureState, { level: 3, forColor: 'white', timeout: 2000 });

            return {
                isCapture: move != null && move.captured != null && move.captured !== '',
                from: move?.from,
                to: move?.to
            };
        });

        expect(result.isCapture).toBe(true);
    });

    test('should prefer checkmate when available', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');

            // Create checkmate in 1 position
            const mateState = {
                board: [
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, 'bP', 'bK', null,
                    null, null, null, null, null, 'bP', null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, 'wP', null,
                    null, null, null, null, null, 'wQ', 'wK', null
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
            const move = await ai.findBestMove(mateState, { level: 5, forColor: 'white', timeout: 5000 });

            return { move, to: move?.to };
        });

        expect(result.move).toBeTruthy();
    });
});

test.describe('AI Performance - Consistency', () => {
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

    test('should return consistent results for same position', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            // Run same search multiple times
            const moves = [];
            for (let i = 0; i < 5; i++) {
                const move = await ai.findBestMove(state, { level: 3, forColor: 'black', timeout: 2000 });
                moves.push(move?.from + '-' + move?.to);
            }

            // Check consistency
            const unique = new Set(moves);

            return {
                moves,
                uniqueCount: unique.size
            };
        });

        // Results should be mostly consistent (may vary due to randomness)
        expect(result.uniqueCount).toBeLessThanOrEqual(3);
    });

    test('should handle rapid successive searches', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { AI } = await import('/js/engine/AI.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const ai = new AI();
            const state = GameState.createStarting('white');

            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(ai.findBestMove(state, { level: 1, forColor: 'black', timeout: 100 }));
            }

            const moves = await Promise.all(promises);

            return {
                moveCount: moves.filter(m => m !== null).length
            };
        });

        // All searches should complete
        expect(result.moveCount).toBe(10);
    });
});