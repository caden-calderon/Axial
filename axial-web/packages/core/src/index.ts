export const BOARD_HEIGHT = 6;
export const BOARD_ROWS = 6;
export const BOARD_COLUMNS = 7;
export const WIN_LENGTH = 4;
export const MIN_BOARD_HEIGHT = BOARD_HEIGHT;
export const MIN_BOARD_ROWS = BOARD_ROWS;
export const MIN_BOARD_COLUMNS = BOARD_COLUMNS;
export const MAX_BOARD_DIMENSION = 10;
export const MIN_WIN_LINE_LENGTH = 4;
export const MAX_WIN_LINE_LENGTH = 5;
export const MIN_LINES_TO_WIN = 1;
export const MAX_LINES_TO_WIN = 3;
export const BLOCKER_CELL = 3;

export type MatchMode = "classic" | "tactical";

export type BoardDimensions = {
  height: number;
  rows: number;
  columns: number;
};

export const DEFAULT_BOARD_DIMENSIONS: BoardDimensions = Object.freeze({
  height: BOARD_HEIGHT,
  rows: BOARD_ROWS,
  columns: BOARD_COLUMNS,
});

export const MIN_BOARD_DIMENSIONS: BoardDimensions = Object.freeze({
  height: MIN_BOARD_HEIGHT,
  rows: MIN_BOARD_ROWS,
  columns: MIN_BOARD_COLUMNS,
});

export const MAX_BOARD_DIMENSIONS: BoardDimensions = Object.freeze({
  height: MAX_BOARD_DIMENSION,
  rows: MAX_BOARD_DIMENSION,
  columns: MAX_BOARD_DIMENSION,
});

export const CELL_COUNT = cellCount(DEFAULT_BOARD_DIMENSIONS);

export type MatchConfig = {
  mode: MatchMode;
  board: BoardDimensions;
  defaultWinCondition: WinCondition;
  specialPieceSlots: number;
};

export type WinCondition = {
  lineLength: number;
  linesToWin: number;
};

export const DEFAULT_WIN_CONDITION: WinCondition = Object.freeze({
  lineLength: WIN_LENGTH,
  linesToWin: MIN_LINES_TO_WIN,
});

export const MATCH_MODE_LABELS: Record<MatchMode, string> = {
  classic: "Classic",
  tactical: "Tactical",
};

export const MATCH_CONFIGS: Record<MatchMode, MatchConfig> = {
  classic: {
    mode: "classic",
    board: DEFAULT_BOARD_DIMENSIONS,
    defaultWinCondition: DEFAULT_WIN_CONDITION,
    specialPieceSlots: 0,
  },
  tactical: {
    mode: "tactical",
    board: DEFAULT_BOARD_DIMENSIONS,
    defaultWinCondition: DEFAULT_WIN_CONDITION,
    specialPieceSlots: 3,
  },
};

export type Player = 1 | 2;
export type BlockerCell = typeof BLOCKER_CELL;
export type Cell = 0 | Player | BlockerCell;
export type PlacedMoveKind = "piece" | "blocker";
export type TacticalSpecialId = "blocker-combo" | "double-adjacent";
export type SpecialMoveStep = "blocker" | "piece" | "first" | "second";

export type PlacedMoveSpecial = {
  action: TacticalSpecialId;
  step: SpecialMoveStep;
};

export type Move = {
  row: number;
  col: number;
};

export type PlacedMove = Move & {
  height: number;
  player: Player;
  kind: PlacedMoveKind;
  special?: PlacedMoveSpecial;
};

export type GameStatus =
  | { state: "playing"; currentPlayer: Player }
  | {
      state: "won";
      winner: Player;
      line: number[];
      lines: number[][];
      lineCount: number;
    }
  | { state: "draw" };

export type CompletedLine = {
  id: string;
  player: Player;
  cells: number[];
  direction: readonly [number, number, number];
  lineLength: number;
};

export type GameSnapshot = {
  board: Uint8Array;
  dimensions: BoardDimensions;
  currentPlayer: Player;
  winCondition: WinCondition;
  completedLines: CompletedLine[];
  lastMove: PlacedMove | null;
  moveHistory: PlacedMove[];
  status: GameStatus;
};

export type ReplayMove = Move & {
  kind?: PlacedMoveKind;
  special?: PlacedMoveSpecial;
};

export const DIRECTIONS: readonly [number, number, number][] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 1, 0],
  [1, -1, 0],
  [0, 1, 1],
  [0, 1, -1],
  [1, 0, 1],
  [1, 0, -1],
  [1, 1, 1],
  [1, 1, -1],
  [1, -1, 1],
  [1, -1, -1],
];

export type ApplyMoveOptions = {
  advanceTurn?: boolean;
  special?: PlacedMoveSpecial;
};

type CellCoordinate = {
  height: number;
  row: number;
  col: number;
};

export function createGame(
  winCondition: WinCondition = DEFAULT_WIN_CONDITION,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): GameSnapshot {
  const normalizedWinCondition = normalizeWinCondition(winCondition);
  const normalizedDimensions = normalizeBoardDimensions(dimensions);

  return {
    board: new Uint8Array(cellCount(normalizedDimensions)),
    dimensions: normalizedDimensions,
    currentPlayer: 1,
    winCondition: normalizedWinCondition,
    completedLines: [],
    lastMove: null,
    moveHistory: [],
    status: { state: "playing", currentPlayer: 1 },
  };
}

export function replayMoves(
  moves: readonly ReplayMove[],
  winCondition: WinCondition = DEFAULT_WIN_CONDITION,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): GameSnapshot {
  return moves.reduce(
    (game, move) => applyReplayMove(game, move),
    createGame(winCondition, dimensions),
  );
}

export function applyReplayMove(
  game: GameSnapshot,
  move: ReplayMove,
): GameSnapshot {
  if (move.kind === "blocker") return applyBlocker(game, move);

  if (
    move.special?.action === "double-adjacent" &&
    move.special.step === "first"
  ) {
    return applyDoubleAdjacentFirst(game, move);
  }

  if (
    move.special?.action === "double-adjacent" &&
    move.special.step === "second"
  ) {
    const origin = getPendingDoubleAdjacentOrigin(game);
    if (!origin) {
      throw new Error("Double adjacent replay is missing its first piece");
    }

    return applyDoubleAdjacentSecond(game, move, origin);
  }

  return applyMove(game, move, move.special ? { special: move.special } : {});
}

export function cloneGame(game: GameSnapshot): GameSnapshot {
  return {
    board: game.board.slice(),
    dimensions: cloneBoardDimensions(game.dimensions),
    currentPlayer: game.currentPlayer,
    winCondition: cloneWinCondition(game.winCondition),
    completedLines: game.completedLines.map(cloneCompletedLine),
    lastMove: game.lastMove ? clonePlacedMove(game.lastMove) : null,
    moveHistory: game.moveHistory.map(clonePlacedMove),
    status: cloneStatus(game.status),
  };
}

export function indexOf(
  height: number,
  row: number,
  col: number,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): number {
  assertBounds(height, row, col, dimensions);
  return (
    height + row * dimensions.height + col * dimensions.height * dimensions.rows
  );
}

export function cellFromIndex(
  index: number,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): {
  height: number;
  row: number;
  col: number;
} {
  const cells = cellCount(dimensions);
  if (index < 0 || index >= cells) {
    throw new RangeError(`Cell index ${index} is outside the board`);
  }

  const height = index % dimensions.height;
  const rest = Math.floor(index / dimensions.height);
  const row = rest % dimensions.rows;
  const col = Math.floor(rest / dimensions.rows);

  return { height, row, col };
}

export function getCell(
  board: Uint8Array,
  height: number,
  row: number,
  col: number,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): Cell {
  return board[indexOf(height, row, col, dimensions)] as Cell;
}

export function legalMoves(
  board: Uint8Array,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): Move[] {
  const moves: Move[] = [];

  for (let col = 0; col < dimensions.columns; col += 1) {
    for (let row = 0; row < dimensions.rows; row += 1) {
      if (getCell(board, dimensions.height - 1, row, col, dimensions) === 0) {
        moves.push({ row, col });
      }
    }
  }

  return moves;
}

export function getDropHeight(
  board: Uint8Array,
  move: Move,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): number {
  assertColumn(move, dimensions);

  for (let height = 0; height < dimensions.height; height += 1) {
    if (getCell(board, height, move.row, move.col, dimensions) === 0) {
      return height;
    }
  }

  return -1;
}

export function applyMove(
  game: GameSnapshot,
  move: Move,
  options: ApplyMoveOptions = {},
): GameSnapshot {
  if (game.status.state !== "playing") {
    throw new Error("Cannot play a move after the game is over");
  }

  assertColumn(move, game.dimensions);

  const height = getDropHeight(game.board, move, game.dimensions);
  if (height < 0) {
    throw new Error(`Column row=${move.row}, col=${move.col} is full`);
  }

  const next = cloneGame(game);
  const player = game.currentPlayer;
  const cellIndex = indexOf(height, move.row, move.col, game.dimensions);
  next.board[cellIndex] = player;

  const placed: PlacedMove = {
    ...move,
    height,
    player,
    kind: "piece",
    ...(options.special ? { special: options.special } : {}),
  };
  next.lastMove = placed;
  next.moveHistory.push(placed);

  next.completedLines = findCompletedLineSegments(
    next.board,
    next.winCondition,
    undefined,
    next.dimensions,
  );
  const playerLines = next.completedLines.filter(
    (line) => line.player === player,
  );
  if (playerLines.length >= next.winCondition.linesToWin) {
    const winLines = playerLines.map((line) => line.cells);
    next.status = {
      state: "won",
      winner: player,
      line: mergeLineCells(winLines),
      lines: winLines,
      lineCount: winLines.length,
    };
    return next;
  }

  if (legalMoves(next.board, next.dimensions).length === 0) {
    next.status = { state: "draw" };
    return next;
  }

  if (options.advanceTurn === false) {
    next.status = { state: "playing", currentPlayer: player };
    return next;
  }

  next.currentPlayer = otherPlayer(player);
  next.status = { state: "playing", currentPlayer: next.currentPlayer };
  return next;
}

export function applyBlocker(game: GameSnapshot, move: Move): GameSnapshot {
  if (game.status.state !== "playing") {
    throw new Error("Cannot play a blocker after the game is over");
  }

  assertColumn(move, game.dimensions);

  const height = getDropHeight(game.board, move, game.dimensions);
  if (height < 0) {
    throw new Error(`Column row=${move.row}, col=${move.col} is full`);
  }

  const next = cloneGame(game);
  const player = game.currentPlayer;
  const cellIndex = indexOf(height, move.row, move.col, game.dimensions);
  next.board[cellIndex] = BLOCKER_CELL;

  if (legalMoves(next.board, next.dimensions).length === 0) {
    throw new Error("Blocker must leave a legal piece move");
  }

  const placed: PlacedMove = {
    ...move,
    height,
    player,
    kind: "blocker",
    special: { action: "blocker-combo", step: "blocker" },
  };
  next.lastMove = placed;
  next.moveHistory.push(placed);
  next.status = { state: "playing", currentPlayer: player };

  return next;
}

export function applyDoubleAdjacentFirst(
  game: GameSnapshot,
  move: Move,
): GameSnapshot {
  const next = applyMove(game, move, {
    advanceTurn: false,
    special: { action: "double-adjacent", step: "first" },
  });
  const origin = next.lastMove;

  if (
    next.status.state === "playing" &&
    origin &&
    legalDoubleAdjacentMoves(next.board, origin, next.dimensions).length === 0
  ) {
    throw new Error("Double adjacent must leave a legal adjacent move");
  }

  return next;
}

export function applyDoubleAdjacentSecond(
  game: GameSnapshot,
  move: Move,
  origin: PlacedMove,
): GameSnapshot {
  if (!isPendingDoubleAdjacentOrigin(game, origin)) {
    throw new Error("Double adjacent must continue from its first piece");
  }

  if (!isLegalDoubleAdjacentMove(game.board, move, origin, game.dimensions)) {
    throw new Error("Second piece must land adjacent to the first piece");
  }

  return applyMove(game, move, {
    special: { action: "double-adjacent", step: "second" },
  });
}

export function getPendingDoubleAdjacentOrigin(
  game: GameSnapshot,
): PlacedMove | null {
  const origin = game.lastMove;
  return origin && isPendingDoubleAdjacentOrigin(game, origin) ? origin : null;
}

export function legalDoubleAdjacentMoves(
  board: Uint8Array,
  origin: PlacedMove,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): Move[] {
  return legalMoves(board, dimensions).filter((move) =>
    isLegalDoubleAdjacentMove(board, move, origin, dimensions),
  );
}

export function isLegalDoubleAdjacentMove(
  board: Uint8Array,
  move: Move,
  origin: PlacedMove,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): boolean {
  const height = getDropHeight(board, move, dimensions);
  if (height < 0) return false;

  return areCellsAdjacent(origin, { height, row: move.row, col: move.col });
}

export function areCellsAdjacent(
  first: CellCoordinate,
  second: CellCoordinate,
): boolean {
  const heightDelta = Math.abs(first.height - second.height);
  const rowDelta = Math.abs(first.row - second.row);
  const colDelta = Math.abs(first.col - second.col);

  return (
    heightDelta <= 1 &&
    rowDelta <= 1 &&
    colDelta <= 1 &&
    heightDelta + rowDelta + colDelta > 0
  );
}

export function findWinningLine(
  board: Uint8Array,
  move: PlacedMove,
  winCondition: WinCondition = DEFAULT_WIN_CONDITION,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): number[] | null {
  if (move.kind === "blocker") return null;

  for (const direction of DIRECTIONS) {
    const line = collectLine(board, move, direction, dimensions);
    if (line.length >= winCondition.lineLength) {
      const center = indexOf(move.height, move.row, move.col, dimensions);
      const centerOffset = line.indexOf(center);
      const start = Math.max(
        0,
        Math.min(
          centerOffset - winCondition.lineLength + 1,
          line.length - winCondition.lineLength,
        ),
      );
      return line.slice(start, start + winCondition.lineLength);
    }
  }

  return null;
}

export function findCompletedLines(
  board: Uint8Array,
  player: Player,
  winCondition: WinCondition = DEFAULT_WIN_CONDITION,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): number[][] {
  return findCompletedLineSegments(board, winCondition, player, dimensions).map(
    (line) => [...line.cells],
  );
}

export function findCompletedLineSegments(
  board: Uint8Array,
  winCondition: WinCondition = DEFAULT_WIN_CONDITION,
  playerFilter?: Player,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): CompletedLine[] {
  const { lineLength } = normalizeWinCondition(winCondition);
  const lines: CompletedLine[] = [];
  const players: readonly Player[] = playerFilter ? [playerFilter] : [1, 2];

  for (let height = 0; height < dimensions.height; height += 1) {
    for (let row = 0; row < dimensions.rows; row += 1) {
      for (let col = 0; col < dimensions.columns; col += 1) {
        for (const direction of DIRECTIONS) {
          const [dh, dr, dc] = direction;

          for (const player of players) {
            if (
              isInBounds(height - dh, row - dr, col - dc, dimensions) &&
              getCell(board, height - dh, row - dr, col - dc, dimensions) ===
                player
            ) {
              continue;
            }

            const cells: number[] = [];
            let nextHeight = height;
            let nextRow = row;
            let nextCol = col;

            while (
              isInBounds(nextHeight, nextRow, nextCol, dimensions) &&
              getCell(board, nextHeight, nextRow, nextCol, dimensions) ===
                player
            ) {
              cells.push(indexOf(nextHeight, nextRow, nextCol, dimensions));
              nextHeight += dh;
              nextRow += dr;
              nextCol += dc;
            }

            if (cells.length >= lineLength) {
              lines.push({
                id: completedLineId(player, lineLength, cells),
                player,
                cells,
                direction,
                lineLength,
              });
            }
          }
        }
      }
    }
  }

  return lines;
}

export function normalizeWinCondition(
  winCondition: WinCondition,
): WinCondition {
  const lineLength = assertIntegerInRange(
    winCondition.lineLength,
    MIN_WIN_LINE_LENGTH,
    MAX_WIN_LINE_LENGTH,
    "Win line length",
  );
  const linesToWin = assertIntegerInRange(
    winCondition.linesToWin,
    MIN_LINES_TO_WIN,
    MAX_LINES_TO_WIN,
    "Lines to win",
  );

  return { lineLength, linesToWin };
}

export function normalizeBoardDimensions(
  dimensions: BoardDimensions,
): BoardDimensions {
  return {
    height: assertIntegerInRange(
      dimensions.height,
      MIN_BOARD_HEIGHT,
      MAX_BOARD_DIMENSION,
      "Board height",
    ),
    rows: assertIntegerInRange(
      dimensions.rows,
      MIN_BOARD_ROWS,
      MAX_BOARD_DIMENSION,
      "Board rows",
    ),
    columns: assertIntegerInRange(
      dimensions.columns,
      MIN_BOARD_COLUMNS,
      MAX_BOARD_DIMENSION,
      "Board columns",
    ),
  };
}

export function cellCount(dimensions: BoardDimensions): number {
  const normalized = normalizeBoardDimensions(dimensions);
  return normalized.height * normalized.rows * normalized.columns;
}

export function isDefaultBoardDimensions(dimensions: BoardDimensions): boolean {
  return sameBoardDimensions(dimensions, DEFAULT_BOARD_DIMENSIONS);
}

export function sameBoardDimensions(
  first: BoardDimensions,
  second: BoardDimensions,
): boolean {
  return (
    first.height === second.height &&
    first.rows === second.rows &&
    first.columns === second.columns
  );
}

export function otherPlayer(player: Player): Player {
  return player === 1 ? 2 : 1;
}

function collectLine(
  board: Uint8Array,
  move: PlacedMove,
  [dh, dr, dc]: readonly [number, number, number],
  dimensions: BoardDimensions,
): number[] {
  const backward = collectRay(board, move, -dh, -dr, -dc, dimensions).reverse();
  const center = indexOf(move.height, move.row, move.col, dimensions);
  const forward = collectRay(board, move, dh, dr, dc, dimensions);

  return [...backward, center, ...forward];
}

function collectRay(
  board: Uint8Array,
  move: PlacedMove,
  dh: number,
  dr: number,
  dc: number,
  dimensions: BoardDimensions,
): number[] {
  const cells: number[] = [];

  let height = move.height + dh;
  let row = move.row + dr;
  let col = move.col + dc;

  while (
    isInBounds(height, row, col) &&
    getCell(board, height, row, col, dimensions) === move.player
  ) {
    cells.push(indexOf(height, row, col, dimensions));
    height += dh;
    row += dr;
    col += dc;
  }

  return cells;
}

function cloneStatus(status: GameStatus): GameStatus {
  if (status.state === "won") {
    return {
      state: "won",
      winner: status.winner,
      line: [...status.line],
      lines: status.lines.map((line) => [...line]),
      lineCount: status.lineCount,
    };
  }

  if (status.state === "playing") {
    return { state: "playing", currentPlayer: status.currentPlayer };
  }

  return { state: "draw" };
}

function cloneWinCondition(winCondition: WinCondition): WinCondition {
  return {
    lineLength: winCondition.lineLength,
    linesToWin: winCondition.linesToWin,
  };
}

function cloneBoardDimensions(dimensions: BoardDimensions): BoardDimensions {
  return {
    height: dimensions.height,
    rows: dimensions.rows,
    columns: dimensions.columns,
  };
}

function cloneCompletedLine(line: CompletedLine): CompletedLine {
  return {
    id: line.id,
    player: line.player,
    cells: [...line.cells],
    direction: line.direction,
    lineLength: line.lineLength,
  };
}

function completedLineId(
  player: Player,
  lineLength: number,
  cells: readonly number[],
): string {
  return `${player}:${lineLength}:${cells.join("-")}`;
}

function mergeLineCells(lines: readonly (readonly number[])[]): number[] {
  return [...new Set(lines.flat())];
}

function assertIntegerInRange(
  value: number,
  min: number,
  max: number,
  label: string,
): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${label} must be an integer from ${min} to ${max}`);
  }

  return value;
}

function clonePlacedMove(move: PlacedMove): PlacedMove {
  return {
    ...move,
    ...(move.special ? { special: { ...move.special } } : {}),
  };
}

function isPendingDoubleAdjacentOrigin(
  game: GameSnapshot,
  origin: PlacedMove,
): boolean {
  const lastMove = game.lastMove;

  return (
    game.status.state === "playing" &&
    lastMove !== null &&
    origin.kind === "piece" &&
    origin.player === game.currentPlayer &&
    origin.special?.action === "double-adjacent" &&
    origin.special.step === "first" &&
    lastMove.kind === origin.kind &&
    lastMove.player === origin.player &&
    lastMove.height === origin.height &&
    lastMove.row === origin.row &&
    lastMove.col === origin.col &&
    lastMove.special?.action === origin.special.action &&
    lastMove.special?.step === origin.special.step
  );
}

function assertColumn(
  move: Move,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): void {
  if (
    move.row < 0 ||
    move.row >= dimensions.rows ||
    move.col < 0 ||
    move.col >= dimensions.columns
  ) {
    throw new RangeError(
      `Move row=${move.row}, col=${move.col} is outside the board`,
    );
  }
}

function assertBounds(
  height: number,
  row: number,
  col: number,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): void {
  if (!isInBounds(height, row, col, dimensions)) {
    throw new RangeError(
      `Cell h=${height}, row=${row}, col=${col} is outside the board`,
    );
  }
}

function isInBounds(
  height: number,
  row: number,
  col: number,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
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
