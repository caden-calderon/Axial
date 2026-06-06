import {
  BLOCKER_CELL,
  BOARD_HEIGHT,
  CELL_COUNT,
  DEFAULT_WIN_CONDITION,
  indexOf,
  normalizeWinCondition,
  otherPlayer,
  type Cell,
  type GameSnapshot,
  type Player,
  type WinCondition,
} from "@axial/core";
import {
  CLASSIC_MOVE_COUNT,
  cellToMoveIndex,
  getSegmentTable,
  moveFromIndex,
  type MoveIndex,
  type SegmentTable,
} from "./geometry";

type StackEntry = {
  cellIndex: number;
  moveIndex: MoveIndex;
  player: Player;
  previousWinner: Player | null;
  previousWinningLine: readonly number[] | null;
  previousWinningLines: readonly (readonly number[])[] | null;
  previousPlayerOneLineCount: number;
  previousPlayerTwoLineCount: number;
};

export class ClassicSearchState {
  readonly winCondition: WinCondition;
  readonly segmentTable: SegmentTable;
  readonly board: Uint8Array;
  readonly heights: Uint8Array;
  readonly playerOneCounts: Uint8Array;
  readonly playerTwoCounts: Uint8Array;
  readonly blockedCounts: Uint8Array;
  readonly moveStack: StackEntry[];
  occupiedCells: number;
  winner: Player | null;
  winningLine: readonly number[] | null;
  winningLines: readonly (readonly number[])[] | null;
  playerOneLineCount: number;
  playerTwoLineCount: number;

  constructor(
    board: Uint8Array = new Uint8Array(CELL_COUNT),
    winCondition: WinCondition = DEFAULT_WIN_CONDITION,
  ) {
    this.winCondition = normalizeWinCondition(winCondition);
    this.segmentTable = getSegmentTable(this.winCondition.lineLength);
    this.board = board.slice();
    this.heights = new Uint8Array(CLASSIC_MOVE_COUNT);
    this.playerOneCounts = new Uint8Array(this.segmentTable.segments.length);
    this.playerTwoCounts = new Uint8Array(this.segmentTable.segments.length);
    this.blockedCounts = new Uint8Array(this.segmentTable.segments.length);
    this.moveStack = [];
    this.occupiedCells = 0;
    this.winner = null;
    this.winningLine = null;
    this.winningLines = null;
    this.playerOneLineCount = 0;
    this.playerTwoLineCount = 0;

    this.rebuildDerivedState();
  }

  static fromGame(game: GameSnapshot): ClassicSearchState {
    return new ClassicSearchState(game.board, game.winCondition);
  }

  clone(): ClassicSearchState {
    const next = new ClassicSearchState(
      new Uint8Array(CELL_COUNT),
      this.winCondition,
    );
    next.board.set(this.board);
    next.heights.set(this.heights);
    next.playerOneCounts.set(this.playerOneCounts);
    next.playerTwoCounts.set(this.playerTwoCounts);
    next.blockedCounts.set(this.blockedCounts);
    next.moveStack.push(...this.moveStack);
    next.occupiedCells = this.occupiedCells;
    next.winner = this.winner;
    next.winningLine = this.winningLine;
    next.winningLines = this.winningLines;
    next.playerOneLineCount = this.playerOneLineCount;
    next.playerTwoLineCount = this.playerTwoLineCount;
    return next;
  }

  legalMoveIndices(): MoveIndex[] {
    const moves: MoveIndex[] = [];

    for (let index = 0; index < CLASSIC_MOVE_COUNT; index += 1) {
      if (this.heights[index] < BOARD_HEIGHT) moves.push(index);
    }

    return moves;
  }

  isLegalMove(moveIndex: MoveIndex): boolean {
    return (
      moveIndex >= 0 &&
      moveIndex < CLASSIC_MOVE_COUNT &&
      this.heights[moveIndex] < BOARD_HEIGHT
    );
  }

  isDraw(): boolean {
    return this.winner === null && this.occupiedCells >= CELL_COUNT;
  }

  dropCellIndex(moveIndex: MoveIndex): number {
    if (!this.isLegalMove(moveIndex)) {
      throw new Error(`Move index ${moveIndex} is not legal`);
    }

    const move = moveFromIndex(moveIndex);
    return indexOf(this.heights[moveIndex], move.row, move.col);
  }

  isPlayableCell(cellIndex: number): boolean {
    if (this.board[cellIndex] !== 0) return false;

    const moveIndex = cellToMoveIndex(cellIndex);
    const move = moveFromIndex(moveIndex);
    const height = cellIndex % BOARD_HEIGHT;

    return height === this.heights[moveIndex] && this.isLegalMove(moveIndex);
  }

  makeMove(moveIndex: MoveIndex, player: Player): StackEntry {
    const cellIndex = this.dropCellIndex(moveIndex);
    const entry: StackEntry = {
      cellIndex,
      moveIndex,
      player,
      previousWinner: this.winner,
      previousWinningLine: this.winningLine,
      previousWinningLines: this.winningLines,
      previousPlayerOneLineCount: this.playerOneLineCount,
      previousPlayerTwoLineCount: this.playerTwoLineCount,
    };

    this.board[cellIndex] = player;
    this.heights[moveIndex] += 1;
    this.occupiedCells += 1;
    this.moveStack.push(entry);

    this.addCellToSegments(cellIndex, player);
    return entry;
  }

  unmakeMove(): StackEntry {
    const entry = this.moveStack.pop();
    if (!entry) throw new Error("Cannot unmake a move from an empty stack");

    this.removeCellFromSegments(entry.cellIndex, entry.player);
    this.board[entry.cellIndex] = 0;
    this.heights[entry.moveIndex] -= 1;
    this.occupiedCells -= 1;
    this.winner = entry.previousWinner;
    this.winningLine = entry.previousWinningLine;
    this.winningLines = entry.previousWinningLines;
    this.playerOneLineCount = entry.previousPlayerOneLineCount;
    this.playerTwoLineCount = entry.previousPlayerTwoLineCount;

    return entry;
  }

  completedLineCount(player: Player): number {
    return player === 1 ? this.playerOneLineCount : this.playerTwoLineCount;
  }

  nextPlayerAfterStack(rootPlayer: Player): Player {
    return this.moveStack.length % 2 === 0
      ? rootPlayer
      : otherPlayer(rootPlayer);
  }

  private rebuildDerivedState(): void {
    this.heights.fill(BOARD_HEIGHT);
    this.playerOneCounts.fill(0);
    this.playerTwoCounts.fill(0);
    this.blockedCounts.fill(0);
    this.occupiedCells = 0;
    this.winner = null;
    this.winningLine = null;
    this.winningLines = null;
    this.playerOneLineCount = 0;
    this.playerTwoLineCount = 0;

    for (let moveIndex = 0; moveIndex < CLASSIC_MOVE_COUNT; moveIndex += 1) {
      const move = moveFromIndex(moveIndex);
      let firstEmptyHeight = BOARD_HEIGHT;

      for (let height = 0; height < BOARD_HEIGHT; height += 1) {
        const cellIndex = indexOf(height, move.row, move.col);
        const cell = this.board[cellIndex] as Cell;

        if (cell === 0 && firstEmptyHeight === BOARD_HEIGHT) {
          firstEmptyHeight = height;
        }

        if (cell !== 0) {
          this.occupiedCells += 1;
          this.addCellToSegments(cellIndex, cell);
        }
      }

      this.heights[moveIndex] = firstEmptyHeight;
    }
  }

  private addCellToSegments(cellIndex: number, cell: Cell): void {
    for (const segmentId of this.segmentTable.cellSegments[cellIndex]) {
      if (cell === 1) {
        this.playerOneCounts[segmentId] += 1;
        if (this.isCompletedSegment(segmentId, 1)) {
          this.recomputeCompletedLines(1);
        }
      } else if (cell === 2) {
        this.playerTwoCounts[segmentId] += 1;
        if (this.isCompletedSegment(segmentId, 2)) {
          this.recomputeCompletedLines(2);
        }
      } else if (cell === BLOCKER_CELL) {
        this.blockedCounts[segmentId] += 1;
      }
    }
  }

  private removeCellFromSegments(cellIndex: number, player: Player): void {
    for (const segmentId of this.segmentTable.cellSegments[cellIndex]) {
      if (player === 1) {
        this.playerOneCounts[segmentId] -= 1;
      } else {
        this.playerTwoCounts[segmentId] -= 1;
      }
    }
  }

  private isCompletedSegment(segmentId: number, player: Player): boolean {
    if (this.blockedCounts[segmentId] > 0) return false;

    return player === 1
      ? this.playerOneCounts[segmentId] === this.winCondition.lineLength &&
          this.playerTwoCounts[segmentId] === 0
      : this.playerTwoCounts[segmentId] === this.winCondition.lineLength &&
          this.playerOneCounts[segmentId] === 0;
  }

  private recomputeCompletedLines(player: Player): void {
    const lines = this.completedLinesForPlayer(player);

    if (player === 1) {
      this.playerOneLineCount = lines.length;
    } else {
      this.playerTwoLineCount = lines.length;
    }

    if (lines.length < this.winCondition.linesToWin) {
      return;
    }

    this.winner = player;
    this.winningLines = lines;
    this.winningLine = mergeLineCells(lines);
  }

  private completedLinesForPlayer(
    player: Player,
  ): readonly (readonly number[])[] {
    const groups: { directionKey: string; cells: Set<number> }[] = [];

    for (const segment of this.segmentTable.segments) {
      if (!this.isCompletedSegment(segment.id, player)) continue;

      const directionKey = segment.direction.join(",");
      let targetGroup: { directionKey: string; cells: Set<number> } | null =
        null;

      for (const group of groups) {
        if (group.directionKey !== directionKey) continue;
        if (segment.cells.some((cell) => group.cells.has(cell))) {
          targetGroup = group;
          break;
        }
      }

      if (!targetGroup) {
        groups.push({
          directionKey,
          cells: new Set(segment.cells),
        });
        continue;
      }

      for (const cell of segment.cells) targetGroup.cells.add(cell);
    }

    return groups.map((group) =>
      [...group.cells].sort(compareCellsAlongMemory),
    );
  }
}

function mergeLineCells(lines: readonly (readonly number[])[]): number[] {
  return [...new Set(lines.flat())];
}

function compareCellsAlongMemory(first: number, second: number): number {
  return first - second;
}
