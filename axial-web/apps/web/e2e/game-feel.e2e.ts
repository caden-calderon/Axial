import { expect, test, type Page } from '@playwright/test';
import { replayMoves, type GameSnapshot, type Move, type WinCondition } from '@axial/core';
import type { PrivateRoomSnapshot } from '@axial/multiplayer-protocol';
import type { Material, Mesh, Object3D, PerspectiveCamera, Scene, WebGLRenderer } from 'three';

type ObjectSample = {
	name: string;
	position: number[];
	screenPosition: number[];
	scale: number[];
	visible: boolean;
	impact: boolean;
	children: { position: number[]; scale: number[]; opacity: number[]; intensity?: number }[];
};
type SceneFrame = {
	time: number;
	objects: ObjectSample[];
	resultVisible: boolean;
	cameraPosition: number[];
	cameraQuaternion: number[];
};
type SceneProbe = {
	frames: SceneFrame[];
	camera: PerspectiveCamera | null;
	resultAtAppearance: SceneFrame | null;
};

declare global {
	interface Window {
		__THREE_DEVTOOLS__: EventTarget;
		__axialSceneProbe: SceneProbe;
		__axialOscillatorStarts: number[];
		__axialRoomSocket: EventTarget;
		__axialObservedNames?: string[];
	}
}

test.beforeEach(async ({ page }) => {
	await page.setViewportSize({ width: 1366, height: 768 });
	await page.addInitScript(() => {
		// Three's existing devtools event exposes real renders only inside this test.
		// Keep production free of test globals or an alternate rendering path.
		window.__THREE_DEVTOOLS__ = new EventTarget();
		window.__axialSceneProbe = { frames: [], camera: null, resultAtAppearance: null };
		const resultSelector = '.game-over-dialog, .online-match-backdrop[data-mode="result"]';
		new MutationObserver(() => {
			const probe = window.__axialSceneProbe;
			const displayedFrame = probe.frames.at(-1);
			if (!probe.resultAtAppearance && displayedFrame && document.querySelector(resultSelector)) {
				// A settled scene can stop rendering before the DOM result mounts.
				probe.resultAtAppearance = {
					...displayedFrame,
					time: performance.now(),
					resultVisible: true
				};
			}
		}).observe(document, { childList: true, subtree: true });
		window.__THREE_DEVTOOLS__.addEventListener('observe', (event) => {
			const renderer = (event as CustomEvent<WebGLRenderer>).detail;
			if (!renderer.isWebGLRenderer) return;
			const render = renderer.render.bind(renderer);
			renderer.render = (scene, camera) => {
				render(scene, camera);
				if (!(scene as Scene).isScene || !(camera as PerspectiveCamera).isPerspectiveCamera) return;
				const probe = window.__axialSceneProbe;
				probe.camera = camera as PerspectiveCamera;
				const objects: ObjectSample[] = [];
				scene.traverse((object: Object3D) => {
					if (!/^(piece-|completed-line-|drop-preview$)/.test(object.name)) return;
					if (window.__axialObservedNames && !window.__axialObservedNames.includes(object.name))
						return;
					const children: ObjectSample['children'] = [];
					object.traverse((child) => {
						const material = (child as Mesh).material;
						const materials: Material[] = material
							? Array.isArray(material)
								? material
								: [material]
							: [];
						children.push({
							position: child.position.toArray(),
							scale: child.scale.toArray(),
							opacity: materials.map((entry) => entry.opacity),
							...('intensity' in child ? { intensity: child.intensity as number } : {})
						});
					});
					objects.push({
						name: object.name,
						position: object.position.toArray(),
						screenPosition: object
							.getWorldPosition(object.position.clone())
							.project(camera)
							.toArray(),
						scale: object.scale.toArray(),
						visible: object.visible,
						impact: object.children.some(
							(child) => (child as Mesh).geometry?.type === 'RingGeometry'
						),
						children
					});
				});
				probe.frames.push({
					time: performance.now(),
					objects,
					resultVisible: document.querySelector(resultSelector) !== null,
					cameraPosition: camera.position.toArray(),
					cameraQuaternion: camera.quaternion.toArray()
				});
				if (probe.frames.length > 600) probe.frames.shift();
			};
		});
	});
});

test('restored stacks are already settled in their first rendered frame', async ({ page }) => {
	await seedMatch(page, [
		{ row: 3, col: 3 },
		{ row: 3, col: 3 },
		{ row: 2, col: 2 },
		{ row: 4, col: 2 },
		{ row: 2, col: 2 },
		{ row: 4, col: 4 }
	]);
	await openBoard(page);
	await expect.poll(async () => (await latestFrame(page))?.objects.filter(isPiece).length).toBe(6);
	const frames = await page.evaluate(() => window.__axialSceneProbe.frames);
	const firstPieces = frames
		.find((frame) => frame.objects.some((object) => object.name.startsWith('piece-')))!
		.objects.filter(isPiece);
	expect(firstPieces).toHaveLength(6);
	for (const piece of firstPieces) {
		const height = Number(piece.name.split('-').at(-1));
		expect(piece.position[1]).toBeCloseTo(landingY(height), 6);
		expect(piece.scale).toEqual([1, 1, 1]);
		expect(piece.impact).toBe(false);
	}
	await page.waitForTimeout(400);
	const lastPieces = (await latestFrame(page))!.objects.filter(isPiece);
	expect(lastPieces.map(({ name, position, scale }) => ({ name, position, scale }))).toEqual(
		firstPieces.map(({ name, position, scale }) => ({ name, position, scale }))
	);
});

test('a winning drop lands before its line is drawn and the result is revealed', async ({
	page
}) => {
	await seedMatch(page, [
		{ row: 3, col: 0 },
		{ row: 5, col: 0 },
		{ row: 3, col: 1 },
		{ row: 5, col: 1 },
		{ row: 3, col: 2 },
		{ row: 5, col: 2 }
	]);
	await openBoard(page);
	await clearFrames(page);
	await page.locator('.scene-shell').press('Enter');
	await expect(page.locator('.game-over-dialog')).toBeVisible({ timeout: 8_000 });
	const frames = await page.evaluate(() => window.__axialSceneProbe.frames);
	const freshFrames = frames.filter((frame) =>
		frame.objects.some((object) => object.name === 'piece-3-3-0')
	);
	expect(freshFrames.length).toBeGreaterThan(3);
	expect(objectNamed(freshFrames[0], 'piece-3-3-0')!.position[1]).toBeGreaterThan(landingY(0) + 1);
	expect(
		freshFrames.some((frame) =>
			frame.objects.some((object) => object.name.startsWith('completed-line-') && !object.visible)
		)
	).toBe(true);
	const firstLineFrame = freshFrames.find((frame) =>
		frame.objects.some((object) => object.name.startsWith('completed-line-') && object.visible)
	);
	expect(firstLineFrame).toBeDefined();
	expect(objectNamed(firstLineFrame!, 'piece-3-3-0')!.position[1]).toBeCloseTo(landingY(0), 4);
	expect(objectNamed(firstLineFrame!, 'piece-3-3-0')!.scale).toEqual([1, 1, 1]);
	expect(firstLineFrame!.resultVisible).toBe(false);
	const resultFrame = freshFrames.find((frame) => frame.resultVisible);
	expect(resultFrame).toBeDefined();
	const line = resultFrame!.objects.find((object) => object.name.startsWith('completed-line-'))!;
	expect(line.children[1].scale[1]).toBeCloseTo(1, 4);
});

test('rapid drops into one column land in support order', async ({ page }) => {
	await openBoard(page);
	await clearFrames(page);
	await page.locator('.scene-shell').focus();
	await page.evaluate(async () => {
		const board = document.querySelector('.scene-shell')!;
		board.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		board.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
	});
	await expect
		.poll(async () => objectNamed((await latestFrame(page))!, 'piece-3-3-1')?.position[1])
		.toBeCloseTo(landingY(1), 4);
	await page.waitForTimeout(200);
	const frames = await page.evaluate(() => window.__axialSceneProbe.frames);
	const lowerLanding = frames.find((frame) => {
		const piece = objectNamed(frame, 'piece-3-3-0');
		return piece && piece.position[1] <= landingY(0) + 0.07;
	});
	const upperLanding = frames.find((frame) => {
		const piece = objectNamed(frame, 'piece-3-3-1');
		return piece && piece.position[1] <= landingY(1) + 0.07;
	});
	await test.info().attach('stacked-landing-frames', {
		body: JSON.stringify(
			frames.map((frame) => ({
				time: frame.time,
				pieces: frame.objects
					.filter(isPiece)
					.map(({ name, position, impact }) => ({ name, y: position[1], impact }))
			}))
		),
		contentType: 'application/json'
	});
	expect(lowerLanding).toBeDefined();
	expect(upperLanding).toBeDefined();
	// A slow frame may present both landings together; it must never invert them.
	expect(upperLanding!.time).toBeGreaterThanOrEqual(lowerLanding!.time);
	for (const frame of frames) {
		const upper = objectNamed(frame, 'piece-3-3-1');
		if (upper && upper.position[1] <= landingY(1) + 0.07) {
			expect(objectNamed(frame, 'piece-3-3-0')!.position[1]).toBeLessThanOrEqual(
				landingY(0) + 0.07
			);
		}
	}
});

test('a rapid final-column draw waits for the terminal piece to finish its impact', async ({
	page
}) => {
	test.setTimeout(45_000);
	await page.setViewportSize({ width: 800, height: 600 });
	await page.addInitScript(() => {
		localStorage.setItem('axial-piece-shape', 'orb');
		window.__axialObservedNames = Array.from({ length: 6 }, (_, height) => `piece-3-3-${height}`);
	});
	const winCondition = { lineLength: 5, linesToWin: 3 };
	// A legal full draw, encoded as row * 7 + column. The last six drops fill
	// the only empty column, so earlier retained animations finish during the draw.
	const moves = `
		26 2 25 9 33 3 9 35 20 29 40 5 38 16 25 28 7 26 31 27 31 15 7 15 26 15 31 23 5 6 10 14 29 21 15 41
		2 34 19 33 36 10 39 17 4 23 28 41 27 38 19 21 8 19 26 13 22 2 41 37 8 14 2 41 20 37 25 14 34 40 25 28
		35 29 33 15 10 20 28 1 4 41 36 7 15 25 33 33 4 23 1 20 10 12 28 40 27 9 7 10 28 34 12 23 30 32 1 19
		30 38 18 19 27 32 4 2 16 17 34 33 13 21 40 14 17 17 22 4 7 31 5 1 32 0 26 37 29 22 31 29 36 12 27 40
		31 5 19 27 0 3 1 30 2 10 14 9 39 38 39 14 21 30 21 3 0 21 39 20 37 3 22 39 11 5 32 0 12 8 13 36 35 37
		8 18 7 32 11 22 9 29 40 20 22 8 12 37 41 17 25 32 8 13 17 12 35 9 38 4 18 0 36 13 26 13 1 11 3 3 16 5
		38 30 23 11 11 39 23 18 18 35 35 30 18 0 36 34 34 6 6 6 6 6 11 16 16 16 24 24 24 24 24 24
	`
		.trim()
		.split(/\s+/)
		.map((column) => ({ row: Math.floor(Number(column) / 7), col: Number(column) % 7 }));
	expect(replayMoves(moves, winCondition).status.state).toBe('draw');
	await seedMatch(page, moves.slice(0, -6), winCondition);
	await openBoard(page, '/?tour=0', 15_000);
	await clearFrames(page);
	await page.locator('.scene-shell').focus();
	await page.evaluate(async () => {
		const board = document.querySelector('.scene-shell')!;
		for (let index = 0; index < 6; index += 1) {
			board.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
			await new Promise<void>((resolve) => setTimeout(resolve, 0));
		}
	});
	await expect(page.locator('.game-over-dialog')).toBeVisible({ timeout: 4_000 });
	const { frames, resultAtAppearance } = await page.evaluate(() => ({
		frames: window.__axialSceneProbe.frames,
		resultAtAppearance: window.__axialSceneProbe.resultAtAppearance
	}));
	expect(resultAtAppearance).not.toBeNull();
	const firstTerminalFrame = frames.find((frame) => objectNamed(frame, 'piece-3-3-5'))!;
	expect(objectNamed(firstTerminalFrame, 'piece-3-3-5')!.position[1]).toBeGreaterThan(landingY(5));
	for (const frame of [resultAtAppearance!, ...frames.filter((frame) => frame.resultVisible)]) {
		const terminalPiece = objectNamed(frame, 'piece-3-3-5')!;
		expect(terminalPiece.position[1]).toBeCloseTo(landingY(5), 6);
		expect(terminalPiece.scale).toEqual([1, 1, 1]);
		expect(terminalPiece.impact).toBe(false);
	}
});

test('an identical online snapshot preserves the winning animation completion', async ({
	page
}) => {
	const moves = [
		{ row: 3, col: 0 },
		{ row: 5, col: 0 },
		{ row: 3, col: 1 },
		{ row: 5, col: 1 },
		{ row: 3, col: 2 },
		{ row: 5, col: 2 }
	];
	const initial = onlineSnapshot(replayMoves(moves));
	const ended = onlineSnapshot(replayMoves([...moves, { row: 3, col: 3 }]));
	await page.addInitScript((snapshot) => {
		localStorage.setItem(
			`axial-room-credentials:${snapshot.roomCode}`,
			JSON.stringify(snapshot.you)
		);
		sessionStorage.setItem(`axial-room-snapshot:${snapshot.roomCode}`, JSON.stringify(snapshot));
		window.WebSocket = class extends EventTarget {
			static OPEN = 1;
			readyState = 1;
			sent: string[] = [];
			constructor() {
				super();
				window.__axialRoomSocket = this;
				queueMicrotask(() => this.dispatchEvent(new Event('open')));
			}
			send(message: string) {
				this.sent.push(message);
			}
			close() {
				this.readyState = 3;
			}
		} as unknown as typeof WebSocket;
	}, initial);
	await openBoard(page, '/?tour=0&room=ABCD2345');
	await clearFrames(page);
	await emitOnlineSnapshot(page, ended);
	await page.waitForFunction(() =>
		window.__axialSceneProbe.frames.some((frame) =>
			frame.objects.some((object) => object.name.startsWith('completed-line-') && !object.visible)
		)
	);
	await emitOnlineSnapshot(page, structuredClone(ended));
	// The five-second rendering recovery timer must not rescue a lost callback.
	await expect(page.locator('.online-match-backdrop[data-mode="result"]')).toBeVisible({
		timeout: 3_500
	});
	const result = await page.evaluate(() => window.__axialSceneProbe.resultAtAppearance);
	expect(result).not.toBeNull();
	const line = result!.objects.find((object) => object.name.startsWith('completed-line-'))!;
	expect(line.visible).toBe(true);
	expect(line.children[1].scale[1]).toBeCloseTo(1, 6);
	expect(objectNamed(result!, 'piece-3-3-0')!.position[1]).toBeCloseTo(landingY(0), 6);
});

test('reduced motion presents new pieces and previews without falling or pulsing', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await openBoard(page);
	await clearFrames(page);
	await page.locator('.scene-shell').press('Enter');
	await expect
		.poll(async () => objectNamed((await latestFrame(page))!, 'piece-3-3-0')?.position[1])
		.toBeCloseTo(landingY(0), 6);
	await page.keyboard.press('ArrowRight');
	await expect
		.poll(async () => Boolean(objectNamed((await latestFrame(page))!, 'drop-preview')))
		.toBe(true);
	const first = (await latestFrame(page))!;
	await page.waitForTimeout(450);
	const last = (await latestFrame(page))!;
	expect(objectNamed(last, 'piece-3-3-0')).toEqual(objectNamed(first, 'piece-3-3-0'));
	expect(objectNamed(last, 'drop-preview')).toEqual(objectNamed(first, 'drop-preview'));
	const frames = await page.evaluate(() => window.__axialSceneProbe.frames);
	for (const frame of frames) {
		const piece = objectNamed(frame, 'piece-3-3-0');
		if (!piece) continue;
		expect(piece.position[1]).toBeCloseTo(landingY(0), 6);
		expect(piece.scale).toEqual([1, 1, 1]);
		expect(piece.impact).toBe(false);
	}
});

test('holding Enter cannot confirm a staged move and arrows release the old lock', async ({
	page
}) => {
	await page.addInitScript(() => localStorage.setItem('axial-confirm-drop', 'true'));
	await openBoard(page);
	await page.locator('.scene-shell').focus();
	await page.keyboard.down('Enter');
	await page.keyboard.down('Enter');
	await page.keyboard.down('Enter');
	await page.keyboard.up('Enter');
	await expect(page.getByRole('group', { name: 'Confirm selected move' })).toBeVisible();
	await expect(page.getByText('0 moves', { exact: true }).first()).toBeVisible();
	await page.keyboard.press('ArrowRight');
	await expect(page.getByRole('group', { name: 'Confirm selected move' })).toBeHidden();
	await expect(page.locator('.keyboard-readout')).toContainText('Row 4 · Col 5');
	await expect(page.locator('.keyboard-readout')).toContainText('Enter to drop');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('group', { name: 'Confirm selected move' })).toBeVisible();
	await expect(page.getByText('0 moves', { exact: true }).first()).toBeVisible();
	await page.keyboard.press('Enter');
	await expect(page.getByText('1 move', { exact: true }).first()).toBeVisible();
	await expect
		.poll(async () => Boolean(objectNamed((await latestFrame(page))!, 'piece-3-4-0')))
		.toBe(true);
	await expect(page.locator('[role="status"]').filter({ hasText: 'placed at row' })).toContainText(
		'column 5, layer 1'
	);
});

test('rail toggles and resizing preserve a player-created camera orbit and zoom', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await openBoard(page);
	const initial = await cameraPose(page);
	await page.mouse.move(470, 340);
	await page.mouse.down();
	await page.mouse.move(610, 410, { steps: 10 });
	await page.mouse.up();
	await page.mouse.wheel(0, -360);
	await expect
		.poll(async () => distance((await cameraPose(page)).position, initial.position))
		.toBeGreaterThan(0.5);
	const adjusted = await cameraPose(page);
	expect(distance(adjusted.quaternion, initial.quaternion)).toBeGreaterThan(0.05);
	expect(
		Math.abs(Math.hypot(...adjusted.position) - Math.hypot(...initial.position))
	).toBeGreaterThan(0.2);
	await clearFrames(page);
	await page.getByRole('button', { name: 'Collapse settings' }).click();
	await expect(page.locator('.control-panel')).toHaveClass(/collapsed/);
	await assertCameraPose(page, adjusted);
	await page.setViewportSize({ width: 1430, height: 850 });
	await assertCameraPose(page, adjusted);
	await page.getByRole('button', { name: 'Expand settings' }).click();
	await assertCameraPose(page, adjusted);
});

for (const viewport of [
	{ width: 1366, height: 768 },
	{ width: 390, height: 844 }
]) {
	test(`settings overlay keeps the rendered board stationary at ${viewport.width}px`, async ({
		page
	}) => {
		await page.setViewportSize(viewport);
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await seedMatch(page, [
			{ row: 2, col: 2 },
			{ row: 4, col: 4 }
		]);
		await openBoard(page);
		await expect
			.poll(async () => (await latestFrame(page))?.objects.filter(isPiece).length)
			.toBe(2);
		const initial = (await latestFrame(page))!.objects.filter(isPiece);
		const labels =
			viewport.width < 500
				? ['Expand settings', 'Collapse settings', 'Expand settings']
				: ['Collapse settings', 'Expand settings', 'Collapse settings'];
		for (const label of labels) {
			await clearFrames(page);
			await page.getByRole('button', { name: label }).click();
			await page.waitForTimeout(400);
			// Force an unchanged scene frame too; an idle renderer may correctly submit no frames.
			await page.locator('.scene-shell').press('ArrowRight');
			await expect
				.poll(() => page.evaluate(() => window.__axialSceneProbe.frames.length))
				.toBeGreaterThan(0);
			const frames = await page.evaluate(() => window.__axialSceneProbe.frames);
			expect(frames.length).toBeGreaterThan(0);
			for (const frame of frames)
				for (const piece of initial) {
					expect(
						distance(objectNamed(frame, piece.name)!.screenPosition, piece.screenPosition)
					).toBeLessThan(0.00001);
				}
		}
	});
}

test('an idle empty board stops submitting GPU renders until the camera changes', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await openBoard(page);
	await page.waitForTimeout(500);
	await clearFrames(page);
	await page.waitForTimeout(350);
	expect(await page.evaluate(() => window.__axialSceneProbe.frames.length)).toBeLessThanOrEqual(2);
	await page.mouse.move(470, 340);
	await page.mouse.wheel(0, -250);
	await expect
		.poll(() => page.evaluate(() => window.__axialSceneProbe.frames.length))
		.toBeGreaterThan(0);
});

test('sound is opt-in, follows fresh landings, stays silent on restore, and mutes immediately', async ({
	page
}) => {
	await recordOscillators(page);
	await openBoard(page);
	const sound = page.getByRole('checkbox', { name: 'Game sound' });
	await expect(sound).not.toBeChecked();
	await page.locator('.scene-shell').press('Enter');
	await expect
		.poll(async () => objectNamed((await latestFrame(page))!, 'piece-3-3-0')?.position[1])
		.toBeCloseTo(landingY(0), 6);
	expect(await page.evaluate(() => window.__axialOscillatorStarts.length)).toBe(0);
	await sound.check();
	await page.locator('.scene-shell').focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Enter');
	await expect
		.poll(() => page.evaluate(() => window.__axialOscillatorStarts.length))
		.toBeGreaterThan(0);
	await page.reload();
	await expect(sound).toBeChecked();
	await expect.poll(async () => (await latestFrame(page))?.objects.filter(isPiece).length).toBe(2);
	await page.locator('.scene-shell').press('ArrowRight');
	await page.waitForTimeout(350);
	expect(await page.evaluate(() => window.__axialOscillatorStarts.length)).toBe(0);
	await page.keyboard.press('Enter');
	await expect
		.poll(() => page.evaluate(() => window.__axialOscillatorStarts.length))
		.toBeGreaterThan(0);
	await sound.uncheck();
	const mutedCount = await page.evaluate(() => window.__axialOscillatorStarts.length);
	await page.locator('.scene-shell').press('ArrowLeft');
	await page.keyboard.press('Enter');
	await expect.poll(async () => (await latestFrame(page))?.objects.filter(isPiece).length).toBe(4);
	await page.waitForTimeout(800);
	expect(await page.evaluate(() => window.__axialOscillatorStarts.length)).toBe(mutedCount);
});

test('undo during a fresh stack settles retained history without a later landing sound', async ({
	page
}) => {
	await recordOscillators(page);
	await page.addInitScript(() => localStorage.setItem('axial-sound-enabled', 'true'));
	await openBoard(page);
	await page.locator('.scene-shell').press('ArrowRight');
	await page.keyboard.press('ArrowLeft');
	const beforeUndo = await page.evaluate(async () => {
		const board = document.querySelector('.scene-shell')!;
		for (let index = 0; index < 2; index += 1) {
			board.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		}
		const before = window.__axialSceneProbe.frames.at(-1)!;
		const oscillatorCount = window.__axialOscillatorStarts.length;
		window.__axialSceneProbe.frames = [];
		document.querySelector<HTMLButtonElement>('button[aria-label="Undo move"]')!.click();
		return { frame: before, oscillatorCount };
	});
	expect(objectNamed(beforeUndo.frame, 'piece-3-3-0')!.position[1]).toBeGreaterThan(landingY(0));
	await expect(page.getByText('1 move', { exact: true }).first()).toBeVisible();
	await page.waitForTimeout(800);
	const restoredFrames = await page.evaluate(() =>
		window.__axialSceneProbe.frames.filter(
			(frame) =>
				frame.objects.some((object) => object.name === 'piece-3-3-0') &&
				!frame.objects.some((object) => object.name === 'piece-3-3-1')
		)
	);
	expect(restoredFrames.length).toBeGreaterThan(0);
	for (const frame of restoredFrames) {
		const retained = objectNamed(frame, 'piece-3-3-0')!;
		expect(retained.position[1]).toBeCloseTo(landingY(0), 6);
		expect(retained.scale).toEqual([1, 1, 1]);
		expect(retained.impact).toBe(false);
	}
	expect(await page.evaluate(() => window.__axialOscillatorStarts.length)).toBe(
		beforeUndo.oscillatorCount
	);
});

async function recordOscillators(page: Page) {
	await page.addInitScript(() => {
		window.__axialOscillatorStarts = [];
		const createOscillator = AudioContext.prototype.createOscillator;
		AudioContext.prototype.createOscillator = function () {
			const oscillator = createOscillator.call(this);
			const start = oscillator.start.bind(oscillator);
			oscillator.start = (when) => {
				window.__axialOscillatorStarts.push(performance.now());
				start(when);
			};
			return oscillator;
		};
	});
}

async function seedMatch(
	page: Page,
	moves: Move[],
	winCondition: WinCondition = { lineLength: 4, linesToWin: 1 }
) {
	await page.addInitScript(
		({ moveHistory, winCondition }) => {
			localStorage.setItem(
				'axial-active-match',
				JSON.stringify({
					version: 1,
					matchMode: 'classic',
					opponentMode: 'local',
					aiDifficulty: 'hard',
					boardDimensions: { height: 6, rows: 6, columns: 7 },
					winCondition,
					startingPlayer: 1,
					moveHistory,
					redoMoves: [],
					gameOverDismissed: false
				})
			);
		},
		{ moveHistory: moves, winCondition }
	);
}

async function openBoard(page: Page, path = '/?tour=0', startupTimeout = 5_000) {
	const pageErrors: string[] = [];
	page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') pageErrors.push(message.text());
	});
	await page.goto(path);
	try {
		await expect(page.locator('canvas')).toBeVisible({ timeout: startupTimeout });
	} catch (error) {
		await test.info().attach('page-errors', {
			body: pageErrors.join('\n\n') || 'No uncaught page errors reported.',
			contentType: 'text/plain'
		});
		throw error;
	}
	await page.waitForFunction(() => Boolean(window.__axialSceneProbe?.camera));
}

async function latestFrame(page: Page): Promise<SceneFrame | undefined> {
	return page.evaluate(() => window.__axialSceneProbe.frames.at(-1));
}

async function clearFrames(page: Page) {
	await page.evaluate(() => {
		window.__axialSceneProbe.frames = [];
		window.__axialSceneProbe.resultAtAppearance = null;
	});
}

function onlineSnapshot(game: GameSnapshot): PrivateRoomSnapshot {
	const roomCode = 'ABCD2345';
	return {
		roomCode,
		phase: game.status.state === 'playing' ? 'playing' : 'ended',
		revision: game.moveHistory.length,
		createdAt: 0,
		updatedAt: 0,
		expiresAt: Date.now() + 60_000,
		hostPlayerId: 'host',
		rules: { mode: 'classic', board: game.dimensions, winCondition: game.winCondition },
		players: [1, 2].map((seat) => ({
			playerId: seat === 1 ? 'host' : 'friend',
			seat: seat as 1 | 2,
			displayName: seat === 1 ? 'Host' : 'Friend',
			isHost: seat === 1,
			ready: true,
			connected: true,
			joinedAt: 0,
			lastSeenAt: 0,
			disconnectedAt: null,
			rematchReady: false
		})),
		game: { ...game, board: Array.from(game.board) },
		match: { number: 1, startingPlayer: 1, startedAt: 0, playableAt: 0 },
		rematch: { readyPlayerIds: [], deadlineAt: Date.now() + 60_000 },
		you: {
			roomCode,
			playerId: 'host',
			reconnectToken: 'host-token',
			seat: 1,
			isHost: true,
			displayName: 'Host'
		},
		inviteUrl: `http://127.0.0.1:4173/?room=${roomCode}`,
		qrPayload: `http://127.0.0.1:4173/?room=${roomCode}`
	};
}

async function emitOnlineSnapshot(page: Page, snapshot: PrivateRoomSnapshot) {
	await page.evaluate((snapshot) => {
		window.__axialRoomSocket.dispatchEvent(
			new MessageEvent('message', {
				data: JSON.stringify({
					source: 'axial-room',
					version: 1,
					id: crypto.randomUUID(),
					revision: snapshot.revision,
					type: 'room:snapshot',
					payload: { snapshot }
				})
			})
		);
	}, snapshot);
}

function objectNamed(frame: SceneFrame, name: string) {
	return frame?.objects.find((object) => object.name === name);
}

function isPiece(object: ObjectSample) {
	return object.name.startsWith('piece-');
}
function landingY(height: number) {
	return (height + 0.5 - 3) * 0.9;
}
function distance(first: number[], second: number[]) {
	return Math.hypot(...first.map((value, index) => value - second[index]));
}
async function cameraPose(page: Page) {
	return page.evaluate(() => {
		const camera = window.__axialSceneProbe.camera!;
		return { position: camera.position.toArray(), quaternion: camera.quaternion.toArray() };
	});
}
async function assertCameraPose(page: Page, expected: Awaited<ReturnType<typeof cameraPose>>) {
	// Observe through the rail transition and ResizeObserver delivery, including
	// intermediate renders that could reset the orbit before recovering.
	await page.waitForTimeout(350);
	const frames = await page.evaluate(() => window.__axialSceneProbe.frames);
	for (const frame of frames) {
		expect(distance(frame.cameraPosition, expected.position)).toBeLessThan(0.00001);
		expect(distance(frame.cameraQuaternion, expected.quaternion)).toBeLessThan(0.00001);
	}
	expect(distance((await cameraPose(page)).position, expected.position)).toBeLessThan(0.00001);
	expect(distance((await cameraPose(page)).quaternion, expected.quaternion)).toBeLessThan(0.00001);
}
