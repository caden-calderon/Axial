import {
  BOARD_COLUMNS,
  BOARD_HEIGHT,
  BOARD_ROWS,
  CELL_COUNT,
  DIRECTIONS,
  WIN_LENGTH,
  cellFromIndex,
  indexOf,
  type Move,
} from "@axial/core";

export const CLASSIC_MOVE_COUNT = BOARD_ROWS * BOARD_COLUMNS;

export type MoveIndex = number;

export type ClassicMove = Move & {
  index: MoveIndex;
};

export type SegmentAxis =
  | "height"
  | "row"
  | "column"
  | "two-axis"
  | "three-axis";

export type WinningSegment = {
  id: number;
  cells: readonly number[];
  direction: readonly [number, number, number];
  axis: SegmentAxis;
};

export type SegmentTable = {
  lineLength: number;
  segments: readonly WinningSegment[];
  cellSegments: readonly (readonly number[])[];
  axisCounts: Readonly<Record<SegmentAxis, number>>;
};

const segmentTableCache = new Map<number, SegmentTable>();

export const CLASSIC_MOVES: readonly ClassicMove[] = Object.freeze(
  Array.from({ length: CLASSIC_MOVE_COUNT }, (_, index) =>
    Object.freeze({
      index,
      row: Math.floor(index / BOARD_COLUMNS),
      col: index % BOARD_COLUMNS,
    }),
  ),
);

export const CLASSIC_MOVE_INDICES: readonly MoveIndex[] = Object.freeze(
  CLASSIC_MOVES.map((move) => move.index),
);

export const DEFAULT_SEGMENT_TABLE = getSegmentTable(WIN_LENGTH);

export const WINNING_SEGMENTS = DEFAULT_SEGMENT_TABLE.segments;

export const CELL_SEGMENTS = DEFAULT_SEGMENT_TABLE.cellSegments;

export const SEGMENT_AXIS_COUNTS = DEFAULT_SEGMENT_TABLE.axisCounts;

export function moveToIndex(move: Move): MoveIndex {
  assertMove(move);
  return move.row * BOARD_COLUMNS + move.col;
}

export function moveFromIndex(index: MoveIndex): ClassicMove {
  const move = CLASSIC_MOVES[index];
  if (!move) {
    throw new RangeError(`Move index ${index} is outside the Classic board`);
  }

  return move;
}

export function cellToMoveIndex(cellIndex: number): MoveIndex {
  const { row, col } = cellFromIndex(cellIndex);
  return row * BOARD_COLUMNS + col;
}

export function getSegmentTable(lineLength: number = WIN_LENGTH): SegmentTable {
  const cached = segmentTableCache.get(lineLength);
  if (cached) return cached;

  const segments = Object.freeze(buildWinningSegments(lineLength));
  const table = Object.freeze({
    lineLength,
    segments,
    cellSegments: Object.freeze(buildCellSegments(segments)),
    axisCounts: buildAxisCounts(segments),
  });
  segmentTableCache.set(lineLength, table);

  return table;
}

function buildWinningSegments(lineLength: number): WinningSegment[] {
  const segments: WinningSegment[] = [];

  for (let height = 0; height < BOARD_HEIGHT; height += 1) {
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLUMNS; col += 1) {
        for (const direction of DIRECTIONS) {
          const [dh, dr, dc] = direction;
          const endHeight = height + dh * (lineLength - 1);
          const endRow = row + dr * (lineLength - 1);
          const endCol = col + dc * (lineLength - 1);

          if (!isInBounds(endHeight, endRow, endCol)) continue;

          const cells = Object.freeze(Array.from({ length: lineLength }, (_, offset) =>
            indexOf(height + dh * offset, row + dr * offset, col + dc * offset),
          ));

          segments.push({
            id: segments.length,
            cells,
            direction,
            axis: segmentAxis(direction),
          });
        }
      }
    }
  }

  return segments;
}

function buildAxisCounts(
  segments: readonly WinningSegment[],
): Readonly<Record<SegmentAxis, number>> {
  return Object.freeze(
    segments.reduce(
      (counts, segment) => {
        counts[segment.axis] += 1;
        return counts;
      },
      {
        height: 0,
        row: 0,
        column: 0,
        "two-axis": 0,
        "three-axis": 0,
      } satisfies Record<SegmentAxis, number>,
    ),
  );
}

function buildCellSegments(
  segments: readonly WinningSegment[],
): readonly (readonly number[])[] {
  const byCell = Array.from({ length: CELL_COUNT }, () => [] as number[]);

  for (const segment of segments) {
    for (const cell of segment.cells) {
      byCell[cell].push(segment.id);
    }
  }

  return byCell.map((segmentIds) => Object.freeze(segmentIds));
}

function segmentAxis([dh, dr, dc]: readonly [
  number,
  number,
  number,
]): SegmentAxis {
  const activeAxes = Number(dh !== 0) + Number(dr !== 0) + Number(dc !== 0);
  if (activeAxes === 3) return "three-axis";
  if (activeAxes === 2) return "two-axis";
  if (dh !== 0) return "height";
  if (dr !== 0) return "row";
  return "column";
}

function isInBounds(height: number, row: number, col: number): boolean {
  return (
    height >= 0 &&
    height < BOARD_HEIGHT &&
    row >= 0 &&
    row < BOARD_ROWS &&
    col >= 0 &&
    col < BOARD_COLUMNS
  );
}

function assertMove(move: Move): void {
  if (
    move.row < 0 ||
    move.row >= BOARD_ROWS ||
    move.col < 0 ||
    move.col >= BOARD_COLUMNS
  ) {
    throw new RangeError(
      `Move row=${move.row}, col=${move.col} is outside the Classic board`,
    );
  }
}
