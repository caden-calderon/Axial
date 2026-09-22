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
	await expect(page.getByText('Place the winning piece')).toBeVisible();

	await page.locator('.scene-shell').focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('#practice-title')).toBeVisible();
	await expect(page.locator('#practice-title')).toHaveText('Four in a row!');
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

for (const viewport of [
	{ width: 320, height: 568 },
	{ width: 390, height: 844 },
	{ width: 1024, height: 600 },
	{ width: 1280, height: 720 },
	{ width: 844, height: 390 }
]) {
	test(`complete tutorial layout at ${viewport.width}x${viewport.height}`, async ({
		page
	}, testInfo) => {
		const pageErrors = collectPageErrors(page);
		await page.setViewportSize(viewport);
		await page.goto('/?tour=1');
		for (const step of [
			'welcome',
			'board',
			'menu-toggle',
			'play-mode',
			'rules',
			'appearance',
			'finish'
		]) {
			await expect(page.locator('.tour-card')).toHaveAttribute('data-tour-step', step);
			await expect(page.locator('#welcome-tour-body')).toHaveClass(/visible/);
			await expect(page.locator('#welcome-tour-body')).toHaveCSS('opacity', '1');
			await expectTourCardWithinViewport(page);
			await expectElementWithinViewport(page, '.tour-actions');
			if (!['welcome', 'board'].includes(step)) {
				await expect
					.poll(async () => {
						const card = await page.locator('.tour-card').boundingBox();
						const spotlight = await page.locator('.tour-spotlight').boundingBox();
						return card !== null && spotlight !== null && !rectanglesOverlap(card, spotlight);
					})
					.toBe(true);
			}
			await expect(page.locator('#welcome-tour-body')).toHaveCSS('user-select', 'none');
			await expect
				.poll(() =>
					page
						.locator('.tour-copy')
						.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)
				)
				.toBe(true);
			if (viewport.width <= 760 || viewport.height <= 500) {
				for (const button of await page.locator('.tour-actions button').all()) {
					const bounds = await button.boundingBox();
					expect(bounds?.width).toBeGreaterThanOrEqual(44);
					expect(bounds?.height).toBeGreaterThanOrEqual(44);
				}
			}
			await expect
				.poll(() =>
					page
						.locator('.tour-card-inner')
						.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
				)
				.toBe(true);
			await page.screenshot({ path: testInfo.outputPath(`${step}.png`) });
			if (step === 'board') {
				await page.getByRole('button', { name: 'Try it' }).click();
				await expectElementWithinViewport(page, '.practice-banner');
				await expect(page.locator('#practice-title')).toHaveText('Place the winning piece');
				await page.locator('.scene-shell').focus();
				await page.keyboard.press('Enter');
				await expect(page.locator('#practice-title')).toHaveText('Four in a row!');
				await page.screenshot({ path: testInfo.outputPath('practice.png') });
				await page.getByRole('button', { name: 'Continue tutorial' }).click();
			} else {
				await page
					.getByRole('button', { name: step === 'finish' ? 'Finish' : 'Next', exact: true })
					.click();
			}
		}
		expect(pageErrors).toEqual([]);
	});
}

test('tutorial typing does not flash native scrollbars', async ({ page }) => {
	await page.setViewportSize({ width: 1024, height: 600 });
	await page.addInitScript(() => localStorage.setItem('axial-theme', 'light'));
	await page.goto('/?tour=1');
	await page.getByRole('button', { name: 'Next', exact: true }).click();
	await expect(page.locator('[data-tour-step="board"] .typed-cursor')).not.toHaveClass(/settled/);
	for (const selector of ['.tour-copy', '.tour-card-inner']) {
		const scroller = page.locator(selector);
		await expect(scroller).toHaveCSS('scrollbar-width', 'none');
		expect(
			await scroller.evaluate((element) => getComputedStyle(element, '::-webkit-scrollbar').display)
		).toBe('none');
	}
	await page.screenshot({ path: '/tmp/axial-tutorial-typing.png' });
	await expect(page.locator('#welcome-tour-body')).toHaveCSS('opacity', '1');
	await expectTourCardWithinViewport(page);
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
				page.locator('.panel-scroll').boundingBox()
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
