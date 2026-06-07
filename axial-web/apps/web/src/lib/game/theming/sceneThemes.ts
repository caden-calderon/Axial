export type UiThemeName = 'dark' | 'light';

export type ScenePalette = {
	background: string;
	fog: string;
	grid: string;
	gridEmissive: string;
	hover: string;
	playerOne: string;
	playerOneGlow: string;
	playerTwo: string;
	playerTwoGlow: string;
	preview: string;
};

export const DEFAULT_BOARD_COLOR = '#a88cff';

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const SHORT_HEX_COLOR_PATTERN = /^#[0-9a-f]{3}$/i;

const BASE_SCENE_PALETTES: Record<UiThemeName, ScenePalette> = {
	dark: {
		background: '#06070f',
		fog: '#111027',
		grid: DEFAULT_BOARD_COLOR,
		gridEmissive: DEFAULT_BOARD_COLOR,
		hover: DEFAULT_BOARD_COLOR,
		playerOne: '#ff7a96',
		playerOneGlow: '#ff386f',
		playerTwo: '#73f5d8',
		playerTwoGlow: '#22d3aa',
		preview: DEFAULT_BOARD_COLOR
	},
	light: {
		background: '#ebe8e4',
		fog: '#d5d0d6',
		grid: DEFAULT_BOARD_COLOR,
		gridEmissive: DEFAULT_BOARD_COLOR,
		hover: DEFAULT_BOARD_COLOR,
		playerOne: '#aa5e6d',
		playerOneGlow: '#cc7587',
		playerTwo: '#347c72',
		playerTwoGlow: '#5aa79b',
		preview: DEFAULT_BOARD_COLOR
	}
};

export function resolveScenePalette(uiTheme: UiThemeName, boardColor: string): ScenePalette {
	const gridColor = normalizeBoardColor(boardColor);

	return {
		...BASE_SCENE_PALETTES[uiTheme],
		grid: gridColor,
		gridEmissive: gridColor,
		hover: gridColor,
		preview: gridColor
	};
}

export function normalizeBoardColor(
	value: string | null | undefined,
	fallback = DEFAULT_BOARD_COLOR
): string {
	if (!value) return fallback;

	const trimmed = value.trim();
	if (HEX_COLOR_PATTERN.test(trimmed)) return trimmed.toLowerCase();
	if (!SHORT_HEX_COLOR_PATTERN.test(trimmed)) return fallback;

	const [, red, green, blue] = trimmed.toLowerCase();
	return `#${red}${red}${green}${green}${blue}${blue}`;
}
