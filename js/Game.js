import { GameState } from "./engine/GameState.js";
import { AI } from "./engine/AI.js";
import { generateLegalMoves, getCheckedKingSquare as kingSquareIfInCheck } from "./engine/Rules.js";
import { createEngineAdapter, ENGINE_IDS } from "./engineAdapter.js";

/**
 * Game.js
 *
 * Orchestrates GameState (rules engine) with UI-facing callbacks.
 * This module:
 * - Configures initial side (white/black/random).
 * - Delegates rule validation and move generation to GameState.
 * - Delegates AI move search to AI (via Web Worker for non-blocking UI).
 * - Exposes high-level methods used by the frontend.
 */

export class Game {
  /**
   * @param {Object} options
   * @param {"white"|"black"|"random"} options.playerColor
   * @param {number} options.difficulty - 1..6
   * @param {"builtin"|"tomitank"} [options.engine]
   * @param {(snapshot: import("./engine/GameState.js").GameSnapshot) => void} options.onUpdate
   */
  constructor({ playerColor, difficulty, onUpdate, engine = "builtin" }) {
    // Fallback AI for when worker is not available
    this.ai = new AI();
    this.auroraAdapter = createEngineAdapter(ENGINE_IDS.AURORA, { ai: this.ai, useWorker: true });
    this.tomitankAdapter = createEngineAdapter(ENGINE_IDS.TOMITANK);
    this.onUpdate = onUpdate || (() => { });

    const resolvedPlayerColor =
      playerColor === "white" || playerColor === "black"
        ? playerColor
        : Math.random() < 0.5
          ? "white"
          : "black";

    this.state = GameState.createStarting(resolvedPlayerColor);

    this.setDifficulty(difficulty || 6);
    /** @type {"builtin"|"tomitank"} */
    this.engine = engine === "tomitank" ? "tomitank" : "builtin";
    this.aiMoveTimeMs = 10000;
    this.notify();
  }

  /**
   * Restore a game from previously serialized state (e.g. localStorage).
   * @param {Object} serialized - return value of GameState.serialize()
   * @param {{ difficulty?: number, onUpdate?: Function, engine?: "builtin"|"tomitank" }} options
   * @returns {Game}
   */
  static fromSaved(serialized, { difficulty, onUpdate, engine = "builtin" } = {}) {
    const instance = Object.create(Game.prototype);
    instance.ai = new AI();
    instance.auroraAdapter = createEngineAdapter(ENGINE_IDS.AURORA, { ai: instance.ai, useWorker: true });
    instance.tomitankAdapter = createEngineAdapter(ENGINE_IDS.TOMITANK);
    instance.onUpdate = onUpdate || (() => { });
    instance.state = new GameState(serialized);
    instance.setDifficulty(difficulty || serialized.difficulty || 6);
    instance.engine = engine === "tomitank" ? "tomitank" : "builtin";
    instance.aiMoveTimeMs = 10000;
    // Re-compute status text so UI shows correct message
    instance.state.updateStatusText();
    instance.notify();
    return instance;
  }

  /**
   * Update AI difficulty.
   * @param {number} level 1..6
   */
  setDifficulty(level) {
    const clamped = Math.max(1, Math.min(6, Number(level) || 6));
    this.difficulty = clamped;
  }

  /**
   * Per-move time budget (ms) for human play, by difficulty. Levels 1-3 finish
   * at their tiny fixed depth well within any budget (kept snappy/CPU-light);
   * levels 4-6 deepen to fill their budget. Engine-vs-engine matches override
   * this with an explicit per-move time.
   * @returns {number}
   */
  moveTimeForDifficulty() {
    switch (this.difficulty) {
      case 1: return 400;
      case 2: return 700;
      case 3: return 1200;
      case 4: return 1500;
      case 5: return 4000;
      case 6: return this.aiMoveTimeMs;
      default: return this.aiMoveTimeMs;
    }
  }

  /**
   * Get underlying board representation for UI.
   * @returns {Record<string,string|null>}
   */
  getBoard() {
    return this.state.getBoardMap();
  }

  /**
   * Algebraic square of the king in check for the side to move, or null.
   * @returns {string|null}
   */
  getCheckedKingSquare() {
    return kingSquareIfInCheck(this.state.asRulesState());
  }

  /**
   * Get the side the human is playing.
   * @returns {"white"|"black"}
   */
  getPlayerColor() {
    return this.state.playerColor;
  }

  /**
   * Current turn color.
   * @returns {"white"|"black"}
   */
  getCurrentTurn() {
    return this.state.activeColor;
  }

  /**
   * Whether the game is over.
   * @returns {boolean}
   */
  isGameOver() {
    return this.state.isGameOver();
  }

  /**
   * Get serialized game state for AI/API.
   * @returns {Object}
   */
  getGameState() {
    return this.state.serialize();
  }

  /**
   * Snapshot for UI.
   * @returns {import("./engine/GameState.js").GameSnapshot}
   */
  getSnapshot() {
    return this.state.getSnapshot();
  }

  /**
   * Handle user clicking a square as part of a potential move.
   * This method encapsulates selection + move confirmation behavior.
   *
   * @param {string} square - algebraic coordinate, e.g. "e2"
   * @returns {{
   *   changed: boolean,
   *   selected: string|null,
   *   legalTargets: string[],
   *   lastMove: {from:string,to:string}|null
   * }}
   */
  getLegalMovesForSquare(square) {
    if (this.isGameOver()) return [];
    const allLegal = generateLegalMoves(this.state.asRulesState());
    return allLegal
      .filter(m => m.from === square)
      .map(m => m.to);
  }

  /**
   * Check whether a move from `from` to `to` would be a pawn promotion.
   * @param {string} from
   * @param {string} to
   * @returns {boolean}
   */
  isPromotionMove(from, to) {
    if (this.isGameOver()) return false;
    const allLegal = generateLegalMoves(this.state.asRulesState());
    return allLegal.some(m => m.from === from && m.to === to && !!m.promotion);
  }

  /**
   * Handle user clicking a square as part of a potential move.
   * @param {string} square - algebraic coordinate, e.g. "e2"
   * @returns {{
   *   changed: boolean,
   *   selected: string|null,
   *   legalTargets: string[],
   *   lastMove: {from:string,to:string}|null
   * }}
   */
  handlePlayerSquareSelection(square, promotionChoice = "Q") {
    if (this.isGameOver()) {
      return {
        changed: false,
        selected: null,
        legalTargets: [],
        lastMove: this.state.lastMove,
      };
    }

    const color = this.getPlayerColor();
    const result = this.state.handleSelection(square, color, promotionChoice);
    if (result.moved) {
      this.notify();
    }
    return {
      changed: result.moved,
      selected: result.selectedSquare,
      legalTargets: result.legalTargets,
      lastMove: this.state.lastMove,
    };
  }

  /**
   * Handle a direct move request (e.g. from API).
   * @param {import("./engine/Move.js").Move} move
   * @returns {{ success: boolean, move?: import("./engine/Move.js").Move, error?: string }}
   */
  handlePlayerMove(move) {
    if (this.isGameOver()) {
      return { success: false, error: "Game is over" };
    }

    if (this.getCurrentTurn() !== this.getPlayerColor()) {
      return { success: false, error: "Not your turn" };
    }

    const legalMoves = generateLegalMoves(this.state.asRulesState());
    const validMove = legalMoves.find(m =>
      m.from === move.from &&
      m.to === move.to &&
      (!move.promotion || m.promotion === move.promotion)
    );

    if (!validMove) {
      return { success: false, error: "Illegal move" };
    }

    this.state.applyMove(validMove);
    this.notify();
    return { success: true, move: validMove };
  }

  /**
   * Apply a legal engine move for the current side to move.
   * Used by engine-vs-engine match mode.
   * @param {import("./engine/Move.js").Move} move
   * @returns {{ success: boolean, move?: import("./engine/Move.js").Move, error?: string }}
   */
  handleEngineMove(move) {
    if (this.isGameOver()) {
      return { success: false, error: "Game is over" };
    }

    const legalMoves = generateLegalMoves(this.state.asRulesState());
    const validMove = legalMoves.find(m =>
      m.from === move.from &&
      m.to === move.to &&
      (!move.promotion || m.promotion === move.promotion)
    );

    if (!validMove) {
      return { success: false, error: "Illegal move" };
    }

    this.state.applyMove(validMove);
    this.notify();
    return { success: true, move: validMove };
  }

  /**
   * Whether an undo is currently meaningful and safe:
   * - the human has made at least one move (undo never reverts the computer's
   *   opening move when the human plays black), and
   * - the whole history is replayable long algebraic (legacy SAN saves are not).
   * Turn-agnostic on purpose: undo is also offered after the game has ended.
   * @returns {boolean}
   */
  canUndo() {
    const pliesPlayed = this.state.moveHistory.length;
    const minPlies = this.getPlayerColor() === "white" ? 1 : 2;
    if (pliesPlayed < minPlies) return false;
    return this.state.undoSupported();
  }

  /**
   * Take back the human's last move together with any computer replies after
   * it, so it is the human's turn again. Also works after the game has ended
   * (e.g. take back the move that led to mate).
   * @returns {number} number of half-moves undone (0 if undo was not possible)
   */
  undoToPlayerTurn() {
    if (!this.canUndo()) return 0;
    let undone = 0;
    do {
      if (!this.state.undoOnePly()) break;
      undone += 1;
    } while (
      this.state.moveHistory.length &&
      this.state.activeColor !== this.getPlayerColor()
    );
    if (undone > 0) this.notify();
    return undone;
  }

  /**
   * Ask AI to compute best move given current state and difficulty.
   * Uses Web Worker for non-blocking computation when available.
   *
   * @returns {Promise<import("./engine/Move.js").Move|null>}
   */
  async computeAIMove({ signal, onInfo, movetime } = {}) {
    if (this.isGameOver()) return null;
    const aiColor = this.getCurrentTurn();
    const timeout = movetime || this.moveTimeForDifficulty();
    const auroraOpts = {
      difficulty: this.difficulty,
      movetime: timeout,
      signal,
      onInfo,
      forColor: aiColor,
      // Positions since the last irreversible move, so the search can detect a
      // repetition draw across played moves (not just within its own tree).
      history: this.state.getReversibleHistory(),
    };

    if (this.engine === "tomitank") {
      try {
        const move = await this.tomitankAdapter.findBestMove(this.state, auroraOpts);
        if (move) return move;
      } catch (e) {
        console.warn("TomitankChess failed, falling back to built-in AI:", e);
      }
    }

    return this.auroraAdapter.findBestMove(this.state, auroraOpts);
  }

  /**
   * Apply an AI move that was computed earlier.
   * @param {import("./engine/Move.js").Move} move
   */
  applyAIMove(move) {
    if (!move) return;
    this.state.applyMove(move);
    this.notify();
  }

  /**
   * Internal: recompute status strings and invoke callback.
   */
  notify() {
    this.state.updateStatusText();
    this.onUpdate(this.state.getSnapshot());
  }
}
