import { expect, test, type Page } from '@playwright/test';

/** Stands in for Cloudflare's script so the test never depends on (or spends) a real challenge. */
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };

async function stubTurnstile(page: Page): Promise<void> {
	await page.route('https://challenges.cloudflare.com/turnstile/**', (route) =>
		route.fulfill({
			contentType: 'text/javascript',
			body: `window.turnstile = {
				render(container, options) {
					setTimeout(() => options.callback('test-token:' + options.action), 10);
					return 'widget-1';
				},
				remove() {}
			};`
		})
	);
}

test('players can send feedback from the settings panel', async ({ page }) => {
	await stubTurnstile(page);
	const sent: unknown[] = [];
	await page.route('**/api/feedback', async (route) => {
		if (route.request().method() === 'OPTIONS')
			return route.fulfill({ status: 204, headers: CORS });
		sent.push(route.request().postDataJSON());
		await route.fulfill({ status: 202, headers: CORS, json: { ok: true } });
	});

	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/?tour=0');
	await page.getByRole('button', { name: 'Feedback' }).click();

	const dialog = page.getByRole('dialog', { name: 'Send feedback' });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole('textbox', { name: 'Message' })).toBeFocused();

	await dialog.getByRole('button', { name: 'Send' }).click();
	await expect(dialog.getByRole('alert')).toContainText('at least 10 characters');
	expect(sent).toHaveLength(0);

	await dialog.getByRole('button', { name: 'Idea' }).click();
	await dialog
		.getByRole('textbox', { name: 'Message' })
		.fill('A replay viewer for finished games would be great.');
	await dialog.getByRole('textbox', { name: /Name/ }).fill('Robin');
	await dialog.getByRole('textbox', { name: /Email/ }).fill('robin@example.com');
	await dialog.getByRole('button', { name: 'Send' }).click();

	await expect(page.getByRole('dialog', { name: 'Thanks for the feedback' })).toBeVisible();
	expect(sent).toEqual([
		expect.objectContaining({
			kind: 'idea',
			message: 'A replay viewer for finished games would be great.',
			name: 'Robin',
			contact: 'robin@example.com',
			turnstileToken: 'test-token:feedback',
			website: '',
			context: expect.objectContaining({ mode: 'local, classic', viewport: '1280x800' })
		})
	]);

	await page.getByRole('button', { name: 'Back to the board' }).click();
	await expect(page.getByRole('dialog')).toHaveCount(0);

	// The name and email stay for next time; the sent message does not.
	await page.getByRole('button', { name: 'Feedback' }).click();
	await expect(page.getByRole('textbox', { name: 'Message' })).toHaveValue('');
	await expect(page.getByRole('textbox', { name: /Name/ })).toHaveValue('Robin');
});

test('a failed send keeps the message and shows the server reason', async ({ page }) => {
	await stubTurnstile(page);
	await page.route('**/api/feedback', (route) =>
		route.request().method() === 'OPTIONS'
			? route.fulfill({ status: 204, headers: CORS })
			: route.fulfill({
					status: 429,
					headers: CORS,
					json: {
						error: {
							code: 'rate-limited',
							message: "That's a lot of messages at once. Wait a minute and try again."
						}
					}
				})
	);

	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/?tour=0');
	await page.getByRole('button', { name: 'Feedback' }).click();
	const message = page.getByRole('textbox', { name: 'Message' });
	await message.fill('The board went blank after I rotated it.');
	await page.getByRole('button', { name: 'Send' }).click();

	await expect(page.getByRole('alert')).toContainText('a lot of messages');
	await expect(message).toHaveValue('The board went blank after I rotated it.');
	await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled();

	// Selecting text and letting go over the backdrop must not close the dialog.
	const box = (await message.boundingBox())!;
	await page.mouse.move(box.x + 10, box.y + 10);
	await page.mouse.down();
	await page.mouse.move(5, 5, { steps: 5 });
	await page.mouse.up();
	await expect(page.getByRole('dialog')).toHaveCount(1);

	// A plain click on the backdrop does.
	await page.mouse.click(5, 5);
	await expect(page.getByRole('dialog')).toHaveCount(0);

	// The unsent message is still there when the dialog comes back.
	await page.getByRole('button', { name: 'Feedback' }).click();
	await expect(message).toHaveValue('The board went blank after I rotated it.');
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('the phone sheet drags between half and full and tucks away', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/?tour=0');
	const panel = page.locator('.control-panel');
	await page.getByRole('button', { name: 'Expand settings' }).click();
	await expect(panel).toHaveAttribute('data-sheet-state', 'half');
	await finishPanelTransition(page);

	const dragHandle = async (distance: number) => {
		const box = (await page.locator('.sheet-handle').boundingBox())!;
		const x = box.x + box.width / 2;
		const y = box.y + box.height / 2;
		await page.mouse.move(x, y);
		await page.mouse.down();
		await page.mouse.move(x, y + distance, { steps: 12 });
		// Pause so the release reads as a placement, not a flick.
		await page.waitForTimeout(200);
		await page.mouse.up();
		await finishPanelTransition(page);
	};

	await dragHandle(320);
	await expect(panel).toHaveAttribute('data-sheet-state', 'full');
	expect((await panel.boundingBox())!.height).toBeCloseTo(844, 0);

	// A short drag snaps back to where it started.
	await dragHandle(-80);
	await expect(panel).toHaveAttribute('data-sheet-state', 'full');

	await dragHandle(-420);
	await expect(panel).toHaveAttribute('data-sheet-state', 'half');

	await dragHandle(-300);
	await expect(panel).toHaveAttribute('data-sheet-state', 'collapsed');
	await expect(page.getByRole('button', { name: 'Expand settings' })).toBeInViewport();
});

async function finishPanelTransition(page: Page): Promise<void> {
	await page.locator('.control-panel').evaluate(async (element) => {
		await new Promise((resolve) => requestAnimationFrame(resolve));
		await Promise.allSettled(
			element.getAnimations({ subtree: true }).map((animation) => animation.finished)
		);
	});
}
