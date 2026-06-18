import type { BoardDimensions, Cell, Move } from '@axial/core';
import type { SerializableGameSnapshot } from '@axial/multiplayer-protocol';

export type ColumnSummary = Move & {
	height: number;
	top: Cell;
	full: boolean;
};

export function summarizeColumns(game: SerializableGameSnapshot): ColumnSummary[] {
	const columns: ColumnSummary[] = [];
	for (let row = 0; row < game.dimensions.rows; row += 1) {
		for (let col = 0; col < game.dimensions.columns; col += 1) {
			columns.push(summarizeColumn(game.board, game.dimensions, row, col));
		}
	}
	return columns;
}

function summarizeColumn(
	board: readonly number[],
	dimensions: BoardDimensions,
	row: number,
	col: number
): ColumnSummary {
	let height = 0;
	let top: Cell = 0;
	for (let layer = 0; layer < dimensions.height; layer += 1) {
		const value = board[indexOf(layer, row, col, dimensions)] as Cell;
		if (value !== 0) {
			height = layer + 1;
			top = value;
		}
	}
	return {
		row,
		col,
		height,
		top,
		full: height >= dimensions.height
	};
}

function indexOf(height: number, row: number, col: number, dimensions: BoardDimensions): number {
	return height + row * dimensions.height + col * dimensions.height * dimensions.rows;
}
