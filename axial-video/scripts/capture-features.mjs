import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const requireFromWeb = createRequire(new URL('../../axial-web/apps/web/package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const appUrl = process.env.AXIAL_CAPTURE_URL ?? 'http://127.0.0.1:5173';
const outputRoot = resolve('public/footage/features');
const frameRoot = resolve('out/frames/features');
const selected = process.env.AXIAL_CAPTURE_SHOTS
	? new Set(process.env.AXIAL_CAPTURE_SHOTS.split(','))
	: null;
const fps = 30;

const toMoves = (pairs) => pairs.map(([row, col]) => ({ row, col }));
function lineGoalMoves(length, goal) {
	const moves = [];
	for (let row = 0; row < goal; row += 1) {
		for (let col = 0; col < length; col += 1) {
			moves.push({ row, col });
			if (row !== goal - 1 || col !== length - 1) {
				moves.push({ row: 5 - row, col });
			}
		}
	}
	return moves;
}

const defaultBoard = { height: 6, rows: 6, columns: 7 };
const scenes = [
	{
		id: 'three-dimensional-line',
		board: defaultBoard,
		winCondition: { lineLength: 4, linesToWin: 1 },
		moves: toMoves([[0, 0], [1, 1], [1, 1], [2, 2], [2, 2], [5, 5], [2, 2], [3, 3], [3, 3], [3, 3], [3, 3]]),
		frames: 66
	},
	{
		id: 'connect-five',
		board: defaultBoard,
		winCondition: { lineLength: 5, linesToWin: 1 },
		moves: lineGoalMoves(5, 1),
		frames: 60
	},
	{
		id: 'larger-board',
		board: { height: 8, rows: 8, columns: 9 },
		winCondition: { lineLength: 4, linesToWin: 1 },
		moves: toMoves([[0, 0], [7, 8], [3, 3], [4, 4], [1, 7], [6, 1], [2, 2]]),
		frames: 45
	},
	{
		id: 'two-lines',
		board: defaultBoard,
		winCondition: { lineLength: 4, linesToWin: 2 },
		moves: lineGoalMoves(4, 2),
		frames: 60
	},
	{
		id: 'three-lines',
		board: defaultBoard,
		winCondition: { lineLength: 4, linesToWin: 3 },
		moves: lineGoalMoves(4, 3),
		frames: 60
	}
];

await mkdir(outputRoot, { recursive: true });
await mkdir(frameRoot, { recursive: true });
const browser = await chromium.launch({
	executablePath: process.env.AXIAL_CAPTURE_CHROMIUM ?? '/usr/bin/chromium',
	args: ['--use-gl=angle', '--use-angle=gl', '--disable-software-rasterizer']
});

try {
	for (const scene of scenes) {
		if (selected && !selected.has(scene.id)) continue;
		const frameDirectory = resolve(frameRoot, scene.id);
		await mkdir(frameDirectory, { recursive: true });
		const page = await browser.newPage({
			viewport: { width: 1280, height: 720 },
			deviceScaleFactor: 1
		});
		const errors = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.clock.install();
		await page.addInitScript(({ board, winCondition, moveHistory }) => {
			localStorage.setItem('axial-active-match', JSON.stringify({
				version: 1,
				matchMode: 'classic',
				opponentMode: 'local',
				aiDifficulty: 'hard',
				boardDimensions: board,
				winCondition,
				startingPlayer: 1,
				moveHistory,
				redoMoves: [],
				gameOverDismissed: true
			}));
			localStorage.setItem('axial-axis-labels', 'false');
			localStorage.setItem('axial-grid-layers', 'false');
			localStorage.setItem('axial-confirm-drop', 'false');
		}, {
			board: scene.board,
			winCondition: scene.winCondition,
			moveHistory: scene.moves.slice(0, -1)
		});
		await page.goto(`${appUrl}/?tour=0`);
		await page.locator('canvas').waitFor();
		await page.clock.fastForward(900);
		await page.clock.runFor(34);
		await page.screenshot({ path: resolve(outputRoot, `${scene.id}-ui.png`) });
		await page.addStyleTag({
			content: '.game-shell > :not(.scene-shell) { display:none !important; } .keyboard-readout { display:none !important; }'
		});

		const move = scene.moves.at(-1);
		const boardControl = page.locator('.scene-shell');
		await boardControl.focus();
		let row = Math.floor(scene.board.rows / 2);
		let col = Math.floor(scene.board.columns / 2);
		await boardControl.press('ArrowUp');
		row -= 1;
		while (row < move.row) { await boardControl.press('ArrowDown'); row += 1; }
		while (row > move.row) { await boardControl.press('ArrowUp'); row -= 1; }
		while (col < move.col) { await boardControl.press('ArrowRight'); col += 1; }
		while (col > move.col) { await boardControl.press('ArrowLeft'); col -= 1; }
		await page.clock.runFor(34);
		await boardControl.press('Enter');
		await page.waitForFunction((expected) => {
			const saved = localStorage.getItem('axial-active-match');
			return saved && JSON.parse(saved).moveHistory.length === expected;
		}, scene.moves.length);

		for (let frame = 0; frame < scene.frames; frame += 1) {
			await page.clock.runFor(1000 / fps);
			await page.screenshot({
				path: resolve(frameDirectory, `frame-${String(frame).padStart(3, '0')}.png`),
				animations: 'disabled'
			});
		}
		if (errors.length) throw new Error(`${scene.id}: ${errors.join('; ')}`);
		await page.close();
		const encoded = spawnSync('ffmpeg', [
			'-y', '-v', 'error', '-framerate', String(fps),
			'-i', resolve(frameDirectory, 'frame-%03d.png'),
			'-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p',
			resolve(outputRoot, `${scene.id}.mp4`)
		], { encoding: 'utf8' });
		if (encoded.status !== 0) throw new Error(encoded.stderr || `ffmpeg exited ${encoded.status}`);
		await copyFile(
			resolve(frameDirectory, `frame-${String(scene.frames - 1).padStart(3, '0')}.png`),
			resolve(outputRoot, `${scene.id}-hold.png`)
		);
		console.log(`${scene.id}: ${scene.moves.length} legal moves, ${scene.frames} frames captured`);
	}
} finally {
	await browser.close();
}
