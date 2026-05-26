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
			background: '#f6f9f7',
			fog: '#dce9e6',
			grid: '#3a756e',
			gridEmissive: '#9ae4d4',
			hover: '#c7921c',
			playerOne: '#d86135',
			playerOneGlow: '#ff8a54',
			playerTwo: '#267bb5',
			playerTwoGlow: '#54b4f6',
			preview: '#ba8219'
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
			background: '#f8f5ff',
			fog: '#e7e0f8',
			grid: '#6452a6',
			gridEmissive: '#b19cff',
			hover: '#735ad6',
			playerOne: '#c64a6b',
			playerOneGlow: '#ff7396',
			playerTwo: '#158a75',
			playerTwoGlow: '#34d6b8',
			preview: '#735ad6'
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
			background: '#f2fbff',
			fog: '#d9eef6',
			grid: '#2d7084',
			gridEmissive: '#9befff',
			hover: '#167e9b',
			playerOne: '#b85f25',
			playerOneGlow: '#ff994d',
			playerTwo: '#405fbd',
			playerTwoGlow: '#7a97ff',
			preview: '#167e9b'
		}
	}
};
