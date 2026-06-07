import { browser } from '$app/environment';
import { chooseMctsMove, chooseRandomMove } from '@axial/ai';
import {
	DEFAULT_WIN_CONDITION,
	MATCH_CONFIGS,
	applyBlocker,
	applyDoubleAdjacentFirst,
	applyDoubleAdjacentSecond,
	applyMove,
	cloneGame,
	createGame,
	getPendingDoubleAdjacentOrigin,
	legalMoves,
	normalizeWinCondition,
	replayMoves,
	type GameSnapshot,
	type MatchMode,
	type Move,
	type Player,
	type PlacedMove,
	type ReplayMove,
	type TacticalSpecialId,
	type WinCondition
} from '@axial/core';
import { SCENE_THEME_OPTIONS, type SceneThemeName, type UiThemeName } from '../theming/sceneThemes';
import {
	DEFAULT_PIECE_COLORS,
	normalizePieceColor,
	parsePieceShape,
	type PieceColors,
	type PieceShape
} from './pieceAppearance';
import { GAME_OVER_MODAL_DELAY_MS } from '../animation';
import { createClassicAiClient, type ClassicAiClient } from './classicAiClient';
import { createSessionRecord, recordCompletedGame, type SessionRecord } from './sessionRecord';

const STORAGE_KEYS = {
	uiTheme: 'axial-theme',
	sceneTheme: 'axial-scene-theme',
	labelsVisible: 'axial-axis-labels',
	opponentMode: 'axial-opponent-mode',
	aiDifficulty: 'axial-ai-difficulty',
	matchMode: 'axial-match-mode',
	winLineLength: 'axial-win-line-length',
	linesToWin: 'axial-lines-to-win',
	pieceShape: 'axial-piece-shape',
	playerOneColor: 'axial-piece-player-one',
	playerTwoColor: 'axial-piece-player-two'
} as const;

export type OpponentMode = 'local' | 'ai';
export type AiDifficulty = 'easy' | 'medium' | 'hard' | 'nightmare';

export const WIN_LINE_LENGTH_OPTIONS: readonly {
	value: number;
	label: string;
	shortLabel: string;
}[] = [
	{ value: 4, label: 'Connect 4', shortLabel: '4' },
	{ value: 5, label: 'Connect 5', shortLabel: '5' }
];

export const LINES_TO_WIN_OPTIONS: readonly {
	value: number;
	label: string;
	shortLabel: string;
}[] = [
	{ value: 1, label: '1 line', shortLabel: '1' },
	{ value: 2, label: '2 lines', shortLabel: '2' },
	{ value: 3, label: '3 lines', shortLabel: '3' }
];

export const AI_DIFFICULTY_OPTIONS: readonly {
	value: AiDifficulty;
	label: string;
	shortLabel: string;
}[] = [
	{ value: 'easy', label: 'Easy', shortLabel: 'Easy' },
	{ value: 'medium', label: 'Medium', shortLabel: 'Med' },
	{ value: 'hard', label: 'Hard', shortLabel: 'Hard' },
	{ value: 'nightmare', label: 'Nightmare', shortLabel: 'Max' }
];

const LOCAL_TURN_LABELS: Record<Player, string> = {
	1: "Player 1's turn",
	2: "Player 2's turn"
};

const AI_TURN_LABELS: Record<Player, string> = {
	1: 'Your turn',
	2: 'AI turn'
};

const LOCAL_RESULT_LABELS: Record<Player, string> = {
	1: 'Player 1',
	2: 'Player 2'
};

const AI_RESULT_LABELS: Record<Player, string> = {
	1: 'You',
	2: 'AI'
};

const AI_MOVE_DELAY_MS = 520;
const CLASSIC_AI_SEARCH_PRESETS = {
	easy: {
		simulations: 16,
		maxTimeMs: 70,
		smartRolloutRate: 0.45,
		earlyExitVisits: 12,
		earlyExitRatio: 0.92,
		useRave: false
	},
	medium: {
		simulations: 48,
		maxTimeMs: 140,
		smartRolloutRate: 0.58,
		earlyExitVisits: 28,
		earlyExitRatio: 0.9,
		useRave: true
	},
	hard: {
		simulations: 96,
		maxTimeMs: 220,
		smartRolloutRate: 0.68,
		earlyExitVisits: 48,
		earlyExitRatio: 0.9,
		useRave: true
	},
	nightmare: {
		simulations: 288,
		maxTimeMs: 900,
		smartRolloutRate: 0.78,
		earlyExitVisits: 120,
		earlyExitRatio: 0.88,
		useRave: true
	}
} as const satisfies Record<AiDifficulty, object>;

type MoveSource = 'human' | 'ai';
export type PlacementMode = 'piece' | 'blocker' | 'double-adjacent';
export type TacticalSpecialCounts = Record<TacticalSpecialId, number>;

export const TACTICAL_SPECIAL_LOADOUT: TacticalSpecialCounts = {
	'blocker-combo': 2,
	'double-adjacent': 1
};

export type GameController = ReturnType<typeof createGameController>;

export function createGameController() {
	let winCondition = $state<WinCondition>({ ...DEFAULT_WIN_CONDITION });
	let game = $state<GameSnapshot>(createGame(DEFAULT_WIN_CONDITION));
	let hoveredMove = $state<Move | null>(null);
	let uiTheme = $state<UiThemeName>('dark');
	let sceneTheme = $state<SceneThemeName>('prism');
	let labelsVisible = $state(true);
	let opponentMode = $state<OpponentMode>('local');
	let aiDifficulty = $state<AiDifficulty>('hard');
	let matchMode = $state<MatchMode>('classic');
	let pieceShape = $state<PieceShape>('cube');
	let pieceColors = $state<PieceColors>({ ...DEFAULT_PIECE_COLORS });
	let sessionRecord = $state<SessionRecord>(createSessionRecord());
	let moveError = $state('');
	let redoMoves = $state<ReplayMove[]>([]);
	let gameOverDismissed = $state(false);
	let gameOverModalReady = $state(false);
	let gameOverModalTimeout: ReturnType<typeof setTimeout> | null = null;
	let selectedSpecial = $state<TacticalSpecialId | null>(null);
	let aiThinking = $state(false);
	let aiMoveTimeout: ReturnType<typeof setTimeout> | null = null;
	let aiSearchRequestId = 0;
	let classicAiClient: ClassicAiClient | null = null;
	let matchId = 0;
	let recordedMatchId: number | null = null;

	const turnLabels = $derived(opponentMode === 'ai' ? AI_TURN_LABELS : LOCAL_TURN_LABELS);
	const resultLabels = $derived(opponentMode === 'ai' ? AI_RESULT_LABELS : LOCAL_RESULT_LABELS);

	const statusTone = $derived(
		game.status.state === 'won' ? `player-${game.status.winner}` : game.status.state
	);

	const arenaLabel = $derived(`${sceneLabel(sceneTheme)} Arena`);
	const matchConfig = $derived(MATCH_CONFIGS[matchMode]);
	const setupLocked = $derived(game.moveHistory.length > 0 || redoMoves.length > 0);
	const appearanceLocked = $derived(setupLocked);
	const canUndo = $derived(game.moveHistory.length > 0);
	const canRedo = $derived(redoMoves.length > 0);
	const showGameOverModal = $derived(
		game.status.state !== 'playing' && !gameOverDismissed && gameOverModalReady
	);
	const winnerLabel = $derived(
		game.status.state === 'won' ? resultLabels[game.status.winner] : null
	);
	const pendingDoubleAdjacentOrigin = $derived(getPendingDoubleAdjacentOrigin(game));
	const mustCompleteBlockerCombo = $derived(isCompletingBlockerCombo(game));
	const mustCompleteDoubleAdjacent = $derived(pendingDoubleAdjacentOrigin !== null);
	const pendingSpecial = $derived(
		mustCompleteBlockerCombo
			? 'blocker-combo'
			: mustCompleteDoubleAdjacent
				? 'double-adjacent'
				: null
	);
	const placementMode = $derived(
		selectedSpecial === 'blocker-combo'
			? 'blocker'
			: mustCompleteDoubleAdjacent
				? 'double-adjacent'
				: 'piece'
	);
	const specialCharges = $derived(remainingSpecialCharges(game.moveHistory, matchMode));
	const specialLoadoutSlots = $derived(sumSpecialCounts(specialLoadoutForMode(matchMode)));
	const activeSpecialCounts = $derived(
		game.status.state === 'playing' ? specialCharges[game.currentPlayer] : emptySpecialCounts()
	);
	const activeSpecialCharges = $derived(sumSpecialCounts(activeSpecialCounts));
	const canUseTacticalSpecial = $derived(
		matchMode === 'tactical' &&
			game.status.state === 'playing' &&
			!(opponentMode === 'ai' && game.currentPlayer === 2) &&
			!selectedSpecial &&
			!pendingSpecial
	);
	const canUseBlockerCombo = $derived(
		canUseTacticalSpecial && activeSpecialCounts['blocker-combo'] > 0 && canStartBlockerCombo(game)
	);
	const canUseDoubleAdjacent = $derived(
		canUseTacticalSpecial &&
			activeSpecialCounts['double-adjacent'] > 0 &&
			canStartDoubleAdjacent(game)
	);
	const activeTurnLabel = $derived(
		selectedSpecial === 'blocker-combo'
			? 'Place blocker'
			: selectedSpecial === 'double-adjacent'
				? 'Place first piece'
				: mustCompleteBlockerCombo
					? 'Place your piece'
					: mustCompleteDoubleAdjacent
						? 'Place adjacent piece'
						: aiThinking
							? 'AI thinking'
							: turnLabels[game.currentPlayer]
	);

	const currentLabel = $derived(
		game.status.state === 'playing'
			? activeTurnLabel
			: game.status.state === 'won'
				? `${resultLabels[game.status.winner]} wins`
				: 'Draw'
	);

	const statusTitle = $derived(
		game.status.state === 'playing'
			? activeTurnLabel
			: game.status.state === 'won'
				? `${resultLabels[game.status.winner]} controls the axis`
				: 'Equilibrium'
	);

	function hydrateFromStorage(): void {
		if (!browser) return;

		const savedUiTheme = parseUiTheme(localStorage.getItem(STORAGE_KEYS.uiTheme));
		const savedSceneTheme = parseSceneTheme(localStorage.getItem(STORAGE_KEYS.sceneTheme));
		const savedLabelsVisible = parseBoolean(localStorage.getItem(STORAGE_KEYS.labelsVisible));
		const savedOpponentMode = parseOpponentMode(localStorage.getItem(STORAGE_KEYS.opponentMode));
		const savedAiDifficulty = parseAiDifficulty(localStorage.getItem(STORAGE_KEYS.aiDifficulty));
		const savedMatchMode = parseMatchMode(localStorage.getItem(STORAGE_KEYS.matchMode));
		const savedWinCondition = parseWinCondition(
			localStorage.getItem(STORAGE_KEYS.winLineLength),
			localStorage.getItem(STORAGE_KEYS.linesToWin)
		);
		const savedPieceShape = parsePieceShape(localStorage.getItem(STORAGE_KEYS.pieceShape));

		if (savedUiTheme) uiTheme = savedUiTheme;
		if (savedSceneTheme) sceneTheme = savedSceneTheme;
		if (savedLabelsVisible !== null) labelsVisible = savedLabelsVisible;
		if (savedOpponentMode) opponentMode = savedOpponentMode;
		if (savedAiDifficulty) aiDifficulty = savedAiDifficulty;
		if (savedMatchMode) matchMode = savedMatchMode;
		if (savedWinCondition) {
			winCondition = savedWinCondition;
			game = createGame(winCondition);
		}
		if (savedPieceShape) pieceShape = savedPieceShape;

		pieceColors = {
			playerOne: normalizePieceColor(
				localStorage.getItem(STORAGE_KEYS.playerOneColor),
				DEFAULT_PIECE_COLORS.playerOne
			),
			playerTwo: normalizePieceColor(
				localStorage.getItem(STORAGE_KEYS.playerTwoColor),
				DEFAULT_PIECE_COLORS.playerTwo
			)
		};
	}

	function playMove(move: Move, source: MoveSource = 'human'): void {
		moveError = '';

		if (
			source === 'human' &&
			opponentMode === 'ai' &&
			game.status.state === 'playing' &&
			game.currentPlayer === 2
		) {
			moveError = 'AI is choosing a move';
			return;
		}

		if (source === 'human' && selectedSpecial === 'blocker-combo') {
			try {
				const movingPlayer = game.currentPlayer;
				game = applyBlocker(game, move);
				selectedSpecial = null;
				finishPlacement(source, movingPlayer);
			} catch (error) {
				moveError = error instanceof Error ? error.message : 'Blocker rejected';
			}
			return;
		}

		if (source === 'human' && selectedSpecial === 'double-adjacent') {
			try {
				const movingPlayer = game.currentPlayer;
				game = applyDoubleAdjacentFirst(game, move);
				selectedSpecial = null;
				finishPlacement(source, movingPlayer);
			} catch (error) {
				moveError = error instanceof Error ? error.message : 'Double adjacent rejected';
			}
			return;
		}

		if (source === 'human' && mustCompleteBlockerCombo) {
			try {
				const movingPlayer = game.currentPlayer;
				game = applyMove(game, move, {
					special: { action: 'blocker-combo', step: 'piece' }
				});
				finishPlacement(source, movingPlayer);
			} catch (error) {
				moveError = error instanceof Error ? error.message : 'Move rejected';
			}
			return;
		}

		if (source === 'human' && pendingDoubleAdjacentOrigin) {
			try {
				const movingPlayer = game.currentPlayer;
				game = applyDoubleAdjacentSecond(game, move, pendingDoubleAdjacentOrigin);
				finishPlacement(source, movingPlayer);
			} catch (error) {
				moveError = error instanceof Error ? error.message : 'Move rejected';
			}
			return;
		}

		try {
			const movingPlayer = game.currentPlayer;
			game = applyMove(game, move);
			finishPlacement(source, movingPlayer);
		} catch (error) {
			moveError = error instanceof Error ? error.message : 'Move rejected';
		}
	}

	function resetGame(): void {
		clearQueuedAiMove();
		clearGameOverModalDelay();
		matchId += 1;
		recordedMatchId = null;
		game = createGame(winCondition);
		hoveredMove = null;
		moveError = '';
		redoMoves = [];
		selectedSpecial = null;
		gameOverDismissed = false;
		gameOverModalReady = false;
	}

	function undoMove(): void {
		const lastMove = game.moveHistory.at(-1);
		if (!lastMove) return;

		clearQueuedAiMove();
		clearGameOverModalDelay();
		const previousMoves = game.moveHistory.slice(0, -1).map(toMove);
		redoMoves = [toMove(lastMove), ...redoMoves];
		game = replayMoves(previousMoves, winCondition);
		hoveredMove = null;
		moveError = '';
		selectedSpecial = null;
		gameOverDismissed = true;
		gameOverModalReady = false;
	}

	function redoMove(): void {
		const [nextMove, ...remainingMoves] = redoMoves;
		if (!nextMove) return;

		clearQueuedAiMove();
		clearGameOverModalDelay();
		moveError = '';

		try {
			game = replayMoves([...game.moveHistory.map(toMove), nextMove], winCondition);
			redoMoves = remainingMoves;
			hoveredMove = null;
			selectedSpecial = null;
			gameOverDismissed = false;
			recordMatchOutcome();
			queueGameOverModal();
		} catch (error) {
			moveError = error instanceof Error ? error.message : 'Move rejected';
		}
	}

	function rewindGame(): void {
		if (!canUndo && !canRedo) return;

		clearQueuedAiMove();
		clearGameOverModalDelay();
		redoMoves = [...game.moveHistory.map(toMove), ...redoMoves];
		game = createGame(winCondition);
		hoveredMove = null;
		moveError = '';
		selectedSpecial = null;
		gameOverDismissed = true;
		gameOverModalReady = false;
	}

	function dismissGameOver(): void {
		clearGameOverModalDelay();
		gameOverDismissed = true;
		gameOverModalReady = false;
	}

	function setHover(move: Move | null): void {
		hoveredMove = move;
	}

	function setSceneTheme(nextTheme: SceneThemeName): void {
		sceneTheme = nextTheme;
		persist(STORAGE_KEYS.sceneTheme, nextTheme);
	}

	function setOpponentMode(nextMode: OpponentMode): void {
		if (setupLocked) {
			moveError = 'Start a new match to change opponent mode';
			return;
		}

		clearQueuedAiMove();
		selectedSpecial = null;
		opponentMode = nextMode;
		persist(STORAGE_KEYS.opponentMode, nextMode);
		queueAiMove();
	}

	function setAiDifficulty(nextDifficulty: AiDifficulty): void {
		if (setupLocked) {
			moveError = 'Start a new match to change AI strength';
			return;
		}

		clearQueuedAiMove();
		aiDifficulty = nextDifficulty;
		persist(STORAGE_KEYS.aiDifficulty, nextDifficulty);
		queueAiMove();
	}

	function setMatchMode(nextMode: MatchMode): void {
		if (matchMode === nextMode) return;

		if (setupLocked) {
			moveError = 'Start a new match to change rules';
			return;
		}

		matchMode = nextMode;
		persist(STORAGE_KEYS.matchMode, nextMode);
		resetGame();
	}

	function setWinLineLength(lineLength: number): void {
		setWinCondition({ ...winCondition, lineLength });
	}

	function setLinesToWin(linesToWin: number): void {
		setWinCondition({ ...winCondition, linesToWin });
	}

	function setWinCondition(nextWinCondition: WinCondition): void {
		if (setupLocked) {
			moveError = 'Start a new match to change win rules';
			return;
		}

		let normalized: WinCondition;
		try {
			normalized = normalizeWinCondition(nextWinCondition);
		} catch (error) {
			moveError = error instanceof Error ? error.message : 'Unsupported win condition';
			return;
		}

		clearQueuedAiMove();
		clearGameOverModalDelay();
		winCondition = normalized;
		game = createGame(winCondition);
		redoMoves = [];
		selectedSpecial = null;
		gameOverDismissed = false;
		gameOverModalReady = false;
		persist(STORAGE_KEYS.winLineLength, String(winCondition.lineLength));
		persist(STORAGE_KEYS.linesToWin, String(winCondition.linesToWin));
	}

	function toggleBlockerCombo(): void {
		toggleSpecialAction('blocker-combo');
	}

	function toggleDoubleAdjacent(): void {
		toggleSpecialAction('double-adjacent');
	}

	function toggleSpecialAction(special: TacticalSpecialId): void {
		moveError = '';

		if (selectedSpecial === special) {
			selectedSpecial = null;
			hoveredMove = null;
			return;
		}

		if (selectedSpecial) {
			selectedSpecial = special;
			hoveredMove = null;
			return;
		}

		if (pendingSpecial) {
			moveError = 'Finish the current tactical action first';
			return;
		}

		const canUse = special === 'blocker-combo' ? canUseBlockerCombo : canUseDoubleAdjacent;
		if (!canUse) {
			moveError =
				matchMode === 'tactical'
					? 'That special is not available right now'
					: 'Switch to Tactical before starting the match';
			return;
		}

		selectedSpecial = special;
		hoveredMove = null;
	}

	function setPieceShape(nextShape: PieceShape): void {
		if (appearanceLocked) {
			moveError = 'Start a new match to change piece style';
			return;
		}

		pieceShape = nextShape;
		persist(STORAGE_KEYS.pieceShape, nextShape);
	}

	function setPieceColor(player: Player, color: string): void {
		if (appearanceLocked) {
			moveError = 'Start a new match to change piece colors';
			return;
		}

		if (player === 1) {
			const playerOne = normalizePieceColor(color, pieceColors.playerOne);
			pieceColors = { ...pieceColors, playerOne };
			persist(STORAGE_KEYS.playerOneColor, playerOne);
			return;
		}

		const playerTwo = normalizePieceColor(color, pieceColors.playerTwo);
		pieceColors = { ...pieceColors, playerTwo };
		persist(STORAGE_KEYS.playerTwoColor, playerTwo);
	}

	function toggleTheme(): void {
		uiTheme = uiTheme === 'dark' ? 'light' : 'dark';
		persist(STORAGE_KEYS.uiTheme, uiTheme);
	}

	function toggleLabels(): void {
		labelsVisible = !labelsVisible;
		persist(STORAGE_KEYS.labelsVisible, String(labelsVisible));
	}

	function recordMatchOutcome(): void {
		if (game.status.state === 'playing' || recordedMatchId === matchId) return;

		sessionRecord = recordCompletedGame(sessionRecord, game.status);
		recordedMatchId = matchId;
	}

	function finishPlacement(source: MoveSource, movingPlayer: Player): void {
		hoveredMove = null;
		redoMoves = [];
		gameOverDismissed = false;
		recordMatchOutcome();
		queueGameOverModal();

		if (
			source === 'human' &&
			movingPlayer === 1 &&
			game.status.state === 'playing' &&
			game.currentPlayer === 2
		) {
			queueAiMove();
		}
	}

	function queueAiMove(): void {
		if (
			!browser ||
			opponentMode !== 'ai' ||
			game.status.state !== 'playing' ||
			game.currentPlayer !== 2
		) {
			return;
		}

		clearQueuedAiMove();
		aiThinking = true;
		const requestId = aiSearchRequestId;
		aiMoveTimeout = setTimeout(() => {
			aiMoveTimeout = null;
			void runQueuedAiMove(requestId);
		}, AI_MOVE_DELAY_MS);
	}

	async function runQueuedAiMove(requestId: number): Promise<void> {
		if (!isCurrentAiTurn(requestId)) {
			aiThinking = false;
			return;
		}

		const requestGame = cloneGame(game);
		const requestMode = matchMode;
		const requestMatchId = matchId;
		const requestDifficulty = aiDifficulty;

		try {
			const move = await chooseAiMove(
				requestGame,
				requestMode,
				requestMatchId,
				requestDifficulty,
				getClassicAiClient
			);
			if (move && isCurrentAiTurn(requestId) && matchId === requestMatchId) {
				playMove(move, 'ai');
			}
		} catch (error) {
			if (!isAbortError(error) && isCurrentAiTurn(requestId)) {
				const move = chooseRandomMove(game);
				if (move) playMove(move, 'ai');
			}
		} finally {
			if (requestId === aiSearchRequestId) {
				aiThinking = false;
			}
		}
	}

	function clearQueuedAiMove(): void {
		aiSearchRequestId += 1;
		if (aiMoveTimeout) {
			clearTimeout(aiMoveTimeout);
			aiMoveTimeout = null;
		}

		classicAiClient?.cancelPending();
		aiThinking = false;
	}

	function queueGameOverModal(): void {
		clearGameOverModalDelay();
		gameOverModalReady = false;

		if (game.status.state === 'playing' || gameOverDismissed) return;

		if (game.status.state === 'draw') {
			gameOverModalReady = true;
			return;
		}

		gameOverModalTimeout = setTimeout(() => {
			gameOverModalTimeout = null;
			gameOverModalReady = true;
		}, GAME_OVER_MODAL_DELAY_MS);
	}

	function clearGameOverModalDelay(): void {
		if (!gameOverModalTimeout) return;

		clearTimeout(gameOverModalTimeout);
		gameOverModalTimeout = null;
	}

	function getClassicAiClient(): ClassicAiClient {
		classicAiClient ??= createClassicAiClient();
		return classicAiClient;
	}

	function isCurrentAiTurn(requestId: number): boolean {
		return (
			requestId === aiSearchRequestId &&
			opponentMode === 'ai' &&
			game.status.state === 'playing' &&
			game.currentPlayer === 2
		);
	}

	return {
		get aiThinking() {
			return aiThinking;
		},
		get arenaLabel() {
			return arenaLabel;
		},
		get appearanceLocked() {
			return appearanceLocked;
		},
		get activeSpecialCharges() {
			return activeSpecialCharges;
		},
		get activeSpecialCounts() {
			return activeSpecialCounts;
		},
		get activeBlockerCharges() {
			return activeSpecialCounts['blocker-combo'];
		},
		get blockerTargeting() {
			return selectedSpecial === 'blocker-combo';
		},
		get canRedo() {
			return canRedo;
		},
		get canUndo() {
			return canUndo;
		},
		get canUseBlockerCombo() {
			return canUseBlockerCombo;
		},
		get canUseDoubleAdjacent() {
			return canUseDoubleAdjacent;
		},
		get currentLabel() {
			return currentLabel;
		},
		get currentPlayer() {
			return game.status.state === 'playing' ? game.currentPlayer : null;
		},
		get game() {
			return game;
		},
		get hoveredMove() {
			return hoveredMove;
		},
		get labelsVisible() {
			return labelsVisible;
		},
		get matchConfig() {
			return matchConfig;
		},
		get specialLoadoutSlots() {
			return specialLoadoutSlots;
		},
		get matchMode() {
			return matchMode;
		},
		get winCondition() {
			return winCondition;
		},
		get moveError() {
			return moveError;
		},
		get opponentMode() {
			return opponentMode;
		},
		get aiDifficulty() {
			return aiDifficulty;
		},
		get placementMode() {
			return placementMode;
		},
		get pendingDoubleAdjacentOrigin() {
			return pendingDoubleAdjacentOrigin;
		},
		get pieceColors() {
			return pieceColors;
		},
		get pieceShape() {
			return pieceShape;
		},
		get sceneTheme() {
			return sceneTheme;
		},
		get sessionRecord() {
			return sessionRecord;
		},
		get setupLocked() {
			return setupLocked;
		},
		get showGameOverModal() {
			return showGameOverModal;
		},
		get mustCompleteBlockerCombo() {
			return mustCompleteBlockerCombo;
		},
		get mustCompleteDoubleAdjacent() {
			return mustCompleteDoubleAdjacent;
		},
		get selectedSpecial() {
			return selectedSpecial;
		},
		get statusTitle() {
			return statusTitle;
		},
		get statusTone() {
			return statusTone;
		},
		get uiTheme() {
			return uiTheme;
		},
		get winnerLabel() {
			return winnerLabel;
		},
		dismissGameOver,
		hydrateFromStorage,
		playMove,
		redoMove,
		resetGame,
		rewindGame,
		setHover,
		setAiDifficulty,
		setLinesToWin,
		setMatchMode,
		setOpponentMode,
		setPieceColor,
		setPieceShape,
		setSceneTheme,
		setWinLineLength,
		toggleLabels,
		toggleBlockerCombo,
		toggleDoubleAdjacent,
		toggleTheme,
		undoMove
	};
}

function parseUiTheme(value: string | null): UiThemeName | null {
	return value === 'dark' || value === 'light' ? value : null;
}

function parseSceneTheme(value: string | null): SceneThemeName | null {
	return SCENE_THEME_OPTIONS.some((option) => option.value === value)
		? (value as SceneThemeName)
		: null;
}

function parseBoolean(value: string | null): boolean | null {
	if (value === 'true') return true;
	if (value === 'false') return false;
	return null;
}

function parseOpponentMode(value: string | null): OpponentMode | null {
	return value === 'local' || value === 'ai' ? value : null;
}

function parseAiDifficulty(value: string | null): AiDifficulty | null {
	return AI_DIFFICULTY_OPTIONS.some((option) => option.value === value)
		? (value as AiDifficulty)
		: null;
}

function parseWinCondition(
	lineLengthValue: string | null,
	linesToWinValue: string | null
): WinCondition | null {
	if (lineLengthValue === null && linesToWinValue === null) return null;

	const lineLength =
		lineLengthValue === null ? DEFAULT_WIN_CONDITION.lineLength : Number(lineLengthValue);
	const linesToWin =
		linesToWinValue === null ? DEFAULT_WIN_CONDITION.linesToWin : Number(linesToWinValue);

	try {
		return normalizeWinCondition({ lineLength, linesToWin });
	} catch {
		return null;
	}
}

async function chooseAiMove(
	game: GameSnapshot,
	matchMode: MatchMode,
	matchId: number,
	aiDifficulty: AiDifficulty,
	getClassicAiClient: () => ClassicAiClient
): Promise<Move | null> {
	if (matchMode !== 'classic') return chooseRandomMove(game);

	const options = {
		...classicAiSearchOptionsForGame(aiDifficulty, game),
		seed: aiSeedForGame(game, matchId)
	};

	try {
		return (await getClassicAiClient().requestMove(game, options))?.move ?? chooseRandomMove(game);
	} catch (error) {
		if (isAbortError(error)) throw error;
		return chooseMctsMove(game, options) ?? chooseRandomMove(game);
	}
}

function classicAiSearchOptionsForGame(aiDifficulty: AiDifficulty, game: GameSnapshot) {
	const preset = CLASSIC_AI_SEARCH_PRESETS[aiDifficulty];
	const multiplier =
		1 +
		(game.winCondition.linesToWin - 1) * 0.34 +
		(game.winCondition.lineLength - DEFAULT_WIN_CONDITION.lineLength) * 0.16;

	return {
		...preset,
		simulations: Math.round(preset.simulations * multiplier),
		maxTimeMs: Math.round(preset.maxTimeMs * multiplier),
		earlyExitVisits: Math.round(preset.earlyExitVisits * Math.min(multiplier, 1.45))
	};
}

function aiSeedForGame(game: GameSnapshot, matchId: number): number {
	let hash = (0x811c9dc5 ^ matchId) >>> 0;

	for (const move of game.moveHistory) {
		hash ^= move.row + 1;
		hash = Math.imul(hash, 0x01000193);
		hash ^= (move.col + 1) << 8;
		hash = Math.imul(hash, 0x01000193);
		hash ^= (move.height + 1) << 16;
		hash = Math.imul(hash, 0x01000193);
		hash ^= move.player << 24;
		hash = Math.imul(hash, 0x01000193);
	}

	return hash >>> 0;
}

function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === 'AbortError';
}

function parseMatchMode(value: string | null): MatchMode | null {
	return value === 'classic' || value === 'tactical' ? value : null;
}

function persist(key: string, value: string): void {
	if (browser) localStorage.setItem(key, value);
}

function sceneLabel(sceneTheme: SceneThemeName): string {
	return SCENE_THEME_OPTIONS.find((option) => option.value === sceneTheme)?.label ?? 'Prism';
}

function remainingSpecialCharges(
	moveHistory: readonly PlacedMove[],
	matchMode: MatchMode
): Record<Player, TacticalSpecialCounts> {
	const loadout = specialLoadoutForMode(matchMode);
	return {
		1: remainingSpecialsForPlayer(moveHistory, 1, loadout),
		2: remainingSpecialsForPlayer(moveHistory, 2, loadout)
	};
}

function remainingSpecialsForPlayer(
	moveHistory: readonly PlacedMove[],
	player: Player,
	loadout: TacticalSpecialCounts
): TacticalSpecialCounts {
	return {
		'blocker-combo': Math.max(
			0,
			loadout['blocker-combo'] - countSpentSpecials(moveHistory, player, 'blocker-combo')
		),
		'double-adjacent': Math.max(
			0,
			loadout['double-adjacent'] - countSpentSpecials(moveHistory, player, 'double-adjacent')
		)
	};
}

function countSpentSpecials(
	moveHistory: readonly PlacedMove[],
	player: Player,
	special: TacticalSpecialId
): number {
	return moveHistory.filter((move) => {
		if (move.player !== player) return false;
		if (special === 'blocker-combo') return move.kind === 'blocker';
		return move.special?.action === 'double-adjacent' && move.special.step === 'first';
	}).length;
}

function specialLoadoutForMode(matchMode: MatchMode): TacticalSpecialCounts {
	return matchMode === 'tactical' ? TACTICAL_SPECIAL_LOADOUT : emptySpecialCounts();
}

function emptySpecialCounts(): TacticalSpecialCounts {
	return {
		'blocker-combo': 0,
		'double-adjacent': 0
	};
}

function sumSpecialCounts(counts: TacticalSpecialCounts): number {
	return counts['blocker-combo'] + counts['double-adjacent'];
}

function isCompletingBlockerCombo(game: GameSnapshot): boolean {
	return (
		game.status.state === 'playing' &&
		game.lastMove?.kind === 'blocker' &&
		game.lastMove.player === game.currentPlayer
	);
}

function canStartBlockerCombo(game: GameSnapshot): boolean {
	return legalMoves(game.board).some((move) => {
		try {
			applyBlocker(game, move);
			return true;
		} catch {
			return false;
		}
	});
}

function canStartDoubleAdjacent(game: GameSnapshot): boolean {
	return legalMoves(game.board).some((move) => {
		try {
			applyDoubleAdjacentFirst(game, move);
			return true;
		} catch {
			return false;
		}
	});
}

function toMove(move: PlacedMove): ReplayMove {
	return {
		row: move.row,
		col: move.col,
		kind: move.kind,
		...(move.special ? { special: { ...move.special } } : {})
	};
}
