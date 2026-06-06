import { describe, expect, it } from 'vitest';
import { BLOCKER_CELL, indexOf } from '@axial/core';
import { createGameController } from './gameController.svelte';

describe('game controller appearance lock', () => {
	it('locks piece shape and colors after the first placed piece until reset', () => {
		const controller = createGameController();

		controller.setPieceShape('orb');
		controller.setPieceColor(1, '#112233');
		controller.playMove({ row: 0, col: 0 });

		expect(controller.appearanceLocked).toBe(true);
		expect(controller.pieceShape).toBe('orb');
		expect(controller.pieceColors.playerOne).toBe('#112233');

		controller.setPieceShape('crystal');
		controller.setPieceColor(1, '#445566');

		expect(controller.pieceShape).toBe('orb');
		expect(controller.pieceColors.playerOne).toBe('#112233');

		controller.resetGame();
		controller.setPieceShape('crystal');
		controller.setPieceColor(1, '#445566');

		expect(controller.appearanceLocked).toBe(false);
		expect(controller.pieceShape).toBe('crystal');
		expect(controller.pieceColors.playerOne).toBe('#445566');
	});

	it('keeps appearance locked while reviewing an undone move', () => {
		const controller = createGameController();

		controller.playMove({ row: 0, col: 0 });
		controller.undoMove();

		expect(controller.game.moveHistory).toHaveLength(0);
		expect(controller.canRedo).toBe(true);
		expect(controller.appearanceLocked).toBe(true);
	});

	it('locks opponent and rules setup after the first placed piece', () => {
		const controller = createGameController();

		controller.setOpponentMode('ai');
		controller.setAiDifficulty('nightmare');
		controller.setMatchMode('tactical');
		controller.setWinLineLength(5);
		controller.setLinesToWin(2);
		controller.playMove({ row: 0, col: 0 });
		controller.setMatchMode('classic');
		controller.setOpponentMode('local');
		controller.setAiDifficulty('easy');
		controller.setWinLineLength(4);
		controller.setLinesToWin(1);

		expect(controller.matchMode).toBe('tactical');
		expect(controller.opponentMode).toBe('ai');
		expect(controller.aiDifficulty).toBe('nightmare');
		expect(controller.winCondition).toEqual({ lineLength: 5, linesToWin: 2 });
		expect(controller.game.winCondition).toEqual({ lineLength: 5, linesToWin: 2 });
		expect(controller.setupLocked).toBe(true);
	});

	it('plays a tactical blocker combo without advancing until the regular piece lands', () => {
		const controller = createGameController();

		controller.setMatchMode('tactical');

		expect(controller.activeSpecialCounts).toEqual({
			'blocker-combo': 2,
			'double-adjacent': 1
		});

		controller.toggleBlockerCombo();

		expect(controller.blockerTargeting).toBe(true);
		expect(controller.placementMode).toBe('blocker');

		controller.playMove({ row: 2, col: 3 });

		expect(controller.blockerTargeting).toBe(false);
		expect(controller.mustCompleteBlockerCombo).toBe(true);
		expect(controller.currentPlayer).toBe(1);
		expect(controller.activeSpecialCharges).toBe(2);
		expect(controller.activeSpecialCounts).toEqual({
			'blocker-combo': 1,
			'double-adjacent': 1
		});
		expect(controller.game.board[indexOf(0, 2, 3)]).toBe(BLOCKER_CELL);
		expect(controller.game.moveHistory[0]).toMatchObject({
			kind: 'blocker',
			height: 0,
			row: 2,
			col: 3,
			player: 1,
			special: { action: 'blocker-combo', step: 'blocker' }
		});

		controller.playMove({ row: 2, col: 3 });

		expect(controller.mustCompleteBlockerCombo).toBe(false);
		expect(controller.currentPlayer).toBe(2);
		expect(controller.game.board[indexOf(1, 2, 3)]).toBe(1);
		expect(controller.game.moveHistory[1]).toMatchObject({
			kind: 'piece',
			height: 1,
			row: 2,
			col: 3,
			player: 1
		});
	});

	it('plays a tactical double-adjacent special as two same-player pieces', () => {
		const controller = createGameController();

		controller.setMatchMode('tactical');
		controller.toggleDoubleAdjacent();

		expect(controller.selectedSpecial).toBe('double-adjacent');
		expect(controller.placementMode).toBe('piece');

		controller.playMove({ row: 2, col: 3 });

		expect(controller.selectedSpecial).toBeNull();
		expect(controller.mustCompleteDoubleAdjacent).toBe(true);
		expect(controller.placementMode).toBe('double-adjacent');
		expect(controller.currentPlayer).toBe(1);
		expect(controller.activeSpecialCharges).toBe(2);
		expect(controller.activeSpecialCounts).toEqual({
			'blocker-combo': 2,
			'double-adjacent': 0
		});
		expect(controller.canUseDoubleAdjacent).toBe(false);
		expect(controller.game.board[indexOf(0, 2, 3)]).toBe(1);
		expect(controller.game.moveHistory[0]).toMatchObject({
			kind: 'piece',
			height: 0,
			row: 2,
			col: 3,
			player: 1,
			special: { action: 'double-adjacent', step: 'first' }
		});

		controller.playMove({ row: 5, col: 6 });

		expect(controller.mustCompleteDoubleAdjacent).toBe(true);
		expect(controller.currentPlayer).toBe(1);
		expect(controller.moveError).toContain('adjacent');

		controller.playMove({ row: 2, col: 3 });

		expect(controller.mustCompleteDoubleAdjacent).toBe(false);
		expect(controller.currentPlayer).toBe(2);
		expect(controller.game.board[indexOf(1, 2, 3)]).toBe(1);
		expect(controller.game.moveHistory[1]).toMatchObject({
			kind: 'piece',
			height: 1,
			row: 2,
			col: 3,
			player: 1,
			special: { action: 'double-adjacent', step: 'second' }
		});
	});

	it('rebuilds pending double-adjacent state through undo and redo', () => {
		const controller = createGameController();

		controller.setMatchMode('tactical');
		controller.toggleDoubleAdjacent();
		controller.playMove({ row: 2, col: 3 });
		controller.playMove({ row: 2, col: 3 });

		controller.undoMove();

		expect(controller.currentPlayer).toBe(1);
		expect(controller.mustCompleteDoubleAdjacent).toBe(true);
		expect(controller.game.moveHistory).toHaveLength(1);

		controller.redoMove();

		expect(controller.currentPlayer).toBe(2);
		expect(controller.mustCompleteDoubleAdjacent).toBe(false);
		expect(controller.game.moveHistory.map((move) => move.player)).toEqual([1, 1]);
	});
});
