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
	practice?: boolean;
};

export const WELCOME_TOUR_STEPS = [
	{
		id: 'welcome',
		kicker: 'Welcome',
		title: 'This is Axial',
		body: 'Connect 4 in 3D space, with a few fun twists. Connect four of your pieces in a straight line: across, up, or diagonally through the board.',
		panelExpanded: false,
		placement: 'center'
	},
	{
		id: 'board',
		kicker: 'Your turn',
		title: 'Take a practice turn',
		body: 'Drag to rotate the board. Pinch or scroll to zoom. Complete a row of three by dropping the fourth piece. Tap a column, or use the arrow keys and Enter.',
		panelExpanded: false,
		placement: 'center',
		practice: true
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
		body: 'Choose the board size, Connect 4 or 5, and how many lines win the match. Extending a straight run still counts as one line; crossing lines count separately.',
		target: '[data-tour-target="rules"]',
		targetPadding: 8,
		panelExpanded: true,
		placement: 'left'
	},
	{
		id: 'appearance',
		kicker: 'Appearance',
		title: 'Make it yours',
		body: 'Show grid layers to read the board in 3D, or keep just the floor. Confirm drop lets you preview a move before placing it. Change your piece look before the first move.',
		target: '[data-tour-target="appearance-section"]',
		targetPadding: 8,
		panelExpanded: true,
		placement: 'left'
	},
	{
		id: 'finish',
		kicker: 'You are set',
		title: 'Ready to play',
		body: 'Rotate the board to spot connections and check what your opponent is building. When the match ends, you can explore the final board or replay the moves.',
		target: '[data-tour-target="control-panel"]',
		targetPadding: 10,
		panelExpanded: true,
		placement: 'left'
	}
] as const satisfies readonly WelcomeTourStep[];

export const WELCOME_TOUR_STEP_COUNT = WELCOME_TOUR_STEPS.length;
