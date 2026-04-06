/**
 * storage.js
 *
 * Centralised localStorage manager for Kilo Aurora Chess.
 * All keys are namespaced under "kpc-" to avoid collisions.
 *
 * Keys:
 *   kpc-disclaimer-accepted  "true" when user has accepted the disclaimer
 *   kpc-theme                "system" | "light" | "dark"
 *   kpc-difficulty           "1" … "5"
 *   kpc-game                 JSON string of GameState.serialize()
 *   kpc-board-size           "0" … "100" desktop board width slider
 */

const KEYS = {
  DISCLAIMER: 'kpc-disclaimer-accepted',
  THEME: 'kpc-theme',
  DIFFICULTY: 'kpc-difficulty',
  THINKING_TIME: 'kpc-thinking-time',
  GAME: 'kpc-game',
  BOARD_SIZE: 'kpc-board-size',
};

/**
 * Safe localStorage read — returns null if unavailable or throws.
 * @param {string} key
 * @returns {string|null}
 */
function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Safe localStorage write.
 * @param {string} key
 * @param {string} value
 */
function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage might be full or unavailable (private browsing restrictions etc.)
  }
}

/**
 * Safe localStorage remove.
 * @param {string} key
 */
function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ── Disclaimer ──────────────────────────────────────────────────────────────

/** @returns {boolean} */
export function getDisclaimerAccepted() {
  return read(KEYS.DISCLAIMER) === 'true';
}

export function setDisclaimerAccepted() {
  write(KEYS.DISCLAIMER, 'true');
}

// ── Theme ────────────────────────────────────────────────────────────────────

/**
 * @returns {"system"|"light"|"dark"}
 */
export function getTheme() {
  const val = read(KEYS.THEME);
  if (val === 'light' || val === 'dark') return val;
  return 'system';
}

/**
 * @param {"system"|"light"|"dark"} theme
 */
export function setTheme(theme) {
  const safe = (theme === 'light' || theme === 'dark') ? theme : 'system';
  write(KEYS.THEME, safe);
  // Keep Vanduo's own key in sync so its theme customizer reads correctly
  write('vanduo-theme-preference', safe);
}

// ── Difficulty ───────────────────────────────────────────────────────────────

/**
 * @returns {number|null} 1-5, or null if not set
 */
export function getDifficulty() {
  const raw = read(KEYS.DIFFICULTY);
  if (raw === null) return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 1 || n > 5) return null;
  return n;
}

/**
 * @param {number} level 1-5
 */
export function setDifficulty(level) {
  const clamped = Math.max(1, Math.min(5, Number(level) || 5));
  write(KEYS.DIFFICULTY, String(clamped));
}

// ── Game progress ─────────────────────────────────────────────────────────────

/**
 * @returns {Object|null} Parsed serialized GameState, or null if unavailable/corrupt
 */
export function getGame() {
  const raw = read(KEYS.GAME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Basic sanity check — must have a board and activeColor
    if (!parsed || !parsed.board || !parsed.activeColor) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {Object} serialized - return value of GameState.serialize()
 */
export function setGame(serialized) {
  if (!serialized) return;
  try {
    write(KEYS.GAME, JSON.stringify(serialized));
  } catch {
    // If serialization fails (unlikely), skip silently
  }
}

/** Remove any saved in-progress game. */
export function clearGame() {
  remove(KEYS.GAME);
}

// ── Maximum thinking time ─────────────────────────────────────────────────────

/**
 * @returns {number|null} seconds (1-60), or null if not set
 */
export function getThinkingTime() {
  const raw = read(KEYS.THINKING_TIME);
  if (raw === null) return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 1 || n > 60) return null;
  return n;
}

/**
 * @param {number} seconds 1-60
 */
export function setThinkingTime(seconds) {
  const clamped = Math.max(1, Math.min(60, Number(seconds) || 30));
  write(KEYS.THINKING_TIME, String(clamped));
}

// ── Desktop board size (range 0–100) ─────────────────────────────────────────

/**
 * @returns {number|null} 0–100, or null if not set
 */
export function getBoardSize() {
  const raw = read(KEYS.BOARD_SIZE);
  if (raw === null) return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0 || n > 100) return null;
  return Math.round(n);
}

/**
 * @param {number} value 0–100
 */
export function setBoardSize(value) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  write(KEYS.BOARD_SIZE, String(clamped));
}
