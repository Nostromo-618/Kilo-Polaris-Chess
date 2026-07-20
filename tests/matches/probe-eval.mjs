/**
 * Read-only eval-orientation probe. Documents current behavior of a given
 * engine build's evaluate() on hand-built positions. Safe to run anytime.
 *
 * Usage: node tests/matches/probe-eval.mjs [srcRel]   (default .baseline/engine)
 */
import { cpSync, rmSync } from "node:fs";

const src = process.argv[2] || ".baseline/engine";
rmSync("tests/matches/.probe", { recursive: true, force: true });
cpSync(src, "tests/matches/.probe", { recursive: true });
const { evaluate } = await import("./.probe/Evaluator.js");

const idx = (file, rank) => rank * 8 + file; // a1=0
function board(pieces) {
  const b = new Array(64).fill(null);
  for (const [sq, pc] of Object.entries(pieces)) {
    const f = sq.charCodeAt(0) - 97, r = sq.charCodeAt(1) - 49;
    b[idx(f, r)] = pc;
  }
  return b;
}
function state(pieces, activeColor = "white") {
  return {
    board: board(pieces), activeColor,
    castlingRights: { white: { kingSide: false, queenSide: false }, black: { kingSide: false, queenSide: false } },
    enPassantTarget: null, halfmoveClock: 0, fullmoveNumber: 1,
  };
}

console.log(`Engine build: ${src}\n`);

// 1) Lone white passed pawn: e2 vs e7 (white to move). Correct: e7 >> e2.
const passE2 = evaluate(state({ a1: "wK", h8: "bK", e2: "wP" }), "white");
const passE7 = evaluate(state({ a1: "wK", h8: "bK", e7: "wP" }), "white");
console.log(`Lone white passer  e2 = ${passE2}   e7 = ${passE7}   -> ${passE7 > passE2 ? "OK (e7 higher)" : "BUG (e7 not higher)"}`);

// 2) King middlegame safety: castled g1 vs advanced e5, with heavy material for MG phase.
const heavy = { a1: "wR", h1: "wR", d1: "wQ", a8: "bR", h8: "bR", d8: "bQ", a7: "bP", b7: "bP", a2: "wP", b2: "wP", e8: "bK" };
const kingG1 = evaluate(state({ ...heavy, g1: "wK" }), "white");
const kingE5 = evaluate(state({ ...heavy, e5: "wK" }), "white");
console.log(`White king (MG)    g1 = ${kingG1}   e5 = ${kingE5}   -> ${kingG1 > kingE5 ? "OK (g1 safer)" : "BUG (advanced king not penalized)"}`);

// 3) Passed pawn advancement monotonic e2..e7 (white).
const ranks = [2, 3, 4, 5, 6, 7].map((r) => evaluate(state({ a1: "wK", h8: "bK", ["e" + r]: "wP" }), "white"));
console.log(`Passer e2..e7 eval: ${ranks.join(", ")}   -> ${ranks.every((v, i) => i === 0 || v >= ranks[i - 1]) ? "OK (monotonic up)" : "BUG (not monotonic)"}`);

rmSync("tests/matches/.probe", { recursive: true, force: true });
