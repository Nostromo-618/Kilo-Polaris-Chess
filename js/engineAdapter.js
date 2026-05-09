/**
 * Engine adapter boundary for Aurora Polaris and TomitankChess.
 * Tomitank remains a black-box UCI worker; Aurora uses the local AI search.
 */

import { AI } from "./engine/AI.js";
import { getTomitankClient, getTomitankDepthForDifficulty } from "./tomitankClient.js";

export const ENGINE_IDS = {
  AURORA: "builtin",
  TOMITANK: "tomitank",
};

let auroraWorker = null;
let auroraWorkerReady = false;
let auroraPending = null;

function toSearchState(gameState) {
  return {
    board: Array.isArray(gameState.board) ? gameState.board.slice() : Object.values(gameState.board),
    activeColor: gameState.activeColor,
    castlingRights: JSON.parse(JSON.stringify(gameState.castlingRights)),
    enPassantTarget: gameState.enPassantTarget || null,
    halfmoveClock: gameState.halfmoveClock || 0,
    fullmoveNumber: gameState.fullmoveNumber || 1,
  };
}

function initAuroraWorker() {
  if (auroraWorker) return;

  try {
    auroraWorker = new Worker(new URL("./ai.worker.js", import.meta.url), { type: "module" });
    auroraWorker.onmessage = (event) => {
      const { type, move, message, info } = event.data || {};
      if (type === "ready") {
        auroraWorkerReady = true;
        return;
      }
      if (type === "info" && auroraPending) {
        auroraPending.onInfo?.(info);
        return;
      }
      if (type === "result" && auroraPending) {
        const pending = auroraPending;
        auroraPending = null;
        pending.resolve(move || null);
        return;
      }
      if (type === "error" && auroraPending) {
        const pending = auroraPending;
        auroraPending = null;
        pending.reject(new Error(message || "Aurora worker search failed"));
      }
    };
    auroraWorker.onerror = (error) => {
      if (auroraPending) {
        const pending = auroraPending;
        auroraPending = null;
        pending.reject(error instanceof Error ? error : new Error("Aurora worker failed"));
      }
      auroraWorker = null;
      auroraWorkerReady = false;
    };
  } catch {
    auroraWorker = null;
    auroraWorkerReady = false;
  }
}

function stopAuroraWorkerSearch() {
  if (!auroraWorker) return;
  if (auroraPending) {
    const pending = auroraPending;
    auroraPending = null;
    pending.resolve(null);
  }
  auroraWorker.terminate();
  auroraWorker = null;
  auroraWorkerReady = false;
}

class AuroraAdapter {
  constructor({ ai = null, useWorker = true } = {}) {
    this.ai = ai || new AI();
    this.useWorker = useWorker;
    if (this.useWorker) initAuroraWorker();
  }

  async findBestMove(gameState, { difficulty = 6, movetime = 10000, signal, onInfo, forColor } = {}) {
    if (signal?.aborted) return null;

    const state = toSearchState(gameState);
    const color = forColor || state.activeColor;
    const timeout = Math.max(50, Number(movetime) || 10000);

    if (this.useWorker && auroraWorker && auroraWorkerReady && !auroraPending) {
      return new Promise((resolve, reject) => {
        const abort = () => {
          stopAuroraWorkerSearch();
          resolve(null);
        };
        if (signal) signal.addEventListener("abort", abort, { once: true });

        auroraPending = {
          resolve: (move) => {
            if (signal) signal.removeEventListener("abort", abort);
            resolve(move);
          },
          reject: (error) => {
            if (signal) signal.removeEventListener("abort", abort);
            reject(error);
          },
          onInfo,
        };

        auroraWorker.postMessage({
          type: "search",
          state,
          level: difficulty,
          forColor: color,
          timeout,
        });
      });
    }

    const move = await this.ai.findBestMove(state, {
      level: difficulty,
      forColor: color,
      timeout,
      signal,
      onInfo,
    });
    return signal?.aborted ? null : move;
  }

  stopSearch() {
    stopAuroraWorkerSearch();
  }
}

class TomitankAdapter {
  async findBestMove(gameState, { difficulty = 6, movetime = 10000, signal, onInfo } = {}) {
    if (signal?.aborted) return null;
    return getTomitankClient().findBestMove(gameState, {
      difficulty,
      movetime,
      signal,
      onInfo,
    });
  }

  stopSearch() {
    getTomitankClient().stopSearch();
  }
}

export function createEngineAdapter(engineId, options = {}) {
  return engineId === ENGINE_IDS.TOMITANK
    ? new TomitankAdapter()
    : new AuroraAdapter(options);
}

export function getEngineDisplayName(engineId) {
  return engineId === ENGINE_IDS.TOMITANK ? "TomitankChess" : "Aurora Polaris";
}

export function getEngineStrengthLabel(engineId, difficulty) {
  const level = Math.max(1, Math.min(6, Number(difficulty) || 3));
  if (engineId === ENGINE_IDS.TOMITANK) {
    return `depth ${getTomitankDepthForDifficulty(level)}`;
  }
  return `level ${level}`;
}

export function getEngineStrengthControlLabel(engineId) {
  return engineId === ENGINE_IDS.TOMITANK ? "Tomitank depth" : "Aurora strength";
}
