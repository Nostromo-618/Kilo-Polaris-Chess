// @ts-check
import { test, expect } from '@playwright/test';
import { GameState } from '../../../js/engine/GameState.js';
import { generateLegalMoves } from '../../../js/engine/Rules.js';
import { AI } from '../../../js/engine/AI.js';

/**
 * Aurora Polaris v2.1.3 release baseline.
 *
 * This is intentionally small and hand-authored: it guards fixed tactical
 * positions, timeout fallback behavior, and short self-play without importing
 * external puzzle packs or engine data.
 */
test.describe('Aurora Polaris - v2.1.3 Baseline Gate', () => {
    test('beats the v2.1.2 tactical baseline on fixed positions', async () => {
        const V2_1_2_BASELINE = {
            tacticalHits: 2,
        };

        const positions = [
            {
                name: 'white wins a loose queen',
                activeColor: 'white',
                pieces: { g1: 'wK', d1: 'wQ', g8: 'bK', d8: 'bQ' },
                expected: ['d1-d8'],
            },
            {
                name: 'white promotes decisively',
                activeColor: 'white',
                pieces: { a1: 'wK', e7: 'wP', h8: 'bK' },
                expected: ['e7-e8Q'],
            },
            {
                name: 'black wins a loose rook',
                activeColor: 'black',
                pieces: { g8: 'bK', d8: 'bQ', g1: 'wK', d1: 'wR' },
                expected: ['d8-d1'],
            },
        ];

        const attempts = [];
        for (const position of positions) {
            const ai = new AI();
            const state = createState(position);
            const move = await ai.findBestMove(state, {
                level: 6,
                forColor: position.activeColor,
                timeout: 1200,
            });
            const id = moveId(move);
            attempts.push({
                name: position.name,
                move: id,
                hit: position.expected.includes(id),
                info: ai.getLastSearchInfo(),
            });
        }

        const result = {
            baseline: V2_1_2_BASELINE,
            attempts,
            hits: attempts.filter((attempt) => attempt.hit).length,
        };

        expect(result.attempts, JSON.stringify(result.attempts, null, 2))
            .toHaveLength(3);
        expect(result.hits, JSON.stringify(result.attempts, null, 2))
            .toBeGreaterThan(result.baseline.tacticalHits);
    });

    test('returns promptly under timeout pressure', async () => {
        const state = GameState.createStarting('white');
        const ai = new AI();
        const startedAt = performance.now();
        const move = await ai.findBestMove(state, {
            level: 6,
            forColor: 'white',
            timeout: 5,
        });
        const elapsed = performance.now() - startedAt;
        const legalMoves = generateLegalMoves(state.asRulesState());
        const legal = isLegalMove(move, legalMoves);

        const result = {
            elapsed,
            legal,
            hasMove: !!move,
            info: ai.getLastSearchInfo(),
        };

        expect(result.elapsed).toBeLessThan(750);
        expect(result.legal).toBe(true);
        expect(result.info).toHaveProperty('timedOut');
    });

    test('plays a short Aurora self-play line using only legal moves', async () => {
        const state = GameState.createStarting('white');
        const ai = new AI();

        for (let ply = 0; ply < 8; ply += 1) {
            const legalMoves = generateLegalMoves(state.asRulesState());
            if (legalMoves.length === 0) break;

            const move = await ai.findBestMove(state, {
                level: 2,
                forColor: state.activeColor,
                timeout: 250,
            });

            const legal = !!move && isLegalMove(move, legalMoves);
            expect(legal, JSON.stringify({
                ok: false,
                ply,
                move: moveId(move),
                history: state.moveHistory.slice(),
            }, null, 2)).toBe(true);

            state.applyMove(move);
            if (state.isGameOver()) break;
        }

        const result = {
            ok: true,
            plies: state.moveHistory.length,
            history: state.moveHistory.slice(),
        };
        expect(result.plies, JSON.stringify(result, null, 2)).toBe(8);
    });
});

function indexOf(square) {
    return (square.charCodeAt(0) - 97) + ((Number(square[1]) - 1) * 8);
}

function createState({ pieces, activeColor }) {
    const board = new Array(64).fill(null);
    for (const [square, piece] of Object.entries(pieces)) {
        board[indexOf(square)] = piece;
    }

    return new GameState({
        board,
        activeColor,
        playerColor: activeColor,
        castlingRights: {
            white: { kingSide: false, queenSide: false },
            black: { kingSide: false, queenSide: false },
        },
        enPassantTarget: null,
        halfmoveClock: 0,
        fullmoveNumber: 1,
        moveHistory: [],
    });
}

function moveId(move) {
    return move ? `${move.from}-${move.to}${move.promotion || ''}` : null;
}

function isLegalMove(move, legalMoves) {
    return !move || legalMoves.some((candidate) =>
        candidate.from === move.from &&
        candidate.to === move.to &&
        (candidate.promotion || null) === (move.promotion || null)
    );
}
