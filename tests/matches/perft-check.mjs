/**
 * Perft validation for the allocation-free legality rewrite. Compares exhaustive
 * legal-move-tree node counts between the new engine (js/engine) and the baseline
 * (.baseline/engine), and against known-correct reference values. If perft matches,
 * legal move generation is provably unchanged/correct.
 * Usage: node tests/matches/perft-check.mjs
 */
import { loadBuild } from "./lib/loadEngines.mjs";

const A = await loadBuild("A", "js/engine");
const B = await loadBuild("B", ".baseline/engine");

// serialize() returns the board/castlingRights by reference, so build an
// independent child to avoid mutating the parent during the perft recursion.
function childOf(build, gs, move) {
  const s = gs.serialize();
  const child = new build.GameState({
    board: gs.board.slice(),
    activeColor: s.activeColor,
    castlingRights: {
      white: { ...s.castlingRights.white },
      black: { ...s.castlingRights.black },
    },
    enPassantTarget: s.enPassantTarget,
    halfmoveClock: s.halfmoveClock,
    fullmoveNumber: s.fullmoveNumber,
  });
  child.applyMove(move);
  return child;
}

function perft(build, gs, depth) {
  const moves = build.Rules.generateLegalMoves(gs.asRulesState());
  if (depth <= 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(build, childOf(build, gs, m), depth - 1);
  return n;
}

function applyLine(build, moves) {
  let gs = build.GameState.createStarting("white");
  for (const [from, to] of moves) {
    const legal = build.Rules.generateLegalMoves(gs.asRulesState());
    const mv = legal.find((m) => m.from === from && m.to === to);
    if (!mv) throw new Error(`illegal setup move ${from}${to}`);
    gs = childOf(build, gs, mv);
  }
  return gs;
}

// Italian-ish line producing castling rights, captures, developed pieces.
const line = [["e2", "e4"], ["e7", "e5"], ["g1", "f3"], ["b8", "c6"], ["f1", "c4"], ["f8", "c5"]];

let ok = true;
function cmp(label, gsA, gsB, depth, known) {
  const a = perft(A, gsA, depth);
  const b = perft(B, gsB, depth);
  const match = a === b && (known === undefined || a === known);
  ok = ok && match;
  console.log(`${match ? "OK " : "FAIL"}  ${label} perft(${depth}): new=${a} baseline=${b}${known !== undefined ? ` known=${known}` : ""}`);
}

// Start position — known reference values.
const startA = A.GameState.createStarting("white");
const startB = B.GameState.createStarting("white");
cmp("start", startA, startB, 1, 20);
cmp("start", startA, startB, 2, 400);
cmp("start", startA, startB, 3, 8902);
cmp("start", startA, startB, 4, 197281);

// Italian middlegame (castling available for both sides).
cmp("italian", applyLine(A, line), applyLine(B, line), 3);
cmp("italian", applyLine(A, line), applyLine(B, line), 4);

console.log(ok ? "\nPERFT OK — legality identical to baseline and matches known values" : "\nPERFT MISMATCH");
process.exit(ok ? 0 : 1);
