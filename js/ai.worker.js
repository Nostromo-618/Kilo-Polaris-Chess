/**
 * ai.worker.js
 *
 * Web Worker for chess AI computation.
 * Runs AI search off the main thread to prevent UI blocking.
 *
 * Messages received:
 *   { type: 'search', state: {...}, level: 1-6, forColor: 'white'|'black', timeout: ms }
 *
 * Messages sent:
 *   { type: 'result', move: Move|null, info?: Object }
 *   { type: 'info', info: Object }
 *   { type: 'error', message: string }
 */

import { AI } from "./engine/AI.js";

// Single AI instance to preserve transposition table between searches
const ai = new AI();

/**
 * Handle incoming messages from main thread
 */
self.onmessage = async function (event) {
  const { type, state, level, forColor, timeout } = event.data;

  if (type !== "search") {
    self.postMessage({ type: "error", message: `Unknown message type: ${type}` });
    return;
  }

  try {
    // Validate incoming state
    if (!state) {
      throw new Error('Worker received null/undefined state');
    }
    if (!state.board) {
      throw new Error('Worker received state without board property');
    }
    if (!Array.isArray(state.board) && typeof state.board !== 'object') {
      throw new Error(`Worker received invalid board type: ${typeof state.board}`);
    }

    // Create a minimal state object compatible with AI.findBestMove
    // Ensure board is an array (could be object from postMessage)
    const boardArray = Array.isArray(state.board)
      ? state.board
      : Object.values(state.board);

    if (boardArray.length !== 64) {
      throw new Error(`Worker received board with ${boardArray.length} elements, expected 64`);
    }

    const searchState = {
      board: boardArray,
      activeColor: state.activeColor,
      castlingRights: state.castlingRights,
      enPassantTarget: state.enPassantTarget,
      halfmoveClock: state.halfmoveClock,
      fullmoveNumber: state.fullmoveNumber,
    };

    // Run the search
    const move = await ai.findBestMove(searchState, {
      level: level,
      forColor: forColor,
      timeout: timeout || 10000,
      onInfo: (info) => self.postMessage({ type: "info", info }),
    });

    // Send result back to main thread
    self.postMessage({ type: "result", move: move, info: ai.getLastSearchInfo() });
  } catch (error) {
    // Include stack trace for debugging
    const errorMessage = error.stack
      ? `${error.message}\n${error.stack}`
      : (error.message || "AI search failed");
    self.postMessage({ type: "error", message: errorMessage });
  }
};

// Signal that worker is ready
self.postMessage({ type: "ready" });
