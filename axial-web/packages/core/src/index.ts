export const BOARD_HEIGHT = 6;
export const BOARD_ROWS = 6;
export const BOARD_COLUMNS = 7;
export const WIN_LENGTH = 4;
export const CELL_COUNT = BOARD_HEIGHT * BOARD_ROWS * BOARD_COLUMNS;

export type Player = 1 | 2;
export type Cell = 0 | Player;

export type Move = {
	row: number;
	col: number;
};

export type PlacedMove = Move & {
	height: number;
	player: Player;
};

export type GameStatus =
	| { state: 'playing'; currentPlayer: Player }
	| { state: 'won'; winner: Player; line: number[] }
	| { state: 'draw' };

export type GameSnapshot = {
	board: Uint8Array;
	currentPlayer: Player;
	lastMove: PlacedMove | null;
	moveHistory: PlacedMove[];
	status: GameStatus;
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
	[1, -1, -1]
];

export function createGame(): GameSnapshot {
	return {
		board: new Uint8Array(CELL_COUNT),
		currentPlayer: 1,
		lastMove: null,
		moveHistory: [],
		status: { state: 'playing', currentPlayer: 1 }
	};
}

export function cloneGame(game: GameSnapshot): GameSnapshot {
	return {
		board: game.board.slice(),
		currentPlayer: game.currentPlayer,
		lastMove: game.lastMove ? { ...game.lastMove } : null,
		moveHistory: game.moveHistory.map((move) => ({ ...move })),
		status: cloneStatus(game.status)
	};
}

export function indexOf(height: number, row: number, col: number): number {
	assertBounds(height, row, col);
	return height + row * BOARD_HEIGHT + col * BOARD_HEIGHT * BOARD_ROWS;
}

export function cellFromIndex(index: number): { height: number; row: number; col: number } {
	if (index < 0 || index >= CELL_COUNT) {
		throw new RangeError(`Cell index ${index} is outside the board`);
	}

	const height = index % BOARD_HEIGHT;
	const rest = Math.floor(index / BOARD_HEIGHT);
	const row = rest % BOARD_ROWS;
	const col = Math.floor(rest / BOARD_ROWS);

	return { height, row, col };
}

export function getCell(board: Uint8Array, height: number, row: number, col: number): Cell {
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

export function applyMove(game: GameSnapshot, move: Move): GameSnapshot {
	if (game.status.state !== 'playing') {
		throw new Error('Cannot play a move after the game is over');
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

	const placed: PlacedMove = { ...move, height, player };
	next.lastMove = placed;
	next.moveHistory.push(placed);

	const winLine = findWinningLine(next.board, placed);
	if (winLine) {
		next.status = { state: 'won', winner: player, line: winLine };
		return next;
	}

	if (legalMoves(next.board).length === 0) {
		next.status = { state: 'draw' };
		return next;
	}

	next.currentPlayer = otherPlayer(player);
	next.status = { state: 'playing', currentPlayer: next.currentPlayer };
	return next;
}

export function findWinningLine(board: Uint8Array, move: PlacedMove): number[] | null {
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
	[dh, dr, dc]: readonly [number, number, number]
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
	dc: number
): number[] {
	const cells: number[] = [];

	let height = move.height + dh;
	let row = move.row + dr;
	let col = move.col + dc;

	while (isInBounds(height, row, col) && getCell(board, height, row, col) === move.player) {
		cells.push(indexOf(height, row, col));
		height += dh;
		row += dr;
		col += dc;
	}

	return cells;
}

function cloneStatus(status: GameStatus): GameStatus {
	if (status.state === 'won') {
		return { state: 'won', winner: status.winner, line: [...status.line] };
	}

	if (status.state === 'playing') {
		return { state: 'playing', currentPlayer: status.currentPlayer };
	}

	return { state: 'draw' };
}

function assertColumn(move: Move): void {
	if (move.row < 0 || move.row >= BOARD_ROWS || move.col < 0 || move.col >= BOARD_COLUMNS) {
		throw new RangeError(`Move row=${move.row}, col=${move.col} is outside the board`);
	}
}

function assertBounds(height: number, row: number, col: number): void {
	if (!isInBounds(height, row, col)) {
		throw new RangeError(`Cell h=${height}, row=${row}, col=${col} is outside the board`);
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
