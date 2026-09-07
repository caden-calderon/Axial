import { describe, expect, it } from "vitest";
import {
  applyMove,
  CELL_COUNT,
  cellCount,
  createGame,
  indexOf,
  legalMoves,
  replayMoves,
  type BoardDimensions,
  type GameSnapshot,
} from "@axial/core";
import {
  CLASSIC_MOVES,
  ClassicSearchState,
  SEGMENT_AXIS_COUNTS,
  WINNING_SEGMENTS,
  analyzeHeuristicMove,
  analyzeMctsMove,
  classicAiSearchOptionsForGame,
  chooseHeuristicMove,
  chooseRandomMove,
  countLineCompletionsForMove,
  createSeededRandom,
  evaluatePosition,
  findLineCompletionMoves,
  getClassicMoves,
  getSegmentTable,
  moveCountForDimensions,
  moveFromIndex,
  moveToIndex,
  playAiMatch,
  runEvaluation,
  scoreMove,
  selectLookaheadMove,
} from "./index";

const LARGE_TEST_DIMENSIONS = {
  height: 7,
  rows: 8,
  columns: 9,
} as const satisfies BoardDimensions;

function gameFromSearchState(
  state: ClassicSearchState,
  currentPlayer: 1 | 2,
): GameSnapshot {
  return {
    ...createGame(state.winCondition, state.dimensions),
    board: state.board.slice(),
    currentPlayer,
    status: { state: "playing", currentPlayer },
  };
}

function createHeightOneForkSupportState(): ClassicSearchState {
  const state = new ClassicSearchState();

  state.makeMove(moveToIndex({ row: 2, col: 1 }), 2);
  state.makeMove(moveToIndex({ row: 2, col: 2 }), 1);
  state.makeMove(moveToIndex({ row: 2, col: 4 }), 2);
  state.makeMove(moveToIndex({ row: 2, col: 5 }), 1);
  state.makeMove(moveToIndex({ row: 2, col: 2 }), 1);
  state.makeMove(moveToIndex({ row: 2, col: 4 }), 1);

  return state;
}

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
      status: { state: "won", winner: 1, line: [], lines: [], lineCount: 0 },
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

  it("chooses legal random moves on a larger board", () => {
    expect(
      chooseRandomMove(
        createGame(undefined, LARGE_TEST_DIMENSIONS),
        () => 0.999999,
      ),
    ).toEqual({
      row: 7,
      col: 8,
    });
  });
});

describe("Classic AI geometry", () => {
  it("uses stable row-major policy move indices", () => {
    expect(CLASSIC_MOVES).toHaveLength(42);
    expect(moveFromIndex(0)).toEqual({ index: 0, row: 0, col: 0 });
    expect(moveFromIndex(3)).toEqual({ index: 3, row: 0, col: 3 });
    expect(moveFromIndex(41)).toEqual({ index: 41, row: 5, col: 6 });
    expect(moveToIndex({ row: 5, col: 6 })).toBe(41);
  });

  it("builds row-major policy geometry for larger boards", () => {
    expect(moveCountForDimensions(LARGE_TEST_DIMENSIONS)).toBe(72);
    expect(getClassicMoves(LARGE_TEST_DIMENSIONS)).toHaveLength(72);
    expect(moveFromIndex(71, LARGE_TEST_DIMENSIONS)).toEqual({
      index: 71,
      row: 7,
      col: 8,
    });
    expect(moveToIndex({ row: 7, col: 8 }, LARGE_TEST_DIMENSIONS)).toBe(71);
  });

  it("precomputes every Classic length-four winning segment", () => {
    expect(WINNING_SEGMENTS).toHaveLength(954);
    expect(SEGMENT_AXIS_COUNTS).toEqual({
      height: 126,
      row: 126,
      column: 144,
      "two-axis": 414,
      "three-axis": 144,
    });
  });

  it("precomputes Classic length-five winning segments separately", () => {
    const table = getSegmentTable(5);

    expect(table.segments).toHaveLength(524);
    expect(table.axisCounts).toEqual({
      height: 84,
      row: 84,
      column: 108,
      "two-axis": 200,
      "three-axis": 48,
    });
  });

  it("precomputes larger-board segment tables with matching cell coverage", () => {
    const table = getSegmentTable(4, LARGE_TEST_DIMENSIONS);

    expect(table.dimensions).toEqual(LARGE_TEST_DIMENSIONS);
    expect(table.segments.length).toBeGreaterThan(WINNING_SEGMENTS.length);
    expect(table.cellSegments).toHaveLength(cellCount(LARGE_TEST_DIMENSIONS));
  });
});

describe("Classic search state", () => {
  it("tracks gravity, make/unmake, and line wins incrementally", () => {
    const state = new ClassicSearchState();
    const moveIndex = moveToIndex({ row: 2, col: 3 });

    expect(state.dropCellIndex(moveIndex)).toBe(indexOf(0, 2, 3));
    state.makeMove(moveIndex, 1);
    expect(state.dropCellIndex(moveIndex)).toBe(indexOf(1, 2, 3));
    state.unmakeMove();
    expect(state.dropCellIndex(moveIndex)).toBe(indexOf(0, 2, 3));

    state.makeMove(moveToIndex({ row: 2, col: 0 }), 1);
    state.makeMove(moveToIndex({ row: 2, col: 1 }), 1);
    state.makeMove(moveToIndex({ row: 2, col: 2 }), 1);
    expect(state.winner).toBeNull();
    state.makeMove(moveToIndex({ row: 2, col: 3 }), 1);
    expect(state.winner).toBe(1);
    expect(state.winningLine).toHaveLength(4);
  });

  it("uses the configured line length when tracking wins", () => {
    const state = new ClassicSearchState(undefined, {
      lineLength: 5,
      linesToWin: 1,
    });

    state.makeMove(moveToIndex({ row: 2, col: 0 }), 1);
    state.makeMove(moveToIndex({ row: 2, col: 1 }), 1);
    state.makeMove(moveToIndex({ row: 2, col: 2 }), 1);
    state.makeMove(moveToIndex({ row: 2, col: 3 }), 1);
    expect(state.winner).toBeNull();

    state.makeMove(moveToIndex({ row: 2, col: 4 }), 1);
    expect(state.winner).toBe(1);
    expect(state.winningLine).toHaveLength(5);
  });

  it("counts a longer run as one completed line in multi-line mode", () => {
    const state = new ClassicSearchState(undefined, {
      lineLength: 4,
      linesToWin: 2,
    });

    state.makeMove(moveToIndex({ row: 2, col: 0 }), 1);
    state.makeMove(moveToIndex({ row: 2, col: 1 }), 1);
    state.makeMove(moveToIndex({ row: 2, col: 2 }), 1);
    state.makeMove(moveToIndex({ row: 2, col: 3 }), 1);

    expect(state.completedLineCount(1)).toBe(1);
    expect(
      countLineCompletionsForMove(state, moveToIndex({ row: 2, col: 4 }), 1),
    ).toBe(0);

    state.makeMove(moveToIndex({ row: 2, col: 4 }), 1);

    expect(state.completedLineCount(1)).toBe(1);
    expect(state.winner).toBeNull();
  });

  it("does not evaluate a five-cell run as two completed four-cell lines", () => {
    const state = new ClassicSearchState(undefined, {
      lineLength: 4,
      linesToWin: 2,
    });

    state.makeMove(moveToIndex({ row: 2, col: 0 }), 1);
    state.makeMove(moveToIndex({ row: 2, col: 1 }), 1);
    state.makeMove(moveToIndex({ row: 2, col: 2 }), 1);
    state.makeMove(moveToIndex({ row: 2, col: 3 }), 1);

    const beforeExtension = evaluatePosition(state, 1);
    const extensionMove = moveToIndex({ row: 2, col: 4 });
    expect(countLineCompletionsForMove(state, extensionMove, 1)).toBe(0);

    state.makeMove(extensionMove, 1);

    expect(state.completedLineCount(1)).toBe(1);
    expect(state.winner).toBeNull();
    expect(evaluatePosition(state, 1) - beforeExtension).toBeLessThan(10_000);
  });

  it("ranks productive new lines and excludes extensions of a banked line", () => {
    const state = new ClassicSearchState(undefined, {
      lineLength: 4,
      linesToWin: 2,
    });

    for (const col of [0, 1, 2, 3]) {
      state.makeMove(moveToIndex({ row: 2, col }), 1);
    }
    for (const col of [0, 1, 2]) {
      state.makeMove(moveToIndex({ row: 3, col }), 1);
    }

    const productiveMove = moveToIndex({ row: 3, col: 3 });
    const existingLineExtension = moveToIndex({ row: 2, col: 4 });
    const moves = findLineCompletionMoves(state, 1);

    expect(moves[0]).toEqual({ moveIndex: productiveMove, completions: 1 });
    expect(moves.some((move) => move.moveIndex === existingLineExtension)).toBe(
      false,
    );
  });

  it("can be constructed from canonical replay state", () => {
    const game = replayMoves([
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 0, col: 0 },
      { row: 1, col: 0 },
    ]);
    const state = ClassicSearchState.fromGame(game);

    expect(state.dropCellIndex(moveToIndex({ row: 0, col: 0 }))).toBe(
      indexOf(2, 0, 0),
    );
    expect(state.dropCellIndex(moveToIndex({ row: 1, col: 0 }))).toBe(
      indexOf(2, 1, 0),
    );
  });

  it("maintains deterministic incremental position hashes through clone and undo", () => {
    const state = new ClassicSearchState(undefined, {
      lineLength: 5,
      linesToWin: 3,
    });
    const initialKey = state.positionKey(1);

    state.makeMove(moveToIndex({ row: 2, col: 3 }), 1);
    const afterFirstMove = state.positionKey(2);
    state.makeMove(moveToIndex({ row: 2, col: 3 }), 2);
    const clone = state.clone();

    expect(afterFirstMove).not.toBe(initialKey);
    expect(clone.positionKey(1)).toBe(state.positionKey(1));
    state.unmakeMove();
    state.unmakeMove();
    expect(state.positionKey(1)).toBe(initialKey);
  });

  it("tracks gravity and wins on larger boards", () => {
    const state = new ClassicSearchState(
      undefined,
      undefined,
      LARGE_TEST_DIMENSIONS,
    );
    const moveIndex = moveToIndex({ row: 7, col: 8 }, LARGE_TEST_DIMENSIONS);

    expect(state.dropCellIndex(moveIndex)).toBe(
      indexOf(0, 7, 8, LARGE_TEST_DIMENSIONS),
    );
    state.makeMove(moveIndex, 1);
    expect(state.dropCellIndex(moveIndex)).toBe(
      indexOf(1, 7, 8, LARGE_TEST_DIMENSIONS),
    );
    state.unmakeMove();

    state.makeMove(moveToIndex({ row: 3, col: 0 }, LARGE_TEST_DIMENSIONS), 1);
    state.makeMove(moveToIndex({ row: 3, col: 1 }, LARGE_TEST_DIMENSIONS), 1);
    state.makeMove(moveToIndex({ row: 3, col: 2 }, LARGE_TEST_DIMENSIONS), 1);
    expect(state.winner).toBeNull();
    state.makeMove(moveToIndex({ row: 3, col: 3 }, LARGE_TEST_DIMENSIONS), 1);

    expect(state.winner).toBe(1);
    expect(state.winningLine).toHaveLength(4);
  });

  it("matches canonical completed-line state across generated custom-rule games", () => {
    const rules = [
      { lineLength: 4, linesToWin: 1 },
      { lineLength: 4, linesToWin: 2 },
      { lineLength: 4, linesToWin: 3 },
      { lineLength: 5, linesToWin: 1 },
      { lineLength: 5, linesToWin: 2 },
      { lineLength: 5, linesToWin: 3 },
    ];

    for (const rule of rules) {
      for (let seed = 1; seed <= 10; seed += 1) {
        const random = createSeededRandom(
          seed * 997 + rule.lineLength * 31 + rule.linesToWin,
        );
        let game = createGame(rule);

        while (game.status.state === "playing") {
          const moves = legalMoves(game.board, game.dimensions);
          const move = moves[Math.floor(random() * moves.length)];
          expect(move).toBeDefined();
          game = applyMove(game, move!);

          const searchState = ClassicSearchState.fromGame(game);
          for (const player of [1, 2] as const) {
            expect(searchState.completedLineCount(player)).toBe(
              game.completedLines.filter((line) => line.player === player)
                .length,
            );
          }
          expect(searchState.winner).toBe(
            game.status.state === "won" ? game.status.winner : null,
          );
        }
      }
    }
  });
});

describe("Classic heuristic AI", () => {
  it("chooses the planar center on an empty board", () => {
    expect(chooseHeuristicMove(createGame())).toEqual({ row: 2, col: 3 });
  });

  it("chooses a center-biased move on a larger board", () => {
    expect(
      chooseHeuristicMove(createGame(undefined, LARGE_TEST_DIMENSIONS)),
    ).toEqual({
      row: 3,
      col: 4,
    });
  });

  it("takes an immediate winning move", () => {
    const game = replayMoves([
      { row: 2, col: 0 },
      { row: 0, col: 0 },
      { row: 2, col: 1 },
      { row: 0, col: 1 },
      { row: 2, col: 2 },
      { row: 0, col: 2 },
    ]);
    const result = analyzeHeuristicMove(game);

    expect(result?.reason).toBe("win");
    expect(result?.move).toEqual({ row: 2, col: 3 });
  });

  it("takes an immediate connect-five winning move under custom rules", () => {
    const game = replayMoves(
      [
        { row: 2, col: 0 },
        { row: 0, col: 0 },
        { row: 2, col: 1 },
        { row: 0, col: 1 },
        { row: 2, col: 2 },
        { row: 0, col: 2 },
        { row: 2, col: 3 },
        { row: 0, col: 3 },
      ],
      { lineLength: 5, linesToWin: 1 },
    );
    const result = analyzeHeuristicMove(game);

    expect(result?.reason).toBe("win");
    expect(result?.move).toEqual({ row: 2, col: 4 });
  });

  it("takes immediate winning moves on larger boards", () => {
    const game = replayMoves(
      [
        { row: 3, col: 0 },
        { row: 0, col: 0 },
        { row: 3, col: 1 },
        { row: 0, col: 1 },
        { row: 3, col: 2 },
        { row: 0, col: 2 },
      ],
      undefined,
      LARGE_TEST_DIMENSIONS,
    );
    const result = analyzeHeuristicMove(game);

    expect(result?.reason).toBe("win");
    expect(result?.move).toEqual({ row: 3, col: 3 });
  });

  it("banks a non-terminal completed line in multi-line mode", () => {
    const game = replayMoves(
      [
        { row: 2, col: 0 },
        { row: 5, col: 6 },
        { row: 2, col: 1 },
        { row: 5, col: 5 },
        { row: 2, col: 2 },
        { row: 4, col: 6 },
      ],
      { lineLength: 4, linesToWin: 2 },
    );
    const state = ClassicSearchState.fromGame(game);
    const moveIndex = moveToIndex({ row: 2, col: 3 });
    const result = analyzeHeuristicMove(game);

    expect(countLineCompletionsForMove(state, moveIndex, 1)).toBe(1);
    expect(result?.move).toEqual({ row: 2, col: 3 });
  });

  it("blocks opponent line progress in multi-line mode", () => {
    const game = replayMoves(
      [
        { row: 0, col: 6 },
        { row: 2, col: 0 },
        { row: 1, col: 6 },
        { row: 2, col: 1 },
        { row: 0, col: 5 },
        { row: 2, col: 2 },
      ],
      { lineLength: 4, linesToWin: 2 },
    );
    const result = analyzeHeuristicMove(game);

    expect(result?.move).toEqual({ row: 2, col: 3 });
  });

  it("blocks an immediate opponent win", () => {
    const game = replayMoves([
      { row: 5, col: 6 },
      { row: 2, col: 0 },
      { row: 5, col: 5 },
      { row: 2, col: 1 },
      { row: 0, col: 6 },
      { row: 2, col: 2 },
    ]);
    const result = analyzeHeuristicMove(game);

    expect(result?.reason).toBe("block");
    expect(result?.move).toEqual({ row: 2, col: 3 });
  });

  it("blocks an opponent open-two fork before it becomes unblockable", () => {
    const game = replayMoves([
      { row: 2, col: 2 },
      { row: 0, col: 0 },
      { row: 2, col: 3 },
    ]);
    const result = analyzeHeuristicMove(game);

    expect(result?.reason).toBe("block-forcing");
    expect(result?.move).toEqual(expect.objectContaining({ row: 2 }));
    expect([1, 4]).toContain(result?.move.col);
  });

  it("blocks open-ended fork setups on larger boards", () => {
    const game = replayMoves(
      [
        { row: 3, col: 3 },
        { row: 0, col: 0 },
        { row: 3, col: 4 },
      ],
      undefined,
      LARGE_TEST_DIMENSIONS,
    );
    const result = analyzeHeuristicMove(game);

    expect(result?.reason).toBe("block-forcing");
    expect(result?.move).toEqual(expect.objectContaining({ row: 3 }));
    expect([2, 5]).toContain(result?.move.col);
  });

  it("blocks connect-five fork setups before four-in-a-row becomes unblockable", () => {
    const game = replayMoves(
      [
        { row: 2, col: 2 },
        { row: 0, col: 0 },
        { row: 2, col: 3 },
        { row: 0, col: 1 },
        { row: 2, col: 4 },
      ],
      { lineLength: 5, linesToWin: 1 },
    );
    const result = analyzeHeuristicMove(game);

    expect(result?.reason).toBe("block-forcing");
    expect(result?.move).toEqual(expect.objectContaining({ row: 2 }));
    expect([1, 5]).toContain(result?.move.col);
  });

  it("prefers completing a separate second line over extending an existing line", () => {
    const state = new ClassicSearchState(undefined, {
      lineLength: 4,
      linesToWin: 2,
    });

    state.makeMove(moveToIndex({ row: 2, col: 0 }), 1);
    state.makeMove(moveToIndex({ row: 2, col: 1 }), 1);
    state.makeMove(moveToIndex({ row: 2, col: 2 }), 1);
    state.makeMove(moveToIndex({ row: 2, col: 3 }), 1);
    state.makeMove(moveToIndex({ row: 3, col: 0 }), 1);
    state.makeMove(moveToIndex({ row: 3, col: 1 }), 1);
    state.makeMove(moveToIndex({ row: 3, col: 2 }), 1);

    const extension = scoreMove(state, moveToIndex({ row: 2, col: 4 }), 1);
    const separateLine = scoreMove(state, moveToIndex({ row: 3, col: 3 }), 1);

    expect(extension.score).toBeLessThan(separateLine.score);
  });
});

describe("Classic tactical lookahead", () => {
  it("avoids filling support for an opponent height-one fork", () => {
    const state = createHeightOneForkSupportState();
    const dangerousSupport = moveToIndex({ row: 2, col: 3 });

    const result = selectLookaheadMove(state, 2, {
      depth: 2,
      maxMoves: 10,
      rootMaxMoves: 14,
    });

    expect(result?.moveIndex).not.toBe(dangerousSupport);
    expect(result?.candidates[0]?.score).toBeGreaterThan(
      result?.candidates.find(
        (candidate) => candidate.moveIndex === dangerousSupport,
      )?.score ?? Number.NEGATIVE_INFINITY,
    );
  });

  it("shares a bounded node budget across every root candidate", () => {
    const result = selectLookaheadMove(
      ClassicSearchState.fromGame(createGame({ lineLength: 4, linesToWin: 2 })),
      1,
      {
        depth: 4,
        maxMoves: 6,
        rootMaxMoves: 4,
        nodeLimit: 40,
      },
    );

    expect(result?.candidates).toHaveLength(4);
    expect(result?.candidates.every((candidate) => candidate.nodes > 0)).toBe(
      true,
    );
    expect(result?.nodes).toBeLessThanOrEqual(40);
    expect(result?.depth).toBe(4);
    expect(result?.completedDepth).toBeGreaterThanOrEqual(1);
    expect(
      result?.candidates.every(
        (candidate) => candidate.completedDepth === result.completedDepth,
      ),
    ).toBe(true);
    expect(result?.complete).toBe(false);
  });
});

describe("Classic MCTS AI", () => {
  it("separates difficulty capabilities and scales custom-rule budgets", () => {
    const standard = createGame();
    const multiLine = createGame({ lineLength: 4, linesToWin: 2 });
    const easy = classicAiSearchOptionsForGame("easy", standard);
    const hard = classicAiSearchOptionsForGame("hard", standard);
    const max = classicAiSearchOptionsForGame("nightmare", standard);
    const multiLineMax = classicAiSearchOptionsForGame("nightmare", multiLine);

    expect(easy.tacticalMode).toBe("immediate-only");
    expect(easy.progressiveWidening).toBe(false);
    expect(hard.tacticalMode).toBe("forced-only");
    expect(hard.progressiveWidening).toBe(true);
    expect(max.simulations).toBeGreaterThan(hard.simulations!);
    expect(max.maxTimeMs).toBeGreaterThan(hard.maxTimeMs!);
    expect(multiLineMax.simulations).toBeGreaterThan(max.simulations!);
    expect(multiLineMax.maxTimeMs).toBeGreaterThan(max.maxTimeMs!);
  });

  it("deepens and strengthens Max lookahead as cumulative-line targets rise", () => {
    const standard = classicAiSearchOptionsForGame(
      "nightmare",
      createGame({ lineLength: 4, linesToWin: 1 }),
    );
    const twoLines = classicAiSearchOptionsForGame(
      "nightmare",
      createGame({ lineLength: 4, linesToWin: 2 }),
    );
    const threeLines = classicAiSearchOptionsForGame(
      "nightmare",
      createGame({ lineLength: 4, linesToWin: 3 }),
    );

    expect(standard.lookaheadDepth).toBe(3);
    expect(twoLines.lookaheadDepth).toBe(4);
    expect(threeLines.lookaheadDepth).toBe(5);
    expect(twoLines.lookaheadWeight).toBeGreaterThan(standard.lookaheadWeight!);
    expect(threeLines.lookaheadOverrideMargin).toBeLessThan(
      twoLines.lookaheadOverrideMargin!,
    );
    expect(threeLines.lookaheadTimeFraction).toBeGreaterThan(
      twoLines.lookaheadTimeFraction!,
    );
    expect(standard.minimumSearchDepth).toBe(3);
    expect(twoLines.minimumSearchDepth).toBe(3);
  });

  it.each([
    { lineLength: 4, linesToWin: 2 },
    { lineLength: 4, linesToWin: 3 },
    { lineLength: 5, linesToWin: 2 },
    { lineLength: 5, linesToWin: 3 },
  ])(
    "banks an uncontested first line in a $lineLength/$linesToWin Max search",
    ({ lineLength, linesToWin }) => {
      const state = new ClassicSearchState(undefined, {
        lineLength,
        linesToWin,
      });
      for (let col = 0; col < lineLength - 1; col += 1) {
        state.makeMove(moveToIndex({ row: 2, col }), 1);
      }
      const game = gameFromSearchState(state, 1);
      const result = analyzeMctsMove(game, {
        ...classicAiSearchOptionsForGame("nightmare", game),
        simulations: 600,
        maxTimeMs: 500,
        seed: 71,
      });

      expect(result?.move).toEqual({ row: 2, col: lineLength - 1 });
    },
  );

  it("keeps the strategic line-banking floor on expanded boards at zero budget", () => {
    const state = new ClassicSearchState(
      undefined,
      { lineLength: 5, linesToWin: 3 },
      LARGE_TEST_DIMENSIONS,
    );
    for (let col = 0; col < 4; col += 1) {
      state.makeMove(moveToIndex({ row: 3, col }, LARGE_TEST_DIMENSIONS), 1);
    }
    const game = gameFromSearchState(state, 1);
    const result = analyzeMctsMove(game, {
      ...classicAiSearchOptionsForGame("nightmare", game),
      simulations: 0,
      maxTimeMs: 0,
      seed: 79,
    });

    expect(result?.reason).toBe("heuristic");
    expect(result?.simulations).toBe(0);
    expect(result?.move).toEqual({ row: 3, col: 4 });
  });

  it("searches the former three-line guard position instead of forcing one line block", () => {
    const game = replayMoves(
      [
        { row: 2, col: 3 },
        { row: 2, col: 3 },
        { row: 2, col: 3 },
        { row: 2, col: 3 },
        { row: 3, col: 3 },
        { row: 3, col: 3 },
        { row: 1, col: 3 },
        { row: 4, col: 3 },
        { row: 0, col: 3 },
        { row: 1, col: 3 },
        { row: 4, col: 3 },
        { row: 0, col: 3 },
        { row: 2, col: 2 },
        { row: 2, col: 4 },
        { row: 3, col: 1 },
      ],
      { lineLength: 4, linesToWin: 3 },
    );
    const result = analyzeMctsMove(game, {
      simulations: 80,
      lookaheadDepth: 2,
      lookaheadMaxMoves: 10,
      lookaheadRootMaxMoves: 14,
      lookaheadNodeLimit: 1_000,
      minimumSearchDepth: 2,
      progressiveWidening: true,
      seed: 3_867,
    });

    expect(result?.reason).not.toBe("tactical");
    expect(result?.simulations).toBeGreaterThan(0);
    expect(result?.lookaheadCompletedDepth).toBeGreaterThan(0);
  });

  it("bounds lookahead and MCTS under one end-to-end decision budget", () => {
    const game = createGame({ lineLength: 5, linesToWin: 3 });
    const startedAt = performance.now();
    const result = analyzeMctsMove(game, {
      simulations: 100_000,
      maxTimeMs: 80,
      lookaheadDepth: 5,
      lookaheadMaxMoves: 12,
      lookaheadRootMaxMoves: 18,
      lookaheadNodeLimit: 1_000_000,
      lookaheadTimeFraction: 0.5,
      seed: 97,
    });
    const wallTimeMs = performance.now() - startedAt;

    expect(result?.elapsedMs).toBeLessThan(300);
    expect(wallTimeMs).toBeLessThan(500);
    expect(Math.abs(wallTimeMs - result!.elapsedMs)).toBeLessThan(80);
  });

  it("returns tactical wins without spending simulations", () => {
    const game = replayMoves([
      { row: 2, col: 0 },
      { row: 0, col: 0 },
      { row: 2, col: 1 },
      { row: 0, col: 1 },
      { row: 2, col: 2 },
      { row: 0, col: 2 },
    ]);
    const result = analyzeMctsMove(game, { simulations: 20, seed: 7 });

    expect(result?.reason).toBe("tactical");
    expect(result?.simulations).toBe(0);
    expect(result?.stopReason).toBe("tactical");
    expect(result?.maxDepth).toBe(0);
    expect(result?.move).toEqual({ row: 2, col: 3 });
  });

  it("respects an opponent fork block as a tactical move", () => {
    const game = replayMoves([
      { row: 2, col: 2 },
      { row: 0, col: 0 },
      { row: 2, col: 3 },
    ]);
    const result = analyzeMctsMove(game, {
      simulations: 220,
      seed: 7,
      useRave: true,
      smartRolloutRate: 0.76,
      earlyExitVisits: 140,
      earlyExitRatio: 0.94,
    });

    expect(result?.reason).toBe("tactical");
    expect(result?.simulations).toBe(0);
    expect(result?.move).toEqual(expect.objectContaining({ row: 2 }));
    expect([1, 4]).toContain(result?.move.col);
  });

  it("uses the tactical fork gate on expanded boards", () => {
    const game = replayMoves(
      [
        { row: 3, col: 3 },
        { row: 0, col: 0 },
        { row: 3, col: 4 },
      ],
      undefined,
      LARGE_TEST_DIMENSIONS,
    );
    const result = analyzeMctsMove(game, {
      simulations: 40,
      seed: 11,
      useRave: true,
    });

    expect(result?.reason).toBe("tactical");
    expect(result?.simulations).toBe(0);
    expect(result?.move).toEqual(expect.objectContaining({ row: 3 }));
    expect([2, 5]).toContain(result?.move.col);
  });

  it("uses lookahead to avoid enabling next-turn gravity forks", () => {
    const state = createHeightOneForkSupportState();
    const dangerousSupport = moveToIndex({ row: 2, col: 3 });

    const result = analyzeMctsMove(gameFromSearchState(state, 2), {
      simulations: 80,
      seed: 19,
      useRave: true,
      progressiveBias: 0.24,
      lookaheadDepth: 2,
      lookaheadMaxMoves: 10,
      lookaheadRootMaxMoves: 14,
      lookaheadWeight: 0.7,
      lookaheadOverrideMargin: 1,
    });

    expect(result?.moveIndex).not.toBe(dangerousSupport);
  });

  it("runs deterministic seeded search on quiet positions", () => {
    const first = analyzeMctsMove(createGame(), {
      simulations: 40,
      seed: 123,
      useRave: true,
    });
    const second = analyzeMctsMove(createGame(), {
      simulations: 40,
      seed: 123,
      useRave: true,
    });

    expect(first?.move).toEqual(second?.move);
    expect(first?.simulations).toBe(40);
    expect(first?.stats[0]?.visits).toBeGreaterThan(0);
    expect(first?.rootChildren).toBeLessThan(42);
    expect(first?.maxDepth).toBeGreaterThan(1);
    expect(first?.stopReason).toBe("simulations");
    expect(first?.telemetry.selectedMoveDepth).toBe(
      first?.stats.find((stat) => stat.moveIndex === first.moveIndex)?.maxDepth,
    );
  });

  it("caps rollout plies and backs up a non-terminal horizon value", () => {
    const result = analyzeMctsMove(
      createGame({ lineLength: 5, linesToWin: 3 }),
      {
        simulations: 40,
        lookaheadDepth: 0,
        rolloutMaxMoves: 5,
        minimumSearchDepth: 0,
        earlyExitVisits: 1_000,
        tacticalMode: "immediate-only",
        seed: 211,
      },
    );

    expect(result?.simulations).toBe(40);
    expect(result?.telemetry.maxRolloutMoves).toBeLessThanOrEqual(5);
    expect(result?.telemetry.rolloutMoves).toBeLessThanOrEqual(200);
    expect(result?.stats.some((stat) => stat.value > 0)).toBe(true);
  });

  it("runs seeded search on larger boards with legal move indices", () => {
    const result = analyzeMctsMove(
      createGame(undefined, LARGE_TEST_DIMENSIONS),
      {
        simulations: 8,
        seed: 123,
        useRave: true,
      },
    );

    expect(result?.move.row).toBeGreaterThanOrEqual(0);
    expect(result?.move.row).toBeLessThan(LARGE_TEST_DIMENSIONS.rows);
    expect(result?.move.col).toBeGreaterThanOrEqual(0);
    expect(result?.move.col).toBeLessThan(LARGE_TEST_DIMENSIONS.columns);
    expect(result?.moveIndex).toBe(
      moveToIndex(result!.move, LARGE_TEST_DIMENSIONS),
    );
  });
});

describe("AI evaluation harness", () => {
  it("plays a seeded AI match to a legal result", () => {
    const result = playAiMatch({
      seed: 9,
      players: {
        1: (game) => chooseHeuristicMove(game),
        2: (game, random) => chooseRandomMove(game, random),
      },
    });

    expect(result.illegalMoveBy).toBeNull();
    expect(result.moves.length).toBeGreaterThan(0);
    expect([0, 1, 2]).toContain(result.winner);
  });

  it("summarizes repeated evaluations", () => {
    const result = runEvaluation({
      games: 4,
      seed: 21,
      players: {
        1: (game) => chooseHeuristicMove(game),
        2: (game, random) => chooseRandomMove(game, random),
      },
    });

    expect(result.games).toBe(4);
    expect(result.illegalMoves).toBe(0);
    expect(
      result.playerOneWins +
        result.playerTwoWins +
        result.draws +
        result.truncations,
    ).toBe(4);
  });

  it("evaluates custom rules, dimensions, and starting players", () => {
    const result = playAiMatch({
      seed: 29,
      winCondition: { lineLength: 4, linesToWin: 2 },
      dimensions: LARGE_TEST_DIMENSIONS,
      startingPlayer: 2,
      maxMoves: 24,
      players: {
        1: (game) => chooseHeuristicMove(game),
        2: (game, random) => chooseRandomMove(game, random),
      },
    });

    expect(result.illegalMoveBy).toBeNull();
    expect(result.finalGame.winCondition).toEqual({
      lineLength: 4,
      linesToWin: 2,
    });
    expect(result.finalGame.dimensions).toEqual(LARGE_TEST_DIMENSIONS);
    expect(result.finalGame.moveHistory[0]?.player).toBe(2);
    expect(["win", "draw", "truncated"]).toContain(result.outcome);
    expect(result.terminal).toBe(result.outcome !== "truncated");
  });

  it("distinguishes a move-cap truncation from a terminal draw", () => {
    const result = playAiMatch({
      seed: 37,
      maxMoves: 1,
      players: {
        1: (game, random) => chooseRandomMove(game, random),
        2: (game, random) => chooseRandomMove(game, random),
      },
    });

    expect(result.winner).toBe(0);
    expect(result.outcome).toBe("truncated");
    expect(result.terminal).toBe(false);
  });

  it("keeps returned moves compatible with the canonical core", () => {
    let game = createGame();
    const random = createSeededRandom(33);

    for (
      let turn = 0;
      turn < 12 && game.status.state === "playing";
      turn += 1
    ) {
      const move =
        game.currentPlayer === 1
          ? chooseHeuristicMove(game)
          : chooseRandomMove(game, random);
      expect(move).not.toBeNull();
      game = applyMove(game, move!);
    }

    expect(game.moveHistory.length).toBeGreaterThan(0);
    expect(game.moveHistory.length).toBeLessThanOrEqual(12);
  });
});
