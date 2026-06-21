import { describe, expect, it } from 'vitest';
import type { BoardDimensions } from '@axial/core';
import { CELL_SPACING, cellPosition } from './geometry';
import { moveFromBoardLocalPoint } from './picking';

const dimensions: BoardDimensions = { height: 6, rows: 6, columns: 7 };

describe('moveFromBoardLocalPoint', () => {
	it('maps local cell centers to the matching row and column', () => {
		for (let row = 0; row < dimensions.rows; row += 1) {
			for (let col = 0; col < dimensions.columns; col += 1) {
				const [x, , z] = cellPosition(0, row, col, dimensions);

				expect(moveFromBoardLocalPoint({ x, z }, dimensions)).toEqual({ row, col });
			}
		}
	});

	it('uses the square boundary side the pointer is actually inside', () => {
		const xMin = -dimensions.columns * CELL_SPACING * 0.5;
		const zMin = -dimensions.rows * CELL_SPACING * 0.5;
		const boundaryBetweenFirstColumns = xMin + CELL_SPACING;
		const rowCenter = zMin + CELL_SPACING * 2.5;

		expect(
			moveFromBoardLocalPoint(
				{ x: boundaryBetweenFirstColumns - CELL_SPACING * 0.001, z: rowCenter },
				dimensions
			)
		).toEqual({ row: 2, col: 0 });
		expect(
			moveFromBoardLocalPoint(
				{ x: boundaryBetweenFirstColumns + CELL_SPACING * 0.001, z: rowCenter },
				dimensions
			)
		).toEqual({ row: 2, col: 1 });
	});

	it('rejects points clearly outside the board footprint', () => {
		const xMax = dimensions.columns * CELL_SPACING * 0.5;

		expect(moveFromBoardLocalPoint({ x: xMax + CELL_SPACING * 0.2, z: 0 }, dimensions)).toBeNull();
	});

	it('keeps the outer edge forgiving without snapping to an internal neighbor', () => {
		const xMax = dimensions.columns * CELL_SPACING * 0.5;
		const zMax = dimensions.rows * CELL_SPACING * 0.5;

		expect(moveFromBoardLocalPoint({ x: xMax + CELL_SPACING * 0.01, z: zMax }, dimensions)).toEqual(
			{
				row: dimensions.rows - 1,
				col: dimensions.columns - 1
			}
		);
	});
});
