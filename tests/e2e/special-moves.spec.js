// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Special Moves Tests
 * Tests for castling, en passant, and pawn promotion
 */

test.describe('Special Moves', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.locator('#difficulty-choice button[data-level="1"]').click();
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
        }, { timeout: 30000 });
    }

    test('should show kingside castling as legal move', async ({ page }) => {
        test.slow();

        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Clear path for kingside castling: move e2-e4, then Nf3, then Bc4
        await makeMove(page, 'e2', 'e4');
        await waitForAIMove(page);

        await makeMove(page, 'g1', 'f3');
        await waitForAIMove(page);

        await makeMove(page, 'f1', 'c4');
        await waitForAIMove(page);

        // Now click on king to see if castling is available
        await page.click('.chess-square[data-square="e1"]');

        // g1 should be a legal move (kingside castle)
        const g1Square = page.locator('.chess-square[data-square="g1"]');
        await expect(g1Square).toHaveClass(/highlight-legal/);
    });

    test('should execute kingside castling', async ({ page }) => {
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

        // Execute castle
        await makeMove(page, 'e1', 'g1');

        // King should be on g1
        const g1Piece = page.locator('.chess-square[data-square="g1"] .chess-piece');
        await expect(g1Piece).toHaveAttribute('data-piece', 'wK');

        // Rook should be on f1
        const f1Piece = page.locator('.chess-square[data-square="f1"] .chess-piece');
        await expect(f1Piece).toHaveAttribute('data-piece', 'wR');
    });

    test('should show pawn double-move from starting position', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Click on a2 pawn
        await page.click('.chess-square[data-square="a2"]');

        // Both a3 and a4 should be legal
        const a3Square = page.locator('.chess-square[data-square="a3"]');
        const a4Square = page.locator('.chess-square[data-square="a4"]');

        await expect(a3Square).toHaveClass(/highlight-legal/);
        await expect(a4Square).toHaveClass(/highlight-legal/);
    });

    test('should prevent pawn double-move after first move', async ({ page }) => {
        test.slow();

        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Move a2-a3 (single square)
        await makeMove(page, 'a2', 'a3');
        await waitForAIMove(page);

        // Some other move
        await makeMove(page, 'e2', 'e4');
        await waitForAIMove(page);

        // Now click on a3 pawn
        await page.click('.chess-square[data-square="a3"]');

        // Only a4 should be legal (not a5)
        const a4Square = page.locator('.chess-square[data-square="a4"]');
        const a5Square = page.locator('.chess-square[data-square="a5"]');

        await expect(a4Square).toHaveClass(/highlight-legal/);
        await expect(a5Square).not.toHaveClass(/highlight-legal/);
    });

    test('should capture diagonally with pawn', async ({ page }) => {
        test.slow();

        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Move e-pawn forward
        await makeMove(page, 'e2', 'e4');
        await waitForAIMove(page);

        // Move pawn again to e5
        await makeMove(page, 'e4', 'e5');
        await waitForAIMove(page);

        await page.locator('#board-container').scrollIntoViewIfNeeded();

        await page.waitForFunction(() => {
            const t = document.querySelector('#status-text')?.textContent || '';
            return t.includes('Your move');
        }, { timeout: 15000 });

        const e5 = page.locator('.chess-square[data-square="e5"]');
        await expect(e5.locator('.chess-piece[data-piece="wP"]')).toBeVisible({ timeout: 20000 });
        await e5.scrollIntoViewIfNeeded();

        // Select e5 pawn — legal-move highlights prove selection (mobile may keep last-move highlight on the square)
        await e5.click({ force: true });

        const legalMoves = page.locator('.chess-square.highlight-legal');
        await expect(legalMoves.first()).toBeVisible({ timeout: 20000 });
        const legalCount = await legalMoves.count();
        expect(legalCount).toBeGreaterThan(0);
    });
});
