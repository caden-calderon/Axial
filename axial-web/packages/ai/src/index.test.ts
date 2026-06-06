import { describe, expect, it } from "vitest";
import { CELL_COUNT, createGame, type GameSnapshot } from "@axial/core";
import { chooseRandomMove } from "./index";

describe("Axial AI move selection", () => {
  it("chooses the first legal move at the bottom of the random range", () => {
    expect(chooseRandomMove(createGame(), () => 0)).toEqual({ row: 0, col: 0 });
  });

  it("chooses the last legal move at the top of the random range", () => {
    expect(chooseRandomMove(createGame(), () => 0.999999)).toEqual({
      row: 5,
      col: 6,
    });
  });

  it("clamps invalid random values into the legal move range", () => {
    expect(chooseRandomMove(createGame(), () => Number.NaN)).toEqual({
      row: 0,
      col: 0,
    });
    expect(chooseRandomMove(createGame(), () => 4)).toEqual({ row: 5, col: 6 });
  });

  it("returns null when the game is over", () => {
    const game: GameSnapshot = {
      ...createGame(),
      status: { state: "won", winner: 1, line: [] },
    };

    expect(chooseRandomMove(game, () => 0)).toBeNull();
  });

  it("returns null when no legal moves remain", () => {
    const game: GameSnapshot = {
      ...createGame(),
      board: new Uint8Array(CELL_COUNT).fill(1),
    };

    expect(chooseRandomMove(game, () => 0)).toBeNull();
  });
});
