// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Undo Tests - GameState.undoOnePly + Game.undoToPlayerTurn/canUndo
 * Exercised directly against the engine modules via page.evaluate().
 *
 * HELPERS is an async-IIFE expression string: evaluated inside the page with
 * eval() it resolves to the shared helper object (imports + move shortcuts).
 */

const HELPERS = `(async () => {
    const { GameState } = await import('/js/engine/GameState.js');
    const { generateLegalMoves } = await import('/js/engine/Rules.js');
    const { algebraicToIndex } = await import('/js/engine/Board.js');
    const { Game } = await import('/js/Game.js');
    const findMove = (state, from, to, promotion) =>
        generateLegalMoves(state.asRulesState()).find(
            m => m.from === from && m.to === to && (!promotion || m.promotion === promotion)
        );
    const play = (state, from, to, promotion) => {
        const m = findMove(state, from, to, promotion);
        if (!m) throw new Error('no legal move ' + from + '-' + to);
        state.applyMove(m);
    };
    const playAll = (state, plies) => plies.forEach(([f, t, p]) => play(state, f, t, p));
    return { GameState, Game, generateLegalMoves, algebraicToIndex, play, playAll };
})()`;

test.describe('Undo - GameState.undoOnePly', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
    });

    test('returns false and leaves state unchanged on empty history', async ({ page }) => {
        const result = await page.evaluate(async (H) => {
            const { GameState } = await eval(H);
            const state = GameState.createStarting('white');
            const before = JSON.stringify(state.board);
            const undone = state.undoOnePly();
            return {
                undone,
                sameBoard: JSON.stringify(state.board) === before,
                history: state.moveHistory.length,
            };
        }, HELPERS);

        expect(result.undone).toBe(false);
        expect(result.sameBoard).toBe(true);
        expect(result.history).toBe(0);
    });

    test('restores board, turn, history and lastMove after a single move', async ({ page }) => {
        const result = await page.evaluate(async (H) => {
            const { GameState, play } = await eval(H);
            const state = GameState.createStarting('white');
            const startBoard = JSON.stringify(state.board);
            play(state, 'e2', 'e4');
            const undone = state.undoOnePly();
            return {
                undone,
                boardMatchesStart: JSON.stringify(state.board) === startBoard,
                activeColor: state.activeColor,
                history: state.moveHistory.length,
                lastMove: state.lastMove,
                gameOver: state.isGameOver(),
            };
        }, HELPERS);

        expect(result.undone).toBe(true);
        expect(result.boardMatchesStart).toBe(true);
        expect(result.activeColor).toBe('white');
        expect(result.history).toBe(0);
        expect(result.lastMove).toBeNull();
        expect(result.gameOver).toBe(false);
    });

    test('restores castling rook placement and rights after undoing O-O', async ({ page }) => {
        const result = await page.evaluate(async (H) => {
            const { GameState, playAll } = await eval(H);
            const state = GameState.createStarting('white');
            playAll(state, [['e2','e4'],['e7','e5'],['g1','f3'],['b8','c6'],['f1','c4'],['f8','c5'],['e1','g1']]);
            const castled = {
                king: state.getPiece('g1'),
                rook: state.getPiece('f1'),
                right: state.castlingRights.white.kingSide,
            };
            state.undoOnePly();
            return {
                castled,
                king: state.getPiece('e1'),
                rook: state.getPiece('h1'),
                g1: state.getPiece('g1'),
                f1: state.getPiece('f1'),
                c4: state.getPiece('c4'),
                kingSideRight: state.castlingRights.white.kingSide,
                queenSideRight: state.castlingRights.white.queenSide,
                activeColor: state.activeColor,
            };
        }, HELPERS);

        expect(result.castled).toEqual({ king: 'wK', rook: 'wR', right: false });
        expect(result.king).toBe('wK');
        expect(result.rook).toBe('wR');
        expect(result.g1).toBeNull();
        expect(result.f1).toBeNull(); // bishop had already moved to c4 pre-castle
        expect(result.c4).toBe('wB');
        expect(result.kingSideRight).toBe(true);
        expect(result.queenSideRight).toBe(true);
        expect(result.activeColor).toBe('white');
    });

    test('restores en passant target in both directions', async ({ page }) => {
        const result = await page.evaluate(async (H) => {
            const { GameState, playAll } = await eval(H);
            const state = GameState.createStarting('white');
            playAll(state, [['e2','e4'],['a7','a6']]);
            // the position after e2-e4 had ep target e3; undoing a7-a6 must restore it
            state.undoOnePly();
            const epRestored = state.enPassantTarget;
            // undoing the double push itself must clear the target
            state.undoOnePly();
            const epCleared = state.enPassantTarget;
            return {
                epRestored,
                epCleared,
                pawnBack: state.getPiece('e2'),
                history: state.moveHistory.length,
            };
        }, HELPERS);

        expect(result.epRestored).toBe('e3');
        expect(result.epCleared).toBeNull();
        expect(result.pawnBack).toBe('wP');
        expect(result.history).toBe(0);
    });

    test('restores a promotion (pawn returns, promoted piece gone)', async ({ page }) => {
        const result = await page.evaluate(async (H) => {
            const { GameState, generateLegalMoves, algebraicToIndex } = await eval(H);
            const board = new Array(64).fill(null);
            board[algebraicToIndex('e1')] = 'wK';
            board[algebraicToIndex('a8')] = 'bK';
            board[algebraicToIndex('e7')] = 'wP';
            const state = new GameState({ board, activeColor: 'white', playerColor: 'white' });

            const move = generateLegalMoves(state.asRulesState())
                .find(m => m.from === 'e7' && m.to === 'e8' && m.promotion === 'Q');
            state.applyMove(move);
            const afterPromo = { e8: state.getPiece('e8'), history: state.moveHistory.slice() };

            state.undoOnePly();
            return {
                afterPromo,
                e7: state.getPiece('e7'),
                e8: state.getPiece('e8'),
                history: state.moveHistory.length,
                activeColor: state.activeColor,
            };
        }, HELPERS);

        expect(result.afterPromo.e8).toBe('wQ');
        expect(result.afterPromo.history).toEqual(['e7-e8=Q']);
        expect(result.e7).toBe('wP');
        expect(result.e8).toBeNull();
        expect(result.history).toBe(0);
        expect(result.activeColor).toBe('white');
    });

    test('restores halfmove clock and fullmove number', async ({ page }) => {
        const result = await page.evaluate(async (H) => {
            const { GameState, playAll } = await eval(H);
            const state = GameState.createStarting('white');
            playAll(state, [['g1','f3'],['g8','f6']]);
            const afterTwo = { half: state.halfmoveClock, full: state.fullmoveNumber, turn: state.activeColor };
            state.undoOnePly();
            const afterUndo = { half: state.halfmoveClock, full: state.fullmoveNumber, turn: state.activeColor };
            return { afterTwo, afterUndo };
        }, HELPERS);

        expect(result.afterTwo).toEqual({ half: 2, full: 2, turn: 'white' });
        expect(result.afterUndo).toEqual({ half: 1, full: 1, turn: 'black' });
    });

    test('restores moveHistory, lastMove and lastMoveText mid-game', async ({ page }) => {
        const result = await page.evaluate(async (H) => {
            const { GameState, playAll } = await eval(H);
            const state = GameState.createStarting('white');
            playAll(state, [['e2','e4'],['e7','e5'],['g1','f3']]);
            state.undoOnePly();
            return {
                history: state.moveHistory.slice(),
                lastMove: state.lastMove,
                lastMoveText: state.lastMoveText,
                turn: state.activeColor,
            };
        }, HELPERS);

        expect(result.history).toEqual(['e2-e4', 'e7-e5']);
        expect(result.lastMove).toEqual({ from: 'e7', to: 'e5' });
        expect(result.lastMoveText).toBe('2. e7-e5');
        expect(result.turn).toBe('white');
    });

    test('does not leave a stale repetition draw after undoing out of threefold', async ({ page }) => {
        const result = await page.evaluate(async (H) => {
            const { GameState, play, playAll } = await eval(H);
            const state = GameState.createStarting('white');
            // shuffle knights until the start position occurs a third time
            playAll(state, [
                ['g1','f3'],['g8','f6'],['f3','g1'],['f6','g8'],
                ['g1','f3'],['g8','f6'],['f3','g1'],['f6','g8'],
            ]);
            const drawnOutcome = state.result && state.result.outcome;
            state.undoOnePly();
            const afterUndoOutcome = state.result && state.result.outcome;
            play(state, 'b8', 'c6'); // diverge — must not inherit a phantom draw
            return {
                drawnOutcome,
                afterUndoOutcome,
                finalOutcome: state.result && state.result.outcome,
                history: state.moveHistory.length,
            };
        }, HELPERS);

        expect(result.drawnOutcome).toBe('draw');
        expect(result.afterUndoOutcome).toBe('ongoing');
        expect(result.finalOutcome).toBe('ongoing');
        expect(result.history).toBe(8);
    });

    test('refuses to undo legacy SAN history without mutating state', async ({ page }) => {
        const result = await page.evaluate(async (H) => {
            const { GameState, playAll } = await eval(H);
            const state = GameState.createStarting('white');
            playAll(state, [['e2','e4'],['e7','e5']]);
            state.moveHistory = ['e4', 'e5']; // simulate a legacy SAN save
            const boardBefore = JSON.stringify(state.board);
            const supported = state.undoSupported();
            const undone = state.undoOnePly();
            return {
                supported,
                undone,
                boardUnchanged: JSON.stringify(state.board) === boardBefore,
                history: state.moveHistory.slice(),
            };
        }, HELPERS);

        expect(result.supported).toBe(false);
        expect(result.undone).toBe(false);
        expect(result.boardUnchanged).toBe(true);
        expect(result.history).toEqual(['e4', 'e5']);
    });
});

test.describe('Undo - Game.undoToPlayerTurn / canUndo', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('kpc-disclaimer-accepted', 'true');
        });
        await page.reload();
        await page.click('#new-game-btn');
        await page.waitForSelector('.chess-piece[data-piece="wP"]');
    });

    test('white player: undoes own move plus computer reply back to the start', async ({ page }) => {
        const result = await page.evaluate(async (H) => {
            const { Game, play } = await eval(H);
            const game = new Game({ playerColor: 'white', difficulty: 1, engine: 'builtin', onUpdate: () => {} });
            play(game.state, 'e2', 'e4'); // human
            play(game.state, 'e7', 'e5'); // computer
            const canBefore = game.canUndo();
            const undone = game.undoToPlayerTurn();
            return {
                canBefore,
                undone,
                history: game.state.moveHistory.length,
                turn: game.getCurrentTurn(),
                canAfter: game.canUndo(),
                pawnHome: game.state.getPiece('e2'),
            };
        }, HELPERS);

        expect(result.canBefore).toBe(true);
        expect(result.undone).toBe(2);
        expect(result.history).toBe(0);
        expect(result.turn).toBe('white');
        expect(result.canAfter).toBe(false);
        expect(result.pawnHome).toBe('wP');
    });

    test('black player: stops after the computer opening move, black to move', async ({ page }) => {
        const result = await page.evaluate(async (H) => {
            const { Game, play } = await eval(H);
            const game = new Game({ playerColor: 'black', difficulty: 1, engine: 'builtin', onUpdate: () => {} });
            play(game.state, 'e2', 'e4'); // computer opening
            play(game.state, 'e7', 'e5'); // human
            play(game.state, 'g1', 'f3'); // computer reply
            const undone = game.undoToPlayerTurn();
            return {
                undone,
                history: game.state.moveHistory.slice(),
                turn: game.getCurrentTurn(),
                canAgain: game.canUndo(),
            };
        }, HELPERS);

        expect(result.undone).toBe(2);
        expect(result.history).toEqual(['e2-e4']);
        expect(result.turn).toBe('black');
        expect(result.canAgain).toBe(false);
    });

    test('black player: cannot undo when only the computer opening exists', async ({ page }) => {
        const result = await page.evaluate(async (H) => {
            const { Game, play } = await eval(H);
            const game = new Game({ playerColor: 'black', difficulty: 1, engine: 'builtin', onUpdate: () => {} });
            const noneYet = game.canUndo();
            play(game.state, 'e2', 'e4'); // computer opening only
            const afterOpening = game.canUndo();
            const undone = game.undoToPlayerTurn();
            return { noneYet, afterOpening, undone, history: game.state.moveHistory.length };
        }, HELPERS);

        expect(result.noneYet).toBe(false);
        expect(result.afterOpening).toBe(false);
        expect(result.undone).toBe(0);
        expect(result.history).toBe(1);
    });

    test('after delivering mate, undo reverts just the mating move and resumes', async ({ page }) => {
        const result = await page.evaluate(async (H) => {
            const { Game, playAll } = await eval(H);
            const game = new Game({ playerColor: 'black', difficulty: 1, engine: 'builtin', onUpdate: () => {} });
            // fool's mate: black (human) delivers the mate
            playAll(game.state, [['f2','f3'],['e7','e5'],['g2','g4'],['d8','h4']]);
            const over = game.isGameOver();
            const outcome = game.state.result && game.state.result.outcome;
            const canMate = game.canUndo();
            const undone = game.undoToPlayerTurn();
            return {
                over,
                outcome,
                canMate,
                undone,
                gameOverAfter: game.isGameOver(),
                turn: game.getCurrentTurn(),
                history: game.state.moveHistory.length,
                queenBack: game.state.getPiece('d8'),
            };
        }, HELPERS);

        expect(result.over).toBe(true);
        expect(result.outcome).toBe('checkmate');
        expect(result.canMate).toBe(true);
        expect(result.undone).toBe(1);
        expect(result.gameOverAfter).toBe(false);
        expect(result.turn).toBe('black');
        expect(result.history).toBe(3);
        expect(result.queenBack).toBe('bQ');
    });

    test('canUndo is false for legacy SAN history and undo is a no-op', async ({ page }) => {
        const result = await page.evaluate(async (H) => {
            const { Game, playAll } = await eval(H);
            const game = new Game({ playerColor: 'white', difficulty: 1, engine: 'builtin', onUpdate: () => {} });
            playAll(game.state, [['e2','e4'],['e7','e5']]);
            game.state.moveHistory = ['e4', 'e5']; // legacy SAN save
            const can = game.canUndo();
            const undone = game.undoToPlayerTurn();
            return { can, undone, pawnStillOut: game.state.getPiece('e4') };
        }, HELPERS);

        expect(result.can).toBe(false);
        expect(result.undone).toBe(0);
        expect(result.pawnStillOut).toBe('wP');
    });
});
