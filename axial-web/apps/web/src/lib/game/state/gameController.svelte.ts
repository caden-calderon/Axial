import { browser } from '$app/environment';
import { untrack } from 'svelte';
import {
	DEFAULT_BOARD_DIMENSIONS,
	DEFAULT_WIN_CONDITION,
	applyBlocker,
	applyDoubleAdjacentFirst,
	applyDoubleAdjacentSecond,
	applyMove,
	cloneGame,
	createGame,
	getPendingDoubleAdjacentOrigin,
	legalMoves,
	normalizeBoardDimensions,
	normalizeWinCondition,
	otherPlayer,
	replayMoves,
	type BoardDimensions,
	type GameSnapshot,
	type MatchMode,
	type Move,
	type Player,
	type PlacedMove,
	type PlacedMoveSpecial,
	type ReplayMove,
	type TacticalSpecialId,
	type WinCondition
} from '@axial/core';
import { DEFAULT_BOARD_COLOR, normalizeBoardColor, type UiThemeName } from '../theming/sceneThemes';
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
	boardColor: 'axial-board-color',
	labelsVisible: 'axial-axis-labels',
	gridLayersVisible: 'axial-grid-layers',
	confirmDropEnabled: 'axial-confirm-drop',
	opponentMode: 'axial-opponent-mode',
	aiDifficulty: 'axial-ai-difficulty',
	matchMode: 'axial-match-mode',
	boardHeight: 'axial-board-height',
	boardRows: 'axial-board-rows',
	boardColumns: 'axial-board-columns',
	winLineLength: 'axial-win-line-length',
	linesToWin: 'axial-lines-to-win',
	pieceShape: 'axial-piece-shape',
	playerOneColor: 'axial-piece-player-one',
	playerTwoColor: 'axial-piece-player-two',
	activeMatch: 'axial-active-match'
} as const;

const LEGACY_SCENE_THEME_KEY = 'axial-scene-theme';

export type OpponentMode = 'local' | 'ai';
export type PlayMode = OpponentMode | 'online';
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

const AI_MINIMUM_THINK_MS = {
	easy: 780,
	medium: 1180,
	hard: 1680,
	nightmare: 2450
} as const satisfies Record<AiDifficulty, number>;

type ClassicAiSearchOptions = {
	simulations?: number;
	maxTimeMs?: number;
	exploration?: number;
	progressiveBias?: number;
	lookaheadDepth?: number;
	lookaheadMaxMoves?: number;
	lookaheadRootMaxMoves?: number;
	lookaheadNodeLimit?: number;
	lookaheadWeight?: number;
	lookaheadOverrideMargin?: number;
	seed?: number;
	smartRolloutRate?: number;
	earlyExitVisits?: number;
	earlyExitRatio?: number;
	useRave?: boolean;
};

type ClassicAiSearchPreset = ClassicAiSearchOptions & {
	simulations: number;
	maxTimeMs: number;
	earlyExitVisits: number;
};

const CLASSIC_AI_SEARCH_PRESETS = {
	easy: {
		simulations: 24,
		maxTimeMs: 110,
		progressiveBias: 0.08,
		lookaheadDepth: 0,
		lookaheadWeight: 0,
		smartRolloutRate: 0.45,
		earlyExitVisits: 18,
		earlyExitRatio: 0.92,
		useRave: false
	},
	medium: {
		simulations: 88,
		maxTimeMs: 280,
		progressiveBias: 0.14,
		lookaheadDepth: 1,
		lookaheadMaxMoves: 8,
		lookaheadRootMaxMoves: 10,
		lookaheadNodeLimit: 900,
		lookaheadWeight: 0.16,
		smartRolloutRate: 0.62,
		earlyExitVisits: 54,
		earlyExitRatio: 0.92,
		useRave: true
	},
	hard: {
		simulations: 220,
		maxTimeMs: 680,
		progressiveBias: 0.2,
		lookaheadDepth: 2,
		lookaheadMaxMoves: 10,
		lookaheadRootMaxMoves: 14,
		lookaheadNodeLimit: 4_000,
		lookaheadWeight: 0.36,
		lookaheadOverrideMargin: 72_000,
		smartRolloutRate: 0.76,
		earlyExitVisits: 140,
		earlyExitRatio: 0.94,
		useRave: true
	},
	nightmare: {
		simulations: 760,
		maxTimeMs: 2200,
		progressiveBias: 0.26,
		lookaheadDepth: 3,
		lookaheadMaxMoves: 12,
		lookaheadRootMaxMoves: 18,
		lookaheadNodeLimit: 16_000,
		lookaheadWeight: 0.62,
		lookaheadOverrideMargin: 34_000,
		smartRolloutRate: 0.86,
		earlyExitVisits: 420,
		earlyExitRatio: 0.97,
		useRave: true
	}
} as const satisfies Record<AiDifficulty, ClassicAiSearchPreset>;

const CLASSIC_AI_BOARD_SCALE = {
	easy: 0.22,
	medium: 0.48,
	hard: 0.78,
	nightmare: 1.16
} as const satisfies Record<AiDifficulty, number>;

type MoveSource = 'human' | 'ai';
export type PlacementMode = 'piece' | 'blocker' | 'double-adjacent';
export type TacticalSpecialCounts = Record<TacticalSpecialId, number>;

type PersistedActiveMatch = {
	version: 1;
	matchMode: MatchMode;
	opponentMode: OpponentMode;
	aiDifficulty: AiDifficulty;
	winCondition: WinCondition;
	boardDimensions: BoardDimensions;
	startingPlayer: Player;
	moveHistory: ReplayMove[];
	redoMoves: ReplayMove[];
	gameOverDismissed: boolean;
};

export const TACTICAL_SPECIAL_LOADOUT: TacticalSpecialCounts = {
	'blocker-combo': 2,
	'double-adjacent': 1
};

export type GameController = ReturnType<typeof createGameController>;
export type BoardDimensionKey = keyof BoardDimensions;

export function createGameController() {
	let winCondition = $state<WinCondition>({ ...DEFAULT_WIN_CONDITION });
	let boardDimensions = $state<BoardDimensions>({ ...DEFAULT_BOARD_DIMENSIONS });
	let startingPlayer = $state<Player>(1);
	let game = $state<GameSnapshot>(
		createGame(
			DEFAULT_WIN_CONDITION,
			untrack(() => boardDimensions),
			untrack(() => startingPlayer)
		)
	);
	let hoveredMove = $state<Move | null>(null);
	let lockedMove = $state<Move | null>(null);
	let uiTheme = $state<UiThemeName>('dark');
	let boardColor = $state(DEFAULT_BOARD_COLOR);
	let labelsVisible = $state(true);
	let gridLayersVisible = $state(true);
	let confirmDropEnabled = $state(false);
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
	let aiSearchRequestId = 0;
	let classicAiClient: ClassicAiClient | null = null;
	let matchId = 0;
	let recordedMatchId: number | null = null;

	const turnLabels = $derived(opponentMode === 'ai' ? AI_TURN_LABELS : LOCAL_TURN_LABELS);
	const resultLabels = $derived(opponentMode === 'ai' ? AI_RESULT_LABELS : LOCAL_RESULT_LABELS);

	const statusTone = $derived(
		game.status.state === 'won' ? `player-${game.status.winner}` : game.status.state
	);

	const setupLocked = $derived(game.moveHistory.length > 0 || redoMoves.length > 0);
	const appearanceLocked = $derived(setupLocked);
	const canUndo = $derived(game.moveHistory.length > 0);
	const canRedo = $derived(redoMoves.length > 0);
	const previewMove = $derived(lockedMove ?? hoveredMove);
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
		const savedBoardColor = normalizeBoardColor(
			localStorage.getItem(STORAGE_KEYS.boardColor),
			legacyBoardColor(localStorage.getItem(LEGACY_SCENE_THEME_KEY))
		);
		const savedLabelsVisible = parseBoolean(localStorage.getItem(STORAGE_KEYS.labelsVisible));
		const savedGridLayersVisible = parseBoolean(
			localStorage.getItem(STORAGE_KEYS.gridLayersVisible)
		);
		const savedConfirmDropEnabled = parseBoolean(
			localStorage.getItem(STORAGE_KEYS.confirmDropEnabled)
		);
		const savedOpponentMode = parseOpponentMode(localStorage.getItem(STORAGE_KEYS.opponentMode));
		const savedAiDifficulty = parseAiDifficulty(localStorage.getItem(STORAGE_KEYS.aiDifficulty));
		const savedMatchMode = parseMatchMode(localStorage.getItem(STORAGE_KEYS.matchMode));
		const savedBoardDimensions = parseBoardDimensions(
			localStorage.getItem(STORAGE_KEYS.boardHeight),
			localStorage.getItem(STORAGE_KEYS.boardRows),
			localStorage.getItem(STORAGE_KEYS.boardColumns)
		);
		const savedWinCondition = parseWinCondition(
			localStorage.getItem(STORAGE_KEYS.winLineLength),
			localStorage.getItem(STORAGE_KEYS.linesToWin)
		);
		const savedPieceShape = parsePieceShape(localStorage.getItem(STORAGE_KEYS.pieceShape));

		if (savedUiTheme) uiTheme = savedUiTheme;
		boardColor = savedBoardColor;
		if (savedLabelsVisible !== null) labelsVisible = savedLabelsVisible;
		if (savedGridLayersVisible !== null) gridLayersVisible = savedGridLayersVisible;
		if (savedConfirmDropEnabled !== null) confirmDropEnabled = savedConfirmDropEnabled;
		if (savedOpponentMode) opponentMode = savedOpponentMode;
		if (savedAiDifficulty) aiDifficulty = savedAiDifficulty;
		if (savedMatchMode) matchMode = savedMatchMode;
		if (savedBoardDimensions) boardDimensions = savedBoardDimensions;
		if (savedWinCondition) {
			winCondition = savedWinCondition;
		}
		if (savedBoardDimensions || savedWinCondition) {
			game = createGame(winCondition, boardDimensions, startingPlayer);
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

		if (restoreActiveMatch(localStorage.getItem(STORAGE_KEYS.activeMatch))) {
			queueGameOverModal();
			queueAiMove();
		}
	}

	function restoreActiveMatch(serialized: string | null): boolean {
		const saved = parsePersistedActiveMatch(serialized);
		if (!saved) return false;

		try {
			const restoredGame = replayMoves(
				saved.moveHistory,
				saved.winCondition,
				saved.boardDimensions,
				saved.startingPlayer ?? 1
			);
			boardDimensions = saved.boardDimensions;
			winCondition = saved.winCondition;
			startingPlayer = saved.startingPlayer ?? 1;
			matchMode = saved.matchMode;
			opponentMode = saved.opponentMode;
			aiDifficulty = saved.aiDifficulty;
			game = restoredGame;
			redoMoves = saved.redoMoves;
			hoveredMove = null;
			lockedMove = null;
			selectedSpecial = null;
			gameOverDismissed = saved.gameOverDismissed;
			gameOverModalReady = false;
			matchId += 1;
			recordedMatchId = null;
			return true;
		} catch {
			clearSavedActiveMatch();
			return false;
		}
	}

	function saveActiveMatch(): void {
		if (!browser) return;

		if (game.moveHistory.length === 0 && redoMoves.length === 0) {
			clearSavedActiveMatch();
			return;
		}

		const payload: PersistedActiveMatch = {
			version: 1,
			matchMode,
			opponentMode,
			aiDifficulty,
			winCondition: { ...winCondition },
			boardDimensions: { ...boardDimensions },
			startingPlayer,
			moveHistory: game.moveHistory.map(toMove),
			redoMoves: redoMoves.map((move) => ({ ...move, special: cloneSpecial(move.special) })),
			gameOverDismissed
		};

		localStorage.setItem(STORAGE_KEYS.activeMatch, JSON.stringify(payload));
	}

	function clearSavedActiveMatch(): void {
		if (browser) localStorage.removeItem(STORAGE_KEYS.activeMatch);
	}

	function selectOrPlayMove(move: Move): void {
		if (!confirmDropEnabled) {
			playMove(move);
			return;
		}

		if (!canAcceptHumanMove()) {
			playMove(move);
			return;
		}

		if (lockedMove && sameMove(lockedMove, move)) {
			const moveToPlay = lockedMove;
			lockedMove = null;
			playMove(moveToPlay);
			return;
		}

		moveError = '';
		lockedMove = { ...move };
		hoveredMove = { ...move };
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
		const shouldAlternateStarter = game.moveHistory.length > 0 || game.status.state !== 'playing';
		clearQueuedAiMove();
		clearGameOverModalDelay();
		matchId += 1;
		recordedMatchId = null;
		if (shouldAlternateStarter) startingPlayer = otherPlayer(startingPlayer);
		game = createGame(winCondition, boardDimensions, startingPlayer);
		hoveredMove = null;
		lockedMove = null;
		moveError = '';
		redoMoves = [];
		selectedSpecial = null;
		gameOverDismissed = false;
		gameOverModalReady = false;
		clearSavedActiveMatch();
		queueAiMove();
	}

	function undoMove(): void {
		const lastMove = game.moveHistory.at(-1);
		if (!lastMove) return;

		clearQueuedAiMove();
		clearGameOverModalDelay();
		const previousMoves = game.moveHistory.slice(0, -1).map(toMove);
		redoMoves = [toMove(lastMove), ...redoMoves];
		game = replayMoves(previousMoves, winCondition, boardDimensions, startingPlayer);
		hoveredMove = null;
		lockedMove = null;
		moveError = '';
		selectedSpecial = null;
		gameOverDismissed = true;
		gameOverModalReady = false;
		saveActiveMatch();
	}

	function redoMove(): void {
		const [nextMove, ...remainingMoves] = redoMoves;
		if (!nextMove) return;

		clearQueuedAiMove();
		clearGameOverModalDelay();
		moveError = '';

		try {
			game = replayMoves(
				[...game.moveHistory.map(toMove), nextMove],
				winCondition,
				boardDimensions,
				startingPlayer
			);
			redoMoves = remainingMoves;
			hoveredMove = null;
			lockedMove = null;
			selectedSpecial = null;
			gameOverDismissed = false;
			recordMatchOutcome();
			queueGameOverModal();
			saveActiveMatch();
		} catch (error) {
			moveError = error instanceof Error ? error.message : 'Move rejected';
		}
	}

	function rewindGame(): void {
		if (!canUndo && !canRedo) return;

		clearQueuedAiMove();
		clearGameOverModalDelay();
		redoMoves = [...game.moveHistory.map(toMove), ...redoMoves];
		game = createGame(winCondition, boardDimensions, startingPlayer);
		hoveredMove = null;
		lockedMove = null;
		moveError = '';
		selectedSpecial = null;
		gameOverDismissed = true;
		gameOverModalReady = false;
		saveActiveMatch();
	}

	function dismissGameOver(): void {
		clearGameOverModalDelay();
		gameOverDismissed = true;
		gameOverModalReady = false;
		saveActiveMatch();
	}

	function setHover(move: Move | null): void {
		hoveredMove = move;
	}

	function canAcceptHumanMove(): boolean {
		if (game.status.state !== 'playing') return false;

		return !(opponentMode === 'ai' && game.status.state === 'playing' && game.currentPlayer === 2);
	}

	function setBoardColor(color: string): void {
		boardColor = normalizeBoardColor(color, boardColor);
		persist(STORAGE_KEYS.boardColor, boardColor);
	}

	function setOpponentMode(nextMode: OpponentMode): void {
		if (setupLocked) {
			moveError = 'Start a new match to change opponent mode';
			return;
		}

		clearQueuedAiMove();
		selectedSpecial = null;
		lockedMove = null;
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
		lockedMove = null;
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

	function setBoardDimension(key: BoardDimensionKey, value: number): void {
		if (setupLocked) {
			moveError = 'Start a new match to change board size';
			return;
		}

		let normalized: BoardDimensions;
		try {
			normalized = normalizeBoardDimensions({
				...boardDimensions,
				[key]: value
			});
		} catch (error) {
			moveError = error instanceof Error ? error.message : 'Unsupported board size';
			return;
		}

		clearQueuedAiMove();
		clearGameOverModalDelay();
		boardDimensions = normalized;
		game = createGame(winCondition, boardDimensions, startingPlayer);
		hoveredMove = null;
		lockedMove = null;
		redoMoves = [];
		selectedSpecial = null;
		gameOverDismissed = false;
		gameOverModalReady = false;
		persistBoardDimensions(boardDimensions);
		clearSavedActiveMatch();
		queueAiMove();
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
		game = createGame(winCondition, boardDimensions, startingPlayer);
		hoveredMove = null;
		lockedMove = null;
		redoMoves = [];
		selectedSpecial = null;
		gameOverDismissed = false;
		gameOverModalReady = false;
		persist(STORAGE_KEYS.winLineLength, String(winCondition.lineLength));
		persist(STORAGE_KEYS.linesToWin, String(winCondition.linesToWin));
		clearSavedActiveMatch();
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
			lockedMove = null;
			return;
		}

		if (selectedSpecial) {
			selectedSpecial = special;
			hoveredMove = null;
			lockedMove = null;
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
		lockedMove = null;
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

	function toggleGridLayers(): void {
		gridLayersVisible = !gridLayersVisible;
		persist(STORAGE_KEYS.gridLayersVisible, String(gridLayersVisible));
	}

	function toggleConfirmDrop(): void {
		confirmDropEnabled = !confirmDropEnabled;
		lockedMove = null;
		persist(STORAGE_KEYS.confirmDropEnabled, String(confirmDropEnabled));
	}

	function recordMatchOutcome(): void {
		if (game.status.state === 'playing' || recordedMatchId === matchId) return;

		sessionRecord = recordCompletedGame(sessionRecord, game.status);
		recordedMatchId = matchId;
	}

	function finishPlacement(source: MoveSource, movingPlayer: Player): void {
		hoveredMove = null;
		lockedMove = null;
		redoMoves = [];
		gameOverDismissed = false;
		recordMatchOutcome();
		queueGameOverModal();
		saveActiveMatch();

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
		void runQueuedAiMove(requestId, nowMs());
	}

	async function runQueuedAiMove(requestId: number, queuedAtMs: number): Promise<void> {
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
				const remainingThinkMs = remainingAiThinkingDelayMs(
					requestDifficulty,
					nowMs() - queuedAtMs
				);
				if (remainingThinkMs > 0) {
					await sleep(remainingThinkMs);
				}

				if (!isCurrentAiTurn(requestId) || matchId !== requestMatchId) return;
				playMove(move, 'ai');
			}
		} catch (error) {
			if (!isAbortError(error) && isCurrentAiTurn(requestId)) {
				const move = chooseRandomMove(game);
				if (move) {
					const remainingThinkMs = remainingAiThinkingDelayMs(
						requestDifficulty,
						nowMs() - queuedAtMs
					);
					if (remainingThinkMs > 0) {
						await sleep(remainingThinkMs);
					}

					if (isCurrentAiTurn(requestId) && matchId === requestMatchId) {
						playMove(move, 'ai');
					}
				}
			}
		} finally {
			if (requestId === aiSearchRequestId) {
				aiThinking = false;
			}
		}
	}

	function clearQueuedAiMove(): void {
		aiSearchRequestId += 1;

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
		get boardDimensions() {
			return boardDimensions;
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
		get previewMove() {
			return previewMove;
		},
		get lockedMove() {
			return lockedMove;
		},
		get labelsVisible() {
			return labelsVisible;
		},
		get gridLayersVisible() {
			return gridLayersVisible;
		},
		get confirmDropEnabled() {
			return confirmDropEnabled;
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
		get boardColor() {
			return boardColor;
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
		selectOrPlayMove,
		redoMove,
		resetGame,
		rewindGame,
		setHover,
		setAiDifficulty,
		setBoardDimension,
		setLinesToWin,
		setMatchMode,
		setOpponentMode,
		setPieceColor,
		setPieceShape,
		setBoardColor,
		setWinLineLength,
		toggleConfirmDrop,
		toggleGridLayers,
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

function parseBoolean(value: string | null): boolean | null {
	if (value === 'true') return true;
	if (value === 'false') return false;
	return null;
}

function parsePersistedActiveMatch(serialized: string | null): PersistedActiveMatch | null {
	if (!serialized) return null;

	try {
		const value: unknown = JSON.parse(serialized);
		if (!isRecord(value) || value.version !== 1) return null;

		const matchMode = parseMatchMode(readString(value.matchMode));
		const opponentMode = parseOpponentMode(readString(value.opponentMode));
		const aiDifficulty = parseAiDifficulty(readString(value.aiDifficulty));
		const winCondition = parseSavedWinCondition(value.winCondition);
		const boardDimensions = parseSavedBoardDimensions(value.boardDimensions);
		const startingPlayer = parseSavedPlayer(value.startingPlayer) ?? 1;
		const moveHistory = parseReplayMoveList(value.moveHistory);
		const redoMoves = parseReplayMoveList(value.redoMoves);
		const gameOverDismissed =
			typeof value.gameOverDismissed === 'boolean' && value.gameOverDismissed;

		if (
			!matchMode ||
			!opponentMode ||
			!aiDifficulty ||
			!winCondition ||
			!boardDimensions ||
			!moveHistory ||
			!redoMoves
		) {
			return null;
		}

		return {
			version: 1,
			matchMode,
			opponentMode,
			aiDifficulty,
			winCondition,
			boardDimensions,
			startingPlayer,
			moveHistory,
			redoMoves,
			gameOverDismissed
		};
	} catch {
		return null;
	}
}

function parseSavedWinCondition(value: unknown): WinCondition | null {
	if (!isRecord(value)) return null;

	try {
		return normalizeWinCondition({
			lineLength: Number(value.lineLength),
			linesToWin: Number(value.linesToWin)
		});
	} catch {
		return null;
	}
}

function parseSavedBoardDimensions(value: unknown): BoardDimensions | null {
	if (!isRecord(value)) return null;

	try {
		return normalizeBoardDimensions({
			height: Number(value.height),
			rows: Number(value.rows),
			columns: Number(value.columns)
		});
	} catch {
		return null;
	}
}

function parseSavedPlayer(value: unknown): Player | null {
	return value === 1 || value === 2 ? value : null;
}

function parseReplayMoveList(value: unknown): ReplayMove[] | null {
	if (!Array.isArray(value)) return null;

	const moves: ReplayMove[] = [];
	for (const item of value) {
		const move = parseSavedReplayMove(item);
		if (!move) return null;
		moves.push(move);
	}

	return moves;
}

function parseSavedReplayMove(value: unknown): ReplayMove | null {
	if (!isRecord(value)) return null;

	const row = Number(value.row);
	const col = Number(value.col);
	if (!Number.isInteger(row) || !Number.isInteger(col)) return null;

	const move: ReplayMove = { row, col };
	if (value.kind === 'blocker' || value.kind === 'piece') {
		move.kind = value.kind;
	}

	const special = parseSavedSpecial(value.special);
	if (value.special !== undefined && !special) return null;
	if (special) move.special = special;

	return move;
}

function parseSavedSpecial(value: unknown): PlacedMoveSpecial | null {
	if (!isRecord(value)) return null;
	if (value.action !== 'blocker-combo' && value.action !== 'double-adjacent') return null;
	if (
		value.step !== 'blocker' &&
		value.step !== 'piece' &&
		value.step !== 'first' &&
		value.step !== 'second'
	) {
		return null;
	}

	return {
		action: value.action,
		step: value.step
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | null {
	return typeof value === 'string' ? value : null;
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

function parseBoardDimensions(
	heightValue: string | null,
	rowsValue: string | null,
	columnsValue: string | null
): BoardDimensions | null {
	if (heightValue === null && rowsValue === null && columnsValue === null) return null;

	const height = heightValue === null ? DEFAULT_BOARD_DIMENSIONS.height : Number(heightValue);
	const rows = rowsValue === null ? DEFAULT_BOARD_DIMENSIONS.rows : Number(rowsValue);
	const columns = columnsValue === null ? DEFAULT_BOARD_DIMENSIONS.columns : Number(columnsValue);

	try {
		return normalizeBoardDimensions({ height, rows, columns });
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
	if (matchMode !== 'classic') {
		return chooseRandomMove(game);
	}

	const options = {
		...classicAiSearchOptionsForGame(aiDifficulty, game),
		seed: aiSeedForGame(game, matchId)
	};

	try {
		return (await getClassicAiClient().requestMove(game, options))?.move ?? chooseRandomMove(game);
	} catch (error) {
		if (isAbortError(error)) throw error;
		return (await chooseMctsFallbackMove(game, options)) ?? chooseRandomMove(game);
	}
}

async function chooseMctsFallbackMove(
	game: GameSnapshot,
	options: ClassicAiSearchOptions
): Promise<Move | null> {
	const { chooseMctsMove } = await import('@axial/ai');
	return chooseMctsMove(game, options);
}

export function classicAiSearchOptionsForGame(
	aiDifficulty: AiDifficulty,
	game: GameSnapshot
): ClassicAiSearchOptions {
	const preset: ClassicAiSearchPreset = CLASSIC_AI_SEARCH_PRESETS[aiDifficulty];
	const winRuleMultiplier =
		1 +
		(game.winCondition.linesToWin - 1) * 0.34 +
		(game.winCondition.lineLength - DEFAULT_WIN_CONDITION.lineLength) * 0.16;
	const boardArea =
		(game.dimensions.rows * game.dimensions.columns) /
		(DEFAULT_BOARD_DIMENSIONS.rows * DEFAULT_BOARD_DIMENSIONS.columns);
	const boardBreadthMultiplier =
		1 + (Math.sqrt(boardArea) - 1) * CLASSIC_AI_BOARD_SCALE[aiDifficulty];
	const heightMultiplier =
		1 +
		Math.max(0, game.dimensions.height - DEFAULT_BOARD_DIMENSIONS.height) *
			(aiDifficulty === 'nightmare' ? 0.055 : 0.04);
	const multiplier = winRuleMultiplier * boardBreadthMultiplier * heightMultiplier;
	const earlyExitMultiplier = Math.min(multiplier, aiDifficulty === 'nightmare' ? 2 : 1.65);
	const lookaheadBreadthMultiplier =
		1 + (Math.sqrt(boardArea) - 1) * (aiDifficulty === 'nightmare' ? 0.38 : 0.24);
	const lookaheadNodeMultiplier = Math.min(multiplier, aiDifficulty === 'nightmare' ? 2.2 : 1.7);

	return {
		...preset,
		simulations: Math.round(preset.simulations * multiplier),
		maxTimeMs: Math.round(preset.maxTimeMs * multiplier),
		earlyExitVisits: Math.round(preset.earlyExitVisits * earlyExitMultiplier),
		lookaheadRootMaxMoves:
			preset.lookaheadRootMaxMoves === undefined
				? undefined
				: Math.round(preset.lookaheadRootMaxMoves * lookaheadBreadthMultiplier),
		lookaheadNodeLimit:
			preset.lookaheadNodeLimit === undefined
				? undefined
				: Math.round(preset.lookaheadNodeLimit * lookaheadNodeMultiplier)
	};
}

export function remainingAiThinkingDelayMs(aiDifficulty: AiDifficulty, elapsedMs: number): number {
	return Math.max(0, AI_MINIMUM_THINK_MS[aiDifficulty] - elapsedMs);
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

function persistBoardDimensions(dimensions: BoardDimensions): void {
	persist(STORAGE_KEYS.boardHeight, String(dimensions.height));
	persist(STORAGE_KEYS.boardRows, String(dimensions.rows));
	persist(STORAGE_KEYS.boardColumns, String(dimensions.columns));
}

function chooseRandomMove(game: GameSnapshot): Move | null {
	if (game.status.state !== 'playing') return null;

	const moves = legalMoves(game.board, game.dimensions);
	if (moves.length === 0) return null;

	const move = moves[randomMoveIndex(moves.length)];
	return move ? { row: move.row, col: move.col } : null;
}

function randomMoveIndex(moveCount: number): number {
	if (moveCount <= 0) return -1;
	return Math.floor(Math.random() * moveCount);
}

function sameMove(first: Move, second: Move): boolean {
	return first.row === second.row && first.col === second.col;
}

function legacyBoardColor(value: string | null): string {
	switch (value) {
		case 'prism':
			return '#f5d46f';
		case 'frost':
			return '#67d8ff';
		default:
			return DEFAULT_BOARD_COLOR;
	}
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
	return legalMoves(game.board, game.dimensions).some((move) => {
		try {
			applyBlocker(game, move);
			return true;
		} catch {
			return false;
		}
	});
}

function canStartDoubleAdjacent(game: GameSnapshot): boolean {
	return legalMoves(game.board, game.dimensions).some((move) => {
		try {
			applyDoubleAdjacentFirst(game, move);
			return true;
		} catch {
			return false;
		}
	});
}

function nowMs(): number {
	return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function toMove(move: PlacedMove): ReplayMove {
	return {
		row: move.row,
		col: move.col,
		kind: move.kind,
		...(move.special ? { special: cloneSpecial(move.special) } : {})
	};
}

function cloneSpecial(special: PlacedMoveSpecial | undefined): PlacedMoveSpecial | undefined {
	return special ? { ...special } : undefined;
}
