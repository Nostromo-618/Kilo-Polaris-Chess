/**
 * GameState.js
 *
 * Single source of truth for chess game state.
 * Responsibilities:
 * - Track:
 *   - board[64]
 *   - activeColor ("white"|"black")
 *   - castlingRights
 *   - enPassantTarget
 *   - halfmoveClock, fullmoveNumber
 *   - playerColor (human side)
 *   - moveHistory (long algebraic strings, e.g. e2-e4; legacy saves may contain SAN)
 *   - repetitionMap for threefold repetition
 * - Apply moves (including:
 *   - promotions
 *   - castling rook movement
 *   - en passant captures
 *   - castling rights updates
 *   - 50-move rule)
 * - Provide legal moves via Rules.generateLegalMoves
 * - Provide selection helper used by Game for UI click flow
 * - Compute detailed status text with check/checkmate/stalemate/draws
 */

import {
  createStartingBoard,
  algebraicToIndex,
  indexToAlgebraic,
  getColorOf,
  oppositeColor,
  cloneBoard,
  boardToMap,
} from "./Board.js";
import { generateLegalMoves, isInCheck, analyzePosition } from "./Rules.js";

/**
 * @typedef {import("./Move.js").Move} Move
 */

/**
 * @typedef {Object} GameSnapshot
 * @property {Record<string,string|null>} board
 * @property {"white"|"black"} activeColor
 * @property {"white"|"black"} playerColor
 * @property {boolean} gameOver
 * @property {string} statusText
 * @property {string} turnText
 * @property {string|null} lastMoveText
 * @property {{from:string,to:string}|null} lastMove
 * @property {string[]} history - long algebraic per move (e.g. e2-e4); legacy entries may be SAN
 * @property {{outcome:string,winner?:string|null,reason?:string}|null} result
 */

export class GameState {
  /**
   * Create starting state with standard position.
   * @param {"white"|"black"} playerColor
   * @returns {GameState}
   */
  static createStarting(playerColor) {
    const state = new GameState();
    state.board = createStartingBoard();
    state.activeColor = "white";
    state.playerColor = playerColor;
    state.castlingRights = {
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true },
    };
    state.enPassantTarget = null;
    state.halfmoveClock = 0;
    state.fullmoveNumber = 1;
    state.moveHistory = [];
    state.result = null;
    state.lastMove = null;
    state.repetitionMap = new Map();
    state.recordRepetitionKey();
    state.updateStatusText();
    return state;
  }

  constructor(data = null) {
    if (data) {
      this.board = data.board ? (Array.isArray(data.board) ? data.board : Object.values(data.board)) : new Array(64).fill(null);
      this.activeColor = data.activeColor || "white";
      this.playerColor = data.playerColor || "white";
      this.castlingRights = data.castlingRights || {
        white: { kingSide: true, queenSide: true },
        black: { kingSide: true, queenSide: true },
      };
      this.enPassantTarget = data.enPassantTarget || null;
      this.halfmoveClock = data.halfmoveClock || 0;
      this.fullmoveNumber = data.fullmoveNumber || 1;
      this.moveHistory = data.moveHistory || [];
      this.result = data.result || null;
      this.lastMove = data.lastMove || null;

      this.repetitionMap = new Map();
      if (data.repetitionMap) {
        if (Array.isArray(data.repetitionMap)) {
          data.repetitionMap.forEach(([k, v]) => this.repetitionMap.set(k, v));
        } else {
          Object.entries(data.repetitionMap).forEach(([k, v]) => this.repetitionMap.set(k, v));
        }
      }

      this.selectedSquare = null;
      this.cachedLegalTargets = [];
    } else {
      this.board = new Array(64).fill(null);
      this.activeColor = "white";
      this.playerColor = "white";
      this.castlingRights = {
        white: { kingSide: true, queenSide: true },
        black: { kingSide: true, queenSide: true },
      };
      this.enPassantTarget = null;
      this.halfmoveClock = 0;
      this.fullmoveNumber = 1;
      this.moveHistory = [];
      this.result = null;
      this.lastMove = null;
      this.repetitionMap = new Map();
      this.selectedSquare = null;
      this.cachedLegalTargets = [];
    }
  }

  /**
   * Serialize state for worker/API transport
   */
  serialize() {
    return {
      board: this.board,
      activeColor: this.activeColor,
      playerColor: this.playerColor,
      castlingRights: this.castlingRights,
      enPassantTarget: this.enPassantTarget,
      halfmoveClock: this.halfmoveClock,
      fullmoveNumber: this.fullmoveNumber,
      moveHistory: this.moveHistory,
      result: this.result,
      lastMove: this.lastMove,
      repetitionMap: Array.from(this.repetitionMap.entries())
    };
  }

  /**
   * Returns a map representation of the board for UI.
   * @returns {Record<string,string|null>}
   */
  getBoardMap() {
    return boardToMap(this.board);
  }

  /**
   * Get current snapshot for UI.
   * @returns {GameSnapshot}
   */
  getSnapshot() {
    return {
      board: this.getBoardMap(),
      activeColor: this.activeColor,
      playerColor: this.playerColor,
      gameOver: this.isGameOver(),
      statusText: this.statusText || "",
      turnText:
        this.isGameOver() || !this.activeColor
          ? ""
          : this.activeColor === this.playerColor
            ? "Your move"
            : "Computer's move",
      lastMoveText: this.lastMoveText || null,
      lastMove: this.lastMove
        ? { from: this.lastMove.from, to: this.lastMove.to }
        : null,
      history: this.moveHistory.slice(),
      selectedSquare: this.selectedSquare,
      legalTargets: this.cachedLegalTargets.slice(),
      result: this.result ? { ...this.result } : null,
    };
  }

  /**
   * Whether game is in a terminal state.
   */
  isGameOver() {
    return !!this.result && this.result.outcome !== "ongoing";
  }

  /**
   * Handle single-square click selection logic for a given side.
   * Encapsulates:
   * - Selecting own piece to see legal moves.
   * - Selecting target square to execute chosen move.
   *
   * @param {string} square
   * @param {"white"|"black"} side
   * @returns {{
   *   moved: boolean,
   *   selectedSquare: string|null,
   *   legalTargets: string[],
   * }}
   */
  handleSelection(square, side) {
    if (this.isGameOver()) {
      return { moved: false, selectedSquare: null, legalTargets: [] };
    }
    if (side !== this.activeColor) {
      // Ignore clicks when it's not this side's turn.
      return {
        moved: false,
        selectedSquare: this.selectedSquare,
        legalTargets: this.cachedLegalTargets.slice(),
      };
    }

    const piece = this.getPiece(square);
    const pieceColor = getColorOf(piece);

    // If clicking own piece, (re)select and compute its legal moves
    if (piece && pieceColor === side) {
      this.selectedSquare = square;
      const allLegal = generateLegalMoves(this.asRulesState());
      const targets = allLegal
        .filter((m) => m.from === square)
        .map((m) => m.to);
      this.cachedLegalTargets = targets;
      return {
        moved: false,
        selectedSquare: square,
        legalTargets: targets,
      };
    }

    // If a piece is selected and user clicks destination, try to move.
    if (this.selectedSquare) {
      const from = this.selectedSquare;
      const to = square;
      const allLegal = generateLegalMoves(this.asRulesState());
      const move = allLegal.find((m) => m.from === from && m.to === to);

      if (move) {
        this.applyMove(move);
        this.selectedSquare = null;
        this.cachedLegalTargets = [];
        return {
          moved: true,
          selectedSquare: null,
          legalTargets: [],
        };
      }

      // If clicked another own piece, re-select handled above; reaching here means invalid -> clear selection.
      this.selectedSquare = null;
      this.cachedLegalTargets = [];
      return {
        moved: false,
        selectedSquare: null,
        legalTargets: [],
      };
    }

    // No selection, click on empty or enemy: ignore.
    return {
      moved: false,
      selectedSquare: this.selectedSquare,
      legalTargets: this.cachedLegalTargets.slice(),
    };
  }

  /**
   * Apply a fully-legal move to this state.
   * Responsible for all chess state transitions.
   * @param {Move} move
   */
  applyMove(move) {
    if (this.isGameOver()) return;

    const fromIndex = algebraicToIndex(move.from);
    const toIndex = algebraicToIndex(move.to);
    const movingPiece = this.board[fromIndex];
    const color = getColorOf(movingPiece);
    const enemy = oppositeColor(color);

    // Half-move clock (reset on capture or pawn move)
    const isPawn = movingPiece && movingPiece[1] === "P";
    const isCapture = !!(move.captured || move.isEnPassant);
    if (isPawn || isCapture) {
      this.halfmoveClock = 0;
    } else {
      this.halfmoveClock += 1;
    }

    // Clear en passant target
    this.enPassantTarget = null;

    // Remove piece from origin
    this.board[fromIndex] = null;

    // En passant capture
    if (move.isEnPassant) {
      const dir = color === "white" ? -1 : 1;
      const { file, rank } = this.indexFR(toIndex);
      const capIndex = (rank + dir) * 8 + file;
      this.board[capIndex] = null;
    }

    // Castling: move rook accordingly
    if (move.isCastleKingSide || move.isCastleQueenSide) {
      const rank = color === "white" ? 0 : 7;
      if (move.isCastleKingSide) {
        // King: e -> g, Rook: h -> f
        const rookFrom = rank * 8 + 7;
        const rookTo = rank * 8 + 5;
        this.board[rookTo] = this.board[rookFrom];
        this.board[rookFrom] = null;
      } else {
        // King: e -> c, Rook: a -> d
        const rookFrom = rank * 8 + 0;
        const rookTo = rank * 8 + 3;
        this.board[rookTo] = this.board[rookFrom];
        this.board[rookFrom] = null;
      }
    }

    // Promotions
    if (move.promotion) {
      const prefix = color === "white" ? "w" : "b";
      this.board[toIndex] = `${prefix}${move.promotion}`;
    } else {
      this.board[toIndex] = movingPiece;
    }

    // Set en passant target if pawn moved two squares
    if (isPawn) {
      const { rank: fromRank } = this.indexFR(fromIndex);
      const { rank: toRank } = this.indexFR(toIndex);
      if (Math.abs(toRank - fromRank) === 2) {
        const epRank = (fromRank + toRank) / 2;
        const { file } = this.indexFR(toIndex);
        const epIndex = epRank * 8 + file;
        this.enPassantTarget = indexToAlgebraic(epIndex);
      }
    }

    // Update castling rights
    this.updateCastlingRights(move, fromIndex, toIndex, movingPiece, color);

    // Active color and fullmove number
    this.activeColor = enemy;
    if (color === "black") {
      this.fullmoveNumber += 1;
    }

    // Record lastMove and history entry (long algebraic: from-to)
    this.lastMove = { from: move.from, to: move.to };
    const longAlg = this.formatLongAlgebraic(move);
    this.moveHistory.push(longAlg);
    this.lastMoveText = `${this.fullmoveNumber}. ${longAlg}`;

    // Repetition tracking
    this.recordRepetitionKey();

    // Determine game result
    this.updateResult();
    this.updateStatusText();
  }

  /**
   * Internal: update castling rights based on move.
   */
  updateCastlingRights(move, fromIndex, toIndex, movingPiece, color) {
    const { castlingRights, board } = this;
    const fromSq = move.from;
    const toSq = move.to;

    // If king moves, lose both sides
    if (movingPiece === "wK") {
      castlingRights.white.kingSide = false;
      castlingRights.white.queenSide = false;
    }
    if (movingPiece === "bK") {
      castlingRights.black.kingSide = false;
      castlingRights.black.queenSide = false;
    }

    // If rook moves or is captured from corners, adjust rights
    if (fromSq === "h1" || toSq === "h1") {
      castlingRights.white.kingSide = false;
    }
    if (fromSq === "a1" || toSq === "a1") {
      castlingRights.white.queenSide = false;
    }
    if (fromSq === "h8" || toSq === "h8") {
      castlingRights.black.kingSide = false;
    }
    if (fromSq === "a8" || toSq === "a8") {
      castlingRights.black.queenSide = false;
    }

    // Ensure rights are consistent if rooks are missing.
    if (board[algebraicToIndex("h1")] !== "wR") {
      castlingRights.white.kingSide = false;
    }
    if (board[algebraicToIndex("a1")] !== "wR") {
      castlingRights.white.queenSide = false;
    }
    if (board[algebraicToIndex("h8")] !== "bR") {
      castlingRights.black.kingSide = false;
    }
    if (board[algebraicToIndex("a8")] !== "bR") {
      castlingRights.black.queenSide = false;
    }
  }

  /**
   * Compute and store game result (checkmate, stalemate, draw).
   * Uses full draw rules: stalemate, insufficient material,
   * threefold repetition, fifty-move rule.
   */
  updateResult() {
    if (this.result && this.result.outcome !== "ongoing") {
      return;
    }

    const rulesState = this.asRulesState();
    const { hasLegalMoves, isCheck } = analyzePosition(rulesState);

    // Checkmate / stalemate
    if (!hasLegalMoves) {
      if (isCheck) {
        this.result = {
          outcome: "checkmate",
          winner: oppositeColor(this.activeColor),
          reason: "Checkmate",
        };
      } else {
        this.result = {
          outcome: "stalemate",
          winner: null,
          reason: "Stalemate",
        };
      }
      return;
    }

    // 50-move rule
    if (this.halfmoveClock >= 100) {
      this.result = {
        outcome: "draw",
        winner: null,
        reason: "50-move rule",
      };
      return;
    }

    // Threefold repetition
    if (this.hasThreefoldRepetition()) {
      this.result = {
        outcome: "draw",
        winner: null,
        reason: "Threefold repetition",
      };
      return;
    }

    // Insufficient material
    if (this.isInsufficientMaterial()) {
      this.result = {
        outcome: "draw",
        winner: null,
        reason: "Insufficient material",
      };
      return;
    }

    // Otherwise ongoing
    this.result = { outcome: "ongoing" };
  }

  /**
   * Update human-readable statusText based on result and position.
   */
  updateStatusText() {
    if (!this.result || this.result.outcome === "ongoing") {
      const colorText = this.activeColor === "white" ? "White" : "Black";
      const perspective =
        this.activeColor === this.playerColor ? "Your move" : "Computer's move";
      this.statusText = `${colorText} to move. ${perspective}.`;
      return;
    }

    switch (this.result.outcome) {
      case "checkmate": {
        const winner = this.result.winner === "white" ? "White" : "Black";
        const youWin =
          this.result.winner === this.playerColor ? "You win." : "Computer wins.";
        this.statusText = `Checkmate. ${winner} wins. ${youWin}`;
        break;
      }
      case "stalemate":
        this.statusText = "Draw by stalemate.";
        break;
      case "draw":
        this.statusText = `Draw: ${this.result.reason || "by agreement"}.`;
        break;
      default:
        this.statusText = "";
        break;
    }
  }

  /**
   * Build a compact key for repetition tracking based on:
   * - piece placement
   * - active color
   * - castling rights
   * - en passant file (if any)
   */
  recordRepetitionKey() {
    const key = this.buildRepetitionKey();
    const prev = this.repetitionMap.get(key) || 0;
    this.repetitionMap.set(key, prev + 1);
  }

  buildRepetitionKey() {
    const boardPart = this.board.join(",");
    const active = this.activeColor;
    const cr = this.castlingRights;
    const crPart = [
      cr.white.kingSide ? "K" : "",
      cr.white.queenSide ? "Q" : "",
      cr.black.kingSide ? "k" : "",
      cr.black.queenSide ? "q" : "",
    ].join("");
    const ep = this.enPassantTarget || "-";
    return `${boardPart}|${active}|${crPart}|${ep}`;
  }

  hasThreefoldRepetition() {
    for (const count of this.repetitionMap.values()) {
      if (count >= 3) return true;
    }
    return false;
  }

  /**
   * Basic insufficient material detection:
   * - King vs King
   * - King + bishop vs King
   * - King + knight vs King
   * - King + bishop vs King + bishop (same color complexes)
   */
  isInsufficientMaterial() {
    const pieces = [];
    for (const p of this.board) {
      if (!p) continue;
      if (p[1] === "K") continue;
      pieces.push(p);
    }

    if (pieces.length === 0) return true; // K vs K

    if (pieces.length === 1) {
      const p = pieces[0];
      if (p[1] === "B" || p[1] === "N") {
        return true;
      }
    }

    if (pieces.length === 2) {
      const [a, b] = pieces;
      if (a[1] === "B" && b[1] === "B") {
        // Approximation: treat as insufficient (ignores opposite colors nuance).
        return true;
      }
    }

    return false;
  }

  /**
   * Helper: board[index] to (file,rank)
   */
  indexFR(index) {
    const file = index % 8;
    const rank = Math.floor(index / 8);
    return { file, rank };
  }

  /**
   * Get piece by algebraic square.
   * @param {string} sq
   * @returns {string|null}
   */
  getPiece(sq) {
    return this.board[algebraicToIndex(sq)] || null;
  }

  /**
   * Produce a reduced state object for Rules module.
   */
  asRulesState() {
    return {
      board: this.board,
      activeColor: this.activeColor,
      castlingRights: this.castlingRights,
      enPassantTarget: this.enPassantTarget,
    };
  }

  /**
   * Long algebraic notation: from-to squares, optional =PROMOTION (e.g. e7-e8=Q).
   * @param {Move} move
   * @returns {string}
   */
  formatLongAlgebraic(move) {
    let s = `${move.from}-${move.to}`;
    if (move.promotion) {
      s += `=${move.promotion}`;
    }
    return s;
  }

  /**
   * Simplified SAN-like notation for history display.
   * Uses lightweight board copy instead of full state clone for check detection.
   */
  toSimpleSAN(move, movingPiece, isCapture) {
    const pieceType = movingPiece[1];
    const from = move.from;
    const to = move.to;
    let san = "";

    if (move.isCastleKingSide) {
      san = "O-O";
    } else if (move.isCastleQueenSide) {
      san = "O-O-O";
    } else {
      if (pieceType !== "P") {
        san += pieceType;
      } else if (isCapture) {
        san += from[0];
      }
      if (isCapture) san += "x";
      san += to;

      if (move.promotion) {
        san += `=${move.promotion}`;
      }
    }

    // Lightweight check detection using board copy only
    const { isCheck, hasLegalMoves } = this.detectCheckAfterMove(move);
    if (isCheck && !hasLegalMoves) {
      san += "#";
    } else if (isCheck) {
      san += "+";
    }

    return san;
  }

  /**
   * Detect if a move gives check, using only a board copy.
   * Avoids cloning the full GameState.
   */
  detectCheckAfterMove(move) {
    const board = cloneBoard(this.board);
    const fromIndex = algebraicToIndex(move.from);
    const toIndex = algebraicToIndex(move.to);
    const movingPiece = board[fromIndex];
    const color = getColorOf(movingPiece);
    const enemy = oppositeColor(color);

    board[fromIndex] = null;

    if (move.isEnPassant) {
      const dir = color === "white" ? -1 : 1;
      const { file, rank } = this.indexFR(toIndex);
      board[(rank + dir) * 8 + file] = null;
    }

    if (move.isCastleKingSide || move.isCastleQueenSide) {
      const rank = color === "white" ? 0 : 7;
      if (move.isCastleKingSide) {
        board[rank * 8 + 5] = board[rank * 8 + 7];
        board[rank * 8 + 7] = null;
      } else {
        board[rank * 8 + 3] = board[rank * 8 + 0];
        board[rank * 8 + 0] = null;
      }
    }

    if (move.promotion) {
      board[toIndex] = `${color === "white" ? "w" : "b"}${move.promotion}`;
    } else {
      board[toIndex] = movingPiece;
    }

    const tempState = {
      board,
      activeColor: enemy,
      castlingRights: this.castlingRights,
      enPassantTarget: this.enPassantTarget,
    };

    const { hasLegalMoves, isCheck } = analyzePosition(tempState);
    return { isCheck, hasLegalMoves };
  }
}
