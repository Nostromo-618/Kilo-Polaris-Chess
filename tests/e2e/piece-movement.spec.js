// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Piece Movement Tests
 * Tests for selecting pieces, showing legal moves, and executing moves
 */

test.describe('Piece Movement', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
        // Start a new game as white (first move must be ours)
        await page.click('#new-game-btn');
        // Wait for game to initialize
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should highlight selected piece', async ({ page }) => {
        // Click on e2 pawn (white pawn on e2)
        const e2Square = page.locator('.chess-square[data-square="e2"]');
        await e2Square.click();

        await expect(e2Square).toHaveClass(/highlight-selected/);
    });

    test('should show legal move indicators when piece is selected', async ({ page }) => {
        // Click on e2 pawn
        const e2Square = page.locator('.chess-square[data-square="e2"]');
        await e2Square.click();

        // e3 and e4 should be highlighted as legal moves
        const e3Square = page.locator('.chess-square[data-square="e3"]');
        const e4Square = page.locator('.chess-square[data-square="e4"]');

        await expect(e3Square).toHaveClass(/highlight-legal/);
        await expect(e4Square).toHaveClass(/highlight-legal/);
    });

    test('should execute move when clicking legal target square', async ({ page }) => {
        // Get piece glyph before move
        const e2Square = page.locator('.chess-square[data-square="e2"]');
        const e2Piece = e2Square.locator('.chess-piece');

        // Click e2 to select
        await e2Square.click();

        // Click e4 to move
        const e4Square = page.locator('.chess-square[data-square="e4"]');
        await e4Square.click();

        // e4 should now have the pawn
        const e4Piece = e4Square.locator('.chess-piece');
        await expect(e4Piece).toHaveText('♙');

        // e2 should be empty
        await expect(e2Piece).toHaveText('');
    });

    test('should highlight last move squares', async ({ page }) => {
        // Make e2-e4 move
        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');

        // Both e2 and e4 should have last-move highlight
        const e2Square = page.locator('.chess-square[data-square="e2"]');
        const e4Square = page.locator('.chess-square[data-square="e4"]');

        await expect(e2Square).toHaveClass(/highlight-last-move/);
        await expect(e4Square).toHaveClass(/highlight-last-move/);
    });

    test('should clear selection when clicking empty square without move', async ({ page }) => {
        // Select e2 pawn
        await page.click('.chess-square[data-square="e2"]');

        // Verify selection
        const e2Square = page.locator('.chess-square[data-square="e2"]');
        await expect(e2Square).toHaveClass(/highlight-selected/);

        // Click on an illegal square (a6 - too far)
        await page.click('.chess-square[data-square="a6"]');

        // e2 should no longer be selected
        await expect(e2Square).not.toHaveClass(/highlight-selected/);
    });

    test('should add move to history after making a move', async ({ page }) => {
        // Make e2-e4 move
        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');

        // Check move history
        const moveHistory = page.locator('#move-history');
        await expect(moveHistory).toContainText('e2-e4');
    });

    test('should show knight legal moves correctly', async ({ page }) => {
        // Click on g1 knight
        const g1Square = page.locator('.chess-square[data-square="g1"]');
        await g1Square.click();

        // f3 and h3 should be legal moves
        const f3Square = page.locator('.chess-square[data-square="f3"]');
        const h3Square = page.locator('.chess-square[data-square="h3"]');

        await expect(f3Square).toHaveClass(/highlight-legal/);
        await expect(h3Square).toHaveClass(/highlight-legal/);
    });

    test('should switch selection when clicking different own piece', async ({ page }) => {
        // Select e2 pawn
        await page.click('.chess-square[data-square="e2"]');
        const e2Square = page.locator('.chess-square[data-square="e2"]');
        await expect(e2Square).toHaveClass(/highlight-selected/);

        // Select d2 pawn instead
        await page.click('.chess-square[data-square="d2"]');
        const d2Square = page.locator('.chess-square[data-square="d2"]');

        // d2 should now be selected, e2 should not
        await expect(d2Square).toHaveClass(/highlight-selected/);
        await expect(e2Square).not.toHaveClass(/highlight-selected/);
    });
});
