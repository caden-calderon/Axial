export type SceneThemeName = 'prism' | 'void' | 'frost';
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

export type SceneThemeOption = {
	value: SceneThemeName;
	label: string;
	accent: string;
};

export const SCENE_THEME_OPTIONS: SceneThemeOption[] = [
	{ value: 'prism', label: 'Prism', accent: '#f5d46f' },
	{ value: 'void', label: 'Void', accent: '#a88cff' },
	{ value: 'frost', label: 'Frost', accent: '#67d8ff' }
];

export const SCENE_THEMES: Record<SceneThemeName, Record<UiThemeName, ScenePalette>> = {
	prism: {
		dark: {
			background: '#070a0d',
			fog: '#0b1517',
			grid: '#c7fff4',
			gridEmissive: '#39f6d1',
			hover: '#f5d46f',
			playerOne: '#ff9f66',
			playerOneGlow: '#ff5f2d',
			playerTwo: '#61d7ff',
			playerTwoGlow: '#2f8fff',
			preview: '#f5d46f'
		},
		light: {
			background: '#e9ece2',
			fog: '#cdd8cf',
			grid: '#4e746e',
			gridEmissive: '#77b9ad',
			hover: '#9a7827',
			playerOne: '#b87043',
			playerOneGlow: '#d08b57',
			playerTwo: '#3d7491',
			playerTwoGlow: '#6299b4',
			preview: '#8d6f24'
		}
	},
	void: {
		dark: {
			background: '#06070f',
			fog: '#111027',
			grid: '#d9d0ff',
			gridEmissive: '#7f66ff',
			hover: '#bda6ff',
			playerOne: '#ff7a96',
			playerOneGlow: '#ff386f',
			playerTwo: '#73f5d8',
			playerTwoGlow: '#22d3aa',
			preview: '#c7b7ff'
		},
		light: {
			background: '#ebe8e4',
			fog: '#d5d0d6',
			grid: '#625b78',
			gridEmissive: '#9587bd',
			hover: '#6f5ba6',
			playerOne: '#aa5e6d',
			playerOneGlow: '#cc7587',
			playerTwo: '#347c72',
			playerTwoGlow: '#5aa79b',
			preview: '#6f5ba6'
		}
	},
	frost: {
		dark: {
			background: '#071018',
			fog: '#102331',
			grid: '#c9f6ff',
			gridEmissive: '#48d9ff',
			hover: '#8fe8ff',
			playerOne: '#ffb56e',
			playerOneGlow: '#ff8f38',
			playerTwo: '#8fa9ff',
			playerTwoGlow: '#587dff',
			preview: '#8fe8ff'
		},
		light: {
			background: '#e6ede8',
			fog: '#cbdcd4',
			grid: '#426f76',
			gridEmissive: '#76b8c2',
			hover: '#2f7f8a',
			playerOne: '#aa7042',
			playerOneGlow: '#cf9160',
			playerTwo: '#536d9f',
			playerTwoGlow: '#7488bc',
			preview: '#2f7f8a'
		}
	}
};
