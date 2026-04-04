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

    test.describe('Theme Switching', () => {
        test('should have theme customizer button visible', async ({ page }) => {
            const themeBtn = page.locator('[data-theme-customizer-trigger]');
            await expect(themeBtn).toBeVisible();
        });

        test('should open theme customizer when button clicked', async ({ page }) => {
            await page.click('[data-theme-customizer-trigger]');
            // The Vanduo theme customizer uses a dynamic panel
            const panel = page.locator('.vd-theme-customizer-panel');
            await expect(panel).toHaveClass(/is-open/);
        });

        test('should switch to Light theme via customizer', async ({ page }) => {
            await page.click('[data-theme-customizer-trigger]');
            await page.click('button:has-text("Light")');
            
            const html = page.locator('html');
            await expect(html).toHaveAttribute('data-theme', 'light');
        });

        test('should switch to Dark theme via customizer', async ({ page }) => {
            await page.click('[data-theme-customizer-trigger]');
            await page.click('button:has-text("Dark")');
            
            const html = page.locator('html');
            await expect(html).toHaveAttribute('data-theme', 'dark');
        });

        test('should switch to System theme via customizer', async ({ page }) => {
            await page.click('[data-theme-customizer-trigger]');
            await page.click('button:has-text("System")');
            
            // Should not have data-theme attribute when system is selected
            const html = page.locator('html');
            await expect(html).not.toHaveAttribute('data-theme');
        });
    });

    test.describe('Difficulty Selection', () => {
        test('should have all 5 difficulty levels', async ({ page }) => {
            const buttons = page.locator('#difficulty-choice button[data-level]');
            await expect(buttons).toHaveCount(5);
        });

        test('should display descriptive difficulty names', async ({ page }) => {
            await expect(page.locator('#difficulty-choice button[data-level="1"]')).toHaveAttribute('title', 'Very Easy');
            await expect(page.locator('#difficulty-choice button[data-level="3"]')).toHaveAttribute('title', 'Medium');
            await expect(page.locator('#difficulty-choice button[data-level="5"]')).toHaveAttribute('title', 'Very Hard');
        });

        test('should allow changing difficulty', async ({ page }) => {
            for (const level of ['1', '2', '3', '4', '5']) {
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

            // Default is white
            await expect(whiteBtn).toHaveClass(/active/);
            await expect(blackBtn).not.toHaveClass(/active/);

            // Switch to black
            await blackBtn.click();
            await expect(blackBtn).toHaveClass(/active/);
            await expect(whiteBtn).not.toHaveClass(/active/);
        });

        test('should start game with selected color', async ({ page }) => {
            // Select black
            await page.locator('#color-choice button[data-color="black"]').click();

            // Start game
            await page.click('#new-game-btn');
            await page.waitForSelector('.chess-piece:has-text("♙")');

            // When playing as black, board should be flipped
            // a8 square should be at the bottom-left visually
            // We can check this by examining the CSS order property
            const a8Square = page.locator('.chess-square[data-square="a8"]');
            const a8Order = await a8Square.evaluate(el => window.getComputedStyle(el).order);

            // a8 should be in the lower portion of the grid (higher order number)
            expect(parseInt(a8Order)).toBeGreaterThan(32);
        });
    });

    test.describe('Maximum Thinking Time', () => {
        test('should have preset thinking time buttons', async ({ page }) => {
            const group = page.locator('#thinking-choice');
            await expect(group).toBeVisible();
            await expect(group.locator('button[data-time]')).toHaveCount(5);
        });

        test('should default to 10 seconds', async ({ page }) => {
            await expect(page.locator('#thinking-choice button[data-time="10"]')).toHaveClass(/vd-is-active/);
        });

        test('should allow changing thinking time', async ({ page }) => {
            await page.locator('#thinking-choice button[data-time="5"]').click();
            await expect(page.locator('#thinking-choice button[data-time="5"]')).toHaveClass(/vd-is-active/);
        });
    });
});
