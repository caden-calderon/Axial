import { expect, test } from '@playwright/test';

for (const viewport of [
	{ width: 1280, height: 800 },
	{ width: 320, height: 568 }
]) {
	test(`completed match shows moves and frozen duration at ${viewport.width}px`, async ({
		page
	}) => {
		await page.setViewportSize(viewport);
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.addInitScript(() => {
			if (localStorage.getItem('axial-active-match')) return;
			const moveHistory = [];
			for (let col = 0; col < 4; col++) {
				moveHistory.push({ row: 3, col });
				if (col < 3) moveHistory.push({ row: 5, col });
			}
			localStorage.setItem(
				'axial-active-match',
				JSON.stringify({
					version: 1,
					matchMode: 'classic',
					opponentMode: 'local',
					aiDifficulty: 'hard',
					boardDimensions: { height: 6, rows: 6, columns: 7 },
					winCondition: { lineLength: 4, linesToWin: 1 },
					startingPlayer: 1,
					moveHistory,
					redoMoves: [],
					gameOverDismissed: false,
					matchStartedAt: 1_000_000,
					matchEndedAt: 1_090_000
				})
			);
		});
		await page.goto('/?tour=0');
		const dialog = page.getByRole('dialog');
		await expect(dialog.getByRole('heading', { name: 'Player 1 wins' })).toBeVisible();
		await expect(dialog.locator('dt')).toHaveText(['Moves', 'Match time']);
		await expect(dialog.locator('dd')).toHaveText(['7', '1:30']);
		await expect(dialog).not.toContainText('Across the board');
		await expect(
			dialog.getByRole('button', { name: 'Start a new match with an empty board' })
		).toBeInViewport();
		await page.screenshot({ path: `/tmp/axial-polish-result-${viewport.width}.png` });
		await page.reload();
		await expect(dialog.locator('dd')).toHaveText(['7', '1:30']);
		await dialog
			.getByRole('button', { name: 'Dismiss the result and keep the final board visible' })
			.click();
		await expect(dialog).toHaveCount(0);
		await expect(page.locator('canvas')).toBeVisible();
		await page.screenshot({ path: `/tmp/axial-polish-pieces-${viewport.width}.png` });
	});
}
