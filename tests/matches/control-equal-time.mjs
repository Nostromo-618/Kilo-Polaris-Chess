/**
 * HONEST CONTROL: Aurora vs TomitankChess at EQUAL, UNCAPPED thinking time.
 *
 * The release yardstick (vs-tomitank.mjs) sets Tomitank to a difficulty LEVEL,
 * which sends `go movetime N depth D` — at L3, D=6, so Tomitank finishes in a
 * fraction of the budget while Aurora deepens to fill it. That is the intended
 * L6-vs-L3 mismatch, but it means "@Nms" is NOT an equal-thinking-time control.
 *
 * This script removes the ONLY that one variable: it drives Tomitank UNCAPPED
 * (`go movetime N`, no depth token) so its own time manager binds, exactly like
 * Aurora's. Everything else — resign rule, material adjudication, color
 * alternation, bare-FEN handoff, maxplies — is identical to vs-tomitank.mjs, so
 * the delta vs the 63.7% headline isolates the depth-cap effect.
 *
 * It also REPLICATES (--runs) and reports a 95% confidence interval on the
 * score and Elo (draw-aware normal approximation on the per-game score mean).
 *
 * Usage:
 *   node tests/matches/control-equal-time.mjs [--games 20] [--runs 2]
 *        [--level 6] [--movetime 1000] [--capped] [--maxplies 400] [--port 3200]
 *
 * --capped runs Tomitank at its --ttlevel depth cap instead (to reproduce the
 * baseline in the same harness for a side-by-side). Score is from Aurora's view.
 */
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");

const args = parseArgs(process.argv.slice(2));
const gamesPerRun = int(args.games, 20);
const runs = int(args.runs, 2);
const level = int(args.level, 6);
const ttLevel = int(args.ttlevel, 3);
const movetime = int(args.movetime, 1000);
const uncapped = !args.capped; // default = the honest uncapped control
const maxPlies = int(args.maxplies, 400);
const port = int(args.port, 3200);
const label = args.label || (uncapped ? "control-uncapped" : "control-capped");

const server = spawn("pnpm", ["exec", "vite", "--port", String(port), "--strictPort"], {
  cwd: REPO_ROOT,
  stdio: ["ignore", "pipe", "pipe"],
});
await waitForServer(server, port);

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

const oppLabel = uncapped ? "Tomitank(uncapped)" : `Tomitank(L${ttLevel} depth-capped)`;
console.log(
  `HONEST CONTROL — Aurora(level ${level}) vs ${oppLabel}\n` +
  `equal movetime=${movetime}ms  runs=${runs}  games/run=${gamesPerRun}  (${runs * gamesPerRun} total)\n`
);

const outDir = resolve(HERE, "results");
mkdirSync(outDir, { recursive: true });
const outFile = resolve(outDir, `control-${label}-L${level}-mt${movetime}.json`);

let aWins = 0, ttWins = 0, draws = 0;
const rows = [];
const perRun = [];
const started = Date.now();

const save = (extra = {}) => writeFileSync(
  outFile,
  JSON.stringify({
    label, mode: uncapped ? "uncapped" : "capped", level, ttLevel, movetime,
    runs, gamesPerRun, completed: rows.length, aWins, ttWins, draws,
    ...extra, perRun, rows,
  }, null, 2)
);

let gameNo = 0;
for (let run = 0; run < runs; run++) {
  let rAW = 0, rTT = 0, rD = 0;
  for (let g = 0; g < gamesPerRun; g++) {
    gameNo++;
    const auroraColor = gameNo % 2 === 1 ? "white" : "black"; // alternate across the whole match
    let r = null;
    for (let attempt = 0; attempt < 3 && r === null; attempt++) {
      try {
        r = await session.page.evaluate(playOneGame, { level, ttLevel, movetime, maxPlies, auroraColor, uncapped });
      } catch (err) {
        console.log(`game ${gameNo}: browser session lost (${String(err).split("\n")[0]}); relaunching (attempt ${attempt + 1})`);
        try { await session.browser.close(); } catch { /* already gone */ }
        session = await launchSession();
      }
    }
    if (r === null) throw new Error(`game ${gameNo}: browser kept dying across relaunches`);

    let outcome;
    if (r.winner === null) { draws++; rD++; outcome = "draw"; }
    else if (r.winner === auroraColor) { aWins++; rAW++; outcome = "Aurora wins"; }
    else { ttWins++; rTT++; outcome = "Tomitank wins"; }

    rows.push({ run: run + 1, g: gameNo, auroraColor, outcome, plies: r.plies, reason: r.reason });
    const elapsedMin = ((Date.now() - started) / 60000).toFixed(1);
    console.log(
      `[harness] run ${run + 1} game ${String(gameNo).padStart(3)}  Aurora=${auroraColor[0].toUpperCase()}  ${outcome.padEnd(13)}  ${String(r.plies).padStart(3)} plies  (${r.reason})   [${elapsedMin}m]`
    );
    save();
  }
  const rs = scoreStats(rAW, rTT, rD);
  perRun.push({ run: run + 1, aWins: rAW, ttWins: rTT, draws: rD, score: rs.score, pct: rs.pct });
  console.log(`[harness] -- run ${run + 1} done: Aurora ${rAW}W-${rTT}L-${rD}D = ${rs.pct}% --`);
  save();
}

const st = scoreStats(aWins, ttWins, draws); // note: scoreStats(w, l, d) below
const secs = ((Date.now() - started) / 1000).toFixed(0);

const summary = [
  ``,
  `=== HONEST CONTROL RESULT (${uncapped ? "UNCAPPED equal-time" : "capped"}) ===`,
  `Aurora(L${level}) vs ${oppLabel}  @ ${movetime}ms/move`,
  `Total: ${aWins}W  ${ttWins}L  ${draws}D   over ${rows.length} games, ${runs} runs (${secs}s)`,
  `Aurora score: ${st.score}/${rows.length} = ${st.pct}%   95% CI [${(st.lo * 100).toFixed(1)}%, ${(st.hi * 100).toFixed(1)}%]`,
  `Est. Elo(Aurora - Tomitank): ${fmtElo(st.elo)}   95% CI [${fmtElo(st.eloLo)}, ${fmtElo(st.eloHi)}]`,
  `Per-run scores: ${perRun.map((r) => r.pct + "%").join("  ")}`,
  ``,
  `For reference, the release headline is Aurora L6 vs Tomitank L3 (depth-capped) @1000ms = 63.7%.`,
].join("\n");
console.log(summary);

save({ score: st.score, pct: st.pct, ci: [st.lo, st.hi], elo: st.elo, eloCi: [st.eloLo, st.eloHi], secs: Number(secs) });

await session.browser.close();
server.kill("SIGTERM");
process.exit(0);

/** Runs entirely inside the browser page. Returns { winner, reason, plies }. */
async function playOneGame({ level, ttLevel, movetime, maxPlies, auroraColor, uncapped }) {
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
        movetime, difficulty: ttLevel, uncapped,
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

function eloDiff(p) { if (p <= 0) return -800; if (p >= 1) return 800; return -400 * Math.log10(1 / p - 1); }
function fmtElo(e) { return (e > 0 ? "+" : "") + e.toFixed(0); }

/** Draw-aware 95% CI on the per-game score mean (normal approximation). */
function scoreStats(w, l, d) {
  const n = w + l + d;
  const score = w + d / 2;
  const p = n ? score / n : 0;
  // variance of a single game's score in {0, 0.5, 1}
  const variance = n ? (w * (1 - p) ** 2 + d * (0.5 - p) ** 2 + l * (0 - p) ** 2) / n : 0;
  const se = n ? Math.sqrt(variance / n) : 0;
  const lo = Math.max(0, p - 1.96 * se);
  const hi = Math.min(1, p + 1.96 * se);
  return {
    score, pct: (p * 100).toFixed(1), lo, hi,
    elo: eloDiff(p), eloLo: eloDiff(lo), eloHi: eloDiff(hi),
  };
}

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
