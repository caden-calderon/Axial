// Finds a moment in the staged classic match (CLASSIC_FORK) for the AI-wins beat: orange (the
// player, moving first against the AI) has the move, and some orange move leaves blue an
// immediate win, which the AI then takes. Prefers blue lines that climb (more than one height)
// and orange moves that don't win or block anything themselves. Prints candidates as JSON lines.
//
//   node <bundle>   (bundle with esbuild; see axial-video/README.md)
import {
  applyMove,
  cellFromIndex,
  createGame,
  type GameSnapshot,
  type Move,
} from "@axial/core";
import { CLASSIC_FORK } from "./takes/matches.mjs";

const DIMENSIONS = { height: 6, rows: 6, columns: 7 };
const WIN = { lineLength: 4, linesToWin: 1 };

function tryMove(game: GameSnapshot, move: Move): GameSnapshot | null {
  try {
    return applyMove(game, move);
  } catch {
    return null;
  }
}

function winningMoves(game: GameSnapshot): Move[] {
  const wins: Move[] = [];
  for (let row = 0; row < DIMENSIONS.rows; row += 1) {
    for (let col = 0; col < DIMENSIONS.columns; col += 1) {
      if (tryMove(game, { row, col })?.status.state === "won")
        wins.push({ row, col });
    }
  }
  return wins;
}

function seededRandom(start: number) {
  let state = start >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function legal(game: GameSnapshot): Move[] {
  const moves: Move[] = [];
  for (let row = 0; row < DIMENSIONS.rows; row += 1) {
    for (let col = 0; col < DIMENSIONS.columns; col += 1)
      if (tryMove(game, { row, col })) moves.push({ row, col });
  }
  return moves;
}

// From each prefix of the staged match, short random continuations in which nobody passes up a
// win, stopping when orange (to move) has a move that hands blue an immediate win.
const seen = new Set<string>();
for (let seed = 1; seed <= Number(process.env.SEEDS ?? 400); seed += 1) {
  const random = seededRandom(seed);
  const restoreAt = 16 + 2 * Math.floor(random() * 6);
  let game = createGame(WIN, DIMENSIONS, 1);
  for (const [row, col] of CLASSIC_FORK.slice(0, restoreAt))
    game = applyMove(game, { row, col });
  const extra: Move[] = [];
  for (let ply = 0; ply < 10 && game.status.state === "playing"; ply += 1) {
    if (winningMoves(game).length) break;
    if (game.currentPlayer === 1) {
      const blunders: {
        orange: Move;
        blue: Move;
        span: number;
        direction: number[];
      }[] = [];
      for (const move of legal(game)) {
        const afterOrange = applyMove(game, move);
        for (const win of winningMoves(afterOrange)) {
          const final = applyMove(afterOrange, win);
          const line = final.completedLines[final.completedLines.length - 1];
          const span = new Set(
            line.cells.map((cell) => cellFromIndex(cell, DIMENSIONS).height),
          ).size;
          blunders.push({
            orange: move,
            blue: win,
            span,
            direction: [...line.direction],
          });
        }
      }
      const best = blunders.filter((blunder) => blunder.span >= 3);
      if (best.length) {
        const pick = best[0];
        const key = JSON.stringify([restoreAt, extra, pick.orange]);
        if (!seen.has(key)) {
          seen.add(key);
          console.log(
            JSON.stringify({
              seed,
              restoreAt,
              extra: extra.map((m) => [m.row, m.col]),
              orange: [pick.orange.row, pick.orange.col],
              blue: [pick.blue.row, pick.blue.col],
              span: pick.span,
              direction: pick.direction,
              moves: game.moveHistory.length,
            }),
          );
        }
        break;
      }
    }
    // A random move that doesn't hand the opponent an immediate win.
    const safe = legal(game).filter(
      (move) => !winningMoves(applyMove(game, move)).length,
    );
    if (!safe.length) break;
    const move = safe[Math.floor(random() * safe.length)];
    extra.push(move);
    game = applyMove(game, move);
  }
}
