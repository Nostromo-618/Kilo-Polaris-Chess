// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Game Initialization Tests
 * Tests for game startup, settings, and initial board state
 */

test.describe('Game Initialization', () => {
    test.beforeEach(async ({ page }) => {
        // Accept disclaimer via localStorage before navigating
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
    });

    test('should display the chess board with 64 squares', async ({ page }) => {
        const squares = page.locator('.chess-square');
        await expect(squares).toHaveCount(64);
    });

    test('should show initial status message', async ({ page }) => {
        const status = page.locator('#status-text');
        // Status should have some text content initially
        await expect(status).not.toBeEmpty();
    });

    test('should have New Game button visible', async ({ page }) => {
        const newGameBtn = page.locator('#new-game-btn');
        await expect(newGameBtn).toBeVisible();
        await expect(newGameBtn).toHaveText('New Game');
    });

    test('should display default difficulty as Level 3 (Medium)', async ({ page }) => {
        await expect(page.locator('#difficulty-choice button[data-level="3"]')).toHaveClass(/vd-is-active/);
    });

    test('should start new game when clicking New Game', async ({ page }) => {
        await page.click('#new-game-btn');

        // Status should change from initial message
        const status = page.locator('#status-text');
        await expect(status).not.toContainText('Initialize a new game');

        // Pieces should be rendered on the board (SVG-backed; data-piece on occupied squares)
        const occupied = page.locator('.chess-piece.has-piece');
        await expect(occupied.first()).toBeVisible();
    });

    test('should render all starting pieces correctly', async ({ page }) => {
        await page.click('#new-game-btn');

        // Wait for board to be rendered with pieces
        await page.waitForFunction(() => {
            return document.querySelectorAll('.chess-piece.has-piece').length === 32;
        });
    });

    test('should allow color choice before starting game', async ({ page }) => {
        const whiteBtn = page.locator('#color-choice button[data-color="white"]');
        const blackBtn = page.locator('#color-choice button[data-color="black"]');
        const randomBtn = page.locator('#color-choice button[data-color="random"]');

        await expect(whiteBtn).toBeVisible();
        await expect(blackBtn).toBeVisible();
        await expect(randomBtn).toBeVisible();

        // Random should be active by default (vd-is-active in Vanduo v1.1+)
        await expect(randomBtn).toHaveClass(/vd-is-active/);
    });

    test('should switch color choice when clicking Black', async ({ page }) => {
        const blackBtn = page.locator('#color-choice button[data-color="black"]');
        await blackBtn.click();
        await expect(blackBtn).toHaveClass(/vd-is-active/);
    });

    test('should allow changing difficulty levels', async ({ page }) => {
        await page.locator('#difficulty-choice button[data-level="1"]').click();
        await expect(page.locator('#difficulty-choice button[data-level="1"]')).toHaveClass(/vd-is-active/);

        await page.locator('#difficulty-choice button[data-level="5"]').click();
        await expect(page.locator('#difficulty-choice button[data-level="5"]')).toHaveClass(/vd-is-active/);
    });
});
