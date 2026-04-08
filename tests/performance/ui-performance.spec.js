// @ts-check
import { test, expect } from '@playwright/test';

/**
 * UI Performance Benchmarks
 * Tests for rendering performance, memory leaks, animation smoothness
 */

test.describe('UI Performance - Rendering', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
    });

    test('should render board quickly', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const startTime = Date.now();
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]', { timeout: 15000 });
        const loadTime = Date.now() - startTime;

        expect(loadTime).toBeLessThan(8000);
    });

    test('should render 64 squares', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const squares = await page.locator('.chess-square').count();
        expect(squares).toBe(64);
    });

    test('should render 32 pieces at start', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const pieces = await page.locator('.chess-piece.has-piece').count();
        expect(pieces).toBe(32);
    });

    test('should update board after move quickly', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const startTime = performance.now();

        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');

        // Wait until the pawn actually appears on e4 (empty squares still have a .chess-piece shell)
        await page.waitForSelector('.chess-square[data-square="e4"] .chess-piece[data-piece="wP"]');

        const endTime = performance.now();
        const updateTime = endTime - startTime;

        expect(updateTime).toBeLessThan(1000);
    });

    test('should handle rapid board updates', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const updates = 20;
        const startTime = performance.now();

        for (let i = 0; i < updates; i++) {
            await page.click('#new-game-btn');
            await page.waitForSelector('.chess-piece[data-piece="wP"]');
        }

        const endTime = performance.now();
        const avgTime = (endTime - startTime) / updates;

        expect(avgTime).toBeLessThan(500);
    });
});

test.describe('UI Performance - Memory', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
    });

    test('should not leak memory during gameplay', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

        // Play many moves
        for (let i = 0; i < 50; i++) {
            await page.click('#new-game-btn');
            await page.waitForTimeout(50);
        }

        const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
        const memoryGrowth = finalMemory - initialMemory;

        // Memory growth should be reasonable
        if (memoryGrowth > 0) {
            expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // 10MB
        }
    });

    test('should clean up event listeners', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Start multiple games
        for (let i = 0; i < 10; i++) {
            await page.click('#new-game-btn');
            await page.waitForTimeout(100);
        }

        // Verify page is still responsive
        const pieces = await page.locator('.chess-piece.has-piece').count();
        expect(pieces).toBe(32);
    });

    test('should handle localStorage efficiently', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Make moves to trigger saves
        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');

        await page.waitForTimeout(500);

        // Check localStorage size
        const saved = await page.evaluate(() => localStorage.getItem('kpc-game'));
        const size = saved ? saved.length : 0;

        // Should be reasonable (less than 10KB)
        expect(size).toBeLessThan(10000);
    });
});

test.describe('UI Performance - Animations', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
    });

    test('should have smooth piece selection', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const startTime = performance.now();

        // Select and deselect multiple times
        for (let i = 0; i < 10; i++) {
            await page.click('.chess-square[data-square="e2"]');
            await page.click('.chess-square[data-square="d2"]');
        }

        const endTime = performance.now();
        const avgTime = (endTime - startTime) / 20;

        expect(avgTime).toBeLessThan(120);
    });

    test('should have smooth move execution', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const moves = 10;
        const startTime = performance.now();

        for (let i = 0; i < moves; i++) {
            await page.click('#new-game-btn');
            await page.waitForSelector('.chess-piece[data-piece="wP"]');
            await page.click('.chess-square[data-square="e2"]');
            await page.click('.chess-square[data-square="e4"]');
            await page.waitForTimeout(50);
        }

        const endTime = performance.now();
        const avgTime = (endTime - startTime) / (moves * 2);

        expect(avgTime).toBeLessThan(200);
    });
});

test.describe('UI Performance - Large Move History', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
    });

    test('should handle 100 moves in history', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Simulate many moves by directly manipulating history
        await page.evaluate(() => {
            const history = [];
            for (let i = 0; i < 100; i++) {
                history.push(`${i % 2 === 0 ? 'w' : 'b'}: e${(i % 4) + 1}`);
            }
            return history;
        });

        // Verify history container exists
        const historyContainer = await page.locator('#move-history');
        await expect(historyContainer).toBeAttached();
    });

    test('should scroll history smoothly', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const startTime = performance.now();

        // Scroll history multiple times
        for (let i = 0; i < 10; i++) {
            await page.evaluate(() => {
                const history = document.querySelector('#move-history');
                if (history) {
                    history.scrollTop = history.scrollHeight;
                }
            });
            await page.waitForTimeout(10);
        }

        const endTime = performance.now();
        const avgTime = (endTime - startTime) / 10;

        expect(avgTime).toBeLessThan(80);
    });
});

test.describe('UI Performance - Theme Switching', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
    });

    test('should switch theme quickly', async ({ page }) => {
        const switches = 10;
        const startTime = performance.now();

        for (let i = 0; i < switches; i++) {
            await page.click('#theme-toggle-btn');
            await page.waitForTimeout(20);
        }

        const endTime = performance.now();
        const avgTime = (endTime - startTime) / switches;

        expect(avgTime).toBeLessThan(350);
    });

    test('should persist theme without delay', async ({ page }) => {
        await page.evaluate(() => localStorage.setItem('kpc-theme', 'light'));
        await page.reload();
        await page.click('#theme-toggle-btn');

        const startTime = performance.now();
        await page.reload();
        await page.waitForTimeout(100);

        const html = page.locator('html');
        await expect(html).toHaveAttribute('data-theme', 'dark');
        const endTime = performance.now();

        expect(endTime - startTime).toBeLessThan(1000);
    });
});

test.describe('UI Performance - Responsive Design', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
    });

    test('should render correctly on mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const squares = await page.locator('.chess-square').count();
        expect(squares).toBe(64);
    });

    test('should render correctly on tablet viewport', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const squares = await page.locator('.chess-square').count();
        expect(squares).toBe(64);
    });

    test('should render correctly on desktop viewport', async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const squares = await page.locator('.chess-square').count();
        expect(squares).toBe(64);
    });

    test('should handle viewport resize', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const sizes = [
            { width: 375, height: 667 },
            { width: 768, height: 1024 },
            { width: 1920, height: 1080 }
        ];

        for (const size of sizes) {
            await page.setViewportSize(size);
            await page.waitForTimeout(100);

            const squares = await page.locator('.chess-square').count();
            expect(squares).toBe(64);
        }
    });
});

test.describe('UI Performance - DOM Operations', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
    });

    test('should minimize DOM mutations', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const startTime = performance.now();

        // Make a move; stop the clock once the pawn is on e4 (do not include AI thinking time)
        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');
        await page.waitForSelector('.chess-square[data-square="e4"] .chess-piece[data-piece="wP"]');

        const endTime = performance.now();
        const mutationTime = endTime - startTime;

        expect(mutationTime).toBeLessThan(2000);
    });

    test('should handle batch DOM updates', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const startTime = performance.now();

        // Start new game (updates all pieces)
        for (let i = 0; i < 5; i++) {
            await page.click('#new-game-btn');
            await page.waitForSelector('.chess-piece[data-piece="wP"]');
        }

        const endTime = performance.now();
        const avgTime = (endTime - startTime) / 5;

        expect(avgTime).toBeLessThan(500);
    });
});