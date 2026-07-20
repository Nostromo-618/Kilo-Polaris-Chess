import { loadBuild, makePlayer } from "./lib/loadEngines.mjs";
const b = await loadBuild("smoke", "js/engine");
const gs = b.GameState.createStarting("white");
const ai = new b.AI();
for (const level of [1, 3, 4, 6]) {
  const t = Date.now();
  const move = await ai.findBestMove(gs.serialize(), { level, forColor: "white", timeout: 500, history: [] });
  const info = ai.getLastSearchInfo();
  console.log(`L${level}: ${move ? move.from + move.to + (move.promotion||"") : "null"}  depth=${info.depthCompleted} nodes=${info.nodes} q=${info.qNodes} score=${info.bestScore} ${Date.now()-t}ms`);
}
// Repetition: feed a history containing the current position -> engine should see a draw line quickly
const hist = [{ board: gs.board.slice(), activeColor: gs.activeColor, castlingRights: JSON.parse(JSON.stringify(gs.castlingRights)), enPassantTarget: null }];
const m2 = await ai.findBestMove(gs.serialize(), { level: 4, forColor: "white", timeout: 300, history: hist });
console.log("with-seeded-history move:", m2 ? m2.from+m2.to : "null", "(ran without error)");
console.log("SMOKE OK");
