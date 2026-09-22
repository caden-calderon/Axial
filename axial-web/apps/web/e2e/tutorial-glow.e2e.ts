import { expect, test } from '@playwright/test';

test('tutorial border completes its sweep while the pointer moves, then follows the pointer', async ({
	page
}) => {
	await page.goto('/?tour=1');
	const card = page.locator('.tour-card');
	await expect(card).toHaveClass(/sweep-active/);
	await card.hover({ position: { x: 40, y: 20 } });

	const samples = await card.evaluate(async (element) => {
		const card = element as HTMLElement;
		const points: { x: number; y: number }[] = [];
		await new Promise<void>((resolve) => {
			const sample = () => {
				if (!card.classList.contains('sweep-active')) {
					resolve();
					return;
				}
				const bounds = card.getBoundingClientRect();
				// Keep updating the hover target at the opposite edge as the sweep travels.
				card.dispatchEvent(
					new PointerEvent('pointermove', {
						clientX: bounds.right - 2,
						clientY: bounds.top + bounds.height / 2,
						bubbles: true
					})
				);
				points.push({
					x: parseFloat(card.style.getPropertyValue('--glow-x')),
					y: parseFloat(card.style.getPropertyValue('--glow-y'))
				});
				requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
		});
		return points;
	});

	// A pointer must not pull the automatic highlight off its clockwise perimeter path.
	expect(samples.length).toBeGreaterThan(15);
	expect(samples.some(({ y }) => y === 100)).toBe(true);
	expect(samples.some(({ x }) => x === 0)).toBe(true);
	let previousProgress = 0;
	for (const { x, y } of samples) {
		expect(x === 0 || x === 100 || y === 0 || y === 100).toBe(true);
		let progress: number;
		if (y === 0) progress = x / 400;
		else if (x === 100) progress = 0.25 + y / 400;
		else if (y === 100) progress = 0.75 - x / 400;
		else progress = 1 - y / 400;
		if (previousProgress > 0.9 && progress < 0.25) progress += 1;
		expect(progress).toBeGreaterThanOrEqual(previousProgress - 0.00001);
		previousProgress = progress;
	}
	await expect
		.poll(() =>
			card.evaluate((element) => ({
				x: parseFloat((element as HTMLElement).style.getPropertyValue('--glow-x')),
				y: parseFloat((element as HTMLElement).style.getPropertyValue('--glow-y'))
			}))
		)
		.toEqual({ x: 100, y: 50 });
});

test('tutorial sweep restarts on navigation and stays disabled with reduced motion', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/?tour=1');
	const card = page.locator('.tour-card');
	await expect(card).toHaveClass(/sweep-active/);
	await page.getByRole('button', { name: 'Next', exact: true }).click();
	await expect(card).toHaveAttribute('data-tour-step', 'board');
	await expect(card).toHaveClass(/sweep-active/);
	await page.getByRole('button', { name: 'Previous step' }).click();
	await expect(card).toHaveAttribute('data-tour-step', 'welcome');
	await expect(card).toHaveClass(/sweep-active/);
	await page.getByRole('button', { name: 'Skip', exact: true }).click();
	await expect(card).toHaveCount(0);

	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/?tour=1');
	await expect(card).toBeVisible();
	await expect(card).not.toHaveClass(/sweep-active/);
	await card.hover({ position: { x: 2, y: 20 } });
	await expect
		.poll(() =>
			card.evaluate((element) =>
				parseFloat((element as HTMLElement).style.getPropertyValue('--edge-proximity'))
			)
		)
		.toBeGreaterThan(90);
	expect(errors).toEqual([]);
});
