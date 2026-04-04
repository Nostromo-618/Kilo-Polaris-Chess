/**
 * BoardView.js
 *
 * Pure UI component responsible for:
 * - Rendering an 8x8 board grid.
 * - Displaying pieces as Unicode glyphs.
 * - Highlighting selected square, legal moves, and last move.
 * - Emitting square selection events to the outside world.
 *
 * This module does NOT implement chess rules; it is presentation-only.
 */

const PIECE_TO_GLYPH = {
  wP: "♙",
  wN: "♘",
  wB: "♗",
  wR: "♖",
  wQ: "♕",
  wK: "♔",
  bP: "♟",
  bN: "♞",
  bB: "♝",
  bR: "♜",
  bQ: "♛",
  bK: "♚",
};

export class BoardView {
  /**
   * @param {HTMLElement} container - container element for the board.
   * @param {Object} callbacks
   * @param {(square: string) => void} callbacks.onSquareSelected
   */
  constructor(container, { onSquareSelected } = {}) {
    if (!container) {
      throw new Error("BoardView: container element is required.");
    }

    this.container = container;
    this.onSquareSelected = onSquareSelected || (() => {});

    /** @type {Map<string, HTMLElement>} */
    this.squareEls = new Map();

    /** @type {Map<string, HTMLElement>} */
    this.fileLabelEls = new Map();

    /** @type {Map<number, HTMLElement>} */
    this.rankLabelEls = new Map();

    this.selectedSquare = null;
    this.legalTargets = new Set();
    this.lastMove = null;
    this.currentPerspective = "white";

    this.handleSquareClick = this.handleSquareClick.bind(this);

    this.initBoard();
  }

  /**
   * Initialize board DOM once. Default orientation a1 bottom-left.
   */
  initBoard() {
    this.container.innerHTML = "";
    this.squareEls.clear();
    this.fileLabelEls.clear();
    this.rankLabelEls.clear();

    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

    // Create board grid wrapper
    const boardGrid = document.createElement("div");
    boardGrid.className = "chess-board-grid";

    // Render rank 8 down to 1; orientation will be applied logically in render()
    for (let rank = 8; rank >= 1; rank -= 1) {
      for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
        const file = files[fileIndex];
        const square = `${file}${rank}`;

        const squareEl = document.createElement("div");
        squareEl.classList.add("chess-square");
        const isLight = (fileIndex + rank) % 2 === 0;
        squareEl.classList.add(isLight ? "light" : "dark");

        squareEl.dataset.square = square;
        squareEl.setAttribute("aria-label", `Square ${square}`);
        squareEl.addEventListener("click", this.handleSquareClick);

        const pieceEl = document.createElement("div");
        pieceEl.classList.add("chess-piece");
        pieceEl.setAttribute("role", "img");
        squareEl.appendChild(pieceEl);

        boardGrid.appendChild(squareEl);
        this.squareEls.set(square, squareEl);
      }
    }

    // Create file labels row (a-h)
    const fileLabelsRow = document.createElement("div");
    fileLabelsRow.className = "chess-file-labels";
    for (let i = 0; i < 8; i++) {
      const label = document.createElement("span");
      label.className = "chess-file-label";
      label.textContent = files[i];
      fileLabelsRow.appendChild(label);
      this.fileLabelEls.set(files[i], label);
    }

    // Create rank labels column (1-8)
    const rankLabelsCol = document.createElement("div");
    rankLabelsCol.className = "chess-rank-labels";
    for (let rank = 8; rank >= 1; rank--) {
      const label = document.createElement("span");
      label.className = "chess-rank-label";
      label.textContent = String(rank);
      rankLabelsCol.appendChild(label);
      this.rankLabelEls.set(rank, label);
    }

    // Assemble: rank labels + board + file labels
    this.container.appendChild(rankLabelsCol);
    this.container.appendChild(boardGrid);
    this.container.appendChild(fileLabelsRow);
  }

  /**
   * Render full board state.
   *
   * @param {Object.<string,string|null>} boardState - map from "a1".."h8" to piece codes ("wP", "bQ", etc.) or null.
   * @param {Object} options
   * @param {"white"|"black"} options.perspective - whose perspective to show.
   * @param {string|null} options.selected - currently selected square.
   * @param {string[]|Set<string>} options.legalMoves - legal target squares.
   * @param {{from: string, to: string}|null} options.lastMove - last move info.
   * @param {string|null} [options.checkedKingSquare] - king square when side to move is in check.
   */
  render(boardState, { perspective, selected, legalMoves, lastMove, checkedKingSquare }) {
    this.selectedSquare = selected || null;
    this.legalTargets =
      legalMoves instanceof Set
        ? new Set(legalMoves)
        : new Set(legalMoves || []);
    this.lastMove = lastMove || null;
    this.checkedKingSquare = checkedKingSquare || null;
    this.currentPerspective = perspective || this.currentPerspective;

    const ranks = perspective === "white" ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
    const files =
      perspective === "white"
        ? ["a","b","c","d","e","f","g","h"]
        : ["h","g","f","e","d","c","b","a"];

    // Update coordinate labels
    const fileLabelContainer = this.container.querySelector('.chess-file-labels');
    if (fileLabelContainer) {
      const labels = fileLabelContainer.querySelectorAll('.chess-file-label');
      for (let i = 0; i < files.length && i < labels.length; i++) {
        labels[i].textContent = files[i];
      }
    }
    const rankLabelContainer = this.container.querySelector('.chess-rank-labels');
    if (rankLabelContainer) {
      const labels = rankLabelContainer.querySelectorAll('.chess-rank-label');
      for (let i = 0; i < ranks.length && i < labels.length; i++) {
        labels[i].textContent = String(ranks[i]);
      }
    }

    // Update piece content and highlighting
    this.squareEls.forEach((squareEl, square) => {
      const code = boardState[square] || null;
      const pieceDescriptions = { wP: "White pawn", wN: "White knight", wB: "White bishop", wR: "White rook", wQ: "White queen", wK: "White king", bP: "Black pawn", bN: "Black knight", bB: "Black bishop", bR: "Black rook", bQ: "Black queen", bK: "Black king" };

      // Find or create piece element
      let pieceEl = squareEl.querySelector(".chess-piece");
      if (!pieceEl) {
        pieceEl = document.createElement("div");
        pieceEl.classList.add("chess-piece");
        pieceEl.setAttribute("role", "img");
        squareEl.appendChild(pieceEl);
      }

      if (code) {
        pieceEl.textContent = PIECE_TO_GLYPH[code] || "?";
        pieceEl.setAttribute("aria-label", pieceDescriptions[code]);
        pieceEl.classList.add("has-piece");
      } else {
        pieceEl.textContent = "";
        pieceEl.setAttribute("aria-label", "Empty square");
        pieceEl.classList.remove("has-piece");
      }

      squareEl.classList.remove(
        "highlight-selected",
        "highlight-legal",
        "highlight-last-move",
        "highlight-in-check"
      );

      if (this.checkedKingSquare && square === this.checkedKingSquare) {
        squareEl.classList.add("highlight-in-check");
      }

      if (this.selectedSquare === square) {
        squareEl.classList.add("highlight-selected");
      }

      if (this.legalTargets.has(square)) {
        squareEl.classList.add("highlight-legal");
      }

      if (
        lastMove &&
        (lastMove.from === square || lastMove.to === square)
      ) {
        squareEl.classList.add("highlight-last-move");
      }
    });

    // Visual orientation: ensure CSS grid order follows desired ranks/files ordering.
    // Because we constructed DOM in a fixed order, we can dynamically set CSS order.
    let order = 0;
    for (const rank of ranks) {
      for (const file of files) {
        const coord = `${file}${rank}`;
        const squareEl = this.squareEls.get(coord);
        if (squareEl) {
          squareEl.style.order = String(order);
          order += 1;
        }
      }
    }
  }

  /**
   * Update only highlighting (selection / legal / last move).
   * @param {Object} options
   * @param {string|null} options.selected
   * @param {string[]|Set<string>} options.legalMoves
   * @param {{from: string, to: string}|null} options.lastMove
   * @param {string|null} [options.checkedKingSquare]
   */
  updateHighlights({ selected, legalMoves, lastMove, checkedKingSquare }) {
    this.selectedSquare = selected || null;
    this.legalTargets =
      legalMoves instanceof Set
        ? new Set(legalMoves)
        : new Set(legalMoves || []);
    this.lastMove = lastMove || null;
    this.checkedKingSquare = checkedKingSquare ?? null;

    this.squareEls.forEach((squareEl, square) => {
      squareEl.classList.remove(
        "highlight-selected",
        "highlight-legal",
        "highlight-last-move",
        "highlight-in-check"
      );

      if (this.checkedKingSquare && square === this.checkedKingSquare) {
        squareEl.classList.add("highlight-in-check");
      }

      if (this.selectedSquare === square) {
        squareEl.classList.add("highlight-selected");
      }

      if (this.legalTargets.has(square)) {
        squareEl.classList.add("highlight-legal");
      }

      if (
        this.lastMove &&
        (this.lastMove.from === square || this.lastMove.to === square)
      ) {
        squareEl.classList.add("highlight-last-move");
      }
    });
  }

  /**
   * Handle a user clicking a square.
   * Translates DOM event into algebraic square and forwards to callback.
   */
  handleSquareClick(event) {
    const squareEl = event.currentTarget;
    const square = squareEl.dataset.square;
    if (!square) return;
    this.onSquareSelected(square);
  }
}

