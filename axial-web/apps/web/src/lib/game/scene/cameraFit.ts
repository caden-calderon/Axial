import type { BoardDimensions } from '@axial/core';
import type { Vec3 } from './geometry';

export type SceneViewport = {
	width: number;
	height: number;
	coarsePointer: boolean;
	controlsExpanded: boolean;
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

/**
 * Resolves scene framing from the usable UI layout rather than applying one
 * coarse-pointer preset to every phone orientation.
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
		const sheetScale = viewport.controlsExpanded ? 0.84 : 1;

		return {
			compact,
			portrait,
			position: PORTRAIT_CAMERA,
			target: [0, viewport.controlsExpanded ? 0.2 : -0.12, 0],
			fov: 47,
			boardScale: narrowScale * sheetScale * dimensionScale,
			minDistance: 7.2,
			maxDistance: 20
		};
	}

	if (compact) {
		const railScale = viewport.controlsExpanded ? 0.88 : 1;

		return {
			compact,
			portrait,
			position: LANDSCAPE_CAMERA,
			target: [viewport.controlsExpanded ? -0.48 : 0, 0, 0],
			fov: 43,
			boardScale: 0.9 * railScale * dimensionScale,
			minDistance: 6.6,
			maxDistance: 18
		};
	}

	const constrainedDesktop = width < 1200 || height < 820;
	const railScale = viewport.controlsExpanded ? (constrainedDesktop ? 0.88 : 0.94) : 1;

	return {
		compact,
		portrait,
		position: DESKTOP_CAMERA,
		target: [viewport.controlsExpanded ? -0.34 : 0, 0, 0],
		fov: 42,
		boardScale: 0.84 * railScale * dimensionScale,
		minDistance: 7.2,
		maxDistance: 15.5
	};
}
