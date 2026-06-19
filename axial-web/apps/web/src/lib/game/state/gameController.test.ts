import { describe, expect, it, vi } from 'vitest';
import { BLOCKER_CELL, cellCount, createGame, indexOf } from '@axial/core';
import { GAME_OVER_MODAL_DELAY_MS } from '../animation';
import {
	classicAiSearchOptionsForGame,
	createGameController,
	remainingAiThinkingDelayMs
} from './gameController.svelte';

describe('game controller AI timing', () => {
	it('keeps visible thinking time meaningfully longer on stronger difficulties', () => {
		const easy = remainingAiThinkingDelayMs('easy', 0);
		const medium = remainingAiThinkingDelayMs('medium', 0);
		const hard = remainingAiThinkingDelayMs('hard', 0);
		const max = remainingAiThinkingDelayMs('nightmare', 0);

		expect(easy).toBeGreaterThan(0);
		expect(medium).toBeGreaterThan(easy);
		expect(hard).toBeGreaterThan(medium);
		expect(max).toBeGreaterThan(hard);
		expect(remainingAiThinkingDelayMs('nightmare', max)).toBe(0);
	});

	it('scales Max Classic search budget up on larger boards', () => {
		const defaultBoard = classicAiSearchOptionsForGame('nightmare', createGame());
		const largeBoard = classicAiSearchOptionsForGame(
			'nightmare',
			createGame(undefined, { height: 10, rows: 10, columns: 10 })
		);

		expect(defaultBoard.maxTimeMs).toBeGreaterThan(2000);
		expect(largeBoard.maxTimeMs).toBeGreaterThan(defaultBoard.maxTimeMs!);
		expect(largeBoard.simulations).toBeGreaterThan(defaultBoard.simulations!);
		expect(largeBoard.earlyExitVisits).toBeGreaterThan(defaultBoard.earlyExitVisits!);
		expect(largeBoard.earlyExitRatio).toBeGreaterThanOrEqual(defaultBoard.earlyExitRatio!);
	});
});

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

	it('keeps the board color editable during active matches', () => {
		const controller = createGameController();

		controller.setBoardColor('#abc');
		controller.playMove({ row: 0, col: 0 });
		controller.setBoardColor('#123456');

		expect(controller.boardColor).toBe('#123456');
		expect(controller.appearanceLocked).toBe(true);
	});

	it('arms and confirms board clicks when confirm drop is enabled', () => {
		const controller = createGameController();

		controller.toggleConfirmDrop();
		controller.selectOrPlayMove({ row: 0, col: 0 });

		expect(controller.confirmDropEnabled).toBe(true);
		expect(controller.game.moveHistory).toHaveLength(0);
		expect(controller.lockedMove).toEqual({ row: 0, col: 0 });
		expect(controller.previewMove).toEqual({ row: 0, col: 0 });

		controller.selectOrPlayMove({ row: 0, col: 1 });

		expect(controller.game.moveHistory).toHaveLength(0);
		expect(controller.lockedMove).toEqual({ row: 0, col: 1 });

		controller.selectOrPlayMove({ row: 0, col: 1 });

		expect(controller.game.moveHistory).toHaveLength(1);
		expect(controller.game.moveHistory[0]).toMatchObject({ row: 0, col: 1 });
		expect(controller.lockedMove).toBeNull();
	});

	it('clears an armed confirm drop when the option is turned off', () => {
		const controller = createGameController();

		controller.toggleConfirmDrop();
		controller.selectOrPlayMove({ row: 0, col: 0 });
		controller.toggleConfirmDrop();
		controller.selectOrPlayMove({ row: 0, col: 1 });

		expect(controller.confirmDropEnabled).toBe(false);
		expect(controller.lockedMove).toBeNull();
		expect(controller.game.moveHistory).toHaveLength(1);
		expect(controller.game.moveHistory[0]).toMatchObject({ row: 0, col: 1 });
	});

	it('toggles grid layers independently from axis labels', () => {
		const controller = createGameController();

		controller.toggleGridLayers();
		controller.toggleLabels();

		expect(controller.gridLayersVisible).toBe(false);
		expect(controller.labelsVisible).toBe(false);
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

	it('edits board dimensions before play and locks them after the first move', () => {
		const controller = createGameController();

		controller.setBoardDimension('height', 7);
		controller.setBoardDimension('rows', 8);
		controller.setBoardDimension('columns', 9);

		expect(controller.boardDimensions).toEqual({ height: 7, rows: 8, columns: 9 });
		expect(controller.game.dimensions).toEqual({ height: 7, rows: 8, columns: 9 });
		expect(controller.game.board).toHaveLength(cellCount(controller.boardDimensions));

		controller.playMove({ row: 7, col: 8 });
		controller.setBoardDimension('columns', 10);

		expect(controller.boardDimensions).toEqual({ height: 7, rows: 8, columns: 9 });
		expect(controller.moveError).toBe('Start a new match to change board size');
		expect(controller.setupLocked).toBe(true);
	});

	it('delays the game-over modal until the completed-line animation can finish', () => {
		vi.useFakeTimers();
		try {
			const controller = createGameController();

			playBottomRowWin(controller);

			expect(controller.game.status.state).toBe('won');
			expect(controller.game.completedLines).toHaveLength(1);
			expect(controller.showGameOverModal).toBe(false);

			vi.advanceTimersByTime(GAME_OVER_MODAL_DELAY_MS - 1);

			expect(controller.showGameOverModal).toBe(false);

			vi.advanceTimersByTime(1);

			expect(controller.showGameOverModal).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});

	it('cancels a delayed game-over modal when the match resets', () => {
		vi.useFakeTimers();
		try {
			const controller = createGameController();

			playBottomRowWin(controller);
			controller.resetGame();
			vi.advanceTimersByTime(GAME_OVER_MODAL_DELAY_MS);

			expect(controller.game.status.state).toBe('playing');
			expect(controller.showGameOverModal).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});

	it('alternates the starting player after each played match reset', () => {
		const controller = createGameController();

		expect(controller.currentPlayer).toBe(1);

		playBottomRowWin(controller);
		controller.resetGame();

		expect(controller.currentPlayer).toBe(2);

		controller.playMove({ row: 0, col: 0 });
		controller.resetGame();

		expect(controller.currentPlayer).toBe(1);
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

function playBottomRowWin(controller: ReturnType<typeof createGameController>): void {
	controller.playMove({ row: 0, col: 0 });
	controller.playMove({ row: 1, col: 0 });
	controller.playMove({ row: 0, col: 1 });
	controller.playMove({ row: 1, col: 1 });
	controller.playMove({ row: 0, col: 2 });
	controller.playMove({ row: 1, col: 2 });
	controller.playMove({ row: 0, col: 3 });
}
