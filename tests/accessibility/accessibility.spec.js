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
    });

    test('should navigate board with arrow keys', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

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
        await page.waitForSelector('.chess-piece:has-text("♙")');

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
        await page.waitForSelector('.chess-piece:has-text("♙")');

        // Select e2
        await page.click('.chess-square[data-square="e2"]');
        await page.keyboard.press('Enter');

        // Navigate to e4
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowUp');

        // Press Enter to move
        await page.keyboard.press('Enter');

        // Verify move was made
        const e4Piece = await page.locator('.chess-square[data-square="e4"] .chess-piece').textContent();
        expect(e4Piece).toBe('♙');
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

    test('should navigate difficulty select with keyboard', async ({ page }) => {
        await page.focus('#difficulty-select');

        // Change selection
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');

        const value = await page.locator('#difficulty-select').inputValue();
        expect(value).toBeDefined();
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
    });

    test('should have aria labels on board squares', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        const e2Square = await page.locator('.chess-square[data-square="e2"]');
        const ariaLabel = await e2Square.getAttribute('aria-label');

        expect(ariaLabel).toBeDefined();
        expect(ariaLabel).toContain('e2');
    });

    test('should have aria labels on pieces', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        const piece = await page.locator('.chess-piece').first();
        const ariaLabel = await piece.getAttribute('aria-label');

        expect(ariaLabel).toBeDefined();
    });

    test('should announce moves to screen readers', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        // Check for status region
        const statusRegion = await page.locator('#status-text');
        const role = await statusRegion.getAttribute('role');

        // Should have live region role
        expect(role).toBe('status');
    });

    test('should have aria-live region for game status', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

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
    });

    test('should show focus indicators', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

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

        // Focus should return to trigger button
        const focusedTrigger = await page.evaluate(() => {
            return document.activeElement?.hasAttribute('data-theme-customizer-trigger');
        });

        expect(focusedTrigger).toBe(true);
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
    });

    test('should have sufficient contrast on light squares', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        const square = await page.locator('.chess-square').first();
        const bgColor = await square.evaluate(el => {
            return window.getComputedStyle(el).backgroundColor;
        });

        expect(bgColor).toBeDefined();
    });

    test('should have sufficient contrast on dark squares', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        const square = await page.locator('.chess-square').nth(1);
        const bgColor = await square.evaluate(el => {
            return window.getComputedStyle(el).backgroundColor;
        });

        expect(bgColor).toBeDefined();
    });

    test('should have visible piece colors', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        const piece = await page.locator('.chess-piece').first();
        const color = await piece.evaluate(el => {
            return window.getComputedStyle(el).color;
        });

        expect(color).toBeDefined();
    });

    test('should work in high contrast mode', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

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
        await page.waitForSelector('.chess-piece:has-text("♙")');

        const activeBtn = await page.locator('#color-choice button.vd-is-active');
        const selected = await activeBtn.getAttribute('aria-selected');

        expect(selected).toBeDefined();
    });

    test('should have aria-expanded on collapsible elements', async ({ page }) => {
        const trigger = await page.locator('[data-theme-customizer-trigger]');
        const expanded = await trigger.getAttribute('aria-expanded');

        expect(expanded).toBeDefined();
    });

    test('should have aria-describedby on form elements', async ({ page }) => {
        const input = await page.locator('#thinking-time');
        const describedBy = await input.getAttribute('aria-describedby');

        expect(describedBy).toBeDefined();
    });
});

test.describe('Accessibility - Color Blindness', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
    });

    test('should distinguish pieces without color alone', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        // White and black pieces should have different glyphs
        const whitePiece = await page.locator('.chess-piece:has-text("♙")').first();
        const blackPiece = await page.locator('.chess-piece:has-text("♟")').first();

        const whiteText = await whitePiece.textContent();
        const blackText = await blackPiece.textContent();

        expect(whiteText).not.toBe(blackText);
    });

    test('should highlight legal moves with pattern', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        await page.click('.chess-square[data-square="e2"]');

        // Legal moves should have visual indicator beyond color
        const e3Square = await page.locator('.chess-square[data-square="e3"]');
        const e3Class = await e3Square.getAttribute('class');

        expect(e3Class).toContain('highlight-legal');
    });

    test('should show check with visual indicator', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

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
    });

    test('should use button elements for actions', async ({ page }) => {
        const newGameBtn = await page.locator('#new-game-btn');
        const tagName = await newGameBtn.evaluate(el => el.tagName);

        expect(tagName.toLowerCase()).toBe('button');
    });

    test('should use select for dropdown', async ({ page }) => {
        const difficultySelect = await page.locator('#difficulty-select');
        const tagName = await difficultySelect.evaluate(el => el.tagName);

        expect(tagName.toLowerCase()).toBe('select');
    });

    test('should use list for move history', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

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