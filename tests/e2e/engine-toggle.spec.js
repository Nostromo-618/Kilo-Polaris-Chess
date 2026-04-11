// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Engine Toggle Tests
 * Verifies that both the built-in (Aurora Polaris) and TomitankChess engines
 * can be selected and produce AI moves.
 */

test.describe('Engine Toggle', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.locator('#difficulty-choice button[data-level="1"]').click();
    });

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

    test('should default to TomitankChess engine', async ({ page }) => {
        const active = await page.locator('#engine-choice button.vd-is-active').getAttribute('data-engine');
        expect(active).toBe('tomitank');
    });

    test('should switch to Aurora Polaris engine', async ({ page }) => {
        await page.locator('#engine-choice button[data-engine="builtin"]').click();
        const active = await page.locator('#engine-choice button.vd-is-active').getAttribute('data-engine');
        expect(active).toBe('builtin');
    });

    test('should persist engine choice to localStorage', async ({ page }) => {
        await page.locator('#engine-choice button[data-engine="builtin"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const stored = await page.evaluate(() => localStorage.getItem('kpc-engine'));
        expect(stored).toBe('builtin');
    });

    test('should restore engine choice from localStorage', async ({ page }) => {
        await page.evaluate(() => localStorage.setItem('kpc-engine', 'builtin'));
        await page.reload();

        const active = await page.locator('#engine-choice button.vd-is-active').getAttribute('data-engine');
        expect(active).toBe('builtin');
    });

    test('TomitankChess engine should produce an AI move', async ({ page }) => {
        test.slow();
        await page.locator('#engine-choice button[data-engine="tomitank"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');

        await waitForAIMove(page);

        const historyItems = page.locator('#move-history li');
        await expect(historyItems).toHaveCount(2);
    });

    test('Aurora Polaris engine should produce an AI move', async ({ page }) => {
        test.slow();
        await page.locator('#engine-choice button[data-engine="builtin"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');

        await waitForAIMove(page);

        const historyItems = page.locator('#move-history li');
        await expect(historyItems).toHaveCount(2);
    });
});
