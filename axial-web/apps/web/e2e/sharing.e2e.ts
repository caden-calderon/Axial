import { expect, test } from '@playwright/test';

test('share metadata is available before JavaScript runs', async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	try {
		await page.goto('/');
		await expect(page).toHaveTitle('Axial');
		await expect(page.locator('meta[name="description"]')).toHaveAttribute(
			'content',
			/Connect four in three dimensions/
		);
		await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
			'content',
			'Axial — Connect four in three dimensions'
		);
		await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
			'content',
			/Play against AI or challenge a friend/
		);
		await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary');
		await page.goto('/room');
		await expect(page.locator('head title')).toHaveCount(1);
		await expect(page).toHaveTitle('Axial');
	} finally {
		await context.close();
	}
});

test('hydration preserves a single page title and description', async ({ page }) => {
	await page.goto('/?tour=0');
	await expect(page.locator('canvas')).toBeVisible();
	await expect(page.locator('head title')).toHaveCount(1);
	await expect(page.locator('meta[name="description"]')).toHaveCount(1);
	await expect(page).toHaveTitle('Axial');
});
