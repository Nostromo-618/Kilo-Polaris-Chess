// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Disclaimer Modal + LocalStorage Persistence Tests
 *
 * These tests verify:
 *  1. Disclaimer shows on first visit
 *  2. Disclaimer is mandatory (backdrop / ESC don't close it)
 *  3. Accept persists to localStorage and hides the modal
 *  4. Disclaimer doesn't show on subsequent visits
 *  5. Difficulty persists across reloads
 *  6. Game progress saves and restores
 *  7. New Game clears saved progress
 */

// Helper: open page with clean localStorage (first visit)
async function freshPage(page) {
    // Clear storage before navigation to simulate first visit
    await page.context().clearCookies();
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
}

// Helper: open page with disclaimer already accepted
async function acceptedPage(page) {
    await page.goto('/');
    await page.evaluate(() => {
        localStorage.setItem('kpc-disclaimer-accepted', 'true');
    });
    await page.reload();
}

test.describe('Disclaimer Modal', () => {
    test('shows on first visit', async ({ page }) => {
        await freshPage(page);

        const modal = page.locator('#disclaimer-modal');
        await expect(modal).toBeVisible();
        await expect(modal).toHaveClass(/is-open/);
    });

    test('displays title and accept button', async ({ page }) => {
        await freshPage(page);

        await expect(page.locator('#disclaimer-modal-title')).toContainText('Aurora Polaris Chess');
        await expect(page.locator('#disclaimer-accept-btn')).toBeVisible();
    });

    test('cannot be closed with ESC key', async ({ page }) => {
        await freshPage(page);

        await page.keyboard.press('Escape');
        // Small wait for any animation
        await page.waitForTimeout(300);

        const modal = page.locator('#disclaimer-modal');
        await expect(modal).toHaveClass(/is-open/);
    });

    test('cannot be closed by clicking the backdrop', async ({ page }) => {
        await freshPage(page);

        // Click outside the dialog (the backdrop area)
        await page.mouse.click(10, 10);
        await page.waitForTimeout(300);

        const modal = page.locator('#disclaimer-modal');
        await expect(modal).toHaveClass(/is-open/);
    });

    test('Accept button closes modal and sets localStorage', async ({ page }) => {
        await freshPage(page);

        await page.click('#disclaimer-accept-btn');
        await page.waitForTimeout(400);

        // Modal should be hidden
        const modal = page.locator('#disclaimer-modal');
        await expect(modal).not.toHaveClass(/is-open/);

        // localStorage should be set
        const accepted = await page.evaluate(() => localStorage.getItem('kpc-disclaimer-accepted'));
        expect(accepted).toBe('true');
    });

    test('does NOT show on subsequent visits', async ({ page }) => {
        await acceptedPage(page);

        // Wait for app to finish loading
        await page.waitForTimeout(500);

        const modal = page.locator('#disclaimer-modal');
        // Modal element may or may not exist; if it does it must not be open
        const exists = await modal.count();
        if (exists > 0) {
            await expect(modal).not.toHaveClass(/is-open/);
        }
    });
});

test.describe('LocalStorage: Difficulty Persistence', () => {
    test('saves selected difficulty to localStorage', async ({ page }) => {
        await acceptedPage(page);

        // Select difficulty 4
        await page.locator('#difficulty-choice button[data-level="4"]').click();
        // Trigger a new game to persist
        await page.click('#new-game-btn');
        await page.waitForTimeout(300);

        const saved = await page.evaluate(() => localStorage.getItem('kpc-difficulty'));
        expect(saved).toBe('4');
    });

    test('restores saved difficulty on page reload', async ({ page }) => {
        await acceptedPage(page);

        // Save a difficulty value directly
        await page.evaluate(() => localStorage.setItem('kpc-difficulty', '5'));
        await page.reload();
        await page.waitForTimeout(500);

        const activeLevel = await page.evaluate(() =>
            document.querySelector('#difficulty-choice button.vd-is-active')?.getAttribute('data-level')
        );
        expect(activeLevel).toBe('5');
    });
});

test.describe('LocalStorage: Game Progress', () => {
    test('saves game state to localStorage after starting a game', async ({ page }) => {
        await acceptedPage(page);

        await page.locator('#color-choice button[data-color="white"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');
        await page.waitForTimeout(500);

        const saved = await page.evaluate(() => localStorage.getItem('kpc-game'));
        expect(saved).not.toBeNull();

        const parsed = JSON.parse(saved);
        expect(parsed).toHaveProperty('board');
        expect(parsed).toHaveProperty('activeColor');
    });

    test('restores saved game on reload', async ({ page }) => {
        await acceptedPage(page);

        await page.locator('#color-choice button[data-color="white"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');
        await page.waitForTimeout(600);

        // Reload and verify board is present
        await page.reload();
        await page.waitForTimeout(600);

        // Chess board should be rendered (pieces visible)
        const pieces = page.locator('.chess-piece');
        await expect(pieces.first()).toBeVisible();
    });

    test('New Game clears saved game from localStorage', async ({ page }) => {
        await acceptedPage(page);

        await page.locator('#color-choice button[data-color="white"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
        await page.click('.chess-square[data-square="e2"]');
        await page.click('.chess-square[data-square="e4"]');
        await page.waitForFunction(() => {
            const t = document.querySelector('#status-text')?.textContent || '';
            return t.includes('Your move');
        }, { timeout: 30000 });

        // Start another new game — should clear and re-save
        await page.click('#new-game-btn');
        await page.waitForTimeout(500);

        // After new game, a fresh game state should be in storage
        const saved = await page.evaluate(() => localStorage.getItem('kpc-game'));
        // Could be null (cleared) or a new state — but the move history should be empty
        if (saved) {
            const parsed = JSON.parse(saved);
            expect(parsed.moveHistory).toHaveLength(0);
        }
    });

    test('completed game clears saved progress', async ({ page }) => {
        await acceptedPage(page);

        // Simulate a game over by injecting a terminal state into localStorage
        const terminalState = {
            board: new Array(64).fill(null),
            activeColor: 'white',
            playerColor: 'white',
            castlingRights: { white: { kingSide: false, queenSide: false }, black: { kingSide: false, queenSide: false } },
            enPassantTarget: null,
            halfmoveClock: 0,
            fullmoveNumber: 1,
            moveHistory: [],
            result: { outcome: 'checkmate', winner: 'black' },
            lastMove: null,
            repetitionMap: []
        };
        await page.evaluate((state) => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
            localStorage.setItem('kpc-game', JSON.stringify(state));
        }, terminalState);

        await page.reload();
        await page.waitForTimeout(600);

        // The game is over — storage should have been cleared
        const saved = await page.evaluate(() => localStorage.getItem('kpc-game'));
        expect(saved).toBeNull();
    });
});
