/**
 * Aurora-vs-Aurora self-play match: two engine builds, N games, alternating
 * colors, fixed per-move time. Primary before/after progress metric.
 *
 * Usage:
 *   node tests/matches/selfplay.mjs [--a js/engine] [--b .baseline/engine]
 *        [--games 40] [--level 6] [--movetime 300] [--maxplies 400] [--quiet]
 *
 * "A" is the challenger (default: current tree), "B" the reference (default:
 * baseline snapshot). Score is reported from A's perspective.
 */
import { loadBuild, makePlayer } from "./lib/loadEngines.mjs";
import { playGame } from "./lib/play.mjs";

const args = parseArgs(process.argv.slice(2));
const aSrc = args.a || "js/engine";
const bSrc = args.b || ".baseline/engine";
const games = int(args.games, 40);
const level = int(args.level, 6);
const movetime = int(args.movetime, 300);
const maxPlies = int(args.maxplies, 400);
const quiet = "quiet" in args;

const A = await loadBuild("A", aSrc);
const B = await loadBuild("B", bSrc);
// Driver = challenger's GameState/Rules (consistent applier for both sides).
const driver = { GameState: A.GameState, Rules: A.Rules };

console.log(`Self-play: A=${aSrc}  vs  B=${bSrc}`);
console.log(`level=${level} games=${games} movetime=${movetime}ms maxPlies=${maxPlies}\n`);

let aWins = 0, bWins = 0, draws = 0;
const started = Date.now();

for (let g = 0; g < games; g++) {
  const aIsWhite = g % 2 === 0;
  const pa = makePlayer(A, "A");
  const pb = makePlayer(B, "B");
  const white = aIsWhite ? pa : pb;
  const black = aIsWhite ? pb : pa;

  const r = await playGame({ driver, white, black, level, movetime, maxPlies });

  let outcome;
  if (r.winner === null) { draws++; outcome = "draw"; }
  else {
    const winnerIsA = (r.winner === "white") === aIsWhite;
    if (winnerIsA) { aWins++; outcome = "A wins"; }
    else { bWins++; outcome = "B wins"; }
  }

  if (!quiet) {
    const aColor = aIsWhite ? "W" : "B";
    console.log(
      `game ${String(g + 1).padStart(3)}  A=${aColor}  ${outcome.padEnd(7)}  ${r.plies} plies  (${r.reason})`
    );
  }
}

const score = aWins + draws / 2;
const pct = ((score / games) * 100).toFixed(1);
const elo = eloDiff(score / games);
const secs = ((Date.now() - started) / 1000).toFixed(0);

console.log(`\n=== RESULT (A vs B) ===`);
console.log(`A: ${aWins}W  B: ${bWins}W  draws: ${draws}   (${games} games, ${secs}s)`);
console.log(`A score: ${score}/${games} = ${pct}%`);
console.log(`Est. Elo(A - B): ${elo === null ? "n/a (score 0 or 100%)" : (elo > 0 ? "+" : "") + elo.toFixed(0)}`);

function eloDiff(p) {
  if (p <= 0 || p >= 1) return null;
  return -400 * Math.log10(1 / p - 1);
}
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else { out[key] = next; i++; }
    }
  }
  return out;
}
function int(v, d) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; }
