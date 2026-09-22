import { expect, test } from '@playwright/test';

for (const viewport of [
	{ width: 1440, height: 900 },
	{ width: 390, height: 844 }
]) {
	test(`online options open below the stationary mode switch at ${viewport.width}px`, async ({
		page
	}) => {
		await page.setViewportSize(viewport);
		await page.goto('/?tour=0');
		if (viewport.width < 720) {
			await page.getByRole('button', { name: 'Expand settings' }).click();
		}

		const modes = page.getByRole('group', { name: 'Opponent mode' });
		const onlineButton = modes.getByRole('button', { name: 'Online', exact: true });
		await expect(onlineButton).toBeVisible();
		// Finish the opening transition before recording the position on mobile.
		await page.locator('.control-panel').evaluate(async (panel) => {
			await Promise.all(
				panel.getAnimations({ subtree: true }).map((animation) => animation.finished)
			);
		});
		const before = await modes.boundingBox();
		expect(before).not.toBeNull();

		await onlineButton.click();
		const onlineOptions = page.getByRole('region', { name: 'Online room', exact: true });
		await expect(onlineOptions).toBeVisible();
		await expect(onlineOptions.getByRole('button', { name: 'Create room' })).toBeVisible();
		const after = await modes.boundingBox();
		const options = await onlineOptions.boundingBox();
		expect(after).not.toBeNull();
		expect(options).not.toBeNull();
		expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
		expect(options!.y).toBeGreaterThanOrEqual(after!.y + after!.height);

		await modes.getByRole('button', { name: 'Local', exact: true }).click();
		await expect(onlineOptions).toHaveCount(0);
		const restored = await modes.boundingBox();
		expect(restored).not.toBeNull();
		expect(Math.abs(restored!.y - before!.y)).toBeLessThan(1);
	});
}
