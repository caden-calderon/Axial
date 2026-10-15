import { describe, expect, it } from 'vitest';
import type { BoardDimensions } from '@axial/core';
import { CELL_SPACING, cellPosition, type Vec3 } from './geometry';
import { moveFromBoardLocalPoint, moveFromBoardLocalRay } from './picking';

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

describe('moveFromBoardLocalRay', () => {
	// A camera above and in front of the board, like the default framing in board space.
	const eye: Vec3 = [4, 7, 9];
	const towards = (target: Vec3) => {
		const direction: Vec3 = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
		const length = Math.hypot(...direction);
		return { origin: eye, direction: direction.map((value) => value / length) as Vec3 };
	};
	const stacks = (filled: Record<string, number>) => (move: { row: number; col: number }) =>
		filled[`${move.row}:${move.col}`] ?? 0;

	it('picks the stack under the pointer, not the floor tile behind it', () => {
		const heights = stacks({ '2:3': 4 });
		for (let height = 0; height < 4; height += 1) {
			const ray = towards(cellPosition(height, 2, 3, dimensions));
			expect(moveFromBoardLocalRay(ray, dimensions, heights)).toEqual({ row: 2, col: 3 });
		}
	});

	it('picks the nearer of two stacks along the ray', () => {
		// Aim at a cell inside a stack, then find the floor tile the same ray reaches behind it.
		const ray = towards(cellPosition(2, 3, 3, dimensions));
		const floorY = -dimensions.height * CELL_SPACING * 0.5;
		const reach = (floorY - ray.origin[1]) / ray.direction[1];
		const behind = moveFromBoardLocalPoint(
			{
				x: ray.origin[0] + ray.direction[0] * reach,
				z: ray.origin[2] + ray.direction[2] * reach
			},
			dimensions
		)!;
		expect(behind).not.toEqual({ row: 3, col: 3 });

		const key = `${behind.row}:${behind.col}`;
		expect(moveFromBoardLocalRay(ray, dimensions, stacks({ '3:3': 3, [key]: 1 }))).toEqual({
			row: 3,
			col: 3
		});
		expect(moveFromBoardLocalRay(ray, dimensions, stacks({ [key]: 1 }))).toEqual(behind);
	});

	it('ignores empty columns so open floor tiles keep floor picking', () => {
		const ray = towards(cellPosition(0, 3, 3, dimensions));
		expect(moveFromBoardLocalRay(ray, dimensions, stacks({}))).toBeNull();
		// The space above a short stack is not part of it.
		const aboveStack = towards(cellPosition(3, 3, 3, dimensions));
		expect(moveFromBoardLocalRay(aboveStack, dimensions, stacks({ '3:3': 1 }))).toBeNull();
	});
});
