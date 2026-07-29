// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Undo Move UI Tests
 * Covers the Undo button in human play: visibility, disabled states,
 * single-move and turn-pair undo, and undo after a page reload.
 */

test.describe('Undo Move', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
    });

    test('is visible in human mode and hidden in engine match mode', async ({ page }) => {
        const undoBtn = page.locator('#undo-move-btn');
        await expect(undoBtn).toBeVisible();

        await page.locator('#play-mode-choice button[data-mode="match"]').click();
        await expect(undoBtn).toBeHidden();

        await page.locator('#play-mode-choice button[data-mode="human"]').click();
        await expect(undoBtn).toBeVisible();
    });

    test('is disabled at the start of a game', async ({ page }) => {
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        await expect(page.locator('#undo-move-btn')).toBeDisabled();
    });

    test('undoes a single move when the computer has not replied yet', async ({ page }) => {
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
        await page.evaluate(() => {
            // Block the AI reply so only the player's move is on the board.
            window.requestAnimationFrame = () => 0;
        });

        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');
        await expect(page.locator('.chess-square[data-square="e4"] .chess-piece')).toHaveAttribute('data-piece', 'wP');
        await expect(page.locator('#move-history li')).toHaveCount(1);

        const undoBtn = page.locator('#undo-move-btn');
        await expect(undoBtn).toBeEnabled();
        await undoBtn.click();

        await expect(page.locator('.chess-square[data-square="e2"] .chess-piece')).toHaveAttribute('data-piece', 'wP');
        await expect(page.locator('.chess-square[data-square="e4"] .chess-piece')).not.toHaveClass('has-piece');
        await expect(page.locator('#move-history li')).toHaveCount(0);
        await expect(undoBtn).toBeDisabled();
        await expect(page.locator('#turn-indicator')).toHaveText('Your move');
    });

    test('undoes own move and the computer reply', async ({ page }) => {
        // Fast engine so the reply lands quickly.
        await page.locator('#difficulty-choice button[data-level="1"]').click();
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');
        // Wait for the computer's reply to appear in the move log.
        await expect(page.locator('#move-history li')).toHaveCount(2, { timeout: 15000 });

        await page.click('#undo-move-btn');

        // Back to the initial position: our pawn home, reply gone, our turn.
        await expect(page.locator('#move-history li')).toHaveCount(0);
        await expect(page.locator('.chess-square[data-square="e2"] .chess-piece')).toHaveAttribute('data-piece', 'wP');
        await expect(page.locator('.chess-square[data-square="e4"] .chess-piece')).not.toHaveClass('has-piece');
        await expect(page.locator('#turn-indicator')).toHaveText('Your move');
        await expect(page.locator('#undo-move-btn')).toBeDisabled();
    });

    test('undo still works after a page reload (game restored)', async ({ page }) => {
        // Block AI replies in BOTH documents: addInitScript re-applies the stub
        // after the reload, the evaluate covers the current one.
        await page.addInitScript(() => {
            window.requestAnimationFrame = () => 0;
        });
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
        await page.evaluate(() => {
            window.requestAnimationFrame = () => 0;
        });

        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');
        await expect(page.locator('#move-history li')).toHaveCount(1);
        // Let the throttled (500ms) auto-save persist the position.
        await page.waitForTimeout(700);

        await page.reload();
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
        await expect(page.locator('#move-history li')).toHaveCount(1);
        await expect(page.locator('.chess-square[data-square="e4"] .chess-piece')).toHaveAttribute('data-piece', 'wP');

        await page.click('#undo-move-btn');

        await expect(page.locator('#move-history li')).toHaveCount(0);
        await expect(page.locator('.chess-square[data-square="e2"] .chess-piece')).toHaveAttribute('data-piece', 'wP');
        await expect(page.locator('.chess-square[data-square="e4"] .chess-piece')).not.toHaveClass('has-piece');
    });
});
