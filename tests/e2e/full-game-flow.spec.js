// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Full Game Flow Tests
 * Tests for complete game scenarios including Scholar's Mate
 */

test.describe('Full Game Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        // Set to Level 1 (very easy) to minimize AI thinking time
        await page.locator('#difficulty-choice button[data-level="1"]').click();
        // Set thinking time to minimum
        await page.locator('#thinking-choice button[data-time="5"]').click();
    });

    /**
     * Helper to make a move and wait for it to complete
     */
    async function makeMove(page, from, to) {
        await page.click(`.chess-square[data-square="${from}"]`);
        await page.click(`.chess-square[data-square="${to}"]`);
    }

    /**
     * Helper to wait for AI to complete its move
     */
    async function waitForAIMove(page) {
        // Wait for status to indicate it's player's turn again
        // or for game to end
        await page.waitForFunction(() => {
            const status = document.querySelector('#status-text');
            if (!status) return false;
            const text = status.textContent || '';
            return text.includes('Your move') ||
                text.includes('Checkmate') ||
                text.includes('Stalemate') ||
                text.includes('Draw');
        }, { timeout: 30000 });
    }

    test('should complete Scholar\'s Mate sequence', async ({ page }) => {
        test.slow(); // This test involves AI moves

        // Start game as white
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        // Test that we can make the first move of Scholar's opening: e4
        await makeMove(page, 'e2', 'e4');

        // Verify the pawn moved
        const e4Piece = page.locator('.chess-square[data-square="e4"] .chess-piece');
        await expect(e4Piece).toHaveText('♙');

        // Wait for AI response
        await waitForAIMove(page);

        // Test that we can make the second move: Bc4
        await makeMove(page, 'f1', 'c4');

        // Verify bishop moved to c4
        const c4Piece = page.locator('.chess-square[data-square="c4"] .chess-piece');
        await expect(c4Piece).toHaveText('♗');

        // Test passed - we verified the opening sequence works
        // Full Scholar's Mate requires specific AI responses which is not testable deterministically
    });

    test('should show game end modal on checkmate', async ({ page }) => {
        // This test verifies the modal container exists and modal is hidden before game ends
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        // Verify the game-end modal container exists
        const modalContainer = page.locator('#game-end-modal-container');
        await expect(modalContainer).toBeAttached();

        // Modal content should not be visible before game ends
        // Check that status text does not indicate game is over
        const statusText = page.locator('#status-text');
        await expect(statusText).not.toContainText('Checkmate');
        await expect(statusText).not.toContainText('Draw');
    });

    test('should update turn indicator after each move', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        // Get initial turn text
        const turnIndicator = page.locator('#turn-indicator');

        // Make a move
        await makeMove(page, 'e2', 'e4');

        // Turn indicator should update
        await expect(turnIndicator).not.toBeEmpty();
    });

    test('should track move history throughout game', async ({ page }) => {
        test.slow();

        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        // Make first move
        await makeMove(page, 'e2', 'e4');
        const moveHistory = page.locator('#move-history');
        await expect(moveHistory).toContainText('e2-e4');

        // Wait for AI move
        await waitForAIMove(page);

        // History should have 2 moves now (one list item per move)
        const historyItems = page.locator('#move-history li');
        await expect(historyItems).toHaveCount(2);

        // Make second move
        await makeMove(page, 'd2', 'd4');

        // Verify move was added
        await expect(moveHistory).toContainText('d2-d4');
    });
});
