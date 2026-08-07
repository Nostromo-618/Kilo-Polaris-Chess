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
import { generateLegalMoves, generateCaptureMoves, isInCheck } from "./Rules.js";
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

// Pre-computed deterministic 64-bit BigInt values for Zobrist hashing.
// A fixed SplitMix64 stream keeps hashes stable across reloads/tests while
// still giving the table a good distribution.
const MASK_64 = (1n << 64n) - 1n;
let zobristSeed = 0x4d595df4d0f33173n;

function random64() {
  zobristSeed = (zobristSeed + 0x9e3779b97f4a7c15n) & MASK_64;
  let z = zobristSeed;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK_64;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK_64;
  return (z ^ (z >> 31n)) & MASK_64;
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

    // Zobrist hashes of positions reached along the current search path, used
    // for repetition detection (in-search + seeded game history).
    this.pathHashes = [];

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
    s.pathHashes = this.pathHashes.slice();
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
      // castlingRights is captured just before it is mutated, below.
      castlingRights: null,
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

    // Update castling rights (shallow structured copy — leaves are booleans —
    // is far cheaper than a JSON round-trip on this hot path).
    undo.castlingRights = {
      white: { ...this.castlingRights.white },
      black: { ...this.castlingRights.black },
    };
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

    this.pathHashes.push(this.hash);
    this.undoStack.push(undo);
  }

  /**
   * Undo the last move using the undo stack
   */
  undoMove() {
    const undo = this.undoStack.pop();
    if (!undo) return;

    this.pathHashes.pop();
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

/* === Static Exchange Evaluation (SEE) === */

const SEE_VALUES = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };
const SEE_KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const SEE_ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const SEE_DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

/**
 * Least valuable piece of `side` (`"w"`/`"b"`) attacking targetIndex, given the
 * current occupancy `occ`. Returns { index, type } or null. Slider rays respect
 * occupancy, so removing a front attacker reveals x-ray attackers behind it.
 */
function seeLeastAttacker(occ, targetIndex, side) {
  const tf = targetIndex % 8;
  const tr = (targetIndex - tf) / 8;

  // Pawn (a `side` pawn attacks the target from the rank one step "behind" it).
  const pawnCode = side + "P";
  const pr = tr + (side === "w" ? -1 : 1);
  if (pr >= 0 && pr <= 7) {
    if (tf > 0 && occ[pr * 8 + tf - 1] === pawnCode) return { index: pr * 8 + tf - 1, type: "P" };
    if (tf < 7 && occ[pr * 8 + tf + 1] === pawnCode) return { index: pr * 8 + tf + 1, type: "P" };
  }

  const knightCode = side + "N";
  for (let i = 0; i < 8; i++) {
    const f = tf + SEE_KNIGHT[i][0];
    const r = tr + SEE_KNIGHT[i][1];
    if (f >= 0 && f <= 7 && r >= 0 && r <= 7 && occ[r * 8 + f] === knightCode) return { index: r * 8 + f, type: "N" };
  }

  const bishopCode = side + "B";
  const rookCode = side + "R";
  const queenCode = side + "Q";
  let diagQueen = -1;
  let orthoQueen = -1;

  for (let i = 0; i < 4; i++) {
    const df = SEE_DIAG[i][0];
    const dr = SEE_DIAG[i][1];
    let f = tf + df;
    let r = tr + dr;
    while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
      const p = occ[r * 8 + f];
      if (p) {
        if (p === bishopCode) return { index: r * 8 + f, type: "B" };
        if (p === queenCode && diagQueen < 0) diagQueen = r * 8 + f;
        break;
      }
      f += df; r += dr;
    }
  }

  for (let i = 0; i < 4; i++) {
    const df = SEE_ORTHO[i][0];
    const dr = SEE_ORTHO[i][1];
    let f = tf + df;
    let r = tr + dr;
    while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
      const p = occ[r * 8 + f];
      if (p) {
        if (p === rookCode) return { index: r * 8 + f, type: "R" };
        if (p === queenCode && orthoQueen < 0) orthoQueen = r * 8 + f;
        break;
      }
      f += df; r += dr;
    }
  }

  if (diagQueen >= 0) return { index: diagQueen, type: "Q" };
  if (orthoQueen >= 0) return { index: orthoQueen, type: "Q" };

  const kingCode = side + "K";
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (df === 0 && dr === 0) continue;
      const f = tf + df;
      const r = tr + dr;
      if (f >= 0 && f <= 7 && r >= 0 && r <= 7 && occ[r * 8 + f] === kingCode) return { index: r * 8 + f, type: "K" };
    }
  }

  return null;
}

/**
 * Static Exchange Evaluation for the capture from->to (en passant supported).
 * Returns the net material (centipawns) the moving side gains if both sides
 * play the exchange out with least-valuable-attacker recaptures. Negative means
 * the capture loses material.
 */
export function seeCapture(board, fromIndex, toIndex, isEnPassant) {
  const occ = board.slice();
  const moverPiece = occ[fromIndex];
  if (!moverPiece) return 0;
  const moverSide = moverPiece[0];

  let capturedType;
  if (isEnPassant) {
    occ[toIndex + (moverSide === "w" ? -8 : 8)] = null; // remove the ep-captured pawn
    capturedType = "P";
  } else {
    const victim = occ[toIndex];
    if (!victim) return 0;
    capturedType = victim[1];
  }

  const gain = [];
  gain[0] = SEE_VALUES[capturedType] || 0;
  occ[fromIndex] = null; // the first attacker moves onto the target

  let attackerType = moverPiece[1];
  let side = moverSide === "w" ? "b" : "w";
  let d = 0;

  while (true) {
    d += 1;
    gain[d] = (SEE_VALUES[attackerType] || 0) - gain[d - 1];
    if (Math.max(-gain[d - 1], gain[d]) < 0) break; // this side can't gain by continuing
    const lva = seeLeastAttacker(occ, toIndex, side);
    if (!lva) break;
    occ[lva.index] = null;
    attackerType = lva.type;
    side = side === "w" ? "b" : "w";
  }

  while (--d > 0) {
    gain[d - 1] = -Math.max(-gain[d - 1], gain[d]);
  }
  return gain[0];
}

/* === AI core === */

/** Mate scoring. Scores with |value| >= MATE_THRESHOLD encode a forced mate;
 *  the distance to mate is (MATE - |value|) plies from the root. */
const MATE = 100000;
const MATE_THRESHOLD = 99000;

/** Convert a root-relative mate score to node-relative for TT storage. */
function mateToTT(score, ply) {
  if (score >= MATE_THRESHOLD) return score + ply;
  if (score <= -MATE_THRESHOLD) return score - ply;
  return score;
}
/** Convert a node-relative mate score from the TT back to root-relative. */
function mateFromTT(score, ply) {
  if (score >= MATE_THRESHOLD) return score - ply;
  if (score <= -MATE_THRESHOLD) return score + ply;
  return score;
}

/** Transposition table flag types */
const TT_EXACT = 0;
const TT_LOWER = 1;
const TT_UPPER = 2;

/** Default transposition table size */
const TT_MAX_SIZE_DEFAULT = 100000;
/** Larger transposition table for Level 6 */
const TT_MAX_SIZE_L6 = 500000;

/** Evaluation cache size (entries) and BigInt mask for indexing. */
const EVAL_CACHE_SIZE = 1 << 16;
const EVAL_CACHE_MASK = 65535n;

/** Null move reduction depth */
const NULL_MOVE_REDUCTION = 3;

/**
 * Deepest iterative-deepening iteration allowed in uncapped (match) mode.
 * Purely a safety ceiling for ply-indexed tables — in practice the per-move
 * time budget stops the search far earlier.
 */
const UNCAPPED_MAX_DEPTH = 56;

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
    // Variety jitter, kept only at the casual low levels. Levels 4-6 play their
    // best move (no jitter) so they are as strong as the search allows.
    this.randomness = {
      1: 0.35,
      2: 0.20,
      3: 0.10,
      4: 0.0,
      5: 0.0,
      6: 0.0,
    };

    // Depth caps. Levels 1-3 stay shallow and fixed (CPU-light). Levels 4-6 get
    // caps high enough that the per-move TIME budget is the binding constraint
    // (see Game.moveTimeForDifficulty), so they deepen to fill their budget
    // instead of stopping early at a fixed depth. Simple positions still return
    // as soon as the cap is reached.
    this.depthForLevel = {
      1: 1,
      2: 2,
      3: 3,
      4: 8,
      5: 12,
      6: 22,
    };

    // Killer moves: 2 slots per remaining-depth level. Sized well past
    // UNCAPPED_MAX_DEPTH so uncapped searches keep killer coverage (indexing
    // is bounds-guarded regardless).
    this.killerMoves = [];
    for (let i = 0; i < 128; i++) {
      this.killerMoves.push([null, null]);
    }

    // History heuristic table: [fromSquare][toSquare] -> score
    this.historyTable = [];
    for (let i = 0; i < 64; i++) {
      this.historyTable.push(new Array(64).fill(0));
    }

    // Countermove heuristic: [pieceIndex][toSquare of previous move] -> quiet
    // move that refuted it (standard public technique). Search-local, level >= 4.
    this.counterMoves = [];
    for (let i = 0; i < 12; i++) {
      this.counterMoves.push(new Array(64).fill(null));
    }

    // Transposition table - default size, resized for Level 6
    this.ttSize = TT_MAX_SIZE_DEFAULT;
    this.transpositionTable = new Array(TT_MAX_SIZE_DEFAULT);

    // Evaluation cache (levels 4-6): Zobrist-keyed memo for the full static
    // eval. Eval is a pure function of the position, so cached scores are
    // identical to recomputation — this only saves time. Kept across moves.
    this.evalCache = new Array(EVAL_CACHE_SIZE);

    this.lastSearchInfo = this.createSearchInfo();
    this.lastRootScore = undefined;
  }

  createSearchInfo() {
    return {
      nodes: 0,
      qNodes: 0,
      ttHits: 0,
      cutoffs: 0,
      depthCompleted: 0,
      bestScore: null,
      timedOut: false,
    };
  }

  resetSearchInfo() {
    this.lastSearchInfo = this.createSearchInfo();
    this.lastRootScore = undefined;
    this.timeCheckCtr = 0;
  }

  /**
   * Throttled wall-clock check. Date.now() at every node measurably costs NPS,
   * so the clock is only sampled once per 256 calls (~2-3ms overshoot at most,
   * which the fixed per-move budget tolerates). Call sites remain responsible
   * for setting lastSearchInfo.timedOut when this returns true.
   */
  isTimeUp(timeout, startTime) {
    if (!timeout || !startTime) return false;
    this.timeCheckCtr = (this.timeCheckCtr + 1) & 255;
    if (this.timeCheckCtr !== 0) return false;
    return Date.now() - startTime >= timeout;
  }

  getLastSearchInfo() {
    return { ...this.lastSearchInfo };
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
    for (let i = 0; i < 12; i++) {
      this.counterMoves[i].fill(null);
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

  /**
   * Memoized full static evaluation (levels 4-6 hot paths only). Identical
   * score to evaluate(); always-replace on index collision.
   */
  evalCached(state, rootColor) {
    const idx = Number(state.hash & EVAL_CACHE_MASK);
    const hit = this.evalCache[idx];
    if (hit && hit.key === state.hash) return hit.score;
    const score = evaluate(state, rootColor);
    this.evalCache[idx] = { key: state.hash, score };
    return score;
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
   * Remember `move` as the refutation of the opponent's previous move
   * (countermove heuristic). Quiet moves only.
   */
  storeCounterMove(prevMove, move) {
    if (!prevMove || move.captured || move.promotion) return;
    const pi = PIECE_INDEX[prevMove.piece];
    if (pi === undefined) return;
    this.counterMoves[pi][algebraicToIndexFast(prevMove.to)] = { from: move.from, to: move.to };
  }

  getCounterMove(prevMove) {
    if (!prevMove) return null;
    const pi = PIECE_INDEX[prevMove.piece];
    if (pi === undefined) return null;
    return this.counterMoves[pi][algebraicToIndexFast(prevMove.to)] || null;
  }

  /**
   * Score a single move for ordering (TT move, then captures, killers,
   * countermove, history), matching the priorities alpha-beta relies on.
   * At level >= 4 in the main search (depth > 0), captures are classified by
   * static exchange evaluation: winning/even exchanges sort above killers,
   * losing exchanges drop below all quiet moves (standard SEE ordering).
   */
  scoreMoveForOrdering(move, depth, ttBestMove, counterMove, board, level) {
    if (ttBestMove && move.from === ttBestMove.from && move.to === ttBestMove.to) {
      return 20000; // TT best move first (no promotion bonus, as before)
    }
    let score;
    if (move.captured) {
      if (level >= 4 && depth > 0 && board) {
        const see = seeCapture(board, algebraicToIndexFast(move.from), algebraicToIndexFast(move.to), move.isEnPassant);
        score = see >= 0
          ? 10000 + see + pieceValueApprox(move.captured)
          : -5000 + see;
      } else {
        score = pieceValueApprox(move.captured) * 10 - pieceValueApprox(move.piece) + 10000;
      }
    } else if (this.isKillerMove(move, depth)) {
      score = 9000;
    } else if (counterMove && move.from === counterMove.from && move.to === counterMove.to) {
      score = 8500;
    } else {
      score = this.getHistoryScore(move);
    }
    if (move.promotion) score += pieceValueApprox(move.promotion) * 10;
    return score;
  }

  /**
   * Order moves for better alpha-beta pruning efficiency. Decorate-then-sort:
   * each move is scored once (not recomputed inside every sort comparison).
   */
  orderMoves(moves, depth, ttBestMove, counterMove = null, board = null, level = 1) {
    const decorated = new Array(moves.length);
    for (let i = 0; i < moves.length; i++) {
      decorated[i] = { move: moves[i], score: this.scoreMoveForOrdering(moves[i], depth, ttBestMove, counterMove, board, level) };
    }
    decorated.sort((a, b) => b.score - a.score);
    const ordered = new Array(moves.length);
    for (let i = 0; i < moves.length; i++) ordered[i] = decorated[i].move;
    return ordered;
  }

  /**
   * True if the current position repeats one already seen on the search path
   * or in the seeded game history (draw by repetition), enabling a draw score.
   */
  isDrawByRepetition(state) {
    const h = state.hash;
    if (this.repetitionSet && this.repetitionSet.has(h)) return true;
    const path = state.pathHashes;
    // path[last] is the current node; look for an earlier identical position.
    for (let i = path.length - 2; i >= 0; i--) {
      if (path[i] === h) return true;
    }
    return false;
  }

  probeTable(key, depth, alpha, beta, ply) {
    const index = Number(key % BigInt(this.ttSize));
    const entry = this.transpositionTable[index];

    if (!entry || entry.key !== key || entry.depth < depth) return null;

    // Stored mate scores are node-relative; convert back to root-relative.
    const score = mateFromTT(entry.score, ply);

    if (entry.flag === TT_EXACT) {
      this.lastSearchInfo.ttHits += 1;
      return score;
    }
    if (entry.flag === TT_LOWER && score >= beta) {
      this.lastSearchInfo.ttHits += 1;
      return score;
    }
    if (entry.flag === TT_UPPER && score <= alpha) {
      this.lastSearchInfo.ttHits += 1;
      return score;
    }
    return null;
  }

  /**
   * Probe TT for best move only (even if depth insufficient for score).
   */
  probeTTMove(key) {
    const index = Number(key % BigInt(this.ttSize));
    const entry = this.transpositionTable[index];
    if (!entry || entry.key !== key) return null;
    return entry.bestMove || null;
  }

  storeTable(key, depth, score, flag, bestMove, ply = 0) {
    // Never store a non-finite or otherwise corrupt score (e.g. an aborted
    // quiescence sentinel) — it would poison every later probe of this key.
    if (!Number.isFinite(score)) return;
    const index = Number(key % BigInt(this.ttSize));
    const existing = this.transpositionTable[index];

    // Replace colliding keys, or refresh equal/deeper entries for the same key.
    if (!existing || existing.key !== key || existing.depth <= depth) {
      // Store mate scores node-relative so they stay correct across transpositions.
      this.transpositionTable[index] = { key, depth, score: mateToTT(score, ply), flag, bestMove };
    }
  }

  /**
   * Top-level API used by Game.
   *
   * `uncapped` (engine-vs-engine matches only) runs the level-6 search policy
   * with no per-level depth cap: iterative deepening continues until the
   * timeout (or UNCAPPED_MAX_DEPTH) stops it. Levels 1-6 are unaffected.
   */
  async findBestMove(gameState, { level, forColor, timeout = 10000, signal, onInfo, history, uncapped = false } = {}) {
    if (signal?.aborted) return null;
    this.resetSearchInfo();
    // Fresh killer/history signal per search; the TT is kept across moves of a game.
    this.clearSearchData();

    const clampedLevel = Math.max(1, Math.min(6, Number(level) || 1));
    const effectiveLevel = uncapped ? 6 : clampedLevel;
    const depth = uncapped ? UNCAPPED_MAX_DEPTH : this.depthForLevel[clampedLevel];

    // Resize TT for Level 6 (uncapped mode uses the level-6 policy)
    this.resizeTT(effectiveLevel);

    const baseState = new SearchState(gameState);
    const searchColor = forColor || baseState.activeColor;

    // TT scores are stored from the search perspective (rootColor) but keyed by
    // position only. If the side we search for changes (e.g. an engine-vs-engine
    // match alternating colors on one AI instance), drop the table so no
    // wrong-sign score is reused.
    if (this.lastSearchColor !== undefined && this.lastSearchColor !== searchColor) {
      this.transpositionTable = new Array(this.ttSize);
    }
    this.lastSearchColor = searchColor;

    // Seed repetition detection with the game positions since the last
    // irreversible move (supplied by the caller / worker). A line that returns
    // to one of these is a draw, so the engine won't shuffle a won game away.
    this.repetitionSet = new Set();
    if (Array.isArray(history)) {
      for (const snap of history) {
        try { this.repetitionSet.add(_computeZobristHash(snap)); } catch { /* skip malformed */ }
      }
    }

    const legalMoves = generateLegalMoves(baseState);
    if (legalMoves.length === 0) return null;

    if (effectiveLevel === 1) {
      const move = this.pickLevel1Move(baseState, legalMoves, searchColor);
      this.lastSearchInfo.depthCompleted = 1;
      onInfo?.(this.getLastSearchInfo());
      return signal?.aborted ? null : move;
    }

    if (effectiveLevel >= 2) {
      // A cooperative abort mid-search returns the best move from the last fully
      // completed depth (progressiveDeepeningSearch breaks and keeps it), rather
      // than discarding the whole search.
      const move = await this.progressiveDeepeningSearch(baseState, legalMoves, depth, searchColor, effectiveLevel, timeout, signal, onInfo);
      onInfo?.(this.getLastSearchInfo());
      return move;
    }

    return new Promise((resolve) => {
      const move = this.searchRoot(baseState, legalMoves, depth, searchColor, {
        level: effectiveLevel,
        timeout,
        startTime: Date.now(),
      });
      onInfo?.(this.getLastSearchInfo());
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

  /**
   * Search all root moves at a fixed depth with an aspiration window.
   * Returns the best move, or null if the iteration was aborted before any
   * root move completed (so the caller keeps the previous depth's result).
   */
  searchRoot(state, legalMoves, depth, color, { level, timeout, startTime, previousBestScore }) {
    const isMaximizing = state.activeColor === color;
    const ttKey = level >= 3 ? state.hash : null;
    const ttBestMove = ttKey ? this.probeTTMove(ttKey) : null;
    const ordered = this.orderMoves(legalMoves, depth, ttBestMove, null, state.board, level);
    if (ordered.length === 0) return null;

    const timedOut = () => timeout && startTime && Date.now() - startTime >= timeout;

    // Low levels with variety: score every root move with a FULL window so the
    // jitter compares exact scores. Alpha-beta only proves bounds for non-best
    // moves, so jittering over those could pick a move that is actually a
    // blunder. These levels are shallow, so the lost pruning is negligible.
    const jitter = this.randomness[level] || 0;
    if (jitter > 0) {
      // Only the best-ordered candidates need exact scores (the true best is
      // almost always among them given TT/MVV-LVA/killer ordering). Capping the
      // count keeps these casual levels CPU-light despite the full window.
      const JITTER_CANDIDATES = 12;
      const pool = ordered.slice(0, JITTER_CANDIDATES);
      const scored = [];
      for (const move of pool) {
        if (timedOut()) break;
        state.makeMove(move);
        const s = this.minimax(state, depth - 1, -1000000, 1000000, color, !isMaximizing, level, timeout, startTime, true, 1);
        state.undoMove();
        if (s === null) break;
        scored.push({ move, score: s });
      }
      if (scored.length === 0) { this.lastRootScore = undefined; return ordered[0]; }
      scored.sort((x, y) => (isMaximizing ? y.score - x.score : x.score - y.score));
      const best = scored[0].score;
      this.lastRootScore = Number.isFinite(best) ? best : undefined;
      this.lastSearchInfo.bestScore = this.lastRootScore ?? null;
      if (ttKey) this.storeTable(ttKey, depth, best, TT_EXACT, scored[0].move, 0);
      const threshold = PIECE_VALUES.P * jitter * 2;
      const cands = scored.filter((x) => Math.abs(x.score - best) <= threshold).map((x) => x.move);
      return cands[Math.floor(Math.random() * cands.length)] || scored[0].move;
    }

    const ASPIRATION_WINDOW = level >= 6 ? 25 : 50;

    let alpha = -1000000, beta = 1000000;
    if (depth >= 3 && previousBestScore !== undefined) {
      alpha = previousBestScore - ASPIRATION_WINDOW;
      beta = previousBestScore + ASPIRATION_WINDOW;
    }
    const widenings = level >= 6 ? [50, 100, 200, Infinity] : [Infinity];

    let finalBestMove = null, finalBestScore = null;

    for (let attempt = 0; ; attempt++) {
      // Each aspiration attempt starts fresh so a bound score from a failed
      // window can never survive as the chosen move.
      let bestMove = null, bestScore = isMaximizing ? -Infinity : Infinity;
      let a = alpha, b = beta;
      let completedAny = false, failed = false;

      for (const move of ordered) {
        if (timedOut()) { this.lastSearchInfo.timedOut = true; break; }
        state.makeMove(move);
        const score = this.minimax(state, depth - 1, a, b, color, !isMaximizing, level, timeout, startTime, true, 1);
        state.undoMove();
        if (score === null) { this.lastSearchInfo.timedOut = true; break; }
        completedAny = true;
        if (isMaximizing) {
          if (score > bestScore) { bestScore = score; bestMove = move; }
          if (score > a) a = score;
        } else {
          if (score < bestScore) { bestScore = score; bestMove = move; }
          if (score < b) b = score;
        }
        // Fail-high: a move beat the aspiration window — widen and re-search.
        if (isMaximizing ? bestScore >= beta : bestScore <= alpha) { failed = true; break; }
      }

      const narrowed = alpha > -1000000 || beta < 1000000;
      if (!failed && completedAny && narrowed) {
        // Fail-low: nothing reached the window.
        if (isMaximizing ? bestScore <= alpha : bestScore >= beta) failed = true;
      }

      if (completedAny && !failed) {
        finalBestMove = bestMove; finalBestScore = bestScore;
        break;
      }
      if (!completedAny) break; // aborted before any root move finished this depth

      // Widen and retry.
      const w = widenings[Math.min(attempt, widenings.length - 1)];
      if (w === Infinity || previousBestScore === undefined) { alpha = -1000000; beta = 1000000; }
      else { alpha = previousBestScore - w; beta = previousBestScore + w; }
      if (attempt >= widenings.length) { alpha = -1000000; beta = 1000000; }
    }

    if (finalBestMove === null) {
      this.lastRootScore = undefined;
      return null;
    }

    this.lastRootScore = Number.isFinite(finalBestScore) ? finalBestScore : undefined;
    this.lastSearchInfo.bestScore = this.lastRootScore ?? null;

    // Store the completed root result so the next iteration orders from it.
    if (ttKey) this.storeTable(ttKey, depth, finalBestScore, TT_EXACT, finalBestMove, 0);

    return finalBestMove;
  }

  computeReduction(level, depth, moveIndex, move, inCheck) {
    if (inCheck || move.captured || move.promotion || move.isEnPassant) return 0;
    if (this.isKillerMove(move, depth) || this.getHistoryScore(move) > 500) return 0;

    if (level >= 6 && depth >= 3 && moveIndex >= 3) {
      const reduction = Math.max(1, Math.floor(Math.log(depth) * Math.log(moveIndex + 1) / 2.5));
      return Math.min(reduction, depth - 2);
    }
    if (level >= 5 && depth >= 3 && moveIndex >= 4) {
      return moveIndex >= 8 ? 2 : 1;
    }
    return 0;
  }

  minimax(state, depth, alpha, beta, rootColor, isMaximizing, level, timeout, startTime, allowNullMove = true, ply = 0) {
    if (this.isTimeUp(timeout, startTime)) {
      this.lastSearchInfo.timedOut = true;
      return null;
    }

    this.lastSearchInfo.nodes += 1;

    const maximizing = state.activeColor === rootColor;
    const originalAlpha = alpha;
    const originalBeta = beta;

    // Draw detection (never at the root): repetition and the fifty-move rule, so
    // the engine won't shuffle a won position into a draw or misjudge a drawn one.
    if (ply > 0) {
      // A repeated position can never be checkmate (the earlier occurrence would
      // have ended the game), so this is always a safe draw.
      if (this.isDrawByRepetition(state)) return 0;
      // Checkmate takes precedence over the fifty-move rule: only score the
      // fifty-move draw when the side to move is not being mated right now.
      if (state.halfmoveClock >= 100 &&
          !(isInCheck(state) && generateLegalMoves(state).length === 0)) {
        return 0;
      }
    }

    // Mate-distance pruning (level >= 4): no mate score reachable from this
    // node can exceed |MATE - ply - 1| (a mate needs at least one more ply),
    // so clamp the window into that range. Tighter windows yield more cutoffs
    // downstream and keep mate distances comparable across the tree. The
    // fail-hard bound returns stay consistent with the TT flag logic below.
    if (level >= 4 && ply > 0) {
      const mateBound = MATE - ply - 1;
      if (alpha < -mateBound) alpha = -mateBound;
      if (beta > mateBound) beta = mateBound;
      if (alpha >= beta) return maximizing ? alpha : beta;
    }

    const inCheck = isInCheck(state);
    if (inCheck && depth > 0) {
      depth += 1;
    }

    if (depth <= 0) {
      if (level >= 4) {
        // Propagate an aborted quiescence (null) rather than masking it with a
        // static eval, so a timed-out search never trusts a partial score.
        return this.quiescence(state, alpha, beta, rootColor, this.evalCached(state, rootColor), timeout, startTime, level, ply);
      }
      return evaluate(state, rootColor);
    }

    const ttKey = level >= 3 ? state.hash : null;
    let ttBestMove = null;
    if (ttKey) {
      const ttScore = this.probeTable(ttKey, depth, alpha, beta, ply);
      if (ttScore !== null) return ttScore;
      ttBestMove = this.probeTTMove(ttKey);
    }

    const legalMoves = generateLegalMoves(state);
    if (legalMoves.length === 0) {
      if (inCheck) {
        // Mate: shorter mates score higher (distance measured as ply from root).
        return state.activeColor === rootColor ? -(MATE - ply) : (MATE - ply);
      }
      return 0;
    }

    // Static eval is only consumed by the level-6 shallow-depth RFP and futility
    // pruning; compute it lazily so levels 4-5 don't pay for it at every node.
    const needStaticEval = level >= 6 && !inCheck && depth <= 3;
    const staticEval = needStaticEval ? this.evalCached(state, rootColor) : 0;

    if (needStaticEval && allowNullMove) {
      const rfpMargin = RFP_MARGINS[depth] || 0;
      if (maximizing && staticEval - rfpMargin >= beta) return beta;
      if (!maximizing && staticEval + rfpMargin <= alpha) return alpha;
    }

    if (allowNullMove && !inCheck && depth >= 3 && level >= 4 && this.countPieces(state.board) >= ENDGAME_PIECE_THRESHOLD) {
      const nullState = state.clone();
      nullState.hash ^= ZOBRIST_SIDE;
      nullState.activeColor = oppositeColor(nullState.activeColor);
      if (nullState.enPassantTarget) {
        const epFile = nullState.enPassantTarget.charCodeAt(0) - 97;
        if (epFile >= 0 && epFile < 8) nullState.hash ^= ZOBRIST_EP_FILE[epFile];
      }
      nullState.enPassantTarget = null;

      const nullDepth = Math.max(0, depth - 1 - NULL_MOVE_REDUCTION);
      const nullScore = this.minimax(
        nullState, nullDepth, alpha, beta, rootColor, !maximizing, level, timeout, startTime, false, ply + 1
      );
      if (nullScore !== null) {
        if (maximizing && nullScore >= beta) {
          this.lastSearchInfo.cutoffs += 1;
          return beta;
        }
        if (!maximizing && nullScore <= alpha) {
          this.lastSearchInfo.cutoffs += 1;
          return alpha;
        }
      }
    }

    let canFutilityPrune = false;
    if (level >= 6 && !inCheck && depth <= 3) {
      const margin = FUTILITY_MARGINS[depth] || 0;
      canFutilityPrune = maximizing
        ? staticEval + margin <= alpha
        : staticEval - margin >= beta;
    }

    // Countermove lookup: the move that led to this node (opponent's last move)
    // indexes the refutation table. Level >= 4 keeps low-level play unchanged.
    const lastMove = state.undoStack.length > 0 ? state.undoStack[state.undoStack.length - 1].move : null;
    const counterMove = level >= 4 ? this.getCounterMove(lastMove) : null;
    const ordered = this.orderMoves(legalMoves, depth, ttBestMove, counterMove, state.board, level);
    let bestMove = ordered[0];

    if (maximizing) {
      let value = -Infinity;
      for (let i = 0; i < ordered.length; i++) {
        if (i % 10 === 0 && this.isTimeUp(timeout, startTime)) {
          this.lastSearchInfo.timedOut = true;
          return null;
        }

        const move = ordered[i];
        if (canFutilityPrune && i > 0 && !move.captured && !move.promotion && !move.isEnPassant) continue;

        const reduction = this.computeReduction(level, depth, i, move, inCheck);
        state.makeMove(move);
        let child;
        if (i === 0) {
          // First (principal variation) move: full window at full depth.
          child = this.minimax(state, depth - 1, alpha, beta, rootColor, false, level, timeout, startTime, true, ply + 1);
        } else {
          // Later moves: null-window scout (with any LMR reduction).
          child = this.minimax(state, depth - 1 - reduction, alpha, alpha + 1, rootColor, false, level, timeout, startTime, true, ply + 1);
          // Re-search at full depth + full window if the scout beat alpha and a
          // real window remains (this also un-does any LMR reduction).
          if (child !== null && child > alpha && (beta - alpha > 1 || reduction > 0)) {
            child = this.minimax(state, depth - 1, alpha, beta, rootColor, false, level, timeout, startTime, true, ply + 1);
          }
        }
        state.undoMove();

        if (child === null) return null;
        if (child > value) { value = child; bestMove = move; }
        if (value > alpha) alpha = value;
        if (alpha >= beta) {
          this.lastSearchInfo.cutoffs += 1;
          this.storeKillerMove(move, depth);
          if (level >= 4) this.storeCounterMove(lastMove, move);
          this.updateHistory(move, depth);
          break;
        }
      }

      if (ttKey) {
        let flag = TT_EXACT;
        if (value <= originalAlpha) flag = TT_UPPER;
        else if (value >= originalBeta) flag = TT_LOWER;
        this.storeTable(ttKey, depth, value, flag, bestMove, ply);
      }
      return value;
    }

    let value = Infinity;
    for (let i = 0; i < ordered.length; i++) {
      if (timeout && startTime && i % 10 === 0 && Date.now() - startTime >= timeout) {
        this.lastSearchInfo.timedOut = true;
        return null;
      }

      const move = ordered[i];
      if (canFutilityPrune && i > 0 && !move.captured && !move.promotion && !move.isEnPassant) continue;

      const reduction = this.computeReduction(level, depth, i, move, inCheck);
      state.makeMove(move);
      let child;
      if (i === 0) {
        child = this.minimax(state, depth - 1, alpha, beta, rootColor, true, level, timeout, startTime, true, ply + 1);
      } else {
        // Null-window scout around the current beta (with any LMR reduction).
        child = this.minimax(state, depth - 1 - reduction, beta - 1, beta, rootColor, true, level, timeout, startTime, true, ply + 1);
        if (child !== null && child < beta && (beta - alpha > 1 || reduction > 0)) {
          child = this.minimax(state, depth - 1, alpha, beta, rootColor, true, level, timeout, startTime, true, ply + 1);
        }
      }
      state.undoMove();

      if (child === null) return null;
      if (child < value) { value = child; bestMove = move; }
      if (value < beta) beta = value;
      if (alpha >= beta) {
        this.lastSearchInfo.cutoffs += 1;
        this.storeKillerMove(move, depth);
        if (level >= 4) this.storeCounterMove(lastMove, move);
        this.updateHistory(move, depth);
        break;
      }
    }

    if (ttKey) {
      let flag = TT_EXACT;
      if (value <= originalAlpha) flag = TT_UPPER;
      else if (value >= originalBeta) flag = TT_LOWER;
      this.storeTable(ttKey, depth, value, flag, bestMove, ply);
    }

    return value;
  }

  quiescence(state, alpha, beta, rootColor, standPat, timeout, startTime, level, ply = 0) {
    if (this.isTimeUp(timeout, startTime)) {
      this.lastSearchInfo.timedOut = true;
      return null;
    }

    this.lastSearchInfo.qNodes += 1;
    const maximizing = state.activeColor === rootColor;

    // Quiescence TT (levels 4-6): probe and store with depth 0. Any deeper
    // main-search entry also satisfies a depth-0 probe, and depth-0 stores
    // never clobber deeper entries (storeTable replacement guard).
    const originalAlpha = alpha;
    const originalBeta = beta;
    const ttKey = level >= 4 ? state.hash : null;
    if (ttKey) {
      const ttScore = this.probeTable(ttKey, 0, alpha, beta, ply);
      if (ttScore !== null) return ttScore;
    }

    const inCheck = isInCheck(state);

    let value;
    let noisyMoves;
    if (inCheck) {
      // In check: no stand-pat; search all legal evasions and detect checkmate.
      noisyMoves = generateLegalMoves(state);
      if (noisyMoves.length === 0) {
        return state.activeColor === rootColor ? -(MATE - ply) : (MATE - ply);
      }
      // Bounded mated start (never ±Infinity, which could leak on abort).
      value = maximizing ? -(MATE - ply) : (MATE - ply);
    } else {
      // Not in check: stand-pat, then search only noisy moves (captures /
      // promotions / en passant) generated directly — no full legal-move scan.
      value = standPat;
      if (maximizing) {
        if (value >= beta) return value;
        if (value > alpha) alpha = value;
      } else {
        if (value <= alpha) return value;
        if (value < beta) beta = value;
      }
      noisyMoves = generateCaptureMoves(state);
    }

    const movesToSearch = this.orderMoves(noisyMoves, 0, null, null, null, level);
    const cappedMoves = level >= 6 ? movesToSearch : movesToSearch.slice(0, 16);

    for (let i = 0; i < cappedMoves.length; i++) {
      if (i % 5 === 0 && this.isTimeUp(timeout, startTime)) {
        this.lastSearchInfo.timedOut = true;
        return null;
      }

      const move = cappedMoves[i];
      if (!inCheck && level >= 5 && move.captured && !move.promotion) {
        // Skip captures that lose material by static exchange evaluation — a
        // horizon capture that loses an exchange is not worth searching.
        if (seeCapture(state.board, algebraicToIndexFast(move.from), algebraicToIndexFast(move.to), move.isEnPassant) < 0) continue;
      }
      if (!inCheck && level >= 6 && !move.promotion) {
        const capturedValue = pieceValueApprox(move.captured);
        if (maximizing && standPat + capturedValue + 200 < alpha) continue;
        if (!maximizing && standPat - capturedValue - 200 > beta) continue;
      }

      state.makeMove(move);
      const score = this.quiescence(state, alpha, beta, rootColor, this.evalCached(state, rootColor), timeout, startTime, level, ply + 1);
      state.undoMove();

      if (score === null) return null;

      if (maximizing) {
        if (score > value) value = score;
        if (value > alpha) alpha = value;
      } else {
        if (score < value) value = score;
        if (value < beta) beta = value;
      }

      if (alpha >= beta) {
        this.lastSearchInfo.cutoffs += 1;
        break;
      }
    }

    if (ttKey) {
      let flag = TT_EXACT;
      if (value <= originalAlpha) flag = TT_UPPER;
      else if (value >= originalBeta) flag = TT_LOWER;
      this.storeTable(ttKey, 0, value, flag, null, ply);
    }

    return value;
  }

  async progressiveDeepeningSearch(state, legalMoves, maxDepth, color, level, timeout = 10000, signal, onInfo) {
    const startTime = Date.now();
    // Safety fallback: if even depth 1 is aborted before completing a move, we
    // still return a legal move rather than null.
    let bestMove = legalMoves[0] || null;
    let previousBestScore = undefined;

    for (let currentDepth = 1; currentDepth <= maxDepth; currentDepth++) {
      // Cooperative abort: stop deepening and keep the best move from the last
      // completed depth (the worker can set this without being terminated).
      if (signal?.aborted) break;
      if (timeout && Date.now() - startTime >= timeout) {
        this.lastSearchInfo.timedOut = true;
        break;
      }
      // Tail guard: with <25ms left a new (deeper) iteration cannot finish even
      // its first root move, so it would be pure waste — stop and keep the last
      // completed result instead. Partial results of iterations started earlier
      // (with real time left) are still kept, so no usable info is thrown away.
      if (timeout && currentDepth > 1 && Date.now() - startTime > timeout - 25) break;

      const move = this.searchRoot(state, legalMoves, currentDepth, color, {
        level,
        timeout,
        startTime,
        previousBestScore,
      });

      if (move !== null) {
        bestMove = move;
        if (this.lastRootScore !== undefined) {
          previousBestScore = this.lastRootScore;
        }
        this.lastSearchInfo.depthCompleted = currentDepth;
        onInfo?.(this.getLastSearchInfo());
      }

      if (this.lastSearchInfo.timedOut) break;

      // Yield to the macrotask queue between iterations so the worker can
      // process a cooperative "stop" message (a microtask yield would not let
      // a queued message run). A complex position otherwise deepens until the
      // time budget; a simple one stops at the depth cap.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    return bestMove;
  }
}
