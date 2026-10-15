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

test('static head tags are in the initial HTML so they work before hydration', async ({
	request
}) => {
	const html = await (await request.get('/')).text();
	const href = (rel: string) =>
		new RegExp(`<link\\s+rel="${rel}"\\s+href="([^"]+)"`).exec(html)?.[1];

	for (const rel of ['icon', 'apple-touch-icon', 'manifest', 'preload']) {
		const target = href(rel);
		expect(target, `${rel} link`).toBeTruthy();
		const response = await request.get(new URL(target!, 'http://localhost/').pathname);
		expect(response.ok(), `${rel} ${target}`).toBe(true);
	}
	expect(html).toContain('<meta name="theme-color" content="#071012" />');
});
