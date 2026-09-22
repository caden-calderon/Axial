import { expect, test } from '@playwright/test';

for (const viewport of [
	{ width: 1440, height: 720 },
	{ width: 390, height: 844 },
	{ width: 320, height: 568 },
	{ width: 540, height: 600 }
]) {
	test(`settings toolbar scrolls with the panel at ${viewport.width}px`, async ({ page }) => {
		await page.setViewportSize(viewport);
		await page.goto('/?tour=0');
		const panel = page.locator('.control-panel');
		const toolbar = panel.locator('.panel-toolbar');
		const scroller = panel.locator('.panel-scroll');
		if (viewport.width < 720) {
			await page.getByRole('button', { name: 'Expand settings' }).click();
		}
		await expect(panel).not.toHaveClass(/collapsed/);
		await panel.evaluate(async (element) => {
			await Promise.allSettled(
				element.getAnimations({ subtree: true }).map((animation) => animation.finished)
			);
		});
		await expect(toolbar).toBeInViewport();
		await expect(scroller).toHaveCSS('scrollbar-width', 'none');
		const resetButton = page.getByRole('button', { name: 'Reset game', exact: true });
		await resetButton.hover();
		await resetButton.evaluate(async (element) => {
			await Promise.allSettled(element.getAnimations().map((animation) => animation.finished));
		});
		await expect
			.poll(async () => {
				const button = await resetButton.boundingBox();
				const scroll = await scroller.boundingBox();
				return Boolean(button && scroll && button.y >= scroll.y + 0.5);
			})
			.toBe(true);
		await panel.screenshot({ path: `/tmp/axial-toolbar-expanded-hover-${viewport.width}.png` });
		await page.mouse.move(0, 500);
		const scrollerBounds = await scroller.boundingBox();
		const panelBounds = await panel.boundingBox();
		expect(scrollerBounds!.x).toBeGreaterThan(panelBounds!.x);
		expect(scrollerBounds!.x + scrollerBounds!.width).toBeLessThan(
			panelBounds!.x + panelBounds!.width
		);
		const toolbarPositions = await toolbar
			.locator('button:visible')
			.evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().x));
		await scroller.evaluate(async (element) => {
			await Promise.allSettled(
				element.getAnimations({ subtree: true }).map((animation) => animation.finished)
			);
			element.scrollTop = element.scrollHeight;
		});
		await expect(toolbar).not.toBeInViewport();
		await expect(panel.locator('.session-section')).toBeInViewport();
		await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

		await scroller.evaluate((element) => {
			element.scrollTop = 0;
		});
		await expect(toolbar).toBeInViewport();
		if (viewport.width < 720) {
			await page.getByRole('button', { name: 'Full sheet', exact: true }).click();
			await expect(panel).toHaveAttribute('data-sheet-state', 'full');
			await panel.evaluate(async (element) => {
				await Promise.allSettled(
					element.getAnimations({ subtree: true }).map((animation) => animation.finished)
				);
			});
			await scroller.evaluate((element) => {
				element.scrollTop = element.scrollHeight;
			});
			await expect(toolbar).not.toBeInViewport();
			await expect(panel.locator('.session-section')).toBeInViewport();
			await scroller.evaluate((element) => {
				element.scrollTop = 0;
			});
			await page.getByRole('button', { name: 'Half sheet', exact: true }).click();
			await expect(panel).toHaveAttribute('data-sheet-state', 'half');
		}
		await page.getByRole('button', { name: 'Collapse settings' }).click();
		await expect(panel).toHaveAttribute('data-sheet-state', 'collapsed');
		await expect(page.getByRole('button', { name: 'Expand settings' })).toBeInViewport();
		await resetButton.hover();
		await resetButton.evaluate(async (element) => {
			await Promise.allSettled(element.getAnimations().map((animation) => animation.finished));
		});
		await expect
			.poll(async () => {
				const button = await resetButton.boundingBox();
				const scroll = await scroller.boundingBox();
				return Boolean(button && scroll && button.y >= scroll.y + (viewport.width < 720 ? 0 : 0.5));
			})
			.toBe(true);
		await panel.screenshot({ path: `/tmp/axial-toolbar-hover-${viewport.width}.png` });
		if (viewport.width >= 720) {
			const collapsedPositions = await toolbar
				.locator('button:visible')
				.evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().x));
			expect(collapsedPositions).toEqual(toolbarPositions);
		}
		await page.getByRole('button', { name: 'Expand settings' }).click();
		await expect(toolbar).toBeInViewport();
	});
}
