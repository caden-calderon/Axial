import {
  findCompletedLineSegments,
  type BoardDimensions,
  type Player,
  type WinCondition,
} from "@axial/core";
import { describe, expect, it } from "vitest";
import { ClassicSearchState, createSeededRandom, moveToIndex } from "./index";

const PARITY_CASES: readonly {
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
    dimensions: { height: 7, rows: 6, columns: 10 },
    winCondition: { lineLength: 4, linesToWin: 3 },
  },
  {
    dimensions: { height: 9, rows: 8, columns: 10 },
    winCondition: { lineLength: 5, linesToWin: 2 },
  },
];

function coreLineCount(state: ClassicSearchState, player: Player): number {
  return findCompletedLineSegments(
    state.board,
    state.winCondition,
    player,
    state.dimensions,
  ).length;
}

describe("incremental search-state line counting", () => {
  for (const { dimensions, winCondition } of PARITY_CASES) {
    it(`matches a full rebuild and core scoring on ${dimensions.height}x${dimensions.rows}x${dimensions.columns}, connect ${winCondition.lineLength} x${winCondition.linesToWin}`, () => {
      const random = createSeededRandom(
        dimensions.columns * 97 + winCondition.linesToWin,
      );

      for (let game = 0; game < 12; game += 1) {
        const state = new ClassicSearchState(
          undefined,
          winCondition,
          dimensions,
        );
        let player: Player = 1;

        while (state.winner === null && !state.isDraw()) {
          const moves = state.legalMoveIndices();
          state.makeMove(moves[Math.floor(random() * moves.length)]!, player);
          player = player === 1 ? 2 : 1;

          const rebuilt = new ClassicSearchState(
            state.board,
            winCondition,
            dimensions,
          );
          for (const side of [1, 2] as const) {
            expect(state.completedLineCount(side)).toBe(
              rebuilt.completedLineCount(side),
            );
            expect(state.completedLineCount(side)).toBe(
              coreLineCount(state, side),
            );
          }
          expect(state.winner).toBe(rebuilt.winner);
        }

        const playedMoves = state.moveStack.length;
        for (let move = 0; move < playedMoves; move += 1) state.unmakeMove();
        expect(state.completedLineCount(1)).toBe(0);
        expect(state.completedLineCount(2)).toBe(0);
        expect(state.winner).toBeNull();
        expect([state.hashA, state.hashB]).toEqual([0, 0]);
      }
    });
  }

  it("counts two runs joined by one piece as a single line, and restores both on unmake", () => {
    const dimensions = { height: 6, rows: 6, columns: 10 };
    const state = new ClassicSearchState(
      undefined,
      { lineLength: 4, linesToWin: 3 },
      dimensions,
    );
    const floor = (col: number) => moveToIndex({ row: 0, col }, dimensions);

    for (const col of [0, 1, 2, 3, 5, 6, 7, 8]) state.makeMove(floor(col), 1);
    expect(state.completedLineCount(1)).toBe(2);
    expect(coreLineCount(state, 1)).toBe(2);

    state.makeMove(floor(4), 1);
    expect(state.completedLineCount(1)).toBe(1);
    expect(coreLineCount(state, 1)).toBe(1);
    expect(state.winningLines).toBeNull();

    state.unmakeMove();
    expect(state.completedLineCount(1)).toBe(2);
  });

  it("builds the winner's lines on demand", () => {
    const state = new ClassicSearchState();
    for (const col of [0, 1, 2]) {
      state.makeMove(moveToIndex({ row: 2, col }), 1);
      state.makeMove(moveToIndex({ row: 0, col }), 2);
    }
    expect(state.winningLine).toBeNull();
    state.makeMove(moveToIndex({ row: 2, col: 3 }), 1);
    expect(state.winner).toBe(1);
    expect(state.winningLines).toHaveLength(1);
    expect(state.winningLine).toHaveLength(4);
  });
});
