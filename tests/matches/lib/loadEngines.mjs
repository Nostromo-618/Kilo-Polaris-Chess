/**
 * Loads two Aurora engine builds into an ESM sandbox so both can run in the same
 * Node process (for old-vs-new self-play). The repo root has no "type":"module",
 * so we copy each build under tests/matches/engines/<tag>/ (this dir IS a
 * type:module scope) and dynamic-import from there.
 *
 * A "build" is a directory containing the js/engine modules (AI.js, GameState.js,
 * Rules.js, ...). The current tree is js/engine; the baseline snapshot is
 * .baseline/engine (see .gitignore).
 */
import { cpSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const MATCHES_DIR = resolve(HERE, "..");
const REPO_ROOT = resolve(MATCHES_DIR, "..", "..");
const ENGINES_DIR = join(MATCHES_DIR, "engines");

/**
 * @param {string} tag  short name, e.g. "current" | "baseline"
 * @param {string} srcRel  path to an engine dir, relative to repo root
 * @returns {Promise<{tag:string, AI:any, GameState:any, Rules:any}>}
 */
export async function loadBuild(tag, srcRel) {
  const src = resolve(REPO_ROOT, srcRel);
  if (!existsSync(src)) {
    throw new Error(`Engine build "${tag}" not found at ${src}`);
  }
  const dest = join(ENGINES_DIR, tag);
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });

  const [ai, gs, rules] = await Promise.all([
    import(`../engines/${tag}/AI.js`),
    import(`../engines/${tag}/GameState.js`),
    import(`../engines/${tag}/Rules.js`),
  ]);
  return { tag, AI: ai.AI, GameState: gs.GameState, Rules: rules };
}

/** Wrap an engine build as a player: one persistent AI instance per game. */
export function makePlayer(build, label) {
  const ai = new build.AI();
  return {
    name: label,
    build,
    async findBestMove(serialized, opts) {
      const move = await ai.findBestMove(serialized, opts);
      const info = ai.getLastSearchInfo();
      return {
        move,
        score: info.bestScore,
        depth: info.depthCompleted,
        nodes: (info.nodes || 0) + (info.qNodes || 0),
      };
    },
  };
}
