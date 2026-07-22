/**
 * Aurora (current on-disk build) vs TomitankChess — external strength yardstick.
 *
 * TomitankChess runs as a browser Web Worker, so this harness runs under
 * Playwright: it spawns the Vite dev server, opens the app page, and runs the
 * game loop inside the page using the app's own ES modules. TomitankChess is
 * driven ONLY through js/tomitankClient.js (UCI) — its source is never read.
 *
 * Usage:
 *   node tests/matches/vs-tomitank.mjs [--games 20] [--level 6] [--movetime 300]
 *        [--ttlevel <n>] [--maxplies 400] [--port 3100] [--label before]
 *
 * Score is reported from Aurora's perspective. --ttlevel sets Tomitank's
 * difficulty (default = same as Aurora's level).
 */
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");

const args = parseArgs(process.argv.slice(2));
const games = int(args.games, 20);
const level = int(args.level, 6);
const ttLevel = int(args.ttlevel, level);
const movetime = int(args.movetime, 300);
const maxPlies = int(args.maxplies, 400);
const port = int(args.port, 3100);
const label = args.label || "run";

const server = spawn("pnpm", ["exec", "vite", "--port", String(port), "--strictPort"], {
  cwd: REPO_ROOT,
  stdio: ["ignore", "pipe", "pipe"],
});
await waitForServer(server, port);

// The headless browser is sometimes killed externally on long runs (observed
// twice at ~15-17 min under external system load). Relaunch it transparently
// and retry the in-flight game; completed games are already persisted.
async function launchSession() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("console", (m) => {
    const t = m.text();
    if (t.startsWith("[harness]")) console.log(t);
  });
  await page.goto(`http://localhost:${port}/`, { waitUntil: "domcontentloaded" });
  return { browser, page };
}

let session = await launchSession();

console.log(`Aurora(level ${level}) vs Tomitank(level ${ttLevel})  games=${games} movetime=${movetime}ms\n`);

let aWins = 0, ttWins = 0, draws = 0;
const rows = [];
const started = Date.now();
const outDir = resolve(HERE, "results");
mkdirSync(outDir, { recursive: true });
const outFile = resolve(outDir, `vs-tomitank-${label}-L${level}.json`);
const saveProgress = () => writeFileSync(
  outFile,
  JSON.stringify({ label, level, ttLevel, movetime, games, completed: rows.length, aWins, ttWins, draws, rows }, null, 2)
);

for (let g = 0; g < games; g++) {
  const auroraColor = g % 2 === 0 ? "white" : "black";
  let r = null;
  for (let attempt = 0; attempt < 3 && r === null; attempt++) {
    try {
      r = await session.page.evaluate(playOneGame, { level, ttLevel, movetime, maxPlies, auroraColor });
    } catch (err) {
      console.log(`game ${g + 1}: browser session lost (${String(err).split("\n")[0]}); relaunching (attempt ${attempt + 1})`);
      try { await session.browser.close(); } catch { /* already gone */ }
      session = await launchSession();
    }
  }
  if (r === null) throw new Error(`game ${g + 1}: browser kept dying across relaunches`);

  let outcome;
  if (r.winner === null) { draws++; outcome = "draw"; }
  else if (r.winner === auroraColor) { aWins++; outcome = "Aurora wins"; }
  else { ttWins++; outcome = "Tomitank wins"; }

  rows.push({ g: g + 1, auroraColor, outcome, plies: r.plies, reason: r.reason });
  console.log(
    `game ${String(g + 1).padStart(3)}  Aurora=${auroraColor[0].toUpperCase()}  ${outcome.padEnd(13)}  ${r.plies} plies  (${r.reason})`
  );
  saveProgress();
}

const score = aWins + draws / 2;
const pct = ((score / games) * 100).toFixed(1);
const elo = eloDiff(score / games);
const secs = ((Date.now() - started) / 1000).toFixed(0);

const summary = [
  ``,
  `=== Aurora vs Tomitank (${label}) ===`,
  `Aurora: ${aWins}W  Tomitank: ${ttWins}W  draws: ${draws}   (${games} games, ${secs}s)`,
  `Aurora score: ${score}/${games} = ${pct}%`,
  `Est. Elo(Aurora - Tomitank): ${elo === null ? "n/a" : (elo > 0 ? "+" : "") + elo.toFixed(0)}`,
].join("\n");
console.log(summary);

writeFileSync(
  outFile,
  JSON.stringify({ label, level, ttLevel, movetime, games, aWins, ttWins, draws, score, pct, elo, rows }, null, 2)
);

await session.browser.close();
server.kill("SIGTERM");
process.exit(0);

/**
 * Runs entirely inside the browser page. Returns { winner, reason, plies }.
 * winner is "white" | "black" | null.
 */
async function playOneGame({ level, ttLevel, movetime, maxPlies, auroraColor }) {
  const [aiMod, gsMod, rulesMod, ttMod] = await Promise.all([
    import("/js/engine/AI.js"),
    import("/js/engine/GameState.js"),
    import("/js/engine/Rules.js"),
    import("/js/tomitankClient.js"),
  ]);
  const { AI } = aiMod;
  const { GameState } = gsMod;
  const { generateLegalMoves } = rulesMod;
  const tt = ttMod.getTomitankClient();

  const ai = new AI();
  await tt.resetGame();
  const gs = GameState.createStarting("white");

  const snapshot = (s) => ({
    board: s.board.slice(),
    activeColor: s.activeColor,
    castlingRights: JSON.parse(JSON.stringify(s.castlingRights)),
    enPassantTarget: s.enPassantTarget || null,
  });
  const opposite = (c) => (c === "white" ? "black" : "white");
  const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
  const material = (b) => b.reduce((s, p) => (p ? s + (p[0] === "w" ? 1 : -1) * (VAL[p[1]] || 0) : s), 0);

  let sinceIrrev = [];
  let plies = 0;
  const lowStreak = { white: 0, black: 0 };
  const resignScore = 2000, resignStreak = 6;

  while (!gs.isGameOver() && plies < maxPlies) {
    const mover = gs.activeColor;
    const legal = generateLegalMoves(gs.asRulesState());
    if (legal.length === 0) break;

    let chosen = null;
    let moverScore = 0;

    if (mover === auroraColor) {
      const move = await ai.findBestMove(gs.serialize(), {
        level, forColor: mover, timeout: movetime, history: sinceIrrev.slice(),
      });
      const info = ai.getLastSearchInfo();
      moverScore = typeof info.bestScore === "number" ? info.bestScore : 0;
      if (move) {
        const p = move.promotion || null;
        chosen = legal.find((m) => m.from === move.from && m.to === move.to && (m.promotion || null) === p)
          || legal.find((m) => m.from === move.from && m.to === move.to);
      }
    } else {
      let ttScoreCp = 0;
      const move = await tt.findBestMove(gs, {
        movetime, difficulty: ttLevel,
        onInfo: (i) => { if (i && typeof i.score === "number" && i.scoreType === "cp") ttScoreCp = i.score; },
      });
      moverScore = ttScoreCp;
      if (move) {
        chosen = legal.find((m) => m.from === move.from && m.to === move.to && (m.promotion || null) === (move.promotion || null))
          || legal.find((m) => m.from === move.from && m.to === move.to);
      }
    }

    if (!chosen) return { winner: opposite(mover), reason: `${mover} (no move)`, plies };

    sinceIrrev.push(snapshot(gs.serialize()));
    const piece = gs.getPiece(chosen.from);
    const irreversible = !!(chosen.captured || chosen.isEnPassant || chosen.isCastleKingSide || chosen.isCastleQueenSide || (piece && piece[1] === "P"));
    gs.applyMove(chosen);
    plies += 1;
    if (irreversible) sinceIrrev = [];

    if (moverScore <= -resignScore) lowStreak[mover] += 1; else lowStreak[mover] = 0;
    if (lowStreak[mover] >= resignStreak) return { winner: opposite(mover), reason: `${mover} resigns`, plies };
  }

  if (gs.isGameOver()) {
    const r = gs.result;
    if (r.outcome === "checkmate") return { winner: r.winner, reason: "checkmate", plies };
    return { winner: null, reason: r.reason || r.outcome, plies };
  }
  const mat = material(gs.board);
  if (mat >= 300) return { winner: "white", reason: `adj +${mat}`, plies };
  if (mat <= -300) return { winner: "black", reason: `adj ${mat}`, plies };
  return { winner: null, reason: "adj draw", plies };
}

function waitForServer(proc, port) {
  return new Promise((resolveP, rejectP) => {
    const to = setTimeout(() => rejectP(new Error("Vite start timeout")), 30000);
    const onData = (d) => {
      if (/ready in|Local:.*localhost/i.test(d.toString())) { clearTimeout(to); setTimeout(resolveP, 500); }
    };
    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);
    proc.on("exit", (c) => { clearTimeout(to); rejectP(new Error(`Vite exited early (${c})`)); });
  });
}
function eloDiff(p) { if (p <= 0 || p >= 1) return null; return -400 * Math.log10(1 / p - 1); }
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2), next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true; else { out[key] = next; i++; }
    }
  }
  return out;
}
function int(v, d) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; }
