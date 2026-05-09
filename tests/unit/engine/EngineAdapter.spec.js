// @ts-check
import { test, expect } from '@playwright/test';

test.describe('EngineAdapter', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
    });

    test('Aurora adapter should return a legal move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createEngineAdapter } = await import('/js/engineAdapter.js');
            const { GameState } = await import('/js/engine/GameState.js');
            const { generateLegalMoves } = await import('/js/engine/Rules.js');

            const state = GameState.createStarting('white');
            const adapter = createEngineAdapter('builtin', { useWorker: false });
            const move = await adapter.findBestMove(state, {
                difficulty: 2,
                movetime: 1000,
                forColor: 'white',
            });
            const legal = generateLegalMoves(state.asRulesState());
            const isLegal = legal.some((m) => m.from === move?.from && m.to === move?.to && m.promotion === move?.promotion);

            return { hasMove: move !== null, isLegal };
        });

        expect(result.hasMove).toBe(true);
        expect(result.isLegal).toBe(true);
    });

    test('Aurora adapter should honor an aborted signal before search', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createEngineAdapter } = await import('/js/engineAdapter.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const state = GameState.createStarting('white');
            const adapter = createEngineAdapter('builtin', { useWorker: false });
            const controller = new AbortController();
            controller.abort();
            const move = await adapter.findBestMove(state, {
                difficulty: 2,
                movetime: 1000,
                signal: controller.signal,
            });

            return { move };
        });

        expect(result.move).toBeNull();
    });

    test('should describe Aurora levels and Tomitank depth caps distinctly', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { getEngineStrengthLabel, getEngineStrengthControlLabel } = await import('/js/engineAdapter.js');
            return {
                auroraControl: getEngineStrengthControlLabel('builtin'),
                tomitankControl: getEngineStrengthControlLabel('tomitank'),
                auroraStrength: getEngineStrengthLabel('builtin', 4),
                tomitankStrength: getEngineStrengthLabel('tomitank', 4),
            };
        });

        expect(result).toEqual({
            auroraControl: 'Aurora strength',
            tomitankControl: 'Tomitank depth',
            auroraStrength: 'level 4',
            tomitankStrength: 'depth 10',
        });
    });
});
