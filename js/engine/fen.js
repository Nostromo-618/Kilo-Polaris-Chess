/**
 * Build a FEN string from minimal game state (same fields as AI / worker payload).
 * Board: 64 cells, a1 = 0 … h8 = 63; piece codes from Board.js (e.g. wP, bK).
 */

const PIECE_TO_FEN = {
  wP: "P",
  wN: "N",
  wB: "B",
  wR: "R",
  wQ: "Q",
  wK: "K",
  bP: "p",
  bN: "n",
  bB: "b",
  bR: "r",
  bQ: "q",
  bK: "k",
};

/**
 * @param {Object} state
 * @param {Array<string|null>} state.board
 * @param {"white"|"black"} state.activeColor
 * @param {{white:{kingSide:boolean,queenSide:boolean},black:{kingSide:boolean,queenSide:boolean}}} state.castlingRights
 * @param {string|null} state.enPassantTarget
 * @param {number} state.halfmoveClock
 * @param {number} state.fullmoveNumber
 * @returns {string}
 */
export function gameStateToFen(state) {
  const board = Array.isArray(state.board) ? state.board : Object.values(state.board);
  const parts = [];

  for (let rank = 7; rank >= 0; rank--) {
    let empty = 0;
    let row = "";
    for (let file = 0; file < 8; file++) {
      const idx = rank * 8 + file;
      const p = board[idx];
      if (!p) {
        empty++;
      } else {
        if (empty) {
          row += String(empty);
          empty = 0;
        }
        row += PIECE_TO_FEN[p] || "?";
      }
    }
    if (empty) row += String(empty);
    parts.push(row);
  }

  const fenBoard = parts.join("/");
  const side = state.activeColor === "white" ? "w" : "b";

  const cr = state.castlingRights;
  let castling = "";
  if (cr.white.kingSide) castling += "K";
  if (cr.white.queenSide) castling += "Q";
  if (cr.black.kingSide) castling += "k";
  if (cr.black.queenSide) castling += "q";
  if (!castling) castling = "-";

  const ep = state.enPassantTarget || "-";

  const half = Number(state.halfmoveClock) || 0;
  const full = Number(state.fullmoveNumber) || 1;

  return `${fenBoard} ${side} ${castling} ${ep} ${half} ${full}`;
}
