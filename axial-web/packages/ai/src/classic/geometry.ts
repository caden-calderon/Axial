import {
  DEFAULT_BOARD_DIMENSIONS,
  DIRECTIONS,
  WIN_LENGTH,
  cellCount,
  cellFromIndex,
  indexOf,
  normalizeBoardDimensions,
  type BoardDimensions,
  type Move,
} from "@axial/core";

export const CLASSIC_MOVE_COUNT = moveCountForDimensions(
  DEFAULT_BOARD_DIMENSIONS,
);

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
  dimensions: BoardDimensions;
  lineLength: number;
  segments: readonly WinningSegment[];
  cellSegments: readonly (readonly number[])[];
  axisCounts: Readonly<Record<SegmentAxis, number>>;
};

const movesCache = new Map<string, readonly ClassicMove[]>();
const moveIndicesCache = new Map<string, readonly MoveIndex[]>();
const segmentTableCache = new Map<string, SegmentTable>();

export const CLASSIC_MOVES: readonly ClassicMove[] = getClassicMoves(
  DEFAULT_BOARD_DIMENSIONS,
);

export const CLASSIC_MOVE_INDICES: readonly MoveIndex[] = getClassicMoveIndices(
  DEFAULT_BOARD_DIMENSIONS,
);

export const DEFAULT_SEGMENT_TABLE = getSegmentTable(
  WIN_LENGTH,
  DEFAULT_BOARD_DIMENSIONS,
);

export const WINNING_SEGMENTS = DEFAULT_SEGMENT_TABLE.segments;

export const CELL_SEGMENTS = DEFAULT_SEGMENT_TABLE.cellSegments;

export const SEGMENT_AXIS_COUNTS = DEFAULT_SEGMENT_TABLE.axisCounts;

export function moveCountForDimensions(
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): number {
  const normalized = normalizeBoardDimensions(dimensions);
  return normalized.rows * normalized.columns;
}

export function getClassicMoves(
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): readonly ClassicMove[] {
  const normalized = normalizeBoardDimensions(dimensions);
  const key = dimensionKey(normalized);
  const cached = movesCache.get(key);
  if (cached) return cached;

  const moves = Object.freeze(
    Array.from({ length: moveCountForDimensions(normalized) }, (_, index) =>
      Object.freeze({
        index,
        row: Math.floor(index / normalized.columns),
        col: index % normalized.columns,
      }),
    ),
  );
  movesCache.set(key, moves);
  return moves;
}

export function getClassicMoveIndices(
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): readonly MoveIndex[] {
  const normalized = normalizeBoardDimensions(dimensions);
  const key = dimensionKey(normalized);
  const cached = moveIndicesCache.get(key);
  if (cached) return cached;

  const indices = Object.freeze(
    getClassicMoves(normalized).map((move) => move.index),
  );
  moveIndicesCache.set(key, indices);
  return indices;
}

export function moveToIndex(
  move: Move,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): MoveIndex {
  const normalized = normalizeBoardDimensions(dimensions);
  assertMove(move, normalized);
  return move.row * normalized.columns + move.col;
}

export function moveFromIndex(
  index: MoveIndex,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): ClassicMove {
  const move = getClassicMoves(dimensions)[index];
  if (!move) {
    throw new RangeError(`Move index ${index} is outside the Classic board`);
  }

  return move;
}

export function cellToMoveIndex(
  cellIndex: number,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): MoveIndex {
  const normalized = normalizeBoardDimensions(dimensions);
  const { row, col } = cellFromIndex(cellIndex, normalized);
  return row * normalized.columns + col;
}

export function getSegmentTable(
  lineLength: number = WIN_LENGTH,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): SegmentTable {
  const normalized = normalizeBoardDimensions(dimensions);
  const key = `${lineLength}:${dimensionKey(normalized)}`;
  const cached = segmentTableCache.get(key);
  if (cached) return cached;

  const segments = Object.freeze(buildWinningSegments(lineLength, normalized));
  const table = Object.freeze({
    dimensions: Object.freeze({ ...normalized }),
    lineLength,
    segments,
    cellSegments: Object.freeze(buildCellSegments(segments, normalized)),
    axisCounts: buildAxisCounts(segments),
  });
  segmentTableCache.set(key, table);

  return table;
}

function buildWinningSegments(
  lineLength: number,
  dimensions: BoardDimensions,
): WinningSegment[] {
  const segments: WinningSegment[] = [];

  for (let height = 0; height < dimensions.height; height += 1) {
    for (let row = 0; row < dimensions.rows; row += 1) {
      for (let col = 0; col < dimensions.columns; col += 1) {
        for (const direction of DIRECTIONS) {
          const [dh, dr, dc] = direction;
          const endHeight = height + dh * (lineLength - 1);
          const endRow = row + dr * (lineLength - 1);
          const endCol = col + dc * (lineLength - 1);

          if (!isInBounds(endHeight, endRow, endCol, dimensions)) continue;

          const cells = Object.freeze(
            Array.from({ length: lineLength }, (_, offset) =>
              indexOf(
                height + dh * offset,
                row + dr * offset,
                col + dc * offset,
                dimensions,
              ),
            ),
          );

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
  dimensions: BoardDimensions,
): readonly (readonly number[])[] {
  const byCell = Array.from(
    { length: cellCount(dimensions) },
    () => [] as number[],
  );

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

function isInBounds(
  height: number,
  row: number,
  col: number,
  dimensions: BoardDimensions,
): boolean {
  return (
    height >= 0 &&
    height < dimensions.height &&
    row >= 0 &&
    row < dimensions.rows &&
    col >= 0 &&
    col < dimensions.columns
  );
}

function assertMove(move: Move, dimensions: BoardDimensions): void {
  if (
    move.row < 0 ||
    move.row >= dimensions.rows ||
    move.col < 0 ||
    move.col >= dimensions.columns
  ) {
    throw new RangeError(
      `Move row=${move.row}, col=${move.col} is outside the Classic board`,
    );
  }
}

function dimensionKey(dimensions: BoardDimensions): string {
  return `${dimensions.height}:${dimensions.rows}:${dimensions.columns}`;
}
