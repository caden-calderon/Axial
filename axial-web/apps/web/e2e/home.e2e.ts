import { expect, test } from '@playwright/test';

test('Axial shell loads and renders the game canvas', async ({ page }) => {
	const pageErrors: string[] = [];
	const failedRequests: string[] = [];

	page.on('pageerror', (error) => {
		pageErrors.push(error.message);
	});

	page.on('requestfailed', (request) => {
		const url = request.url();
		if (url.startsWith('data:') || url.includes('favicon')) return;

		failedRequests.push(`${request.method()} ${url} ${request.failure()?.errorText ?? ''}`.trim());
	});

	await page.goto('/');

	await expect(page).toHaveTitle(/Axial/);
	await expect(page.locator('.brand-title')).toHaveText('AXIAL');
	await expect(page.locator('.board-dimensions')).toHaveText('6 x 6 x 7');
	await expect(page.getByRole('group', { name: 'Opponent mode' })).toBeVisible();
	await expect(
		page.getByRole('button', { name: /collapse settings|expand settings/i })
	).toBeVisible();
	await expect(page.locator('canvas')).toBeVisible();
	await expect(page.locator('.game-shell')).toHaveCSS('background-image', 'none');
	await expect(page.locator('.aurora')).toHaveCSS('display', 'none');

	await page.waitForFunction(() => {
		const canvas = document.querySelector('canvas');
		if (!canvas) return false;

		const bounds = canvas.getBoundingClientRect();
		return bounds.width >= 300 && bounds.height >= 300;
	});

	expect(pageErrors).toEqual([]);
	expect(failedRequests).toEqual([]);
});
