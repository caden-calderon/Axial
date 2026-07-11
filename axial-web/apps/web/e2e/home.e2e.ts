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

	await page.goto('/?tour=0');

	await expect(page).toHaveTitle(/Axial/);
	await expect(page.locator('.brand-title')).toHaveAccessibleName('AXIAL');
	await expect(page.locator('.board-dimensions .sr-only')).toHaveText('6 x 6 x 7');
	const brandTitleBounds = await page.locator('.brand-title').boundingBox();
	const boardDimensionsBounds = await page.locator('.board-dimensions').boundingBox();
	expect(brandTitleBounds).not.toBeNull();
	expect(boardDimensionsBounds).not.toBeNull();
	expect(
		Math.abs(
			brandTitleBounds!.x +
				brandTitleBounds!.width / 2 -
				(boardDimensionsBounds!.x + boardDimensionsBounds!.width / 2)
		)
	).toBeLessThan(1);
	await expect(page.getByRole('group', { name: 'Opponent mode' })).toBeVisible();
	await expect(
		page.getByRole('button', { name: /enter fullscreen|exit fullscreen/i })
	).toBeVisible();
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

test('PWA install metadata is available', async ({ page, request }) => {
	await page.goto('/?tour=0');

	const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
	const appleTouchIconHref = await page
		.locator('link[rel="apple-touch-icon"]')
		.getAttribute('href');

	expect(new URL(manifestHref ?? '', page.url()).pathname).toBe('/manifest.webmanifest');
	expect(new URL(appleTouchIconHref ?? '', page.url()).pathname).toBe(
		'/icons/apple-touch-icon.png'
	);

	const response = await request.get('/manifest.webmanifest');
	expect(response.ok()).toBe(true);

	const manifest = (await response.json()) as {
		display?: string;
		display_override?: string[];
		icons?: { sizes?: string; purpose?: string; src?: string }[];
		name?: string;
		start_url?: string;
	};

	expect(manifest.name).toBe('Axial');
	expect(manifest.start_url).toBe('/');
	expect(manifest.display).toBe('fullscreen');
	expect(manifest.display_override).toContain('standalone');
	expect(manifest.icons).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ src: '/icons/axial-icon-192.png', sizes: '192x192' }),
			expect.objectContaining({ src: '/icons/axial-icon-512.png', sizes: '512x512' })
		])
	);
});

test('saved AI mode stays visually and behaviorally selected after reload', async ({ page }) => {
	await page.goto('/?tour=0');

	const modeGroup = page.getByRole('group', { name: 'Opponent mode' });
	await modeGroup.getByRole('button', { name: 'AI', exact: true }).click();
	await expect(modeGroup.getByRole('button', { name: 'AI', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page.getByRole('group', { name: 'AI strength' })).toBeVisible();

	await page.reload();

	await expect(modeGroup.getByRole('button', { name: 'AI', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(modeGroup.getByRole('button', { name: 'Local', exact: true })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await expect(page.getByRole('group', { name: 'AI strength' })).toBeVisible();
	await expect(page.getByText('Your turn', { exact: true }).first()).toBeVisible();
});

test('undo cancels stale AI work and mode changes reset the AI opener', async ({ page }) => {
	test.setTimeout(60_000);
	await page.goto('/?tour=0');

	const modeGroup = page.getByRole('group', { name: 'Opponent mode' });
	await modeGroup.getByRole('button', { name: 'AI', exact: true }).click();
	await expect(page.getByText('Your turn', { exact: true }).first()).toBeVisible();

	await page.locator('.scene-shell').focus();
	await page.keyboard.press('Enter');
	await expect(page.getByText('1 move', { exact: true }).first()).toBeVisible();
	await page.getByRole('button', { name: 'Undo move' }).click();
	await expect(page.getByText('0 moves', { exact: true }).first()).toBeVisible();
	await expect(page.getByText('Your turn', { exact: true }).first()).toBeVisible();
	await page.waitForTimeout(2_200);
	await expect(page.getByText('0 moves', { exact: true }).first()).toBeVisible();

	await page.locator('.scene-shell').focus();
	await page.keyboard.press('Enter');
	await expect(page.getByText('2 moves', { exact: true }).first()).toBeVisible({ timeout: 5_000 });
	await page.getByRole('button', { name: 'Reset game' }).click();
	await modeGroup.getByRole('button', { name: 'Local', exact: true }).click();
	await modeGroup.getByRole('button', { name: 'AI', exact: true }).click();
	await expect(page.getByText('Your turn', { exact: true }).first()).toBeVisible();
	await page.waitForTimeout(2_200);
	await expect(page.getByText('0 moves', { exact: true }).first()).toBeVisible();

	await modeGroup.getByRole('button', { name: 'Online', exact: true }).click();
	await modeGroup.getByRole('button', { name: 'AI', exact: true }).click();
	await expect(page.getByText('Your turn', { exact: true }).first()).toBeVisible();
	await page.waitForTimeout(2_200);
	await expect(page.getByText('0 moves', { exact: true }).first()).toBeVisible();
});
