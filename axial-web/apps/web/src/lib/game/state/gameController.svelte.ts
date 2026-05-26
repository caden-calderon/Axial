import { browser } from '$app/environment';
import { applyMove, createGame, type GameSnapshot, type Move, type Player } from '@axial/core';
import { SCENE_THEME_OPTIONS, type SceneThemeName, type UiThemeName } from '../theming/sceneThemes';

const STORAGE_KEYS = {
	uiTheme: 'axial-theme',
	sceneTheme: 'axial-scene-theme',
	labelsVisible: 'axial-axis-labels'
} as const;

const PLAYER_NAMES: Record<Player, string> = {
	1: 'Solar',
	2: 'Azure'
};

export type GameController = ReturnType<typeof createGameController>;

export function createGameController() {
	let game = $state<GameSnapshot>(createGame());
	let hoveredMove = $state<Move | null>(null);
	let uiTheme = $state<UiThemeName>('dark');
	let sceneTheme = $state<SceneThemeName>('prism');
	let labelsVisible = $state(true);
	let moveError = $state('');

	const currentLabel = $derived(
		game.status.state === 'playing'
			? PLAYER_NAMES[game.currentPlayer]
			: game.status.state === 'won'
				? `${PLAYER_NAMES[game.status.winner]} Wins`
				: 'Draw'
	);

	const statusTone = $derived(
		game.status.state === 'won' ? `player-${game.status.winner}` : game.status.state
	);

	const arenaLabel = $derived(`${sceneLabel(sceneTheme)} Arena`);

	const statusTitle = $derived(
		game.status.state === 'playing'
			? `${PLAYER_NAMES[game.currentPlayer]} to move`
			: game.status.state === 'won'
				? `${PLAYER_NAMES[game.status.winner]} controls the axis`
				: 'Equilibrium'
	);

	function hydrateFromStorage(): void {
		if (!browser) return;

		const savedUiTheme = parseUiTheme(localStorage.getItem(STORAGE_KEYS.uiTheme));
		const savedSceneTheme = parseSceneTheme(localStorage.getItem(STORAGE_KEYS.sceneTheme));
		const savedLabelsVisible = parseBoolean(localStorage.getItem(STORAGE_KEYS.labelsVisible));

		if (savedUiTheme) uiTheme = savedUiTheme;
		if (savedSceneTheme) sceneTheme = savedSceneTheme;
		if (savedLabelsVisible !== null) labelsVisible = savedLabelsVisible;
	}

	function playMove(move: Move): void {
		moveError = '';

		try {
			game = applyMove(game, move);
			hoveredMove = null;
		} catch (error) {
			moveError = error instanceof Error ? error.message : 'Move rejected';
		}
	}

	function resetGame(): void {
		game = createGame();
		hoveredMove = null;
		moveError = '';
	}

	function setHover(move: Move | null): void {
		hoveredMove = move;
	}

	function setSceneTheme(nextTheme: SceneThemeName): void {
		sceneTheme = nextTheme;
		persist(STORAGE_KEYS.sceneTheme, nextTheme);
	}

	function toggleTheme(): void {
		uiTheme = uiTheme === 'dark' ? 'light' : 'dark';
		persist(STORAGE_KEYS.uiTheme, uiTheme);
	}

	function toggleLabels(): void {
		labelsVisible = !labelsVisible;
		persist(STORAGE_KEYS.labelsVisible, String(labelsVisible));
	}

	return {
		get arenaLabel() {
			return arenaLabel;
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
		get moveError() {
			return moveError;
		},
		get sceneTheme() {
			return sceneTheme;
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
		hydrateFromStorage,
		playMove,
		resetGame,
		setHover,
		setSceneTheme,
		toggleLabels,
		toggleTheme
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

function persist(key: string, value: string): void {
	if (browser) localStorage.setItem(key, value);
}

function sceneLabel(sceneTheme: SceneThemeName): string {
	return SCENE_THEME_OPTIONS.find((option) => option.value === sceneTheme)?.label ?? 'Prism';
}
