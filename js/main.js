import { BoardView } from "./ui/BoardView.js";
import { Controls } from "./ui/Controls.js";
import { GameEndModal } from "./ui/GameEndModal.js";
import { DisclaimerModal } from "./ui/DisclaimerModal.js";
import { Game } from "./Game.js";
import {
  getDisclaimerAccepted,
  getTheme,
  setTheme,
  getDifficulty,
  setDifficulty,
  getThinkingTime,
  setThinkingTime,
  getGame,
  setGame,
  clearGame,
  getBoardSize,
  setBoardSize,
  getColorChoice,
  getEngine,
  setEngine,
} from "./storage.js";
import { getTomitankClient } from "./tomitankClient.js";

/**
 * The Vanduo bundle registers components but does not start them; `init()` runs
 * `initComponents()` (theme customizer, modals, etc.) and is required for UI behavior.
 */
if (typeof window.Vanduo !== "undefined" && typeof window.Vanduo.init === "function") {
  window.Vanduo.init();
}

/**
 * Main entry point for client-side chess application
 *
 * Persistence (localStorage):
 *   - Disclaimer acceptance      via storage.{get,set}DisclaimerAccepted
 *   - Theme preference           via storage.{get,set}Theme
 *   - Difficulty setting         via storage.{get,set}Difficulty
 *   - Thinking time              via storage.{get,set}ThinkingTime
 *   - In-progress game           via storage.{get,set,clear}Game
 *   - Desktop board size         via storage.{get,set}BoardSize
 */

const BOARD_SIZE_MIN_PX = 400;
const BOARD_SIZE_MAX_PX = 800;
/** First visit: max board width (slider 100 → 800px) */
const BOARD_SIZE_SLIDER_DEFAULT = 100;

/**
 * @param {number} slider 0–100
 * @returns {number} max-width in px
 */
function boardSliderToMaxWidthPx(slider) {
  const s = Math.max(0, Math.min(100, Number(slider)));
  return (
    BOARD_SIZE_MIN_PX +
    ((BOARD_SIZE_MAX_PX - BOARD_SIZE_MIN_PX) * s) / 100
  );
}

/**
 * @param {number} slider 0–100
 */
function applyBoardMaxWidthCss(slider) {
  const px = Math.round(boardSliderToMaxWidthPx(slider));
  document.documentElement.style.setProperty("--board-max-width", `${px}px`);
}

const dom = {
  boardContainer: document.getElementById("board-container"),
  colorChoice: document.getElementById("color-choice"),
  engineChoice: document.getElementById("engine-choice"),
  difficultyChoice: document.getElementById("difficulty-choice"),
  thinkingChoice: document.getElementById("thinking-choice"),
  newGameBtn: document.getElementById("new-game-btn"),
  statusText: document.getElementById("status-text"),
  turnIndicator: document.getElementById("turn-indicator"),
  lastMoveIndicator: document.getElementById("last-move-indicator"),
  moveHistory: document.getElementById("move-history"),
  gameEndModalContainer: document.getElementById("game-end-modal-container"),
  disclaimerModalContainer: document.getElementById("disclaimer-modal-container"),
  boardSizeRange: document.getElementById("board-size-range"),
  boardSizeValue: document.getElementById("board-size-value"),
  header: document.querySelector(".app-header"),
  thinkingIcon: document.querySelector(".thinking-icon"),
};

// Initialize board view
const boardView = new BoardView(dom.boardContainer, {
  onSquareSelected: handleSquareSelected,
});

// Initialize controls
const controlsView = new Controls({
  colorChoiceContainer: dom.colorChoice,
  engineChoiceContainer: dom.engineChoice,
  difficultyChoiceContainer: dom.difficultyChoice,
  thinkingChoiceContainer: dom.thinkingChoice,
  newGameButton: dom.newGameBtn,
  onNewGameRequested: handleNewGameRequested,
});

// Initialize game end modal
const gameEndModal = new GameEndModal(dom.gameEndModalContainer, handleNewGameRequested);

// Game state
let game = null;
let isProcessingMove = false;
let gameSaveThrottle = null;

/** @type {import("./ui/DisclaimerModal.js").DisclaimerModal|null} */
let disclaimerModal = null;
/** Resolves the first-visit gate when the user accepts the disclaimer (if shown). */
let pendingDisclaimerResolve = null;

/**
 * Initialize new game with current control settings
 */
async function initializeGame() {
  clearGame();

  setDifficulty(controlsView.getDifficulty());
  setThinkingTime(Math.round(controlsView.getThinkingTime() / 1000));
  setEngine(controlsView.getEngine());

  gameEndModal.hide();
  previousGameOver = false;

  const playerColor = controlsView.getSelectedColor();
  const difficulty = controlsView.getDifficulty();
  const engine = controlsView.getEngine();

  if (engine === "tomitank") {
    try {
      await getTomitankClient().resetGame();
    } catch (e) {
      console.warn("TomitankChess reset:", e);
    }
  }

  try {
    game = new Game({
      playerColor,
      difficulty,
      engine,
      onUpdate: syncUIWithGame,
    });

    const snapshot = game.getSnapshot();

    boardView.render(game.getBoard(), {
      perspective: game.getPlayerColor(),
      lastMove: snapshot.lastMove,
      legalMoves: [],
      selected: null,
      checkedKingSquare: game.getCheckedKingSquare(),
    });

    syncUIWithGame(snapshot);

    // If AI should move first
    if (game.getCurrentTurn() !== game.getPlayerColor() && !game.isGameOver()) {
      requestAnimationFrame(() => {
        if (!game || game.isGameOver()) return;
        if (game.getCurrentTurn() !== game.getPlayerColor()) {
          triggerAIMove();
        }
      });
    }
  } catch (error) {
    console.error('Game initialization error:', error);
    dom.statusText.textContent = "Failed to initialize game. Please refresh and try again.";
  }
}

/**
 * Restore an in-progress game from localStorage.
 */
async function restoreGame(savedState) {
  previousGameOver = false;
  gameEndModal.hide();

  const savedDifficulty = getDifficulty();
  const engine = getEngine() || "builtin";

  if (engine === "tomitank") {
    try {
      await getTomitankClient().resetGame();
    } catch (e) {
      console.warn("TomitankChess reset:", e);
    }
  }

  try {
    game = Game.fromSaved(savedState, {
      difficulty: savedDifficulty || 6,
      engine,
      onUpdate: syncUIWithGame,
    });

    const snapshot = game.getSnapshot();

    boardView.render(game.getBoard(), {
      perspective: game.getPlayerColor(),
      lastMove: snapshot.lastMove,
      legalMoves: [],
      selected: null,
      checkedKingSquare: game.getCheckedKingSquare(),
    });

    syncUIWithGame(snapshot);

    if (!game.isGameOver() && game.getCurrentTurn() !== game.getPlayerColor()) {
      requestAnimationFrame(() => {
        if (!game || game.isGameOver()) return;
        if (game.getCurrentTurn() !== game.getPlayerColor()) {
          triggerAIMove();
        }
      });
    }
  } catch (error) {
    console.error('Game restore error:', error);
    clearGame();
    dom.statusText.textContent = "Ready. Select settings and click 'New Game' to start.";
  }
}

async function handleNewGameRequested() {
  if (isProcessingMove) return;
  await initializeGame();
}

async function handleSquareSelected(square) {
  if (isProcessingMove) return;
  if (!game) return;
  if (game.getCurrentTurn() !== game.getPlayerColor()) return;
  if (game.isGameOver()) return;

  const result = game.handlePlayerSquareSelection(square);

  if (!result.changed) {
    boardView.updateHighlights({
      selected: result.selected,
      legalMoves: result.legalTargets,
      lastMove: result.lastMove,
      checkedKingSquare: game.getCheckedKingSquare(),
    });
    return;
  }

  const snapshot = game.getSnapshot();
  syncUIWithGame(snapshot);

  boardView.render(game.getBoard(), {
    perspective: game.getPlayerColor(),
    selected: null,
    legalMoves: [],
    lastMove: snapshot.lastMove,
    checkedKingSquare: game.getCheckedKingSquare(),
  });

  if (!game.isGameOver()) {
    requestAnimationFrame(() => {
      if (!game || game.isGameOver()) return;
      if (game.getCurrentTurn() !== game.getPlayerColor()) {
        triggerAIMove();
      }
    });
  }
}

async function triggerAIMove() {
  if (!game || game.isGameOver()) return;
  if (game.getCurrentTurn() === game.getPlayerColor()) return;

  isProcessingMove = true;
  syncBusyState(true);

  try {
    const timeout = controlsView.getThinkingTime();
    const aiMove = await game.computeAIMove(timeout);
    if (!aiMove) {
      syncUIWithGame(game.getSnapshot());
      return;
    }

    game.applyAIMove(aiMove);
    const snapshot = game.getSnapshot();
    syncUIWithGame(snapshot);

    boardView.render(game.getBoard(), {
      perspective: game.getPlayerColor(),
      selected: null,
      legalMoves: [],
      lastMove: snapshot.lastMove,
      checkedKingSquare: game.getCheckedKingSquare(),
    });
  } catch (error) {
    console.error("AI move error:", error);
    dom.statusText.textContent = "An error occurred while computing AI move.";
  } finally {
    isProcessingMove = false;
    syncBusyState(false);
  }
}

let previousGameOver = false;

/**
 * Synchronize UI with game snapshot.
 * Throttled localStorage saves to prevent excessive writes.
 */
function syncUIWithGame(snapshot) {
  if (!snapshot) return;

  dom.statusText.textContent = snapshot.statusText || '';
  dom.turnIndicator.textContent = snapshot.turnText || '';
  dom.lastMoveIndicator.textContent = snapshot.lastMoveText || '';

  // Move history
  dom.moveHistory.innerHTML = "";
  (snapshot.history || []).forEach((entry, index) => {
    const li = document.createElement("li");
    li.textContent = entry;
    li.dataset.index = String(index);
    dom.moveHistory.appendChild(li);
  });

  // Throttled save to localStorage (max once per 500ms)
  if (game && !game.isGameOver()) {
    if (gameSaveThrottle) clearTimeout(gameSaveThrottle);
    gameSaveThrottle = setTimeout(() => {
      try {
        setGame(game.getGameState());
      } catch {
        // Non-critical
      }
      gameSaveThrottle = null;
    }, 500);
  }

  const isGameOver = snapshot.gameOver || false;
  if (isGameOver && !previousGameOver && snapshot.result) {
    clearGame();
    const playerColor = snapshot.playerColor;
    gameEndModal.show(snapshot.result, playerColor);
  }
  previousGameOver = isGameOver;
}

function syncBusyState(isBusy) {
  if (isBusy) {
    dom.thinkingIcon.classList.add("thinking-icon--active");
    dom.thinkingIcon.classList.add('blinking');
    dom.statusText.classList.add("busy");
    dom.statusText.textContent = "Computer is thinking...";
  } else {
    dom.thinkingIcon.classList.remove("thinking-icon--active");
    dom.thinkingIcon.classList.remove('blinking');
    dom.statusText.classList.remove("busy");
    if (game) {
      syncUIWithGame(game.getSnapshot());
    }
  }
}

function setupThemeToggleButton() {
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (!themeBtn) return;

  let currentTheme = getTheme();
  applyThemeMode(currentTheme);
  updateThemeToggleUI(currentTheme);

  themeBtn.addEventListener('click', () => {
    const pref = getTheme();
    const modes = ['system', 'light', 'dark'];
    const nextMode = modes[(modes.indexOf(pref) + 1) % modes.length];
    applyThemeMode(nextMode);
    setTheme(nextMode);
    updateThemeToggleUI(nextMode);
  });

  document.addEventListener('theme:mode-change', (e) => {
    if (e.detail && e.detail.mode) {
      const mode = e.detail.mode;
      setTheme(mode);
      updateThemeToggleUI(mode);
    }
  });
}

function applyThemeMode(mode) {
  if (window.ThemeCustomizer && window.ThemeCustomizer.applyTheme) {
    window.ThemeCustomizer.applyTheme(mode);
  } else if (window.Vanduo && window.Vanduo.components && window.Vanduo.components.themeSwitcher) {
    window.Vanduo.components.themeSwitcher.setPreference(mode);
  } else {
    document.documentElement.setAttribute('data-theme', mode === 'system' ? '' : mode);
  }
}

function updateThemeToggleUI(activeMode) {
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (!themeBtn) return;
  const icon = themeBtn.querySelector('i');
  if (!icon) return;

  icon.classList.remove('ph-sun', 'ph-moon', 'ph-desktop');

  if (activeMode === 'light') {
    icon.classList.add('ph-sun');
  } else if (activeMode === 'dark') {
    icon.classList.add('ph-moon');
  } else {
    icon.classList.add('ph-desktop');
  }
}

/**
 * Single disclaimer modal instance (first visit + header “info” button).
 */
function ensureDisclaimerModal() {
  if (disclaimerModal) return disclaimerModal;
  disclaimerModal = new DisclaimerModal(dom.disclaimerModalContainer, () => {
    if (pendingDisclaimerResolve) {
      pendingDisclaimerResolve();
      pendingDisclaimerResolve = null;
    }
  });
  return disclaimerModal;
}

/**
 * First visit: show modal until accepted. Returning users: modal still exists for info button.
 */
function setupDisclaimerModal() {
  ensureDisclaimerModal();
  return new Promise((resolve) => {
    if (!getDisclaimerAccepted()) {
      pendingDisclaimerResolve = resolve;
      requestAnimationFrame(() => {
        disclaimerModal.show();
      });
    } else {
      resolve();
    }
  });
}

function setupDisclaimerInfoButton() {
  const btn = document.getElementById("disclaimer-info-btn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    ensureDisclaimerModal();
    disclaimerModal.show();
  });
}

function restorePreferences() {
  const savedDifficulty = getDifficulty();
  if (savedDifficulty !== null) {
    controlsView.setDifficulty(savedDifficulty);
  }

  const savedThinkingTime = getThinkingTime();
  if (savedThinkingTime !== null) {
    controlsView.setThinkingTime(savedThinkingTime);
  }

  const savedColor = getColorChoice();
  if (savedColor !== null) {
    controlsView.setSelectedColor(savedColor);
  }

  const savedEngine = getEngine();
  if (savedEngine !== null) {
    controlsView.setSelectedEngine(savedEngine);
  }
}

function initBoardSizeControl() {
  const saved = getBoardSize();
  const slider = saved !== null ? saved : BOARD_SIZE_SLIDER_DEFAULT;
  if (saved === null) {
    setBoardSize(slider);
  }

  applyBoardMaxWidthCss(slider);

  if (!dom.boardSizeRange || !dom.boardSizeValue) return;

  dom.boardSizeRange.value = String(slider);
  dom.boardSizeValue.textContent = String(Math.round(boardSliderToMaxWidthPx(slider)));

  const onInput = () => {
    const v = Number(dom.boardSizeRange.value);
    applyBoardMaxWidthCss(v);
    setBoardSize(v);
    dom.boardSizeValue.textContent = String(Math.round(boardSliderToMaxWidthPx(v)));
  };

  dom.boardSizeRange.addEventListener("input", onInput);
  dom.boardSizeRange.addEventListener("change", onInput);
}

async function main() {
  initBoardSizeControl();
  setupThemeToggleButton();
  setupDisclaimerInfoButton();
  await setupDisclaimerModal();
  restorePreferences();

  const savedGame = getGame();
  if (savedGame) {
    await restoreGame(savedGame);
  } else {
    dom.statusText.textContent = "Ready. Select settings and click 'New Game' to start.";
  }
}

main().catch(error => {
  console.error('Application initialization failed:', error);
  dom.statusText.textContent = "Failed to initialize application. Please refresh and try again.";
});
