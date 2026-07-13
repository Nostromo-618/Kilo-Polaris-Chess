/**
 * useGameStore — the reactive orchestration layer for Aurora Polaris Chess.
 *
 * This is the Vue port of the old `js/main.js` wiring. It owns the framework-
 * agnostic `Game` engine instance and the engine-vs-engine match loop, exposing
 * reactive state that drives the vd3 chrome (status, history, settings, match
 * controls) plus imperative hooks into the `BoardView` island (which stays a
 * hand-rolled DOM renderer — it uses no vd3 and is game-critical).
 *
 * Module-scope singleton (same pattern as vd3's useToast / useThemePreference):
 * every component shares one game store.
 */
import { reactive, ref, computed } from "vue";
import { Game } from "../../js/Game.js";
import {
  getDisclaimerAccepted,
  getDifficulty,
  setDifficulty,
  getGame,
  setGame,
  clearGame,
  getBoardSize,
  setBoardSize,
  getColorChoice,
  setColorChoice,
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
} from "../../js/storage.js";
import { getTomitankClient } from "../../js/tomitankClient.js";
import {
  createEngineAdapter,
  getEngineDisplayName,
  getEngineStrengthControlLabel,
  getEngineStrengthLabel,
} from "../../js/engineAdapter.js";

const BOARD_SIZE_MIN_PX = 400;
const BOARD_SIZE_MAX_PX = 800;
/** First visit: max board width (slider 100 -> 800px). */
const BOARD_SIZE_SLIDER_DEFAULT = 100;

const boardSliderToMaxWidthPx = (slider) => {
  const s = Math.max(0, Math.min(100, Number(slider)));
  return BOARD_SIZE_MIN_PX + ((BOARD_SIZE_MAX_PX - BOARD_SIZE_MIN_PX) * s) / 100;
};

const applyBoardMaxWidthCss = (slider) => {
  const px = Math.round(boardSliderToMaxWidthPx(slider));
  document.documentElement.style.setProperty("--board-max-width", `${px}px`);
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createGameStore() {
  // ── Reactive UI state (drives the vd3 chrome) ────────────────────────────
  const status = reactive({
    text: "Ready. Select settings and click 'New Game' to start.",
    turn: "",
    lastMove: "",
    busy: false,
  });
  const history = ref([]);

  /** Settings (persisted). Defaults mirror the old Controls.js. */
  const settings = reactive({
    color: getColorChoice() || "random",
    engine: getEngine() || "tomitank",
    difficulty: getDifficulty() ?? 3,
  });

  const playMode = ref(getPlayMode()); // "human" | "match"

  const match = reactive({
    whiteEngine: getMatchWhiteEngine(),
    blackEngine: getMatchBlackEngine(),
    whiteStrength: getMatchWhiteStrength(),
    blackStrength: getMatchBlackStrength(),
    movetime: getMatchMoveTime(),
    perspective: getMatchPerspective(),
    running: false,
    paused: false,
    pauseRequested: false,
    score: { white: 0, black: 0, draws: 0 },
  });

  const boardSizeSlider = ref(
    getBoardSize() ?? BOARD_SIZE_SLIDER_DEFAULT,
  );

  /** Game-end modal payload: `{ result, playerColor }` or null. */
  const gameEndResult = ref(null);


  // ── Non-reactive internals ───────────────────────────────────────────────
  let game = null;
  let boardView = null;
  let isProcessingMove = false;
  let gameSaveThrottle = null;
  let pendingPromotion = null;
  let matchAbortController = null;
  let matchCurrentAdapter = null;
  let previousGameOver = false;

  // ── Board island wiring ──────────────────────────────────────────────────
  function attachBoard(instance) {
    boardView = instance;
    // If a game already exists (HMR / late mount), paint it.
    if (game) renderCurrentBoard();
  }
  function detachBoard() {
    boardView = null;
  }

  function renderCurrentBoard() {
    if (!game || !boardView) return;
    const snapshot = game.getSnapshot();
    const perspective =
      playMode.value === "match" ? match.perspective : game.getPlayerColor();
    boardView.render(game.getBoard(), {
      perspective,
      selected: null,
      legalMoves: [],
      lastMove: snapshot.lastMove,
      checkedKingSquare: game.getCheckedKingSquare(),
    });
  }

  // ── Snapshot -> reactive sync ────────────────────────────────────────────
  function syncUIWithGame(snapshot) {
    if (!snapshot) return;

    status.text = snapshot.statusText || "";
    status.turn = snapshot.turnText || "";
    status.lastMove = snapshot.lastMoveText || "";
    history.value = (snapshot.history || []).slice();

    // Throttled save to localStorage (max once per 500ms), human mode only.
    if (game && !game.isGameOver() && playMode.value !== "match") {
      if (gameSaveThrottle) clearTimeout(gameSaveThrottle);
      gameSaveThrottle = setTimeout(() => {
        try {
          setGame(game.getGameState());
        } catch {
          /* non-critical */
        }
        gameSaveThrottle = null;
      }, 500);
    }

    const isGameOver = snapshot.gameOver || false;
    if (
      isGameOver &&
      !previousGameOver &&
      snapshot.result &&
      playMode.value !== "match"
    ) {
      clearGame();
      gameEndResult.value = {
        result: snapshot.result,
        playerColor: snapshot.playerColor,
      };
    }
    previousGameOver = isGameOver;
  }

  function syncBusyState(isBusy) {
    if (isBusy) {
      status.busy = true;
      status.text = "Computer is thinking...";
    } else {
      status.busy = false;
      if (game && playMode.value !== "match") {
        syncUIWithGame(game.getSnapshot());
      }
    }
  }

  // ── Human game lifecycle ─────────────────────────────────────────────────
  async function initializeGame() {
    clearGame();
    setDifficulty(settings.difficulty);
    setEngine(settings.engine);

    gameEndResult.value = null;
    previousGameOver = false;

    const playerColor = settings.color;
    const { difficulty, engine } = settings;

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
      renderCurrentBoard();
      syncUIWithGame(snapshot);

      if (game.getCurrentTurn() !== game.getPlayerColor() && !game.isGameOver()) {
        requestAnimationFrame(() => {
          if (!game || game.isGameOver()) return;
          if (game.getCurrentTurn() !== game.getPlayerColor()) triggerAIMove();
        });
      }
    } catch (error) {
      console.error("Game initialization error:", error);
      status.text = "Failed to initialize game. Please refresh and try again.";
    }
  }

  async function restoreGame(savedState) {
    previousGameOver = false;
    gameEndResult.value = null;

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
      renderCurrentBoard();
      syncUIWithGame(snapshot);

      if (!game.isGameOver() && game.getCurrentTurn() !== game.getPlayerColor()) {
        requestAnimationFrame(() => {
          if (!game || game.isGameOver()) return;
          if (game.getCurrentTurn() !== game.getPlayerColor()) triggerAIMove();
        });
      }
    } catch (error) {
      console.error("Game restore error:", error);
      clearGame();
      status.text = "Ready. Select settings and click 'New Game' to start.";
    }
  }

  async function newGame() {
    if (isProcessingMove) return;
    if (playMode.value === "match") {
      await startEngineMatch();
      return;
    }
    stopEngineMatch();
    await initializeGame();
  }

  // ── Human move handling ──────────────────────────────────────────────────
  function handleSquareSelected(square) {
    if (isProcessingMove) return;
    if (playMode.value === "match") return;
    if (!game) return;
    if (game.getCurrentTurn() !== game.getPlayerColor()) return;
    if (game.isGameOver()) return;

    const selectedFrom = game.state.selectedSquare;
    if (selectedFrom && game.isPromotionMove(selectedFrom, square)) {
      pendingPromotion = { from: selectedFrom, to: square };
      boardView?.showPromotionPicker(square, game.getPlayerColor());
      return;
    }

    const result = game.handlePlayerSquareSelection(square, "Q");
    if (!result.changed) {
      boardView?.updateHighlights({
        selected: result.selected,
        legalMoves: result.legalTargets,
        lastMove: result.lastMove,
        checkedKingSquare: game.getCheckedKingSquare(),
      });
      return;
    }
    completePlayerMove();
  }

  function handlePromotionPicked(piece) {
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
    if (boardView) {
      boardView.render(game.getBoard(), {
        perspective: game.getPlayerColor(),
        selected: null,
        legalMoves: [],
        lastMove: snapshot.lastMove,
        checkedKingSquare: game.getCheckedKingSquare(),
      });
    }
    if (!game.isGameOver()) {
      requestAnimationFrame(() => {
        if (!game || game.isGameOver()) return;
        if (game.getCurrentTurn() !== game.getPlayerColor()) triggerAIMove();
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
      if (boardView) {
        boardView.render(game.getBoard(), {
          perspective: game.getPlayerColor(),
          selected: null,
          legalMoves: [],
          lastMove: snapshot.lastMove,
          checkedKingSquare: game.getCheckedKingSquare(),
        });
      }
    } catch (error) {
      console.error("AI move error:", error);
      status.text = "An error occurred while computing AI move.";
    } finally {
      isProcessingMove = false;
      syncBusyState(false);
    }
  }

  // ── Settings setters (persist) ───────────────────────────────────────────
  function setColor(color) {
    if (!["white", "black", "random"].includes(color)) return;
    settings.color = color;
    setColorChoice(color);
  }
  function setEngineChoice(engine) {
    if (engine !== "builtin" && engine !== "tomitank") return;
    settings.engine = engine;
    setEngine(engine);
    // Apply live: the current game's next AI move uses the new engine (each move
    // sends the position, so no reset is needed).
    if (game) game.engine = engine;
  }
  function setDifficultyChoice(level) {
    const clamped = Math.max(1, Math.min(6, Number(level) || 3));
    settings.difficulty = clamped;
    // Apply live: the current game's next AI move uses the new strength.
    if (game) game.setDifficulty(clamped);
  }

  function setPlayModeChoice(mode) {
    playMode.value = mode === "match" ? "match" : "human";
    setPlayMode(playMode.value);
    if (playMode.value === "human") {
      stopEngineMatch();
      if (!game)
        status.text = "Ready. Select settings and click 'New Game' to start.";
    } else {
      // Cancel any pending throttled save so a stale timer can't re-write
      // kpc-game after we clear it (a latent race also present in the original).
      if (gameSaveThrottle) {
        clearTimeout(gameSaveThrottle);
        gameSaveThrottle = null;
      }
      clearGame();
      status.text = "Ready for engine match.";
    }
  }

  function setMatchField(field, value) {
    match[field] = value;
    const persist = {
      whiteEngine: setMatchWhiteEngine,
      blackEngine: setMatchBlackEngine,
      whiteStrength: setMatchWhiteStrength,
      blackStrength: setMatchBlackStrength,
      movetime: setMatchMoveTime,
      perspective: setMatchPerspective,
    }[field];
    persist?.(value);
    if (field === "perspective" && game && playMode.value === "match") {
      renderCurrentBoard();
    }
  }

  function setBoardSizeSlider(v) {
    const value = Math.max(0, Math.min(100, Number(v) || 0));
    boardSizeSlider.value = value;
    applyBoardMaxWidthCss(value);
    setBoardSize(value);
  }

  // ── Engine match ─────────────────────────────────────────────────────────
  const matchStrengthLabels = computed(() => ({
    white: `White ${getEngineStrengthControlLabel(match.whiteEngine)}`,
    black: `Black ${getEngineStrengthControlLabel(match.blackEngine)}`,
  }));

  const matchScoreText = computed(
    () =>
      `Score: White ${match.score.white} / Draws ${match.score.draws} / Black ${match.score.black}`,
  );

  const matchControls = computed(() => ({
    startDisabled: match.running && !match.paused,
    pauseStopDisabled: !match.running && !match.paused,
    pauseLabel: match.paused
      ? "Resume"
      : match.pauseRequested
        ? "Pausing"
        : "Pause",
  }));

  function getMatchConfig() {
    return {
      whiteEngine: match.whiteEngine,
      blackEngine: match.blackEngine,
      whiteDifficulty: match.whiteStrength,
      blackDifficulty: match.blackStrength,
      perspective: match.perspective,
      movetime: match.movetime,
    };
  }

  function getMatchSideConfig(config, color) {
    const isWhite = color === "white";
    return {
      engineId: isWhite ? config.whiteEngine : config.blackEngine,
      difficulty: isWhite ? config.whiteDifficulty : config.blackDifficulty,
    };
  }

  function formatMatchSideLabel(color, engineId, difficulty) {
    const colorLabel = color === "white" ? "White" : "Black";
    return `${colorLabel} ${getEngineDisplayName(engineId)} (${getEngineStrengthLabel(engineId, difficulty)})`;
  }

  function updateMatchStatus(text) {
    status.text = text;
  }

  async function startEngineMatch() {
    if (match.running || match.paused) stopEngineMatch();

    // Self-healing: a throw during setup (or the loop) must not leave the match
    // state machine wedged with `running`/`isProcessingMove` stuck true — mirrors
    // the original Start button's `.catch(() => stopEngineMatch())`.
    try {
      const config = getMatchConfig();
      clearGame();

      previousGameOver = false;
      gameEndResult.value = null;
      match.score = { white: 0, black: 0, draws: 0 };
      match.running = true;
      match.paused = false;
      match.pauseRequested = false;
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
      updateMatchStatus("Engine match started.");

      const adapters = {
        white: createEngineAdapter(config.whiteEngine, { useWorker: true }),
        black: createEngineAdapter(config.blackEngine, { useWorker: true }),
      };

      await runEngineMatchLoop(adapters);
    } catch (error) {
      console.error("Engine match start failed:", error);
      stopEngineMatch();
      updateMatchStatus("Engine match failed to start.");
    }
  }

  async function runEngineMatchLoop(adapters) {
    while (match.running && game && !game.isGameOver()) {
      if (match.pauseRequested) {
        match.paused = true;
        match.running = false;
        match.pauseRequested = false;
        isProcessingMove = false;
        syncBusyState(false);
        updateMatchStatus("Engine match paused.");
        return;
      }

      const config = getMatchConfig();
      const color = game.getCurrentTurn();
      const sideConfig = getMatchSideConfig(config, color);
      const engineId = sideConfig.engineId;
      const adapter =
        adapters[color] || createEngineAdapter(engineId, { useWorker: true });
      matchCurrentAdapter = adapter;
      syncBusyState(true);
      updateMatchStatus(
        `${formatMatchSideLabel(color, engineId, sideConfig.difficulty)} is thinking...`,
      );

      try {
        const move = await adapter.findBestMove(game.state, {
          difficulty: sideConfig.difficulty,
          movetime: config.movetime,
          signal: matchAbortController?.signal,
          forColor: color,
          onInfo: (info) => {
            if (info?.depth) {
              updateMatchStatus(
                `${formatMatchSideLabel(color, engineId, sideConfig.difficulty)} search depth ${info.depth}`,
              );
            }
          },
        });

        if (!match.running || matchAbortController?.signal.aborted) break;
        if (!move) {
          updateMatchStatus(
            `${getEngineDisplayName(engineId)} returned no legal move.`,
          );
          break;
        }

        const result = game.handleEngineMove(move);
        if (!result.success) {
          updateMatchStatus(
            `${getEngineDisplayName(engineId)} produced an illegal move.`,
          );
          break;
        }

        renderCurrentBoard();
        syncUIWithGame(game.getSnapshot());
        if (!game.isGameOver()) {
          const nextColor = game.getCurrentTurn();
          const nextSide = getMatchSideConfig(getMatchConfig(), nextColor);
          updateMatchStatus(
            `Next: ${formatMatchSideLabel(nextColor, nextSide.engineId, nextSide.difficulty)}.`,
          );
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

    match.running = false;
    match.paused = false;
    match.pauseRequested = false;
    isProcessingMove = false;
  }

  function requestMatchPause() {
    if (!match.running) return;
    match.pauseRequested = true;
    updateMatchStatus("Engine match will pause after this move.");
  }

  function resumeEngineMatch() {
    if (!match.paused || !game) return;
    const config = getMatchConfig();
    match.running = true;
    match.paused = false;
    match.pauseRequested = false;
    matchAbortController = new AbortController();
    isProcessingMove = true;
    runEngineMatchLoop({
      white: createEngineAdapter(config.whiteEngine, { useWorker: true }),
      black: createEngineAdapter(config.blackEngine, { useWorker: true }),
    }).catch((error) => {
      console.error("Engine match resume failed:", error);
      updateMatchStatus("Engine match error.");
      stopEngineMatch();
    });
  }

  function pauseOrResumeMatch() {
    if (match.paused) resumeEngineMatch();
    else requestMatchPause();
  }

  function stopEngineMatch() {
    if (!match.running && !match.paused && !matchAbortController) return;
    match.running = false;
    match.paused = false;
    match.pauseRequested = false;
    matchAbortController?.abort();
    matchAbortController = null;
    matchCurrentAdapter?.stopSearch?.();
    matchCurrentAdapter = null;
    isProcessingMove = false;
    syncBusyState(false);
  }

  function stopMatchWithStatus() {
    stopEngineMatch();
    status.text = "Engine match stopped.";
  }

  function recordMatchResult(result) {
    if (!result || result.outcome === "ongoing") return;
    if (result.winner === "white") match.score.white += 1;
    else if (result.winner === "black") match.score.black += 1;
    else match.score.draws += 1;
  }

  function formatMatchResult(result, config) {
    if (!result || result.outcome === "ongoing")
      return "Engine match finished.";
    if (result.outcome === "checkmate" && result.winner) {
      const side = getMatchSideConfig(config, result.winner);
      const winner = formatMatchSideLabel(
        result.winner,
        side.engineId,
        side.difficulty,
      );
      return `Checkmate. ${winner} wins.`;
    }
    if (result.outcome === "stalemate")
      return "Engine match drawn by stalemate.";
    if (result.outcome === "draw")
      return `Engine match drawn: ${result.reason || "draw"}.`;
    return result.reason || "Engine match finished.";
  }

  // ── Bootstrap (called once on app mount) ─────────────────────────────────
  async function restore() {
    applyBoardMaxWidthCss(boardSizeSlider.value);
    if (getBoardSize() === null) setBoardSize(boardSizeSlider.value);

    if (playMode.value === "match") {
      status.text = "Ready for engine match.";
      return;
    }
    const savedGame = getGame();
    if (savedGame) {
      await restoreGame(savedGame);
    } else {
      status.text = "Ready. Select settings and click 'New Game' to start.";
    }
  }

  return {
    // reactive state
    status,
    history,
    settings,
    playMode,
    match,
    boardSizeSlider,
    gameEndResult,
    // computed
    matchStrengthLabels,
    matchScoreText,
    matchControls,
    // board island
    attachBoard,
    detachBoard,
    // lifecycle + actions
    restore,
    newGame,
    handleSquareSelected,
    handlePromotionPicked,
    handlePromotionCancelled,
    setColor,
    setEngineChoice,
    setDifficultyChoice,
    setPlayModeChoice,
    setMatchField,
    setBoardSizeSlider,
    startEngineMatch,
    pauseOrResumeMatch,
    stopMatch: stopMatchWithStatus,
    // helpers exposed for disclaimer gate
    getDisclaimerAccepted,
  };
}

let store = null;
/** Shared singleton game store. */
export function useGameStore() {
  if (!store) store = createGameStore();
  return store;
}
