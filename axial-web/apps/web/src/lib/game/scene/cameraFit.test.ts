import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import type { BoardDimensions } from '@axial/core';
import { resolveCameraFit } from './cameraFit';

const defaultBoard: BoardDimensions = { height: 6, rows: 6, columns: 7 };

describe('viewport-only camera framing', () => {
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
});
