import { expect, test, type Page } from '@playwright/test';

test('collapsed portrait controls fit beside the Axial logo at 320px', async ({ page }) => {
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
	expect(panel.y).toBeLessThan(brand.y + brand.height);
	expect(panel.width).toBeLessThanOrEqual(151);
	expect(panel.height).toBeLessThanOrEqual(51);
	expect(Math.abs(panel.x + panel.width - 312)).toBeLessThan(2);

	const toolbarButtons = await page
		.locator('.panel-toolbar button:visible')
		.evaluateAll((buttons) =>
			buttons.map((button) => {
				const bounds = button.getBoundingClientRect();
				return {
					left: bounds.left,
					right: bounds.right,
					width: bounds.width,
					height: bounds.height
				};
			})
		);
	expect(toolbarButtons).toHaveLength(3);
	for (const button of toolbarButtons) {
		expect(button.width).toBeGreaterThanOrEqual(43.5);
		expect(button.height).toBeGreaterThanOrEqual(43.5);
	}
	const leftInset = toolbarButtons[0].left - panel.x;
	const rightInset = panel.x + panel.width - toolbarButtons.at(-1)!.right;
	expect(Math.abs(leftInset - rightInset)).toBeLessThan(0.75);
	for (let index = 1; index < toolbarButtons.length; index += 1) {
		expect(toolbarButtons[index].left - toolbarButtons[index - 1].right).toBeGreaterThan(2);
	}

	await expect(page.getByRole('button', { name: 'Undo move' })).toBeHidden();
	await expect(page.getByRole('button', { name: 'Redo move' })).toBeHidden();
	await expect(
		page.getByRole('button', { name: /enter fullscreen|exit fullscreen/i })
	).toBeHidden();
});

test('portrait controls open as centered half and full top sheets', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/?tour=0');
	await expect(page.locator('.control-panel')).toHaveClass(/collapsed/);
	await page.getByRole('button', { name: 'Expand settings' }).click();
	await expect(page.locator('.control-panel')).toHaveAttribute('data-sheet-state', 'half');
	await finishPanelTransition(page);
	const expandedButtonRadii = await page
		.locator('.panel-toolbar .icon-button:visible')
		.evaluateAll((buttons) =>
			buttons.map((button) => Number.parseFloat(getComputedStyle(button).borderRadius))
		);
	expect(expandedButtonRadii.every((radius) => radius >= 22)).toBe(true);
	const toolbarStyle = await page.locator('.panel-toolbar').evaluate((toolbar) => ({
		border: getComputedStyle(toolbar).borderTopWidth,
		background: getComputedStyle(toolbar).backgroundColor,
		separators: Array.from(toolbar.querySelectorAll('button')).map(
			(button) => getComputedStyle(button, '::before').content
		)
	}));
	expect(toolbarStyle.border).toBe('0px');
	expect(toolbarStyle.background).toBe('rgba(0, 0, 0, 0)');
	expect(toolbarStyle.separators.every((content) => content === 'none')).toBe(true);

	const expandedPanel = await page.locator('.control-panel').boundingBox();
	expect(expandedPanel).not.toBeNull();
	expect(expandedPanel!.x).toBeCloseTo(0, 0);
	expect(expandedPanel!.y).toBeCloseTo(0, 0);
	expect(expandedPanel!.width).toBeCloseTo(390, 0);
	expect(expandedPanel!.height).toBeCloseTo(422, 0);

	const toolbar = page.locator('.panel-toolbar');
	const toolbarBox = await toolbar.boundingBox();
	const toolbarButtons = await toolbar.locator('button:visible').evaluateAll((buttons) =>
		buttons.map((button) => {
			const bounds = button.getBoundingClientRect();
			return { left: bounds.left, right: bounds.right };
		})
	);
	expect(toolbarBox).not.toBeNull();
	expect(toolbarButtons.length).toBeGreaterThan(0);
	if (toolbarBox && toolbarButtons.length > 0) {
		const leftInset = toolbarButtons[0].left - toolbarBox.x;
		const rightInset = toolbarBox.x + toolbarBox.width - toolbarButtons.at(-1)!.right;
		expect(Math.abs(leftInset - rightInset)).toBeLessThan(1.5);
	}

	await page.getByRole('button', { name: 'Full sheet' }).click();
	await expect(page.locator('.control-panel')).toHaveAttribute('data-sheet-state', 'full');
	await finishPanelTransition(page);
	const fullPanel = await page.locator('.control-panel').boundingBox();
	expect(fullPanel).not.toBeNull();
	expect(fullPanel!.x).toBeCloseTo(0, 0);
	expect(fullPanel!.y).toBeCloseTo(0, 0);
	expect(fullPanel!.width).toBeCloseTo(390, 0);
	expect(fullPanel!.height).toBeCloseTo(844, 0);

	await page.getByRole('button', { name: 'Half sheet' }).click();
	await expect(page.locator('.control-panel')).toHaveAttribute('data-sheet-state', 'half');
});

for (const viewport of [
	{ width: 740, height: 800 },
	{ width: 800, height: 800 },
	{ width: 900, height: 800 },
	{ width: 1024, height: 768 },
	{ width: 1280, height: 720 },
	{ width: 844, height: 390 }
]) {
	test(`status and settings stay separate at ${viewport.width}x${viewport.height}`, async ({
		page
	}) => {
		await page.setViewportSize(viewport);
		await page.goto('/?tour=0');
		const chip = page.locator('.turn-chip');
		await expect(chip).toBeVisible();
		const chipBounds = await chip.boundingBox();
		const panelBounds = await page.locator('.control-panel').boundingBox();
		const brandBounds = await page.locator('.brand-lockup').boundingBox();
		expect(rectanglesOverlap(chipBounds!, panelBounds!)).toBe(false);
		expect(rectanglesOverlap(chipBounds!, brandBounds!)).toBe(false);
		await page.getByRole('button', { name: 'Collapse settings' }).click();
		const collapsedBounds = await page.locator('.control-panel').boundingBox();
		expect(rectanglesOverlap(chipBounds!, collapsedBounds!)).toBe(false);
	});
}

test('coarse phone controls use touch targets, mobile-safe text, and grid-off defaults', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/?tour=0');
	await page.getByRole('button', { name: 'Expand settings' }).click();
	await finishPanelTransition(page);
	await expect(page.getByRole('checkbox', { name: 'Toggle grid layers' })).not.toBeChecked();

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
		const confirmBar = await page
			.getByRole('group', { name: 'Confirm selected move' })
			.boundingBox();
		expect(confirmBar).not.toBeNull();
		expect(844 - (confirmBar!.y + confirmBar!.height)).toBeLessThanOrEqual(9);

		await page.getByRole('button', { name: 'Expand settings' }).click();
		const panel = await page.locator('.control-panel').boundingBox();
		expect(panel).not.toBeNull();
		expect(panel!.y + panel!.height).toBeLessThan(confirmBar!.y);
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

async function finishPanelTransition(page: Page): Promise<void> {
	await page.locator('.control-panel').evaluate(async (panel) => {
		await Promise.allSettled(
			panel.getAnimations({ subtree: true }).map((animation) => animation.finished)
		);
	});
}
