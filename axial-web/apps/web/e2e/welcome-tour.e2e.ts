import { expect, test, type Page } from '@playwright/test';

test('welcome tour shows once, opens the menu, and persists dismissal', async ({ page }) => {
	const pageErrors = collectPageErrors(page);

	await page.goto('/');

	const tour = page.getByRole('dialog', { name: 'This is Axial' });
	await expect(tour).toBeVisible();
	await expect(page.locator('[data-tour-step="welcome"]')).toBeVisible();
	await expect(page.locator('.control-panel')).toHaveClass(/collapsed/);

	await page.getByRole('button', { name: 'Next' }).click();
	await expect(page.locator('[data-tour-step="board"]')).toBeVisible();

	await page.getByRole('button', { name: 'Next' }).click();
	await expect(page.locator('[data-tour-step="menu-toggle"]')).toBeVisible();
	await expect(page.locator('[data-tour-target="panel-toggle"]')).toBeVisible();
	await expect(page.locator('.control-panel')).toHaveClass(/collapsed/);

	await page.getByRole('button', { name: 'Next' }).click();
	await expect(page.locator('[data-tour-step="play-mode"]')).toBeVisible();
	await expect(page.locator('.control-panel')).not.toHaveClass(/collapsed/);
	await expect(page.getByRole('group', { name: 'Opponent mode' })).toBeVisible();

	await page.getByRole('button', { name: 'Skip' }).click();
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(page.locator('.control-panel')).toHaveClass(/collapsed/);

	await page.reload();
	await expect(page.getByRole('dialog')).toHaveCount(0);

	await page.goto('/?tour=1');
	await expect(page.getByRole('dialog', { name: 'This is Axial' })).toBeVisible();

	expect(pageErrors).toEqual([]);
});

test('welcome tour remains within a phone viewport', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/?tour=1');

	for (let index = 0; index < 4; index += 1) {
		await expect(page.getByRole('dialog')).toBeVisible();
		await expectTourCardWithinViewport(page);
		await page.getByRole('button', { name: 'Next' }).click();
	}

	await expect(page.locator('[data-tour-step="rules"]')).toBeVisible();
	await expectTourCardWithinViewport(page);
});

function collectPageErrors(page: Page): string[] {
	const pageErrors: string[] = [];
	page.on('pageerror', (error) => pageErrors.push(error.message));
	return pageErrors;
}

async function expectTourCardWithinViewport(page: Page): Promise<void> {
	const box = await page.locator('.tour-card').boundingBox();
	const viewport = page.viewportSize();

	expect(box).not.toBeNull();
	expect(viewport).not.toBeNull();
	if (!box || !viewport) return;

	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.y).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
	expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}
