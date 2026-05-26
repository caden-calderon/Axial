import { describe, expect, it } from 'vitest';
import {
	BOARD_COLUMNS,
	BOARD_HEIGHT,
	BOARD_ROWS,
	applyMove,
	cellFromIndex,
	createGame,
	getDropHeight,
	indexOf,
	legalMoves
} from './index';

describe('Axial game core', () => {
	it('round trips coordinates through the flat index', () => {
		for (let col = 0; col < BOARD_COLUMNS; col += 1) {
			for (let row = 0; row < BOARD_ROWS; row += 1) {
				for (let height = 0; height < BOARD_HEIGHT; height += 1) {
					expect(cellFromIndex(indexOf(height, row, col))).toEqual({ height, row, col });
				}
			}
		}
	});

	it('starts with 42 playable columns', () => {
		const game = createGame();

		expect(legalMoves(game.board)).toHaveLength(BOARD_ROWS * BOARD_COLUMNS);
	});

	it('uses gravity when stacking pieces', () => {
		let game = createGame();

		game = applyMove(game, { row: 2, col: 3 });
		game = applyMove(game, { row: 2, col: 3 });

		expect(game.moveHistory[0]).toMatchObject({ height: 0, row: 2, col: 3, player: 1 });
		expect(game.moveHistory[1]).toMatchObject({ height: 1, row: 2, col: 3, player: 2 });
		expect(getDropHeight(game.board, { row: 2, col: 3 })).toBe(2);
	});

	it('detects a vertical height win', () => {
		let game = createGame();

		game = applyMove(game, { row: 0, col: 0 });
		game = applyMove(game, { row: 1, col: 0 });
		game = applyMove(game, { row: 0, col: 0 });
		game = applyMove(game, { row: 1, col: 0 });
		game = applyMove(game, { row: 0, col: 0 });
		game = applyMove(game, { row: 1, col: 0 });
		game = applyMove(game, { row: 0, col: 0 });

		expect(game.status).toMatchObject({ state: 'won', winner: 1 });
	});

	it('detects a row win on the floor', () => {
		let game = createGame();

		game = applyMove(game, { row: 0, col: 0 });
		game = applyMove(game, { row: 5, col: 0 });
		game = applyMove(game, { row: 1, col: 0 });
		game = applyMove(game, { row: 5, col: 1 });
		game = applyMove(game, { row: 2, col: 0 });
		game = applyMove(game, { row: 5, col: 2 });
		game = applyMove(game, { row: 3, col: 0 });

		expect(game.status).toMatchObject({ state: 'won', winner: 1 });
	});

	it('detects a 3D diagonal win', () => {
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

		expect(game.status).toMatchObject({ state: 'won', winner: 1 });
	});
});
