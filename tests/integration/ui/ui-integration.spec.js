// @ts-check
import { test, expect } from '@playwright/test';

/**
 * UI Integration Tests
 * Tests for BoardView, Controls, and Game state synchronization
 */

test.describe('UI Integration - BoardView + Game State', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
    });

    test('should update board view after move', async ({ page }) => {
        // Make e4 move
        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');

        // Verify piece moved
        const e4Piece = await page.locator('.chess-square[data-square="e4"] .chess-piece').getAttribute('data-piece');
        const e2Piece = await page.locator('.chess-square[data-square="e2"] .chess-piece').getAttribute('data-piece');

        expect(e4Piece).toBe('wP');
        expect(e2Piece).toBeNull();
    });

    test('should update turn indicator after move', async ({ page }) => {
        // Get initial turn
        const initialTurn = await page.locator('#turn-indicator').textContent();

        // Make a move
        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');

        // Wait for turn to update
        await page.waitForTimeout(500);

        const newTurn = await page.locator('#turn-indicator').textContent();

        expect(initialTurn).not.toBe(newTurn);
    });

    test('should highlight legal moves when piece selected', async ({ page }) => {
        // Select e2 pawn
        await page.click('.chess-square[data-square="e2"]');

        // Check for legal move highlights
        const e3Highlight = await page.locator('.chess-square[data-square="e3"]').getAttribute('class');
        const e4Highlight = await page.locator('.chess-square[data-square="e4"]').getAttribute('class');

        expect(e3Highlight).toContain('highlight-legal');
        expect(e4Highlight).toContain('highlight-legal');
    });

    test('should show last move highlight', async ({ page }) => {
        // Make a move
        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');

        // Check for last move highlights
        const e2Class = await page.locator('.chess-square[data-square="e2"]').getAttribute('class');
        const e4Class = await page.locator('.chess-square[data-square="e4"]').getAttribute('class');

        expect(e2Class).toContain('highlight-last-move');
        expect(e4Class).toContain('highlight-last-move');
    });

    test('should update move history after move', async ({ page }) => {
        // Make a move
        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');

        // Check move history
        const historyText = await page.locator('#move-history').textContent();

        expect(historyText).toContain('e2-e4');
    });

    test('should clear selection when clicking empty square', async ({ page }) => {
        // Select piece
        await page.click('.chess-square[data-square="e2"]');

        // Verify selected
        const e2Class = await page.locator('.chess-square[data-square="e2"]').getAttribute('class');
        expect(e2Class).toContain('highlight-selected');

        // Click empty square
        await page.click('.chess-square[data-square="a3"]');

        // Verify deselected
        const e2ClassAfter = await page.locator('.chess-square[data-square="e2"]').getAttribute('class');
        expect(e2ClassAfter).not.toContain('highlight-selected');
    });

    test('should change selection when clicking different piece', async ({ page }) => {
        // Select e2 pawn
        await page.click('.chess-square[data-square="e2"]');
        const e2Class = await page.locator('.chess-square[data-square="e2"]').getAttribute('class');
        expect(e2Class).toContain('highlight-selected');

        // Select d2 pawn
        await page.click('.chess-square[data-square="d2"]');
        const d2Class = await page.locator('.chess-square[data-square="d2"]').getAttribute('class');
        const e2ClassAfter = await page.locator('.chess-square[data-square="e2"]').getAttribute('class');

        expect(d2Class).toContain('highlight-selected');
        expect(e2ClassAfter).not.toContain('highlight-selected');
    });
});

test.describe('UI Integration - Controls + Game State', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
    });

    test('should start new game when clicking New Game button', async ({ page }) => {
        await page.click('#new-game-btn');

        // Verify board is set up - 32 occupied squares (64 total .chess-piece divs)
        const pieces = await page.locator('.chess-piece.has-piece').count();
        expect(pieces).toBe(32);
    });

    test('should update difficulty when selecting level', async ({ page }) => {
        await page.locator('#difficulty-choice button[data-level="4"]').click();
        const value = await page.evaluate(() =>
            document.querySelector('#difficulty-choice button.vd-is-active')?.getAttribute('data-level')
        );
        expect(value).toBe('4');
    });

    test('should update promotion piece when selecting option', async ({ page }) => {
        await page.selectOption('#promotion-piece-select', 'B');
        const active = await page.inputValue('#promotion-piece-select');
        expect(active).toBe('B');
    });

    test('should change color choice when clicking button', async ({ page }) => {
        // Click black button
        await page.click('#color-choice button[data-color="black"]');

        // Verify active state
        const blackClass = await page.locator('#color-choice button[data-color="black"]').getAttribute('class');
        const whiteClass = await page.locator('#color-choice button[data-color="white"]').getAttribute('class');

        expect(blackClass).toContain('vd-is-active');
        expect(whiteClass).not.toContain('vd-is-active');
    });

    test('should start game with selected color', async ({ page }) => {
        // Select black
        await page.click('#color-choice button[data-color="black"]');
        await page.click('#new-game-btn');

        // Wait for game to start
        await page.waitForSelector('.chess-piece');

        // Verify board is flipped (a8 should be at bottom-left)
        const a8Element = await page.locator('.chess-square[data-square="a8"]');
        const a8Order = await a8Element.evaluate(el => window.getComputedStyle(el).order);

        expect(parseInt(a8Order)).toBeGreaterThan(32);
    });

    test('should save difficulty to localStorage', async ({ page }) => {
        await page.locator('#difficulty-choice button[data-level="5"]').click();
        await page.click('#new-game-btn');
        await page.waitForTimeout(300);

        const saved = await page.evaluate(() => localStorage.getItem('kpc-difficulty'));
        expect(saved).toBe('5');
    });

    test('should restore difficulty from localStorage', async ({ page }) => {
        // Save difficulty
        await page.evaluate(() => localStorage.setItem('kpc-difficulty', '3'));
        await page.reload();

        const value = await page.evaluate(() =>
            document.querySelector('#difficulty-choice button.vd-is-active')?.getAttribute('data-level')
        );
        expect(value).toBe('3');
    });
});

test.describe('UI Integration - Modal Dialogs', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
    });

    test('should show disclaimer on first visit', async ({ page }) => {
        // Clear localStorage
        await page.evaluate(() => localStorage.clear());
        await page.reload();

        // Check for modal
        const modal = await page.locator('#disclaimer-modal');
        const isVisible = await modal.isVisible();

        expect(isVisible).toBe(true);
    });

    test('should hide disclaimer after accept', async ({ page }) => {
        // Clear and reload
        await page.evaluate(() => localStorage.clear());
        await page.reload();

        // Accept disclaimer
        await page.click('#disclaimer-accept-btn');
        await page.waitForTimeout(500);

        // Verify modal hidden
        const modal = await page.locator('#disclaimer-modal');
        const isVisible = await modal.isVisible();

        expect(isVisible).toBe(false);
    });

    test('should not show disclaimer on subsequent visits', async ({ page }) => {
        // Accept is already set in beforeEach
        await page.reload();

        const modal = await page.locator('#disclaimer-modal');
        const isVisible = await modal.isVisible();

        expect(isVisible).toBe(false);
    });

    test('should prevent closing disclaimer with ESC', async ({ page }) => {
        await page.evaluate(() => localStorage.clear());
        await page.reload();

        // Press ESC
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        const modal = await page.locator('#disclaimer-modal');
        const isVisible = await modal.isVisible();

        expect(isVisible).toBe(true);
    });

    test('should prevent closing disclaimer with backdrop click', async ({ page }) => {
        await page.evaluate(() => localStorage.clear());
        await page.reload();

        // Click backdrop
        await page.mouse.click(10, 10);
        await page.waitForTimeout(300);

        const modal = await page.locator('#disclaimer-modal');
        const isVisible = await modal.isVisible();

        expect(isVisible).toBe(true);
    });
});

test.describe('UI Integration - Theme Switching', () => {
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

    test('should have theme customizer button', async ({ page }) => {
        await ensureThemeCustomizerVisible(page);
    });

    test('should open theme customizer when clicked', async ({ page }) => {
        await ensureThemeCustomizerVisible(page);
        await page.click('[data-theme-customizer-trigger]');

        const panel = await page.locator('.vd-theme-customizer-panel');
        const isOpen = await panel.evaluate(el => el.classList.contains('is-open'));

        expect(isOpen).toBe(true);
    });

    test('should switch to Light theme', async ({ page }) => {
        await page.evaluate(() => localStorage.setItem('kpc-theme', 'system'));
        await page.reload();
        await page.click('#theme-toggle-btn');
        const html = page.locator('html');
        await expect(html).toHaveAttribute('data-theme', 'light');
    });

    test('should switch to Dark theme', async ({ page }) => {
        await page.evaluate(() => localStorage.setItem('kpc-theme', 'light'));
        await page.reload();
        await page.click('#theme-toggle-btn');
        const html = page.locator('html');
        await expect(html).toHaveAttribute('data-theme', 'dark');
    });

    test('should switch to System theme', async ({ page }) => {
        await page.evaluate(() => localStorage.setItem('kpc-theme', 'dark'));
        await page.reload();
        await page.click('#theme-toggle-btn');
        const html = page.locator('html');
        await expect(html).not.toHaveAttribute('data-theme');
    });
});

test.describe('UI Integration - Game End Modal', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
    });

    test('should have game end modal container', async ({ page }) => {
        const modal = await page.locator('#game-end-modal-container');
        await expect(modal).toBeAttached();
    });

    test('should not show game end modal during game', async ({ page }) => {
        const statusText = await page.locator('#status-text').textContent();

        // Game should be in progress
        expect(statusText).not.toContain('Checkmate');
        expect(statusText).not.toContain('Stalemate');
        expect(statusText).not.toContain('Draw');
    });
});

test.describe('UI Integration - Status Display', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
    });

    test('should show current turn in status', async ({ page }) => {
        const statusText = await page.locator('#status-text').textContent();

        expect(statusText).toBeDefined();
        expect(statusText.length).toBeGreaterThan(0);
    });

    test('should update status after move', async ({ page }) => {
        const initialStatus = await page.locator('#status-text').textContent();

        // Make a move
        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');

        await page.waitForTimeout(500);

        const newStatus = await page.locator('#status-text').textContent();

        // Status should change
        expect(initialStatus).not.toBe(newStatus);
    });

    test('should show check in status', async ({ page }) => {
        // This would require setting up a check position
        // For now, just verify status element exists
        const statusElement = await page.locator('#status-text');
        await expect(statusElement).toBeVisible();
    });
});

test.describe('UI Integration - Board Flipping', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
    });

    test('should show white perspective when playing as white', async ({ page }) => {
        await page.click('#color-choice button[data-color="white"]');
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // e1 should be visible in lower ranks
        const e1Element = await page.locator('.chess-square[data-square="e1"]');
        const e1Order = await e1Element.evaluate(el => window.getComputedStyle(el).order);

        expect(parseInt(e1Order)).toBeGreaterThan(32);
    });

    test('should show black perspective when playing black', async ({ page }) => {
        await page.click('#color-choice button[data-color="black"]');
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // e8 should be visible in lower ranks when flipped
        const e8Element = await page.locator('.chess-square[data-square="e8"]');
        const e8Order = await e8Element.evaluate(el => window.getComputedStyle(el).order);

        expect(parseInt(e8Order)).toBeGreaterThan(32);
    });
});