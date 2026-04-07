/**
 * AI.js
 *
 * Chess engine search implementation with 6 difficulty levels.
 * - Pure JS, no external dependencies.
 * - Uses:
 *   - Legal move generation from Rules.js
 *   - Static evaluation from Evaluator.js
 *   - Minimax with alpha-beta pruning
 *   - Zobrist hashing for transposition table
 *   - MVV-LVA move ordering
 *   - Killer move heuristic
 *   - History heuristic
 *   - Null move pruning
 *   - Late move reductions (LMR)
 *   - Quiescence search
 *   - Slight randomness at lower levels for variety
 *
 * Level 6 additions:
 *   - Search depth 7 with zero randomness
 *   - Futility pruning at shallow depths
 *   - Reverse futility pruning (static null move pruning)
 *   - Logarithmic LMR reductions
 *   - Enhanced quiescence (delta pruning, MVV-LVA, no cap)
 *   - TT move ordering priority
 *   - Tighter aspiration windows with progressive widening
 *   - Larger transposition table (500k entries)
 *
 * Difficulty mapping (approx; depth is ply, not full moves):
 *   1: depth 1 (material + small noise, some randomness)
 *   2: depth 2
 *   3: depth 3
 *   4: depth 4 + quiescence + null move
 *   5: depth 5 + quiescence + null move + LMR (full optimizations)
 *   6: depth 7 + all Level 5 features + futility/RFP + enhanced quiescence + zero randomness
 */

import { oppositeColor, cloneBoard } from "./Board.js";
import { generateLegalMoves, isInCheck } from "./Rules.js";
import { evaluate } from "./Evaluator.js";

/**
 * Piece values used for ordering / randomness bands.
 * Keep in sync with Evaluator.js values.
 */
const PIECE_VALUES = {
  P: 100,
  N: 320,
  B: 330,
  R: 500,
  Q: 900,
  K: 0,
};

/* === Zobrist Hashing === */

const PIECE_CODES = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"];
const PIECE_INDEX = {};
for (let i = 0; i < PIECE_CODES.length; i++) {
  PIECE_INDEX[PIECE_CODES[i]] = i;
}

// Pre-computed random 64-bit BigInt values for Zobrist hashing
// 12 piece types * 64 squares = 768 values
function random64() {
  // Generate 64-bit random BigInt
  return BigInt(Math.floor(Math.random() * 0xFFFFFFFF)) | 
         (BigInt(Math.floor(Math.random() * 0xFFFFFFFF)) << 32n);
}

const ZOBRIST_PIECES = new Array(12);
for (let p = 0; p < 12; p++) {
  ZOBRIST_PIECES[p] = new Array(64);
  for (let s = 0; s < 64; s++) {
    ZOBRIST_PIECES[p][s] = random64();
  }
}

// Side to move (1 value)
const ZOBRIST_SIDE = random64();

// Castling rights (4 bits = 16 values)
const ZOBRIST_CASTLING = new Array(16);
for (let i = 0; i < 16; i++) {
  ZOBRIST_CASTLING[i] = random64();
}

// En passant file (8 files)
const ZOBRIST_EP_FILE = new Array(8);
for (let i = 0; i < 8; i++) {
  ZOBRIST_EP_FILE[i] = random64();
}

/**
 * Compute the Zobrist hash for a position.
 * @param {Object} state - board, activeColor, castlingRights, enPassantTarget
 * @returns {BigInt} 64-bit hash
 * @internal - exposed for testing
 */
export function _computeZobristHash(state) {
  let hash = 0n;
  const { board, activeColor, castlingRights, enPassantTarget } = state;

  // Hash pieces on board
  for (let i = 0; i < 64; i++) {
    const piece = board[i];
    if (piece) {
      const idx = PIECE_INDEX[piece];
      if (idx !== undefined) {
        hash ^= ZOBRIST_PIECES[idx][i];
      }
    }
  }

  // Hash side to move
  if (activeColor === "black") {
    hash ^= ZOBRIST_SIDE;
  }

  // Hash castling rights
  let castlingHash = 0;
  if (castlingRights.white.kingSide) castlingHash |= 1;
  if (castlingRights.white.queenSide) castlingHash |= 2;
  if (castlingRights.black.kingSide) castlingHash |= 4;
  if (castlingRights.black.queenSide) castlingHash |= 8;
  hash ^= ZOBRIST_CASTLING[castlingHash];

  // Hash en passant file
  if (enPassantTarget) {
    const epFile = enPassantTarget.charCodeAt(0) - 97;
    if (epFile >= 0 && epFile < 8) {
      hash ^= ZOBRIST_EP_FILE[epFile];
    }
  }

  return hash;
}

/**
 * Convert castling rights to an index (0-15) for Zobrist hashing.
 */
function castlingIndex(castlingRights) {
  let idx = 0;
  if (castlingRights.white.kingSide) idx |= 1;
  if (castlingRights.white.queenSide) idx |= 2;
  if (castlingRights.black.kingSide) idx |= 4;
  if (castlingRights.black.queenSide) idx |= 8;
  return idx;
}

/* === Fast algebraic helpers (engine internal use) === */

function algebraicToIndexFast(sq) {
  const file = sq.charCodeAt(0) - 97;
  const rank = sq.charCodeAt(1) - 49;
  return rank * 8 + file;
}

function indexToAlgebraicFast(index) {
  const file = String.fromCharCode(97 + (index % 8));
  const rank = String.fromCharCode(49 + Math.floor(index / 8));
  return file + rank;
}

/**
 * Internal representation wrapper for search.
 * Supports incremental makeMove/undoMove for maximum performance.
 * @internal - exposed for testing
 */
export class SearchState {
  constructor(baseState) {
    if (!baseState || !baseState.board) {
      throw new Error('SearchState: baseState.board is undefined');
    }

    const boardArray = Array.isArray(baseState.board)
      ? baseState.board
      : Object.values(baseState.board);

    if (boardArray.length !== 64) {
      throw new Error(`SearchState: board has ${boardArray.length} elements, expected 64`);
    }

    this.board = boardArray.slice();
    this.activeColor = baseState.activeColor || 'white';
    this.castlingRights = baseState.castlingRights
      ? JSON.parse(JSON.stringify(baseState.castlingRights))
      : { white: { kingSide: true, queenSide: true }, black: { kingSide: true, queenSide: true } };
    this.enPassantTarget = baseState.enPassantTarget || null;
    this.halfmoveClock = baseState.halfmoveClock || 0;
    this.fullmoveNumber = baseState.fullmoveNumber || 1;

    // Undo stack for incremental move making
    this.undoStack = [];

    // Compute initial Zobrist hash
    this.hash = _computeZobristHash(this);

    // Mobility callback
    this.generateLegalMoveCount = (color) =>
      generateLegalMoves({
        board: this.board,
        activeColor: color,
        castlingRights: this.castlingRights,
        enPassantTarget: this.enPassantTarget,
      }).length;
  }

  clone() {
    const s = Object.create(SearchState.prototype);
    s.board = cloneBoard(this.board);
    s.activeColor = this.activeColor;
    s.castlingRights = JSON.parse(JSON.stringify(this.castlingRights));
    s.enPassantTarget = this.enPassantTarget;
    s.halfmoveClock = this.halfmoveClock;
    s.fullmoveNumber = this.fullmoveNumber;
    s.hash = this.hash;
    s.undoStack = [];
    s.generateLegalMoveCount = this.generateLegalMoveCount;
    return s;
  }

  /**
   * Apply a move and push undo information to stack
   */
  makeMove(move) {
    const mover = this.activeColor;
    const undo = {
      move,
      hash: this.hash,
      activeColor: this.activeColor,
      castlingRights: JSON.parse(JSON.stringify(this.castlingRights)),
      enPassantTarget: this.enPassantTarget,
      halfmoveClock: this.halfmoveClock,
      fullmoveNumber: this.fullmoveNumber,
      pieces: []
    };

    const fromIndex = algebraicToIndexFast(move.from);
    const toIndex = algebraicToIndexFast(move.to);
    const movingPiece = this.board[fromIndex];
    const enemy = oppositeColor(mover);

    const isPawn = movingPiece && movingPiece[1] === "P";
    const isCapture = !!(move.captured || move.isEnPassant);

    // Save original positions
    undo.pieces.push({ index: fromIndex, value: this.board[fromIndex] });
    undo.pieces.push({ index: toIndex, value: this.board[toIndex] });

    // Halfmove clock
    undo.halfmoveClock = this.halfmoveClock;
    if (isPawn || isCapture) {
      this.halfmoveClock = 0;
    } else {
      this.halfmoveClock += 1;
    }

    // Update hash for removing piece from origin
    if (movingPiece) {
      const pi = PIECE_INDEX[movingPiece];
      if (pi !== undefined) this.hash ^= ZOBRIST_PIECES[pi][fromIndex];
    }

    // Clear old en passant from hash
    if (this.enPassantTarget) {
      const oldFile = this.enPassantTarget.charCodeAt(0) - 97;
      if (oldFile >= 0 && oldFile < 8) this.hash ^= ZOBRIST_EP_FILE[oldFile];
    }
    undo.enPassantTarget = this.enPassantTarget;
    this.enPassantTarget = null;

    // Clear old castling from hash
    this.hash ^= ZOBRIST_CASTLING[castlingIndex(this.castlingRights)];

    this.board[fromIndex] = null;

    // Handle capture
    if (move.captured) {
      const capPi = PIECE_INDEX[move.captured];
      if (capPi !== undefined) this.hash ^= ZOBRIST_PIECES[capPi][toIndex];
    }

    // En passant capture
    if (move.isEnPassant) {
      const dir = mover === "white" ? -1 : 1;
      const tf = toIndex % 8;
      const tr = Math.floor(toIndex / 8);
      const capIndex = (tr + dir) * 8 + tf;
      const capturedPiece = this.board[capIndex];
      undo.pieces.push({ index: capIndex, value: capturedPiece });
      if (capturedPiece) {
        const capPi = PIECE_INDEX[capturedPiece];
        if (capPi !== undefined) this.hash ^= ZOBRIST_PIECES[capPi][capIndex];
      }
      this.board[capIndex] = null;
    }

    // Castling: move rook
    if (move.isCastleKingSide || move.isCastleQueenSide) {
      const rank = mover === "white" ? 0 : 7;
      if (move.isCastleKingSide) {
        const rookFrom = rank * 8 + 7;
        const rookTo = rank * 8 + 5;
        const rook = this.board[rookFrom];
        undo.pieces.push({ index: rookFrom, value: rook });
        undo.pieces.push({ index: rookTo, value: this.board[rookTo] });
        if (rook) {
          const ri = PIECE_INDEX[rook];
          if (ri !== undefined) {
            this.hash ^= ZOBRIST_PIECES[ri][rookFrom];
            this.hash ^= ZOBRIST_PIECES[ri][rookTo];
          }
        }
        this.board[rookTo] = this.board[rookFrom];
        this.board[rookFrom] = null;
      } else {
        const rookFrom = rank * 8 + 0;
        const rookTo = rank * 8 + 3;
        const rook = this.board[rookFrom];
        undo.pieces.push({ index: rookFrom, value: rook });
        undo.pieces.push({ index: rookTo, value: this.board[rookTo] });
        if (rook) {
          const ri = PIECE_INDEX[rook];
          if (ri !== undefined) {
            this.hash ^= ZOBRIST_PIECES[ri][rookFrom];
            this.hash ^= ZOBRIST_PIECES[ri][rookTo];
          }
        }
        this.board[rookTo] = this.board[rookFrom];
        this.board[rookFrom] = null;
      }
    }

    // Promotion
    let placedPiece;
    if (move.promotion) {
      const prefix = mover === "white" ? "w" : "b";
      placedPiece = `${prefix}${move.promotion}`;
    } else {
      placedPiece = movingPiece;
    }
    this.board[toIndex] = placedPiece;

    // Hash the piece at destination
    if (placedPiece) {
      const pi = PIECE_INDEX[placedPiece];
      if (pi !== undefined) this.hash ^= ZOBRIST_PIECES[pi][toIndex];
    }

    // En passant target for double pawn push
    if (isPawn) {
      const fromRank = Math.floor(fromIndex / 8);
      const toRank = Math.floor(toIndex / 8);
      if (Math.abs(toRank - fromRank) === 2) {
        const midRank = (fromRank + toRank) / 2;
        const file = toIndex % 8;
        const epIndex = midRank * 8 + file;
        this.enPassantTarget = indexToAlgebraicFast(epIndex);
        this.hash ^= ZOBRIST_EP_FILE[file];
      }
    }

    // Update castling rights
    undo.castlingRights = JSON.parse(JSON.stringify(this.castlingRights));
    updateCastlingRightsSearch(this, move, fromIndex, toIndex, movingPiece);

    // Hash new castling rights
    this.hash ^= ZOBRIST_CASTLING[castlingIndex(this.castlingRights)];

    // Toggle side to move
    this.hash ^= ZOBRIST_SIDE;
    undo.activeColor = this.activeColor;
    this.activeColor = enemy;

    if (mover === "black") {
      undo.fullmoveNumber = this.fullmoveNumber;
      this.fullmoveNumber += 1;
    }

    this.undoStack.push(undo);
  }

  /**
   * Undo the last move using the undo stack
   */
  undoMove() {
    const undo = this.undoStack.pop();
    if (!undo) return;

    this.hash = undo.hash;
    this.activeColor = undo.activeColor;
    this.castlingRights = undo.castlingRights;
    this.enPassantTarget = undo.enPassantTarget;
    this.halfmoveClock = undo.halfmoveClock;
    this.fullmoveNumber = undo.fullmoveNumber;

    // Restore all pieces
    for (const piece of undo.pieces) {
      this.board[piece.index] = piece.value;
    }
  }
}

/**
 * Apply a legal move on SearchState with incremental Zobrist hash update.
 */
function applyMoveSearch(state, move, mover) {
  const fromIndex = algebraicToIndexFast(move.from);
  const toIndex = algebraicToIndexFast(move.to);
  const movingPiece = state.board[fromIndex];
  const enemy = oppositeColor(mover);

  const isPawn = movingPiece && movingPiece[1] === "P";
  const isCapture = !!(move.captured || move.isEnPassant);

  // Halfmove clock
  if (isPawn || isCapture) {
    state.halfmoveClock = 0;
  } else {
    state.halfmoveClock += 1;
  }

  // Update hash for removing piece from origin
  if (movingPiece) {
    const pi = PIECE_INDEX[movingPiece];
    if (pi !== undefined) state.hash ^= ZOBRIST_PIECES[pi][fromIndex];
  }

  // Clear old en passant from hash
  if (state.enPassantTarget) {
    const oldFile = state.enPassantTarget.charCodeAt(0) - 97;
    if (oldFile >= 0 && oldFile < 8) state.hash ^= ZOBRIST_EP_FILE[oldFile];
  }
  state.enPassantTarget = null;

  // Clear old castling from hash
  state.hash ^= ZOBRIST_CASTLING[castlingIndex(state.castlingRights)];

  state.board[fromIndex] = null;

  // Handle capture
  if (move.captured) {
    const capPi = PIECE_INDEX[move.captured];
    if (capPi !== undefined) state.hash ^= ZOBRIST_PIECES[capPi][toIndex];
  }

  // En passant capture
  if (move.isEnPassant) {
    const dir = mover === "white" ? -1 : 1;
    const tf = toIndex % 8;
    const tr = Math.floor(toIndex / 8);
    const capIndex = (tr + dir) * 8 + tf;
    const capturedPiece = state.board[capIndex];
    if (capturedPiece) {
      const capPi = PIECE_INDEX[capturedPiece];
      if (capPi !== undefined) state.hash ^= ZOBRIST_PIECES[capPi][capIndex];
    }
    state.board[capIndex] = null;
  }

  // Castling: move rook
  if (move.isCastleKingSide || move.isCastleQueenSide) {
    const rank = mover === "white" ? 0 : 7;
    if (move.isCastleKingSide) {
      const rookFrom = rank * 8 + 7;
      const rookTo = rank * 8 + 5;
      const rook = state.board[rookFrom];
      if (rook) {
        const ri = PIECE_INDEX[rook];
        if (ri !== undefined) {
          state.hash ^= ZOBRIST_PIECES[ri][rookFrom];
          state.hash ^= ZOBRIST_PIECES[ri][rookTo];
        }
      }
      state.board[rookTo] = state.board[rookFrom];
      state.board[rookFrom] = null;
    } else {
      const rookFrom = rank * 8 + 0;
      const rookTo = rank * 8 + 3;
      const rook = state.board[rookFrom];
      if (rook) {
        const ri = PIECE_INDEX[rook];
        if (ri !== undefined) {
          state.hash ^= ZOBRIST_PIECES[ri][rookFrom];
          state.hash ^= ZOBRIST_PIECES[ri][rookTo];
        }
      }
      state.board[rookTo] = state.board[rookFrom];
      state.board[rookFrom] = null;
    }
  }

  // Promotion
  let placedPiece;
  if (move.promotion) {
    const prefix = mover === "white" ? "w" : "b";
    placedPiece = `${prefix}${move.promotion}`;
  } else {
    placedPiece = movingPiece;
  }
  state.board[toIndex] = placedPiece;

  // Hash the piece at destination
  if (placedPiece) {
    const pi = PIECE_INDEX[placedPiece];
    if (pi !== undefined) state.hash ^= ZOBRIST_PIECES[pi][toIndex];
  }

  // En passant target for double pawn push
  if (isPawn) {
    const fromRank = Math.floor(fromIndex / 8);
    const toRank = Math.floor(toIndex / 8);
    if (Math.abs(toRank - fromRank) === 2) {
      const midRank = (fromRank + toRank) / 2;
      const file = toIndex % 8;
      const epIndex = midRank * 8 + file;
      state.enPassantTarget = indexToAlgebraicFast(epIndex);
      state.hash ^= ZOBRIST_EP_FILE[file];
    }
  }

  // Update castling rights
  updateCastlingRightsSearch(state, move, fromIndex, toIndex, movingPiece);

  // Hash new castling rights
  state.hash ^= ZOBRIST_CASTLING[castlingIndex(state.castlingRights)];

  // Toggle side to move
  state.hash ^= ZOBRIST_SIDE;
  state.activeColor = enemy;

  if (mover === "black") {
    state.fullmoveNumber += 1;
  }
}

function updateCastlingRightsSearch(state, move, fromIndex, toIndex, movingPiece) {
  const cr = state.castlingRights;
  const fromSq = indexToAlgebraicFast(fromIndex);
  const toSq = indexToAlgebraicFast(toIndex);

  if (movingPiece === "wK") {
    cr.white.kingSide = false;
    cr.white.queenSide = false;
  } else if (movingPiece === "bK") {
    cr.black.kingSide = false;
    cr.black.queenSide = false;
  }

  if (fromSq === "h1" || toSq === "h1") cr.white.kingSide = false;
  if (fromSq === "a1" || toSq === "a1") cr.white.queenSide = false;
  if (fromSq === "h8" || toSq === "h8") cr.black.kingSide = false;
  if (fromSq === "a8" || toSq === "a8") cr.black.queenSide = false;
}

/* === Utility: approximate piece value === */

function pieceValueApprox(piece) {
  if (!piece) return 0;
  const code = String(piece);
  const type = code[code.length - 1];
  return PIECE_VALUES[type] || 0;
}

/* === AI core === */

/** Transposition table flag types */
const TT_EXACT = 0;
const TT_LOWER = 1;
const TT_UPPER = 2;

/** Default transposition table size */
const TT_MAX_SIZE_DEFAULT = 100000;
/** Larger transposition table for Level 6 */
const TT_MAX_SIZE_L6 = 500000;

/** Null move reduction depth */
const NULL_MOVE_REDUCTION = 3;

/** Minimum pieces (non-pawns) before disabling null move pruning */
const ENDGAME_PIECE_THRESHOLD = 7;

/** Futility pruning margins by depth (centipawns) */
const FUTILITY_MARGINS = [0, 200, 500, 900];

/** Reverse futility pruning margins by depth (centipawns) */
const RFP_MARGINS = [0, 120, 300, 500];

export class AI {
  /**
   * @internal - exposed for testing
   */
  static SearchState = SearchState;
  static NULL_MOVE_REDUCTION = 3;

  constructor() {
    this.randomness = {
      1: 0.35,
      2: 0.20,
      3: 0.10,
      4: 0.05,
      5: 0.03,
      6: 0.0,
    };

    this.depthForLevel = {
      1: 1,
      2: 2,
      3: 3,
      4: 4,
      5: 5,
      6: 7,
    };

    // Killer moves: 2 slots per depth level (up to depth 20)
    this.killerMoves = [];
    for (let i = 0; i < 20; i++) {
      this.killerMoves.push([null, null]);
    }

    // History heuristic table: [fromSquare][toSquare] -> score
    this.historyTable = [];
    for (let i = 0; i < 64; i++) {
      this.historyTable.push(new Array(64).fill(0));
    }

    // Transposition table - default size, resized for Level 6
    this.ttSize = TT_MAX_SIZE_DEFAULT;
    this.transpositionTable = new Array(TT_MAX_SIZE_DEFAULT);
  }

  /**
   * Compute Zobrist hash for a position.
   * @param {Object} state
   * @returns {BigInt}
   */
  computeZobristHash(state) {
    return _computeZobristHash(state);
  }

  clearSearchData() {
    for (let i = 0; i < this.killerMoves.length; i++) {
      this.killerMoves[i][0] = null;
      this.killerMoves[i][1] = null;
    }
    for (let i = 0; i < 64; i++) {
      for (let j = 0; j < 64; j++) {
        this.historyTable[i][j] = Math.floor(this.historyTable[i][j] / 2);
      }
    }
  }

  /**
   * Resize the transposition table if needed.
   */
  resizeTT(level) {
    const targetSize = level >= 6 ? TT_MAX_SIZE_L6 : TT_MAX_SIZE_DEFAULT;
    if (this.ttSize !== targetSize) {
      this.ttSize = targetSize;
      this.transpositionTable = new Array(targetSize);
    }
  }

  updateHistory(move, depth) {
    if (move.captured) return;
    const fromIdx = algebraicToIndexFast(move.from);
    const toIdx = algebraicToIndexFast(move.to);
    this.historyTable[fromIdx][toIdx] += depth * depth;
    if (this.historyTable[fromIdx][toIdx] > 10000) {
      this.historyTable[fromIdx][toIdx] = 10000;
    }
  }

  getHistoryScore(move) {
    const fromIdx = algebraicToIndexFast(move.from);
    const toIdx = algebraicToIndexFast(move.to);
    return this.historyTable[fromIdx][toIdx];
  }

  countPieces(board) {
    let count = 0;
    for (let i = 0; i < 64; i++) {
      const piece = board[i];
      if (piece && piece[1] !== 'P') count++;
    }
    return count;
  }

  storeKillerMove(move, depth) {
    if (depth < 0 || depth >= this.killerMoves.length) return;
    if (move.captured) return;
    const slot = this.killerMoves[depth];
    if (!slot) return;
    if (slot[0] && slot[0].from === move.from && slot[0].to === move.to) return;
    slot[1] = slot[0];
    slot[0] = { from: move.from, to: move.to };
  }

  isKillerMove(move, depth) {
    if (depth < 0 || depth >= this.killerMoves.length) return false;
    const slot = this.killerMoves[depth];
    if (!slot) return false;
    return (slot[0] && slot[0].from === move.from && slot[0].to === move.to) ||
      (slot[1] && slot[1].from === move.from && slot[1].to === move.to);
  }

  /**
   * Order moves for better alpha-beta pruning efficiency.
   * For Level 6: TT best move gets highest priority.
   */
  orderMoves(moves, depth, ttBestMove) {
    return moves.slice().sort((a, b) => {
      let aScore = 0;
      let bScore = 0;

      // TT best move gets top priority
      if (ttBestMove) {
        if (a.from === ttBestMove.from && a.to === ttBestMove.to) aScore = 20000;
        if (b.from === ttBestMove.from && b.to === ttBestMove.to) bScore = 20000;
      }

      if (aScore < 20000) {
        if (a.captured) {
          aScore = pieceValueApprox(a.captured) * 10 - pieceValueApprox(a.piece) + 10000;
        } else if (this.isKillerMove(a, depth)) {
          aScore = 9000;
        } else {
          aScore = this.getHistoryScore(a);
        }
        if (a.promotion) aScore += pieceValueApprox(a.promotion) * 10;
      }

      if (bScore < 20000) {
        if (b.captured) {
          bScore = pieceValueApprox(b.captured) * 10 - pieceValueApprox(b.piece) + 10000;
        } else if (this.isKillerMove(b, depth)) {
          bScore = 9000;
        } else {
          bScore = this.getHistoryScore(b);
        }
        if (b.promotion) bScore += pieceValueApprox(b.promotion) * 10;
      }

      return bScore - aScore;
    });
  }

  probeTable(key, depth, alpha, beta) {
    const index = Number(key % BigInt(this.ttSize));
    const entry = this.transpositionTable[index];
    
    if (!entry || entry.depth < depth) return null;

    if (entry.flag === TT_EXACT) return entry.score;
    if (entry.flag === TT_LOWER && entry.score >= beta) return entry.score;
    if (entry.flag === TT_UPPER && entry.score <= alpha) return entry.score;
    return null;
  }

  /**
   * Probe TT for best move only (even if depth insufficient for score).
   */
  probeTTMove(key) {
    const index = Number(key % BigInt(this.ttSize));
    const entry = this.transpositionTable[index];
    if (!entry) return null;
    return entry.bestMove || null;
  }

  storeTable(key, depth, score, flag, bestMove) {
    const index = Number(key % BigInt(this.ttSize));
    const existing = this.transpositionTable[index];
    
    // Always replace if existing entry is shallower or equal
    if (!existing || existing.depth <= depth) {
      this.transpositionTable[index] = { key, depth, score, flag, bestMove };
    }
  }

  /**
   * Top-level API used by Game.
   */
  async findBestMove(gameState, { level, forColor, timeout = 10000 }) {
    const clampedLevel = Math.max(1, Math.min(6, Number(level) || 1));
    const depth = this.depthForLevel[clampedLevel];

    // Resize TT for Level 6
    this.resizeTT(clampedLevel);

    const baseState = new SearchState(gameState);
    const legalMoves = generateLegalMoves(baseState);
    if (legalMoves.length === 0) return null;

    if (clampedLevel === 1) {
      return this.pickLevel1Move(baseState, legalMoves, forColor);
    }

    if (clampedLevel >= 2) {
      return this.progressiveDeepeningSearch(baseState, legalMoves, depth, forColor, clampedLevel, timeout);
    }

    return new Promise((resolve) => {
      const move = this.searchRoot(baseState, legalMoves, depth, forColor, {
        level: clampedLevel,
      });
      resolve(move);
    });
  }

  pickLevel1Move(state, moves, color) {
    const scored = moves.map((m) => {
      const next = state.clone();
      applyMoveSearch(next, m, state.activeColor);
      const score = evaluate(next, color);
      return { move: m, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const keepCount = Math.max(1, Math.floor(scored.length * 0.4));
    const top = scored.slice(0, keepCount);
    return top[Math.floor(Math.random() * top.length)].move;
  }

  searchRoot(state, legalMoves, depth, color, { level, timeout, startTime, previousBestScore }) {
    const isMaximizing = state.activeColor === color;

    // Get TT best move for ordering
    const ttKey = level >= 3 ? state.hash : null;
    const ttBestMove = ttKey ? this.probeTTMove(ttKey) : null;
    const ordered = this.orderMoves(legalMoves, depth, ttBestMove);

    if (ordered.length === 0) return null;

    let bestMove = ordered[0];
    let bestScore = isMaximizing ? -Infinity : Infinity;
    let alpha = -Infinity;
    let beta = Infinity;

    // Aspiration windows: tighter for Level 6
    const ASPIRATION_WINDOW = level >= 6 ? 25 : 50;
    if (depth >= 3 && previousBestScore !== undefined) {
      alpha = previousBestScore - ASPIRATION_WINDOW;
      beta = previousBestScore + ASPIRATION_WINDOW;
    }

    let attempt = 0;
    let searchComplete = false;
    const maxAttempts = level >= 6 ? 5 : 3; // More widening attempts for L6

    while (!searchComplete && attempt < maxAttempts) {
      let currentAlpha = alpha;
      let currentBeta = beta;
      let scoreOutsideWindow = false;

      for (const move of ordered) {
        if (timeout && startTime && Date.now() - startTime >= timeout) break;

        const next = state.clone();
        applyMoveSearch(next, move, state.activeColor);
        const score = this.minimax(
          next, depth - 1, currentAlpha, currentBeta, color, !isMaximizing, level, timeout, startTime
        );

        if (score === null) break;

        // Check if score fell outside aspiration window
        if (score <= currentAlpha) {
          scoreOutsideWindow = true;
          currentAlpha = -Infinity;
        }
        if (score >= currentBeta) {
          scoreOutsideWindow = true;
          currentBeta = Infinity;
        }

        if (isMaximizing) {
          if (score > bestScore) { bestScore = score; bestMove = move; }
          if (score > currentAlpha) currentAlpha = score;
        } else {
          if (score < bestScore) { bestScore = score; bestMove = move; }
          if (score < currentBeta) currentBeta = score;
        }

        if (currentBeta <= currentAlpha) break;
      }

      if (!scoreOutsideWindow) {
        searchComplete = true;
      } else {
        // Progressive widening for Level 6
        if (level >= 6) {
          const widenings = [50, 100, 200, Infinity];
          const wIdx = Math.min(attempt, widenings.length - 1);
          const w = widenings[wIdx];
          if (previousBestScore !== undefined && w !== Infinity) {
            alpha = previousBestScore - w;
            beta = previousBestScore + w;
          } else {
            alpha = -Infinity;
            beta = Infinity;
          }
        }
      }
      attempt++;
    }

    // Slight randomness (zero for Level 6)
    if (!(timeout && startTime && Date.now() - startTime >= timeout)) {
      const jitter = this.randomness[level] || 0;
      if (jitter > 0 && ordered.length > 1) {
        const candidates = [];
        for (const move of ordered) {
          if (timeout && startTime && Date.now() - startTime >= timeout) break;
          const next = state.clone();
          applyMoveSearch(next, move, state.activeColor);
          const score = evaluate(next, color);
          const delta = Math.abs(score - bestScore);
          if (delta <= PIECE_VALUES.P * jitter * 2) {
            candidates.push(move);
          }
        }
        if (candidates.length > 0) {
          return candidates[Math.floor(Math.random() * candidates.length)];
        }
      }
    }

    return bestMove;
  }

  minimax(state, depth, alpha, beta, rootColor, isMaximizing, level, timeout, startTime, allowNullMove = true) {
    if (timeout && startTime && Date.now() - startTime >= timeout) return null;

    const originalAlpha = alpha;

    // Transposition table lookup (only at level 3+)
    const ttKey = level >= 3 ? state.hash : null;
    let ttBestMove = null;
    if (ttKey) {
      const ttScore = this.probeTable(ttKey, depth, alpha, beta);
      if (ttScore !== null) return ttScore;
      // Get TT best move for ordering even if score isn't usable
      ttBestMove = this.probeTTMove(ttKey);
    }

    const inCheck = isInCheck(state);
    const legalMoves = generateLegalMoves(state);

    // Check extension: extend search by 1 ply when in check
    if (inCheck && depth > 0) {
      depth += 1;
    }

    if (depth <= 0 || legalMoves.length === 0) {
      let baseScore = evaluate(state, rootColor);

      if (legalMoves.length === 0) {
        baseScore = inCheck
          ? (state.activeColor === rootColor ? -100000 : 100000)
          : 0;
      }

      if (depth <= 0 && level >= 4) {
        const qScore = this.quiescence(state, alpha, beta, rootColor, baseScore, timeout, startTime, level);
        if (qScore === null) return baseScore;
        return qScore;
      }

      return baseScore;
    }

    // === Reverse Futility Pruning (Static Null Move Pruning) ===
    // At expected cut-nodes: if static eval - margin >= beta, prune
    if (level >= 6 && !inCheck && depth <= 3 && allowNullMove) {
      const staticEval = evaluate(state, rootColor);
      const rfpMargin = RFP_MARGINS[depth] || 0;
      if (isMaximizing && staticEval - rfpMargin >= beta) {
        return beta;
      }
      if (!isMaximizing && staticEval + rfpMargin <= alpha) {
        return alpha;
      }
    }

    // Null move pruning
    if (allowNullMove && !inCheck && depth >= 3 && level >= 4) {
      const pieceCount = this.countPieces(state.board);
      if (pieceCount >= ENDGAME_PIECE_THRESHOLD) {
        const nullState = state.clone();
        const oldHash = nullState.hash;

        // Update hash for side change
        nullState.hash ^= ZOBRIST_SIDE;
        nullState.activeColor = oppositeColor(nullState.activeColor);

        // Clear en passant from hash
        if (nullState.enPassantTarget) {
          const epFile = nullState.enPassantTarget.charCodeAt(0) - 97;
          if (epFile >= 0 && epFile < 8) nullState.hash ^= ZOBRIST_EP_FILE[epFile];
        }
        nullState.enPassantTarget = null;

        const nullScore = this.minimax(
          nullState, depth - 1 - NULL_MOVE_REDUCTION,
          isMaximizing ? -beta : alpha,
          isMaximizing ? -beta + 1 : alpha + 1,
          rootColor, !isMaximizing, level, timeout, startTime, false
        );

        if (nullScore !== null) {
          if (isMaximizing && nullScore >= beta) return beta;
          if (!isMaximizing && nullScore <= alpha) return alpha;
        }
      }
    }

    // === Futility Pruning setup ===
    let canFutilityPrune = false;
    let staticEvalForFP = 0;
    if (level >= 6 && !inCheck && depth <= 3 && depth >= 1) {
      staticEvalForFP = evaluate(state, rootColor);
      const margin = FUTILITY_MARGINS[depth] || 0;
      if (isMaximizing && staticEvalForFP + margin <= alpha) {
        canFutilityPrune = true;
      }
      if (!isMaximizing && staticEvalForFP - margin >= beta) {
        canFutilityPrune = true;
      }
    }

    const ordered = this.orderMoves(legalMoves, depth, ttBestMove);
    if (ordered.length === 0) return isMaximizing ? -Infinity : Infinity;

    let bestMove = ordered[0];

    if (isMaximizing) {
      let value = -Infinity;
      for (let i = 0; i < ordered.length; i++) {
        if (timeout && startTime && i % 10 === 0 && Date.now() - startTime >= timeout) return null;

        const move = ordered[i];

        // Futility pruning: skip quiet moves that can't raise score above alpha
        if (canFutilityPrune && i > 0 && !move.captured && !move.promotion && !move.isEnPassant) {
          continue;
        }
        
        // Make move incrementally
        state.makeMove(move);

        // Compute LMR reduction
        let reduction = 0;
        if (level >= 6 && depth >= 3 && i >= 3 && !move.captured && !move.promotion && !inCheck) {
          // Logarithmic LMR for Level 6
          reduction = Math.max(1, Math.floor(Math.log(depth) * Math.log(i + 1) / 2.5));
          reduction = Math.min(reduction, depth - 2);
          // Don't reduce killer moves or high-history moves
          if (this.isKillerMove(move, depth) || this.getHistoryScore(move) > 500) {
            reduction = 0;
          }
        } else if (level >= 5 && depth >= 3 && i >= 4 && !move.captured && !move.promotion && !inCheck) {
          reduction = 1;
          if (i >= 8) reduction = 2;
        }

        let child;
        if (i === 0) {
          // First move: search with full window
          child = this.minimax(state, depth - 1 - reduction, alpha, beta, rootColor, false, level, timeout, startTime, true);
        } else {
          // PVS: search with null window
          child = this.minimax(state, depth - 1 - reduction, alpha, alpha + 1, rootColor, false, level, timeout, startTime, true);
          
          // If it fails high, re-search with full window
          if (child !== null && child > alpha && child < beta) {
            child = this.minimax(state, depth - 1 - reduction, alpha, beta, rootColor, false, level, timeout, startTime, true);
          }
        }

        if (child !== null && reduction > 0 && child > alpha) {
          // Undo before re-search at full depth
          state.undoMove();
          state.makeMove(move);
          child = this.minimax(state, depth - 1, alpha, beta, rootColor, false, level, timeout, startTime, true);
        }

        // Undo move
        state.undoMove();

        if (child === null) return null;

        if (child > value) { value = child; bestMove = move; }
        if (value > alpha) alpha = value;
        if (alpha >= beta) {
          this.storeKillerMove(move, depth);
          this.updateHistory(move, depth);
          break;
        }
      }

      if (ttKey) {
        let flag = TT_EXACT;
        if (value <= originalAlpha) flag = TT_UPPER;
        else if (value >= beta) flag = TT_LOWER;
        this.storeTable(ttKey, depth, value, flag, bestMove);
      }

      return value;
    }

    // Minimizing player
    let value = Infinity;
    for (let i = 0; i < ordered.length; i++) {
      if (timeout && startTime && i % 10 === 0 && Date.now() - startTime >= timeout) return null;

      const move = ordered[i];

      // Futility pruning for minimizing
      if (canFutilityPrune && i > 0 && !move.captured && !move.promotion && !move.isEnPassant) {
        continue;
      }
      
      // Make move incrementally
      state.makeMove(move);

      let reduction = 0;
      if (level >= 6 && depth >= 3 && i >= 3 && !move.captured && !move.promotion && !inCheck) {
        reduction = Math.max(1, Math.floor(Math.log(depth) * Math.log(i + 1) / 2.5));
        reduction = Math.min(reduction, depth - 2);
        if (this.isKillerMove(move, depth) || this.getHistoryScore(move) > 500) {
          reduction = 0;
        }
      } else if (level >= 5 && depth >= 3 && i >= 4 && !move.captured && !move.promotion && !inCheck) {
        reduction = 1;
        if (i >= 8) reduction = 2;
      }

      let child;
      if (i === 0) {
        // First move: search with full window
        child = this.minimax(state, depth - 1 - reduction, alpha, beta, rootColor, true, level, timeout, startTime, true);
      } else {
        // PVS: search with null window
        child = this.minimax(state, depth - 1 - reduction, beta - 1, beta, rootColor, true, level, timeout, startTime, true);
        
        // If it fails low, re-search with full window
        if (child !== null && child < beta && child > alpha) {
          child = this.minimax(state, depth - 1 - reduction, alpha, beta, rootColor, true, level, timeout, startTime, true);
        }
      }

      if (child !== null && reduction > 0 && child < beta) {
        // Undo before re-search at full depth
        state.undoMove();
        state.makeMove(move);
        child = this.minimax(state, depth - 1, alpha, beta, rootColor, true, level, timeout, startTime, true);
      }

      // Undo move
      state.undoMove();

      if (child === null) return null;

      if (child < value) { value = child; bestMove = move; }
      if (value < beta) beta = value;
      if (alpha >= beta) {
        this.storeKillerMove(move, depth);
        this.updateHistory(move, depth);
        break;
      }
    }

    if (ttKey) {
      let flag = TT_EXACT;
      if (value <= originalAlpha) flag = TT_UPPER;
      else if (value >= beta) flag = TT_LOWER;
      this.storeTable(ttKey, depth, value, flag, bestMove);
    }

    return value;
  }

  quiescence(state, alpha, beta, rootColor, standPat, timeout, startTime, level) {
    if (timeout && startTime && Date.now() - startTime >= timeout) return null;

    let value = standPat;
    if (value > alpha) {
      alpha = value;
      if (alpha >= beta) return alpha;
    }

    const allMoves = generateLegalMoves(state);
    const captureMoves = allMoves.filter((m) => m.captured);

    // For Level 6: sort by MVV-LVA, no cap on captures; add delta pruning
    // For lower levels: simple slice(0, 16) cap
    let movesToSearch;
    if (level >= 6) {
      // Sort captures by MVV-LVA
      movesToSearch = captureMoves.sort((a, b) => {
        const aVal = pieceValueApprox(a.captured) * 10 - pieceValueApprox(a.piece);
        const bVal = pieceValueApprox(b.captured) * 10 - pieceValueApprox(b.piece);
        return bVal - aVal;
      });
    } else {
      movesToSearch = captureMoves.slice(0, 16);
    }

    for (let i = 0; i < movesToSearch.length; i++) {
      if (timeout && startTime && i % 5 === 0 && Date.now() - startTime >= timeout) return value;

      const move = movesToSearch[i];

      // Delta pruning for Level 6: skip captures where captured piece + margin < alpha
      if (level >= 6) {
        const capturedValue = pieceValueApprox(move.captured);
        if (standPat + capturedValue + 200 < alpha) {
          continue; // This capture can't possibly raise the score enough
        }
      }

      // Use incremental make/undo for Level 6
      if (level >= 6) {
        state.makeMove(move);
        const nextEval = evaluate(state, rootColor);
        const score = -this.quiescence(state, -beta, -alpha, rootColor, nextEval, timeout, startTime, level);
        state.undoMove();

        if (score === null) return value;
        if (score > value) value = score;
        if (value > alpha) alpha = value;
        if (alpha >= beta) break;
      } else {
        const next = state.clone();
        applyMoveSearch(next, move, state.activeColor);
        const score = -this.quiescence(next, -beta, -alpha, rootColor, evaluate(next, rootColor), timeout, startTime, level);

        if (score === null) return value;
        if (score > value) value = score;
        if (value > alpha) alpha = value;
        if (alpha >= beta) break;
      }
    }
    return value;
  }

  async progressiveDeepeningSearch(state, legalMoves, maxDepth, color, level, timeout = 10000) {
    const startTime = Date.now();
    let bestMove = null;
    let previousBestScore = undefined;

    for (let currentDepth = 1; currentDepth <= maxDepth; currentDepth++) {
      if (timeout && Date.now() - startTime >= timeout) break;

      const move = this.searchRoot(state, legalMoves, currentDepth, color, {
        level,
        timeout,
        startTime,
        previousBestScore,
      });

      if (move !== null) {
        bestMove = move;
      }
    }

    return bestMove;
  }
}
