import { expect, test, type Page } from '@playwright/test';

// The collapsed phone toolbar hides undo and redo, so "Review match" needs its own controls.
test('a phone can step through a reviewed match without opening the panel', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await seedFinishedMatch(page);
	await page.goto('/?tour=0');

	const reviewBar = page.getByRole('group', { name: 'Review moves' });
	await expect(reviewBar).toHaveCount(0);
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /^Review match/ })
		.click();
	await expect(page.getByRole('button', { name: 'Expand settings' })).toBeVisible();
	await expect(reviewBar).toBeVisible();
	await expect(reviewBar).toContainText('Move 0 of 7');
	await expect(reviewBar.getByRole('button', { name: /Back/ })).toBeDisabled();
	for (const box of [
		await reviewBar.getByRole('button', { name: /Back/ }).boundingBox(),
		await reviewBar.getByRole('button', { name: /Next/ }).boundingBox()
	]) {
		expect(box!.width).toBeGreaterThanOrEqual(44);
		expect(box!.height).toBeGreaterThanOrEqual(44);
	}

	const next = reviewBar.getByRole('button', { name: /Next/ });
	for (let move = 1; move <= 6; move++) {
		await next.click();
		await expect(reviewBar).toContainText(`Move ${move} of 7`);
	}
	await reviewBar.getByRole('button', { name: /Back/ }).click();
	await expect(reviewBar).toContainText('Move 5 of 7');

	// Reviewing keeps the whole match saved for a refresh.
	const saved = await page.evaluate(() =>
		JSON.parse(localStorage.getItem('axial-active-match') ?? 'null')
	);
	expect(saved.moveHistory.length + saved.redoMoves.length).toBe(7);

	await next.click();
	await next.click();
	// The final move ends the match again: the result returns and the bar steps aside.
	await expect(
		page.getByRole('dialog').getByRole('heading', { name: 'Player 1 wins' })
	).toBeVisible();
	await expect(reviewBar).toHaveCount(0);
});

test('a desktop review shows its bar beside the open panel and ignores board clicks', async ({
	page
}) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await seedFinishedMatch(page);
	await page.goto('/?tour=0');

	await page
		.getByRole('dialog')
		.getByRole('button', { name: /^Review match/ })
		.click();
	await expect(page.locator('.control-panel')).not.toHaveClass(/collapsed/);
	const reviewBar = page.getByRole('group', { name: 'Review moves' });
	await expect(reviewBar).toContainText('Move 0 of 7');

	await reviewBar.getByRole('button', { name: /Next/ }).click();
	await expect(reviewBar).toContainText('Move 1 of 7');

	// Clicking the board or pressing Enter must not branch off and drop the recorded moves.
	const canvas = page.locator('canvas');
	const box = (await canvas.boundingBox())!;
	await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.6);
	await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.6);
	await page.locator('.scene-shell').press('Enter');
	await page.locator('.scene-shell').press('Enter');
	await expect(reviewBar).toContainText('Move 1 of 7');
	const saved = await page.evaluate(() =>
		JSON.parse(localStorage.getItem('axial-active-match') ?? 'null')
	);
	expect(saved).toMatchObject({ reviewing: true });
	expect(saved.moveHistory.length + saved.redoMoves.length).toBe(7);
});

/** A finished local match: Player 1 wins along row 3 in seven moves. */
async function seedFinishedMatch(page: Page): Promise<void> {
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
}
