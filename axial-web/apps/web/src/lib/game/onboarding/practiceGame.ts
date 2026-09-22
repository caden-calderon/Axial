import { replayMoves, type Move } from '@axial/core';

export const PRACTICE_WINNING_MOVE: Move = { row: 3, col: 3 };

export function createPracticeGame() {
	// An ongoing match with short stacks leaves one clear winning drop for Player 1.
	return replayMoves([
		{ row: 3, col: 0 },
		{ row: 5, col: 0 },
		{ row: 3, col: 1 },
		{ row: 5, col: 2 },
		{ row: 3, col: 2 },
		{ row: 5, col: 4 },
		{ row: 1, col: 1 },
		{ row: 1, col: 1 },
		{ row: 1, col: 1 },
		{ row: 0, col: 4 },
		{ row: 2, col: 5 },
		{ row: 2, col: 5 },
		{ row: 0, col: 2 },
		{ row: 0, col: 4 },
		{ row: 0, col: 2 },
		{ row: 4, col: 5 },
		{ row: 1, col: 3 },
		{ row: 5, col: 0 },
		{ row: 5, col: 2 },
		{ row: 0, col: 4 },
		{ row: 2, col: 0 },
		{ row: 2, col: 0 },
		{ row: 0, col: 3 },
		{ row: 4, col: 1 }
	]);
}
