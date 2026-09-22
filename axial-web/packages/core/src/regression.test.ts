import { describe, expect, it } from "vitest";
import {
  BLOCKER_CELL,
  DEFAULT_BOARD_DIMENSIONS,
  applyBlocker,
  applyDoubleAdjacentFirst,
  applyDoubleAdjacentSecond,
  applyMove,
  cellCount,
  cellFromIndex,
  cloneGame,
  createGame,
  findCompletedLineSegments,
  findCompletedLines,
  findWinningLine,
  getDropHeight,
  getPendingDoubleAdjacentOrigin,
  indexOf,
  legalMoves,
  replayMoves,
  type BoardDimensions,
  type Player,
} from "./index";

// Keep this independent of DIRECTIONS so deleting a production direction fails coverage.
const spatialDirections: {
  name: string;
  delta: [number, number, number];
}[] = [
  { name: "height", delta: [1, 0, 0] },
  { name: "row", delta: [0, 1, 0] },
  { name: "column", delta: [0, 0, 1] },
  { name: "height / row", delta: [1, 1, 0] },
  { name: "height / reverse row", delta: [1, -1, 0] },
  { name: "row / column", delta: [0, 1, 1] },
  { name: "row / reverse column", delta: [0, 1, -1] },
  { name: "height / column", delta: [1, 0, 1] },
  { name: "height / reverse column", delta: [1, 0, -1] },
  { name: "height / row / column", delta: [1, 1, 1] },
  { name: "height / row / reverse column", delta: [1, 1, -1] },
  { name: "height / reverse row / column", delta: [1, -1, 1] },
  { name: "height / reverse row / reverse column", delta: [1, -1, -1] },
];

const boards = [
  { name: "normal", dimensions: DEFAULT_BOARD_DIMENSIONS },
  { name: "expanded", dimensions: { height: 7, rows: 8, columns: 9 } },
];

function edgeLine(
  dimensions: BoardDimensions,
  delta: [number, number, number],
  length: number,
  farEdge: boolean,
): number[] {
  const sizes = [dimensions.height, dimensions.rows, dimensions.columns];
  const start = delta.map((step, axis) => {
    const low = step < 0 ? length - 1 : 0;
    const high = sizes[axis] - 1 - (step > 0 ? length - 1 : 0);
    return farEdge ? high : low;
  });

  return Array.from({ length }, (_, offset) =>
    indexOf(
      start[0] + offset * delta[0],
      start[1] + offset * delta[1],
      start[2] + offset * delta[2],
      dimensions,
    ),
  );
}

describe.each(boards)(
  "$name board spatial line regressions",
  ({ dimensions }) => {
    describe.each([4, 5])("Connect %i", (lineLength) => {
      const condition = { lineLength, linesToWin: 3 };

      it.each(spatialDirections)(
        "detects $name for either player at both board edges and from every cell",
        ({ delta }) => {
          for (const player of [1, 2] as const) {
            for (const farEdge of [false, true]) {
              const cells = edgeLine(dimensions, delta, lineLength, farEdge);
              const board = new Uint8Array(cellCount(dimensions));
              for (const cell of cells) board[cell] = player;

              expect(
                findCompletedLineSegments(
                  board,
                  condition,
                  undefined,
                  dimensions,
                ),
              ).toEqual([
                {
                  id: expect.any(String),
                  player,
                  cells,
                  direction: delta,
                  lineLength,
                },
              ]);
              expect(
                findCompletedLines(
                  board,
                  player === 1 ? 2 : 1,
                  condition,
                  dimensions,
                ),
              ).toEqual([]);

              for (const cell of cells) {
                expect(
                  findWinningLine(
                    board,
                    {
                      ...cellFromIndex(cell, dimensions),
                      player,
                      kind: "piece",
                    },
                    condition,
                    dimensions,
                  ),
                ).toEqual(cells);
              }
            }
          }
        },
      );

      it.each(spatialDirections)(
        "scores an extended $name run once and rejects gaps, blockers, and opponents",
        ({ delta }) => {
          const cells = edgeLine(dimensions, delta, lineLength + 1, true);
          const board = new Uint8Array(cellCount(dimensions));
          for (const cell of cells) board[cell] = 1;

          expect(findCompletedLines(board, 1, condition, dimensions)).toEqual([
            cells,
          ]);
          for (const cell of cells) {
            const line = findWinningLine(
              board,
              {
                ...cellFromIndex(cell, dimensions),
                player: 1,
                kind: "piece",
              },
              condition,
              dimensions,
            );
            expect(line).toHaveLength(lineLength);
            expect(line).toContain(cell);
            expect(line?.every((index) => cells.includes(index))).toBe(true);
          }

          const middle = cells[Math.floor(cells.length / 2)];
          for (const interruption of [0, 2, BLOCKER_CELL]) {
            board[middle] = interruption;
            expect(
              findCompletedLineSegments(
                board,
                condition,
                undefined,
                dimensions,
              ),
            ).toEqual([]);
            for (const cell of cells.filter((cell) => cell !== middle)) {
              expect(
                findWinningLine(
                  board,
                  {
                    ...cellFromIndex(cell, dimensions),
                    player: 1,
                    kind: "piece",
                  },
                  condition,
                  dimensions,
                ),
              ).toBeNull();
            }
          }
        },
      );
    });

    it("round trips every coordinate including the last corner", () => {
      for (let index = 0; index < cellCount(dimensions); index += 1) {
        const { height, row, col } = cellFromIndex(index, dimensions);
        expect(indexOf(height, row, col, dimensions)).toBe(index);
      }
    });
  },
);

describe("scoring and terminal turns", () => {
  it.each([4, 5])(
    "scores three crossing Connect %i lines on one move",
    (lineLength) => {
      const game = createGame({ lineLength, linesToWin: 2 });
      const center = { row: 2, col: 2 };
      for (let offset = 0; offset < lineLength; offset += 1) {
        if (offset === 2) continue;
        game.board[indexOf(0, 2, offset)] = 1;
        game.board[indexOf(0, offset, 2)] = 1;
        game.board[indexOf(0, offset, offset)] = 1;
      }

      const next = applyMove(game, center);
      expect(next.status).toMatchObject({
        state: "won",
        winner: 1,
        lineCount: 3,
      });
      expect(next.completedLines).toHaveLength(3);
      expect(new Set(next.completedLines.map((line) => line.id)).size).toBe(3);
      if (next.status.state !== "won") throw new Error("Expected a win");
      expect(
        next.status.lines.every((line) => line.includes(indexOf(0, 2, 2))),
      ).toBe(true);
      expect(next.status.line).toHaveLength(3 * lineLength - 2);
      expect(new Set(next.status.line).size).toBe(next.status.line.length);
      expect(game.board[indexOf(0, 2, 2)]).toBe(0);
    },
  );

  it("keeps separated runs and different players distinct", () => {
    const dimensions = { height: 6, rows: 6, columns: 10 };
    const board = new Uint8Array(cellCount(dimensions));
    const expected = [
      [0, 1, 2, 3].map((col) => indexOf(0, 0, col, dimensions)),
      [6, 7, 8, 9].map((col) => indexOf(0, 0, col, dimensions)),
      [0, 1, 2, 3].map((col) => indexOf(0, 1, col, dimensions)),
    ];
    expected.forEach((cells, run) => {
      for (const cell of cells) board[cell] = run === 2 ? 2 : 1;
    });
    expect(findCompletedLines(board, 1, undefined, dimensions)).toEqual(
      expected.slice(0, 2),
    );
    expect(findCompletedLines(board, 2, undefined, dimensions)).toEqual([
      expected[2],
    ]);
  });

  it("rejects a blocker in the last opening and draws after an ordinary final piece", () => {
    const game = createGame();
    game.board.fill(BLOCKER_CELL);
    const lastCell = indexOf(game.dimensions.height - 1, 0, 0);
    game.board[lastCell] = 0;
    const before = cloneGame(game);

    expect(legalMoves(game.board)).toEqual([{ row: 0, col: 0 }]);
    expect(() => applyBlocker(game, { row: 0, col: 0 })).toThrow(
      "leave a legal piece move",
    );
    expect(game).toEqual(before);

    const next = applyMove(game, { row: 0, col: 0 });
    expect(next.status).toEqual({ state: "draw" });
    expect(legalMoves(next.board)).toEqual([]);
    expect(() => applyMove(next, { row: 1, col: 1 })).toThrow("game is over");
    expect(() => applyBlocker(next, { row: 1, col: 1 })).toThrow(
      "game is over",
    );
  });

  it("awards a win before checking a full-board draw", () => {
    const game = createGame();
    game.board.fill(BLOCKER_CELL);
    for (let col = 0; col < 3; col += 1) game.board[indexOf(5, 0, col)] = 1;
    game.board[indexOf(5, 0, 3)] = 0;

    const next = applyMove(game, { row: 0, col: 3 });
    expect(legalMoves(next.board)).toEqual([]);
    expect(next.status).toMatchObject({
      state: "won",
      winner: 1,
      lineCount: 1,
    });
    expect(() => applyMove(next, { row: 1, col: 1 })).toThrow("game is over");
    expect(() => applyBlocker(next, { row: 1, col: 1 })).toThrow(
      "game is over",
    );
  });
});

describe("move and replay boundaries", () => {
  it("clones completed-line directions into a worker-safe snapshot", () => {
    const game = replayMoves(
      [
        { row: 0, col: 0 },
        { row: 5, col: 0 },
        { row: 0, col: 1 },
        { row: 5, col: 2 },
        { row: 0, col: 2 },
        { row: 5, col: 4 },
        { row: 0, col: 3 },
      ],
      { lineLength: 4, linesToWin: 2 },
    );
    const line = game.completedLines[0];
    // Reactive UI stores wrap nested tuples; postMessage cannot clone a Proxy.
    const reactive = {
      ...game,
      completedLines: [
        {
          ...line,
          direction: new Proxy(line.direction, {}),
        },
      ],
    };
    const cloned = cloneGame(reactive);
    expect(cloned.completedLines[0].direction).toEqual(line.direction);
    expect(() => structuredClone(cloned)).not.toThrow();
    expect(cloned.completedLines[0].direction).not.toBe(
      reactive.completedLines[0].direction,
    );
  });

  it.each([-1, 0.5, NaN, Infinity, -Infinity, 1000])(
    "rejects non-cell coordinate %s without mutating the game",
    (invalid) => {
      const game = createGame();
      const before = cloneGame(game);
      for (const move of [
        { row: invalid, col: 0 },
        { row: 0, col: invalid },
      ]) {
        expect(() => getDropHeight(game.board, move)).toThrow(RangeError);
        expect(() => applyMove(game, move)).toThrow(RangeError);
        expect(() => applyBlocker(game, move)).toThrow(RangeError);
        expect(() => replayMoves([move])).toThrow(RangeError);
      }
      for (const cell of [
        [invalid, 0, 0],
        [0, invalid, 0],
        [0, 0, invalid],
      ]) {
        expect(() => indexOf(cell[0], cell[1], cell[2])).toThrow(RangeError);
      }
      expect(() => cellFromIndex(invalid)).toThrow(RangeError);
      expect(game).toEqual(before);
    },
  );

  it("rejects full columns in direct play and replay without mutating prior state", () => {
    const moves = Array.from(
      { length: DEFAULT_BOARD_DIMENSIONS.height },
      () => ({ row: 0, col: 0 }),
    );
    const game = replayMoves(moves);
    const before = cloneGame(game);

    expect(getDropHeight(game.board, moves[0])).toBe(-1);
    expect(legalMoves(game.board)).not.toContainEqual(moves[0]);
    expect(() => applyMove(game, moves[0])).toThrow("is full");
    expect(() => applyBlocker(game, moves[0])).toThrow("is full");
    expect(() => replayMoves([...moves, moves[0]])).toThrow("is full");
    expect(game).toEqual(before);
  });

  it.each([1, 2] as const)(
    "replays mixed tactical actions for starting player %i",
    (player: Player) => {
      let game = createGame(undefined, undefined, player);
      game = applyBlocker(game, { row: 1, col: 1 });
      game = applyMove(
        game,
        { row: 1, col: 1 },
        {
          special: { action: "blocker-combo", step: "piece" },
        },
      );
      game = applyDoubleAdjacentFirst(game, { row: 3, col: 3 });
      const origin = getPendingDoubleAdjacentOrigin(game);
      if (!origin) throw new Error("Expected a pending pair");
      game = applyDoubleAdjacentSecond(game, { row: 3, col: 4 }, origin);
      game = applyMove(game, { row: 0, col: 0 });

      expect(
        replayMoves(game.moveHistory, undefined, undefined, player),
      ).toEqual(game);
    },
  );

  it("rejects a replayed second piece without an adjacent first piece", () => {
    const second = { action: "double-adjacent", step: "second" } as const;
    expect(() => replayMoves([{ row: 0, col: 0, special: second }])).toThrow(
      "missing its first piece",
    );
    expect(() =>
      replayMoves([
        {
          row: 0,
          col: 0,
          special: { action: "double-adjacent", step: "first" },
        },
        { row: 5, col: 6, special: second },
      ]),
    ).toThrow("must land adjacent");
  });

  it("rejects a stale double-adjacent origin after the pair finishes", () => {
    const first = applyDoubleAdjacentFirst(createGame(), { row: 1, col: 1 });
    const origin = getPendingDoubleAdjacentOrigin(first);
    if (!origin) throw new Error("Expected a pending pair");
    const second = applyDoubleAdjacentSecond(first, { row: 1, col: 2 }, origin);

    expect(getPendingDoubleAdjacentOrigin(second)).toBeNull();
    expect(() =>
      applyDoubleAdjacentSecond(second, { row: 1, col: 3 }, origin),
    ).toThrow("must continue from its first piece");
  });

  it("allows the first double-adjacent piece to win without requiring a second", () => {
    const game = createGame();
    for (let col = 0; col < 3; col += 1) game.board[indexOf(0, 0, col)] = 1;
    const next = applyDoubleAdjacentFirst(game, { row: 0, col: 3 });

    expect(next.status).toMatchObject({ state: "won", winner: 1 });
    expect(getPendingDoubleAdjacentOrigin(next)).toBeNull();
  });

  it("does not alias boards, histories, special metadata, or won line arrays when cloning", () => {
    let game = createGame();
    for (let col = 0; col < 3; col += 1) game.board[indexOf(0, 0, col)] = 1;
    game = applyDoubleAdjacentFirst(game, { row: 0, col: 3 });
    const expected = cloneGame(game);
    const clone = cloneGame(game);

    clone.board.fill(0);
    clone.dimensions.rows = 8;
    clone.winCondition.lineLength = 5;
    clone.completedLines[0].cells.length = 0;
    clone.moveHistory[0].special!.step = "second";
    clone.lastMove!.special!.step = "second";
    if (clone.status.state !== "won") throw new Error("Expected a win");
    clone.status.line.length = 0;
    clone.status.lines[0].length = 0;
    expect(game).toEqual(expected);
  });
});
