// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Storage Module Tests
 * Contract tests for every getter/setter in storage.js:
 * disclaimer, theme, color, engine, difficulty, game, boardSize.
 */

test.describe('Storage - Disclaimer', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
    });

    test('getDisclaimerAccepted returns false when unset', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            return s.getDisclaimerAccepted();
        });
        expect(result).toBe(false);
    });

    test('getDisclaimerAccepted returns true after setDisclaimerAccepted', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            s.setDisclaimerAccepted();
            return s.getDisclaimerAccepted();
        });
        expect(result).toBe(true);
    });
});

test.describe('Storage - Theme', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
    });

    test('getTheme defaults to "system" when unset', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            return s.getTheme();
        });
        expect(result).toBe('system');
    });

    test.describe('setTheme round-trips valid values', () => {
        for (const theme of ['light', 'dark', 'system']) {
            test(`setTheme("${theme}")`, async ({ page }) => {
                const result = await page.evaluate(async (t) => {
                    const s = await import('/js/storage.js');
                    s.setTheme(t);
                    return s.getTheme();
                }, theme);
                expect(result).toBe(theme);
            });
        }
    });

    test('setTheme clamps invalid value to "system"', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            s.setTheme('invalid');
            return s.getTheme();
        });
        expect(result).toBe('system');
    });

    test('getTheme returns "system" for corrupt stored value', async ({ page }) => {
        const result = await page.evaluate(async () => {
            localStorage.setItem('kpc-theme', 'neon');
            const s = await import('/js/storage.js');
            return s.getTheme();
        });
        expect(result).toBe('system');
    });

    test('setTheme syncs vanduo-theme-preference key', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            s.setTheme('dark');
            return localStorage.getItem('vanduo-theme-preference');
        });
        expect(result).toBe('dark');
    });
});

test.describe('Storage - Color Choice', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
    });

    test('getColorChoice returns null when unset', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            return s.getColorChoice();
        });
        expect(result).toBeNull();
    });

    test.describe('setColorChoice round-trips valid values', () => {
        for (const color of ['white', 'black', 'random']) {
            test(`setColorChoice("${color}")`, async ({ page }) => {
                const result = await page.evaluate(async (c) => {
                    const s = await import('/js/storage.js');
                    s.setColorChoice(c);
                    return s.getColorChoice();
                }, color);
                expect(result).toBe(color);
            });
        }
    });

    test('setColorChoice ignores invalid value', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            s.setColorChoice('purple');
            return s.getColorChoice();
        });
        expect(result).toBeNull();
    });
});

test.describe('Storage - Engine', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
    });

    test('getEngine returns null when unset', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            return s.getEngine();
        });
        expect(result).toBeNull();
    });

    test.describe('setEngine round-trips valid values', () => {
        for (const engine of ['builtin', 'tomitank']) {
            test(`setEngine("${engine}")`, async ({ page }) => {
                const result = await page.evaluate(async (e) => {
                    const s = await import('/js/storage.js');
                    s.setEngine(e);
                    return s.getEngine();
                }, engine);
                expect(result).toBe(engine);
            });
        }
    });

    test('setEngine ignores invalid value', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            s.setEngine('stockfish');
            return s.getEngine();
        });
        expect(result).toBeNull();
    });

    test('getEngine returns null for corrupt stored value', async ({ page }) => {
        const result = await page.evaluate(async () => {
            localStorage.setItem('kpc-engine', 'stockfish');
            const s = await import('/js/storage.js');
            return s.getEngine();
        });
        expect(result).toBeNull();
    });
});

test.describe('Storage - Difficulty', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
    });

    test('getDifficulty returns null when unset', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            return s.getDifficulty();
        });
        expect(result).toBeNull();
    });

    test.describe('setDifficulty round-trips valid levels', () => {
        for (const level of [1, 2, 3, 4, 5, 6]) {
            test(`setDifficulty(${level})`, async ({ page }) => {
                const result = await page.evaluate(async (l) => {
                    const s = await import('/js/storage.js');
                    s.setDifficulty(l);
                    return s.getDifficulty();
                }, level);
                expect(result).toBe(level);
            });
        }
    });

    test('setDifficulty treats 0 as falsy and defaults to 6', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            s.setDifficulty(0);
            return s.getDifficulty();
        });
        // 0 is falsy so `Number(0) || 6` → 6
        expect(result).toBe(6);
    });

    test('setDifficulty clamps values above 6 to 6', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            s.setDifficulty(999);
            return s.getDifficulty();
        });
        expect(result).toBe(6);
    });

    test('setDifficulty defaults NaN to 6', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            s.setDifficulty(NaN);
            return s.getDifficulty();
        });
        expect(result).toBe(6);
    });

    test('getDifficulty returns null for non-numeric stored value', async ({ page }) => {
        const result = await page.evaluate(async () => {
            localStorage.setItem('kpc-difficulty', 'abc');
            const s = await import('/js/storage.js');
            return s.getDifficulty();
        });
        expect(result).toBeNull();
    });

    test('getDifficulty returns null for out-of-range stored value', async ({ page }) => {
        const result = await page.evaluate(async () => {
            localStorage.setItem('kpc-difficulty', '999');
            const s = await import('/js/storage.js');
            return s.getDifficulty();
        });
        expect(result).toBeNull();
    });
});

test.describe('Storage - Match Strength', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
    });

    test('match strengths default to level 3', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            return {
                white: s.getMatchWhiteStrength(),
                black: s.getMatchBlackStrength(),
            };
        });
        expect(result).toEqual({ white: 3, black: 3 });
    });

    test('match strengths round-trip valid levels independently', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            s.setMatchWhiteStrength(2);
            s.setMatchBlackStrength(5);
            return {
                white: s.getMatchWhiteStrength(),
                black: s.getMatchBlackStrength(),
            };
        });
        expect(result).toEqual({ white: 2, black: 5 });
    });

    test('match strengths clamp invalid values', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            s.setMatchWhiteStrength(99);
            s.setMatchBlackStrength(-5);
            return {
                white: s.getMatchWhiteStrength(),
                black: s.getMatchBlackStrength(),
            };
        });
        expect(result).toEqual({ white: 6, black: 1 });
    });
});

test.describe('Storage - Game', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
    });

    test('getGame returns null when unset', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            return s.getGame();
        });
        expect(result).toBeNull();
    });

    test('setGame + getGame round-trips valid state', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            const state = { board: new Array(64).fill(null), activeColor: 'white', moveHistory: [] };
            s.setGame(state);
            return s.getGame();
        });
        expect(result).toHaveProperty('board');
        expect(result).toHaveProperty('activeColor', 'white');
    });

    test('getGame returns null for invalid JSON', async ({ page }) => {
        const result = await page.evaluate(async () => {
            localStorage.setItem('kpc-game', 'not json');
            const s = await import('/js/storage.js');
            return s.getGame();
        });
        expect(result).toBeNull();
    });

    test('getGame returns null for object missing board', async ({ page }) => {
        const result = await page.evaluate(async () => {
            localStorage.setItem('kpc-game', JSON.stringify({ activeColor: 'white' }));
            const s = await import('/js/storage.js');
            return s.getGame();
        });
        expect(result).toBeNull();
    });

    test('getGame returns null for object missing activeColor', async ({ page }) => {
        const result = await page.evaluate(async () => {
            localStorage.setItem('kpc-game', JSON.stringify({ board: [] }));
            const s = await import('/js/storage.js');
            return s.getGame();
        });
        expect(result).toBeNull();
    });

    test('clearGame removes saved game', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            s.setGame({ board: new Array(64).fill(null), activeColor: 'white' });
            s.clearGame();
            return s.getGame();
        });
        expect(result).toBeNull();
    });

    test('setGame ignores falsy input', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            s.setGame(null);
            return localStorage.getItem('kpc-game');
        });
        expect(result).toBeNull();
    });
});

test.describe('Storage - Board Size', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
    });

    test('getBoardSize returns null when unset', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            return s.getBoardSize();
        });
        expect(result).toBeNull();
    });

    test('setBoardSize + getBoardSize round-trips valid value', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            s.setBoardSize(75);
            return s.getBoardSize();
        });
        expect(result).toBe(75);
    });

    test('setBoardSize clamps below 0 to 0', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            s.setBoardSize(-10);
            return s.getBoardSize();
        });
        expect(result).toBe(0);
    });

    test('setBoardSize clamps above 100 to 100', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const s = await import('/js/storage.js');
            s.setBoardSize(200);
            return s.getBoardSize();
        });
        expect(result).toBe(100);
    });

    test('getBoardSize returns null for non-numeric stored value', async ({ page }) => {
        const result = await page.evaluate(async () => {
            localStorage.setItem('kpc-board-size', 'big');
            const s = await import('/js/storage.js');
            return s.getBoardSize();
        });
        expect(result).toBeNull();
    });

    test('getBoardSize rounds stored float', async ({ page }) => {
        const result = await page.evaluate(async () => {
            localStorage.setItem('kpc-board-size', '50.7');
            const s = await import('/js/storage.js');
            return s.getBoardSize();
        });
        expect(result).toBe(51);
    });
});
