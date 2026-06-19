import { describe, expect, it } from "vitest";
import {
  BOARD_COLUMNS,
  BOARD_HEIGHT,
  BOARD_ROWS,
  BLOCKER_CELL,
  DEFAULT_BOARD_DIMENSIONS,
  DEFAULT_WIN_CONDITION,
  MATCH_CONFIGS,
  applyBlocker,
  applyDoubleAdjacentFirst,
  applyDoubleAdjacentSecond,
  applyMove,
  areCellsAdjacent,
  cellFromIndex,
  cellCount,
  createGame,
  findCompletedLines,
  getPendingDoubleAdjacentOrigin,
  getDropHeight,
  indexOf,
  isLegalDoubleAdjacentMove,
  legalMoves,
  normalizeBoardDimensions,
  replayMoves,
} from "./index";

describe("Axial game core", () => {
  it("describes the classic match with the current board constants", () => {
    expect(MATCH_CONFIGS.classic).toEqual({
      mode: "classic",
      board: {
        height: BOARD_HEIGHT,
        rows: BOARD_ROWS,
        columns: BOARD_COLUMNS,
      },
      defaultWinCondition: DEFAULT_WIN_CONDITION,
      specialPieceSlots: 0,
    });
  });

  it("describes tactical mode with three special-piece slots", () => {
    expect(MATCH_CONFIGS.tactical).toEqual({
      mode: "tactical",
      board: {
        height: BOARD_HEIGHT,
        rows: BOARD_ROWS,
        columns: BOARD_COLUMNS,
      },
      defaultWinCondition: DEFAULT_WIN_CONDITION,
      specialPieceSlots: 3,
    });
  });

  it("round trips coordinates through the flat index", () => {
    for (let col = 0; col < BOARD_COLUMNS; col += 1) {
      for (let row = 0; row < BOARD_ROWS; row += 1) {
        for (let height = 0; height < BOARD_HEIGHT; height += 1) {
          expect(cellFromIndex(indexOf(height, row, col))).toEqual({
            height,
            row,
            col,
          });
        }
      }
    }
  });

  it("starts with 42 playable columns", () => {
    const game = createGame();

    expect(legalMoves(game.board)).toHaveLength(BOARD_ROWS * BOARD_COLUMNS);
  });

  it("creates and replays larger configured boards", () => {
    const dimensions = normalizeBoardDimensions({
      height: 7,
      rows: 8,
      columns: 9,
    });
    let game = createGame(DEFAULT_WIN_CONDITION, dimensions);

    expect(game.dimensions).toEqual(dimensions);
    expect(game.board).toHaveLength(cellCount(dimensions));
    expect(legalMoves(game.board, dimensions)).toHaveLength(
      dimensions.rows * dimensions.columns,
    );

    game = applyMove(game, { row: 7, col: 8 });

    expect(game.moveHistory[0]).toMatchObject({ height: 0, row: 7, col: 8 });

    const replayed = replayMoves(
      game.moveHistory.map(({ row, col }) => ({ row, col })),
      DEFAULT_WIN_CONDITION,
      dimensions,
    );

    expect(replayed.dimensions).toEqual(dimensions);
    expect(replayed.moveHistory[0]).toMatchObject({
      height: 0,
      row: 7,
      col: 8,
    });
  });

  it("uses gravity when stacking pieces", () => {
    let game = createGame();

    game = applyMove(game, { row: 2, col: 3 });
    game = applyMove(game, { row: 2, col: 3 });

    expect(game.moveHistory[0]).toMatchObject({
      height: 0,
      row: 2,
      col: 3,
      player: 1,
    });
    expect(game.moveHistory[1]).toMatchObject({
      height: 1,
      row: 2,
      col: 3,
      player: 2,
    });
    expect(getDropHeight(game.board, { row: 2, col: 3 })).toBe(2);
  });

  it("can start a match with player two", () => {
    let game = createGame(DEFAULT_WIN_CONDITION, DEFAULT_BOARD_DIMENSIONS, 2);

    expect(game.currentPlayer).toBe(2);
    expect(game.status).toEqual({ state: "playing", currentPlayer: 2 });

    game = applyMove(game, { row: 2, col: 3 });
    const replayed = replayMoves(
      [{ row: 2, col: 3 }],
      DEFAULT_WIN_CONDITION,
      DEFAULT_BOARD_DIMENSIONS,
      2,
    );

    expect(game.moveHistory[0]).toMatchObject({ player: 2 });
    expect(replayed.moveHistory[0]).toMatchObject({ player: 2 });
    expect(replayed.currentPlayer).toBe(1);
  });

  it("places blockers as neutral occupied cells without advancing the turn", () => {
    let game = createGame();

    game = applyBlocker(game, { row: 2, col: 3 });

    expect(game.currentPlayer).toBe(1);
    expect(game.status).toEqual({ state: "playing", currentPlayer: 1 });
    expect(game.moveHistory[0]).toMatchObject({
      height: 0,
      row: 2,
      col: 3,
      player: 1,
      kind: "blocker",
    });
    expect(game.board[indexOf(0, 2, 3)]).toBe(BLOCKER_CELL);
    expect(getDropHeight(game.board, { row: 2, col: 3 })).toBe(1);

    game = applyMove(game, { row: 2, col: 3 });

    expect(game.currentPlayer).toBe(2);
    expect(game.moveHistory[1]).toMatchObject({
      height: 1,
      row: 2,
      col: 3,
      player: 1,
      kind: "piece",
    });
  });

  it("replays canonical column moves into the same state", () => {
    let game = createGame();
    const moves = [
      { row: 2, col: 3 },
      { row: 2, col: 3 },
      { row: 4, col: 1 },
      { row: 0, col: 6 },
      { row: 4, col: 1 },
    ];

    for (const move of moves) {
      game = applyMove(game, move);
    }

    const replayed = replayMoves(moves);

    expect(Array.from(replayed.board)).toEqual(Array.from(game.board));
    expect(replayed.currentPlayer).toBe(game.currentPlayer);
    expect(replayed.lastMove).toEqual(game.lastMove);
    expect(replayed.moveHistory).toEqual(game.moveHistory);
    expect(replayed.status).toEqual(game.status);
  });

  it("replays blocker actions without converting them into player pieces", () => {
    const replayed = replayMoves([
      { kind: "blocker", row: 2, col: 3 },
      { row: 2, col: 3 },
    ]);

    expect(replayed.board[indexOf(0, 2, 3)]).toBe(BLOCKER_CELL);
    expect(replayed.board[indexOf(1, 2, 3)]).toBe(1);
    expect(replayed.currentPlayer).toBe(2);
    expect(replayed.moveHistory.map((move) => move.kind)).toEqual([
      "blocker",
      "piece",
    ]);
  });

  it("places a double-adjacent first piece without advancing the turn", () => {
    let game = createGame();

    game = applyDoubleAdjacentFirst(game, { row: 2, col: 3 });

    expect(game.currentPlayer).toBe(1);
    expect(game.status).toEqual({ state: "playing", currentPlayer: 1 });
    expect(game.moveHistory[0]).toMatchObject({
      height: 0,
      row: 2,
      col: 3,
      player: 1,
      kind: "piece",
      special: { action: "double-adjacent", step: "first" },
    });
    expect(getPendingDoubleAdjacentOrigin(game)).toEqual(game.moveHistory[0]);
  });

  it("requires the second double-adjacent piece to land next to the first", () => {
    let game = createGame();

    game = applyDoubleAdjacentFirst(game, { row: 2, col: 3 });
    const origin = getPendingDoubleAdjacentOrigin(game);

    expect(origin).not.toBeNull();
    expect(
      isLegalDoubleAdjacentMove(game.board, { row: 2, col: 3 }, origin!),
    ).toBe(true);
    expect(
      isLegalDoubleAdjacentMove(game.board, { row: 5, col: 6 }, origin!),
    ).toBe(false);
    expect(() =>
      applyDoubleAdjacentSecond(game, { row: 5, col: 6 }, origin!),
    ).toThrow("Second piece must land adjacent");

    game = applyDoubleAdjacentSecond(game, { row: 2, col: 3 }, origin!);

    expect(game.currentPlayer).toBe(2);
    expect(game.moveHistory[1]).toMatchObject({
      height: 1,
      row: 2,
      col: 3,
      player: 1,
      kind: "piece",
      special: { action: "double-adjacent", step: "second" },
    });
  });

  it("treats all 26 neighboring cells as double-adjacent", () => {
    const center = { height: 2, row: 2, col: 2 };

    for (let height = 1; height <= 3; height += 1) {
      for (let row = 1; row <= 3; row += 1) {
        for (let col = 1; col <= 3; col += 1) {
          if (height === 2 && row === 2 && col === 2) continue;

          expect(areCellsAdjacent(center, { height, row, col })).toBe(true);
        }
      }
    }

    expect(areCellsAdjacent(center, center)).toBe(false);
    expect(areCellsAdjacent(center, { height: 4, row: 2, col: 2 })).toBe(false);
  });

  it("replays double-adjacent moves without alternating between the two pieces", () => {
    const replayed = replayMoves([
      {
        row: 2,
        col: 3,
        special: { action: "double-adjacent", step: "first" },
      },
      {
        row: 2,
        col: 3,
        special: { action: "double-adjacent", step: "second" },
      },
    ]);

    expect(replayed.board[indexOf(0, 2, 3)]).toBe(1);
    expect(replayed.board[indexOf(1, 2, 3)]).toBe(1);
    expect(replayed.currentPlayer).toBe(2);
    expect(replayed.moveHistory.map((move) => move.player)).toEqual([1, 1]);
  });

  it("does not count blockers as owned line cells", () => {
    let game = createGame();

    game = applyMove(game, { row: 0, col: 0 });
    game = applyMove(game, { row: 5, col: 0 });
    game = applyMove(game, { row: 1, col: 0 });
    game = applyMove(game, { row: 5, col: 1 });
    game = applyMove(game, { row: 2, col: 0 });
    game = applyMove(game, { row: 5, col: 2 });
    game = applyBlocker(game, { row: 3, col: 0 });

    expect(game.status).toEqual({ state: "playing", currentPlayer: 1 });
  });

  it("detects a vertical height win", () => {
    let game = createGame();

    game = applyMove(game, { row: 0, col: 0 });
    game = applyMove(game, { row: 1, col: 0 });
    game = applyMove(game, { row: 0, col: 0 });
    game = applyMove(game, { row: 1, col: 0 });
    game = applyMove(game, { row: 0, col: 0 });
    game = applyMove(game, { row: 1, col: 0 });
    game = applyMove(game, { row: 0, col: 0 });

    expect(game.status).toMatchObject({ state: "won", winner: 1 });
  });

  it("detects a row win on the floor", () => {
    let game = createGame();

    game = applyMove(game, { row: 0, col: 0 });
    game = applyMove(game, { row: 5, col: 0 });
    game = applyMove(game, { row: 1, col: 0 });
    game = applyMove(game, { row: 5, col: 1 });
    game = applyMove(game, { row: 2, col: 0 });
    game = applyMove(game, { row: 5, col: 2 });
    game = applyMove(game, { row: 3, col: 0 });

    expect(game.status).toMatchObject({ state: "won", winner: 1 });
  });

  it("can require five in a row before declaring a win", () => {
    let game = createGame({ lineLength: 5, linesToWin: 1 });

    game = applyMove(game, { row: 0, col: 0 });
    game = applyMove(game, { row: 5, col: 0 });
    game = applyMove(game, { row: 0, col: 1 });
    game = applyMove(game, { row: 5, col: 1 });
    game = applyMove(game, { row: 0, col: 2 });
    game = applyMove(game, { row: 5, col: 2 });
    game = applyMove(game, { row: 0, col: 3 });

    expect(game.status).toEqual({ state: "playing", currentPlayer: 2 });

    game = applyMove(game, { row: 5, col: 3 });
    game = applyMove(game, { row: 0, col: 4 });

    expect(game.status).toMatchObject({
      state: "won",
      winner: 1,
      lineCount: 1,
    });
    expect(game.status.state === "won" ? game.status.line : []).toHaveLength(5);
  });

  it("can require multiple completed lines before declaring a win", () => {
    let game = createGame({ lineLength: 4, linesToWin: 2 });

    game = applyMove(game, { row: 0, col: 0 });
    game = applyMove(game, { row: 3, col: 6 });
    game = applyMove(game, { row: 0, col: 1 });
    game = applyMove(game, { row: 3, col: 5 });
    game = applyMove(game, { row: 0, col: 2 });
    game = applyMove(game, { row: 3, col: 4 });
    game = applyMove(game, { row: 0, col: 3 });

    expect(game.status).toEqual({ state: "playing", currentPlayer: 2 });
    expect(findCompletedLines(game.board, 1, game.winCondition)).toHaveLength(
      1,
    );
    expect(game.completedLines).toHaveLength(1);
    expect(game.completedLines[0]).toMatchObject({
      player: 1,
      lineLength: 4,
    });
    expect(game.completedLines[0]?.cells).toHaveLength(4);

    game = applyMove(game, { row: 2, col: 6 });
    game = applyMove(game, { row: 1, col: 0 });
    game = applyMove(game, { row: 2, col: 5 });
    game = applyMove(game, { row: 1, col: 1 });
    game = applyMove(game, { row: 2, col: 4 });
    game = applyMove(game, { row: 1, col: 2 });
    game = applyMove(game, { row: 4, col: 6 });
    game = applyMove(game, { row: 1, col: 3 });

    expect(game.status).toMatchObject({
      state: "won",
      winner: 1,
      lineCount: 2,
    });
    expect(game.status.state === "won" ? game.status.lines : []).toHaveLength(
      2,
    );
    expect(
      game.completedLines.filter((line) => line.player === 1),
    ).toHaveLength(2);
  });

  it("counts a longer contiguous run as one completed line", () => {
    let game = createGame({ lineLength: 4, linesToWin: 2 });

    game = applyMove(game, { row: 0, col: 0 });
    game = applyMove(game, { row: 5, col: 0 });
    game = applyMove(game, { row: 0, col: 1 });
    game = applyMove(game, { row: 5, col: 1 });
    game = applyMove(game, { row: 0, col: 2 });
    game = applyMove(game, { row: 5, col: 2 });
    game = applyMove(game, { row: 0, col: 3 });

    expect(game.status).toEqual({ state: "playing", currentPlayer: 2 });
    expect(
      game.completedLines.filter((line) => line.player === 1),
    ).toHaveLength(1);

    game = applyMove(game, { row: 5, col: 3 });
    game = applyMove(game, { row: 0, col: 4 });

    expect(game.status).toEqual({ state: "playing", currentPlayer: 2 });
    const playerOneLines = game.completedLines.filter(
      (line) => line.player === 1,
    );
    expect(playerOneLines).toHaveLength(1);
    expect(playerOneLines[0]?.cells).toHaveLength(5);
  });

  it("detects a 3D diagonal win", () => {
    let game = createGame();

    game = applyMove(game, { row: 0, col: 0 });

    game = applyMove(game, { row: 1, col: 1 });
    game = applyMove(game, { row: 1, col: 1 });

    game = applyMove(game, { row: 2, col: 2 });
    game = applyMove(game, { row: 4, col: 0 });
    game = applyMove(game, { row: 2, col: 2 });
    game = applyMove(game, { row: 4, col: 1 });
    game = applyMove(game, { row: 2, col: 2 });

    game = applyMove(game, { row: 3, col: 3 });
    game = applyMove(game, { row: 4, col: 2 });
    game = applyMove(game, { row: 3, col: 3 });
    game = applyMove(game, { row: 5, col: 2 });
    game = applyMove(game, { row: 3, col: 3 });
    game = applyMove(game, { row: 5, col: 3 });
    game = applyMove(game, { row: 3, col: 3 });

    expect(game.status).toMatchObject({ state: "won", winner: 1 });
  });
});
