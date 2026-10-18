import {
  BLOCKER_CELL,
  DIRECTIONS,
  DEFAULT_BOARD_DIMENSIONS,
  DEFAULT_WIN_CONDITION,
  cellCount,
  indexOf,
  normalizeBoardDimensions,
  normalizeWinCondition,
  otherPlayer,
  type BoardDimensions,
  type Cell,
  type GameSnapshot,
  type Player,
  type WinCondition,
} from "@axial/core";
import {
  getSegmentTable,
  moveCountForDimensions,
  moveFromIndex,
  type MoveIndex,
  type SegmentTable,
} from "./geometry";

type StackEntry = {
  cellIndex: number;
  moveIndex: MoveIndex;
  player: Player;
  previousWinner: Player | null;
  previousPlayerOneLineCount: number;
  previousPlayerTwoLineCount: number;
};

export class ClassicSearchState {
  readonly dimensions: BoardDimensions;
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
  playerOneLineCount: number;
  playerTwoLineCount: number;
  hashA: number;
  hashB: number;

  constructor(
    board?: Uint8Array,
    winCondition: WinCondition = DEFAULT_WIN_CONDITION,
    dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
  ) {
    this.dimensions = normalizeBoardDimensions(dimensions);
    this.winCondition = normalizeWinCondition(winCondition);
    this.segmentTable = getSegmentTable(
      this.winCondition.lineLength,
      this.dimensions,
    );
    this.board = board ? board.slice() : new Uint8Array(this.cellCount);
    if (this.board.length !== this.cellCount) {
      throw new RangeError(
        `Board has ${this.board.length} cells, expected ${this.cellCount}`,
      );
    }
    this.heights = new Uint8Array(this.moveCount);
    this.playerOneCounts = new Uint8Array(this.segmentTable.segments.length);
    this.playerTwoCounts = new Uint8Array(this.segmentTable.segments.length);
    this.blockedCounts = new Uint8Array(this.segmentTable.segments.length);
    this.moveStack = [];
    this.occupiedCells = 0;
    this.winner = null;
    this.playerOneLineCount = 0;
    this.playerTwoLineCount = 0;
    this.hashA = 0;
    this.hashB = 0;

    this.rebuildDerivedState();
  }

  /** The winner's completed lines. Only diagnostics read them, so they are built on demand. */
  get winningLines(): readonly (readonly number[])[] | null {
    return this.winner === null
      ? null
      : this.completedLinesForPlayer(this.winner);
  }

  get winningLine(): readonly number[] | null {
    const lines = this.winningLines;
    return lines ? mergeLineCells(lines) : null;
  }

  static fromGame(game: GameSnapshot): ClassicSearchState {
    return new ClassicSearchState(
      game.board,
      game.winCondition,
      game.dimensions,
    );
  }

  clone(): ClassicSearchState {
    const next = new ClassicSearchState(
      new Uint8Array(this.cellCount),
      this.winCondition,
      this.dimensions,
    );
    next.board.set(this.board);
    next.heights.set(this.heights);
    next.playerOneCounts.set(this.playerOneCounts);
    next.playerTwoCounts.set(this.playerTwoCounts);
    next.blockedCounts.set(this.blockedCounts);
    next.moveStack.push(...this.moveStack);
    next.occupiedCells = this.occupiedCells;
    next.winner = this.winner;
    next.playerOneLineCount = this.playerOneLineCount;
    next.playerTwoLineCount = this.playerTwoLineCount;
    next.hashA = this.hashA;
    next.hashB = this.hashB;
    return next;
  }

  legalMoveIndices(): MoveIndex[] {
    const moves: MoveIndex[] = [];

    for (let index = 0; index < this.moveCount; index += 1) {
      if (this.heights[index] < this.dimensions.height) moves.push(index);
    }

    return moves;
  }

  isLegalMove(moveIndex: MoveIndex): boolean {
    return (
      moveIndex >= 0 &&
      moveIndex < this.moveCount &&
      this.heights[moveIndex] < this.dimensions.height
    );
  }

  isDraw(): boolean {
    return this.winner === null && this.occupiedCells >= this.cellCount;
  }

  // The index helpers below run in the search's innermost loops, so they use plain arithmetic
  // rather than the validating, allocating helpers from @axial/core.
  dropCellIndex(moveIndex: MoveIndex): number {
    if (!this.isLegalMove(moveIndex)) {
      throw new Error(`Move index ${moveIndex} is not legal`);
    }

    const { height, rows, columns } = this.dimensions;
    const row = Math.floor(moveIndex / columns);
    const col = moveIndex - row * columns;
    return this.heights[moveIndex] + row * height + col * height * rows;
  }

  isPlayableCell(cellIndex: number): boolean {
    if (this.board[cellIndex] !== 0) return false;

    const { height, rows, columns } = this.dimensions;
    const cellHeight = cellIndex % height;
    const column = Math.floor(cellIndex / height);
    const row = column % rows;
    const col = Math.floor(column / rows);
    // An empty cell at its column's drop height is necessarily below the top, so it is legal.
    return cellHeight === this.heights[row * columns + col];
  }

  makeMove(moveIndex: MoveIndex, player: Player): StackEntry {
    const cellIndex = this.dropCellIndex(moveIndex);
    const entry: StackEntry = {
      cellIndex,
      moveIndex,
      player,
      previousWinner: this.winner,
      previousPlayerOneLineCount: this.playerOneLineCount,
      previousPlayerTwoLineCount: this.playerTwoLineCount,
    };

    this.board[cellIndex] = player;
    this.toggleCellHash(cellIndex, player);
    this.heights[moveIndex] += 1;
    this.occupiedCells += 1;
    this.moveStack.push(entry);

    this.addCellToSegments(cellIndex, player);
    const lineDelta = this.completedLineDelta(cellIndex, player);
    if (lineDelta !== 0) {
      if (player === 1) this.playerOneLineCount += lineDelta;
      else this.playerTwoLineCount += lineDelta;
      if (this.completedLineCount(player) >= this.winCondition.linesToWin) {
        this.winner = player;
      }
    }
    return entry;
  }

  unmakeMove(): StackEntry {
    const entry = this.moveStack.pop();
    if (!entry) throw new Error("Cannot unmake a move from an empty stack");

    this.removeCellFromSegments(entry.cellIndex, entry.player);
    this.toggleCellHash(entry.cellIndex, entry.player);
    this.board[entry.cellIndex] = 0;
    this.heights[entry.moveIndex] -= 1;
    this.occupiedCells -= 1;
    this.winner = entry.previousWinner;
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

  positionKey(playerToMove: Player): string {
    return `${this.hashA.toString(16)}:${this.hashB.toString(16)}:${playerToMove}`;
  }

  get cellCount(): number {
    return cellCount(this.dimensions);
  }

  get moveCount(): number {
    return moveCountForDimensions(this.dimensions);
  }

  private rebuildDerivedState(): void {
    this.heights.fill(this.dimensions.height);
    this.playerOneCounts.fill(0);
    this.playerTwoCounts.fill(0);
    this.blockedCounts.fill(0);
    this.occupiedCells = 0;
    this.winner = null;
    this.playerOneLineCount = 0;
    this.playerTwoLineCount = 0;
    this.hashA = 0;
    this.hashB = 0;

    for (let moveIndex = 0; moveIndex < this.moveCount; moveIndex += 1) {
      const move = moveFromIndex(moveIndex, this.dimensions);
      let firstEmptyHeight = this.dimensions.height;

      for (let height = 0; height < this.dimensions.height; height += 1) {
        const cellIndex = indexOf(height, move.row, move.col, this.dimensions);
        const cell = this.board[cellIndex] as Cell;

        if (cell === 0 && firstEmptyHeight === this.dimensions.height) {
          firstEmptyHeight = height;
        }

        if (cell !== 0) {
          this.occupiedCells += 1;
          this.toggleCellHash(cellIndex, cell);
          this.addCellToSegments(cellIndex, cell);
        }
      }

      this.heights[moveIndex] = firstEmptyHeight;
    }

    this.playerOneLineCount = this.completedLinesForPlayer(1).length;
    this.playerTwoLineCount = this.completedLinesForPlayer(2).length;
    if (this.playerOneLineCount >= this.winCondition.linesToWin) {
      this.winner = 1;
    } else if (this.playerTwoLineCount >= this.winCondition.linesToWin) {
      this.winner = 2;
    }
  }

  private addCellToSegments(cellIndex: number, cell: Cell): void {
    const counts =
      cell === 1
        ? this.playerOneCounts
        : cell === 2
          ? this.playerTwoCounts
          : cell === BLOCKER_CELL
            ? this.blockedCounts
            : null;
    if (!counts) return;
    for (const segmentId of this.segmentTable.cellSegments[cellIndex]) {
      counts[segmentId] += 1;
    }
  }

  /**
   * Change in `player`'s completed-line count from the piece just placed at `cellIndex`.
   * A line is a maximal straight run of at least lineLength, so in each direction the new
   * piece either creates a run, extends one (no change), or joins two runs into one (-1).
   * Only the 13 runs through the new cell can change, which replaces rescanning every segment.
   */
  private completedLineDelta(cellIndex: number, player: Player): number {
    const { height, rows, columns } = this.dimensions;
    const lineLength = this.winCondition.lineLength;
    const cellHeight = cellIndex % height;
    const column = Math.floor(cellIndex / height);
    const cellRow = column % rows;
    const cellCol = Math.floor(column / rows);
    let delta = 0;

    for (const [dh, dr, dc] of DIRECTIONS) {
      const stride = dh + dr * height + dc * height * rows;
      let before = 0;
      for (
        let h = cellHeight - dh,
          r = cellRow - dr,
          c = cellCol - dc,
          index = cellIndex - stride;
        h >= 0 &&
        h < height &&
        r >= 0 &&
        r < rows &&
        c >= 0 &&
        c < columns &&
        this.board[index] === player;
        h -= dh, r -= dr, c -= dc, index -= stride
      ) {
        before += 1;
      }
      let after = 0;
      for (
        let h = cellHeight + dh,
          r = cellRow + dr,
          c = cellCol + dc,
          index = cellIndex + stride;
        h >= 0 &&
        h < height &&
        r >= 0 &&
        r < rows &&
        c >= 0 &&
        c < columns &&
        this.board[index] === player;
        h += dh, r += dr, c += dc, index += stride
      ) {
        after += 1;
      }

      const runsBefore =
        (before >= lineLength ? 1 : 0) + (after >= lineLength ? 1 : 0);
      const runsAfter = before + after + 1 >= lineLength ? 1 : 0;
      delta += runsAfter - runsBefore;
    }

    return delta;
  }

  private toggleCellHash(cellIndex: number, cell: Cell): void {
    this.hashA = (this.hashA ^ hashCell(cellIndex, cell, 0x9e3779b9)) >>> 0;
    this.hashB = (this.hashB ^ hashCell(cellIndex, cell, 0x85ebca6b)) >>> 0;
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

function hashCell(cellIndex: number, cell: Cell, seed: number): number {
  let value =
    (Math.imul(cellIndex + 1, 0x27d4eb2d) ^
      Math.imul(cell + 1, 0x165667b1) ^
      seed) >>>
    0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x2c1b3c6d) >>> 0;
  value ^= value >>> 12;
  value = Math.imul(value, 0x297a2d39) >>> 0;
  return (value ^ (value >>> 15)) >>> 0;
}
