import type { BoardDimensions } from '@axial/core';
import type { Vec3 } from './geometry';

export type SceneViewport = {
	width: number;
	height: number;
	coarsePointer: boolean;
};

export type CameraFit = {
	compact: boolean;
	portrait: boolean;
	position: Vec3;
	target: Vec3;
	fov: number;
	boardScale: number;
	minDistance: number;
	maxDistance: number;
};

const DESKTOP_CAMERA: Vec3 = [5.8, 5.7, 9.4];
const PORTRAIT_CAMERA: Vec3 = [7.7, 7.3, 14.8];
const LANDSCAPE_CAMERA: Vec3 = [6.35, 6.15, 10.7];
const ORIGIN_TARGET: Vec3 = [0, 0, 0];
const PORTRAIT_TARGET: Vec3 = [0, -0.12, 0];

/**
 * The settings panel overlays the playfield; opening it must not reframe the board.
 */
export function resolveCameraFit(viewport: SceneViewport, dimensions: BoardDimensions): CameraFit {
	const width = Math.max(320, viewport.width);
	const height = Math.max(320, viewport.height);
	const compact = width < 720 || viewport.coarsePointer;
	const portrait = compact && height >= width;
	const largestDimension = Math.max(dimensions.height, dimensions.rows, dimensions.columns);
	const dimensionScale = Math.min(1, 7 / largestDimension);

	if (portrait) {
		const narrowScale = width <= 340 ? 0.67 : width <= 390 ? 0.72 : 0.76;

		return {
			compact,
			portrait,
			position: PORTRAIT_CAMERA,
			target: PORTRAIT_TARGET,
			fov: 47,
			boardScale: narrowScale * dimensionScale,
			minDistance: 7.2,
			maxDistance: 20
		};
	}

	if (compact) {
		return {
			compact,
			portrait,
			position: LANDSCAPE_CAMERA,
			target: ORIGIN_TARGET,
			fov: 43,
			boardScale: 0.9 * dimensionScale,
			minDistance: 6.6,
			maxDistance: 18
		};
	}

	return {
		compact,
		portrait,
		position: DESKTOP_CAMERA,
		target: ORIGIN_TARGET,
		fov: 42,
		boardScale: 0.84 * dimensionScale,
		minDistance: 7.2,
		maxDistance: 15.5
	};
}
