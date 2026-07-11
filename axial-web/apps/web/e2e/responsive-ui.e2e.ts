import { expect, test } from '@playwright/test';

test('collapsed phone controls stay minimal and avoid the brand at 320px', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 568 });
	await page.goto('/?tour=0');

	await expect(page.locator('.control-panel')).toHaveClass(/collapsed/);
	await expect(page.locator('.turn-chip')).toBeHidden();

	const brand = await page.locator('.brand-lockup').boundingBox();
	const panel = await page.locator('.control-panel').boundingBox();
	const brandTitleFontSize = Number.parseFloat(
		await page.locator('.brand-title').evaluate((title) => getComputedStyle(title).fontSize)
	);
	expect(brand).not.toBeNull();
	expect(panel).not.toBeNull();
	expect(brandTitleFontSize).toBeGreaterThanOrEqual(27);
	if (!brand || !panel) return;

	expect(rectanglesOverlap(brand, panel)).toBe(false);
	expect(panel.y).toBeGreaterThan(brand.y + brand.height);
});

test('coarse phone controls use touch targets and mobile-safe input text', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/?tour=0');
	await page.getByRole('button', { name: 'Expand settings' }).click();

	const undersizedButtons = await page.locator('button:visible').evaluateAll((buttons) =>
		buttons
			.map((button) => {
				const rect = button.getBoundingClientRect();
				return {
					name: button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '',
					width: rect.width,
					height: rect.height
				};
			})
			.filter(({ width, height }) => width < 43.5 || height < 43.5)
	);
	expect(undersizedButtons).toEqual([]);

	await page
		.getByRole('group', { name: 'Opponent mode' })
		.getByRole('button', { name: 'Online' })
		.click();
	const onlineInput = page.getByRole('textbox', { name: 'Your name' });
	await expect(onlineInput).toBeVisible();
	expect(
		Number.parseFloat(await onlineInput.evaluate((input) => getComputedStyle(input).fontSize))
	).toBeGreaterThanOrEqual(16);
});

test('new touch users stage a move and explicitly confirm it', async ({ browser }) => {
	const context = await browser.newContext({
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true
	});
	const page = await context.newPage();
	try {
		await page.goto('/?tour=0');
		await page.locator('.scene-shell').focus();
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('Enter');

		await expect(page.getByRole('group', { name: 'Confirm selected move' })).toBeVisible();
		await expect(page.getByText('0 moves', { exact: true }).first()).toBeVisible();
		await page.getByRole('button', { name: 'Confirm selected move' }).click();
		await expect(page.getByText('1 move', { exact: true }).first()).toBeVisible();
	} finally {
		await context.close();
	}
});

function rectanglesOverlap(
	first: { x: number; y: number; width: number; height: number },
	second: { x: number; y: number; width: number; height: number }
): boolean {
	return !(
		first.x + first.width <= second.x ||
		second.x + second.width <= first.x ||
		first.y + first.height <= second.y ||
		second.y + second.height <= first.y
	);
}
