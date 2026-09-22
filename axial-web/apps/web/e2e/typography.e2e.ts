import { expect, test, type Page } from '@playwright/test';

async function expectUiFont(page: Page, selector: string) {
	const styles = await page.locator(selector).evaluateAll((elements) =>
		elements.map((element) => {
			const style = getComputedStyle(element);
			return { family: style.fontFamily, weight: style.fontWeight };
		})
	);
	expect(styles.length).toBeGreaterThan(0);
	for (const style of styles) {
		expect(style.family).toContain('Axial UI');
		expect(['400', '500', '600', '700']).toContain(style.weight);
	}
}

for (const width of [1280, 390]) {
	test(`UI uses the bundled font across tutorial and controls at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 844 });
		const externalFonts: string[] = [];
		page.on('request', (request) => {
			if (
				request.resourceType() === 'font' &&
				new URL(request.url()).origin !== new URL(page.url()).origin
			) {
				externalFonts.push(request.url());
			}
		});
		await page.goto('/?tour=1');
		await expect(page.getByRole('dialog', { name: 'This is Axial' })).toBeVisible();
		await expect
			.poll(() =>
				page.evaluate(() =>
					Array.from(document.fonts).some(
						(font) => font.family.replaceAll('"', '') === 'Axial UI' && font.status === 'loaded'
					)
				)
			)
			.toBe(true);
		await expectUiFont(page, '.tour-copy h2, .tour-copy p, .tour-actions button, .turn-chip');
		expect(
			await page.locator('.brand-title').evaluate((element) => getComputedStyle(element).fontFamily)
		).not.toContain('Axial UI');
		await page.screenshot({ path: `/tmp/axial-type-tour-${width}.png` });
		await page.getByRole('button', { name: 'Skip', exact: true }).click();
		await page.getByRole('button', { name: 'Expand settings' }).click();
		await page.getByRole('button', { name: 'Online', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Create room', exact: true })).toBeVisible();
		await expectUiFont(
			page,
			'.control-panel button, .control-panel input, .control-panel select, .panel-section-heading'
		);
		await page.screenshot({ path: `/tmp/axial-type-controls-${width}.png` });
		expect(externalFonts).toEqual([]);
	});
}

test('slow font loading never shows untextured board labels', async ({ page }) => {
	let releaseFont!: () => void;
	const fontGate = new Promise<void>((resolve) => {
		releaseFont = resolve;
	});
	await page.route('**/fonts/InterVariable.woff2', async (route) => {
		await fontGate;
		await route.continue();
	});
	await page.addInitScript(() => {
		window.__THREE_DEVTOOLS__ = new EventTarget();
		window.__labelFontFrame = { sprites: 0, untexturedVisible: 0, texturedVisible: 0 };
		window.__THREE_DEVTOOLS__.addEventListener('observe', (event) => {
			const renderer = (event as CustomEvent<import('three').WebGLRenderer>).detail;
			if (!renderer.isWebGLRenderer) return;
			const render = renderer.render.bind(renderer);
			renderer.render = (scene, camera) => {
				render(scene, camera);
				if (!(scene as import('three').Scene).isScene) return;
				const sample = { sprites: 0, untexturedVisible: 0, texturedVisible: 0 };
				scene.traverse((object) => {
					const sprite = object as import('three').Sprite;
					if (!sprite.isSprite) return;
					sample.sprites++;
					if (!sprite.visible) return;
					if (sprite.material.map) sample.texturedVisible++;
					else sample.untexturedVisible++;
				});
				window.__labelFontFrame = sample;
			};
		});
	});
	try {
		await page.goto('/?tour=0', { waitUntil: 'domcontentloaded' });
		await expect
			.poll(() => page.evaluate(() => window.__labelFontFrame.sprites))
			.toBeGreaterThan(0);
		expect(await page.evaluate(() => window.__labelFontFrame.untexturedVisible)).toBe(0);
	} finally {
		releaseFont();
	}
	await expect
		.poll(() => page.evaluate(() => window.__labelFontFrame.texturedVisible))
		.toBeGreaterThan(0);
	expect(await page.evaluate(() => window.__labelFontFrame.untexturedVisible)).toBe(0);
});

declare global {
	interface Window {
		__labelFontFrame: { sprites: number; untexturedVisible: number; texturedVisible: number };
	}
}
