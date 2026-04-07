/**
 * Evaluator.js
 *
 * Static evaluation for chess positions.
 * - Material balance
 * - Piece-square tables
 * - Pawn structure (passed, doubled, isolated pawns)
 * - Bishop pair bonus
 * - Rook on open/semi-open file bonus
 * - King safety (pawn shield, open files near king)
 *
 * Tuned for clarity and reasonable strength.
 */

import { getColorOf, oppositeColor } from "./Board.js";

/* === Evaluation bonus/penalty constants === */
const BISHOP_PAIR_BONUS = 30;
const PASSED_PAWN_BONUS = [0, 10, 20, 35, 55, 80, 110, 0]; // By rank (0-7 for white)
const DOUBLED_PAWN_PENALTY = 20;
const ISOLATED_PAWN_PENALTY = 15;
const ROOK_OPEN_FILE_BONUS = 25;
const ROOK_SEMI_OPEN_FILE_BONUS = 12;

/* === King safety constants === */
const PAWN_SHIELD_BONUS = 15;        // Per pawn in front of castled king
const OPEN_FILE_NEAR_KING_PENALTY = 20;  // Per open file adjacent to king
const CASTLED_KING_BONUS = 25;       // Bonus for king on g1/g8 or c1/c8

/**
 * Piece values (centipawns).
 */
const PIECE_VALUES = {
  P: 100,
  N: 320,
  B: 330,
  R: 500,
  Q: 900,
  K: 0,
};

/**
 * Simple piece-square tables for middlegame, from white's perspective.
 * Indexed 0..63 with a1 = 0. We mirror for black where sensible.
 * Values are in centipawns.
 */

const PST_PAWN = [
   0,  0,  0,  0,  0,  0,  0,  0,
  40, 50, 50, 60, 60, 50, 50, 40,
  10, 10, 20, 35, 35, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  5, 20, 20,  5,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
];

const PST_KNIGHT = [
 -50,-40,-30,-30,-30,-30,-40,-50,
 -40,-20,  0,  0,  0,  0,-20,-40,
 -30,  0, 10, 15, 15, 10,  0,-30,
 -30,  5, 15, 20, 20, 15,  5,-30,
 -30,  0, 15, 20, 20, 15,  0,-30,
 -30,  5, 10, 15, 15, 10,  5,-30,
 -40,-20,  0,  5,  5,  0,-20,-40,
 -50,-40,-30,-30,-30,-30,-40,-50,
];

const PST_BISHOP = [
 -20,-10,-10,-10,-10,-10,-10,-20,
 -10,  5,  0,  0,  0,  0,  5,-10,
 -10, 10, 10, 10, 10, 10, 10,-10,
 -10,  0, 10, 10, 10, 10,  0,-10,
 -10,  5,  5, 10, 10,  5,  5,-10,
 -10,  0,  5, 10, 10,  5,  0,-10,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -20,-10,-10,-10,-10,-10,-10,-20,
];

const PST_ROOK = [
  0,  0,  5, 10, 10,  5,  0,  0,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
  5, 10, 10, 10, 10, 10, 10,  5,
  0,  0,  0,  0,  0,  0,  0,  0,
];

const PST_QUEEN = [
 -20,-10,-10, -5, -5,-10,-10,-20,
 -10,  0,  5,  0,  0,  0,  0,-10,
 -10,  5,  5,  5,  5,  5,  0,-10,
  -5,  0,  5,  5,  5,  5,  0, -5,
   0,  0,  5,  5,  5,  5,  0, -5,
 -10,  5,  5,  5,  5,  5,  0,-10,
 -10,  0,  5,  0,  0,  0,  0,-10,
 -20,-10,-10, -5, -5,-10,-10,-20,
];

const PST_KING = [
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -20,-30,-30,-40,-40,-30,-30,-20,
 -10,-20,-20,-20,-20,-20,-20,-10,
  20, 20,  0,  0,  0,  0, 20, 20,
  20, 30, 10,  0,  0, 10, 30, 20,
];

/**
 * Evaluate board from perspective of `color`.
 * Positive score = good for `color`.
 *
 * @param {Object} state
 * @param {string[]} state.board
 * @param {"white"|"black"} color
 * @returns {number} score in centipawns
 */
export function evaluate(state, color) {
  const { board } = state;
  let score = 0;

  // Track pieces for additional evaluation
  let whiteBishops = 0;
  let blackBishops = 0;
  let whiteKingIndex = -1;
  let blackKingIndex = -1;
  const whitePawnFiles = new Array(8).fill(0); // Count pawns per file
  const blackPawnFiles = new Array(8).fill(0);
  const whitePawnPositions = [];
  const blackPawnPositions = [];
  const whiteRookPositions = [];
  const blackRookPositions = [];

  // First pass: material + PST + collect piece info
  for (let i = 0; i < 64; i += 1) {
    const piece = board[i];
    if (!piece) continue;
    const pc = getColorOf(piece);
    const type = piece[1];
    const base = PIECE_VALUES[type] || 0;
    let pst = 0;

    const file = i % 8;
    const rank = Math.floor(i / 8);

    switch (type) {
      case "P":
        pst = PST_PAWN[pstIndex(i, pc)];
        if (pc === "white") {
          whitePawnFiles[file]++;
          whitePawnPositions.push({ index: i, file, rank });
        } else {
          blackPawnFiles[file]++;
          blackPawnPositions.push({ index: i, file, rank });
        }
        break;
      case "N":
        pst = PST_KNIGHT[pstIndex(i, pc)];
        break;
      case "B":
        pst = PST_BISHOP[pstIndex(i, pc)];
        if (pc === "white") whiteBishops++;
        else blackBishops++;
        break;
      case "R":
        pst = PST_ROOK[pstIndex(i, pc)];
        if (pc === "white") whiteRookPositions.push(file);
        else blackRookPositions.push(file);
        break;
      case "Q":
        pst = PST_QUEEN[pstIndex(i, pc)];
        break;
      case "K":
        pst = PST_KING[pstIndex(i, pc)];
        if (pc === "white") whiteKingIndex = i;
        else blackKingIndex = i;
        break;
      default:
        break;
    }

    const pieceScore = base + pst;
    score += pc === color ? pieceScore : -pieceScore;
  }

  // Bishop pair bonus
  if (whiteBishops >= 2) {
    score += color === "white" ? BISHOP_PAIR_BONUS : -BISHOP_PAIR_BONUS;
  }
  if (blackBishops >= 2) {
    score += color === "black" ? BISHOP_PAIR_BONUS : -BISHOP_PAIR_BONUS;
  }

  // Pawn structure evaluation
  score += evaluatePawnStructure(whitePawnPositions, whitePawnFiles, blackPawnFiles, blackPawnPositions, "white", color);
  score += evaluatePawnStructure(blackPawnPositions, blackPawnFiles, whitePawnFiles, whitePawnPositions, "black", color);

  // Rook on open/semi-open file
  score += evaluateRooks(whiteRookPositions, whitePawnFiles, blackPawnFiles, "white", color);
  score += evaluateRooks(blackRookPositions, blackPawnFiles, whitePawnFiles, "black", color);

  // King safety evaluation
  score += evaluateKingSafety(whiteKingIndex, whitePawnFiles, blackPawnFiles, "white", color);
  score += evaluateKingSafety(blackKingIndex, blackPawnFiles, whitePawnFiles, "black", color);

  return score;
}

/**
 * Evaluate pawn structure for one color.
 */
function evaluatePawnStructure(pawnPositions, ownPawnFiles, enemyPawnFiles, enemyPawnPositions, pawnColor, evalColor) {
  let bonus = 0;
  const sign = pawnColor === evalColor ? 1 : -1;

  for (const pawn of pawnPositions) {
    const { file, rank } = pawn;

    // Doubled pawn penalty
    if (ownPawnFiles[file] > 1) {
      bonus -= DOUBLED_PAWN_PENALTY / ownPawnFiles[file]; // Spread penalty among doubled pawns
    }

    // Isolated pawn penalty (no friendly pawns on adjacent files)
    const leftFile = file > 0 ? ownPawnFiles[file - 1] : 0;
    const rightFile = file < 7 ? ownPawnFiles[file + 1] : 0;
    if (leftFile === 0 && rightFile === 0) {
      bonus -= ISOLATED_PAWN_PENALTY;
    }

    // Passed pawn bonus (no enemy pawns ahead on same or adjacent files)
    if (isPassedPawn(file, rank, pawnColor, enemyPawnPositions)) {
      const advancementRank = pawnColor === "white" ? 7 - rank : rank;
      bonus += PASSED_PAWN_BONUS[advancementRank];
    }
  }

  return bonus * sign;
}

/**
 * Check if a pawn is passed (no enemy pawns can block or capture it).
 */
function isPassedPawn(file, rank, pawnColor, enemyPawns) {
  const startRank = pawnColor === "white" ? rank + 1 : rank - 1;
  const endRank = pawnColor === "white" ? 7 : 0;
  const rankStep = pawnColor === "white" ? 1 : -1;

  // Check all squares ahead of the pawn on same and adjacent files
  for (let r = startRank; pawnColor === "white" ? r <= endRank : r >= endRank; r += rankStep) {
    // Check same file
    if (enemyPawns.some(p => p.file === file && p.rank === r)) {
      return false;
    }
    // Check left adjacent file
    if (file > 0 && enemyPawns.some(p => p.file === file - 1 && p.rank === r)) {
      return false;
    }
    // Check right adjacent file
    if (file < 7 && enemyPawns.some(p => p.file === file + 1 && p.rank === r)) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluate rook placement on open/semi-open files.
 */
function evaluateRooks(rookFiles, ownPawnFiles, enemyPawnFiles, rookColor, evalColor) {
  let bonus = 0;
  const sign = rookColor === evalColor ? 1 : -1;

  for (const file of rookFiles) {
    const ownPawnsOnFile = ownPawnFiles[file];
    const enemyPawnsOnFile = enemyPawnFiles[file];

    if (ownPawnsOnFile === 0 && enemyPawnsOnFile === 0) {
      // Open file (no pawns at all)
      bonus += ROOK_OPEN_FILE_BONUS;
    } else if (ownPawnsOnFile === 0) {
      // Semi-open file (only enemy pawns)
      bonus += ROOK_SEMI_OPEN_FILE_BONUS;
    }
  }

  return bonus * sign;
}

/**
 * Map index for PST; mirror ranks for black so tables are from white's view.
 * @param {number} index
 * @param {"white"|"black"} color
 */
function pstIndex(index, color) {
  if (color === "white") return index;
  const file = index % 8;
  const rank = Math.floor(index / 8);
  const mirroredRank = 7 - rank;
  return mirroredRank * 8 + file;
}

/**
 * Evaluate king safety based on pawn shield and open files.
 * @param {number} kingIndex - Position of the king (0-63)
 * @param {number[]} ownPawnFiles - Pawn count per file for this color
 * @param {number[]} enemyPawnFiles - Pawn count per file for enemy
 * @param {"white"|"black"} kingColor - Color of the king
 * @param {"white"|"black"} evalColor - Color we're evaluating for
 */
function evaluateKingSafety(kingIndex, ownPawnFiles, enemyPawnFiles, kingColor, evalColor) {
  if (kingIndex < 0) return 0;

  let bonus = 0;
  const sign = kingColor === evalColor ? 1 : -1;

  const kingFile = kingIndex % 8;
  const kingRank = Math.floor(kingIndex / 8);

  // Check if king is on back rank (likely castled position)
  const isOnBackRank = (kingColor === "white" && kingRank === 0) ||
                       (kingColor === "black" && kingRank === 7);

  // Castled king bonus (king on g1/g8 or c1/c8)
  if (isOnBackRank && (kingFile === 6 || kingFile === 2)) {
    bonus += CASTLED_KING_BONUS;
  }

  // Pawn shield evaluation (for kings on back rank)
  if (isOnBackRank) {
    // Check pawns on king's file and adjacent files
    const shieldFiles = [];
    if (kingFile > 0) shieldFiles.push(kingFile - 1);
    shieldFiles.push(kingFile);
    if (kingFile < 7) shieldFiles.push(kingFile + 1);

    for (const file of shieldFiles) {
      if (ownPawnFiles[file] > 0) {
        bonus += PAWN_SHIELD_BONUS;
      }
    }
  }

  // Open file penalty near king
  // More dangerous if there are no friendly pawns blocking
  const nearbyFiles = [];
  if (kingFile > 0) nearbyFiles.push(kingFile - 1);
  nearbyFiles.push(kingFile);
  if (kingFile < 7) nearbyFiles.push(kingFile + 1);

  for (const file of nearbyFiles) {
    // Penalty if file has no friendly pawns (open or semi-open against us)
    if (ownPawnFiles[file] === 0) {
      bonus -= OPEN_FILE_NEAR_KING_PENALTY;
    }
  }

  return bonus * sign;
}

