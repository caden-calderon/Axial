import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import type { BoardDimensions } from '@axial/core';
import { resolveCameraFit } from './cameraFit';
import { CELL_SPACING } from './geometry';

const defaultBoard: BoardDimensions = { height: 6, rows: 6, columns: 7 };

describe('viewport-only camera framing', () => {
	it.each([
		[760, 1000],
		[720, 1280],
		[1080, 1920]
	] as const)('frames a tall %i × %i desktop window in portrait', (width, height) => {
		const fit = resolveCameraFit({ width, height, coarsePointer: false }, defaultBoard);
		expect(fit.portrait).toBe(true);
		expect(fit.compact).toBe(false);
	});

	it('keeps the desktop framing for square and wide desktop windows', () => {
		for (const [width, height] of [
			[900, 900],
			[1280, 800]
		] as const) {
			expect(resolveCameraFit({ width, height, coarsePointer: false }, defaultBoard).portrait).toBe(
				false
			);
		}
	});

	it('uses a larger, closer fit for phone landscape than portrait', () => {
		const portrait = resolveCameraFit(
			{ width: 390, height: 844, coarsePointer: true },
			defaultBoard
		);
		const landscape = resolveCameraFit(
			{ width: 844, height: 390, coarsePointer: true },
			defaultBoard
		);
		expect(portrait.portrait).toBe(true);
		expect(landscape.portrait).toBe(false);
		expect(landscape.boardScale).toBeGreaterThan(portrait.boardScale);
		expect(landscape.position[2]).toBeLessThan(portrait.position[2]);
	});

	it.each([
		[1440, 900, false],
		[844, 390, true],
		[390, 844, true]
	] as const)(
		'keeps camera references stable through same-mode resize at %i × %i',
		(width, height, coarsePointer) => {
			const initial = resolveCameraFit({ width, height, coarsePointer }, defaultBoard);
			const resized = resolveCameraFit(
				{ width: width + 30, height: height + 10, coarsePointer },
				defaultBoard
			);
			expect(resized.position).toBe(initial.position);
			expect(resized.target).toBe(initial.target);
			expect(resized.fov).toBe(initial.fov);
		}
	);

	it('scales oversized boards down', () => {
		const viewport = { width: 1366, height: 768, coarsePointer: false };
		const regular = resolveCameraFit(viewport, defaultBoard);
		const large = resolveCameraFit(viewport, { height: 9, rows: 8, columns: 10 });
		expect(large.boardScale).toBeCloseTo(regular.boardScale * 0.7);
	});

	it.each([
		[967, 743],
		[1366, 768],
		[1440, 900],
		[844, 390]
	])('centers the board in the full playfield at %i × %i', (width, height) => {
		const fit = resolveCameraFit({ width, height, coarsePointer: height < 500 }, defaultBoard);
		const camera = new PerspectiveCamera(fit.fov, width / height, 0.1, 100);
		camera.position.set(...fit.position);
		camera.lookAt(...fit.target);
		camera.updateMatrixWorld();
		const screenX = (point: Vector3) => ((point.project(camera).x + 1) * width) / 2;
		expect(screenX(new Vector3())).toBeCloseTo(width / 2, 4);
		for (const x of [-3.15, 3.15])
			for (const y of [-2.7, 2.7])
				for (const z of [-2.7, 2.7]) {
					const point = new Vector3(x, y, z)
						.applyAxisAngle(new Vector3(0, 1, 0), -0.34)
						.multiplyScalar(fit.boardScale);
					const projectedX = screenX(point);
					expect(projectedX).toBeGreaterThan(12);
					expect(projectedX).toBeLessThan(width - 12);
				}
	});

	it.each([
		[1280, 720, false],
		[1366, 768, false],
		[1440, 900, false],
		[1920, 1080, false],
		[2560, 1440, false],
		[844, 390, true],
		[932, 430, true],
		[740, 360, true],
		[667, 375, true]
	])(
		'keeps the board and its floor numbers inside a %i × %i frame',
		(width, height, coarsePointer) => {
			const fit = resolveCameraFit({ width, height, coarsePointer }, defaultBoard);
			const camera = new PerspectiveCamera(fit.fov, width / height, 0.1, 100);
			camera.position.set(...fit.position);
			camera.lookAt(...fit.target);
			camera.updateMatrixWorld();
			const screenY = (x: number, y: number, z: number) =>
				((1 -
					new Vector3(x, y, z)
						.applyAxisAngle(new Vector3(0, 1, 0), -0.34)
						.multiplyScalar(fit.boardScale)
						.project(camera).y) *
					height) /
				2;
			const xHalf = (defaultBoard.columns * CELL_SPACING) / 2;
			const yHalf = (defaultBoard.height * CELL_SPACING) / 2;
			const zHalf = (defaultBoard.rows * CELL_SPACING) / 2;
			// Floor numbers sit outside the grid and below the floor (BoardLabels offsets).
			const labelY = -yHalf - CELL_SPACING * 0.5;
			const labelOut = CELL_SPACING * 0.68;
			const margin = height * 0.02;
			for (const sideX of [-1, 1])
				for (const sideZ of [-1, 1]) {
					expect(screenY(sideX * (xHalf + labelOut), labelY, sideZ * zHalf)).toBeLessThan(
						height - margin
					);
					expect(screenY(sideX * xHalf, labelY, sideZ * (zHalf + labelOut))).toBeLessThan(
						height - margin
					);
					// The top of a full stack stays clear of the turn indicator.
					expect(screenY(sideX * xHalf, yHalf, sideZ * zHalf)).toBeGreaterThan(height * 0.1);
				}
		}
	);
});
