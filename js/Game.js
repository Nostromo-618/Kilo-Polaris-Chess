import { GameState } from "./engine/GameState.js";
import { AI } from "./engine/AI.js";
import { generateLegalMoves, getCheckedKingSquare as kingSquareIfInCheck } from "./engine/Rules.js";

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

// Shared Web Worker instance for AI computation
let aiWorker = null;
let workerReady = false;
let pendingResolve = null;
let pendingReject = null;

/**
 * Initialize the AI Web Worker
 */
function initWorker() {
  if (aiWorker) return;

  try {
    // Create worker with module support
    aiWorker = new Worker(new URL("./ai.worker.js", import.meta.url), { type: "module" });

    aiWorker.onmessage = (event) => {
      const { type, move, message } = event.data;

      if (type === "ready") {
        workerReady = true;
        return;
      }

      if (type === "result") {
        if (pendingResolve) {
          pendingResolve(move);
          pendingResolve = null;
          pendingReject = null;
        }
      } else if (type === "error") {
        console.error("AI Worker error:", message);
        if (pendingReject) {
          pendingReject(new Error(message));
          pendingResolve = null;
          pendingReject = null;
        }
      }
    };

    aiWorker.onerror = (error) => {
      console.error("AI Worker failed:", error);
      // Fall back to main thread AI
      aiWorker = null;
      workerReady = false;
    };
  } catch (e) {
    console.warn("Web Worker not supported, using main thread AI:", e);
    aiWorker = null;
  }
}

// Initialize worker on module load
initWorker();

export class Game {
  /**
   * @param {Object} options
   * @param {"white"|"black"|"random"} options.playerColor
   * @param {number} options.difficulty - 1..6
   * @param {(snapshot: import("./engine/GameState.js").GameSnapshot) => void} options.onUpdate
   */
  constructor({ playerColor, difficulty, onUpdate }) {
    // Fallback AI for when worker is not available
    this.ai = new AI();
    this.onUpdate = onUpdate || (() => { });

    const resolvedPlayerColor =
      playerColor === "white" || playerColor === "black"
        ? playerColor
        : Math.random() < 0.5
          ? "white"
          : "black";

    this.state = GameState.createStarting(resolvedPlayerColor);

    this.setDifficulty(difficulty || 6);
    this.notify();
  }

  /**
   * Restore a game from previously serialized state (e.g. localStorage).
   * @param {Object} serialized - return value of GameState.serialize()
   * @param {{ difficulty?: number, onUpdate?: Function }} options
   * @returns {Game}
   */
  static fromSaved(serialized, { difficulty, onUpdate } = {}) {
    const instance = Object.create(Game.prototype);
    instance.ai = new AI();
    instance.onUpdate = onUpdate || (() => { });
    instance.state = new GameState(serialized);
    instance.setDifficulty(difficulty || serialized.difficulty || 6);
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
   * Handle user clicking a square as part of a potential move.
   * @param {string} square - algebraic coordinate, e.g. "e2"
   * @returns {{
   *   changed: boolean,
   *   selected: string|null,
   *   legalTargets: string[],
   *   lastMove: {from:string,to:string}|null
   * }}
   */
  handlePlayerSquareSelection(square) {
    if (this.isGameOver()) {
      return {
        changed: false,
        selected: null,
        legalTargets: [],
        lastMove: this.state.lastMove,
      };
    }

    const color = this.getPlayerColor();
    const result = this.state.handleSelection(square, color);
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
   * Ask AI to compute best move given current state and difficulty.
   * Uses Web Worker for non-blocking computation when available.
   *
   * @param {number} [timeout=10000] - Maximum time for AI search in ms
   * @returns {Promise<import("./engine/Move.js").Move|null>}
   */
  async computeAIMove(timeout = 10000) {
    if (this.isGameOver()) return null;
    const aiColor = this.getCurrentTurn();

    // Try to use Web Worker for non-blocking computation
    if (aiWorker && workerReady) {
      return new Promise((resolve, reject) => {
        // Store resolve/reject for worker callback
        pendingResolve = resolve;
        pendingReject = reject;

        // Set timeout to fall back to main thread if worker hangs
        const timeoutId = setTimeout(() => {
          if (pendingResolve) {
            console.warn("AI Worker timeout, falling back to main thread");
            pendingResolve = null;
            pendingReject = null;
            // Fall back to main thread AI
            this.ai.findBestMove(this.state, {
              level: this.difficulty,
              forColor: aiColor,
              timeout: timeout,
            }).then(resolve).catch(reject);
          }
        }, timeout + 2000); // Give worker extra time before fallback

        // Clear timeout when worker responds
        const originalResolve = pendingResolve;
        pendingResolve = (move) => {
          clearTimeout(timeoutId);
          originalResolve(move);
        };

        // Send search request to worker
        aiWorker.postMessage({
          type: "search",
          state: {
            board: this.state.board,
            activeColor: this.state.activeColor,
            castlingRights: this.state.castlingRights,
            enPassantTarget: this.state.enPassantTarget,
            halfmoveClock: this.state.halfmoveClock,
            fullmoveNumber: this.state.fullmoveNumber,
          },
          level: this.difficulty,
          forColor: aiColor,
          timeout: timeout,
        });
      });
    }

    // Fallback: use main thread AI
    return this.ai.findBestMove(this.state, {
      level: this.difficulty,
      forColor: aiColor,
      timeout: timeout,
    });
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

