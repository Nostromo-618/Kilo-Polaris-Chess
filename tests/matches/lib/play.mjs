/**
 * Play one complete game between two players on a shared GameState driver.
 *
 * A "player" is { name, findBestMove(serialized, { level, forColor, timeout, history }) }
 * returning { move: {from,to,promotion?}, score, depth, nodes }.
 *
 * The driver (GameState + Rules) applies moves and detects terminal states
 * (checkmate, stalemate, threefold, fifty-move, insufficient material). A ply
 * cap and score-based resignation keep games bounded.
 */

function snapshot(serialized) {
  return {
    board: serialized.board.slice(),
    activeColor: serialized.activeColor,
    castlingRights: structuredClone(serialized.castlingRights),
    enPassantTarget: serialized.enPassantTarget || null,
  };
}

function isIrreversible(gs, driver, move) {
  const piece = gs.getPiece(move.from);
  return !!(
    move.captured ||
    move.isEnPassant ||
    move.isCastleKingSide ||
    move.isCastleQueenSide ||
    (piece && piece[1] === "P")
  );
}

/**
 * @returns {{
 *   winner: "white"|"black"|null,
 *   reason: string,
 *   plies: number,
 *   moves: string[],
 * }}
 */
export async function playGame({
  driver, // { GameState, Rules }
  white, // player
  black, // player
  level,
  movetime,
  maxPlies = 400,
  resignScore = 2000, // centipawns
  resignStreak = 6,
  onPly = null,
}) {
  const { GameState, Rules } = driver;
  const gs = GameState.createStarting("white");
  const players = { white, black };

  let sinceIrrev = []; // positions since last irreversible move, excluding current
  const lowStreak = { white: 0, black: 0 };
  const moves = [];
  let plies = 0;

  while (!gs.isGameOver() && plies < maxPlies) {
    const mover = gs.activeColor;
    const player = players[mover];
    const serialized = gs.serialize();
    const history = sinceIrrev.slice();

    let res;
    try {
      res = await player.findBestMove(serialized, {
        level,
        forColor: mover,
        timeout: movetime,
        history,
      });
    } catch (err) {
      return { winner: opposite(mover), reason: `${player.name} threw: ${err.message}`, plies, moves };
    }

    const suggested = res && res.move;
    const legal = Rules.generateLegalMoves(gs.asRulesState());
    if (legal.length === 0) break; // terminal; loop guard will catch via isGameOver

    let chosen = null;
    if (suggested) {
      const p = suggested.promotion || null;
      chosen =
        legal.find((m) => m.from === suggested.from && m.to === suggested.to && (m.promotion || null) === p) ||
        legal.find((m) => m.from === suggested.from && m.to === suggested.to);
    }
    if (!chosen) {
      return { winner: opposite(mover), reason: `${player.name} returned no legal move`, plies, moves };
    }

    // Record the pre-move position so a later revisit counts as a repetition.
    sinceIrrev.push(snapshot(serialized));
    const irreversible = isIrreversible(gs, driver, chosen);

    gs.applyMove(chosen);
    moves.push(`${chosen.from}${chosen.to}${chosen.promotion || ""}`);
    plies += 1;

    if (irreversible) sinceIrrev = [];

    // Resignation adjudication: a side that keeps evaluating itself as lost.
    const score = typeof res.score === "number" ? res.score : 0;
    if (score <= -resignScore) lowStreak[mover] += 1;
    else lowStreak[mover] = 0;
    if (lowStreak[mover] >= resignStreak) {
      return { winner: opposite(mover), reason: `${mover} resigns (eval ${score})`, plies, moves };
    }

    if (onPly) onPly({ plies, mover, move: moves[moves.length - 1], score, depth: res.depth });
  }

  if (gs.isGameOver()) {
    const r = gs.result;
    if (r.outcome === "checkmate") return { winner: r.winner, reason: "checkmate", plies, moves };
    return { winner: null, reason: r.reason || r.outcome, plies, moves };
  }

  // Ply cap reached: adjudicate by material + eval sign, else draw.
  const mat = materialBalance(gs.board); // + = white ahead
  if (mat >= 300) return { winner: "white", reason: `adjudicated +${mat}cp @plycap`, plies, moves };
  if (mat <= -300) return { winner: "black", reason: `adjudicated ${mat}cp @plycap`, plies, moves };
  return { winner: null, reason: "adjudicated draw @plycap", plies, moves };
}

function opposite(c) {
  return c === "white" ? "black" : "white";
}

const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
function materialBalance(board) {
  let s = 0;
  for (const p of board) {
    if (!p) continue;
    const v = VAL[p[1]] || 0;
    s += p[0] === "w" ? v : -v;
  }
  return s;
}
