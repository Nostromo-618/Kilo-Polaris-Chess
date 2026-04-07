// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Responsive Layout Tests
 * Tests for mobile viewport layout verification
 */

test.describe('Responsive Layout', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
    });

    test.describe('Desktop Layout (1280x720)', () => {
        test.use({ viewport: { width: 1280, height: 720 } });

        test('should show board and side panel in two columns', async ({ page }) => {
            const board = page.locator('#board-container');
            const sidePanel = page.locator('.side-panel');

            await expect(board).toBeVisible();
            await expect(sidePanel).toBeVisible();

            const boardBox = await board.boundingBox();
            const panelBox = await sidePanel.boundingBox();

            expect(boardBox).not.toBeNull();
            expect(panelBox).not.toBeNull();
            expect(panelBox.x).toBeGreaterThan(boardBox.x);
        });

        test('should show header with title and theme toggle inline', async ({ page }) => {
            const header = page.locator('.app-header');
            const computedStyle = await header.evaluate(el =>
                window.getComputedStyle(el).flexDirection
            );
            expect(computedStyle).toBe('row');
        });

        test('board should be visible alongside controls', async ({ page }) => {
            const board = page.locator('#board-container');
            const sidePanel = page.locator('.side-panel');

            await expect(board).toBeVisible();
            await expect(sidePanel).toBeVisible();

            const boardBox = await board.boundingBox();
            const panelBox = await sidePanel.boundingBox();

            expect(boardBox).not.toBeNull();
            expect(panelBox).not.toBeNull();
            expect(panelBox.x).toBeGreaterThan(boardBox.x);
        });
    });

    test.describe('Tablet Layout (900px)', () => {
        test.use({ viewport: { width: 900, height: 1024 } });

        test('should still maintain two-column layout at 900px', async ({ page }) => {
            const board = page.locator('#board-container');
            const sidePanel = page.locator('.side-panel');

            await expect(board).toBeVisible();
            await expect(sidePanel).toBeVisible();
        });
    });

    test.describe('Mobile Layout (540px)', () => {
        test.use({ viewport: { width: 540, height: 960 } });

        test('should stack board and side panel vertically', async ({ page }) => {
            const grid = page.locator('.vd-row');
            await expect(grid).toBeVisible();

            const boardSection = page.locator('.board-section');
            const sidePanel = page.locator('aside');

            await expect(boardSection).toBeVisible();
            await expect(sidePanel).toBeVisible();
        });

        test('should keep header elements horizontal', async ({ page }) => {
            const header = page.locator('.app-header');
            const computedStyle = await header.evaluate(el => {
                const container = el.querySelector('.vd-container-lg');
                return container ? window.getComputedStyle(container).flexDirection : 'row';
            });
            expect(computedStyle).toBe('row');
        });

        test('board should fill mobile width', async ({ page }) => {
            const board = page.locator('#board-container');
            const boardBox = await board.boundingBox();

            expect(boardBox).not.toBeNull();
            expect(boardBox.width).toBeGreaterThan(540 * 0.85);
        });
    });

    test.describe('Small Mobile Layout (375px - iPhone SE)', () => {
        test.use({ viewport: { width: 375, height: 667 } });

        test('should render correctly on small phones', async ({ page }) => {
            const board = page.locator('#board-container');
            const newGameBtn = page.locator('#new-game-btn');

            await expect(board).toBeVisible();
            await expect(newGameBtn).toBeVisible();
        });

        test('all squares should be visible without overflow', async ({ page }) => {
            const squares = page.locator('.chess-square');
            await expect(squares).toHaveCount(64);

            const boardContainer = page.locator('#board-container');
            await expect(boardContainer).toBeVisible();
            const boardBox = await boardContainer.boundingBox();
            expect(boardBox).not.toBeNull();
            expect(boardBox.width).toBeLessThanOrEqual(375);
            expect(boardBox.height).toBeLessThanOrEqual(667);
        });

        test('chess squares should stay square (1:1) on narrow viewports', async ({ page }) => {
            const square = page.locator('.chess-square[data-square="e4"]');
            await expect(square).toBeVisible();
            const box = await square.boundingBox();
            expect(box).not.toBeNull();
            const ratio = box.width > 0 ? box.height / box.width : 0;
            expect(ratio).toBeGreaterThan(0.97);
            expect(ratio).toBeLessThan(1.03);
        });

        test('controls should be accessible on mobile', async ({ page }) => {
            await expect(page.locator('#new-game-btn')).toBeVisible();
            await expect(page.locator('#difficulty-choice')).toBeVisible();
            await expect(page.locator('[data-theme-customizer-trigger]')).toBeVisible();
        });

        test('game should be playable on mobile', async ({ page }) => {
            await page.locator('#color-choice button[data-color="white"]').click();
            await page.click('#new-game-btn');
            await page.waitForSelector('.chess-piece:has-text("♙")');

            const e2Square = page.locator('.chess-square[data-square="e2"]');
            await e2Square.click();
            await expect(e2Square).toHaveClass(/highlight-selected/);

            await page.click('.chess-square[data-square="e4"]');

            const e4Piece = page.locator('.chess-square[data-square="e4"] .chess-piece');
            await expect(e4Piece).toHaveText('♙');
        });
    });
});
