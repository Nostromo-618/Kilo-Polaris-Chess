/**
 * Evaluator.js
 *
 * Static evaluation for chess positions.
 * - Material balance
 * - Tapered piece-square tables (middlegame + endgame interpolation)
 * - Pawn structure (passed, doubled, isolated, connected passed)
 * - Bishop pair bonus
 * - Rook on open/semi-open file bonus
 * - King safety (pawn shield, open files near king)
 * - Mobility evaluation
 * - King proximity to passed pawns (endgame)
 * - Tempo bonus
 *
 * Tapered evaluation blends middlegame and endgame scores based on
 * remaining non-pawn material (game phase).
 */

import { getColorOf, oppositeColor } from "./Board.js";

/* === Evaluation bonus/penalty constants === */
const BISHOP_PAIR_BONUS_MG = 35;
const BISHOP_PAIR_BONUS_EG = 55;
const PASSED_PAWN_BONUS_MG = [0, 10, 20, 35, 55, 80, 110, 0];
const PASSED_PAWN_BONUS_EG = [0, 15, 30, 50, 75, 110, 150, 0];
const DOUBLED_PAWN_PENALTY = 20;
const ISOLATED_PAWN_PENALTY = 15;
const CONNECTED_PASSED_BONUS = 25;
const ROOK_OPEN_FILE_BONUS = 25;
const ROOK_SEMI_OPEN_FILE_BONUS = 12;
const ROOK_BEHIND_PASSED_BONUS = 20;
const BLOCKED_PASSED_PENALTY = 15;

/* === King safety constants === */
const PAWN_SHIELD_BONUS = 15;
const OPEN_FILE_NEAR_KING_PENALTY = 20;
const CASTLED_KING_BONUS = 25;

/* === Mobility weights (per available square) === */
const MOBILITY_KNIGHT = 4;
const MOBILITY_BISHOP = 5;
const MOBILITY_ROOK = 2;
const MOBILITY_QUEEN = 1;

/* === Tempo bonus === */
const TEMPO_BONUS = 10;

/* === King distance to passed pawn (endgame) === */
const KING_PASSER_PROXIMITY_OWN = 5;   // bonus per rank closer
const KING_PASSER_PROXIMITY_ENEMY = 3; // penalty per rank closer (enemy king)

/**
 * Phase calculation: total non-pawn non-king material at game start.
 * 2*(N+B+R+Q) = 2*(320+330+500+900) = 4100 per side
 */
const PHASE_TOTAL = 4100;

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

/* Non-pawn material values for phase calculation */
const PHASE_WEIGHTS = {
  N: 320,
  B: 330,
  R: 500,
  Q: 900,
};

/* ============================================================
 * Piece-Square Tables — MIDDLEGAME
 * Indexed 0..63 with a1=0. Mirror for black.
 * ============================================================ */

const PST_PAWN_MG = [
   0,  0,  0,  0,  0,  0,  0,  0,
  40, 50, 50, 60, 60, 50, 50, 40,
  10, 10, 20, 35, 35, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  5, 20, 20,  5,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
];

const PST_KNIGHT_MG = [
 -50,-40,-30,-30,-30,-30,-40,-50,
 -40,-20,  0,  0,  0,  0,-20,-40,
 -30,  0, 10, 15, 15, 10,  0,-30,
 -30,  5, 15, 20, 20, 15,  5,-30,
 -30,  0, 15, 20, 20, 15,  0,-30,
 -30,  5, 10, 15, 15, 10,  5,-30,
 -40,-20,  0,  5,  5,  0,-20,-40,
 -50,-40,-30,-30,-30,-30,-40,-50,
];

const PST_BISHOP_MG = [
 -20,-10,-10,-10,-10,-10,-10,-20,
 -10,  5,  0,  0,  0,  0,  5,-10,
 -10, 10, 10, 10, 10, 10, 10,-10,
 -10,  0, 10, 10, 10, 10,  0,-10,
 -10,  5,  5, 10, 10,  5,  5,-10,
 -10,  0,  5, 10, 10,  5,  0,-10,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -20,-10,-10,-10,-10,-10,-10,-20,
];

const PST_ROOK_MG = [
  0,  0,  5, 10, 10,  5,  0,  0,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
  5, 10, 10, 10, 10, 10, 10,  5,
  0,  0,  0,  0,  0,  0,  0,  0,
];

const PST_QUEEN_MG = [
 -20,-10,-10, -5, -5,-10,-10,-20,
 -10,  0,  5,  0,  0,  0,  0,-10,
 -10,  5,  5,  5,  5,  5,  0,-10,
  -5,  0,  5,  5,  5,  5,  0, -5,
   0,  0,  5,  5,  5,  5,  0, -5,
 -10,  5,  5,  5,  5,  5,  0,-10,
 -10,  0,  5,  0,  0,  0,  0,-10,
 -20,-10,-10, -5, -5,-10,-10,-20,
];

const PST_KING_MG = [
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -20,-30,-30,-40,-40,-30,-30,-20,
 -10,-20,-20,-20,-20,-20,-20,-10,
  20, 20,  0,  0,  0,  0, 20, 20,
  20, 30, 10,  0,  0, 10, 30, 20,
];

/* ============================================================
 * Piece-Square Tables — ENDGAME
 * Key differences: King centralizes, pawns push, knights less central
 * ============================================================ */

const PST_PAWN_EG = [
   0,  0,  0,  0,  0,  0,  0,  0,
  70, 70, 70, 70, 70, 70, 70, 70,
  40, 40, 40, 45, 45, 40, 40, 40,
  20, 20, 25, 30, 30, 25, 20, 20,
  10, 10, 15, 25, 25, 15, 10, 10,
   5,  5,  5, 10, 10,  5,  5,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
   0,  0,  0,  0,  0,  0,  0,  0,
];

const PST_KNIGHT_EG = [
 -50,-40,-30,-30,-30,-30,-40,-50,
 -40,-20,  0,  0,  0,  0,-20,-40,
 -30,  0,  5, 10, 10,  5,  0,-30,
 -30,  0, 10, 15, 15, 10,  0,-30,
 -30,  0, 10, 15, 15, 10,  0,-30,
 -30,  0,  5, 10, 10,  5,  0,-30,
 -40,-20,  0,  0,  0,  0,-20,-40,
 -50,-40,-30,-30,-30,-30,-40,-50,
];

const PST_BISHOP_EG = [
 -20,-10,-10,-10,-10,-10,-10,-20,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -10,  0, 10, 10, 10, 10,  0,-10,
 -10,  0, 10, 15, 15, 10,  0,-10,
 -10,  0, 10, 15, 15, 10,  0,-10,
 -10,  0, 10, 10, 10, 10,  0,-10,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -20,-10,-10,-10,-10,-10,-10,-20,
];

const PST_ROOK_EG = [
  0,  0,  5, 10, 10,  5,  0,  0,
  0,  0,  0,  0,  0,  0,  0,  0,
  0,  0,  0,  0,  0,  0,  0,  0,
  0,  0,  0,  0,  0,  0,  0,  0,
  0,  0,  0,  0,  0,  0,  0,  0,
  0,  0,  0,  0,  0,  0,  0,  0,
  0,  0,  0,  0,  0,  0,  0,  0,
  0,  0,  0,  0,  0,  0,  0,  0,
];

const PST_QUEEN_EG = [
 -20,-10,-10, -5, -5,-10,-10,-20,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -10,  0,  5,  5,  5,  5,  0,-10,
  -5,  0,  5, 10, 10,  5,  0, -5,
  -5,  0,  5, 10, 10,  5,  0, -5,
 -10,  0,  5,  5,  5,  5,  0,-10,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -20,-10,-10, -5, -5,-10,-10,-20,
];

/* King endgame: centralize aggressively */
const PST_KING_EG = [
 -50,-30,-20,-20,-20,-20,-30,-50,
 -30,-10,  0,  5,  5,  0,-10,-30,
 -20,  0, 10, 15, 15, 10,  0,-20,
 -20,  0, 15, 20, 20, 15,  0,-20,
 -20,  0, 15, 20, 20, 15,  0,-20,
 -20,  0, 10, 15, 15, 10,  0,-20,
 -30,-10,  0,  5,  5,  0,-10,-30,
 -50,-30,-20,-20,-20,-20,-30,-50,
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
  let mgScore = 0;
  let egScore = 0;

  // Track pieces for additional evaluation
  let whiteBishops = 0;
  let blackBishops = 0;
  let whiteKingIndex = -1;
  let blackKingIndex = -1;
  const whitePawnFiles = new Array(8).fill(0);
  const blackPawnFiles = new Array(8).fill(0);
  const whitePawnPositions = [];
  const blackPawnPositions = [];
  const whiteRookPositions = [];
  const blackRookPositions = [];

  // Phase calculation: remaining non-pawn material
  let whiteNonPawnMaterial = 0;
  let blackNonPawnMaterial = 0;

  // Piece lists for mobility
  const whiteKnights = [];
  const blackKnights = [];
  const whiteBishopList = [];
  const blackBishopList = [];
  const whiteRookList = [];
  const blackRookList = [];
  const whiteQueens = [];
  const blackQueens = [];

  // First pass: material + PST + collect piece info
  for (let i = 0; i < 64; i += 1) {
    const piece = board[i];
    if (!piece) continue;
    const pc = getColorOf(piece);
    const type = piece[1];
    const base = PIECE_VALUES[type] || 0;
    let mgPst = 0;
    let egPst = 0;

    const file = i % 8;
    const rank = Math.floor(i / 8);
    const psi = pstIndex(i, pc);

    switch (type) {
      case "P":
        mgPst = PST_PAWN_MG[psi];
        egPst = PST_PAWN_EG[psi];
        if (pc === "white") {
          whitePawnFiles[file]++;
          whitePawnPositions.push({ index: i, file, rank });
        } else {
          blackPawnFiles[file]++;
          blackPawnPositions.push({ index: i, file, rank });
        }
        break;
      case "N":
        mgPst = PST_KNIGHT_MG[psi];
        egPst = PST_KNIGHT_EG[psi];
        if (pc === "white") { whiteKnights.push(i); whiteNonPawnMaterial += PHASE_WEIGHTS.N; }
        else { blackKnights.push(i); blackNonPawnMaterial += PHASE_WEIGHTS.N; }
        break;
      case "B":
        mgPst = PST_BISHOP_MG[psi];
        egPst = PST_BISHOP_EG[psi];
        if (pc === "white") { whiteBishops++; whiteBishopList.push(i); whiteNonPawnMaterial += PHASE_WEIGHTS.B; }
        else { blackBishops++; blackBishopList.push(i); blackNonPawnMaterial += PHASE_WEIGHTS.B; }
        break;
      case "R":
        mgPst = PST_ROOK_MG[psi];
        egPst = PST_ROOK_EG[psi];
        if (pc === "white") { whiteRookPositions.push(file); whiteRookList.push(i); whiteNonPawnMaterial += PHASE_WEIGHTS.R; }
        else { blackRookPositions.push(file); blackRookList.push(i); blackNonPawnMaterial += PHASE_WEIGHTS.R; }
        break;
      case "Q":
        mgPst = PST_QUEEN_MG[psi];
        egPst = PST_QUEEN_EG[psi];
        if (pc === "white") { whiteQueens.push(i); whiteNonPawnMaterial += PHASE_WEIGHTS.Q; }
        else { blackQueens.push(i); blackNonPawnMaterial += PHASE_WEIGHTS.Q; }
        break;
      case "K":
        mgPst = PST_KING_MG[psi];
        egPst = PST_KING_EG[psi];
        if (pc === "white") whiteKingIndex = i;
        else blackKingIndex = i;
        break;
      default:
        break;
    }

    const mgPieceScore = base + mgPst;
    const egPieceScore = base + egPst;
    if (pc === color) {
      mgScore += mgPieceScore;
      egScore += egPieceScore;
    } else {
      mgScore -= mgPieceScore;
      egScore -= egPieceScore;
    }
  }

  // Compute game phase (1 = middlegame, 0 = endgame)
  const totalNonPawn = whiteNonPawnMaterial + blackNonPawnMaterial;
  const phase = Math.min(1, totalNonPawn / PHASE_TOTAL);

  // Bishop pair bonus (tapered)
  if (whiteBishops >= 2) {
    const bp = lerp(BISHOP_PAIR_BONUS_EG, BISHOP_PAIR_BONUS_MG, phase);
    mgScore += color === "white" ? bp : -bp;
    egScore += color === "white" ? bp : -bp;
  }
  if (blackBishops >= 2) {
    const bp = lerp(BISHOP_PAIR_BONUS_EG, BISHOP_PAIR_BONUS_MG, phase);
    mgScore += color === "black" ? bp : -bp;
    egScore += color === "black" ? bp : -bp;
  }

  // Pawn structure evaluation (tapered)
  const whitePawnEval = evaluatePawnStructure(whitePawnPositions, whitePawnFiles, blackPawnFiles, blackPawnPositions, "white", color, phase, board, whiteRookPositions);
  const blackPawnEval = evaluatePawnStructure(blackPawnPositions, blackPawnFiles, whitePawnFiles, whitePawnPositions, "black", color, phase, board, blackRookPositions);
  mgScore += whitePawnEval;
  egScore += whitePawnEval;
  mgScore += blackPawnEval;
  egScore += blackPawnEval;

  // Rook on open/semi-open file
  const whiteRookEval = evaluateRooks(whiteRookPositions, whitePawnFiles, blackPawnFiles, "white", color);
  const blackRookEval = evaluateRooks(blackRookPositions, blackPawnFiles, whitePawnFiles, "black", color);
  mgScore += whiteRookEval;
  egScore += whiteRookEval;
  mgScore += blackRookEval;
  egScore += blackRookEval;

  // King safety evaluation (middlegame weighted)
  const whiteKingSafety = evaluateKingSafety(whiteKingIndex, whitePawnFiles, blackPawnFiles, "white", color);
  const blackKingSafety = evaluateKingSafety(blackKingIndex, blackPawnFiles, whitePawnFiles, "black", color);
  mgScore += whiteKingSafety;
  mgScore += blackKingSafety;

  // Mobility evaluation
  const whiteMobility = evaluateMobility(board, whiteKnights, whiteBishopList, whiteRookList, whiteQueens, "white", color);
  const blackMobility = evaluateMobility(board, blackKnights, blackBishopList, blackRookList, blackQueens, "black", color);
  mgScore += whiteMobility;
  egScore += whiteMobility;
  mgScore += blackMobility;
  egScore += blackMobility;

  // King proximity to passed pawns (endgame only, scales with 1-phase)
  if (phase < 0.7) {
    const kpEval = evaluateKingPasserProximity(
      whitePawnPositions, blackPawnPositions,
      whitePawnFiles, blackPawnFiles,
      whiteKingIndex, blackKingIndex,
      color, phase
    );
    egScore += kpEval;
  }

  // Tempo bonus
  if (state.activeColor === color) {
    mgScore += TEMPO_BONUS;
    egScore += TEMPO_BONUS;
  }

  // Tapered score: interpolate between mg and eg
  const finalScore = Math.round(mgScore * phase + egScore * (1 - phase));
  return finalScore;
}

/**
 * Linear interpolation helper.
 */
function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

/**
 * Evaluate pawn structure for one color (tapered).
 */
function evaluatePawnStructure(pawnPositions, ownPawnFiles, enemyPawnFiles, enemyPawnPositions, pawnColor, evalColor, phase, board, rookFiles) {
  let bonus = 0;
  const sign = pawnColor === evalColor ? 1 : -1;

  for (let pi = 0; pi < pawnPositions.length; pi++) {
    const pawn = pawnPositions[pi];
    const { file, rank } = pawn;

    // Doubled pawn penalty
    if (ownPawnFiles[file] > 1) {
      bonus -= DOUBLED_PAWN_PENALTY / ownPawnFiles[file];
    }

    // Isolated pawn penalty
    const leftFile = file > 0 ? ownPawnFiles[file - 1] : 0;
    const rightFile = file < 7 ? ownPawnFiles[file + 1] : 0;
    if (leftFile === 0 && rightFile === 0) {
      bonus -= ISOLATED_PAWN_PENALTY;
    }

    // Passed pawn bonus (tapered)
    if (isPassedPawn(file, rank, pawnColor, enemyPawnPositions)) {
      const advancementRank = pawnColor === "white" ? 7 - rank : rank;
      const mgBonus = PASSED_PAWN_BONUS_MG[advancementRank];
      const egBonus = PASSED_PAWN_BONUS_EG[advancementRank];
      bonus += lerp(egBonus, mgBonus, phase);

      // Connected passed pawn bonus: adjacent file also has a passed pawn
      for (let pi2 = 0; pi2 < pawnPositions.length; pi2++) {
        if (pi2 === pi) continue;
        const adj = pawnPositions[pi2];
        if (Math.abs(adj.file - file) === 1 && isPassedPawn(adj.file, adj.rank, pawnColor, enemyPawnPositions)) {
          bonus += CONNECTED_PASSED_BONUS;
          break; // count once
        }
      }

      // Blocked passed pawn penalty
      const aheadRank = pawnColor === "white" ? rank + 1 : rank - 1;
      if (aheadRank >= 0 && aheadRank <= 7) {
        const aheadIndex = aheadRank * 8 + file;
        if (board[aheadIndex]) {
          bonus -= BLOCKED_PASSED_PENALTY;
        }
      }

      // Rook behind passed pawn bonus
      for (const rookFile of rookFiles) {
        if (rookFile === file) {
          bonus += ROOK_BEHIND_PASSED_BONUS;
          break;
        }
      }
    }
  }

  return bonus * sign;
}

/**
 * Check if a pawn is passed.
 */
function isPassedPawn(file, rank, pawnColor, enemyPawns) {
  const startRank = pawnColor === "white" ? rank + 1 : rank - 1;
  const endRank = pawnColor === "white" ? 7 : 0;
  const rankStep = pawnColor === "white" ? 1 : -1;

  for (let r = startRank; pawnColor === "white" ? r <= endRank : r >= endRank; r += rankStep) {
    if (enemyPawns.some(p => p.file === file && p.rank === r)) return false;
    if (file > 0 && enemyPawns.some(p => p.file === file - 1 && p.rank === r)) return false;
    if (file < 7 && enemyPawns.some(p => p.file === file + 1 && p.rank === r)) return false;
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
      bonus += ROOK_OPEN_FILE_BONUS;
    } else if (ownPawnsOnFile === 0) {
      bonus += ROOK_SEMI_OPEN_FILE_BONUS;
    }
  }

  return bonus * sign;
}

/**
 * Map index for PST; mirror ranks for black.
 */
function pstIndex(index, color) {
  if (color === "white") return index;
  const file = index % 8;
  const rank = Math.floor(index / 8);
  const mirroredRank = 7 - rank;
  return mirroredRank * 8 + file;
}

/**
 * Evaluate king safety.
 */
function evaluateKingSafety(kingIndex, ownPawnFiles, enemyPawnFiles, kingColor, evalColor) {
  if (kingIndex < 0) return 0;

  let bonus = 0;
  const sign = kingColor === evalColor ? 1 : -1;

  const kingFile = kingIndex % 8;
  const kingRank = Math.floor(kingIndex / 8);

  const isOnBackRank = (kingColor === "white" && kingRank === 0) ||
                       (kingColor === "black" && kingRank === 7);

  if (isOnBackRank && (kingFile === 6 || kingFile === 2)) {
    bonus += CASTLED_KING_BONUS;
  }

  if (isOnBackRank) {
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

  const nearbyFiles = [];
  if (kingFile > 0) nearbyFiles.push(kingFile - 1);
  nearbyFiles.push(kingFile);
  if (kingFile < 7) nearbyFiles.push(kingFile + 1);

  for (const file of nearbyFiles) {
    if (ownPawnFiles[file] === 0) {
      bonus -= OPEN_FILE_NEAR_KING_PENALTY;
    }
  }

  return bonus * sign;
}

/**
 * Simplified mobility evaluation.
 * Counts pseudo-legal squares for each piece type (not blocked by own pieces).
 */
function evaluateMobility(board, knights, bishops, rooks, queens, pieceColor, evalColor) {
  let bonus = 0;
  const sign = pieceColor === evalColor ? 1 : -1;

  // Knights
  const knightJumps = [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
  for (const idx of knights) {
    const f = idx % 8;
    const r = Math.floor(idx / 8);
    let mobility = 0;
    for (const [df, dr] of knightJumps) {
      const nf = f + df;
      const nr = r + dr;
      if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
      const target = board[nr * 8 + nf];
      if (!target || getColorOf(target) !== pieceColor) mobility++;
    }
    bonus += mobility * MOBILITY_KNIGHT;
  }

  // Bishops
  const diagDirs = [[1,1],[1,-1],[-1,1],[-1,-1]];
  for (const idx of bishops) {
    let mobility = 0;
    for (const [df, dr] of diagDirs) {
      let f = (idx % 8) + df;
      let r = Math.floor(idx / 8) + dr;
      while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
        const target = board[r * 8 + f];
        if (!target) { mobility++; }
        else {
          if (getColorOf(target) !== pieceColor) mobility++;
          break;
        }
        f += df;
        r += dr;
      }
    }
    bonus += mobility * MOBILITY_BISHOP;
  }

  // Rooks
  const orthoDirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (const idx of rooks) {
    let mobility = 0;
    for (const [df, dr] of orthoDirs) {
      let f = (idx % 8) + df;
      let r = Math.floor(idx / 8) + dr;
      while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
        const target = board[r * 8 + f];
        if (!target) { mobility++; }
        else {
          if (getColorOf(target) !== pieceColor) mobility++;
          break;
        }
        f += df;
        r += dr;
      }
    }
    bonus += mobility * MOBILITY_ROOK;
  }

  // Queens
  const allDirs = [...diagDirs, ...orthoDirs];
  for (const idx of queens) {
    let mobility = 0;
    for (const [df, dr] of allDirs) {
      let f = (idx % 8) + df;
      let r = Math.floor(idx / 8) + dr;
      while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
        const target = board[r * 8 + f];
        if (!target) { mobility++; }
        else {
          if (getColorOf(target) !== pieceColor) mobility++;
          break;
        }
        f += df;
        r += dr;
      }
    }
    bonus += mobility * MOBILITY_QUEEN;
  }

  return bonus * sign;
}

/**
 * King proximity to passed pawns in endgame.
 */
function evaluateKingPasserProximity(whitePawns, blackPawns, whitePawnFiles, blackPawnFiles, whiteKingIdx, blackKingIdx, evalColor, phase) {
  let bonus = 0;
  const egWeight = 1 - phase; // stronger as phase → 0

  // White passed pawns: own white king close = good, enemy black king close = bad
  for (const pawn of whitePawns) {
    if (!isPassedPawn(pawn.file, pawn.rank, "white", blackPawns)) continue;
    if (whiteKingIdx >= 0) {
      const kf = whiteKingIdx % 8;
      const kr = Math.floor(whiteKingIdx / 8);
      const dist = Math.max(Math.abs(kf - pawn.file), Math.abs(kr - pawn.rank));
      const proxBonus = Math.max(0, (7 - dist)) * KING_PASSER_PROXIMITY_OWN * egWeight;
      bonus += evalColor === "white" ? proxBonus : -proxBonus;
    }
    if (blackKingIdx >= 0) {
      const kf = blackKingIdx % 8;
      const kr = Math.floor(blackKingIdx / 8);
      const dist = Math.max(Math.abs(kf - pawn.file), Math.abs(kr - pawn.rank));
      const proxPenalty = Math.max(0, (7 - dist)) * KING_PASSER_PROXIMITY_ENEMY * egWeight;
      bonus += evalColor === "white" ? -proxPenalty : proxPenalty;
    }
  }

  // Black passed pawns
  for (const pawn of blackPawns) {
    if (!isPassedPawn(pawn.file, pawn.rank, "black", whitePawns)) continue;
    if (blackKingIdx >= 0) {
      const kf = blackKingIdx % 8;
      const kr = Math.floor(blackKingIdx / 8);
      const dist = Math.max(Math.abs(kf - pawn.file), Math.abs(kr - pawn.rank));
      const proxBonus = Math.max(0, (7 - dist)) * KING_PASSER_PROXIMITY_OWN * egWeight;
      bonus += evalColor === "black" ? proxBonus : -proxBonus;
    }
    if (whiteKingIdx >= 0) {
      const kf = whiteKingIdx % 8;
      const kr = Math.floor(whiteKingIdx / 8);
      const dist = Math.max(Math.abs(kf - pawn.file), Math.abs(kr - pawn.rank));
      const proxPenalty = Math.max(0, (7 - dist)) * KING_PASSER_PROXIMITY_ENEMY * egWeight;
      bonus += evalColor === "black" ? -proxPenalty : proxPenalty;
    }
  }

  return bonus;
}
