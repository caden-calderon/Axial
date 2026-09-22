import { describe, expect, it } from 'vitest';
import { applyMove, createGame, findCompletedLineSegments, indexOf } from '@axial/core';
import { completedLineCounts } from './linePresentation';

describe('multi-line progress', () => {
	it('starts both players at zero', () => {
		expect(completedLineCounts(createGame({ lineLength: 4, linesToWin: 3 }))).toEqual({
			1: 0,
			2: 0
		});
	});

	it('counts a maximal run once even after it is extended and keeps players separate', () => {
		const game = createGame({ lineLength: 4, linesToWin: 3 });
		for (let col = 0; col < 4; col += 1) game.board[indexOf(0, 0, col)] = 1;
		for (let col = 0; col < 5; col += 1) game.board[indexOf(0, 5, col)] = 2;
		game.completedLines = findCompletedLineSegments(game.board, game.winCondition);
		expect(completedLineCounts(game)).toEqual({ 1: 1, 2: 1 });
		const extended = applyMove(game, { row: 0, col: 4 });
		expect(completedLineCounts(extended)).toEqual({ 1: 1, 2: 1 });
		expect(extended.completedLines.find((line) => line.player === 1)?.cells).toHaveLength(5);
	});

	it('preserves crossing-line totals even when one move exceeds the target', () => {
		const game = createGame({ lineLength: 4, linesToWin: 2 });
		for (let offset = 0; offset < 4; offset += 1) {
			if (offset === 2) continue;
			game.board[indexOf(0, 2, offset)] = 1;
			game.board[indexOf(0, offset, 2)] = 1;
			game.board[indexOf(0, offset, offset)] = 1;
		}
		const won = applyMove(game, { row: 2, col: 2 });
		expect(won.status).toMatchObject({ state: 'won', lineCount: 3 });
		expect(completedLineCounts(won)).toEqual({ 1: 3, 2: 0 });
	});
});
