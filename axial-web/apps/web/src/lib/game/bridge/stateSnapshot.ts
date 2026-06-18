import {
	applyMove,
	cloneGame,
	legalMoves,
	otherPlayer,
	type GameSnapshot,
	type PlacedMove,
	type Player
} from '@axial/core';
import type { AiDifficulty, GameController } from '../state/gameController.svelte';
import type {
	AxialBridgeAiDifficulty,
	AxialBridgeMove,
	AxialBridgeStatus,
	AxialStateSnapshot
} from './protocol';

const MAX_REPORTED_WINNING_MOVES = 12;

export function createAxialStateSnapshot(controller: GameController): AxialStateSnapshot {
	const game = controller.game;
	const currentPlayer = game.status.state === 'playing' ? game.currentPlayer : null;
	const winner = game.status.state === 'won' ? game.status.winner : null;

	return {
		mode: controller.matchMode,
		status: toBridgeStatus(game),
		opponentMode: controller.opponentMode,
		aiDifficulty: toBridgeAiDifficulty(controller.aiDifficulty),
		currentPlayer,
		winner,
		moveCount: game.moveHistory.length,
		boardDimensions: {
			height: game.dimensions.height,
			rows: game.dimensions.rows,
			columns: game.dimensions.columns
		},
		winCondition: {
			lineLength: game.winCondition.lineLength,
			linesToWin: game.winCondition.linesToWin
		},
		lastMove: game.lastMove ? toBridgeMove(game.lastMove) : null,
		moveHistory: game.moveHistory.map(toBridgeMove),
		settings: {
			theme: controller.uiTheme,
			labelsVisible: controller.labelsVisible,
			gridLayersVisible: controller.gridLayersVisible,
			confirmDrop: controller.confirmDropEnabled,
			boardColor: controller.boardColor
		},
		locks: {
			setupLocked: controller.setupLocked,
			appearanceLocked: controller.appearanceLocked
		},
		aiThinking: controller.aiThinking,
		...(currentPlayer ? { threatSummary: createThreatSummary(game, currentPlayer) } : {})
	};
}

export function toBridgeAiDifficulty(difficulty: AiDifficulty): AxialBridgeAiDifficulty {
	return difficulty === 'nightmare' ? 'max' : difficulty;
}

export function toBridgeMove(move: PlacedMove): AxialBridgeMove {
	return {
		row: move.row + 1,
		column: move.col + 1,
		layer: move.height + 1,
		player: move.player,
		kind: move.kind,
		...(move.special ? { special: { ...move.special } } : {})
	};
}

function toBridgeStatus(game: GameSnapshot): AxialBridgeStatus {
	if (game.status.state === 'won') return 'won';
	if (game.status.state === 'draw') return 'draw';
	return 'playing';
}

function createThreatSummary(game: GameSnapshot, currentPlayer: Player) {
	const opponent = otherPlayer(currentPlayer);

	return {
		currentPlayerWinningMoves: winningMovesForPlayer(game, currentPlayer),
		opponentWinningMoves: winningMovesForPlayer(game, opponent),
		currentPlayerCompletedLines: completedLineCount(game, currentPlayer),
		opponentCompletedLines: completedLineCount(game, opponent)
	};
}

function completedLineCount(game: GameSnapshot, player: Player): number {
	return game.completedLines.filter((line) => line.player === player).length;
}

function winningMovesForPlayer(game: GameSnapshot, player: Player): AxialBridgeMove[] {
	if (game.status.state !== 'playing') return [];

	const playerGame = gameWithCurrentPlayer(game, player);
	const winningMoves: AxialBridgeMove[] = [];

	for (const move of legalMoves(playerGame.board, playerGame.dimensions)) {
		try {
			const next = applyMove(playerGame, move);
			if (next.status.state === 'won' && next.status.winner === player && next.lastMove) {
				winningMoves.push(toBridgeMove(next.lastMove));
				if (winningMoves.length >= MAX_REPORTED_WINNING_MOVES) break;
			}
		} catch {
			continue;
		}
	}

	return winningMoves;
}

function gameWithCurrentPlayer(game: GameSnapshot, player: Player): GameSnapshot {
	const next = cloneGame(game);
	next.currentPlayer = player;
	next.status = { state: 'playing', currentPlayer: player };
	return next;
}
