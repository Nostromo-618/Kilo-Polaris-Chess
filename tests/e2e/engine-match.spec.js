// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Engine Match Mode', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
    });

    async function configureMatch(page, whiteEngine, blackEngine) {
        await page.locator('#play-mode-choice button[data-mode="match"]').click();
        await page.locator(`#match-white-engine-choice button[data-engine="${whiteEngine}"]`).click();
        await page.locator(`#match-black-engine-choice button[data-engine="${blackEngine}"]`).click();
        await page.locator('#match-white-strength-choice button[data-level="1"]').click();
        await page.locator('#match-black-strength-choice button[data-level="1"]').click();
        await page.locator('#match-movetime-select').selectOption('500');
    }

    async function expectMatchCanRunPauseResumeStop(page) {
        await page.locator('#match-start-btn').click();
        await page.waitForSelector('.chess-piece[data-piece="wP"]');

        await expect.poll(async () => page.locator('#move-history li').count(), {
            timeout: 45000,
        }).toBeGreaterThanOrEqual(2);

        await page.locator('#match-pause-btn').click();
        await expect(page.locator('#match-pause-btn')).toHaveText('Resume', { timeout: 45000 });

        const pausedCount = await page.locator('#move-history li').count();
        await page.locator('#match-pause-btn').click();
        await expect.poll(async () => page.locator('#move-history li').count(), {
            timeout: 45000,
        }).toBeGreaterThan(pausedCount);

        await page.locator('#match-stop-btn').click();
        await expect(page.locator('#match-start-btn')).toBeEnabled();
    }

    test('Aurora vs Aurora should run as an engine match', async ({ page }) => {
        test.slow();
        await configureMatch(page, 'builtin', 'builtin');
        await expectMatchCanRunPauseResumeStop(page);
    });

    test('Aurora vs Tomitank should run as an engine match', async ({ page }) => {
        test.slow();
        await configureMatch(page, 'builtin', 'tomitank');
        await expectMatchCanRunPauseResumeStop(page);
    });

    test('Tomitank vs Tomitank should run as an engine match', async ({ page }) => {
        test.slow();
        await configureMatch(page, 'tomitank', 'tomitank');
        await expectMatchCanRunPauseResumeStop(page);
    });

    test('shows per-side match strength labels', async ({ page }) => {
        await page.locator('#play-mode-choice button[data-mode="match"]').click();
        await expect(page.locator('#difficulty-choice')).toBeHidden();

        await page.locator('#match-white-engine-choice button[data-engine="builtin"]').click();
        await page.locator('#match-black-engine-choice button[data-engine="tomitank"]').click();
        await expect(page.locator('#match-white-strength-label')).toContainText('White Aurora strength');
        await expect(page.locator('#match-black-strength-label')).toContainText('Black Tomitank depth');

        await page.locator('#match-white-engine-choice button[data-engine="tomitank"]').click();
        await page.locator('#match-black-engine-choice button[data-engine="builtin"]').click();
        await expect(page.locator('#match-white-strength-label')).toContainText('White Tomitank depth');
        await expect(page.locator('#match-black-strength-label')).toContainText('Black Aurora strength');
    });

    test('Aurora full-strength toggle maps to the builtin side and persists', async ({ page }) => {
        await page.locator('#play-mode-choice button[data-mode="match"]').click();
        await page.locator('#match-white-engine-choice button[data-engine="builtin"]').click();
        await page.locator('#match-black-engine-choice button[data-engine="tomitank"]').click();

        // Each engine gets its own full-strength switch when it plays a side.
        // The switch input is visually hidden by design (track/thumb CSS), so
        // visibility is asserted on the label text and state via isChecked().
        await expect(page.getByText('Tomitank full strength')).toBeVisible();
        await expect(page.getByText('Aurora full strength')).toBeVisible();

        await page.getByText('Aurora full strength').click();
        expect(await page.locator('#match-aurora-uncapped-choice').isChecked()).toBe(true);
        await expect(page.locator('.match-hint')).toContainText('Aurora searches to the full move time');

        const mapping = await page.evaluate(async () => {
            const { useGameStore } = await import('/src/composables/useGameStore.js');
            const store = useGameStore();
            const config = store.getMatchConfig();
            return {
                stored: localStorage.getItem('kpc-match-aurora-uncapped'),
                white: store.getMatchSideConfig(config, 'white'),
                black: store.getMatchSideConfig(config, 'black'),
            };
        });

        expect(mapping.stored).toBe('true');
        // The builtin side follows auroraUncapped; the Tomitank side still
        // follows its own (off) uncapped flag.
        expect(mapping.white.engineId).toBe('builtin');
        expect(mapping.white.uncapped).toBe(true);
        expect(mapping.black.engineId).toBe('tomitank');
        expect(mapping.black.uncapped).toBe(false);

        // Persisted across reloads.
        await page.reload();
        await page.locator('#play-mode-choice button[data-mode="match"]').click();
        expect(await page.locator('#match-aurora-uncapped-choice').isChecked()).toBe(true);
    });

    test('Aurora uncapped toggle is hidden when no side uses the builtin engine', async ({ page }) => {
        await page.locator('#play-mode-choice button[data-mode="match"]').click();
        await page.locator('#match-white-engine-choice button[data-engine="tomitank"]').click();
        await page.locator('#match-black-engine-choice button[data-engine="tomitank"]').click();

        await expect(page.getByText('Aurora full strength')).toBeHidden();
        await expect(page.getByText('Tomitank full strength')).toBeVisible();
    });
});
