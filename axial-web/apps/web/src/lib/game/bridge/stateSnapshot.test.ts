import { describe, expect, it } from 'vitest';
import { createGameController } from '../state/gameController.svelte';
import { createAxialStateSnapshot } from './stateSnapshot';

describe('bridge state snapshot', () => {
	it('serializes compact semantic game state with one-based move coordinates', () => {
		const controller = createGameController();

		controller.setOpponentMode('ai');
		controller.setAiDifficulty('nightmare');
		controller.setBoardDimension('height', 7);
		controller.setBoardDimension('rows', 8);
		controller.setBoardDimension('columns', 9);
		controller.setWinLineLength(5);
		controller.setLinesToWin(2);
		controller.playMove({ row: 0, col: 1 });

		const snapshot = createAxialStateSnapshot(controller);

		expect(snapshot).toMatchObject({
			mode: 'classic',
			status: 'playing',
			opponentMode: 'ai',
			aiDifficulty: 'max',
			currentPlayer: 2,
			winner: null,
			moveCount: 1,
			boardDimensions: { height: 7, rows: 8, columns: 9 },
			winCondition: { lineLength: 5, linesToWin: 2 },
			settings: {
				theme: 'dark',
				labelsVisible: true,
				gridLayersVisible: true,
				confirmDrop: false
			},
			locks: {
				setupLocked: true,
				appearanceLocked: true
			}
		});
		expect(snapshot.lastMove).toEqual({
			row: 1,
			column: 2,
			layer: 1,
			player: 1,
			kind: 'piece'
		});
		expect(snapshot.moveHistory).toEqual([snapshot.lastMove]);
		expect(snapshot).not.toHaveProperty('board');
	});

	it('includes immediate winning moves from core move simulation', () => {
		const controller = createGameController();

		controller.playMove({ row: 0, col: 0 });
		controller.playMove({ row: 1, col: 0 });
		controller.playMove({ row: 0, col: 1 });
		controller.playMove({ row: 1, col: 1 });
		controller.playMove({ row: 0, col: 2 });
		controller.playMove({ row: 2, col: 0 });

		const snapshot = createAxialStateSnapshot(controller);

		expect(snapshot.currentPlayer).toBe(1);
		expect(snapshot.threatSummary?.currentPlayerWinningMoves).toContainEqual({
			row: 1,
			column: 4,
			layer: 1,
			player: 1,
			kind: 'piece'
		});
		expect(snapshot.threatSummary?.opponentWinningMoves).toEqual([]);
	});
});
