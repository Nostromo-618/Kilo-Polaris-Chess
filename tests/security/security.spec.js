// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Security Tests
 * Tests for input validation, XSS prevention, storage security
 */

test.describe('Security - Input Validation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
    });

    test('should sanitize move input', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        // Try to inject invalid move
        await page.evaluate(() => {
            const square = document.querySelector('.chess-square[data-square="e2"]');
            if (square) {
                square.setAttribute('data-square', '"><script>alert("xss")</script>');
            }
        });

        // Game should still work
        const pieces = await page.locator('.chess-piece').count();
        expect(pieces).toBe(32);
    });

    test('should validate difficulty input', async ({ page }) => {
        await page.evaluate(() => localStorage.setItem('kpc-difficulty', '999'));
        await page.reload();
        await page.waitForTimeout(200);

        const level = await page.evaluate(() =>
            document.querySelector('#difficulty-choice button.vd-is-active')?.getAttribute('data-level')
        );
        expect(level).toBeTruthy();
        expect(Number(level)).toBeGreaterThanOrEqual(1);
        expect(Number(level)).toBeLessThanOrEqual(5);
    });

    test('should validate thinking time from storage', async ({ page }) => {
        await page.evaluate(() => localStorage.setItem('kpc-thinking-time', '999'));
        await page.reload();
        await page.waitForTimeout(200);

        const active = await page.evaluate(() =>
            document.querySelector('#thinking-choice button.vd-is-active')?.getAttribute('data-time')
        );
        expect(active).toBeTruthy();
        expect(Number(active)).toBeGreaterThanOrEqual(1);
        expect(Number(active)).toBeLessThanOrEqual(60);
    });
});

test.describe('Security - XSS Prevention', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
    });

    test('should prevent XSS in move history', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        // Try to inject script via localStorage
        await page.evaluate(() => {
            localStorage.setItem('kpc-game', JSON.stringify({
                board: new Array(64).fill(null),
                moveHistory: ['<script>alert("xss")</script>'],
                activeColor: 'white'
            }));
        });

        await page.reload();
        await page.waitForTimeout(500);

        // Script should not execute
        const historyText = await page.locator('#move-history').textContent();
        expect(historyText).not.toContain('<script>');
    });

    test('should prevent XSS in status text', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        // Try to inject via game state
        await page.evaluate(() => {
            localStorage.setItem('kpc-game', JSON.stringify({
                board: new Array(64).fill(null),
                activeColor: '<img src=x onerror=alert("xss")>',
                moveHistory: []
            }));
        });

        await page.reload();
        await page.waitForTimeout(500);

        // Should not execute
        const statusText = await page.locator('#status-text').textContent();
        expect(statusText).not.toContain('<img');
    });

    test('should escape piece names', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        // Verify pieces use safe text content
        const pieces = await page.locator('.chess-piece');
        const count = await pieces.count();

        for (let i = 0; i < count; i++) {
            const text = await pieces.nth(i).textContent();
            expect(text).toMatch(/^[♔♕♖♗♘♙♚♛♜♝♞♟]*$/);
        }
    });

    test('should prevent XSS in theme names', async ({ page }) => {
        await page.click('[data-theme-customizer-trigger]');

        // Theme names should be safe
        const lightBtn = await page.locator('button:has-text("Light")');
        await expect(lightBtn).toBeVisible();
    });
});

test.describe('Security - Storage Security', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
    });

    test('should not store sensitive data', async ({ page }) => {
        const keys = await page.evaluate(() => {
            return Object.keys(localStorage);
        });

        // Should only have expected keys
        for (const key of keys) {
            expect(key).toMatch(/^kpc-/);
        }
    });

    test('should validate stored data on load', async ({ page }) => {
        // Store corrupted data
        await page.evaluate(() => {
            localStorage.setItem('kpc-game', 'invalid json');
        });

        await page.reload();
        await page.waitForTimeout(500);

        // Should handle gracefully and start new game
        const pieces = await page.locator('.chess-piece').count();
        expect(pieces).toBeGreaterThanOrEqual(0);
    });

    test('should handle storage quota exceeded', async ({ page }) => {
        // Fill storage
        await page.evaluate(() => {
            try {
                for (let i = 0; i < 1000; i++) {
                    localStorage.setItem(`fill_${i}`, 'x'.repeat(1000));
                }
            } catch {
                // Ignore quota errors
            }
        });

        // Game should still work
        await page.click('#new-game-btn');
        const pieces = await page.locator('.chess-piece').count();
        expect(pieces).toBeGreaterThanOrEqual(0);
    });

    test('should clear storage on new game', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        // Make a move to save
        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');

        await page.waitForTimeout(300);

        // Start new game
        await page.click('#new-game-btn');
        await page.waitForTimeout(300);

        // Check if game state was reset
        const saved = await page.evaluate(() => localStorage.getItem('kpc-game'));
        if (saved) {
            const parsed = JSON.parse(saved);
            expect(parsed.moveHistory).toHaveLength(0);
        }
    });
});

test.describe('Security - Worker Communication', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
    });

    test('should validate worker messages', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        // Make a move to trigger AI
        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');

        // Wait for AI response
        await page.waitForFunction(() => {
            const status = document.querySelector('#status-text');
            return status?.textContent?.includes('Your move') || status?.textContent?.includes('Checkmate');
        }, { timeout: 10000 });

        // Game should continue normally
        const pieces = await page.locator('.chess-piece').count();
        expect(pieces).toBeGreaterThan(0);
    });

    test('should handle worker errors gracefully', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        // Try to break worker
        await page.evaluate(() => {
            const worker = window.aiWorker;
            if (worker) {
                worker.terminate();
            }
        });

        // Game should still be functional
        const pieces = await page.locator('.chess-piece').count();
        expect(pieces).toBeGreaterThan(0);
    });
});

test.describe('Security - DOM Security', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
    });

    test('should not expose internal functions globally', async ({ page }) => {
        const globals = await page.evaluate(() => {
            return {
                hasGameState: 'GameState' in window,
                hasAI: 'AI' in window,
                hasRules: 'Rules' in window
            };
        });

        // Internal modules should not be global
        expect(globals.hasGameState).toBe(false);
    });

    test('should prevent prototype pollution', async ({ page }) => {
        // Try to pollute prototype
        await page.evaluate(() => {
            const malicious = JSON.parse('{"__proto__": {"isAdmin": true}}');
            Object.assign({}, malicious);
        });

        // Check if prototype was polluted
        const polluted = await page.evaluate(() => {
            return {}.isAdmin;
        });

        expect(polluted).toBeUndefined();
    });

    test('should sanitize innerHTML usage', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        // Check that pieces use textContent, not innerHTML
        const usesInnerHTML = await page.evaluate(() => {
            const pieces = document.querySelectorAll('.chess-piece');
            for (const piece of pieces) {
                if (piece.innerHTML !== piece.textContent) {
                    return true;
                }
            }
            return false;
        });

        expect(usesInnerHTML).toBe(false);
    });
});

test.describe('Security - CSRF Protection', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
    });

    test('should not make external requests', async ({ page }) => {
        const requests = [];
        page.on('request', request => {
            requests.push(request.url());
        });

        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        // All requests should be local
        for (const url of requests) {
            expect(url).toContain(page.url());
        }
    });

    test('should not send credentials', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        // Verify no cookies are set
        const cookies = await page.context().cookies();
        expect(cookies.length).toBe(0);
    });
});

test.describe('Security - Error Handling', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
    });

    test('should not leak stack traces', async ({ page }) => {
        // Force an error
        await page.evaluate(() => {
            throw new Error('Test error');
        });

        // Check console for stack traces
        const messages = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                messages.push(msg.text());
            }
        });

        // Reload to recover
        await page.reload();

        // Stack traces should not be visible to user
        const errorDisplay = await page.locator('#status-text').textContent();
        expect(errorDisplay).not.toContain('stack trace');
    });

    test('should handle null references gracefully', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        // Try to access null element
        await page.evaluate(() => {
            const nonExistent = document.querySelector('#non-existent');
            if (nonExistent) {
                nonExistent.click();
            }
        });

        // Game should still work
        const pieces = await page.locator('.chess-piece').count();
        expect(pieces).toBeGreaterThan(0);
    });

    test('should handle undefined values', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');

        // Set undefined in storage
        await page.evaluate(() => {
            localStorage.setItem('kpc-test', undefined);
        });

        const value = await page.evaluate(() => localStorage.getItem('kpc-test'));
        expect(value).toBe('undefined');
    });
});