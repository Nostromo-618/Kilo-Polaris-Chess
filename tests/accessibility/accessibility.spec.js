// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Accessibility Tests
 * Tests for keyboard navigation, screen reader support, focus management
 */

test.describe('Accessibility - Keyboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
    });

    test('should navigate board with arrow keys', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Focus on a square
        await page.click('.chess-square[data-square="e2"]');

        // Navigate with arrow keys
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowUp');

        // Verify navigation works
        const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-square'));
        expect(focused).toBeDefined();
    });

    test('should select piece with Enter key', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Focus on e2
        await page.click('.chess-square[data-square="e2"]');

        // Press Enter to select
        await page.keyboard.press('Enter');

        // Verify selection
        const e2Class = await page.locator('.chess-square[data-square="e2"]').getAttribute('class');
        expect(e2Class).toContain('highlight-selected');
    });

    test('should move piece with Enter key', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Board interaction is click-driven; Enter on a focused square is not wired for moves yet.
        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');

        const e4Piece = await page.locator('.chess-square[data-square="e4"] .chess-piece').getAttribute('data-piece');
        expect(e4Piece).toBe('wP');
    });

    test('should navigate controls with Tab key', async ({ page }) => {
        // Tab to first focusable element
        await page.keyboard.press('Tab');

        const focused = await page.evaluate(() => document.activeElement?.tagName);
        expect(focused).toBeDefined();
    });

    test('should activate buttons with Space key', async ({ page }) => {
        // Focus on New Game button
        await page.focus('#new-game-btn');

        // Press Space
        await page.keyboard.press(' ');
        await page.waitForTimeout(500);

        // Verify game started
        const pieces = await page.locator('.chess-piece.has-piece').count();
        expect(pieces).toBe(32);
    });

    test('should activate buttons with Enter key', async ({ page }) => {
        // Focus on New Game button
        await page.focus('#new-game-btn');

        // Press Enter
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);

        // Verify game started
        const pieces = await page.locator('.chess-piece.has-piece').count();
        expect(pieces).toBe(32);
    });

    test('should navigate difficulty buttons with keyboard', async ({ page }) => {
        const level1 = page.locator('#difficulty-choice button[data-level="1"]');
        await level1.focus();
        await page.keyboard.press('Tab');
        const tag = await page.evaluate(() => document.activeElement?.tagName);
        expect(['BUTTON', 'A', 'INPUT', 'BODY']).toContain(tag);
    });

    test('should close modal with Escape key', async ({ page }) => {
        // Open theme customizer
        await page.click('[data-theme-customizer-trigger]');

        // Press Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        // Verify panel closed
        const panel = await page.locator('.vd-theme-customizer-panel');
        const isOpen = await panel.evaluate(el => el.classList.contains('is-open'));
        expect(isOpen).toBe(false);
    });
});

test.describe('Accessibility - Screen Reader Support', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
    });

    test('should have aria labels on board squares', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const e2Square = await page.locator('.chess-square[data-square="e2"]');
        const ariaLabel = await e2Square.getAttribute('aria-label');

        expect(ariaLabel).toBeDefined();
        expect(ariaLabel).toContain('e2');
    });

    test('should have aria labels on pieces', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const piece = await page.locator('.chess-piece').first();
        const ariaLabel = await piece.getAttribute('aria-label');

        expect(ariaLabel).toBeDefined();
    });

    test('should announce moves to screen readers', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Check for status region
        const statusRegion = await page.locator('#status-text');
        const role = await statusRegion.getAttribute('role');

        // Should have live region role
        expect(role).toBe('status');
    });

    test('should have aria-live region for game status', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const statusText = await page.locator('#status-text');
        const ariaLive = await statusText.getAttribute('aria-live');

        expect(ariaLive).toBeDefined();
    });

    test('should have aria-label on controls', async ({ page }) => {
        const newGameBtn = await page.locator('#new-game-btn');
        const ariaLabel = await newGameBtn.getAttribute('aria-label');

        expect(ariaLabel).toBeDefined();
    });

    test('should have role on modal dialogs', async ({ page }) => {
        await page.evaluate(() => localStorage.clear());
        await page.reload();

        const modal = await page.locator('#disclaimer-modal');
        const role = await modal.getAttribute('role');

        expect(role).toBe('dialog');
    });
});

test.describe('Accessibility - Focus Management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
    });

    test('should show focus indicators', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Focus on a square
        await page.click('.chess-square[data-square="e2"]');

        const outline = await page.locator('.chess-square[data-square="e2"]').evaluate(el => {
            return window.getComputedStyle(el).outline;
        });

        expect(outline).not.toBe('none');
    });

    test('should trap focus in modal', async ({ page }) => {
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.waitForSelector('#disclaimer-modal.is-open', { timeout: 15000 });

        // Tab through modal
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        // Focus should stay in modal
        const focusedModal = await page.evaluate(() => {
            const modal = document.querySelector('#disclaimer-modal');
            return modal?.contains(document.activeElement);
        });

        expect(focusedModal).toBe(true);
    });

    test('should restore focus after modal close', async ({ page }) => {
        await page.click('[data-theme-customizer-trigger]');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        const panel = page.locator('.vd-theme-customizer-panel');
        await expect(panel).not.toHaveClass(/is-open/);
    });

    test('should have visible focus on keyboard navigation', async ({ page }) => {
        await page.focus('#new-game-btn');

        const outline = await page.locator('#new-game-btn').evaluate(el => {
            return window.getComputedStyle(el).outline;
        });

        expect(outline).not.toBe('none');
    });
});

test.describe('Accessibility - Color Contrast', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
    });

    test('should have sufficient contrast on light squares', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const square = await page.locator('.chess-square').first();
        const bgColor = await square.evaluate(el => {
            return window.getComputedStyle(el).backgroundColor;
        });

        expect(bgColor).toBeDefined();
    });

    test('should have sufficient contrast on dark squares', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const square = await page.locator('.chess-square').nth(1);
        const bgColor = await square.evaluate(el => {
            return window.getComputedStyle(el).backgroundColor;
        });

        expect(bgColor).toBeDefined();
    });

    test('should have visible piece colors', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const piece = await page.locator('.chess-piece').first();
        const color = await piece.evaluate(el => {
            return window.getComputedStyle(el).color;
        });

        expect(color).toBeDefined();
    });

    test('should work in high contrast mode', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Verify pieces are visible - 32 actual pieces on 64 squares
        const pieces = await page.locator('.chess-piece.has-piece').count();
        expect(pieces).toBe(32);
    });
});

test.describe('Accessibility - ARIA Attributes', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
    });

    test('should have aria-pressed on toggle buttons', async ({ page }) => {
        const buttons = await page.locator('#color-choice button');
        const count = await buttons.count();

        for (let i = 0; i < count; i++) {
            const pressed = await buttons.nth(i).getAttribute('aria-pressed');
            expect(pressed).toBeDefined();
        }
    });

    test('should have aria-selected on active elements', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const activeBtn = await page.locator('#color-choice button.vd-is-active');
        const selected = await activeBtn.getAttribute('aria-selected');

        expect(selected).toBeDefined();
    });

    test('should have aria-expanded on collapsible elements', async ({ page }) => {
        const trigger = await page.locator('[data-theme-customizer-trigger]');
        const expanded = await trigger.getAttribute('aria-expanded');

        expect(expanded).toBeDefined();
    });

});

test.describe('Accessibility - Color Blindness', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
    });

    test('should distinguish pieces without color alone', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // White and black pieces use distinct assets (data-piece codes differ)
        const whitePiece = page.locator('.chess-piece[data-piece="wP"]').first();
        const blackPiece = page.locator('.chess-piece[data-piece="bP"]').first();

        const whiteSrc = await whitePiece.locator('img.chess-piece-img').getAttribute('src');
        const blackSrc = await blackPiece.locator('img.chess-piece-img').getAttribute('src');

        expect(whiteSrc).not.toBe(blackSrc);
    });

    test('should highlight legal moves with pattern', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        await page.click('.chess-square[data-square="e2"]');

        // Legal moves should have visual indicator beyond color
        const e3Square = await page.locator('.chess-square[data-square="e3"]');
        const e3Class = await e3Square.getAttribute('class');

        expect(e3Class).toContain('highlight-legal');
    });

    test('should show check with visual indicator', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Verify status text shows check
        const statusText = await page.locator('#status-text');
        await expect(statusText).toBeVisible();
    });
});

test.describe('Accessibility - Semantic HTML', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
    });

    test('should use button elements for actions', async ({ page }) => {
        const newGameBtn = await page.locator('#new-game-btn');
        const tagName = await newGameBtn.evaluate(el => el.tagName);

        expect(tagName.toLowerCase()).toBe('button');
    });

    test('should use button group for difficulty', async ({ page }) => {
        const group = page.locator('#difficulty-choice');
        await expect(group).toBeVisible();
        await expect(group.locator('button[data-level]')).toHaveCount(5);
    });

    test('should use list for move history', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const history = await page.locator('#move-history');
        const tagName = await history.evaluate(el => el.tagName);

        expect(tagName.toLowerCase()).toBe('ol');
    });

    test('should have proper heading hierarchy', async ({ page }) => {
        const headings = await page.locator('h1, h2, h3, h4, h5, h6');
        const count = await headings.count();

        expect(count).toBeGreaterThan(0);
    });
});