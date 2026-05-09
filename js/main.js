import { BoardView } from "./ui/BoardView.js";
import { Controls } from "./ui/Controls.js";
import { GameEndModal } from "./ui/GameEndModal.js";
import { DisclaimerModal } from "./ui/DisclaimerModal.js";
import { ChangelogModal } from "./ui/ChangelogModal.js";
import { Game } from "./Game.js";
import {
  getDisclaimerAccepted,
  getTheme,
  setTheme,
  getDifficulty,
  setDifficulty,
  getGame,
  setGame,
  clearGame,
  getBoardSize,
  setBoardSize,
  getColorChoice,
  getEngine,
  setEngine,
  getPlayMode,
  setPlayMode,
  getMatchWhiteEngine,
  setMatchWhiteEngine,
  getMatchBlackEngine,
  setMatchBlackEngine,
  getMatchWhiteStrength,
  setMatchWhiteStrength,
  getMatchBlackStrength,
  setMatchBlackStrength,
  getMatchMoveTime,
  setMatchMoveTime,
  getMatchPerspective,
  setMatchPerspective,
} from "./storage.js";
import { getTomitankClient } from "./tomitankClient.js";
import {
  createEngineAdapter,
  getEngineDisplayName,
  getEngineStrengthControlLabel,
  getEngineStrengthLabel,
} from "./engineAdapter.js";

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
  playModeChoice: document.getElementById("play-mode-choice"),
  humanPlaySettings: document.querySelectorAll(".human-play-setting"),
  matchSettings: document.getElementById("match-settings"),
  matchWhiteEngineChoice: document.getElementById("match-white-engine-choice"),
  matchBlackEngineChoice: document.getElementById("match-black-engine-choice"),
  matchWhiteStrengthLabel: document.getElementById("match-white-strength-label"),
  matchBlackStrengthLabel: document.getElementById("match-black-strength-label"),
  matchWhiteStrengthChoice: document.getElementById("match-white-strength-choice"),
  matchBlackStrengthChoice: document.getElementById("match-black-strength-choice"),
  matchMoveTimeSelect: document.getElementById("match-movetime-select"),
  matchPerspectiveChoice: document.getElementById("match-perspective-choice"),
  matchStartBtn: document.getElementById("match-start-btn"),
  matchPauseBtn: document.getElementById("match-pause-btn"),
  matchStopBtn: document.getElementById("match-stop-btn"),
  matchScoreIndicator: document.getElementById("match-score-indicator"),
  difficultyChoice: document.getElementById("difficulty-choice"),
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
  headerControls: document.getElementById("header-controls"),
  themeToggleBtn: document.getElementById("theme-toggle-btn"),
  githubRepoLink: document.getElementById("github-repo-link"),
  disclaimerInfoBtn: document.getElementById("disclaimer-info-btn"),
  themeCustomizerBtn: document.querySelector("[data-theme-customizer-trigger]"),
  mobileMenuToggle: document.getElementById("mobile-menu-toggle"),
  mobileMenuClose: document.getElementById("mobile-menu-close"),
  mobileSideMenu: document.getElementById("mobile-side-menu"),
  mobileMenuControlsSlot: document.getElementById("mobile-menu-controls-slot"),
  changelogModalContainer: document.getElementById("changelog-modal-container"),
  changelogTrigger: document.getElementById("changelog-trigger"),
  thinkingIcon: document.querySelector(".thinking-icon"),
};

// Initialize board view
const boardView = new BoardView(dom.boardContainer, {
  onSquareSelected: handleSquareSelected,
  onPromotionPicked: handlePromotionPicked,
  onPromotionCancelled: handlePromotionCancelled,
});

// Initialize controls
const controlsView = new Controls({
  colorChoiceContainer: dom.colorChoice,
  engineChoiceContainer: dom.engineChoice,
  difficultyChoiceContainer: dom.difficultyChoice,
  newGameButton: dom.newGameBtn,
  onNewGameRequested: handleNewGameRequested,
});

// Initialize game end modal
const gameEndModal = new GameEndModal(dom.gameEndModalContainer, handleNewGameRequested);

// Game state
let game = null;
let isProcessingMove = false;
let gameSaveThrottle = null;
/** @type {{ from: string, to: string } | null} */
let pendingPromotion = null;
let currentPlayMode = "human";
let matchRunning = false;
let matchPaused = false;
let matchPauseRequested = false;
let matchAbortController = null;
let matchCurrentAdapter = null;
let matchScore = { white: 0, black: 0, draws: 0 };

/** @type {import("./ui/DisclaimerModal.js").DisclaimerModal|null} */
let disclaimerModal = null;
let changelogModal = null;
/** Resolves the first-visit gate when the user accepts the disclaimer (if shown). */
let pendingDisclaimerResolve = null;

/**
 * Initialize new game with current control settings
 */
async function initializeGame() {
  clearGame();

  setDifficulty(controlsView.getDifficulty());
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
  if (currentPlayMode === "match") {
    await startEngineMatch();
    return;
  }
  stopEngineMatch();
  await initializeGame();
}

async function handleSquareSelected(square) {
  if (isProcessingMove) return;
  if (currentPlayMode === "match") return;
  if (!game) return;
  if (game.getCurrentTurn() !== game.getPlayerColor()) return;
  if (game.isGameOver()) return;

  // Check if the current selection + this square would be a promotion move.
  // GameState stores the selected square internally; mirror that logic here.
  const selectedFrom = game.state.selectedSquare;
  if (selectedFrom && game.isPromotionMove(selectedFrom, square)) {
    pendingPromotion = { from: selectedFrom, to: square };
    boardView.showPromotionPicker(square, game.getPlayerColor());
    return;
  }

  const result = game.handlePlayerSquareSelection(square, "Q");

  if (!result.changed) {
    boardView.updateHighlights({
      selected: result.selected,
      legalMoves: result.legalTargets,
      lastMove: result.lastMove,
      checkedKingSquare: game.getCheckedKingSquare(),
    });
    return;
  }

  completePlayerMove();
}

/**
 * Called when the user picks a piece from the promotion overlay.
 * @param {"Q"|"R"|"B"|"N"} piece
 */
async function handlePromotionPicked(piece) {
  if (!game || !pendingPromotion) return;

  const { to } = pendingPromotion;
  pendingPromotion = null;

  const result = game.handlePlayerSquareSelection(to, piece);
  if (!result.changed) return;

  completePlayerMove();
}

function handlePromotionCancelled() {
  pendingPromotion = null;
}

function completePlayerMove() {
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
    const aiMove = await game.computeAIMove();
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
  if (game && !game.isGameOver() && currentPlayMode !== "match") {
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
  if (isGameOver && !previousGameOver && snapshot.result && currentPlayMode !== "match") {
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
    if (game && currentPlayMode !== "match") {
      syncUIWithGame(game.getSnapshot());
    }
  }
}

function setSegmentActive(container, attrName, value) {
  if (!container) return;
  container.querySelectorAll("button").forEach((btn) => {
    const active = btn.getAttribute(attrName) === value;
    btn.classList.toggle("vd-is-active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
}

function getSegmentValue(container, attrName, fallback) {
  const active = container?.querySelector("button.vd-is-active");
  return active?.getAttribute(attrName) || fallback;
}

function setPlayModeUI(mode) {
  currentPlayMode = mode === "match" ? "match" : "human";
  setPlayMode(currentPlayMode);
  setSegmentActive(dom.playModeChoice, "data-mode", currentPlayMode);

  dom.humanPlaySettings.forEach((el) => {
    el.hidden = currentPlayMode === "match";
  });
  if (dom.matchSettings) dom.matchSettings.hidden = currentPlayMode !== "match";
  if (dom.newGameBtn?.parentElement) dom.newGameBtn.parentElement.hidden = currentPlayMode === "match";
  if (dom.matchScoreIndicator) dom.matchScoreIndicator.hidden = currentPlayMode !== "match";

  if (currentPlayMode === "human") {
    stopEngineMatch();
    if (!game) dom.statusText.textContent = "Ready. Select settings and click 'New Game' to start.";
  } else {
    clearGame();
    dom.statusText.textContent = "Ready for engine match.";
    updateMatchControls();
    updateMatchScoreText();
  }
}

function setupEngineMatchControls() {
  if (!dom.playModeChoice) return;

  dom.playModeChoice.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const mode = target.getAttribute("data-mode");
    if (mode === "human" || mode === "match") setPlayModeUI(mode);
  });

  const bindEngineChoice = (container, setter) => {
    if (!container) return;
    container.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      const engine = target.getAttribute("data-engine");
      if (engine !== "builtin" && engine !== "tomitank") return;
      setSegmentActive(container, "data-engine", engine);
      setter(engine);
      updateMatchStrengthLabels();
    });
  };

  bindEngineChoice(dom.matchWhiteEngineChoice, setMatchWhiteEngine);
  bindEngineChoice(dom.matchBlackEngineChoice, setMatchBlackEngine);

  const bindStrengthChoice = (container, setter) => {
    if (!container) return;
    container.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      const level = Number(target.getAttribute("data-level"));
      if (Number.isNaN(level) || level < 1 || level > 6) return;
      setSegmentActive(container, "data-level", String(level));
      setter(level);
    });
  };

  bindStrengthChoice(dom.matchWhiteStrengthChoice, setMatchWhiteStrength);
  bindStrengthChoice(dom.matchBlackStrengthChoice, setMatchBlackStrength);

  dom.matchPerspectiveChoice?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const perspective = target.getAttribute("data-perspective");
    if (perspective !== "white" && perspective !== "black") return;
    setSegmentActive(dom.matchPerspectiveChoice, "data-perspective", perspective);
    setMatchPerspective(perspective);
    if (game && currentPlayMode === "match") renderCurrentBoard();
  });

  dom.matchMoveTimeSelect?.addEventListener("change", () => {
    setMatchMoveTime(Number(dom.matchMoveTimeSelect.value));
  });

  dom.matchStartBtn?.addEventListener("click", () => {
    startEngineMatch().catch((error) => {
      console.error("Engine match start failed:", error);
      updateMatchStatus("Engine match failed to start.");
      stopEngineMatch();
    });
  });

  dom.matchPauseBtn?.addEventListener("click", () => {
    if (matchPaused) {
      resumeEngineMatch();
    } else {
      requestMatchPause();
    }
  });

  dom.matchStopBtn?.addEventListener("click", () => {
    stopEngineMatch();
    dom.statusText.textContent = "Engine match stopped.";
  });
}

function restoreMatchPreferences() {
  const mode = getPlayMode();
  const whiteEngine = getMatchWhiteEngine();
  const blackEngine = getMatchBlackEngine();
  const whiteStrength = getMatchWhiteStrength();
  const blackStrength = getMatchBlackStrength();
  const movetime = getMatchMoveTime();
  const perspective = getMatchPerspective();

  setSegmentActive(dom.matchWhiteEngineChoice, "data-engine", whiteEngine);
  setSegmentActive(dom.matchBlackEngineChoice, "data-engine", blackEngine);
  setSegmentActive(dom.matchWhiteStrengthChoice, "data-level", String(whiteStrength));
  setSegmentActive(dom.matchBlackStrengthChoice, "data-level", String(blackStrength));
  if (dom.matchMoveTimeSelect) dom.matchMoveTimeSelect.value = String(movetime);
  setSegmentActive(dom.matchPerspectiveChoice, "data-perspective", perspective);
  updateMatchStrengthLabels();
  setPlayModeUI(mode);
}

function getMatchConfig() {
  const whiteEngine = getSegmentValue(dom.matchWhiteEngineChoice, "data-engine", getMatchWhiteEngine());
  const blackEngine = getSegmentValue(dom.matchBlackEngineChoice, "data-engine", getMatchBlackEngine());
  const whiteDifficulty = Number(getSegmentValue(dom.matchWhiteStrengthChoice, "data-level", String(getMatchWhiteStrength()))) || getMatchWhiteStrength();
  const blackDifficulty = Number(getSegmentValue(dom.matchBlackStrengthChoice, "data-level", String(getMatchBlackStrength()))) || getMatchBlackStrength();

  return {
    whiteEngine,
    blackEngine,
    whiteDifficulty,
    blackDifficulty,
    perspective: getSegmentValue(dom.matchPerspectiveChoice, "data-perspective", getMatchPerspective()),
    movetime: Number(dom.matchMoveTimeSelect?.value) || getMatchMoveTime(),
  };
}

function updateMatchStrengthLabels() {
  const whiteEngine = getSegmentValue(dom.matchWhiteEngineChoice, "data-engine", getMatchWhiteEngine());
  const blackEngine = getSegmentValue(dom.matchBlackEngineChoice, "data-engine", getMatchBlackEngine());
  if (dom.matchWhiteStrengthLabel) {
    dom.matchWhiteStrengthLabel.textContent = `White ${getEngineStrengthControlLabel(whiteEngine)}:`;
  }
  if (dom.matchBlackStrengthLabel) {
    dom.matchBlackStrengthLabel.textContent = `Black ${getEngineStrengthControlLabel(blackEngine)}:`;
  }
}

function formatMatchSideLabel(color, engineId, difficulty) {
  const colorLabel = color === "white" ? "White" : "Black";
  return `${colorLabel} ${getEngineDisplayName(engineId)} (${getEngineStrengthLabel(engineId, difficulty)})`;
}

function getMatchSideConfig(config, color) {
  const isWhite = color === "white";
  return {
    engineId: isWhite ? config.whiteEngine : config.blackEngine,
    difficulty: isWhite ? config.whiteDifficulty : config.blackDifficulty,
  };
}

function updateMatchControls() {
  if (!dom.matchStartBtn || !dom.matchPauseBtn || !dom.matchStopBtn) return;
  dom.matchStartBtn.disabled = matchRunning && !matchPaused;
  dom.matchPauseBtn.disabled = !matchRunning && !matchPaused;
  dom.matchStopBtn.disabled = !matchRunning && !matchPaused;
  dom.matchPauseBtn.textContent = matchPaused ? "Resume" : (matchPauseRequested ? "Pausing" : "Pause");
}

function updateMatchScoreText() {
  if (!dom.matchScoreIndicator) return;
  dom.matchScoreIndicator.textContent = `Score: White ${matchScore.white} / Draws ${matchScore.draws} / Black ${matchScore.black}`;
}

function updateMatchStatus(text) {
  dom.statusText.textContent = text;
  updateMatchScoreText();
}

function renderCurrentBoard() {
  if (!game) return;
  const snapshot = game.getSnapshot();
  const perspective = currentPlayMode === "match" ? getMatchConfig().perspective : game.getPlayerColor();
  boardView.render(game.getBoard(), {
    perspective,
    selected: null,
    legalMoves: [],
    lastMove: snapshot.lastMove,
    checkedKingSquare: game.getCheckedKingSquare(),
  });
}

async function startEngineMatch() {
  if (matchRunning || matchPaused) stopEngineMatch();

  const config = getMatchConfig();
  setMatchWhiteEngine(config.whiteEngine);
  setMatchBlackEngine(config.blackEngine);
  setMatchWhiteStrength(config.whiteDifficulty);
  setMatchBlackStrength(config.blackDifficulty);
  setMatchMoveTime(config.movetime);
  setMatchPerspective(config.perspective);
  clearGame();

  previousGameOver = false;
  gameEndModal.hide();
  matchScore = { white: 0, black: 0, draws: 0 };
  matchRunning = true;
  matchPaused = false;
  matchPauseRequested = false;
  matchAbortController = new AbortController();
  isProcessingMove = true;

  game = new Game({
    playerColor: config.perspective,
    difficulty: config.whiteDifficulty,
    engine: "builtin",
    onUpdate: syncUIWithGame,
  });

  renderCurrentBoard();
  syncUIWithGame(game.getSnapshot());
  updateMatchControls();
  updateMatchStatus("Engine match started.");

  const adapters = {
    white: createEngineAdapter(config.whiteEngine, { useWorker: true }),
    black: createEngineAdapter(config.blackEngine, { useWorker: true }),
  };

  await runEngineMatchLoop(adapters);
}

async function runEngineMatchLoop(adapters) {
  while (matchRunning && game && !game.isGameOver()) {
    if (matchPauseRequested) {
      matchPaused = true;
      matchRunning = false;
      matchPauseRequested = false;
      isProcessingMove = false;
      syncBusyState(false);
      updateMatchControls();
      updateMatchStatus("Engine match paused.");
      return;
    }

    const config = getMatchConfig();
    const color = game.getCurrentTurn();
    const sideConfig = getMatchSideConfig(config, color);
    const engineId = sideConfig.engineId;
    const adapter = adapters[color] || createEngineAdapter(engineId, { useWorker: true });
    matchCurrentAdapter = adapter;
    syncBusyState(true);
    updateMatchStatus(`${formatMatchSideLabel(color, engineId, sideConfig.difficulty)} is thinking...`);

    try {
      const move = await adapter.findBestMove(game.state, {
        difficulty: sideConfig.difficulty,
        movetime: config.movetime,
        signal: matchAbortController?.signal,
        forColor: color,
        onInfo: (info) => {
          if (info?.depth) {
            updateMatchStatus(`${formatMatchSideLabel(color, engineId, sideConfig.difficulty)} search depth ${info.depth}`);
          }
        },
      });

      if (!matchRunning || matchAbortController?.signal.aborted) break;
      if (!move) {
        updateMatchStatus(`${getEngineDisplayName(engineId)} returned no legal move.`);
        break;
      }

      const result = game.handleEngineMove(move);
      if (!result.success) {
        updateMatchStatus(`${getEngineDisplayName(engineId)} produced an illegal move.`);
        break;
      }

      renderCurrentBoard();
      syncUIWithGame(game.getSnapshot());
      updateMatchScoreText();
      if (!game.isGameOver()) {
        const nextColor = game.getCurrentTurn();
        const nextConfig = getMatchConfig();
        const nextSide = getMatchSideConfig(nextConfig, nextColor);
        updateMatchStatus(`Next: ${formatMatchSideLabel(nextColor, nextSide.engineId, nextSide.difficulty)}.`);
      }
      await delay(160);
    } catch (error) {
      console.error("Engine match error:", error);
      updateMatchStatus("Engine match error.");
      break;
    } finally {
      matchCurrentAdapter = null;
      syncBusyState(false);
    }
  }

  if (game?.isGameOver()) {
    const result = game.getSnapshot().result;
    recordMatchResult(result);
    updateMatchStatus(formatMatchResult(result, getMatchConfig()));
  }

  matchRunning = false;
  matchPaused = false;
  matchPauseRequested = false;
  isProcessingMove = false;
  updateMatchControls();
}

function requestMatchPause() {
  if (!matchRunning) return;
  matchPauseRequested = true;
  updateMatchControls();
  updateMatchStatus("Engine match will pause after this move.");
}

function resumeEngineMatch() {
  if (!matchPaused || !game) return;
  const config = getMatchConfig();
  matchRunning = true;
  matchPaused = false;
  matchPauseRequested = false;
  matchAbortController = new AbortController();
  isProcessingMove = true;
  updateMatchControls();
  runEngineMatchLoop({
    white: createEngineAdapter(config.whiteEngine, { useWorker: true }),
    black: createEngineAdapter(config.blackEngine, { useWorker: true }),
  }).catch((error) => {
    console.error("Engine match resume failed:", error);
    updateMatchStatus("Engine match error.");
    stopEngineMatch();
  });
}

function stopEngineMatch() {
  if (!matchRunning && !matchPaused && !matchAbortController) return;
  matchRunning = false;
  matchPaused = false;
  matchPauseRequested = false;
  matchAbortController?.abort();
  matchAbortController = null;
  matchCurrentAdapter?.stopSearch?.();
  matchCurrentAdapter = null;
  isProcessingMove = false;
  syncBusyState(false);
  updateMatchControls();
}

function recordMatchResult(result) {
  if (!result || result.outcome === "ongoing") return;
  if (result.winner === "white") matchScore.white += 1;
  else if (result.winner === "black") matchScore.black += 1;
  else matchScore.draws += 1;
  updateMatchScoreText();
}

function formatMatchResult(result, config) {
  if (!result || result.outcome === "ongoing") return "Engine match finished.";

  if (result.outcome === "checkmate" && result.winner) {
    const side = getMatchSideConfig(config, result.winner);
    const winner = formatMatchSideLabel(result.winner, side.engineId, side.difficulty);
    return `Checkmate. ${winner} wins.`;
  }

  if (result.outcome === "stalemate") {
    return "Engine match drawn by stalemate.";
  }

  if (result.outcome === "draw") {
    return `Engine match drawn: ${result.reason || "draw"}.`;
  }

  return result.reason || "Engine match finished.";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  const savedColor = getColorChoice();
  if (savedColor !== null) {
    controlsView.setSelectedColor(savedColor);
  }

  const savedEngine = getEngine();
  if (savedEngine !== null) {
    controlsView.setSelectedEngine(savedEngine);
  }

  restoreMatchPreferences();
}

function ensureChangelogModal() {
  if (changelogModal) return changelogModal;
  changelogModal = new ChangelogModal(dom.changelogModalContainer);
  return changelogModal;
}

function setupChangelogTrigger() {
  if (!dom.changelogTrigger) return;
  dom.changelogTrigger.addEventListener("click", () => {
    ensureChangelogModal().show();
  });
}

function setupMobileMenu() {
  if (
    !dom.mobileMenuToggle ||
    !dom.mobileMenuClose ||
    !dom.mobileSideMenu ||
    !dom.mobileMenuControlsSlot ||
    !dom.headerControls ||
    !dom.themeToggleBtn
  ) {
    return;
  }

  const managedControls = [
    dom.disclaimerInfoBtn,
    dom.githubRepoLink,
  ].filter(Boolean);

  const mobileLabels = new Map([
    [dom.disclaimerInfoBtn, "About"],
    [dom.githubRepoLink, "GitHub"],
  ]);

  const mediaQuery = window.matchMedia("(max-width: 575px)");

  const openMenu = () => {
    dom.mobileSideMenu.classList.add("is-open");
    dom.mobileSideMenu.setAttribute("aria-hidden", "false");
    dom.mobileMenuToggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("body-mobile-menu-open");
  };

  const closeMenu = () => {
    dom.mobileSideMenu.classList.remove("is-open");
    dom.mobileSideMenu.setAttribute("aria-hidden", "true");
    dom.mobileMenuToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("body-mobile-menu-open");
  };

  const syncPlacement = () => {
    const isMobile = mediaQuery.matches;
    if (isMobile) {
      managedControls.forEach((control) => {
        if (control.parentElement !== dom.mobileMenuControlsSlot) {
          dom.mobileMenuControlsSlot.appendChild(control);
        }
        const label = mobileLabels.get(control);
        if (label && !control.querySelector(".mobile-menu-label")) {
          const span = document.createElement("span");
          span.className = "mobile-menu-label";
          span.textContent = label;
          control.appendChild(span);
        }
      });
      return;
    }

    managedControls.forEach((control) => {
      const span = control.querySelector(".mobile-menu-label");
      if (span) span.remove();
    });

    const [infoBtn, githubLink] = managedControls;
    if (infoBtn) {
      dom.headerControls.insertBefore(infoBtn, dom.themeToggleBtn);
    }
    if (githubLink) {
      dom.headerControls.insertBefore(githubLink, dom.themeToggleBtn);
    }
    closeMenu();
  };

  dom.mobileMenuToggle.addEventListener("click", () => {
    if (dom.mobileSideMenu.classList.contains("is-open")) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  dom.mobileMenuClose.addEventListener("click", closeMenu);

  dom.mobileSideMenu.addEventListener("click", (event) => {
    if (event.target === dom.mobileSideMenu) {
      closeMenu();
      return;
    }

    if (
      event.target instanceof HTMLElement &&
      event.target.closest("a, button") &&
      dom.mobileMenuControlsSlot.contains(event.target.closest("a, button"))
    ) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dom.mobileSideMenu.classList.contains("is-open")) {
      closeMenu();
    }
  });

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", syncPlacement);
  } else {
    mediaQuery.addListener(syncPlacement);
  }

  syncPlacement();
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
  setupEngineMatchControls();
  setupMobileMenu();
  setupChangelogTrigger();
  setupDisclaimerInfoButton();
  await setupDisclaimerModal();
  restorePreferences();

  const savedGame = currentPlayMode === "human" ? getGame() : null;
  if (savedGame) {
    await restoreGame(savedGame);
  } else {
    dom.statusText.textContent = currentPlayMode === "match"
      ? "Ready for engine match."
      : "Ready. Select settings and click 'New Game' to start.";
  }
}

main().catch(error => {
  console.error('Application initialization failed:', error);
  dom.statusText.textContent = "Failed to initialize application. Please refresh and try again.";
});
