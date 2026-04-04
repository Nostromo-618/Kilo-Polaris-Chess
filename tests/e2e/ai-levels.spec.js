/**
 * AI Levels Tests
 * 
 * Tests AI functionality across all difficulty levels.
 * Split into:
 *   - Quick smoke tests (run in default suite) - single move per level
 *   - Full game tests (run separately) - multiple moves per level
 */
const { test, expect } = require('@playwright/test');

// Helper: make a move by clicking squares
async function makeMove(page, from, to) {
    await page.click(`.chess-square[data-square="${from}"]`);
    await page.click(`.chess-square[data-square="${to}"]`);
}

// Helper: wait for AI to complete its move
async function waitForAIMove(page) {
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

test.describe('AI Levels - Smoke Tests', () => {
    test.describe.configure({ mode: 'parallel' });

    // Quick test: verify each level can complete at least one move
    for (const level of [1, 2, 3, 4, 5]) {
        test(`Level ${level} should complete AI move`, async ({ page }) => {
            await page.goto('/');
            await page.evaluate(() => {
                localStorage.setItem('kpc-disclaimer-accepted', 'true');
            });
            await page.reload();

            // Set difficulty level
            await page.locator(`#difficulty-choice button[data-level="${level}"]`).click();

            // Start new game
            await page.click('#new-game-btn');
            await page.waitForSelector('.chess-piece:has-text("♙")');

            // Make player move: e4
            await makeMove(page, 'e2', 'e4');

            // Wait for AI response
            await waitForAIMove(page);

            // Verify AI made a move (move history should have 2 moves)
            const historyItems = page.locator('#move-history li');
            await expect(historyItems).toHaveCount(2);
        });
    }
});

/**
 * Full Game Tests - Tagged for separate execution
 * These tests play multiple moves at each level and take longer.
 * Run with: npm run test:full-game
 */
test.describe('AI Levels - Full Game Tests', () => {
    test.describe.configure({ mode: 'serial' }); // Run serially to avoid resource contention

    for (const level of [1, 2, 3, 4, 5]) {
        test(`Level ${level} should play multiple moves without errors`, async ({ page }) => {
            test.slow(); // Mark as slow test

            await page.goto('/');
            await page.evaluate(() => {
                localStorage.setItem('kpc-disclaimer-accepted', 'true');
            });
            await page.reload();

            // Set difficulty level
            await page.locator(`#difficulty-choice button[data-level="${level}"]`).click();

            // Set shorter thinking time for faster tests
            await page.locator('#thinking-choice button[data-time="5"]').click();

            // Start new game
            await page.click('#new-game-btn');
            await page.waitForSelector('.chess-piece:has-text("♙")');

            // Play several moves
            const openingMoves = [
                ['e2', 'e4'],
                ['d2', 'd4'],
                ['g1', 'f3'],
                ['b1', 'c3'],
            ];

            for (const [from, to] of openingMoves) {
                // Check if game is over
                const statusText = await page.locator('#status-text').textContent();
                if (statusText?.includes('Checkmate') ||
                    statusText?.includes('Stalemate') ||
                    statusText?.includes('Draw')) {
                    break;
                }

                // Wait for player's turn
                await page.waitForFunction(() => {
                    const status = document.querySelector('#status-text');
                    return status?.textContent?.includes('Your move');
                }, { timeout: 30000 });

                // Make move (may fail if piece was captured, that's ok)
                try {
                    const pieceOnSquare = await page.locator(`.chess-square[data-square="${from}"] .chess-piece`).count();
                    if (pieceOnSquare > 0) {
                        await makeMove(page, from, to);
                        await waitForAIMove(page);
                    }
                } catch {
                    // Move failed, continue with next
                }
            }

            // Verify game progressed without errors (at least 2 moves in history)
            const historyItems = page.locator('#move-history li');
            const count = await historyItems.count();
            expect(count).toBeGreaterThanOrEqual(2);

            // Verify no error state
            const statusText = await page.locator('#status-text').textContent();
            expect(statusText).not.toContain('Error');
        });
    }
});
