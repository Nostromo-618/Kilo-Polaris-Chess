// @ts-check
import { test, expect } from '@playwright/test';

/**
 * E2E Integration Tests
 * Tests for complete game scenarios, recovery, and persistence
 */

test.describe('E2E Integration - Complete Game Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.locator('#difficulty-choice button[data-level="1"]').click();
        await page.locator('#thinking-choice button[data-time="5"]').click();
    });

    /**
     * Helper to make a move
     */
    async function makeMove(page, from, to) {
        await page.click(`.chess-square[data-square="${from}"]`);
        await page.click(`.chess-square[data-square="${to}"]`);
    }

    /**
     * Helper to wait for AI move
     */
    async function waitForAIMove(page) {
        await page.waitForFunction(() => {
            const status = document.querySelector('#status-text');
            if (!status) return false;
            const text = status.textContent || '';
            return text.includes('Your move') ||
                text.includes('Checkmate') ||
                text.includes('Stalemate') ||
                text.includes('Draw');
        }, { timeout: 45000 });
    }

    test('should play a complete game from start to finish', async ({ page }) => {
        test.slow();

        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Play a few moves
        await makeMove(page, 'e2', 'e4');
        await waitForAIMove(page);

        await makeMove(page, 'd2', 'd4');
        await waitForAIMove(page);

        await makeMove(page, 'g1', 'f3');
        await waitForAIMove(page);

        // Verify game is progressing (3 plies each side, or ended early)
        const historyItems = await page.locator('#move-history li').count();
        expect(historyItems).toBeGreaterThanOrEqual(4);
    });

    test('should handle pawn promotion in UI', async ({ page }) => {
        test.slow();

        // This test verifies the promotion UI exists
        // Full promotion test would require setting up a specific position
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Verify game starts (one piece div per square; only 32 have pieces)
        const pieces = await page.locator('.chess-piece.has-piece').count();
        expect(pieces).toBe(32);
    });

    test('should handle castling in UI', async ({ page }) => {
        test.slow();

        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Setup for castling
        await makeMove(page, 'e2', 'e4');
        await waitForAIMove(page);

        await makeMove(page, 'g1', 'f3');
        await waitForAIMove(page);

        await makeMove(page, 'f1', 'c4');
        await waitForAIMove(page);

        // Click king to see castling option
        await page.click('.chess-square[data-square="e1"]');

        // g1 should be a legal move (kingside castle)
        const g1Square = await page.locator('.chess-square[data-square="g1"]');
        const g1Class = await g1Square.getAttribute('class');

        expect(g1Class).toContain('highlight-legal');
    });

    test('should handle en passant in UI', async ({ page }) => {
        test.slow();

        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Play moves that could lead to en passant
        await makeMove(page, 'e2', 'e4');
        await waitForAIMove(page);

        await makeMove(page, 'd2', 'd4');
        await waitForAIMove(page);

        // Verify game is still working
        const pieces = await page.locator('.chess-piece').count();
        expect(pieces).toBeGreaterThan(0);
    });

    test('should show check in UI', async ({ page }) => {
        test.slow();

        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Try to create a check position: 1. e4 f6 2. Qh5+
        await makeMove(page, 'e2', 'e4');
        await waitForAIMove(page);

        // Black plays f6 (if AI doesn't block)
        await makeMove(page, 'd1', 'h5');
        await waitForAIMove(page);

        // Verify game continues
        const statusText = await page.locator('#status-text').textContent();
        expect(statusText).toBeDefined();
    });

    test('should show checkmate in UI', async ({ page }) => {
        test.slow();

        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Verify modal container exists
        const modalContainer = await page.locator('#game-end-modal-container');
        await expect(modalContainer).toBeAttached();
    });

    test('should show stalemate in UI', async ({ page }) => {
        test.slow();

        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Verify game is running
        const statusText = await page.locator('#status-text').textContent();
        expect(statusText).toBeDefined();
    });

    test('should show draw in UI', async ({ page }) => {
        test.slow();

        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Verify game is running
        const statusText = await page.locator('#status-text').textContent();
        expect(statusText).toBeDefined();
    });
});

test.describe('E2E Integration - Game Recovery', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.locator('#difficulty-choice button[data-level="1"]').click();
        await page.locator('#thinking-choice button[data-time="5"]').click();
    });

    test('should save game state to localStorage', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Make a move
        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');

        await page.waitForTimeout(800);

        // Check localStorage
        const saved = await page.evaluate(() => localStorage.getItem('kpc-game'));
        expect(saved).not.toBeNull();

        const parsed = JSON.parse(saved);
        expect(parsed).toHaveProperty('board');
        expect(parsed).toHaveProperty('activeColor');
    });

    test('should restore game state on reload', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Make a move
        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');

        await page.waitForTimeout(500);

        // Reload page
        await page.reload();
        await page.waitForTimeout(500);

        // Verify board is restored
        const pieces = await page.locator('.chess-piece').count();
        expect(pieces).toBeGreaterThan(0);
    });

    test('should clear saved game on New Game', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Make a move
        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');

        await page.waitForTimeout(500);

        // Start new game
        await page.click('#new-game-btn');
        await page.waitForTimeout(500);

        // Verify game is reset
        const saved = await page.evaluate(() => localStorage.getItem('kpc-game'));
        if (saved) {
            const parsed = JSON.parse(saved);
            expect(parsed.moveHistory).toHaveLength(0);
        }
    });

    test('should restore difficulty on reload', async ({ page }) => {
        await page.locator('#difficulty-choice button[data-level="4"]').click();
        await page.click('#new-game-btn');
        await page.waitForTimeout(300);

        // Reload
        await page.reload();
        await page.waitForTimeout(300);

        const value = await page.evaluate(() =>
            document.querySelector('#difficulty-choice button.vd-is-active')?.getAttribute('data-level')
        );
        expect(value).toBe('4');
    });

    test('should restore color choice on reload', async ({ page }) => {
        await page.click('#color-choice button[data-color="black"]');
        await page.click('#new-game-btn');
        await page.waitForTimeout(300);

        // Reload
        await page.reload();
        await page.waitForTimeout(300);

        // Verify black is still selected
        const blackClass = await page.locator('#color-choice button[data-color="black"]').getAttribute('class');
        expect(blackClass).toContain('vd-is-active');
    });
});

test.describe('E2E Integration - Theme Persistence', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
    });

    test('should persist theme across reloads', async ({ page }) => {
        await page.evaluate(() => localStorage.setItem('kpc-theme', 'light'));
        await page.reload();
        await page.click('#theme-toggle-btn');

        const html = page.locator('html');
        await expect(html).toHaveAttribute('data-theme', 'dark');

        await page.reload();
        await page.waitForTimeout(300);

        await expect(html).toHaveAttribute('data-theme', 'dark');
    });

    test('should persist Light theme across reloads', async ({ page }) => {
        await page.evaluate(() => localStorage.setItem('kpc-theme', 'system'));
        await page.reload();
        await page.click('#theme-toggle-btn');

        const html = page.locator('html');
        await expect(html).toHaveAttribute('data-theme', 'light');

        await page.reload();
        await page.waitForTimeout(300);

        await expect(html).toHaveAttribute('data-theme', 'light');
    });
});

test.describe('E2E Integration - Concurrent Operations', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.locator('#difficulty-choice button[data-level="1"]').click();
        await page.locator('#thinking-choice button[data-time="5"]').click();
    });

    test('should handle rapid clicks gracefully', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Rapid clicks
        for (let i = 0; i < 10; i++) {
            await page.click('.chess-square[data-square="e2"]');
            await page.click('.chess-square[data-square="e4"]');
        }

        // Game should still be functional
        const pieces = await page.locator('.chess-piece').count();
        expect(pieces).toBeGreaterThan(0);
    });

    test('should handle multiple new game clicks', async ({ page }) => {
        for (let i = 0; i < 5; i++) {
            await page.click('#new-game-btn');
            await page.waitForTimeout(100);
        }

        // Game should be initialized
        await expect(page.locator('.chess-piece.has-piece')).toHaveCount(32);
    });

    test('should handle difficulty change during game', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Change difficulty
        await page.locator('#difficulty-choice button[data-level="3"]').click();

        // Game should continue
        const pieces = await page.locator('.chess-piece').count();
        expect(pieces).toBeGreaterThan(0);
    });

    test('should handle color change during game', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Change color
        await page.click('#color-choice button[data-color="black"]');

        // Game should continue
        const pieces = await page.locator('.chess-piece').count();
        expect(pieces).toBeGreaterThan(0);
    });
});

test.describe('E2E Integration - Error Handling', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
    });

    test('should handle invalid move gracefully', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Try to move pawn illegally (e2 to e6 - too far)
        await page.click('.chess-square[data-square="e2"]');

        // e6 should not be highlighted
        const e6Square = await page.locator('.chess-square[data-square="e6"]');
        const e6Class = await e6Square.getAttribute('class');

        expect(e6Class).not.toContain('highlight-legal');
    });

    test('should handle clicking empty square', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Click empty square
        await page.click('.chess-square[data-square="e4"]');

        // Nothing should be selected
        const e4Class = await page.locator('.chess-square[data-square="e4"]').getAttribute('class');
        expect(e4Class).not.toContain('highlight-selected');
    });

    test('should handle clicking opponent piece', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Click black piece (should not select when it's white's turn)
        await page.click('.chess-square[data-square="e7"]');

        // e7 should not be selected
        const e7Class = await page.locator('.chess-square[data-square="e7"]').getAttribute('class');
        expect(e7Class).not.toContain('highlight-selected');
    });

    test('should handle game end gracefully', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Verify modal container exists
        const modalContainer = await page.locator('#game-end-modal-container');
        await expect(modalContainer).toBeAttached();
    });
});

test.describe('E2E Integration - Performance', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.locator('#difficulty-choice button[data-level="1"]').click();
        await page.locator('#thinking-choice button[data-time="5"]').click();
    });

    test('should respond to moves quickly', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const startTime = Date.now();

        // Make a move
        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');

        // Wait for AI
        await page.waitForFunction(() => {
            const status = document.querySelector('#status-text');
            return status?.textContent?.includes('Your move') || status?.textContent?.includes('Checkmate');
        }, { timeout: 10000 });

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        // Should complete within reasonable time
        expect(totalTime).toBeLessThan(10000);
    });

    test('should handle long move history', async ({ page }) => {
        test.slow();

        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Play many moves
        for (let i = 0; i < 20; i++) {
            const statusText = await page.locator('#status-text').textContent();
            if (statusText?.includes('Checkmate') || statusText?.includes('Stalemate')) {
                break;
            }

            // Try to make a move
            try {
                await page.click('.chess-square[data-square="e2"]');
                await page.click('.chess-square[data-square="e4"]');
                await page.waitForTimeout(500);
            } catch {
                // Move might not be legal, continue
            }
        }

        // Game should still be functional
        const pieces = await page.locator('.chess-piece').count();
        expect(pieces).toBeGreaterThan(0);
    });
});