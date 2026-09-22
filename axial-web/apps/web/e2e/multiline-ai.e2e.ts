import { expect, test } from '@playwright/test';
import type { ClassicAiWorkerResponse } from '../src/lib/game/state/classicAiMessages';

type AiProbe = { attempts: number; errors: string[]; responses: ClassicAiWorkerResponse[] };
declare global {
	interface Window {
		__multilineAiProbe: AiProbe;
	}
}

for (const scorer of [1, 2] as const) {
	test(`the real AI worker keeps searching after Player ${scorer} banks a line`, async ({
		page
	}) => {
		await page.addInitScript(
			({ scorer }) => {
				const probe: AiProbe = {
					attempts: 0,
					errors: [],
					responses: []
				};
				Object.assign(window, { __multilineAiProbe: probe });
				const postMessage = Worker.prototype.postMessage;
				const observed = new WeakSet<Worker>();
				Worker.prototype.postMessage = function (
					message: unknown,
					options?: Transferable[] | StructuredSerializeOptions
				) {
					if (!observed.has(this)) {
						observed.add(this);
						this.addEventListener('message', (event) => probe.responses.push(event.data));
					}
					probe.attempts++;
					try {
						Reflect.apply(postMessage, this, [message, options ?? []]);
					} catch (error) {
						probe.errors.push(String(error));
						throw error;
					}
				};
				const moves = [];
				for (let col = 0; col < 4; col++) {
					const scoringMove = { row: 0, col };
					const otherMove = { row: 5, col: col * 2 };
					if (scorer === 1) {
						moves.push(scoringMove);
						if (col < 3) moves.push(otherMove);
					} else moves.push(otherMove, scoringMove);
				}
				localStorage.setItem(
					'axial-active-match',
					JSON.stringify({
						version: 1,
						matchMode: 'classic',
						opponentMode: 'ai',
						aiDifficulty: 'hard',
						boardDimensions: { height: 6, rows: 6, columns: 7 },
						winCondition: { lineLength: 4, linesToWin: 2 },
						startingPlayer: 1,
						moveHistory: moves,
						redoMoves: [],
						gameOverDismissed: false
					})
				);
			},
			{ scorer }
		);
		await page.goto('/?tour=0');
		await expect(page.locator('canvas')).toBeVisible();
		if (scorer === 2) await page.locator('.scene-shell').press('Enter');
		const probe = () => page.evaluate(() => window.__multilineAiProbe);
		await expect.poll(async () => (await probe()).attempts).toBeGreaterThan(0);
		expect((await probe()).errors).toEqual([]);
		await expect
			.poll(async () => (await probe()).responses.length, { timeout: 10000 })
			.toBeGreaterThan(0);
		const response = (await probe()).responses[0];
		expect(response.ok).toBe(true);
		if (!response.ok) throw new Error(response.error);
		expect(response.move).not.toBeNull();
		expect(['search', 'lookahead']).toContain(response.reason);
		expect(response.simulations + (response.telemetry?.lookaheadNodes ?? 0)).toBeGreaterThan(0);
		await expect(page.getByText('Your turn', { exact: true }).first()).toBeVisible();
	});
}

test('a failed worker pauses the turn and retry completes a real search', async ({ page }) => {
	await page.addInitScript(() => {
		const postMessage = Worker.prototype.postMessage;
		let failOnce = true;
		Worker.prototype.postMessage = function (
			message: unknown,
			options?: Transferable[] | StructuredSerializeOptions
		) {
			if (failOnce) {
				failOnce = false;
				throw new DOMException('Simulated transport failure', 'DataCloneError');
			}
			Reflect.apply(postMessage, this, [message, options ?? []]);
		};
		localStorage.setItem(
			'axial-active-match',
			JSON.stringify({
				version: 1,
				matchMode: 'classic',
				opponentMode: 'ai',
				aiDifficulty: 'easy',
				boardDimensions: { height: 6, rows: 6, columns: 7 },
				winCondition: { lineLength: 4, linesToWin: 2 },
				startingPlayer: 1,
				moveHistory: [{ row: 3, col: 3 }],
				redoMoves: [],
				gameOverDismissed: false
			})
		);
	});
	await page.goto('/?tour=0');
	await expect(page.getByRole('alert')).toContainText('The AI couldn’t finish its turn.');
	const savedMoveCount = () =>
		page.evaluate(() => JSON.parse(localStorage.getItem('axial-active-match')!).moveHistory.length);
	expect(await savedMoveCount()).toBe(1);
	await page.getByRole('button', { name: 'Retry AI turn' }).click();
	await expect(page.getByText('Your turn', { exact: true }).first()).toBeVisible();
	await expect.poll(savedMoveCount).toBe(2);
	await expect(page.getByRole('alert')).toHaveCount(0);
});
