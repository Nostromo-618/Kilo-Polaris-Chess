// @ts-check
/**
 * Test Utilities and Helpers
 *
 * Standalone helpers for building board states and move objects in tests.
 * These mirror the engine's data shapes but run outside the browser context,
 * useful for constructing inputs to page.evaluate() calls.
 */

/**
 * Convert algebraic notation to board index.
 * @param {string} square - e.g. 'e4'
 * @returns {number} 0-63
 */
export function algebraicToIndex(square) {
  if (square.length !== 2) return -1;
  const file = square.charCodeAt(0) - 97;
  const rank = square.charCodeAt(1) - 49;
  return rank * 8 + file;
}

/**
 * Convert board index to algebraic notation.
 * @param {number} index - 0-63
 * @returns {string} e.g. 'e4'
 */
export function indexToAlgebraic(index) {
  const file = String.fromCharCode(97 + (index % 8));
  const rank = String.fromCharCode(49 + Math.floor(index / 8));
  return file + rank;
}

/**
 * Build a 64-cell board array from a sparse piece list.
 * @param {Object} [config]
 * @param {string[]} [config.pieces] - e.g. ['e1:wK', 'e8:bK']
 * @param {string} [config.activeColor]
 * @param {string|null} [config.enPassantTarget]
 * @returns {{ board: (string|null)[], activeColor: string, castlingRights: Object, enPassantTarget: string|null, halfmoveClock: number, fullmoveNumber: number }}
 */
export function createTestBoard({ pieces = [], activeColor = 'white', enPassantTarget = null } = {}) {
  const board = new Array(64).fill(null);
  for (const def of pieces) {
    const [square, piece] = def.split(':');
    if (square && piece) board[algebraicToIndex(square)] = piece;
  }
  return {
    board,
    activeColor,
    castlingRights: {
      white: { kingSide: false, queenSide: false },
      black: { kingSide: false, queenSide: false },
    },
    enPassantTarget,
    halfmoveClock: 0,
    fullmoveNumber: 1,
  };
}
