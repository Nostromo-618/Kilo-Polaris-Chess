/**
 * Controls.js
 *
 * Handles:
 * - Color selection (white / black / random)
 * - Difficulty selection (1-5)
 * - Thinking time (5s / 10s / 15s / 30s / 60s)
 * - New game button
 * - Undo button
 *
 * Provides getters for current settings and notifies when a new game or undo is requested.
 */

export class Controls {
/**
    * @param {Object} options
    * @param {HTMLElement} options.colorChoiceContainer
    * @param {HTMLElement} options.difficultyChoiceContainer
    * @param {HTMLElement} options.thinkingChoiceContainer
    * @param {HTMLButtonElement} options.newGameButton
    * @param {HTMLButtonElement} [options.undoButton]
    * @param {HTMLSelectElement} [options.difficultySelect]
    * @param {HTMLInputElement} [options.thinkingTimeInput]
    * @param {() => void} options.onNewGameRequested
    * @param {() => void} [options.onUndoRequested]
    */
  constructor({
    colorChoiceContainer,
    difficultyChoiceContainer,
    thinkingChoiceContainer,
    newGameButton,
    undoButton,
    difficultySelect,
    thinkingTimeInput,
    onNewGameRequested,
    onUndoRequested,
  }) {
    this.colorChoiceContainer = colorChoiceContainer;
    this.difficultyChoiceContainer = difficultyChoiceContainer;
    this.thinkingChoiceContainer = thinkingChoiceContainer;
    this.newGameButton = newGameButton;
    this.undoButton = undoButton || null;
    this.difficultySelect = difficultySelect || null;
    this.thinkingTimeInput = thinkingTimeInput || null;
    this.onNewGameRequested = onNewGameRequested || (() => { });
    this.onUndoRequested = onUndoRequested || (() => { });

    this.selectedColor = "white";
    this.selectedDifficulty = 3;
    this.selectedThinkingTime = 10;

    this.handleColorClick = this.handleColorClick.bind(this);
    this.handleDifficultyClick = this.handleDifficultyClick.bind(this);
    this.handleThinkingClick = this.handleThinkingClick.bind(this);
    this.handleNewGameClick = this.handleNewGameClick.bind(this);
    this.handleUndoClick = this.handleUndoClick.bind(this);

    this.init();
  }

  init() {
    if (this.colorChoiceContainer) {
      this.colorChoiceContainer.addEventListener("click", this.handleColorClick);
      const buttons = this.colorChoiceContainer.querySelectorAll("button");
      buttons.forEach(btn => {
        btn.setAttribute("aria-pressed", btn.classList.contains("vd-is-active") ? "true" : "false");
        btn.setAttribute("aria-selected", btn.classList.contains("vd-is-active") ? "true" : "false");
      });
    }

    if (this.difficultyChoiceContainer) {
      this.difficultyChoiceContainer.addEventListener("click", this.handleDifficultyClick);
    }

    if (this.thinkingChoiceContainer) {
      this.thinkingChoiceContainer.addEventListener("click", this.handleThinkingClick);
    }

    if (this.newGameButton) {
      this.newGameButton.addEventListener("click", this.handleNewGameClick);
      this.newGameButton.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          this.handleNewGameClick();
        }
      });
    }

    if (this.undoButton) {
      this.undoButton.addEventListener("click", this.handleUndoClick);
      this.undoButton.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          this.handleUndoClick();
        }
      });
    }

    if (this.difficultySelect) {
      this.difficultySelect.addEventListener("change", () => {
        this.selectedDifficulty = Number(this.difficultySelect.value) || 3;
        this.syncDifficultyButtons();
      });
    }

    if (this.thinkingTimeInput) {
      this.thinkingTimeInput.setAttribute("aria-describedby", "thinking-desc");
      this.thinkingTimeInput.addEventListener("change", () => {
        this.selectedThinkingTime = Number(this.thinkingTimeInput.value) || 10;
        this.syncThinkingButtons();
      });
    }
  }

  syncDifficultyButtons() {
    if (this.difficultyChoiceContainer) {
      const buttons = this.difficultyChoiceContainer.querySelectorAll("button");
      buttons.forEach((btn) => {
        const level = Number(btn.getAttribute("data-level"));
        if (level === this.selectedDifficulty) {
          btn.classList.add("vd-is-active");
          btn.setAttribute("aria-selected", "true");
        } else {
          btn.classList.remove("vd-is-active");
          btn.setAttribute("aria-selected", "false");
        }
      });
    }
    if (this.difficultySelect) {
      this.difficultySelect.value = String(this.selectedDifficulty);
    }
  }

  syncThinkingButtons() {
    if (this.thinkingChoiceContainer) {
      const buttons = this.thinkingChoiceContainer.querySelectorAll("button");
      buttons.forEach((btn) => {
        const time = Number(btn.getAttribute("data-time"));
        if (time === this.selectedThinkingTime) {
          btn.classList.add("vd-is-active");
        } else {
          btn.classList.remove("vd-is-active");
        }
      });
    }
    if (this.thinkingTimeInput) {
      this.thinkingTimeInput.value = String(this.selectedThinkingTime);
    }
  }

  handleColorClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    const color = target.getAttribute("data-color");
    if (!color || !["white", "black", "random"].includes(color)) return;

    this.selectedColor = color;

    const buttons = this.colorChoiceContainer.querySelectorAll("button");
    buttons.forEach((btn) => {
      btn.classList.remove("vd-is-active");
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-selected", "false");
    });
    target.classList.add("vd-is-active");
    target.setAttribute("aria-pressed", "true");
    target.setAttribute("aria-selected", "true");
  }

  handleDifficultyClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    const level = Number(target.getAttribute("data-level"));
    if (Number.isNaN(level) || level < 1 || level > 5) return;

    this.selectedDifficulty = level;

    const buttons = this.difficultyChoiceContainer.querySelectorAll("button");
    buttons.forEach((btn) => btn.classList.remove("vd-is-active"));
    target.classList.add("vd-is-active");
  }

  handleThinkingClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    const time = Number(target.getAttribute("data-time"));
    if (Number.isNaN(time) || time < 1) return;

    this.selectedThinkingTime = time;

    const buttons = this.thinkingChoiceContainer.querySelectorAll("button");
    buttons.forEach((btn) => btn.classList.remove("vd-is-active"));
    target.classList.add("vd-is-active");
  }

  handleNewGameClick() {
    this.onNewGameRequested();
  }

  handleUndoClick() {
    this.onUndoRequested();
  }

  getSelectedColor() {
    return this.selectedColor || "random";
  }

  getDifficulty() {
    const val = this.selectedDifficulty;
    if (Number.isNaN(val) || val < 1 || val > 5) return 3;
    return val;
  }

  setDifficulty(level) {
    const clamped = Math.max(1, Math.min(5, Number(level) || 3));
    this.selectedDifficulty = clamped;
    if (this.difficultyChoiceContainer) {
      const buttons = this.difficultyChoiceContainer.querySelectorAll("button");
      buttons.forEach((btn) => {
        if (Number(btn.getAttribute("data-level")) === clamped) {
          btn.classList.add("vd-is-active");
        } else {
          btn.classList.remove("vd-is-active");
        }
      });
    }
  }

  setSelectedColor(color) {
    if (!this.colorChoiceContainer) return;
    if (!['white', 'black', 'random'].includes(color)) return;
    this.selectedColor = color;
    const buttons = this.colorChoiceContainer.querySelectorAll('button');
    buttons.forEach((btn) => {
      if (btn.getAttribute('data-color') === color) {
        btn.classList.add('vd-is-active');
      } else {
        btn.classList.remove('vd-is-active');
      }
    });
  }

  /**
   * Get configured thinking time in milliseconds.
   * @returns {number}
   */
  getThinkingTime() {
    return Math.max(1000, Math.min(60000, this.selectedThinkingTime * 1000));
  }

  /**
   * Set thinking time selection.
   * @param {number} seconds
   */
  setThinkingTime(seconds) {
    const clamped = Math.max(1, Math.min(60, seconds));
    this.selectedThinkingTime = clamped;
    if (this.thinkingChoiceContainer) {
      const buttons = this.thinkingChoiceContainer.querySelectorAll("button");
      let matched = false;
      buttons.forEach((btn) => {
        if (Number(btn.getAttribute("data-time")) === clamped) {
          btn.classList.add("vd-is-active");
          matched = true;
        } else {
          btn.classList.remove("vd-is-active");
        }
      });
      if (!matched) {
        this.selectedThinkingTime = 10;
        buttons.forEach((btn) => {
          btn.classList.toggle("vd-is-active", Number(btn.getAttribute("data-time")) === 10);
        });
      }
    }
  }

  /**
   * Set undo button enabled/disabled state.
   * @param {boolean} enabled
   */
  setUndoEnabled(enabled) {
    if (this.undoButton) {
      this.undoButton.disabled = !enabled;
    }
  }
}
