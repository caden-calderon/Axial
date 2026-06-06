export const BOARD_HEIGHT = 6;
export const BOARD_ROWS = 6;
export const BOARD_COLUMNS = 7;
export const WIN_LENGTH = 4;
export const CELL_COUNT = BOARD_HEIGHT * BOARD_ROWS * BOARD_COLUMNS;
export const BLOCKER_CELL = 3;

export type MatchMode = "classic" | "tactical";

export type MatchConfig = {
  mode: MatchMode;
  board: {
    height: number;
    rows: number;
    columns: number;
  };
  winLength: number;
  specialPieceSlots: number;
};

export const MATCH_MODE_LABELS: Record<MatchMode, string> = {
  classic: "Classic",
  tactical: "Tactical",
};

export const MATCH_CONFIGS: Record<MatchMode, MatchConfig> = {
  classic: {
    mode: "classic",
    board: {
      height: BOARD_HEIGHT,
      rows: BOARD_ROWS,
      columns: BOARD_COLUMNS,
    },
    winLength: WIN_LENGTH,
    specialPieceSlots: 0,
  },
  tactical: {
    mode: "tactical",
    board: {
      height: BOARD_HEIGHT,
      rows: BOARD_ROWS,
      columns: BOARD_COLUMNS,
    },
    winLength: WIN_LENGTH,
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
  | { state: "won"; winner: Player; line: number[] }
  | { state: "draw" };

export type GameSnapshot = {
  board: Uint8Array;
  currentPlayer: Player;
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

export function createGame(): GameSnapshot {
  return {
    board: new Uint8Array(CELL_COUNT),
    currentPlayer: 1,
    lastMove: null,
    moveHistory: [],
    status: { state: "playing", currentPlayer: 1 },
  };
}

export function replayMoves(moves: readonly ReplayMove[]): GameSnapshot {
  return moves.reduce((game, move) => applyReplayMove(game, move), createGame());
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
    currentPlayer: game.currentPlayer,
    lastMove: game.lastMove ? clonePlacedMove(game.lastMove) : null,
    moveHistory: game.moveHistory.map(clonePlacedMove),
    status: cloneStatus(game.status),
  };
}

export function indexOf(height: number, row: number, col: number): number {
  assertBounds(height, row, col);
  return height + row * BOARD_HEIGHT + col * BOARD_HEIGHT * BOARD_ROWS;
}

export function cellFromIndex(index: number): {
  height: number;
  row: number;
  col: number;
} {
  if (index < 0 || index >= CELL_COUNT) {
    throw new RangeError(`Cell index ${index} is outside the board`);
  }

  const height = index % BOARD_HEIGHT;
  const rest = Math.floor(index / BOARD_HEIGHT);
  const row = rest % BOARD_ROWS;
  const col = Math.floor(rest / BOARD_ROWS);

  return { height, row, col };
}

export function getCell(
  board: Uint8Array,
  height: number,
  row: number,
  col: number,
): Cell {
  return board[indexOf(height, row, col)] as Cell;
}

export function legalMoves(board: Uint8Array): Move[] {
  const moves: Move[] = [];

  for (let col = 0; col < BOARD_COLUMNS; col += 1) {
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      if (getCell(board, BOARD_HEIGHT - 1, row, col) === 0) {
        moves.push({ row, col });
      }
    }
  }

  return moves;
}

export function getDropHeight(board: Uint8Array, move: Move): number {
  assertColumn(move);

  for (let height = 0; height < BOARD_HEIGHT; height += 1) {
    if (getCell(board, height, move.row, move.col) === 0) {
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

  assertColumn(move);

  const height = getDropHeight(game.board, move);
  if (height < 0) {
    throw new Error(`Column row=${move.row}, col=${move.col} is full`);
  }

  const next = cloneGame(game);
  const player = game.currentPlayer;
  const cellIndex = indexOf(height, move.row, move.col);
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

  const winLine = findWinningLine(next.board, placed);
  if (winLine) {
    next.status = { state: "won", winner: player, line: winLine };
    return next;
  }

  if (legalMoves(next.board).length === 0) {
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

  assertColumn(move);

  const height = getDropHeight(game.board, move);
  if (height < 0) {
    throw new Error(`Column row=${move.row}, col=${move.col} is full`);
  }

  const next = cloneGame(game);
  const player = game.currentPlayer;
  const cellIndex = indexOf(height, move.row, move.col);
  next.board[cellIndex] = BLOCKER_CELL;

  if (legalMoves(next.board).length === 0) {
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
    legalDoubleAdjacentMoves(next.board, origin).length === 0
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

  if (!isLegalDoubleAdjacentMove(game.board, move, origin)) {
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
): Move[] {
  return legalMoves(board).filter((move) =>
    isLegalDoubleAdjacentMove(board, move, origin),
  );
}

export function isLegalDoubleAdjacentMove(
  board: Uint8Array,
  move: Move,
  origin: PlacedMove,
): boolean {
  const height = getDropHeight(board, move);
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
): number[] | null {
  if (move.kind === "blocker") return null;

  for (const direction of DIRECTIONS) {
    const line = collectLine(board, move, direction);
    if (line.length >= WIN_LENGTH) {
      return line;
    }
  }

  return null;
}

export function otherPlayer(player: Player): Player {
  return player === 1 ? 2 : 1;
}

function collectLine(
  board: Uint8Array,
  move: PlacedMove,
  [dh, dr, dc]: readonly [number, number, number],
): number[] {
  const backward = collectRay(board, move, -dh, -dr, -dc).reverse();
  const center = indexOf(move.height, move.row, move.col);
  const forward = collectRay(board, move, dh, dr, dc);

  return [...backward, center, ...forward];
}

function collectRay(
  board: Uint8Array,
  move: PlacedMove,
  dh: number,
  dr: number,
  dc: number,
): number[] {
  const cells: number[] = [];

  let height = move.height + dh;
  let row = move.row + dr;
  let col = move.col + dc;

  while (
    isInBounds(height, row, col) &&
    getCell(board, height, row, col) === move.player
  ) {
    cells.push(indexOf(height, row, col));
    height += dh;
    row += dr;
    col += dc;
  }

  return cells;
}

function cloneStatus(status: GameStatus): GameStatus {
  if (status.state === "won") {
    return { state: "won", winner: status.winner, line: [...status.line] };
  }

  if (status.state === "playing") {
    return { state: "playing", currentPlayer: status.currentPlayer };
  }

  return { state: "draw" };
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

function assertColumn(move: Move): void {
  if (
    move.row < 0 ||
    move.row >= BOARD_ROWS ||
    move.col < 0 ||
    move.col >= BOARD_COLUMNS
  ) {
    throw new RangeError(
      `Move row=${move.row}, col=${move.col} is outside the board`,
    );
  }
}

function assertBounds(height: number, row: number, col: number): void {
  if (!isInBounds(height, row, col)) {
    throw new RangeError(
      `Cell h=${height}, row=${row}, col=${col} is outside the board`,
    );
  }
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
