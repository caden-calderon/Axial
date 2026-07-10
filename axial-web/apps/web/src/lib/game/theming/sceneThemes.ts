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
		background: '#d9d6d0',
		fog: '#aaa7ad',
		grid: DEFAULT_BOARD_COLOR,
		gridEmissive: DEFAULT_BOARD_COLOR,
		hover: DEFAULT_BOARD_COLOR,
		playerOne: '#9d4359',
		playerOneGlow: '#c95c74',
		playerTwo: '#17685e',
		playerTwoGlow: '#318f82',
		preview: DEFAULT_BOARD_COLOR
	}
};

export function resolveScenePalette(uiTheme: UiThemeName, boardColor: string): ScenePalette {
	const gridColor = normalizeBoardColor(boardColor);
	const renderedGridColor =
		uiTheme === 'light' ? mixHexColor(gridColor, '#28233a', 0.42) : gridColor;
	const renderedEmissiveColor =
		uiTheme === 'light' ? mixHexColor(gridColor, '#473a6f', 0.28) : gridColor;

	return {
		...BASE_SCENE_PALETTES[uiTheme],
		grid: renderedGridColor,
		gridEmissive: renderedEmissiveColor,
		hover: gridColor,
		preview: gridColor
	};
}

function mixHexColor(first: string, second: string, secondWeight: number): string {
	const weight = Math.max(0, Math.min(1, secondWeight));
	const firstChannels = channels(first);
	const secondChannels = channels(second);
	const mixed = firstChannels.map((channel, index) =>
		Math.round(channel * (1 - weight) + secondChannels[index] * weight)
	);

	return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function channels(color: string): [number, number, number] {
	return [
		Number.parseInt(color.slice(1, 3), 16),
		Number.parseInt(color.slice(3, 5), 16),
		Number.parseInt(color.slice(5, 7), 16)
	];
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
