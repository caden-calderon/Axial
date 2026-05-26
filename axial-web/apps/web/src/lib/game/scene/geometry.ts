import { BOARD_COLUMNS, BOARD_HEIGHT, BOARD_ROWS, type Move, type PlacedMove } from '@axial/core';

export const CELL_SPACING = 0.9;
export const PIECE_SIZE = CELL_SPACING * 0.58;
export const HIT_COLUMN_HEIGHT = BOARD_HEIGHT * CELL_SPACING;
export const DROP_START_Y = (BOARD_HEIGHT / 2 + 5.4) * CELL_SPACING;
export const BOARD_SIZE: Vec3 = [
	BOARD_COLUMNS * CELL_SPACING,
	BOARD_HEIGHT * CELL_SPACING,
	BOARD_ROWS * CELL_SPACING
];

export type Vec3 = [number, number, number];

export type FadedLineGeometryData = {
	positions: number[];
	alphas: number[];
};

export function cellPosition(height: number, row: number, col: number): Vec3 {
	return [
		(col + 0.5 - BOARD_COLUMNS / 2) * CELL_SPACING,
		(height + 0.5 - BOARD_HEIGHT / 2) * CELL_SPACING,
		(row + 0.5 - BOARD_ROWS / 2) * CELL_SPACING
	];
}

export function dropStartPosition(move: PlacedMove): Vec3 {
	const [x, , z] = cellPosition(move.height, move.row, move.col);
	return [x, DROP_START_Y, z];
}

export function columnHitPosition(move: Move): Vec3 {
	const [x, , z] = cellPosition(0, move.row, move.col);
	return [x, 0, z];
}

export function createGridLinePositions(): number[] {
	const positions: number[] = [];
	const xMin = -BOARD_SIZE[0] / 2;
	const xMax = BOARD_SIZE[0] / 2;
	const yMin = -BOARD_SIZE[1] / 2;
	const yMax = BOARD_SIZE[1] / 2;
	const zMin = -BOARD_SIZE[2] / 2;
	const zMax = BOARD_SIZE[2] / 2;

	for (let y = 0; y <= BOARD_HEIGHT; y += 1) {
		const yPos = boundary(y, BOARD_HEIGHT);

		for (let row = 0; row <= BOARD_ROWS; row += 1) {
			const zPos = boundary(row, BOARD_ROWS);
			pushLine(positions, [xMin, yPos, zPos], [xMax, yPos, zPos]);
		}

		for (let col = 0; col <= BOARD_COLUMNS; col += 1) {
			const xPos = boundary(col, BOARD_COLUMNS);
			pushLine(positions, [xPos, yPos, zMin], [xPos, yPos, zMax]);
		}
	}

	for (let col = 0; col <= BOARD_COLUMNS; col += 1) {
		const xPos = boundary(col, BOARD_COLUMNS);
		for (let row = 0; row <= BOARD_ROWS; row += 1) {
			const zPos = boundary(row, BOARD_ROWS);
			pushLine(positions, [xPos, yMin, zPos], [xPos, yMax, zPos]);
		}
	}

	return positions;
}

export function createOuterEdgeLinePositions(): number[] {
	const positions: number[] = [];
	const xMin = -BOARD_SIZE[0] / 2;
	const xMax = BOARD_SIZE[0] / 2;
	const yMin = -BOARD_SIZE[1] / 2;
	const yMax = BOARD_SIZE[1] / 2;
	const zMin = -BOARD_SIZE[2] / 2;
	const zMax = BOARD_SIZE[2] / 2;

	for (const y of [yMin, yMax]) {
		for (const z of [zMin, zMax]) {
			pushLine(positions, [xMin, y, z], [xMax, y, z]);
		}

		for (const x of [xMin, xMax]) {
			pushLine(positions, [x, y, zMin], [x, y, zMax]);
		}
	}

	for (const x of [xMin, xMax]) {
		for (const z of [zMin, zMax]) {
			pushLine(positions, [x, yMin, z], [x, yMax, z]);
		}
	}

	return positions;
}

export function createGridNodePositions(): number[] {
	const positions: number[] = [];

	for (let col = 0; col <= BOARD_COLUMNS; col += 1) {
		const x = boundary(col, BOARD_COLUMNS);

		for (let height = 0; height <= BOARD_HEIGHT; height += 1) {
			const y = boundary(height, BOARD_HEIGHT);

			for (let row = 0; row <= BOARD_ROWS; row += 1) {
				const z = boundary(row, BOARD_ROWS);
				positions.push(x, y, z);
			}
		}
	}

	return positions;
}

export function createGridGlowStreakPositions(length: number): number[] {
	const positions: number[] = [];
	const xMin = -BOARD_SIZE[0] / 2;
	const xMax = BOARD_SIZE[0] / 2;
	const yMin = -BOARD_SIZE[1] / 2;
	const yMax = BOARD_SIZE[1] / 2;
	const zMin = -BOARD_SIZE[2] / 2;
	const zMax = BOARD_SIZE[2] / 2;
	const halfLength = length / 2;

	for (let col = 0; col <= BOARD_COLUMNS; col += 1) {
		const x = boundary(col, BOARD_COLUMNS);

		for (let height = 0; height <= BOARD_HEIGHT; height += 1) {
			const y = boundary(height, BOARD_HEIGHT);

			for (let row = 0; row <= BOARD_ROWS; row += 1) {
				const z = boundary(row, BOARD_ROWS);
				pushLine(
					positions,
					[clamp(x - halfLength, xMin, xMax), y, z],
					[clamp(x + halfLength, xMin, xMax), y, z]
				);
				pushLine(
					positions,
					[x, clamp(y - halfLength, yMin, yMax), z],
					[x, clamp(y + halfLength, yMin, yMax), z]
				);
				pushLine(
					positions,
					[x, y, clamp(z - halfLength, zMin, zMax)],
					[x, y, clamp(z + halfLength, zMin, zMax)]
				);
			}
		}
	}

	return positions;
}

export function createGridGlowStreakGeometry(length: number): FadedLineGeometryData {
	const positions: number[] = [];
	const alphas: number[] = [];
	const xMin = -BOARD_SIZE[0] / 2;
	const xMax = BOARD_SIZE[0] / 2;
	const yMin = -BOARD_SIZE[1] / 2;
	const yMax = BOARD_SIZE[1] / 2;
	const zMin = -BOARD_SIZE[2] / 2;
	const zMax = BOARD_SIZE[2] / 2;

	for (let col = 0; col <= BOARD_COLUMNS; col += 1) {
		const x = boundary(col, BOARD_COLUMNS);

		for (let height = 0; height <= BOARD_HEIGHT; height += 1) {
			const y = boundary(height, BOARD_HEIGHT);

			for (let row = 0; row <= BOARD_ROWS; row += 1) {
				const z = boundary(row, BOARD_ROWS);
				const center: Vec3 = [x, y, z];

				pushFadedLine(positions, alphas, center, [clamp(x - length, xMin, xMax), y, z]);
				pushFadedLine(positions, alphas, center, [clamp(x + length, xMin, xMax), y, z]);
				pushFadedLine(positions, alphas, center, [x, clamp(y - length, yMin, yMax), z]);
				pushFadedLine(positions, alphas, center, [x, clamp(y + length, yMin, yMax), z]);
				pushFadedLine(positions, alphas, center, [x, y, clamp(z - length, zMin, zMax)]);
				pushFadedLine(positions, alphas, center, [x, y, clamp(z + length, zMin, zMax)]);
			}
		}
	}

	return { positions, alphas };
}

function boundary(index: number, count: number): number {
	return (index - count / 2) * CELL_SPACING;
}

function pushLine(positions: number[], start: Vec3, end: Vec3): void {
	positions.push(...start, ...end);
}

function pushFadedLine(positions: number[], alphas: number[], start: Vec3, end: Vec3): void {
	if (distanceSquared(start, end) < 0.0001) return;

	positions.push(...start, ...end);
	alphas.push(1, 0);
}

function distanceSquared(start: Vec3, end: Vec3): number {
	const dx = end[0] - start[0];
	const dy = end[1] - start[1];
	const dz = end[2] - start[2];

	return dx * dx + dy * dy + dz * dz;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
