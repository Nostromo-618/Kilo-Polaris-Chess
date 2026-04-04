// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Move Module Tests
 * Tests for move creation, promotion, castling, en passant
 */

test.describe('Move - Basic Move Creation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should create a basic move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createMove } = await import('/js/engine/Move.js');
            const move = createMove('e2', 'e4', 'wP');
            return move;
        });

        expect(result.from).toBe('e2');
        expect(result.to).toBe('e4');
        expect(result.piece).toBe('wP');
        expect(result.captured).toBeNull();
    });

    test('should create a move with capture', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createMove } = await import('/js/engine/Move.js');
            const move = createMove('e4', 'd5', 'wP', 'bP');
            return move;
        });

        expect(result.from).toBe('e4');
        expect(result.to).toBe('d5');
        expect(result.piece).toBe('wP');
        expect(result.captured).toBe('bP');
    });

    test('should create a move with null capture', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createMove } = await import('/js/engine/Move.js');
            const move = createMove('e2', 'e4', 'wP', null);
            return move;
        });

        expect(result.from).toBe('e2');
        expect(result.to).toBe('e4');
        expect(result.piece).toBe('wP');
        expect(result.captured).toBeNull();
    });

    test('should create knight move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createMove } = await import('/js/engine/Move.js');
            const move = createMove('g1', 'f3', 'wN');
            return move;
        });

        expect(result.from).toBe('g1');
        expect(result.to).toBe('f3');
        expect(result.piece).toBe('wN');
        expect(result.captured).toBeNull();
    });

    test('should create bishop move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createMove } = await import('/js/engine/Move.js');
            const move = createMove('f1', 'c4', 'wB');
            return move;
        });

        expect(result.from).toBe('f1');
        expect(result.to).toBe('c4');
        expect(result.piece).toBe('wB');
        expect(result.captured).toBeNull();
    });

    test('should create queen move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createMove } = await import('/js/engine/Move.js');
            const move = createMove('d1', 'h5', 'wQ');
            return move;
        });

        expect(result.from).toBe('d1');
        expect(result.to).toBe('h5');
        expect(result.piece).toBe('wQ');
        expect(result.captured).toBeNull();
    });

    test('should create rook move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createMove } = await import('/js/engine/Move.js');
            const move = createMove('a1', 'd1', 'wR');
            return move;
        });

        expect(result.from).toBe('a1');
        expect(result.to).toBe('d1');
        expect(result.piece).toBe('wR');
        expect(result.captured).toBeNull();
    });

    test('should create king move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createMove } = await import('/js/engine/Move.js');
            const move = createMove('e1', 'e2', 'wK');
            return move;
        });

        expect(result.from).toBe('e1');
        expect(result.to).toBe('e2');
        expect(result.piece).toBe('wK');
        expect(result.captured).toBeNull();
    });

    test('should create black pawn move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createMove } = await import('/js/engine/Move.js');
            const move = createMove('e7', 'e5', 'bP');
            return move;
        });

        expect(result.from).toBe('e7');
        expect(result.to).toBe('e5');
        expect(result.piece).toBe('bP');
        expect(result.captured).toBeNull();
    });

    test('should create black capture move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createMove } = await import('/js/engine/Move.js');
            const move = createMove('d5', 'e4', 'bP', 'wP');
            return move;
        });

        expect(result.from).toBe('d5');
        expect(result.to).toBe('e4');
        expect(result.piece).toBe('bP');
        expect(result.captured).toBe('wP');
    });
});

test.describe('Move - Promotion Moves', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should create queen promotion move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createPromotionMove } = await import('/js/engine/Move.js');
            const move = createPromotionMove('e7', 'e8', 'wP', 'Q');
            return move;
        });

        expect(result.from).toBe('e7');
        expect(result.to).toBe('e8');
        expect(result.piece).toBe('wP');
        expect(result.promotion).toBe('Q');
        expect(result.captured).toBeNull();
    });

    test('should create rook promotion move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createPromotionMove } = await import('/js/engine/Move.js');
            const move = createPromotionMove('e7', 'e8', 'wP', 'R');
            return move;
        });

        expect(result.from).toBe('e7');
        expect(result.to).toBe('e8');
        expect(result.piece).toBe('wP');
        expect(result.promotion).toBe('R');
    });

    test('should create bishop promotion move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createPromotionMove } = await import('/js/engine/Move.js');
            const move = createPromotionMove('e7', 'e8', 'wP', 'B');
            return move;
        });

        expect(result.from).toBe('e7');
        expect(result.to).toBe('e8');
        expect(result.piece).toBe('wP');
        expect(result.promotion).toBe('B');
    });

    test('should create knight promotion move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createPromotionMove } = await import('/js/engine/Move.js');
            const move = createPromotionMove('e7', 'e8', 'wP', 'N');
            return move;
        });

        expect(result.from).toBe('e7');
        expect(result.to).toBe('e8');
        expect(result.piece).toBe('wP');
        expect(result.promotion).toBe('N');
    });

    test('should create promotion with capture', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createPromotionMove } = await import('/js/engine/Move.js');
            const move = createPromotionMove('e7', 'e8', 'wP', 'Q', 'bQ');
            return move;
        });

        expect(result.from).toBe('e7');
        expect(result.to).toBe('e8');
        expect(result.piece).toBe('wP');
        expect(result.promotion).toBe('Q');
        expect(result.captured).toBe('bQ');
    });

    test('should create black pawn promotion', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createPromotionMove } = await import('/js/engine/Move.js');
            const move = createPromotionMove('e2', 'e1', 'bP', 'Q');
            return move;
        });

        expect(result.from).toBe('e2');
        expect(result.to).toBe('e1');
        expect(result.piece).toBe('bP');
        expect(result.promotion).toBe('Q');
    });

    test('should create underpromotion to knight', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createPromotionMove } = await import('/js/engine/Move.js');
            const move = createPromotionMove('e7', 'e8', 'wP', 'N');
            return move;
        });

        expect(result.from).toBe('e7');
        expect(result.to).toBe('e8');
        expect(result.piece).toBe('wP');
        expect(result.promotion).toBe('N');
    });
});

test.describe('Move - En Passant Moves', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should create white en passant capture', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createEnPassantMove } = await import('/js/engine/Move.js');
            const move = createEnPassantMove('e5', 'd6', 'wP', 'bP');
            return move;
        });

        expect(result.from).toBe('e5');
        expect(result.to).toBe('d6');
        expect(result.piece).toBe('wP');
        expect(result.captured).toBe('bP');
        expect(result.isEnPassant).toBe(true);
    });

    test('should create black en passant capture', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createEnPassantMove } = await import('/js/engine/Move.js');
            const move = createEnPassantMove('e4', 'd3', 'bP', 'wP');
            return move;
        });

        expect(result.from).toBe('e4');
        expect(result.to).toBe('d3');
        expect(result.piece).toBe('bP');
        expect(result.captured).toBe('wP');
        expect(result.isEnPassant).toBe(true);
    });

    test('should create en passant on a-file', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createEnPassantMove } = await import('/js/engine/Move.js');
            const move = createEnPassantMove('b5', 'a6', 'wP', 'bP');
            return move;
        });

        expect(result.from).toBe('b5');
        expect(result.to).toBe('a6');
        expect(result.piece).toBe('wP');
        expect(result.captured).toBe('bP');
        expect(result.isEnPassant).toBe(true);
    });

    test('should create en passant on h-file', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createEnPassantMove } = await import('/js/engine/Move.js');
            const move = createEnPassantMove('g5', 'h6', 'wP', 'bP');
            return move;
        });

        expect(result.from).toBe('g5');
        expect(result.to).toBe('h6');
        expect(result.piece).toBe('wP');
        expect(result.captured).toBe('bP');
        expect(result.isEnPassant).toBe(true);
    });

    test('should have isEnPassant flag set to true', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createEnPassantMove } = await import('/js/engine/Move.js');
            const move = createEnPassantMove('e5', 'd6', 'wP', 'bP');
            return {
                isEnPassant: move.isEnPassant,
                isTrue: move.isEnPassant === true
            };
        });

        expect(result.isEnPassant).toBe(true);
        expect(result.isTrue).toBe(true);
    });
});

test.describe('Move - Castling Moves', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should create white kingside castling', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createCastleMove } = await import('/js/engine/Move.js');
            const move = createCastleMove('e1', 'g1', 'wK', true);
            return move;
        });

        expect(result.from).toBe('e1');
        expect(result.to).toBe('g1');
        expect(result.piece).toBe('wK');
        expect(result.isCastleKingSide).toBe(true);
        expect(result.isCastleQueenSide).toBe(false);
    });

    test('should create white queenside castling', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createCastleMove } = await import('/js/engine/Move.js');
            const move = createCastleMove('e1', 'c1', 'wK', false);
            return move;
        });

        expect(result.from).toBe('e1');
        expect(result.to).toBe('c1');
        expect(result.piece).toBe('wK');
        expect(result.isCastleKingSide).toBe(false);
        expect(result.isCastleQueenSide).toBe(true);
    });

    test('should create black kingside castling', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createCastleMove } = await import('/js/engine/Move.js');
            const move = createCastleMove('e8', 'g8', 'bK', true);
            return move;
        });

        expect(result.from).toBe('e8');
        expect(result.to).toBe('g8');
        expect(result.piece).toBe('bK');
        expect(result.isCastleKingSide).toBe(true);
        expect(result.isCastleQueenSide).toBe(false);
    });

    test('should create black queenside castling', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createCastleMove } = await import('/js/engine/Move.js');
            const move = createCastleMove('e8', 'c8', 'bK', false);
            return move;
        });

        expect(result.from).toBe('e8');
        expect(result.to).toBe('c8');
        expect(result.piece).toBe('bK');
        expect(result.isCastleKingSide).toBe(false);
        expect(result.isCastleQueenSide).toBe(true);
    });

    test('should handle kingSide parameter as boolean', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createCastleMove } = await import('/js/engine/Move.js');
            const kingside = createCastleMove('e1', 'g1', 'wK', true);
            const queenside = createCastleMove('e1', 'c1', 'wK', false);
            return {
                kingsideKingSide: kingside.isCastleKingSide,
                kingsideQueenSide: kingside.isCastleQueenSide,
                queensideKingSide: queenside.isCastleKingSide,
                queensideQueenSide: queenside.isCastleQueenSide
            };
        });

        expect(result.kingsideKingSide).toBe(true);
        expect(result.kingsideQueenSide).toBe(false);
        expect(result.queensideKingSide).toBe(false);
        expect(result.queensideQueenSide).toBe(true);
    });

    test('should handle truthy kingSide parameter', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createCastleMove } = await import('/js/engine/Move.js');
            const move = createCastleMove('e1', 'g1', 'wK', 1);
            return {
                isCastleKingSide: move.isCastleKingSide,
                isCastleQueenSide: move.isCastleQueenSide
            };
        });

        expect(result.isCastleKingSide).toBe(true);
        expect(result.isCastleQueenSide).toBe(false);
    });

    test('should handle falsy kingSide parameter', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createCastleMove } = await import('/js/engine/Move.js');
            const move = createCastleMove('e1', 'c1', 'wK', 0);
            return {
                isCastleKingSide: move.isCastleKingSide,
                isCastleQueenSide: move.isCastleQueenSide
            };
        });

        expect(result.isCastleKingSide).toBe(false);
        expect(result.isCastleQueenSide).toBe(true);
    });
});

test.describe('Move - Move Properties', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should have all required properties for basic move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createMove } = await import('/js/engine/Move.js');
            const move = createMove('e2', 'e4', 'wP');
            return {
                hasFrom: 'from' in move,
                hasTo: 'to' in move,
                hasPiece: 'piece' in move,
                hasCaptured: 'captured' in move,
                keys: Object.keys(move)
            };
        });

        expect(result.hasFrom).toBe(true);
        expect(result.hasTo).toBe(true);
        expect(result.hasPiece).toBe(true);
        expect(result.hasCaptured).toBe(true);
    });

    test('should have promotion property for promotion move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createPromotionMove } = await import('/js/engine/Move.js');
            const move = createPromotionMove('e7', 'e8', 'wP', 'Q');
            return {
                hasPromotion: 'promotion' in move,
                promotion: move.promotion,
                keys: Object.keys(move)
            };
        });

        expect(result.hasPromotion).toBe(true);
        expect(result.promotion).toBe('Q');
    });

    test('should have isEnPassant property for en passant move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createEnPassantMove } = await import('/js/engine/Move.js');
            const move = createEnPassantMove('e5', 'd6', 'wP', 'bP');
            return {
                hasIsEnPassant: 'isEnPassant' in move,
                isEnPassant: move.isEnPassant,
                keys: Object.keys(move)
            };
        });

        expect(result.hasIsEnPassant).toBe(true);
        expect(result.isEnPassant).toBe(true);
    });

    test('should have castle properties for castling move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createCastleMove } = await import('/js/engine/Move.js');
            const move = createCastleMove('e1', 'g1', 'wK', true);
            return {
                hasIsCastleKingSide: 'isCastleKingSide' in move,
                hasIsCastleQueenSide: 'isCastleQueenSide' in move,
                isCastleKingSide: move.isCastleKingSide,
                isCastleQueenSide: move.isCastleQueenSide,
                keys: Object.keys(move)
            };
        });

        expect(result.hasIsCastleKingSide).toBe(true);
        expect(result.hasIsCastleQueenSide).toBe(true);
    });

    test('should not have undefined properties for basic move', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createMove } = await import('/js/engine/Move.js');
            const move = createMove('e2', 'e4', 'wP');
            return {
                promotionUndefined: move.promotion === undefined,
                isEnPassantUndefined: move.isEnPassant === undefined,
                isCastleKingSideUndefined: move.isCastleKingSide === undefined,
                isCastleQueenSideUndefined: move.isCastleQueenSide === undefined
            };
        });

        expect(result.promotionUndefined).toBe(true);
        expect(result.isEnPassantUndefined).toBe(true);
        expect(result.isCastleKingSideUndefined).toBe(true);
        expect(result.isCastleQueenSideUndefined).toBe(true);
    });
});

test.describe('Move - Edge Cases', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should handle same from and to square', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createMove } = await import('/js/engine/Move.js');
            const move = createMove('e2', 'e2', 'wP');
            return { from: move.from, to: move.to, same: move.from === move.to };
        });

        expect(result.from).toBe('e2');
        expect(result.to).toBe('e2');
        expect(result.same).toBe(true);
    });

    test('should handle corner squares', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createMove } = await import('/js/engine/Move.js');
            const move = createMove('a1', 'h8', 'wQ');
            return { from: move.from, to: move.to };
        });

        expect(result.from).toBe('a1');
        expect(result.to).toBe('h8');
    });

    test('should handle all promotion types', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createPromotionMove } = await import('/js/engine/Move.js');
            const promotions = ['Q', 'R', 'B', 'N'];
            const moves = promotions.map(p => createPromotionMove('e7', 'e8', 'wP', p));
            return moves.map(m => m.promotion);
        });

        expect(result).toEqual(['Q', 'R', 'B', 'N']);
    });

    test('should handle all piece types', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createMove } = await import('/js/engine/Move.js');
            const pieces = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK'];
            const moves = pieces.map(p => createMove('e2', 'e4', p));
            return moves.map(m => m.piece);
        });

        expect(result).toEqual(['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK']);
    });
});

test.describe('Move - Validation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece:has-text("♙")');
    });

    test('should create valid algebraic notation', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createMove } = await import('/js/engine/Move.js');
            const move = createMove('e2', 'e4', 'wP');
            
            // Validate format
            const validFormat = /^[a-h][1-8]$/.test(move.from) && /^[a-h][1-8]$/.test(move.to);
            
            return { validFormat, from: move.from, to: move.to };
        });

        expect(result.validFormat).toBe(true);
    });

    test('should create valid piece notation', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createMove } = await import('/js/engine/Move.js');
            const move = createMove('e2', 'e4', 'wP');
            
            // Validate piece format (color + type)
            const validPiece = /^[wb][PNBRQK]$/.test(move.piece);
            
            return { validPiece, piece: move.piece };
        });

        expect(result.validPiece).toBe(true);
    });

    test('should create valid promotion types', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { createPromotionMove } = await import('/js/engine/Move.js');
            const move = createPromotionMove('e7', 'e8', 'wP', 'Q');
            
            // Validate promotion type
            const validPromotion = /^[QRBN]$/.test(move.promotion);
            
            return { validPromotion, promotion: move.promotion };
        });

        expect(result.validPromotion).toBe(true);
    });
});