/**
 * PVS exactness check. At level 4 there is no LMR (reductions are level>=5), so
 * the search is exact alpha-beta: PVS must return the IDENTICAL best move and
 * score as the pre-PVS engine, while visiting <= as many nodes (null-window
 * scouts prune more). Runs both builds to a fixed depth cap (large timeout).
 * Usage: node tests/matches/pvs-validate.mjs
 */
import { loadBuild } from "./lib/loadEngines.mjs";

const NEW = await loadBuild("A", "js/engine");
const PRE = await loadBuild("B", ".prepvs/js/engine");

const idx = (f, r) => r * 8 + f;
const bd = (p) => { const a = new Array(64).fill(null); for (const [s, x] of Object.entries(p)) a[idx(s.charCodeAt(0) - 97, s.charCodeAt(1) - 49)] = x; return a; };
const CR0 = { white: { kingSide: false, queenSide: false }, black: { kingSide: false, queenSide: false } };

const positions = [
  { name: "start", state: { board: bd({ a1: "wR", b1: "wN", c1: "wB", d1: "wQ", e1: "wK", f1: "wB", g1: "wN", h1: "wR", a2: "wP", b2: "wP", c2: "wP", d2: "wP", e2: "wP", f2: "wP", g2: "wP", h2: "wP", a7: "bP", b7: "bP", c7: "bP", d7: "bP", e7: "bP", f7: "bP", g7: "bP", h7: "bP", a8: "bR", b8: "bN", c8: "bB", d8: "bQ", e8: "bK", f8: "bB", g8: "bN", h8: "bR" }), activeColor: "white", castlingRights: { white: { kingSide: true, queenSide: true }, black: { kingSide: true, queenSide: true } }, enPassantTarget: null, halfmoveClock: 0, fullmoveNumber: 1 } },
  { name: "tactical", state: { board: bd({ e1: "wK", e8: "bK", d1: "wQ", d8: "bQ", a1: "wR", h1: "wR", a8: "bR", h8: "bR", e4: "wP", e5: "bP", c4: "wB", c5: "bB", f3: "wN", f6: "bN", a2: "wP", b2: "wP", g2: "wP", h2: "wP", a7: "bP", b7: "bP", g7: "bP", h7: "bP" }), activeColor: "white", castlingRights: CR0, enPassantTarget: null, halfmoveClock: 0, fullmoveNumber: 10 } },
  { name: "endgame", state: { board: bd({ e1: "wK", e8: "bK", a2: "wP", b2: "wP", g2: "wP", a7: "bP", b7: "bP", h7: "bP", d4: "wR", d5: "bN" }), activeColor: "white", castlingRights: CR0, enPassantTarget: null, halfmoveClock: 0, fullmoveNumber: 30 } },
];

async function run(build, state, level, timeout) {
  const ai = new build.AI();
  const move = await ai.findBestMove(state, { level, forColor: state.activeColor, timeout, history: [] });
  const info = ai.getLastSearchInfo();
  return { move: move ? `${move.from}${move.to}${move.promotion || ""}` : "null", score: info.bestScore, depth: info.depthCompleted, nodes: (info.nodes || 0) + (info.qNodes || 0) };
}

let ok = true;
for (const p of positions) {
  const a = await run(NEW, p.state, 4, 60000);
  const b = await run(PRE, p.state, 4, 60000);
  const sameMove = a.move === b.move;
  const sameScore = a.score === b.score;
  const sameDepth = a.depth === b.depth;
  const match = sameMove && sameScore && sameDepth;
  ok = ok && match;
  const eff = b.nodes > 0 ? ((a.nodes / b.nodes) * 100).toFixed(0) : "n/a";
  console.log(`${match ? "OK " : "FAIL"} ${p.name.padEnd(9)} depth ${a.depth}  move new=${a.move} pre=${b.move}  score new=${a.score} pre=${b.score}  nodes new=${a.nodes} pre=${b.nodes} (${eff}%)`);
}
console.log(ok ? "\nPVS EXACT — identical move+score+depth to pre-PVS at level 4 (no LMR)" : "\nPVS MISMATCH — PVS changed the exact result");
process.exit(ok ? 0 : 1);
