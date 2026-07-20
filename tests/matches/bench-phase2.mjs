/**
 * Phase 2 verification: levels 1-3 stay CPU-light (new ~= baseline), and level 6
 * now deepens past the old fixed depth-7 cap using its time budget.
 * Usage: node tests/matches/bench-phase2.mjs
 */
import { loadBuild } from "./lib/loadEngines.mjs";

const A = await loadBuild("A", "js/engine");
const B = await loadBuild("B", ".baseline/engine");

const idx = (f, r) => r * 8 + f;
function boardFrom(pieces) {
  const b = new Array(64).fill(null);
  for (const [sq, pc] of Object.entries(pieces)) b[idx(sq.charCodeAt(0) - 97, sq.charCodeAt(1) - 49)] = pc;
  return b;
}
// Italian middlegame (both sides castled, developed), White to move.
const midgame = {
  board: boardFrom({
    a1: "wR", c1: "wB", d1: "wQ", f1: "wR", g1: "wK", b1: "wN", c4: "wB", f3: "wN",
    a2: "wP", b2: "wP", c3: "wP", d3: "wP", e4: "wP", f2: "wP", g2: "wP", h2: "wP",
    a8: "bR", c8: "bB", d8: "bQ", f8: "bR", g8: "bK", b8: "bN", c5: "bB", f6: "bN",
    a7: "bP", b7: "bP", c7: "bP", d6: "bP", e5: "bP", f7: "bP", g7: "bP", h7: "bP",
    c6: "bN",
  }),
  activeColor: "white",
  castlingRights: { white: { kingSide: false, queenSide: false }, black: { kingSide: false, queenSide: false } },
  enPassantTarget: null, halfmoveClock: 4, fullmoveNumber: 8,
};

async function run(build, level, timeout, state) {
  const ai = new build.AI();
  const t = Date.now();
  await ai.findBestMove(state, { level, forColor: state.activeColor, timeout, history: [] });
  const info = ai.getLastSearchInfo();
  return { ms: Date.now() - t, depth: info.depthCompleted, nodes: (info.nodes || 0) + (info.qNodes || 0) };
}

console.log("=== Levels 1-3: CPU-light check (new A vs baseline B), midgame ===");
for (const level of [1, 2, 3]) {
  const a = await run(A, level, 5000, midgame);
  const b = await run(B, level, 5000, midgame);
  console.log(`L${level}  new: depth ${a.depth} nodes ${a.nodes} ${a.ms}ms   |   baseline: depth ${b.depth} nodes ${b.nodes} ${b.ms}ms`);
}

console.log("\n=== Level 6: uses budget / deepens past old cap (10s), midgame ===");
const a6 = await run(A, 6, 10000, midgame);
const b6 = await run(B, 6, 10000, midgame);
console.log(`L6  new: depth ${a6.depth} nodes ${a6.nodes} ${a6.ms}ms`);
console.log(`L6  baseline: depth ${b6.depth} nodes ${b6.nodes} ${b6.ms}ms  (old fixed cap = 7)`);
