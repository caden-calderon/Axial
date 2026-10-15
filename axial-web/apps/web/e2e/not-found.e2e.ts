import { expect, test } from '@playwright/test';

test('unknown paths return a 404 page that leads back to the game', async ({ page, request }) => {
	const raw = await request.get('/no-such-page');
	expect(raw.status()).toBe(404);

	const response = await page.goto('/no-such-page');
	expect(response?.status()).toBe(404);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'This square isn’t on the board'
	);
	await expect(page).toHaveTitle('Page not found · Axial');

	await page.getByRole('link', { name: 'Play Axial' }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.locator('canvas')).toBeVisible();
});
