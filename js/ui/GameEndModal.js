/**
 * GameEndModal.js
 *
 * Displays a modal when the game ends showing:
 * - Winner (if checkmate)
 * - Draw status and reason
 * - Option to start a new game
 */

export class GameEndModal {
  /**
   * @param {HTMLElement} container - Container element for the modal
   * @param {() => void} onNewGame - Callback when "New Game" is clicked
   */
  constructor(container, onNewGame) {
    this.container = container;
    this.onNewGame = onNewGame || (() => {});
    this.modal = null;
    this.init();
  }

  init() {
    // Create modal structure using Vanduo v1.1+ modal component classes (vd- prefix)
    this.modal = document.createElement('div');
    this.modal.className = 'vd-modal game-end-modal';
    this.modal.id = 'game-end-modal';
    this.modal.setAttribute('role', 'dialog');
    this.modal.setAttribute('aria-labelledby', 'game-end-title');
    this.modal.setAttribute('aria-modal', 'true');
    this.modal.innerHTML = `
      <div class="vd-modal-backdrop game-end-modal-backdrop"></div>
      <div class="vd-modal-dialog">
        <div class="vd-modal-content game-end-modal-content">
          <div class="vd-modal-header">
            <h3 id="game-end-title" class="vd-modal-title game-end-title"></h3>
            <button type="button" class="vd-modal-close" data-dismiss="modal" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div class="vd-modal-body">
            <div class="game-end-icon" id="game-end-icon"></div>
            <p class="game-end-message" id="game-end-message"></p>
          </div>
          <div class="vd-modal-footer game-end-actions">
            <button class="vd-btn vd-btn-primary" id="game-end-new-game-btn">
              <i class="ph ph-play vd-mr-2"></i> New Game
            </button>
            <button class="vd-btn vd-btn-secondary" id="game-end-close-btn" data-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(this.modal);

    // Bind event handlers
    const newGameBtn = this.modal.querySelector('#game-end-new-game-btn');
    const closeBtn = this.modal.querySelector('#game-end-close-btn');
    const modalCloseBtn = this.modal.querySelector('.vd-modal-close');
    const backdrop = this.modal.querySelector('.vd-modal-backdrop');

    newGameBtn.addEventListener('click', () => {
      this.hide();
      this.onNewGame();
    });

    const handleClose = () => {
      this.hide();
    };

    closeBtn.addEventListener('click', handleClose);
    modalCloseBtn.addEventListener('click', handleClose);
    backdrop.addEventListener('click', handleClose);

    // Close on Escape key
    this.handleEscape = (e) => {
      if (e.key === 'Escape' && this.isVisible()) {
        this.hide();
      }
    };
    document.addEventListener('keydown', this.handleEscape);

    // Initially hidden
    this.hide();
  }

  /**
   * Show the modal with game result
   * @param {Object} result - Game result information
   * @param {string} result.outcome - "checkmate" | "stalemate" | "draw"
   * @param {"white"|"black"|null} result.winner - Winner color or null
   * @param {string} result.reason - Reason for draw/end
   * @param {"white"|"black"} playerColor - Player's color
   */
  show(result, playerColor) {
    if (!this.modal) return;

    const iconEl = this.modal.querySelector('#game-end-icon');
    const titleEl = this.modal.querySelector('#game-end-title');
    const messageEl = this.modal.querySelector('#game-end-message');

    let icon = '';
    let title = '';
    let message = '';

    if (result.outcome === 'checkmate') {
      const isPlayerWinner = result.winner === playerColor;
      icon = isPlayerWinner ? '🎉' : '😔';
      title = isPlayerWinner ? 'You Win!' : 'Computer Wins';
      message = `Checkmate! ${result.winner === 'white' ? 'White' : 'Black'} wins.`;
    } else if (result.outcome === 'stalemate') {
      icon = '🤝';
      title = 'Draw';
      message = 'The game ended in a draw by stalemate.';
    } else if (result.outcome === 'draw') {
      icon = '🤝';
      title = 'Draw';
      message = `The game ended in a draw: ${result.reason || 'by agreement'}.`;
    } else {
      // Fallback
      icon = '🏁';
      title = 'Game Over';
      message = result.reason || 'The game has ended.';
    }

    iconEl.textContent = icon;
    titleEl.textContent = title;
    messageEl.textContent = message;

    // Add appropriate class for styling
    this.modal.className = 'vd-modal game-end-modal';
    if (result.outcome === 'checkmate' && result.winner === playerColor) {
      this.modal.classList.add('game-end-modal-victory');
    } else if (result.outcome === 'checkmate') {
      this.modal.classList.add('game-end-modal-defeat');
    } else {
      this.modal.classList.add('game-end-modal-draw');
    }

    this.modal.classList.add('game-end-modal-visible');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  }

  /**
   * Hide the modal
   */
  hide() {
    if (!this.modal) return;
    this.modal.classList.remove('game-end-modal-visible');
    document.body.style.overflow = ''; // Restore scrolling
  }

  /**
   * Check if modal is currently visible
   */
  isVisible() {
    return this.modal && this.modal.classList.contains('game-end-modal-visible');
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.handleEscape) {
      document.removeEventListener('keydown', this.handleEscape);
    }
    if (this.modal && this.modal.parentNode) {
      this.modal.parentNode.removeChild(this.modal);
    }
    document.body.style.overflow = '';
  }
}
