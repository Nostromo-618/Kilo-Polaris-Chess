// @ts-check
import { test, expect } from '@playwright/test';

/**
 * UI Controls Tests
 * Tests for theme switching, difficulty selection, and color choice
 */

test.describe('UI Controls', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
    });

    async function ensureThemeCustomizerVisible(page) {
        const customizer = page.locator('[data-theme-customizer-trigger]');
        if (await customizer.isVisible()) return;

        const menuToggle = page.locator('#mobile-menu-toggle');
        if (await menuToggle.isVisible()) {
            await menuToggle.click();
        }
        await expect(customizer).toBeVisible();
    }

    test.describe('Theme Switching', () => {
        test('should have theme customizer button visible', async ({ page }) => {
            await ensureThemeCustomizerVisible(page);
        });

        test('should open theme customizer when button clicked', async ({ page }) => {
            await ensureThemeCustomizerVisible(page);
            await page.click('[data-theme-customizer-trigger]');
            // The Vanduo theme customizer uses a dynamic panel
            const panel = page.locator('.vd-theme-customizer-panel');
            await expect(panel).toHaveClass(/is-open/);
        });

        test('should switch to Light theme via customizer', async ({ page }) => {
            await page.evaluate(() => localStorage.setItem('kpc-theme', 'system'));
            await page.reload();
            await page.click('#theme-toggle-btn');
            const html = page.locator('html');
            await expect(html).toHaveAttribute('data-theme', 'light');
        });

        test('should switch to Dark theme via customizer', async ({ page }) => {
            await page.evaluate(() => localStorage.setItem('kpc-theme', 'light'));
            await page.reload();
            await page.click('#theme-toggle-btn');
            const html = page.locator('html');
            await expect(html).toHaveAttribute('data-theme', 'dark');
        });

        test('should switch to System theme via customizer', async ({ page }) => {
            await page.evaluate(() => localStorage.setItem('kpc-theme', 'dark'));
            await page.reload();
            await page.click('#theme-toggle-btn');
            const html = page.locator('html');
            await expect(html).not.toHaveAttribute('data-theme');
        });
    });

    test.describe('Difficulty Selection', () => {
        test('should have all 6 difficulty levels', async ({ page }) => {
            const buttons = page.locator('#difficulty-choice button[data-level]');
            await expect(buttons).toHaveCount(6);
        });

        test('should display descriptive difficulty names', async ({ page }) => {
            await expect(page.locator('#difficulty-choice button[data-level="1"]')).toHaveAttribute('title', 'Very Easy');
            await expect(page.locator('#difficulty-choice button[data-level="3"]')).toHaveAttribute('title', 'Medium');
            await expect(page.locator('#difficulty-choice button[data-level="5"]')).toHaveAttribute('title', 'Very Hard');
            await expect(page.locator('#difficulty-choice button[data-level="6"]')).toHaveAttribute('title', 'Expert');
        });

        test('should allow changing difficulty', async ({ page }) => {
            for (const level of ['1', '2', '3', '4', '5', '6']) {
                await page.locator(`#difficulty-choice button[data-level="${level}"]`).click();
                await expect(page.locator(`#difficulty-choice button[data-level="${level}"]`)).toHaveClass(/vd-is-active/);
            }
        });
    });

    test.describe('Color Choice', () => {
        test('should have White, Black, and Random options', async ({ page }) => {
            const colorChoice = page.locator('#color-choice');

            await expect(colorChoice.locator('button[data-color="white"]')).toBeVisible();
            await expect(colorChoice.locator('button[data-color="black"]')).toBeVisible();
            await expect(colorChoice.locator('button[data-color="random"]')).toBeVisible();
        });

        test('should highlight active color choice', async ({ page }) => {
            const whiteBtn = page.locator('#color-choice button[data-color="white"]');
            const blackBtn = page.locator('#color-choice button[data-color="black"]');
            const randomBtn = page.locator('#color-choice button[data-color="random"]');

            // Default is random
            await expect(randomBtn).toHaveClass(/active/);
            await expect(whiteBtn).not.toHaveClass(/active/);

            // Switch to black
            await blackBtn.click();
            await expect(blackBtn).toHaveClass(/active/);
            await expect(randomBtn).not.toHaveClass(/active/);
        });

        test('should start game with selected color', async ({ page }) => {
            // Select black
            await page.locator('#color-choice button[data-color="black"]').click();

            // Start game
            await page.click('#new-game-btn');
            await page.waitForSelector('.chess-piece[data-piece="wP"]');

            // When playing as black, board should be flipped
            // a8 square should be at the bottom-left visually
            // We can check this by examining the CSS order property
            const a8Square = page.locator('.chess-square[data-square="a8"]');
            const a8Order = await a8Square.evaluate(el => window.getComputedStyle(el).order);

            // a8 should be in the lower portion of the grid (higher order number)
            expect(parseInt(a8Order)).toBeGreaterThan(32);
        });
    });

    test.describe('Pawn Promotion Selector', () => {
        test('should provide four promotion options', async ({ page }) => {
            const select = page.locator('#promotion-piece-select');
            await expect(select).toBeVisible();
            await expect(select.locator('option')).toHaveCount(4);
        });

        test('should default to queen', async ({ page }) => {
            await expect(page.locator('#promotion-piece-select')).toHaveValue('Q');
        });

        test('should allow changing selected promotion piece', async ({ page }) => {
            await page.selectOption('#promotion-piece-select', 'N');
            await expect(page.locator('#promotion-piece-select')).toHaveValue('N');
        });
    });
});
