// Stages the opening "reveal" position on the classic board. Seen square from the front, the
// front row should read as a Connect 4 rack: every column filled to a different height, colours
// mixed. A few low stacks sit in the rows behind, so orbiting up shows the board has depth.
//
// The shape is fixed (FRONT heights, BACK stacks); a move order is searched in which players
// alternate, pieces stack by gravity, nobody ever has an immediate win available (so nobody
// passes one up and nobody has won), and the last move drops into the centre of the front row.
//
//   node <bundle> [SEED=n]   (bundle with esbuild; see axial-video/README.md)
import {
  applyMove,
  createGame,
  type GameSnapshot,
  type Move,
} from "@axial/core";

const DIMENSIONS = { height: 6, rows: 6, columns: 7 };
const WIN = { lineLength: 4, linesToWin: 1 };
const FRONT_ROW = 5;
const FRONT = [1, 3, 2, 5, 4, 2, 3];
const BACK: [row: number, col: number, height: number][] = [
  [4, 1, 1],
  [4, 3, 2],
  [4, 4, 1],
  [3, 2, 1],
  [3, 5, 1],
  [2, 3, 1],
];
const LAST: Move = { row: FRONT_ROW, col: 3 };

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

function hasWinningMove(game: GameSnapshot): boolean {
  for (let row = 0; row < DIMENSIONS.rows; row += 1) {
    for (let col = 0; col < DIMENSIONS.columns; col += 1) {
      try {
        if (applyMove(game, { row, col }).status.state === "won") return true;
      } catch {
        // Full column.
      }
    }
  }
  return false;
}

const remaining = new Map<string, number>();
FRONT.forEach((height, col) => remaining.set(`${FRONT_ROW}:${col}`, height));
for (const [row, col, height] of BACK) remaining.set(`${row}:${col}`, height);
// The last piece is played separately.
remaining.set(
  `${LAST.row}:${LAST.col}`,
  remaining.get(`${LAST.row}:${LAST.col}`)! - 1,
);
const total =
  [...remaining.values()].reduce((sum, count) => sum + count, 0) + 1;
if (total % 2 === 0)
  console.warn(`Note: ${total} pieces, so blue plays the last move`);

const random = seededRandom(Number(process.env.SEED ?? 1));
let nodes = 0;

function search(game: GameSnapshot, moves: Move[]): Move[] | null {
  if (++nodes > 2_000_000) return null;
  if (hasWinningMove(game)) return null;
  if (moves.length === total - 1) {
    const finished = applyMove(game, LAST);
    return finished.status.state === "won" ? null : [...moves, LAST];
  }
  const options = [...remaining.entries()]
    .filter(([, count]) => count > 0)
    .map(([id]) => id);
  for (let index = options.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [options[index], options[swap]] = [options[swap], options[index]];
  }
  for (const id of options) {
    const [row, col] = id.split(":").map(Number);
    const next = applyMove(game, { row, col });
    if (next.status.state === "won") continue;
    remaining.set(id, remaining.get(id)! - 1);
    const found = search(next, [...moves, { row, col }]);
    remaining.set(id, remaining.get(id)! + 1);
    if (found) return found;
  }
  return null;
}

const moves = search(createGame(WIN, DIMENSIONS), []);
if (!moves) {
  console.error(`No move order found (${nodes} nodes)`);
  process.exit(1);
}
console.log(`${moves.length} moves, ${nodes} nodes`);
console.log(JSON.stringify(moves.map(({ row, col }) => [row, col])));
