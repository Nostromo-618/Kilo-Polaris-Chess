/**
 * Rules.js
 *
 * Generates legal moves for a given GameState-like snapshot.
 * Implements:
 * - All standard piece moves.
 * - Castling (both sides, both colors) with check constraints.
 * - En passant using enPassantTarget from state.
 * - Pawn promotions (to Q/R/B/N, defaulting to Q for engine).
 * - Check, checkmate, stalemate detection helpers.
 *
 * This module is pure w.r.t board + state arguments and contains no DOM logic.
 */

import {
  algebraicToIndex,
  indexToAlgebraic,
  indexToFR,
  getColorOf,
  oppositeColor,
} from "./Board.js";
import {
  createMove,
  createPromotionMove,
  createEnPassantMove,
  createCastleMove,
} from "./Move.js";

/**
 * @typedef {import("./Move.js").Move} Move
 */

/**
 * Generate all pseudo-legal moves (not filtered for leaving king in check).
 * @param {Object} state
 * @param {string[]} state.board length 64
 * @param {"white"|"black"} state.activeColor
 * @param {{white:{kingSide:boolean,queenSide:boolean},black:{kingSide:boolean,queenSide:boolean}}} state.castlingRights
 * @param {string|null} state.enPassantTarget - algebraic square behind pawn just moved two squares
 * @returns {Move[]}
 */
export function generatePseudoLegalMoves(state) {
  const moves = [];
  const { board, activeColor, castlingRights, enPassantTarget } = state;
  const enemy = oppositeColor(activeColor);

  const epIndex =
    enPassantTarget != null ? algebraicToIndex(enPassantTarget) : -1;

  for (let fromIndex = 0; fromIndex < 64; fromIndex += 1) {
    const piece = board[fromIndex];
    if (!piece) continue;
    const color = getColorOf(piece);
    if (color !== activeColor) continue;

    const fromSq = indexToAlgebraic(fromIndex);
    const { file, rank } = indexToFR(fromIndex);

    switch (piece[1]) {
      case "P":
        generatePawnMoves(
          state,
          fromIndex,
          fromSq,
          file,
          rank,
          color,
          enemy,
          epIndex,
          moves
        );
        break;
      case "N":
        generateKnightMoves(board, fromIndex, fromSq, color, moves);
        break;
      case "B":
        generateSlidingMoves(board, fromIndex, fromSq, color, moves, [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]);
        break;
      case "R":
        generateSlidingMoves(board, fromIndex, fromSq, color, moves, [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]);
        break;
      case "Q":
        generateSlidingMoves(board, fromIndex, fromSq, color, moves, [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]);
        break;
      case "K":
        generateKingMoves(board, fromIndex, fromSq, color, moves);
        generateCastlingMoves(
          state,
          fromIndex,
          fromSq,
          color,
          castlingRights,
          moves
        );
        break;
      default:
        break;
    }
  }

  return moves;
}

/**
 * Filter pseudo-legal moves to legal ones (king not left in check).
 * @param {Object} state
 * @returns {Move[]}
 */
export function generateLegalMoves(state) {
  const pseudoMoves = generatePseudoLegalMoves(state);
  const legal = [];

  const board = state.board;
  const moverColor = state.activeColor;
  const enemy = oppositeColor(moverColor);
  // Find the mover's king once (it doesn't move except for its own moves, which
  // the legality check handles), instead of scanning per pseudo-move.
  const kingCode = moverColor === "white" ? "wK" : "bK";
  let kingIndex = -1;
  for (let i = 0; i < 64; i += 1) {
    if (board[i] === kingCode) { kingIndex = i; break; }
  }

  for (const move of pseudoMoves) {
    if (!moveLeavesKingInCheck(board, move, moverColor, enemy, kingIndex)) {
      legal.push(move);
    }
  }

  return legal;
}

/**
 * Generate legal "noisy" moves only — captures, promotions, and en passant —
 * for quiescence search. Much cheaper than generateLegalMoves + filter because
 * the legality check runs only on the handful of noisy moves, not every quiet.
 * @param {Object} state
 * @returns {Move[]}
 */
export function generateCaptureMoves(state) {
  const pseudoMoves = generatePseudoLegalMoves(state);
  const legal = [];

  const board = state.board;
  const moverColor = state.activeColor;
  const enemy = oppositeColor(moverColor);
  const kingCode = moverColor === "white" ? "wK" : "bK";
  let kingIndex = -1;
  for (let i = 0; i < 64; i += 1) {
    if (board[i] === kingCode) { kingIndex = i; break; }
  }

  for (const move of pseudoMoves) {
    if (!(move.captured || move.promotion || move.isEnPassant)) continue;
    if (!moveLeavesKingInCheck(board, move, moverColor, enemy, kingIndex)) {
      legal.push(move);
    }
  }

  return legal;
}

/**
 * Determine if the side to move is currently in check.
 * @param {Object} state
 * @param {"white"|"black"} [colorOverride] if provided, check that color instead
 * @returns {boolean}
 */
export function isInCheck(state, colorOverride) {
  const color = colorOverride || state.activeColor;
  const enemy = oppositeColor(color);
  const kingSquare = findKingSquare(state.board, color);
  if (!kingSquare) return false;
  return squareAttackedBy(state, kingSquare, enemy);
}

/**
 * Generate game status from legal moves and check state.
 * Used by GameState to derive checkmate/stalemate/draw states.
 *
 * @param {Object} state
 * @returns {{
 *   hasLegalMoves: boolean,
 *   isCheck: boolean
 * }}
 */
export function analyzePosition(state) {
  const legalMoves = generateLegalMoves(state);
  const isCheckFlag = isInCheck(state);
  return {
    hasLegalMoves: legalMoves.length > 0,
    isCheck: isCheckFlag,
  };
}

/* ===== Piece-specific generators ===== */

function generatePawnMoves(
  state,
  fromIndex,
  fromSq,
  file,
  rank,
  color,
  enemy,
  epIndex,
  moves
) {
  const { board } = state;
  const dir = color === "white" ? 1 : -1;
  const startRank = color === "white" ? 1 : 6;
  const promotionRank = color === "white" ? 6 : 1;
  const lastRank = color === "white" ? 7 : 0;

  const oneStepRank = rank + dir;
  if (oneStepRank >= 0 && oneStepRank <= 7) {
    const oneStepIndex = oneStepRank * 8 + file;
    if (!board[oneStepIndex]) {
      // Forward move
      addPawnAdvance(fromSq, fromIndex, oneStepIndex, color, promotionRank, lastRank, moves);

      // Two-step from starting rank
      if (rank === startRank) {
        const twoStepRank = rank + 2 * dir;
        const twoStepIndex = twoStepRank * 8 + file;
        if (!board[twoStepIndex]) {
          moves.push(
            createMove(fromSq, indexToAlgebraic(twoStepIndex), board[fromIndex])
          );
        }
      }
    }
  }

  // Captures (including promotion)
  const captureFiles = [file - 1, file + 1];
  for (const cf of captureFiles) {
    if (cf < 0 || cf > 7) continue;
    const targetRank = rank + dir;
    if (targetRank < 0 || targetRank > 7) continue;
    const targetIndex = targetRank * 8 + cf;
    const targetPiece = board[targetIndex];

    if (targetPiece && getColorOf(targetPiece) === enemy) {
      addPawnCapture(
        fromSq,
        fromIndex,
        targetIndex,
        color,
        targetPiece,
        promotionRank,
        lastRank,
        moves
      );
    }

    // En passant
    if (epIndex === targetIndex && !targetPiece) {
      const epPawnRank = rank;
      const epPawnIndex = epPawnRank * 8 + cf;
      const captured = board[epPawnIndex];
      if (captured && getColorOf(captured) === enemy) {
        moves.push(
          createEnPassantMove(
            fromSq,
            indexToAlgebraic(targetIndex),
            board[fromIndex],
            captured
          )
        );
      }
    }
  }
}

function addPawnAdvance(
  fromSq,
  fromIndex,
  toIndex,
  color,
  promotionRank,
  lastRank,
  moves
) {
  const piece = color === "white" ? "wP" : "bP";
  const toSq = indexToAlgebraic(toIndex);
  const { rank } = indexToFR(fromIndex);

  if (rank === promotionRank) {
    // Generate promotions to Q,R,B,N
    ["Q", "R", "B", "N"].forEach((promo) => {
      moves.push(createPromotionMove(fromSq, toSq, piece, promo));
    });
  } else {
    moves.push(createMove(fromSq, toSq, piece));
  }
}

function addPawnCapture(
  fromSq,
  fromIndex,
  toIndex,
  color,
  capturedPiece,
  promotionRank,
  lastRank,
  moves
) {
  const piece = color === "white" ? "wP" : "bP";
  const toSq = indexToAlgebraic(toIndex);
  const { rank } = indexToFR(fromIndex);

  if (rank === promotionRank) {
    ["Q", "R", "B", "N"].forEach((promo) => {
      moves.push(
        createPromotionMove(fromSq, toSq, piece, promo, capturedPiece)
      );
    });
  } else {
    moves.push(createMove(fromSq, toSq, piece, capturedPiece));
  }
}

function generateKnightMoves(board, fromIndex, fromSq, color, moves) {
  const { file, rank } = indexToFR(fromIndex);
  const jumps = [
    [1, 2],
    [2, 1],
    [2, -1],
    [1, -2],
    [-1, -2],
    [-2, -1],
    [-2, 1],
    [-1, 2],
  ];

  for (const [df, dr] of jumps) {
    const nf = file + df;
    const nr = rank + dr;
    if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
    const toIndex = nr * 8 + nf;
    const target = board[toIndex];
    if (!target || getColorOf(target) !== color) {
      moves.push(
        createMove(
          fromSq,
          indexToAlgebraic(toIndex),
          board[fromIndex],
          target || null
        )
      );
    }
  }
}

function generateSlidingMoves(board, fromIndex, fromSq, color, moves, dirs) {
  for (const [df, dr] of dirs) {
    let { file, rank } = indexToFR(fromIndex);
    while (true) {
      file += df;
      rank += dr;
      if (file < 0 || file > 7 || rank < 0 || rank > 7) break;
      const toIndex = rank * 8 + file;
      const target = board[toIndex];
      if (!target) {
        moves.push(
          createMove(
            fromSq,
            indexToAlgebraic(toIndex),
            board[fromIndex],
            null
          )
        );
      } else {
        if (getColorOf(target) !== color) {
          moves.push(
            createMove(
              fromSq,
              indexToAlgebraic(toIndex),
              board[fromIndex],
              target
            )
          );
        }
        break;
      }
    }
  }
}

function generateKingMoves(board, fromIndex, fromSq, color, moves) {
  const { file, rank } = indexToFR(fromIndex);
  for (let df = -1; df <= 1; df += 1) {
    for (let dr = -1; dr <= 1; dr += 1) {
      if (df === 0 && dr === 0) continue;
      const nf = file + df;
      const nr = rank + dr;
      if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
      const toIndex = nr * 8 + nf;
      const target = board[toIndex];
      if (!target || getColorOf(target) !== color) {
        moves.push(
          createMove(
            fromSq,
            indexToAlgebraic(toIndex),
            board[fromIndex],
            target || null
          )
        );
      }
    }
  }
}

function generateCastlingMoves(
  state,
  kingIndex,
  kingSq,
  color,
  castlingRights,
  moves
) {
  const { board } = state;
  const rights = castlingRights[color];
  const rank = color === "white" ? 0 : 7;
  const kingStartIndex = rank * 8 + 4;
  if (kingIndex !== kingStartIndex) return;

  const enemy = oppositeColor(color);

  // Ensure king is not currently in check
  if (squareAttackedBy(state, kingSq, enemy)) return;

  // King-side
  if (rights.kingSide) {
    const fIndex = rank * 8 + 5;
    const gIndex = rank * 8 + 6;
    if (!board[fIndex] && !board[gIndex]) {
      const fSq = indexToAlgebraic(fIndex);
      const gSq = indexToAlgebraic(gIndex);
      if (
        !squareAttackedBy(state, fSq, enemy) &&
        !squareAttackedBy(state, gSq, enemy)
      ) {
        moves.push(
          createCastleMove(
            kingSq,
            gSq,
            board[kingIndex],
            true // king side
          )
        );
      }
    }
  }

  // Queen-side
  if (rights.queenSide) {
    const dIndex = rank * 8 + 3;
    const cIndex = rank * 8 + 2;
    const bIndex = rank * 8 + 1;
    if (!board[dIndex] && !board[cIndex] && !board[bIndex]) {
      const dSq = indexToAlgebraic(dIndex);
      const cSq = indexToAlgebraic(cIndex);
      if (
        !squareAttackedBy(state, dSq, enemy) &&
        !squareAttackedBy(state, cSq, enemy)
      ) {
        moves.push(
          createCastleMove(
            kingSq,
            cSq,
            board[kingIndex],
            false // queen side
          )
        );
      }
    }
  }
}

/* ===== Attack / check helpers ===== */

function findKingSquare(board, color) {
  const kingCode = color === "white" ? "wK" : "bK";
  for (let i = 0; i < 64; i += 1) {
    if (board[i] === kingCode) return indexToAlgebraic(i);
  }
  return null;
}

/**
 * If the side to move is in check, return that side's king square; otherwise null.
 * @param {Object} state - rules state
 * @returns {string|null}
 */
export function getCheckedKingSquare(state) {
  if (!isInCheck(state)) return null;
  return findKingSquare(state.board, state.activeColor);
}

// Hoisted to module scope so the hot attack scan allocates nothing per call.
const KNIGHT_JUMPS = [
  [1, 2], [2, 1], [2, -1], [1, -2],
  [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];
const ORTHO_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

/**
 * Whether board[targetIndex] is attacked by attackerColor. Allocation-free and
 * index-based; checks attackers FROM the target square and exits early.
 */
function squareIndexAttackedBy(board, targetIndex, attackerColor) {
  const tf = targetIndex % 8;
  const tr = (targetIndex - tf) / 8;
  const white = attackerColor === "white";

  const knightCode = white ? "wN" : "bN";
  for (let i = 0; i < 8; i++) {
    const f = tf + KNIGHT_JUMPS[i][0];
    const r = tr + KNIGHT_JUMPS[i][1];
    if (f < 0 || f > 7 || r < 0 || r > 7) continue;
    if (board[r * 8 + f] === knightCode) return true;
  }

  const pawnCode = white ? "wP" : "bP";
  const pr = tr + (white ? -1 : 1); // attackers come from the opposite direction
  if (pr >= 0 && pr <= 7) {
    if (tf > 0 && board[pr * 8 + tf - 1] === pawnCode) return true;
    if (tf < 7 && board[pr * 8 + tf + 1] === pawnCode) return true;
  }

  const kingCode = white ? "wK" : "bK";
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (df === 0 && dr === 0) continue;
      const f = tf + df;
      const r = tr + dr;
      if (f < 0 || f > 7 || r < 0 || r > 7) continue;
      if (board[r * 8 + f] === kingCode) return true;
    }
  }

  const rookCode = white ? "wR" : "bR";
  const bishopCode = white ? "wB" : "bB";
  const queenCode = white ? "wQ" : "bQ";

  for (let i = 0; i < 4; i++) {
    const df = ORTHO_DIRS[i][0];
    const dr = ORTHO_DIRS[i][1];
    let f = tf + df;
    let r = tr + dr;
    while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
      const piece = board[r * 8 + f];
      if (piece) {
        if (piece === rookCode || piece === queenCode) return true;
        break;
      }
      f += df;
      r += dr;
    }
  }

  for (let i = 0; i < 4; i++) {
    const df = DIAG_DIRS[i][0];
    const dr = DIAG_DIRS[i][1];
    let f = tf + df;
    let r = tr + dr;
    while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
      const piece = board[r * 8 + f];
      if (piece) {
        if (piece === bishopCode || piece === queenCode) return true;
        break;
      }
      f += df;
      r += dr;
    }
  }

  return false;
}

/**
 * Whether a given square (algebraic) is attacked by a specific color.
 */
function squareAttackedBy(state, targetSq, attackerColor) {
  return squareIndexAttackedBy(state.board, algebraicToIndex(targetSq), attackerColor);
}

/**
 * Check if applying a move leaves own king in check.
 * Used to filter pseudo-legal moves.
 * @param {Object} state
 * @param {Move} move
 */
function moveLeavesKingInCheck(board, move, moverColor, enemy, kingIndex) {
  const fromIndex = algebraicToIndex(move.from);
  const toIndex = algebraicToIndex(move.to);
  const movingPiece = board[fromIndex];

  // Apply the move in place on the real board (no allocation), test, then revert.
  const savedFrom = board[fromIndex];
  const savedTo = board[toIndex];
  board[fromIndex] = null;

  let epCapIndex = -1;
  let epSaved = null;
  if (move.isEnPassant) {
    const dir = moverColor === "white" ? -1 : 1;
    const tf = toIndex % 8;
    const tr = (toIndex - tf) / 8;
    epCapIndex = (tr + dir) * 8 + tf;
    epSaved = board[epCapIndex];
    board[epCapIndex] = null;
  }

  if (move.promotion) {
    board[toIndex] = `${moverColor === "white" ? "w" : "b"}${move.promotion}`;
  } else {
    board[toIndex] = movingPiece;
  }

  let rookFrom = -1;
  let rookTo = -1;
  let rookSavedFrom = null;
  let rookSavedTo = null;
  if (move.isCastleKingSide || move.isCastleQueenSide) {
    const rank = moverColor === "white" ? 0 : 7;
    if (move.isCastleKingSide) { rookFrom = rank * 8 + 7; rookTo = rank * 8 + 5; }
    else { rookFrom = rank * 8 + 0; rookTo = rank * 8 + 3; }
    rookSavedFrom = board[rookFrom];
    rookSavedTo = board[rookTo];
    board[rookTo] = board[rookFrom];
    board[rookFrom] = null;
  }

  // The king's square after the move: its destination if the king moved (incl.
  // castling), otherwise the precomputed king index.
  const kIndex = (movingPiece === "wK" || movingPiece === "bK") ? toIndex : kingIndex;
  const inCheck = kIndex < 0 ? true : squareIndexAttackedBy(board, kIndex, enemy);

  // Revert.
  board[fromIndex] = savedFrom;
  board[toIndex] = savedTo;
  if (epCapIndex >= 0) board[epCapIndex] = epSaved;
  if (rookFrom >= 0) { board[rookFrom] = rookSavedFrom; board[rookTo] = rookSavedTo; }

  return inCheck;
}

