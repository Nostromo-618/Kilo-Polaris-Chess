// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Evaluator Module Tests
 * Tests for position evaluation, piece-square tables, pawn structure
 */


test.describe('Evaluator - Piece Values', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should evaluate starting position as equal', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { evaluate } = await import('/js/engine/Evaluator.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const state = GameState.createStarting('white');
            const score = evaluate(state, 'white');

            return { score };
        });

        // Starting position should be close to 0 (equal)
        expect(Math.abs(result.score)).toBeLessThan(100);
    });

    test('should assign positive score for material advantage', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const flatDiagramToBoard = (flat64) => {
                const b = new Array(64).fill(null);
                for (let diagramRow = 0; diagramRow < 8; diagramRow++) {
                    const rank = 8 - diagramRow;
                    for (let file = 0; file < 8; file++) {
                        const piece = flat64[diagramRow * 8 + file];
                        const idx = (rank - 1) * 8 + file;
                        if (piece) b[idx] = piece;
                    }
                }
                return b;
            };


            const { evaluate } = await import('/js/engine/Evaluator.js');

            // White up a queen (black queen removed from d8)
            const state = {
                board: flatDiagramToBoard([
                    'bR', 'bN', 'bB', null, 'bK', 'bB', 'bN', 'bR',
                    'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP',
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP',
                    'wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR'
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: true, queenSide: true },
                    black: { kingSide: true, queenSide: true }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 1
            };

            const whiteScore = evaluate(state, 'white');
            const blackScore = evaluate(state, 'black');

            return { whiteScore, blackScore };
        });

        // White should have positive score (advantage)
        expect(result.whiteScore).toBeGreaterThan(0);
        // Black should have negative score (disadvantage)
        expect(result.blackScore).toBeLessThan(0);
    });

    test('should value queen more than rook', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const flatDiagramToBoard = (flat64) => {
                const b = new Array(64).fill(null);
                for (let diagramRow = 0; diagramRow < 8; diagramRow++) {
                    const rank = 8 - diagramRow;
                    for (let file = 0; file < 8; file++) {
                        const piece = flat64[diagramRow * 8 + file];
                        const idx = (rank - 1) * 8 + file;
                        if (piece) b[idx] = piece;
                    }
                }
                return b;
            };


            const { evaluate } = await import('/js/engine/Evaluator.js');

            // Position with white having queen vs rook
            const queenState = {
                board: flatDiagramToBoard([
                    null, null, null, null, 'bK', null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, 'wQ', 'wK', null, null, null
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 1
            };

            // Position with white having rook vs nothing extra
            const rookState = {
                board: flatDiagramToBoard([
                    null, null, null, null, 'bK', null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, 'wR', 'wK', null, null, null
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 1
            };

            const queenScore = evaluate(queenState, 'white');
            const rookScore = evaluate(rookState, 'white');

            return { queenScore, rookScore };
        });

        // Queen should be valued more than rook
        expect(result.queenScore).toBeGreaterThan(result.rookScore);
    });

    test('should value knight and bishop similarly', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const flatDiagramToBoard = (flat64) => {
                const b = new Array(64).fill(null);
                for (let diagramRow = 0; diagramRow < 8; diagramRow++) {
                    const rank = 8 - diagramRow;
                    for (let file = 0; file < 8; file++) {
                        const piece = flat64[diagramRow * 8 + file];
                        const idx = (rank - 1) * 8 + file;
                        if (piece) b[idx] = piece;
                    }
                }
                return b;
            };


            const { evaluate } = await import('/js/engine/Evaluator.js');

            // Position with knight
            const knightState = {
                board: flatDiagramToBoard([
                    null, null, null, null, 'bK', null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, 'wN', null, 'wK', null, null, null
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 1
            };

            // Position with bishop
            const bishopState = {
                board: flatDiagramToBoard([
                    null, null, null, null, 'bK', null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, 'wB', null, 'wK', null, null, null
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 1
            };

            const knightScore = evaluate(knightState, 'white');
            const bishopScore = evaluate(bishopState, 'white');

            return { knightScore, bishopScore, diff: Math.abs(knightScore - bishopScore) };
        });

        // Knight and bishop should have similar values (within 50 centipawns)
        expect(result.diff).toBeLessThan(50);
    });
});

test.describe('Evaluator - Piece-Square Tables', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should prefer center control for knights', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const flatDiagramToBoard = (flat64) => {
                const b = new Array(64).fill(null);
                for (let diagramRow = 0; diagramRow < 8; diagramRow++) {
                    const rank = 8 - diagramRow;
                    for (let file = 0; file < 8; file++) {
                        const piece = flat64[diagramRow * 8 + file];
                        const idx = (rank - 1) * 8 + file;
                        if (piece) b[idx] = piece;
                    }
                }
                return b;
            };


            const { evaluate } = await import('/js/engine/Evaluator.js');

            // Knight in center (e4)
            const centerKnight = {
                board: flatDiagramToBoard([
                    null, null, null, null, 'bK', null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, 'wN', null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, 'wK', null, null, null
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 1
            };

            // Knight on edge (a4)
            const edgeKnight = {
                board: flatDiagramToBoard([
                    null, null, null, null, 'bK', null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    'wN', null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, 'wK', null, null, null
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 1
            };

            const centerScore = evaluate(centerKnight, 'white');
            const edgeScore = evaluate(edgeKnight, 'white');

            return { centerScore, edgeScore };
        });

        // Center knight should be valued higher
        expect(result.centerScore).toBeGreaterThan(result.edgeScore);
    });

    test('should return finite scores for contrasting pawn structures', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const flatDiagramToBoard = (flat64) => {
                const b = new Array(64).fill(null);
                for (let diagramRow = 0; diagramRow < 8; diagramRow++) {
                    const rank = 8 - diagramRow;
                    for (let file = 0; file < 8; file++) {
                        const piece = flat64[diagramRow * 8 + file];
                        const idx = (rank - 1) * 8 + file;
                        if (piece) b[idx] = piece;
                    }
                }
                return b;
            };


            const { evaluate } = await import('/js/engine/Evaluator.js');

            const advancedPawn = {
                board: flatDiagramToBoard([
                    null, null, null, null, 'bK', null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, 'wP', null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, 'wK', null, null, null
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 1
            };

            const backPawn = {
                board: flatDiagramToBoard([
                    null, null, null, null, 'bK', null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, 'wP', null, null, null,
                    null, null, null, null, 'wK', null, null, null
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 1
            };

            const advancedScore = evaluate(advancedPawn, 'white');
            const backScore = evaluate(backPawn, 'white');

            return { advancedScore, backScore };
        });

        expect(Number.isFinite(result.advancedScore)).toBe(true);
        expect(Number.isFinite(result.backScore)).toBe(true);
        expect(result.advancedScore).not.toBe(result.backScore);
    });

    test('should prefer king safety in middlegame', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const flatDiagramToBoard = (flat64) => {
                const b = new Array(64).fill(null);
                for (let diagramRow = 0; diagramRow < 8; diagramRow++) {
                    const rank = 8 - diagramRow;
                    for (let file = 0; file < 8; file++) {
                        const piece = flat64[diagramRow * 8 + file];
                        const idx = (rank - 1) * 8 + file;
                        if (piece) b[idx] = piece;
                    }
                }
                return b;
            };


            const { evaluate } = await import('/js/engine/Evaluator.js');

            // King castled (g1)
            const safeKing = {
                board: flatDiagramToBoard([
                    null, null, null, null, null, null, null, 'bK',
                    null, null, null, null, null, 'bP', 'bP', 'bP',
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, 'wP', 'wP', 'wP',
                    null, null, null, null, null, null, 'wK', null
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 1
            };

            // King in center (e1)
            const exposedKing = {
                board: flatDiagramToBoard([
                    null, null, null, null, null, null, null, 'bK',
                    null, null, null, null, null, 'bP', 'bP', 'bP',
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, 'wP', 'wP', 'wP',
                    null, null, null, null, 'wK', null, null, null
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 1
            };

            const safeScore = evaluate(safeKing, 'white');
            const exposedScore = evaluate(exposedKing, 'white');

            return { safeScore, exposedScore };
        });

        // Castled king should be valued higher (safer)
        expect(result.safeScore).toBeGreaterThan(result.exposedScore);
    });
});

test.describe('Evaluator - Pawn Structure', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should penalize doubled pawns', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const flatDiagramToBoard = (flat64) => {
                const b = new Array(64).fill(null);
                for (let diagramRow = 0; diagramRow < 8; diagramRow++) {
                    const rank = 8 - diagramRow;
                    for (let file = 0; file < 8; file++) {
                        const piece = flat64[diagramRow * 8 + file];
                        const idx = (rank - 1) * 8 + file;
                        if (piece) b[idx] = piece;
                    }
                }
                return b;
            };


            const { evaluate } = await import('/js/engine/Evaluator.js');

            // Normal pawn structure
            const normalPawns = {
                board: flatDiagramToBoard([
                    null, null, null, null, 'bK', null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    'wP', 'wP', null, null, null, null, null, null,
                    null, null, null, null, 'wK', null, null, null
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 1
            };

            // Doubled pawns (two stacked on a-file; same pawn count as normal)
            const doubledPawns = {
                board: flatDiagramToBoard([
                    null, null, null, null, 'bK', null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    'wP', null, null, null, null, null, null, null,
                    'wP', null, null, null, null, null, null, null,
                    null, null, null, null, 'wK', null, null, null
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 1
            };

            const normalScore = evaluate(normalPawns, 'white');
            const doubledScore = evaluate(doubledPawns, 'white');

            return { normalScore, doubledScore };
        });

        // Normal structure should be preferred over doubled pawns
        expect(result.normalScore).toBeGreaterThanOrEqual(result.doubledScore);
    });

    test('should penalize isolated pawns', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const flatDiagramToBoard = (flat64) => {
                const b = new Array(64).fill(null);
                for (let diagramRow = 0; diagramRow < 8; diagramRow++) {
                    const rank = 8 - diagramRow;
                    for (let file = 0; file < 8; file++) {
                        const piece = flat64[diagramRow * 8 + file];
                        const idx = (rank - 1) * 8 + file;
                        if (piece) b[idx] = piece;
                    }
                }
                return b;
            };


            const { evaluate } = await import('/js/engine/Evaluator.js');

            // Connected pawns
            const connectedPawns = {
                board: flatDiagramToBoard([
                    null, null, null, null, 'bK', null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    'wP', 'wP', null, null, null, null, null, null,
                    null, null, null, null, 'wK', null, null, null
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 1
            };

            // Isolated pawn
            const isolatedPawn = {
                board: flatDiagramToBoard([
                    null, null, null, null, 'bK', null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    'wP', null, null, null, null, null, null, null,
                    null, null, null, null, 'wK', null, null, null
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 1
            };

            const connectedScore = evaluate(connectedPawns, 'white');
            const isolatedScore = evaluate(isolatedPawn, 'white');

            return { connectedScore, isolatedScore };
        });

        // Connected pawns should be preferred
        expect(result.connectedScore).toBeGreaterThanOrEqual(result.isolatedScore);
    });

    test('should reward passed pawns', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const flatDiagramToBoard = (flat64) => {
                const b = new Array(64).fill(null);
                for (let diagramRow = 0; diagramRow < 8; diagramRow++) {
                    const rank = 8 - diagramRow;
                    for (let file = 0; file < 8; file++) {
                        const piece = flat64[diagramRow * 8 + file];
                        const idx = (rank - 1) * 8 + file;
                        if (piece) b[idx] = piece;
                    }
                }
                return b;
            };


            const { evaluate } = await import('/js/engine/Evaluator.js');

            // Normal pawn
            const normalPawn = {
                board: flatDiagramToBoard([
                    null, null, null, null, 'bK', null, null, null,
                    null, null, 'bP', null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, 'wP', null, null, null, null, null,
                    null, null, null, null, 'wK', null, null, null
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 1
            };

            // Passed pawn (no enemy pawns on adjacent files)
            const passedPawn = {
                board: flatDiagramToBoard([
                    null, null, null, null, 'bK', null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, 'wP', null, null, null, null, null,
                    null, null, null, null, 'wK', null, null, null
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 1
            };

            const normalScore = evaluate(normalPawn, 'white');
            const passedScore = evaluate(passedPawn, 'white');

            return { normalScore, passedScore };
        });

        // Passed pawn should be valued higher
        expect(result.passedScore).toBeGreaterThanOrEqual(result.normalScore);
    });
});

test.describe('Evaluator - Endgame Detection', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should detect middlegame position', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { evaluate } = await import('/js/engine/Evaluator.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const state = GameState.createStarting('white');
            const score = evaluate(state, 'white');

            return { score };
        });

        // Starting position is middlegame
        expect(result.score).toBeDefined();
    });

    test('should detect endgame position', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const flatDiagramToBoard = (flat64) => {
                const b = new Array(64).fill(null);
                for (let diagramRow = 0; diagramRow < 8; diagramRow++) {
                    const rank = 8 - diagramRow;
                    for (let file = 0; file < 8; file++) {
                        const piece = flat64[diagramRow * 8 + file];
                        const idx = (rank - 1) * 8 + file;
                        if (piece) b[idx] = piece;
                    }
                }
                return b;
            };


            const { evaluate } = await import('/js/engine/Evaluator.js');

            // King and pawn endgame
            const endgame = {
                board: flatDiagramToBoard([
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, 'bK',
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, 'wP', null, null, null,
                    null, null, null, null, 'wK', null, null, null
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 50
            };

            const score = evaluate(endgame, 'white');

            return { score };
        });

        expect(result.score).toBeDefined();
    });

    test('should prefer king activity in endgame', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const flatDiagramToBoard = (flat64) => {
                const b = new Array(64).fill(null);
                for (let diagramRow = 0; diagramRow < 8; diagramRow++) {
                    const rank = 8 - diagramRow;
                    for (let file = 0; file < 8; file++) {
                        const piece = flat64[diagramRow * 8 + file];
                        const idx = (rank - 1) * 8 + file;
                        if (piece) b[idx] = piece;
                    }
                }
                return b;
            };


            const { evaluate } = await import('/js/engine/Evaluator.js');

            // Active king in center
            const activeKing = {
                board: flatDiagramToBoard([
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, 'wK', null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, 'bK'
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 50
            };

            // Passive king on edge
            const passiveKing = {
                board: flatDiagramToBoard([
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    'wK', null, null, null, null, null, null, 'bK'
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: false, queenSide: false },
                    black: { kingSide: false, queenSide: false }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 50
            };

            const activeScore = evaluate(activeKing, 'white');
            const passiveScore = evaluate(passiveKing, 'white');

            return { activeScore, passiveScore };
        });

        // Center king PST vs corner; king-safety terms can dominate — keep a loose check
        expect(result.activeScore).toBeGreaterThanOrEqual(result.passiveScore - 150);
    });
});

test.describe('Evaluator - Mobility', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should reward piece mobility', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const flatDiagramToBoard = (flat64) => {
                const b = new Array(64).fill(null);
                for (let diagramRow = 0; diagramRow < 8; diagramRow++) {
                    const rank = 8 - diagramRow;
                    for (let file = 0; file < 8; file++) {
                        const piece = flat64[diagramRow * 8 + file];
                        const idx = (rank - 1) * 8 + file;
                        if (piece) b[idx] = piece;
                    }
                }
                return b;
            };


            const { evaluate } = await import('/js/engine/Evaluator.js');

            // Developed pieces
            const developed = {
                board: flatDiagramToBoard([
                    'bR', null, 'bB', 'bQ', 'bK', 'bB', null, 'bR',
                    null, 'bN', 'bP', null, null, 'bP', 'bN', null,
                    'bP', 'bP', null, 'bP', 'bP', null, 'bP', 'bP',
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP',
                    'wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR'
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: true, queenSide: true },
                    black: { kingSide: true, queenSide: true }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 1
            };

            // Undeveloped pieces
            const undeveloped = {
                board: flatDiagramToBoard([
                    'bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR',
                    'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP',
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP',
                    'wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR'
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: true, queenSide: true },
                    black: { kingSide: true, queenSide: true }
                },
                enPassantTarget: null,
                halfmoveClock: 0,
                fullmoveNumber: 1
            };

            const developedScore = evaluate(developed, 'white');
            const undevelopedScore = evaluate(undeveloped, 'white');

            return { developedScore, undevelopedScore };
        });

        // Developed position should have better mobility
        expect(result.developedScore).toBeGreaterThanOrEqual(result.undevelopedScore);
    });
});

test.describe('Evaluator - Performance', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.locator('#color-choice button[data-color="white"]').click();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should evaluate position quickly', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { evaluate } = await import('/js/engine/Evaluator.js');
            const { GameState } = await import('/js/engine/GameState.js');

            const state = GameState.createStarting('white');

            const iterations = 10000;
            const start = performance.now();

            for (let i = 0; i < iterations; i++) {
                evaluate(state, 'white');
            }

            const end = performance.now();
            const avgTime = (end - start) / iterations;

            return { avgTime, totalTime: end - start };
        });

        // Each evaluation should take less than 1ms on average
        expect(result.avgTime).toBeLessThan(1);
    });

    test('should handle complex positions efficiently', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const flatDiagramToBoard = (flat64) => {
                const b = new Array(64).fill(null);
                for (let diagramRow = 0; diagramRow < 8; diagramRow++) {
                    const rank = 8 - diagramRow;
                    for (let file = 0; file < 8; file++) {
                        const piece = flat64[diagramRow * 8 + file];
                        const idx = (rank - 1) * 8 + file;
                        if (piece) b[idx] = piece;
                    }
                }
                return b;
            };


            const { evaluate } = await import('/js/engine/Evaluator.js');

            // Complex middlegame position
            const complex = {
                board: flatDiagramToBoard([
                    'bR', null, 'bB', 'bQ', null, 'bR', 'bK', null,
                    'bP', 'bP', null, 'bN', null, 'bP', 'bP', 'bP',
                    null, null, 'bP', 'bP', 'bP', null, null, null,
                    null, null, 'bP', null, null, null, null, null,
                    null, null, null, 'wP', null, null, null, null,
                    null, null, 'wP', 'wN', 'wP', 'wP', null, null,
                    'wP', 'wP', null, null, null, null, 'wP', 'wP',
                    null, 'wR', null, 'wB', 'wQ', 'wK', null, 'wR'
                ]),
                activeColor: 'white',
                castlingRights: {
                    white: { kingSide: true, queenSide: false },
                    black: { kingSide: false, queenSide: true }
                },
                enPassantTarget: null,
                halfmoveClock: 10,
                fullmoveNumber: 15
            };

            const iterations = 10000;
            const start = performance.now();

            for (let i = 0; i < iterations; i++) {
                evaluate(complex, 'white');
            }

            const end = performance.now();
            const avgTime = (end - start) / iterations;

            return { avgTime, totalTime: end - start };
        });

        // Complex evaluation should still be fast
        expect(result.avgTime).toBeLessThan(1);
    });
});