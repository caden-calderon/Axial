import { describe, expect, it } from "vitest";
import { createGame, replayMoves } from "@axial/core";
import {
  ClassicSearchState,
  analyzeMctsMove,
  countLineCompletionsForMove,
  evaluateFastPosition,
  findForcingMoves,
  findWinningMoves,
  moveToIndex,
  selectLookaheadMove,
} from "./index";

describe("Classic threat safety", () => {
  it("does not call a fork forced when its support lets the opponent win first", () => {
    const game = replayMoves([
      { row: 2, col: 1 },
      { row: 3, col: 3 },
      { row: 2, col: 2 },
      { row: 3, col: 3 },
      { row: 4, col: 3 },
      { row: 4, col: 3 },
      { row: 0, col: 0 },
      { row: 5, col: 3 },
      { row: 0, col: 6 },
      { row: 5, col: 3 },
    ]);
    const state = ClassicSearchState.fromGame(game);
    const trap = moveToIndex({ row: 2, col: 3 });
    expect(findWinningMoves(state, 2)).toEqual([]);
    state.makeMove(trap, 1);
    expect(findWinningMoves(state, 1)).toHaveLength(2);
    expect(findWinningMoves(state, 2)).toContain(trap);
    state.unmakeMove();

    expect(
      findForcingMoves(state, 1).map((move) => move.moveIndex),
    ).not.toContain(trap);
    const result = analyzeMctsMove(game, {
      simulations: 0,
      lookaheadDepth: 1,
      lookaheadRootMaxMoves: 42,
      lookaheadNodeLimit: 5_000,
    });
    expect(result?.moveIndex).not.toBe(trap);
  });

  it("does not reward tempo for an extension of an already banked maximal run", () => {
    const state = new ClassicSearchState(undefined, {
      lineLength: 4,
      linesToWin: 2,
    });
    for (const col of [0, 1, 2, 3])
      state.makeMove(moveToIndex({ row: 2, col }), 1);
    expect(
      countLineCompletionsForMove(state, moveToIndex({ row: 2, col: 4 }), 1),
    ).toBe(0);
    expect(findWinningMoves(state, 1)).toEqual([]);
    expect(evaluateFastPosition(state, 1, 1)).toBe(
      evaluateFastPosition(state, 1, 2),
    );
  });

  it("does not prove a fork loss while a forcing counterthreat postpones it", () => {
    const state = ClassicSearchState.fromGame(createGame());
    for (const col of [0, 1]) state.makeMove(moveToIndex({ row: 0, col }), 1);
    for (const move of [
      { row: 2, col: 1 },
      { row: 2, col: 2 },
      { row: 5, col: 1 },
    ]) {
      state.makeMove(moveToIndex(move), 2);
    }
    const setup = moveToIndex({ row: 5, col: 2 });
    const defense = moveToIndex({ row: 0, col: 2 });
    state.makeMove(setup, 2);
    const forks = findForcingMoves(state, 2).filter(
      (move) => move.kind === "fork",
    );
    expect(forks.length).toBeGreaterThan(1);
    expect(forks.map((move) => move.moveIndex)).not.toContain(defense);
    state.makeMove(defense, 1);
    expect(
      findForcingMoves(state, 2).filter((move) => move.kind === "fork"),
    ).toEqual([]);
    state.unmakeMove();
    state.unmakeMove();

    const result = selectLookaheadMove(state, 2, {
      depth: 1,
      rootMaxMoves: 42,
      nodeLimit: 10_000,
      quiescenceDepth: 2,
    });
    expect(result?.complete).toBe(true);
    expect(
      result?.candidates.find((candidate) => candidate.moveIndex === setup)
        ?.score,
    ).toBeLessThan(1_000_000);
  });
});
