import { applyMove, createGame } from '@axial/core';
import { describe, expect, it } from 'vitest';
import { createPracticeGame, PRACTICE_WINNING_MOVE } from './practiceGame';

describe('tutorial practice board', () => {
	it('builds a legal unfinished match with varied short stacks', () => {
		const practice = createPracticeGame();
		let replay = createGame();
		for (const move of practice.moveHistory) {
			replay = applyMove(replay, move);
			expect(replay.status.state).toBe('playing');
		}
		expect(replay).toEqual(practice);
		expect(practice.moveHistory.filter((move) => move.height > 0).length).toBeGreaterThanOrEqual(6);
		expect(Math.max(...practice.moveHistory.map((move) => move.height))).toBe(2);
	});

	it('requires the fourth piece to complete a real winning line', () => {
		const game = createPracticeGame();
		expect(game.status).toEqual({ state: 'playing', currentPlayer: 1 });
		expect(game.completedLines).toHaveLength(0);
		const won = applyMove(game, PRACTICE_WINNING_MOVE);
		expect(won.status.state).toBe('won');
		expect(won.completedLines).toHaveLength(1);
		expect(won.lastMove).toMatchObject({ ...PRACTICE_WINNING_MOVE, player: 1, height: 0 });
		expect(game.moveHistory).toHaveLength(24);
		expect(createPracticeGame()).toEqual(game);
	});

	it('does not award a win for a piece outside the open end of the row', () => {
		const game = createPracticeGame();
		for (let row = 0; row < game.dimensions.rows; row++) {
			for (let col = 0; col < game.dimensions.columns; col++) {
				if (row === PRACTICE_WINNING_MOVE.row && col === PRACTICE_WINNING_MOVE.col) continue;
				expect(
					applyMove(game, { row, col }).status.state,
					`Unexpected win at row ${row}, column ${col}`
				).toBe('playing');
			}
		}
	});
});
