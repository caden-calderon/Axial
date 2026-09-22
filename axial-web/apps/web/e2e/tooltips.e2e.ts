import { expect, test } from '@playwright/test';

for (const theme of ['dark', 'light']) {
	test(`control hints follow the ${theme} theme and dismiss cleanly`, async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 600 });
		await page.addInitScript((theme) => localStorage.setItem('axial-theme', theme), theme);
		await page.goto('/?tour=0');
		const reset = page.getByRole('button', { name: 'Reset game', exact: true });
		await expect(reset).not.toHaveAttribute('title');
		expect(
			await page.locator('.coming-soon-option').evaluate((button) => {
				const bounds = button.getBoundingClientRect();
				return Array.from(button.children).every((child) => {
					const box = child.getBoundingClientRect();
					return box.left >= bounds.left && box.right <= bounds.right;
				});
			})
		).toBe(true);
		await reset.hover();
		const tooltip = page.getByRole('tooltip');
		await expect(tooltip).toHaveText('Reset game');
		await expect(tooltip).toBeVisible();
		await expect(tooltip).toBeInViewport();
		await expect(reset).toHaveAttribute('aria-describedby', 'control-tooltip');
		const colors = await tooltip.evaluate((element) => {
			const style = getComputedStyle(element);
			const shell = getComputedStyle(document.querySelector('.game-shell')!);
			return {
				color: style.color,
				family: style.fontFamily,
				surface: style.backgroundColor,
				theme: shell.getPropertyValue('--text').trim()
			};
		});
		expect(colors.family).toContain('Axial UI');
		expect(colors.color).toBe(theme === 'dark' ? 'rgb(236, 248, 243)' : 'rgb(23, 38, 32)');
		await page.screenshot({ path: `/tmp/axial-tooltip-${theme}.png` });
		await page.keyboard.press('Escape');
		await expect(tooltip).toBeHidden();
		await expect(reset).not.toHaveAttribute('aria-describedby');

		// Keyboard focus exposes the same hint without a hover delay.
		await page.keyboard.press('Tab');
		await reset.focus();
		await expect(tooltip).toHaveText('Reset game');
		await expect(tooltip).toBeVisible();
		await page.locator('.panel-scroll').evaluate((element) => {
			element.scrollTop = element.scrollHeight;
		});
		await expect(tooltip).toBeHidden();
		await expect(page.locator('.control-panel [title]')).toHaveCount(0);
	});
}

test('disabled control hints remain available and do not get clipped by the scroller', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/?tour=0');
	await page.getByRole('button', { name: 'Expand settings' }).click();
	const tactical = page.locator('[data-tooltip="Tactical mode is coming soon"]');
	await tactical.hover();
	await expect(page.getByRole('tooltip')).toHaveText('Tactical mode is coming soon');
	await expect(page.getByRole('tooltip')).toBeVisible();
	await expect(page.getByRole('tooltip')).toBeInViewport();
	await page.mouse.move(5, 700);
	await expect(page.getByRole('tooltip')).toBeHidden();
});

test('touch taps do not leave a hover hint over the controls', async ({ browser }) => {
	const context = await browser.newContext({
		baseURL: test.info().project.use.baseURL,
		viewport: { width: 390, height: 844 },
		hasTouch: true,
		isMobile: true
	});
	const page = await context.newPage();
	await page.goto('/?tour=0');
	await page.getByRole('button', { name: 'Expand settings' }).tap();
	await expect(page.locator('.control-panel')).not.toHaveClass(/collapsed/);
	await expect(page.getByRole('tooltip')).toBeHidden();
	await context.close();
});
