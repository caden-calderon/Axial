// Match material for the takes. Every list is legal under the real rules.

// Staged classic match (scripts/stage-game.ts, seed search): nobody passes up a win; threats are
// blocked at moves 24 and 30 (1-based); orange forks at 31 (three in a row on layer 3, and a
// staircase step becomes playable), blue blocks at 32, orange climbs a four-step staircase at 33.
export const CLASSIC_FORK = [
	[2, 3], [3, 0], [5, 1], [4, 2], [1, 6], [5, 4], [5, 4], [2, 2], [5, 4], [2, 4], [2, 2], [4, 3],
	[4, 3], [1, 4], [1, 3], [4, 3], [2, 2], [5, 3], [2, 1], [2, 3], [1, 4], [0, 2], [3, 3], [0, 3],
	[2, 3], [2, 1], [3, 3], [2, 4], [3, 3], [3, 3], [2, 4], [2, 1], [2, 4]
];

// Opening reveal (scripts/stage-reveal.ts, seed 1): the front row (row 5) is built up like a
// Connect 4 rack with a few low stacks behind; nobody ever has a win available, and orange's last
// move drops into the centre of the front row.
export const REVEAL = [
	[3, 2], [3, 5], [2, 3], [5, 2], [5, 5], [5, 0], [5, 6], [4, 1], [4, 3], [5, 3], [5, 1], [5, 6],
	[4, 3], [5, 6], [4, 4], [5, 5], [5, 2], [5, 1], [5, 3], [5, 3], [5, 3], [5, 4], [5, 4], [5, 1],
	[5, 4], [5, 4], [5, 3]
];

// The AI-wins beat (scripts/stage-ai-win.ts, seed 278): the staged match to move 18, then a
// continuation in which nobody passes up a win. With orange to move, blue threatens a diagonal
// climbing all four layers; orange's move in the corner (AI_WIN_ORANGE) ignores it, and the AI
// completes the line at row 5, column 4.
export const AI_WIN = [
	...CLASSIC_FORK.slice(0, 18),
	[0, 2], [0, 0], [5, 1], [2, 1], [3, 2], [2, 5], [2, 1], [3, 2]
];
export const AI_WIN_ORANGE = [0, 0];

// Medium vs Medium self-play (scripts/find-games.ts), 9x9x9 connect five: the last move finishes
// a five-layer staircase.
export const BIG_STAIRCASE = [
	[5, 4], [4, 5], [2, 3], [6, 4], [4, 3], [3, 3], [3, 2], [6, 5], [8, 5], [3, 5], [5, 5], [5, 0],
	[1, 0], [2, 1], [6, 7], [3, 7], [3, 4], [6, 3], [6, 2], [6, 1], [2, 5], [1, 6], [5, 8], [5, 1],
	[2, 6], [2, 4], [4, 2], [5, 2], [1, 1], [5, 7], [4, 6], [0, 2], [4, 0], [0, 5], [4, 7], [0, 3],
	[0, 4], [3, 0], [4, 1], [4, 4], [1, 4], [3, 6], [5, 4], [3, 6], [3, 5], [3, 5], [1, 2], [1, 3],
	[4, 4], [4, 3], [4, 5], [3, 6], [2, 5], [3, 6], [3, 6], [4, 4], [3, 4], [2, 4], [1, 2], [4, 5],
	[6, 5], [5, 5], [6, 4], [6, 5], [4, 3], [4, 2], [6, 3], [3, 5], [2, 6], [5, 1], [2, 6], [5, 4],
	[6, 2], [6, 1], [2, 3], [5, 5], [2, 5], [3, 3], [6, 7], [6, 3], [2, 6], [2, 6], [0, 5], [6, 1],
	[5, 5], [4, 6], [2, 5], [2, 5]
];

// Medium vs Medium self-play, 7x8x8 (height x rows x columns), connect four, three lines to win:
// both players score; blue's third line on the last move wins it 3-2.
export const THREE_LINE_RACE = [
	[2, 4], [1, 3], [4, 2], [1, 4], [3, 3], [3, 1], [3, 4], [2, 5], [3, 5], [3, 2], [2, 2], [1, 5],
	[5, 4], [4, 4], [1, 1], [5, 6], [3, 6], [5, 2], [2, 3], [5, 1], [2, 7], [4, 5], [2, 6], [1, 6],
	[6, 6], [4, 1], [2, 1], [0, 0], [5, 3], [4, 3], [6, 1], [4, 6], [6, 3], [6, 4], [5, 5], [4, 4],
	[6, 2], [6, 0], [1, 2], [0, 1], [3, 0], [0, 3], [0, 2], [4, 4], [4, 4], [3, 4], [5, 4], [3, 3],
	[2, 2], [3, 3], [3, 2], [4, 2], [4, 3], [2, 1], [2, 4], [5, 5], [6, 6], [5, 5], [2, 2], [6, 6]
];

/** localStorage value restoring a match through the app's own session-restore path. */
export function savedMatch({ moves, dimensions, winCondition, opponentMode = 'local', aiDifficulty = 'medium' }) {
	return JSON.stringify({
		version: 1,
		matchMode: 'classic',
		opponentMode,
		aiDifficulty,
		boardDimensions: dimensions,
		winCondition,
		startingPlayer: 1,
		moveHistory: moves.map(([row, col]) => ({ row, col })),
		redoMoves: [],
		gameOverDismissed: false
	});
}

export const CLASSIC = { dimensions: { height: 6, rows: 6, columns: 7 }, winCondition: { lineLength: 4, linesToWin: 1 } };
export const THREE_LINES = { dimensions: { height: 7, rows: 8, columns: 8 }, winCondition: { lineLength: 4, linesToWin: 3 } };
export const BIG = { dimensions: { height: 9, rows: 9, columns: 9 }, winCondition: { lineLength: 5, linesToWin: 1 } };

/**
 * Seeded preferences: none, so every take shows first-visit defaults (layer grid off, axis
 * numbers on, confirm-drop on for touch screens only).
 */
export const PREFERENCES = {};

/** Aim at each move's landing cell, settle briefly, click; waits for the move to register. */
export async function playMoves(take, moves, { travel = 0.55, settle = 0.25, after = 0.45 } = {}) {
	for (const [row, col] of moves) {
		const before = await take.moveCount();
		await take.moveTo(take.cell(row, col), travel);
		await take.hold(settle);
		await take.click();
		await take.until(
			(count) => JSON.parse(localStorage.getItem('axial-active-match') ?? '{}').moveHistory?.length > count,
			before,
			3
		);
		await take.hold(after);
	}
}
