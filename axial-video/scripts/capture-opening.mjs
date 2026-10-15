import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const requireFromWeb = createRequire(new URL('../../axial-web/apps/web/package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');

const appUrl = process.env.AXIAL_CAPTURE_URL ?? 'http://127.0.0.1:5173';
const shotFilter = process.env.AXIAL_CAPTURE_MOVES
	? new Set(process.env.AXIAL_CAPTURE_MOVES.split(',').map(Number))
	: new Set([11, 12, 13, 14, 15]);
const frameRoot = resolve('out/frames/opening');
const videoRoot = resolve('public/footage/opening');
const fps = 30;
const moves = [
	[0, 0], [2, 1], [0, 1], [4, 2], [1, 1],
	[5, 5], [2, 3], [5, 6], [2, 4], [3, 6],
	[0, 2], [0, 3], [2, 2], [2, 5], [3, 3]
].map(([row, col]) => ({ row, col }));

await mkdir(frameRoot, { recursive: true });
await mkdir(videoRoot, { recursive: true });

const browser = await chromium.launch({
	executablePath: process.env.AXIAL_CAPTURE_CHROMIUM ?? '/usr/bin/chromium',
	args: ['--use-gl=angle', '--use-angle=gl', '--disable-software-rasterizer']
});

try {
	for (let index = 10; index < moves.length; index += 1) {
		const moveNumber = index + 1;
		if (!shotFilter.has(moveNumber)) continue;
		const frameDirectory = resolve(frameRoot, `move-${moveNumber}`);
		await mkdir(frameDirectory, { recursive: true });
		const context = await browser.newContext({
			viewport: { width: 1280, height: 720 },
			deviceScaleFactor: 1
		});
		const page = await context.newPage();
		const errors = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.clock.install();
		await page.addInitScript((moveHistory) => {
			localStorage.setItem('axial-active-match', JSON.stringify({
				version: 1,
				matchMode: 'classic',
				opponentMode: 'local',
				aiDifficulty: 'hard',
				boardDimensions: { height: 6, rows: 6, columns: 7 },
				winCondition: { lineLength: 4, linesToWin: 1 },
				startingPlayer: 1,
				moveHistory,
				redoMoves: [],
				gameOverDismissed: true
			}));
			localStorage.setItem('axial-axis-labels', 'false');
			localStorage.setItem('axial-grid-layers', 'false');
			localStorage.setItem('axial-confirm-drop', 'false');
		}, moves.slice(0, index));

		await page.goto(`${appUrl}/?tour=0`);
		await page.locator('canvas').waitFor();
		await page.addStyleTag({ content: '.game-shell > :not(.scene-shell) { display: none !important; } .keyboard-readout { display: none !important; }' });
		await page.clock.fastForward(900);
		await page.clock.runFor(34);

		const board = page.locator('.scene-shell');
		await board.focus();
		const move = moves[index];
		const center = { row: 3, col: 3 };
		await board.press('ArrowUp');
		let row = center.row - 1;
		let col = center.col;
		while (row < move.row) { await board.press('ArrowDown'); row += 1; }
		while (row > move.row) { await board.press('ArrowUp'); row -= 1; }
		while (col < move.col) { await board.press('ArrowRight'); col += 1; }
		while (col > move.col) { await board.press('ArrowLeft'); col -= 1; }
		await page.clock.runFor(34);
		await board.press('Enter');
		await page.waitForFunction((expected) => {
			const saved = localStorage.getItem('axial-active-match');
			return saved && JSON.parse(saved).moveHistory.length === expected;
		}, moveNumber);

		const frameCount = moveNumber === 15 ? 51 : 36;
		for (let frame = 0; frame < frameCount; frame += 1) {
			await page.clock.runFor(1000 / fps);
			await page.screenshot({
				path: resolve(frameDirectory, `frame-${String(frame).padStart(3, '0')}.png`),
				animations: 'disabled'
			});
			if (frame % 12 === 0) console.log(`move ${moveNumber}: ${frame + 1}/${frameCount}`);
		}

		if (errors.length) throw new Error(`Scene errors in move ${moveNumber}: ${errors.join('; ')}`);
		await context.close();
		const encoded = spawnSync('ffmpeg', [
			'-y', '-v', 'error', '-framerate', String(fps),
			'-i', resolve(frameDirectory, 'frame-%03d.png'),
			'-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p',
			resolve(videoRoot, `move-${moveNumber}.mp4`)
		], { encoding: 'utf8' });
		if (encoded.status !== 0) throw new Error(encoded.stderr || `ffmpeg exited ${encoded.status}`);
		console.log(`move-${moveNumber}.mp4 complete`);
	}
} finally {
	await browser.close();
}
