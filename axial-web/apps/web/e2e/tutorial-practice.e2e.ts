import { expect, test } from '@playwright/test';
import type { Object3D, Scene, WebGLRenderer } from 'three';

declare global {
	interface Window {
		__practiceScene: { pieces: number; lines: number };
		__practiceTarget: number[] | null;
	}
}

test('practice wins on its own board and restores the saved match', async ({ page }) => {
	test.setTimeout(60_000);
	await page.setViewportSize({ width: 1280, height: 800 });
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.addInitScript(() => {
		if (!localStorage.getItem('axial-active-match')) {
			localStorage.setItem(
				'axial-active-match',
				JSON.stringify({
					version: 1,
					matchMode: 'classic',
					opponentMode: 'local',
					aiDifficulty: 'hard',
					boardDimensions: { height: 7, rows: 8, columns: 9 },
					winCondition: { lineLength: 5, linesToWin: 2 },
					startingPlayer: 1,
					moveHistory: [
						{ row: 0, col: 0 },
						{ row: 7, col: 8 }
					],
					redoMoves: [],
					gameOverDismissed: false,
					matchStartedAt: 1_000_000,
					matchEndedAt: null
				})
			);
		}
		window.__THREE_DEVTOOLS__ = new EventTarget();
		window.__practiceScene = { pieces: 0, lines: 0 };
		window.__THREE_DEVTOOLS__.addEventListener('observe', (event) => {
			const renderer = (event as CustomEvent<WebGLRenderer>).detail;
			if (!renderer.isWebGLRenderer) return;
			const render = renderer.render.bind(renderer);
			renderer.render = (scene, camera) => {
				render(scene, camera);
				if (!(scene as Scene).isScene) return;
				window.__practiceTarget = null;
				let pieces = 0;
				let lines = 0;
				scene.traverse((object: Object3D) => {
					if (object.name === 'tutorial-target')
						window.__practiceTarget = object.position.toArray();
					if (object.name.startsWith('piece-')) pieces++;
					if (object.name.startsWith('completed-line-') && object.visible) lines++;
				});
				window.__practiceScene = { pieces, lines };
			};
		});
	});
	await page.goto('/?tour=1');
	await expect(page.getByRole('dialog', { name: 'This is Axial' })).toBeVisible();
	const saved = await page.evaluate(() => localStorage.getItem('axial-active-match'));
	await page.getByRole('button', { name: 'Next', exact: true }).click();
	await page.getByRole('button', { name: 'Try it' }).click();
	await expect(page.locator('#practice-title')).toHaveText('Place the winning piece');
	await expect
		.poll(() => page.evaluate(() => window.__practiceScene))
		.toEqual({ pieces: 24, lines: 0 });
	const target = await page.evaluate(() => window.__practiceTarget);
	expect(target).not.toBeNull();
	await page.screenshot({ path: '/tmp/axial-tutorial-practice-before.png' });

	await page.locator('.scene-shell').press('ArrowRight');
	await page.locator('.scene-shell').press('Enter');
	await expect(page.locator('#practice-copy')).toContainText('glowing tile at row 4, column 4');
	await expect(page.getByRole('button', { name: 'Continue tutorial' })).toBeDisabled();
	expect(await page.evaluate(() => window.__practiceTarget)).toEqual(target);
	await expect.poll(() => page.evaluate(() => window.__practiceScene.pieces)).toBe(24);
	await page.locator('.scene-shell').press('ArrowLeft');
	await page.locator('.scene-shell').press('Enter');
	await expect(page.locator('#practice-title')).toHaveText('Four in a row!');
	await expect
		.poll(() => page.evaluate(() => window.__practiceScene))
		.toEqual({ pieces: 25, lines: 1 });
	await expect(page.locator('.game-over-dialog')).toHaveCount(0);
	expect(await page.evaluate(() => window.__practiceTarget)).toBeNull();
	await page.screenshot({ path: '/tmp/axial-tutorial-practice-win.png' });
	await page.getByRole('button', { name: 'Continue tutorial' }).click();
	await expect(page.locator('[data-tour-step="menu-toggle"]')).toBeVisible();
	await page.getByRole('button', { name: 'Skip' }).click();
	await expect
		.poll(() => page.evaluate(() => window.__practiceScene))
		.toEqual({ pieces: 2, lines: 0 });
	expect(await page.evaluate(() => localStorage.getItem('axial-active-match'))).toBe(saved);
	await expect(page.locator('.sr-only[role="status"]')).toContainText('row 8, column 9');

	// Starting again uses the prepared position; exiting early also preserves the match.
	await page.getByRole('button', { name: 'Expand settings' }).click();
	await page.getByRole('button', { name: 'How to play' }).click();
	await page.getByRole('button', { name: 'Next', exact: true }).click();
	await page.getByRole('button', { name: 'Try it' }).click();
	await expect
		.poll(() => page.evaluate(() => window.__practiceScene))
		.toEqual({ pieces: 24, lines: 0 });
	await page.getByRole('button', { name: 'Exit tutorial' }).click();
	await expect.poll(() => page.evaluate(() => window.__practiceScene.pieces)).toBe(2);
	await page.reload();
	await expect.poll(() => page.evaluate(() => window.__practiceScene.pieces)).toBe(2);
	expect(await page.evaluate(() => localStorage.getItem('axial-active-match'))).toBe(saved);
	expect(errors).toEqual([]);
});
