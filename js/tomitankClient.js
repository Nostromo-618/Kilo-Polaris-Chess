/**
 * UCI client for vendored tomitankChess (runs as a dedicated Web Worker).
 */

import { gameStateToFen } from "./engine/fen.js";
import { generateLegalMoves } from "./engine/Rules.js";
import { matchUciToLegalMove, parseBestMoveLine } from "./engine/uciMatch.js";

/** @type {TomitankClient|null} */
let singleton = null;

export function getTomitankClient() {
  if (!singleton) singleton = new TomitankClient();
  return singleton;
}

export class TomitankClient {
  constructor() {
    /** @type {Worker|null} */
    this.worker = null;
    /** @type {boolean} */
    this.initialized = false;
    /** @type {((line: string) => void)[]} */
    this.lineListeners = [];
  }

  /**
   * @param {(line: string) => void} fn
   * @returns {() => void} unsubscribe
   */
  subscribeLines(fn) {
    this.lineListeners.push(fn);
    return () => {
      const i = this.lineListeners.indexOf(fn);
      if (i >= 0) this.lineListeners.splice(i, 1);
    };
  }

  _emitLine(line) {
    for (const fn of this.lineListeners) {
      try {
        fn(line);
      } catch (e) {
        console.error("Tomitank line listener:", e);
      }
    }
  }

  async ensureWorker() {
    if (this.worker) return;

    this.worker = new Worker(new URL("../vendor/tomitankChess.js", import.meta.url));

    this.worker.onmessage = (event) => {
      const data = event.data;
      if (typeof data === "string") {
        const lines = data.split("\n");
        for (const line of lines) {
          if (line.length) this._emitLine(line);
        }
      }
    };

    this.worker.onerror = (err) => {
      console.error("Tomitank worker error:", err);
    };
  }

  /**
   * UCI handshake + first ucinewgame (required before position).
   */
  async init() {
    await this.ensureWorker();
    if (this.initialized) return;

    await this.waitForLine((line) => line.trim() === "uciok", () => {
      this.worker.postMessage("uci");
    });

    await this.waitForLine((line) => line.trim() === "readyok", () => {
      this.worker.postMessage("isready");
    });

    this.worker.postMessage("ucinewgame");
    this.initialized = true;
  }

  /** Call when the user starts a new game (resets engine state). */
  async resetGame() {
    await this.init();
    this.worker.postMessage("ucinewgame");
  }

  /**
   * @param {(line: string) => boolean} predicate
   * @param {() => void} send
   * @param {number} timeoutMs
   */
  waitForLine(predicate, send, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        unsub();
        reject(new Error("TomitankChess: UCI timeout"));
      }, timeoutMs);

      const unsub = this.subscribeLines((line) => {
        if (predicate(line)) {
          clearTimeout(timeoutId);
          unsub();
          resolve(undefined);
        }
      });

      send();
    });
  }

  /**
   * @param {import("./engine/GameState.js").GameState} gameState
   * @param {Object} opts
   * @param {number} opts.movetime — ms
   * @param {number} opts.difficulty — 1..6 → depth hint
   * @returns {Promise<import("./engine/Move.js").Move|null>}
   */
  async findBestMove(gameState, { movetime, difficulty }) {
    await this.init();

    const fen = gameStateToFen({
      board: gameState.board,
      activeColor: gameState.activeColor,
      castlingRights: gameState.castlingRights,
      enPassantTarget: gameState.enPassantTarget,
      halfmoveClock: gameState.halfmoveClock,
      fullmoveNumber: gameState.fullmoveNumber,
    });

    const depth = difficultyToMaxDepth(difficulty);
    const mt = Math.max(50, Math.floor(movetime));

    const legalMoves = generateLegalMoves(gameState.asRulesState());
    if (legalMoves.length === 0) return null;

    const uciBest = await new Promise((resolve, reject) => {
      const searchTimeout = setTimeout(() => {
        unsub();
        reject(new Error("TomitankChess: search timeout"));
      }, mt + 3000);

      const unsub = this.subscribeLines((line) => {
        const parsed = parseBestMoveLine(line);
        if (parsed !== undefined) {
          clearTimeout(searchTimeout);
          unsub();
          resolve(parsed);
        }
      });

      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go movetime ${mt} depth ${depth}`);
    });

    if (uciBest == null) return null;

    const move = matchUciToLegalMove(uciBest, legalMoves);
    return move || null;
  }
}

/**
 * Map UI difficulty 1..6 to UCI depth cap (tomitank default search depth up to 64).
 * @param {number} level
 */
function difficultyToMaxDepth(level) {
  const n = Math.max(1, Math.min(6, Number(level) || 6));
  return [2, 4, 6, 10, 14, 18][n - 1];
}
