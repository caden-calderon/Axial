import { expect, test } from '@playwright/test';

for (const failure of ['access-denied', 'quota-exceeded'] as const) {
	test(`AI play continues when browser storage is ${failure}`, async ({ page }) => {
		const errors: string[] = [];
		const warnings: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		page.on('console', (message) => {
			if (message.type() === 'warning') warnings.push(message.text());
		});
		await page.addInitScript((failure) => {
			if (failure === 'access-denied') {
				for (const kind of ['localStorage', 'sessionStorage']) {
					Object.defineProperty(window, kind, {
						get() {
							throw new DOMException('Storage access denied', 'SecurityError');
						}
					});
				}
			} else {
				Storage.prototype.setItem = () => {
					throw new DOMException('Storage is full', 'QuotaExceededError');
				};
			}
		}, failure);
		await page.goto('/?tour=0');
		await page
			.getByRole('group', { name: 'Opponent mode' })
			.getByRole('button', { name: 'AI', exact: true })
			.click();
		await expect(page.getByText('Your turn', { exact: true }).first()).toBeVisible();
		await page.locator('.scene-shell').press('Enter');
		await expect(page.getByText('2 moves', { exact: true }).first()).toBeVisible({
			timeout: 10_000
		});
		await expect(page.getByText('Your turn', { exact: true }).first()).toBeVisible();
		expect(errors).toEqual([]);
		expect(
			warnings.filter((warning) => warning.includes('Browser storage is unavailable'))
		).toHaveLength(1);
	});
}
