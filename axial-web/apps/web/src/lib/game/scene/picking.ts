import type { BoardDimensions, Move } from '@axial/core';
import { CELL_SPACING } from './geometry';

export type BoardLocalPoint = {
	x: number;
	z: number;
};

const DEFAULT_EDGE_TOLERANCE = CELL_SPACING * 0.045;

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
