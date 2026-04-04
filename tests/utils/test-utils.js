// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Test Utilities and Helpers
 * Common utilities for chess engine testing
 */

/**
 * Create a test chess board with pieces
 * @param {Object} config - Board configuration
 * @param {string[]} config.pieces - Array of piece positions (e.g., ['e2:WP', 'e7:BP'])
 * @param {string} config.activeColor - Active color ('white' or 'black')
 * @param {Object} config.castlingRights - Castling rights
 * @param {string|null} config.enPassantTarget - En passant target square
 * @returns {Object} Test board state
 */
export function createTestBoard({ pieces = [], activeColor = 'white', castlingRights = {}, enPassantTarget = null } = {}) {
  const board = new Array(64).fill(null);
  
  pieces.forEach(pieceDef => {
    const [square, piece] = pieceDef.split(':');
    if (square && piece) {
      const index = algebraicToIndex(square);
      board[index] = piece;
    }
  });
  
  return {
    board,
    activeColor,
    castlingRights: {
      white: { kingSide: castlingRights.whiteKingSide !== false, queenSide: castlingRights.whiteQueenSide !== false },
      black: { kingSide: castlingRights.blackKingSide !== false, queenSide: castlingRights.blackQueenSide !== false }
    },
    enPassantTarget,
    halfmoveClock: 0,
    fullmoveNumber: 1
  };
}

/**
 * Convert algebraic notation to board index
 * @param {string} square - Algebraic notation (e.g., 'e4')
 * @returns {number} Board index (0-63)
 */
export function algebraicToIndex(square) {
  if (square.length !== 2) return -1;
  const file = square.charCodeAt(0) - 97;
  const rank = square.charCodeAt(1) - 49;
  return rank * 8 + file;
}

/**
 * Convert board index to algebraic notation
 * @param {number} index - Board index (0-63)
 * @returns {string} Algebraic notation (e.g., 'e4')
 */
export function indexToAlgebraic(index) {
  const file = String.fromCharCode(97 + (index % 8));
  const rank = String.fromCharCode(49 + Math.floor(index / 8));
  return file + rank;
}

/**
 * Create a move object
 * @param {string} from - From square
 * @param {string} to - To square
 * @param {Object} options - Move options
 * @param {string} [options.promotion] - Promotion piece (Q, R, B, N)
 * @param {string} [options.captured] - Captured piece
 * @param {boolean} [options.isEnPassant] - En passant flag
 * @param {boolean} [options.isCastleKingSide] - Kingside castle flag
 * @param {boolean} [options.isCastleQueenSide] - Queenside castle flag
 * @returns {Object} Move object
 */
export function createMove(from, to, options = {}) {
  return {
    from,
    to,
    piece: options.piece || '',
    captured: options.captured || null,
    promotion: options.promotion || null,
    isEnPassant: options.isEnPassant || false,
    isCastleKingSide: options.isCastleKingSide || false,
    isCastleQueenSide: options.isCastleQueenSide || false
  };
}

/**
 * Apply a move to a test board state
 * @param {Object} state - Board state
 * @param {Object} move - Move object
 * @returns {Object} New board state
 */
export function applyMove(state, move) {
  const newState = JSON.parse(JSON.stringify(state));
  const fromIndex = algebraicToIndex(move.from);
  const toIndex = algebraicToIndex(move.to);
  
  // Update board
  newState.board[toIndex] = newState.board[fromIndex];
  newState.board[fromIndex] = null;
  
  // Handle capture
  if (move.captured) {
    // Capture logic would go here
  }
  
  // Handle promotion
  if (move.promotion) {
    const color = move.piece[0];
    newState.board[toIndex] = color + move.promotion;
  }
  
  // Handle castling
  if (move.isCastleKingSide || move.isCastleQueenSide) {
    const color = move.piece[0];
    const rank = color === 'w' ? 0 : 7;
    if (move.isCastleKingSide) {
      newState.board[rank * 8 + 5] = color + 'R';
      newState.board[rank * 8 + 7] = null;
    } else {
      newState.board[rank * 8 + 3] = color + 'R';
      newState.board[rank * 8 + 0] = null;
    }
  }
  
  // Update active color
  newState.activeColor = newState.activeColor === 'white' ? 'black' : 'white';
  
  return newState;
}

/**
 * Generate test moves for a given position
 * @param {Object} state - Board state
 * @returns {Object[]} Array of move objects
 */
export function generateTestMoves(state) {
  // This would be replaced with actual move generation logic
  // For now, return an empty array
  return [];
}

/**
 * Create a performance test wrapper
 * @param {string} description - Test description
 * @param {Function} fn - Test function
 * @param {number} [iterations=1000] - Number of iterations
 */
export function performanceTest(description, fn, iterations = 1000) {
  test(description, async ({}) => {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      await fn();
    }
    const end = performance.now();
    const avgTime = (end - start) / iterations;
    console.log(`${description}: ${avgTime.toFixed(3)}ms average`);
    expect(avgTime).toBeLessThan(10); // Expect less than 10ms per iteration
  });
}

/**
 * Create a stress test wrapper
 * @param {string} description - Test description
 * @param {Function} fn - Test function
 * @param {number} [iterations=10000] - Number of iterations
 */
export function stressTest(description, fn, iterations = 10000) {
  test(description, async ({}) => {
    for (let i = 0; i < iterations; i++) {
      await fn();
    }
    expect(true).toBe(true); // Always pass, just testing for crashes
  });
}

/**
 * Create a property-based test wrapper
 * @param {string} description - Test description
 * @param {Function} propertyFn - Property function that returns boolean
 * @param {number} [iterations=100] - Number of iterations
 */
export function propertyTest(description, propertyFn, iterations = 100) {
  test(description, ({}) => {
    for (let i = 0; i < iterations; i++) {
      const result = propertyFn();
      expect(result).toBe(true);
    }
  });
}

export default {
  createTestBoard,
  algebraicToIndex,
  indexToAlgebraic,
  createMove,
  applyMove,
  generateTestMoves,
  performanceTest,
  stressTest,
  propertyTest
};