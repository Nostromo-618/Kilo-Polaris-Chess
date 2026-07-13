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

    // Open vd3's VdThemeCustomizer via the header paint-roller (desktop) or the
    // mobile offcanvas ("Customize theme").
    async function openThemeCustomizer(page) {
        const deskBtn = page.locator(
            '.header-controls .header-icon-btn[aria-label="Open theme customizer"]',
        );
        if (await deskBtn.isVisible()) {
            await deskBtn.click();
            return;
        }
        await page.locator('#mobile-menu-toggle').click();
        await page.getByRole('button', { name: 'Customize theme' }).click();
    }

    test.describe('Theme Switching', () => {
        // Theme MODE (light/dark/system) is the vd3 VdThemeSwitcher (#theme-toggle-btn),
        // which cycles system -> light -> dark and persists to vanduo-theme-preference.
        test('should have a theme customizer control', async ({ page }) => {
            const deskBtn = page.locator(
                '.header-controls .header-icon-btn[aria-label="Open theme customizer"]',
            );
            const mobileToggle = page.locator('#mobile-menu-toggle');
            expect(
                (await deskBtn.isVisible()) || (await mobileToggle.isVisible()),
            ).toBeTruthy();
        });

        test('should open the theme customizer panel', async ({ page }) => {
            await openThemeCustomizer(page);
            await expect(page.locator('.vd-theme-customizer-panel')).toHaveClass(
                /is-open/,
            );
            await expect(page.getByText('Customize Theme')).toBeVisible();
        });

        test('should cycle to Light theme', async ({ page }) => {
            await page.evaluate(() =>
                localStorage.setItem('vanduo-theme-preference', 'system'),
            );
            await page.reload();
            await page.click('#theme-toggle-btn');
            await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
        });

        test('should cycle to Dark theme', async ({ page }) => {
            await page.evaluate(() =>
                localStorage.setItem('vanduo-theme-preference', 'light'),
            );
            await page.reload();
            await page.click('#theme-toggle-btn');
            await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        });

        test('should cycle to System theme', async ({ page }) => {
            await page.evaluate(() =>
                localStorage.setItem('vanduo-theme-preference', 'dark'),
            );
            await page.reload();
            await page.click('#theme-toggle-btn');
            await expect(page.locator('html')).not.toHaveAttribute('data-theme');
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

    test.describe('Promotion Picker Overlay', () => {
        test('should not show promotion picker initially', async ({ page }) => {
            const picker = page.locator('.promotion-picker');
            await expect(picker).toHaveCount(0);
        });
    });
});
