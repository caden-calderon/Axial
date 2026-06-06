import { browser } from '$app/environment';
import { chooseRandomMove } from '@axial/ai';
import {
	MATCH_CONFIGS,
	applyBlocker,
	applyDoubleAdjacentFirst,
	applyDoubleAdjacentSecond,
	applyMove,
	createGame,
	getPendingDoubleAdjacentOrigin,
	legalMoves,
	replayMoves,
	type GameSnapshot,
	type MatchMode,
	type Move,
	type Player,
	type PlacedMove,
	type ReplayMove,
	type TacticalSpecialId
} from '@axial/core';
import { SCENE_THEME_OPTIONS, type SceneThemeName, type UiThemeName } from '../theming/sceneThemes';
import {
	DEFAULT_PIECE_COLORS,
	normalizePieceColor,
	parsePieceShape,
	type PieceColors,
	type PieceShape
} from './pieceAppearance';
import { createSessionRecord, recordCompletedGame, type SessionRecord } from './sessionRecord';

const STORAGE_KEYS = {
	uiTheme: 'axial-theme',
	sceneTheme: 'axial-scene-theme',
	labelsVisible: 'axial-axis-labels',
	opponentMode: 'axial-opponent-mode',
	matchMode: 'axial-match-mode',
	pieceShape: 'axial-piece-shape',
	playerOneColor: 'axial-piece-player-one',
	playerTwoColor: 'axial-piece-player-two'
} as const;

export type OpponentMode = 'local' | 'ai';

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

type MoveSource = 'human' | 'ai';
export type PlacementMode = 'piece' | 'blocker' | 'double-adjacent';
export type TacticalSpecialCounts = Record<TacticalSpecialId, number>;

export const TACTICAL_SPECIAL_LOADOUT: TacticalSpecialCounts = {
	'blocker-combo': 2,
	'double-adjacent': 1
};

export type GameController = ReturnType<typeof createGameController>;

export function createGameController() {
	let game = $state<GameSnapshot>(createGame());
	let hoveredMove = $state<Move | null>(null);
	let uiTheme = $state<UiThemeName>('dark');
	let sceneTheme = $state<SceneThemeName>('prism');
	let labelsVisible = $state(true);
	let opponentMode = $state<OpponentMode>('local');
	let matchMode = $state<MatchMode>('classic');
	let pieceShape = $state<PieceShape>('cube');
	let pieceColors = $state<PieceColors>({ ...DEFAULT_PIECE_COLORS });
	let sessionRecord = $state<SessionRecord>(createSessionRecord());
	let moveError = $state('');
	let redoMoves = $state<ReplayMove[]>([]);
	let gameOverDismissed = $state(false);
	let selectedSpecial = $state<TacticalSpecialId | null>(null);
	let aiThinking = $state(false);
	let aiMoveTimeout: ReturnType<typeof setTimeout> | null = null;
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
	const showGameOverModal = $derived(game.status.state !== 'playing' && !gameOverDismissed);
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
		const savedMatchMode = parseMatchMode(localStorage.getItem(STORAGE_KEYS.matchMode));
		const savedPieceShape = parsePieceShape(localStorage.getItem(STORAGE_KEYS.pieceShape));

		if (savedUiTheme) uiTheme = savedUiTheme;
		if (savedSceneTheme) sceneTheme = savedSceneTheme;
		if (savedLabelsVisible !== null) labelsVisible = savedLabelsVisible;
		if (savedOpponentMode) opponentMode = savedOpponentMode;
		if (savedMatchMode) matchMode = savedMatchMode;
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
		matchId += 1;
		recordedMatchId = null;
		game = createGame();
		hoveredMove = null;
		moveError = '';
		redoMoves = [];
		selectedSpecial = null;
		gameOverDismissed = false;
	}

	function undoMove(): void {
		const lastMove = game.moveHistory.at(-1);
		if (!lastMove) return;

		clearQueuedAiMove();
		const previousMoves = game.moveHistory.slice(0, -1).map(toMove);
		redoMoves = [toMove(lastMove), ...redoMoves];
		game = replayMoves(previousMoves);
		hoveredMove = null;
		moveError = '';
		selectedSpecial = null;
		gameOverDismissed = true;
	}

	function redoMove(): void {
		const [nextMove, ...remainingMoves] = redoMoves;
		if (!nextMove) return;

		clearQueuedAiMove();
		moveError = '';

		try {
			game = replayMoves([...game.moveHistory.map(toMove), nextMove]);
			redoMoves = remainingMoves;
			hoveredMove = null;
			selectedSpecial = null;
			gameOverDismissed = false;
			recordMatchOutcome();
		} catch (error) {
			moveError = error instanceof Error ? error.message : 'Move rejected';
		}
	}

	function rewindGame(): void {
		if (!canUndo && !canRedo) return;

		clearQueuedAiMove();
		redoMoves = [...game.moveHistory.map(toMove), ...redoMoves];
		game = createGame();
		hoveredMove = null;
		moveError = '';
		selectedSpecial = null;
		gameOverDismissed = true;
	}

	function dismissGameOver(): void {
		gameOverDismissed = true;
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
		aiMoveTimeout = setTimeout(() => {
			aiMoveTimeout = null;

			if (opponentMode !== 'ai' || game.status.state !== 'playing' || game.currentPlayer !== 2) {
				aiThinking = false;
				return;
			}

			const move = chooseRandomMove(game);
			if (move) {
				playMove(move, 'ai');
			}

			aiThinking = false;
		}, AI_MOVE_DELAY_MS);
	}

	function clearQueuedAiMove(): void {
		if (aiMoveTimeout) {
			clearTimeout(aiMoveTimeout);
			aiMoveTimeout = null;
		}

		aiThinking = false;
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
		get moveError() {
			return moveError;
		},
		get opponentMode() {
			return opponentMode;
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
		setMatchMode,
		setOpponentMode,
		setPieceColor,
		setPieceShape,
		setSceneTheme,
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
