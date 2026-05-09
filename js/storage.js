/**
 * storage.js
 *
 * Centralised localStorage manager for Aurora Polaris Chess.
 * All keys are namespaced under "kpc-" to avoid collisions.
 *
 * Keys:
 *   kpc-disclaimer-accepted  "true" when user has accepted the disclaimer
 *   kpc-theme                "system" | "light" | "dark"
 *   kpc-difficulty           "1" … "6"
 *   kpc-game                 JSON string of GameState.serialize()
 *   kpc-board-size           "0" … "100" desktop board width slider
 *   kpc-color                "white" | "black" | "random"
 *   kpc-engine               "builtin" | "tomitank"
 *   kpc-play-mode            "human" | "match"
 *   kpc-match-white-engine   "builtin" | "tomitank"
 *   kpc-match-black-engine   "builtin" | "tomitank"
 *   kpc-match-white-strength "1" … "6"
 *   kpc-match-black-strength "1" … "6"
 *   kpc-match-movetime       per-move milliseconds
 *   kpc-match-perspective    "white" | "black"
 */

const KEYS = {
  DISCLAIMER: 'kpc-disclaimer-accepted',
  THEME: 'kpc-theme',
  DIFFICULTY: 'kpc-difficulty',
  GAME: 'kpc-game',
  BOARD_SIZE: 'kpc-board-size',
  COLOR: 'kpc-color',
  ENGINE: 'kpc-engine',
  PLAY_MODE: 'kpc-play-mode',
  MATCH_WHITE_ENGINE: 'kpc-match-white-engine',
  MATCH_BLACK_ENGINE: 'kpc-match-black-engine',
  MATCH_WHITE_STRENGTH: 'kpc-match-white-strength',
  MATCH_BLACK_STRENGTH: 'kpc-match-black-strength',
  MATCH_MOVETIME: 'kpc-match-movetime',
  MATCH_PERSPECTIVE: 'kpc-match-perspective',
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

// ── Play color (white / black / random) ─────────────────────────────────────

/**
 * @returns {"white"|"black"|"random"|null}
 */
export function getColorChoice() {
  const v = read(KEYS.COLOR);
  if (v === 'white' || v === 'black' || v === 'random') return v;
  return null;
}

/**
 * @param {"white"|"black"|"random"} color
 */
export function setColorChoice(color) {
  if (color === 'white' || color === 'black' || color === 'random') {
    write(KEYS.COLOR, color);
  }
}

// ── Engine (built-in vs TomitankChess) ───────────────────────────────────────

/**
 * @returns {"builtin"|"tomitank"|null}
 */
export function getEngine() {
  const v = read(KEYS.ENGINE);
  if (v === 'builtin' || v === 'tomitank') return v;
  return null;
}

/**
 * @param {"builtin"|"tomitank"} engine
 */
export function setEngine(engine) {
  if (engine === 'builtin' || engine === 'tomitank') {
    write(KEYS.ENGINE, engine);
  }
}

// ── Play mode / engine match settings ──────────────────────────────────────

/** @returns {"human"|"match"} */
export function getPlayMode() {
  return read(KEYS.PLAY_MODE) === 'match' ? 'match' : 'human';
}

/** @param {"human"|"match"} mode */
export function setPlayMode(mode) {
  write(KEYS.PLAY_MODE, mode === 'match' ? 'match' : 'human');
}

/** @returns {"builtin"|"tomitank"} */
export function getMatchWhiteEngine() {
  return read(KEYS.MATCH_WHITE_ENGINE) === 'tomitank' ? 'tomitank' : 'builtin';
}

/** @param {"builtin"|"tomitank"} engine */
export function setMatchWhiteEngine(engine) {
  write(KEYS.MATCH_WHITE_ENGINE, engine === 'tomitank' ? 'tomitank' : 'builtin');
}

/** @returns {"builtin"|"tomitank"} */
export function getMatchBlackEngine() {
  return read(KEYS.MATCH_BLACK_ENGINE) === 'builtin' ? 'builtin' : 'tomitank';
}

/** @param {"builtin"|"tomitank"} engine */
export function setMatchBlackEngine(engine) {
  write(KEYS.MATCH_BLACK_ENGINE, engine === 'builtin' ? 'builtin' : 'tomitank');
}

/** @returns {number} */
export function getMatchWhiteStrength() {
  const n = Number(read(KEYS.MATCH_WHITE_STRENGTH));
  if (Number.isNaN(n) || n < 1 || n > 6) return 3;
  return Math.round(n);
}

/** @param {number} level */
export function setMatchWhiteStrength(level) {
  const clamped = Math.max(1, Math.min(6, Number(level) || 3));
  write(KEYS.MATCH_WHITE_STRENGTH, String(Math.round(clamped)));
}

/** @returns {number} */
export function getMatchBlackStrength() {
  const n = Number(read(KEYS.MATCH_BLACK_STRENGTH));
  if (Number.isNaN(n) || n < 1 || n > 6) return 3;
  return Math.round(n);
}

/** @param {number} level */
export function setMatchBlackStrength(level) {
  const clamped = Math.max(1, Math.min(6, Number(level) || 3));
  write(KEYS.MATCH_BLACK_STRENGTH, String(Math.round(clamped)));
}

/** @returns {number} */
export function getMatchMoveTime() {
  const n = Number(read(KEYS.MATCH_MOVETIME));
  if (Number.isNaN(n) || n < 100 || n > 30000) return 1000;
  return Math.round(n);
}

/** @param {number} value */
export function setMatchMoveTime(value) {
  const clamped = Math.max(100, Math.min(30000, Number(value) || 1000));
  write(KEYS.MATCH_MOVETIME, String(Math.round(clamped)));
}

/** @returns {"white"|"black"} */
export function getMatchPerspective() {
  return read(KEYS.MATCH_PERSPECTIVE) === 'black' ? 'black' : 'white';
}

/** @param {"white"|"black"} color */
export function setMatchPerspective(color) {
  write(KEYS.MATCH_PERSPECTIVE, color === 'black' ? 'black' : 'white');
}

// ── Difficulty ───────────────────────────────────────────────────────────────

/**
 * @returns {number|null} 1-6, or null if not set
 */
export function getDifficulty() {
  const raw = read(KEYS.DIFFICULTY);
  if (raw === null) return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 1 || n > 6) return null;
  return n;
}

/**
 * @param {number} level 1-6
 */
export function setDifficulty(level) {
  const clamped = Math.max(1, Math.min(6, Number(level) || 6));
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
