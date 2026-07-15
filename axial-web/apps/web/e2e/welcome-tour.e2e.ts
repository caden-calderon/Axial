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

	await page.getByRole('button', { name: 'Try it' }).click();
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(page.getByText('Explore the board')).toBeVisible();

	await page.locator('.scene-shell').focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Enter');
	await expect(page.getByText('Drop staged')).toBeVisible();
	await expect(page.getByText('0 moves', { exact: true }).first()).toBeVisible();
	await page.getByRole('button', { name: 'Continue' }).click();

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

	await expectTourCardWithinViewport(page);
	await page.getByRole('button', { name: 'Next' }).click();
	await expectTourCardWithinViewport(page);
	await page.getByRole('button', { name: 'Try it' }).click();
	await expectElementWithinViewport(page, '.practice-banner');
	await page.locator('.scene-shell').focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Enter');
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.locator('[data-tour-step="menu-toggle"]')).toBeVisible();
	await expectTourCardWithinViewport(page);
	await expectMenuSpotlightLayout(page);

	await page.getByRole('button', { name: 'Next' }).click();
	await expect(page.locator('[data-tour-step="play-mode"]')).toBeVisible();
	await expectTourCardWithinViewport(page);
	await expectPortraitPanelStepLayout(page, '[data-tour-target="play-mode"]');

	await page.getByRole('button', { name: 'Next' }).click();
	await expect(page.locator('[data-tour-step="rules"]')).toBeVisible();
	await expectTourCardWithinViewport(page);
	await expectPortraitPanelStepLayout(page, '[data-tour-target="rules"]');

	await page.getByRole('button', { name: 'Next' }).click();
	await expect(page.locator('[data-tour-step="appearance"]')).toBeVisible();
	await expectTourCardWithinViewport(page);
	await expectPortraitPanelStepLayout(page, '[data-tour-target="appearance-section"]');

	await page.getByRole('button', { name: 'Next' }).click();
	await expect(page.locator('[data-tour-step="finish"]')).toBeVisible();
	await expectTourCardWithinViewport(page);
	await expectPortraitPanelStepLayout(page, '[data-tour-target="control-panel"]');
});

test('welcome tour traps focus and returns it to the Help action', async ({ page }) => {
	await page.goto('/?tour=0');

	const helpButton = page.getByRole('button', { name: 'How to play' });
	await helpButton.click();
	await expect(page.getByRole('dialog', { name: 'This is Axial' })).toBeVisible();

	for (let index = 0; index < 10; index += 1) {
		await page.keyboard.press('Tab');
		await expect
			.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('dialog[open]'))))
			.toBe(true);
	}

	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(helpButton).toBeFocused();
});

function collectPageErrors(page: Page): string[] {
	const pageErrors: string[] = [];
	page.on('pageerror', (error) => pageErrors.push(error.message));
	return pageErrors;
}

async function expectTourCardWithinViewport(page: Page): Promise<void> {
	await expectElementWithinViewport(page, '.tour-card');
}

async function expectMenuSpotlightLayout(page: Page): Promise<void> {
	await expect
		.poll(async () => {
			const [card, spotlight, target] = await Promise.all([
				page.locator('.tour-card').boundingBox(),
				page.locator('.tour-spotlight').boundingBox(),
				page.locator('[data-tour-target="panel-toggle"]').boundingBox()
			]);
			if (!card || !spotlight || !target) return false;

			const spotlightContainsTarget =
				spotlight.x <= target.x &&
				spotlight.y <= target.y &&
				spotlight.x + spotlight.width >= target.x + target.width &&
				spotlight.y + spotlight.height >= target.y + target.height;
			const aspectRatio = spotlight.width / spotlight.height;

			return (
				spotlightContainsTarget &&
				aspectRatio >= 0.85 &&
				aspectRatio <= 1.15 &&
				!rectanglesOverlap(card, spotlight)
			);
		})
		.toBe(true);
}

async function expectPortraitPanelStepLayout(page: Page, targetSelector: string): Promise<void> {
	await expect
		.poll(async () => {
			const [card, spotlight, panel, target, scroller] = await Promise.all([
				page.locator('.tour-card').boundingBox(),
				page.locator('.tour-spotlight').boundingBox(),
				page.locator('.control-panel').boundingBox(),
				page.locator(targetSelector).boundingBox(),
				page.locator('.panel-body-clip').boundingBox()
			]);
			if (!card || !spotlight || !panel || !target || !scroller) return false;

			const panelBottom = panel.y + panel.height;
			const spotlightBottom = spotlight.y + spotlight.height;
			const targetsWholePanel = targetSelector.includes('control-panel');
			const spotlightRespectsClip = targetsWholePanel
				? spotlight.y >= panel.y - 1 && spotlightBottom <= panelBottom + 11
				: spotlight.y >= scroller.y - 1 && spotlightBottom <= scroller.y + scroller.height + 1;

			return (
				card.y >= panelBottom + 12 &&
				spotlightRespectsClip &&
				!rectanglesOverlap(card, panel) &&
				!rectanglesOverlap(card, spotlight)
			);
		})
		.toBe(true);
}

async function expectElementWithinViewport(page: Page, selector: string): Promise<void> {
	const box = await page.locator(selector).boundingBox();
	const viewport = page.viewportSize();

	expect(box).not.toBeNull();
	expect(viewport).not.toBeNull();
	if (!box || !viewport) return;

	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.y).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
	expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

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
