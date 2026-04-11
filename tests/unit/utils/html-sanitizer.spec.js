// @ts-check
import { test, expect } from '@playwright/test';

/**
 * HTML Sanitizer Tests
 * Tests for escapeHtml and sanitizeMoveHistory.
 */

test.describe('HTML Sanitizer - escapeHtml', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
    });

    test('should escape angle brackets', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { escapeHtml } = await import('/js/utils/html-sanitizer.js');
            return escapeHtml('<script>alert("xss")</script>');
        });

        expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    test('should escape ampersand', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { escapeHtml } = await import('/js/utils/html-sanitizer.js');
            return escapeHtml('a & b');
        });

        expect(result).toBe('a &amp; b');
    });

    test('should escape quotes', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { escapeHtml } = await import('/js/utils/html-sanitizer.js');
            return escapeHtml('"hello" & \'world\'');
        });

        expect(result).toBe('&quot;hello&quot; &amp; &#39;world&#39;');
    });

    test('should return empty string for null', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { escapeHtml } = await import('/js/utils/html-sanitizer.js');
            return escapeHtml(null);
        });

        expect(result).toBe('');
    });

    test('should return empty string for undefined', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { escapeHtml } = await import('/js/utils/html-sanitizer.js');
            return escapeHtml(undefined);
        });

        expect(result).toBe('');
    });

    test('should pass through safe strings unchanged', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { escapeHtml } = await import('/js/utils/html-sanitizer.js');
            return escapeHtml('e2-e4');
        });

        expect(result).toBe('e2-e4');
    });

    test('should convert numbers to string', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { escapeHtml } = await import('/js/utils/html-sanitizer.js');
            return escapeHtml(42);
        });

        expect(result).toBe('42');
    });
});

test.describe('HTML Sanitizer - sanitizeMoveHistory', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
    });

    test('should sanitize all entries in array', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { sanitizeMoveHistory } = await import('/js/utils/html-sanitizer.js');
            return sanitizeMoveHistory(['e2-e4', '<b>Nf3</b>', 'O-O']);
        });

        expect(result).toEqual(['e2-e4', '&lt;b&gt;Nf3&lt;/b&gt;', 'O-O']);
    });

    test('should return empty array for non-array input', async ({ page }) => {
        const results = await page.evaluate(async () => {
            const { sanitizeMoveHistory } = await import('/js/utils/html-sanitizer.js');
            return [
                sanitizeMoveHistory(null),
                sanitizeMoveHistory(undefined),
                sanitizeMoveHistory('not an array'),
                sanitizeMoveHistory(42),
            ];
        });

        for (const r of results) {
            expect(r).toEqual([]);
        }
    });

    test('should handle entries with null values', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { sanitizeMoveHistory } = await import('/js/utils/html-sanitizer.js');
            return sanitizeMoveHistory([null, undefined, 'e4']);
        });

        expect(result).toEqual(['null', 'undefined', 'e4']);
    });

    test('should handle empty array', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { sanitizeMoveHistory } = await import('/js/utils/html-sanitizer.js');
            return sanitizeMoveHistory([]);
        });

        expect(result).toEqual([]);
    });
});
