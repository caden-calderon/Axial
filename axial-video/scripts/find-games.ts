// Plays the shipped AI against itself and keeps games whose finish reads well on camera:
// a decisive line that changes height, on a board busy enough to look like a real match.
// Usage (from axial-web/): see scripts/find-games.sh. Writes JSON lines to stdout.
import {
  applyMove,
  cellFromIndex,
  createGame,
  type BoardDimensions,
  type GameSnapshot,
  type WinCondition,
} from "@axial/core";
import {
  chooseMctsMove,
  chooseRandomMove,
  classicAiSearchOptionsForGame,
  createSeededRandom,
  type ClassicAiDifficulty,
} from "@axial/ai";

type Config = {
  name: string;
  dimensions: BoardDimensions;
  winCondition: WinCondition;
  difficulty: ClassicAiDifficulty;
  games: number;
  maxTimeMs: number;
};

const configs: Config[] = [
  {
    name: "classic",
    dimensions: { height: 6, rows: 6, columns: 7 },
    winCondition: { lineLength: 4, linesToWin: 1 },
    difficulty: (process.env.DIFFICULTY as ClassicAiDifficulty) ?? "medium",
    games: Number(process.env.GAMES ?? 12),
    maxTimeMs: Number(process.env.MAX_TIME ?? 260),
  },
  {
    name: "big-c5",
    dimensions: { height: 9, rows: 9, columns: 9 },
    winCondition: { lineLength: 5, linesToWin: 1 },
    difficulty: "medium",
    games: Number(process.env.GAMES_BIG ?? 4),
    maxTimeMs: 260,
  },
  {
    name: "two-lines",
    dimensions: { height: 6, rows: 7, columns: 8 },
    winCondition: { lineLength: 4, linesToWin: 2 },
    difficulty: "medium",
    games: Number(process.env.GAMES_LINES ?? 4),
    maxTimeMs: 260,
  },
  {
    name: "three-lines",
    dimensions: { height: 7, rows: 8, columns: 8 },
    winCondition: { lineLength: 4, linesToWin: 3 },
    difficulty: "medium",
    games: Number(process.env.GAMES_LINES ?? 4),
    maxTimeMs: 260,
  },
];

const only = process.env.ONLY?.split(",");

for (const config of configs) {
  if (only && !only.includes(config.name)) continue;
  for (let index = 0; index < config.games; index += 1) {
    let game: GameSnapshot = createGame(
      config.winCondition,
      config.dimensions,
      1,
    );
    const seedBase = Number(process.env.SEED ?? 1) * 1000 + index * 17;
    // A few random openings spread the games out; the AI otherwise races the same floor line.
    const random = createSeededRandom(seedBase);
    for (
      let opening = 0;
      opening < Number(process.env.RANDOM_OPENING ?? 0);
      opening += 1
    ) {
      const move = chooseRandomMove(game, random);
      if (move) game = applyMove(game, move);
    }
    while (game.status.state === "playing") {
      const options = classicAiSearchOptionsForGame(config.difficulty, game);
      const move = chooseMctsMove(game, {
        ...options,
        maxTimeMs: config.maxTimeMs,
        seed: seedBase + game.moveHistory.length,
      });
      if (!move) break;
      game = applyMove(game, move);
    }
    if (game.status.state !== "won") continue;
    const lines = game.completedLines.map((line) => ({
      player: line.player,
      direction: line.direction,
      cells: line.cells.map((cell) => cellFromIndex(cell, game.dimensions)),
    }));
    const last = game.moveHistory[game.moveHistory.length - 1];
    const finalLine = lines[lines.length - 1];
    const heights = new Set(finalLine.cells.map((cell) => cell.height));
    const maxStack =
      Math.max(...game.moveHistory.map((move) => move.height)) + 1;
    console.log(
      JSON.stringify({
        config: config.name,
        dimensions: config.dimensions,
        winCondition: config.winCondition,
        winner: game.status.winner,
        moveCount: game.moveHistory.length,
        finalHeightSpan: heights.size,
        finalMoveHeight: last.height,
        maxStack,
        lines,
        moves: game.moveHistory.map((move) => [move.row, move.col]),
      }),
    );
  }
}
