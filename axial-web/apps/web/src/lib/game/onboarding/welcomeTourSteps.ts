export type WelcomeTourPlacement = 'auto' | 'center' | 'top' | 'right' | 'bottom' | 'left';

export type WelcomeTourStep = {
	id: string;
	kicker: string;
	title: string;
	body: string;
	target?: string;
	targetPadding?: number;
	panelExpanded: boolean | null;
	placement?: WelcomeTourPlacement;
};

export const WELCOME_TOUR_STEPS = [
	{
		id: 'welcome',
		kicker: 'Welcome',
		title: 'This is Axial',
		body: 'Think Connect 4, but in three dimensions. Drop pieces into the 3D board, build a line before your opponent does, and use the camera to read the whole shape.',
		panelExpanded: false,
		placement: 'center'
	},
	{
		id: 'board',
		kicker: 'Board',
		title: 'Read the grid in 3D',
		body: 'Hover or tap a square to preview the gravity drop. The piece lands in the lowest open cell for that row and column.',
		panelExpanded: false,
		placement: 'center'
	},
	{
		id: 'menu-toggle',
		kicker: 'Menu',
		title: 'Open the controls here',
		body: 'This icon expands the game menu. I will open it for you so you can see where setup and customization live.',
		target: '[data-tour-target="panel-toggle"]',
		targetPadding: 10,
		panelExpanded: false,
		placement: 'left'
	},
	{
		id: 'play-mode',
		kicker: 'Match',
		title: 'Choose how you want to play',
		body: 'Start with Local, play against the AI, or switch Online to make a private room for a friend.',
		target: '[data-tour-target="play-mode"]',
		targetPadding: 8,
		panelExpanded: true,
		placement: 'left'
	},
	{
		id: 'rules',
		kicker: 'Rules',
		title: 'Set the match shape',
		body: 'Before the first move you can change the board size, choose Connect 4 or 5, and decide how many completed lines are needed to win.',
		target: '[data-tour-target="rules"]',
		targetPadding: 8,
		panelExpanded: true,
		placement: 'left'
	},
	{
		id: 'appearance',
		kicker: 'Appearance',
		title: 'Make it yours',
		body: 'Board color, piece look, theme, grid layers, axis numbers, and confirm-drop are all tucked here. These are safe to play with.',
		target: '[data-tour-target="appearance-section"]',
		targetPadding: 8,
		panelExpanded: true,
		placement: 'left'
	},
	{
		id: 'finish',
		kicker: 'You are set',
		title: 'Go play a match',
		body: 'That is the core loop. Try things, bend the settings, and report bugs when something feels off. Thanks for helping Axial get sharper.',
		target: '[data-tour-target="control-panel"]',
		targetPadding: 10,
		panelExpanded: true,
		placement: 'left'
	}
] as const satisfies readonly WelcomeTourStep[];

export const WELCOME_TOUR_STEP_COUNT = WELCOME_TOUR_STEPS.length;
