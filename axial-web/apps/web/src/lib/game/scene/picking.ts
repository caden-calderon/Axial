import type { BoardDimensions, Move } from '@axial/core';
import { CELL_SPACING, type Vec3 } from './geometry';

export type BoardLocalPoint = {
	x: number;
	z: number;
};

export type BoardLocalRay = {
	origin: Vec3;
	direction: Vec3;
};

const DEFAULT_EDGE_TOLERANCE = CELL_SPACING * 0.045;

/**
 * The column whose occupied cells the ray meets first, in board-local space (x columns, y height,
 * z rows). Pointing at a stack should choose that stack: projecting the pointer onto the floor
 * picks whatever floor tile lies behind it, often a different column. Empty columns have no
 * volume here, so aiming at an open floor tile still falls through to the floor-plane pick.
 */
export function moveFromBoardLocalRay(
	ray: BoardLocalRay,
	dimensions: BoardDimensions,
	stackHeight: (move: Move) => number
): Move | null {
	const floorY = -dimensions.height * CELL_SPACING * 0.5;
	const xMin = -dimensions.columns * CELL_SPACING * 0.5;
	const zMin = -dimensions.rows * CELL_SPACING * 0.5;
	let nearest: { move: Move; distance: number } | null = null;

	for (let row = 0; row < dimensions.rows; row += 1) {
		for (let col = 0; col < dimensions.columns; col += 1) {
			const move = { row, col };
			const filled = stackHeight(move);
			if (filled <= 0) continue;

			const distance = rayBoxDistance(
				ray,
				[xMin + col * CELL_SPACING, floorY, zMin + row * CELL_SPACING],
				[
					xMin + (col + 1) * CELL_SPACING,
					floorY + filled * CELL_SPACING,
					zMin + (row + 1) * CELL_SPACING
				]
			);
			if (distance !== null && (nearest === null || distance < nearest.distance)) {
				nearest = { move, distance };
			}
		}
	}

	return nearest?.move ?? null;
}

/**
 * Where the ray meets the board's floor plane, from above or below (the orbit allows the camera
 * under the floor), or null if the plane is behind the ray or parallel to it.
 */
export function floorPointFromBoardLocalRay(
	ray: BoardLocalRay,
	dimensions: BoardDimensions
): BoardLocalPoint | null {
	const floorY = -dimensions.height * CELL_SPACING * 0.5;
	if (Math.abs(ray.direction[1]) < 1e-12) return null;
	const distance = (floorY - ray.origin[1]) / ray.direction[1];
	if (distance < 0) return null;
	return {
		x: ray.origin[0] + ray.direction[0] * distance,
		z: ray.origin[2] + ray.direction[2] * distance
	};
}

/** Entry distance of a ray into an axis-aligned box (slab method), or null if it misses. */
function rayBoxDistance(ray: BoardLocalRay, min: Vec3, max: Vec3): number | null {
	let near = Number.NEGATIVE_INFINITY;
	let far = Number.POSITIVE_INFINITY;

	for (let axis = 0; axis < 3; axis += 1) {
		const origin = ray.origin[axis];
		const direction = ray.direction[axis];
		if (Math.abs(direction) < 1e-12) {
			if (origin < min[axis] || origin > max[axis]) return null;
			continue;
		}
		const first = (min[axis] - origin) / direction;
		const second = (max[axis] - origin) / direction;
		near = Math.max(near, Math.min(first, second));
		far = Math.min(far, Math.max(first, second));
		if (near > far) return null;
	}

	return far < 0 ? null : Math.max(near, 0);
}

export function moveFromBoardLocalPoint(
	point: BoardLocalPoint,
	dimensions: BoardDimensions,
	edgeTolerance = DEFAULT_EDGE_TOLERANCE
): Move | null {
	const xMin = -dimensions.columns * CELL_SPACING * 0.5;
	const xMax = dimensions.columns * CELL_SPACING * 0.5;
	const zMin = -dimensions.rows * CELL_SPACING * 0.5;
	const zMax = dimensions.rows * CELL_SPACING * 0.5;

	if (
		point.x < xMin - edgeTolerance ||
		point.x > xMax + edgeTolerance ||
		point.z < zMin - edgeTolerance ||
		point.z > zMax + edgeTolerance
	) {
		return null;
	}

	const col = coordinateToIndex(point.x, xMin, dimensions.columns);
	const row = coordinateToIndex(point.z, zMin, dimensions.rows);

	return { row, col };
}

function coordinateToIndex(value: number, min: number, count: number): number {
	const normalized = (value - min) / CELL_SPACING;
	return clamp(Math.floor(normalized), 0, count - 1);
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
