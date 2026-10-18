import { describe, expect, it } from "vitest";
import {
  applyMove,
  createGame,
  findCompletedLineSegments,
  legalMoves,
  replayMoves,
  type BoardDimensions,
  type WinCondition,
} from "./index";

const CASES: readonly {
  dimensions: BoardDimensions;
  winCondition: WinCondition;
}[] = [
  {
    dimensions: { height: 6, rows: 6, columns: 7 },
    winCondition: { lineLength: 4, linesToWin: 1 },
  },
  {
    dimensions: { height: 6, rows: 6, columns: 7 },
    winCondition: { lineLength: 4, linesToWin: 3 },
  },
  {
    dimensions: { height: 6, rows: 6, columns: 10 },
    winCondition: { lineLength: 4, linesToWin: 3 },
  },
  {
    dimensions: { height: 9, rows: 8, columns: 10 },
    winCondition: { lineLength: 5, linesToWin: 3 },
  },
];

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

describe("incremental completed-line scoring", () => {
  for (const { dimensions, winCondition } of CASES) {
    it(`matches a full-board scan at every move on ${dimensions.height}x${dimensions.rows}x${dimensions.columns}, connect ${winCondition.lineLength} x${winCondition.linesToWin}`, () => {
      const random = seededRandom(
        dimensions.columns * 31 + winCondition.linesToWin,
      );
      for (let gameIndex = 0; gameIndex < 10; gameIndex += 1) {
        let game = createGame(winCondition, dimensions);
        while (game.status.state === "playing") {
          const moves = legalMoves(game.board, game.dimensions);
          game = applyMove(game, moves[Math.floor(random() * moves.length)]!);
          expect(game.completedLines).toEqual(
            findCompletedLineSegments(
              game.board,
              game.winCondition,
              undefined,
              game.dimensions,
            ),
          );
        }
      }
    });
  }

  it("joins two scored runs into one line when the gap between them fills", () => {
    const dimensions = { height: 6, rows: 6, columns: 10 };
    const rule = { lineLength: 4, linesToWin: 3 };
    // Player 1 builds floor runs at columns 0-3 and 5-8 of row 0; player 2 plays row 5.
    const moves = [0, 1, 2, 3, 5, 6, 7].flatMap((col, index) => [
      { row: 0, col },
      { row: 5, col: index },
    ]);
    let game = replayMoves([...moves, { row: 0, col: 8 }], rule, dimensions);
    expect(
      game.completedLines.filter((line) => line.player === 1),
    ).toHaveLength(2);

    game = applyMove(applyMove(game, { row: 5, col: 9 }), { row: 0, col: 4 });
    const joined = game.completedLines.filter((line) => line.player === 1);
    expect(joined).toHaveLength(1);
    expect(joined[0]!.cells).toHaveLength(9);
    expect(game.completedLines).toEqual(
      findCompletedLineSegments(game.board, rule, undefined, dimensions),
    );
  });
});
