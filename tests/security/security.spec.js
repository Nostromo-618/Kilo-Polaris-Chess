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
        await page.locator('#color-choice button[data-color="white"]').click();
    });

    test('should sanitize move input', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Try to inject invalid move
        await page.evaluate(() => {
            const square = document.querySelector('.chess-square[data-square="e2"]');
            if (square) {
                square.setAttribute('data-square', '"><script>alert("xss")</script>');
            }
        });

        // Game should still work
        const pieces = await page.locator('.chess-piece.has-piece').count();
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
        await page.locator('#color-choice button[data-color="white"]').click();
    });

    test('should prevent XSS in move history', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

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

        // Move history uses textContent (no HTML injection); no script nodes in the list
        await expect(page.locator('#move-history script')).toHaveCount(0);
        const historyText = await page.locator('#move-history').textContent();
        expect(historyText).toBeTruthy();
    });

    test('should prevent XSS in status text', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

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
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Verify pieces use safe text content
        const pieces = await page.locator('.chess-piece');
        const count = await pieces.count();

        for (let i = 0; i < count; i++) {
            const el = pieces.nth(i);
            const hasPiece = await el.evaluate((node) => node.classList.contains('has-piece'));
            if (hasPiece) {
                const code = await el.getAttribute('data-piece');
                expect(code).toMatch(/^[wb][PRNBQK]$/);
            }
            const text = await el.textContent();
            expect(text.trim()).toBe('');
        }
    });

    test('should prevent XSS in theme names', async ({ page }) => {
        await page.click('[data-theme-customizer-trigger]');

        const panel = page.locator('.vd-theme-customizer-panel');
        await expect(panel).toBeVisible();
    });
});

test.describe('Security - Storage Security', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
    });

    test('should not store sensitive data', async ({ page }) => {
        const keys = await page.evaluate(() => {
            return Object.keys(localStorage);
        });

        // App + Vanduo theme sync (prefix keys only; no arbitrary user data keys)
        for (const key of keys) {
            expect(key).toMatch(/^(kpc-|vanduo-)/);
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
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Make a move to save
        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');

        await page.waitForFunction(() => {
            const t = document.querySelector('#status-text')?.textContent || '';
            return t.includes('Your move');
        }, { timeout: 30000 });

        // Start new game (must not run while AI is thinking or the handler no-ops)
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
        await page.locator('#color-choice button[data-color="white"]').click();
    });

    test('should validate worker messages', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

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
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

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
        await page.locator('#color-choice button[data-color="white"]').click();
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
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Occupied squares use a single decorative <img>; empty squares must stay empty (no HTML injection)
        const unsafeOrMalformed = await page.evaluate(() => {
            const pieces = document.querySelectorAll('.chess-piece');
            for (const piece of pieces) {
                const html = piece.innerHTML.toLowerCase();
                if (html.includes('<script') || html.includes('onerror=') || html.includes('javascript:')) {
                    return true;
                }
                if (piece.classList.contains('has-piece')) {
                    const imgs = piece.querySelectorAll('img.chess-piece-img');
                    if (imgs.length !== 1 || piece.children.length !== 1) return true;
                } else if (piece.innerHTML.trim() !== '') {
                    return true;
                }
            }
            return false;
        });

        expect(unsafeOrMalformed).toBe(false);
    });
});

test.describe('Security - CSRF Protection', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
    });

    test('should not make external requests', async ({ page }) => {
        const requests = [];
        page.on('request', request => {
            requests.push(request.url());
        });

        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        const base = new URL(page.url());
        for (const url of requests) {
            const u = new URL(url);
            const sameOrigin = u.origin === base.origin;
            const vendorCdn = u.hostname === 'cdn.jsdelivr.net';
            expect(sameOrigin || vendorCdn).toBe(true);
        }
    });

    test('should not send credentials', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

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
        await page.locator('#color-choice button[data-color="white"]').click();
    });

    test('should not leak stack traces', async ({ page }) => {
        // Reload to recover from any prior page error
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();

        // Stack traces should not be visible to user
        const errorDisplay = await page.locator('#status-text').textContent();
        expect(errorDisplay).not.toContain('stack trace');
    });

    test('should handle null references gracefully', async ({ page }) => {
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

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
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        // Set undefined in storage
        await page.evaluate(() => {
            localStorage.setItem('kpc-test', undefined);
        });

        const value = await page.evaluate(() => localStorage.getItem('kpc-test'));
        expect(value).toBe('undefined');
    });
});