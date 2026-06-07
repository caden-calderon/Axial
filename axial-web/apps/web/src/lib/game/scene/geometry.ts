import {
	DEFAULT_BOARD_DIMENSIONS,
	type BoardDimensions,
	type Move,
	type PlacedMove
} from '@axial/core';

export const CELL_SPACING = 0.9;
export const PIECE_SIZE = CELL_SPACING * 0.58;

export type Vec3 = [number, number, number];

export type FadedLineGeometryData = {
	positions: number[];
	alphas: number[];
};

export type GridGeometryOptions = {
	includeLayers?: boolean;
};

export function boardSize(dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): Vec3 {
	return [
		dimensions.columns * CELL_SPACING,
		dimensions.height * CELL_SPACING,
		dimensions.rows * CELL_SPACING
	];
}

export function dropStartY(dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): number {
	return (dimensions.height / 2 + 5.4) * CELL_SPACING;
}

export function cellPosition(
	height: number,
	row: number,
	col: number,
	dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS
): Vec3 {
	return [
		(col + 0.5 - dimensions.columns / 2) * CELL_SPACING,
		(height + 0.5 - dimensions.height / 2) * CELL_SPACING,
		(row + 0.5 - dimensions.rows / 2) * CELL_SPACING
	];
}

export function dropStartPosition(
	move: PlacedMove,
	dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS
): Vec3 {
	const [x, , z] = cellPosition(move.height, move.row, move.col, dimensions);
	return [x, dropStartY(dimensions), z];
}

export function columnHitPosition(
	move: Move,
	dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS
): Vec3 {
	const [x, , z] = cellPosition(0, move.row, move.col, dimensions);
	return [x, 0, z];
}

export function createGridLinePositions(
	dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
	options: GridGeometryOptions = {}
): number[] {
	const positions: number[] = [];
	const size = boardSize(dimensions);
	const xMin = -size[0] / 2;
	const xMax = size[0] / 2;
	const yMin = -size[1] / 2;
	const yMax = size[1] / 2;
	const zMin = -size[2] / 2;
	const zMax = size[2] / 2;
	const includeLayers = options.includeLayers ?? true;

	if (!includeLayers) {
		pushGridPlaneLines(positions, dimensions, yMin, xMin, xMax, zMin, zMax);
		return positions;
	}

	for (let y = 0; y <= dimensions.height; y += 1) {
		const yPos = boundary(y, dimensions.height);
		pushGridPlaneLines(positions, dimensions, yPos, xMin, xMax, zMin, zMax);
	}

	for (let col = 0; col <= dimensions.columns; col += 1) {
		const xPos = boundary(col, dimensions.columns);
		for (let row = 0; row <= dimensions.rows; row += 1) {
			const zPos = boundary(row, dimensions.rows);
			pushLine(positions, [xPos, yMin, zPos], [xPos, yMax, zPos]);
		}
	}

	return positions;
}

export function createOuterEdgeLinePositions(
	dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
	options: GridGeometryOptions = {}
): number[] {
	const positions: number[] = [];
	const size = boardSize(dimensions);
	const xMin = -size[0] / 2;
	const xMax = size[0] / 2;
	const yMin = -size[1] / 2;
	const yMax = size[1] / 2;
	const zMin = -size[2] / 2;
	const zMax = size[2] / 2;
	const includeLayers = options.includeLayers ?? true;

	if (!includeLayers) {
		pushLine(positions, [xMin, yMin, zMin], [xMax, yMin, zMin]);
		pushLine(positions, [xMax, yMin, zMin], [xMax, yMin, zMax]);
		pushLine(positions, [xMax, yMin, zMax], [xMin, yMin, zMax]);
		pushLine(positions, [xMin, yMin, zMax], [xMin, yMin, zMin]);
		return positions;
	}

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

export function createGridNodePositions(
	dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
	options: GridGeometryOptions = {}
): number[] {
	const positions: number[] = [];
	const includeLayers = options.includeLayers ?? true;

	for (let col = 0; col <= dimensions.columns; col += 1) {
		const x = boundary(col, dimensions.columns);

		if (!includeLayers) {
			for (let row = 0; row <= dimensions.rows; row += 1) {
				const z = boundary(row, dimensions.rows);
				positions.push(x, boundary(0, dimensions.height), z);
			}
			continue;
		}

		for (let height = 0; height <= dimensions.height; height += 1) {
			const y = boundary(height, dimensions.height);

			for (let row = 0; row <= dimensions.rows; row += 1) {
				const z = boundary(row, dimensions.rows);
				positions.push(x, y, z);
			}
		}
	}

	return positions;
}

export function createGridGlowStreakPositions(
	length: number,
	dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
	options: GridGeometryOptions = {}
): number[] {
	const positions: number[] = [];
	const size = boardSize(dimensions);
	const xMin = -size[0] / 2;
	const xMax = size[0] / 2;
	const yMin = -size[1] / 2;
	const yMax = size[1] / 2;
	const zMin = -size[2] / 2;
	const zMax = size[2] / 2;
	const halfLength = length / 2;
	const includeLayers = options.includeLayers ?? true;

	for (let col = 0; col <= dimensions.columns; col += 1) {
		const x = boundary(col, dimensions.columns);

		for (let height = 0; height <= dimensions.height; height += 1) {
			if (!includeLayers && height > 0) continue;

			const y = boundary(height, dimensions.height);

			for (let row = 0; row <= dimensions.rows; row += 1) {
				const z = boundary(row, dimensions.rows);
				pushLine(
					positions,
					[clamp(x - halfLength, xMin, xMax), y, z],
					[clamp(x + halfLength, xMin, xMax), y, z]
				);
				if (includeLayers) {
					pushLine(
						positions,
						[x, clamp(y - halfLength, yMin, yMax), z],
						[x, clamp(y + halfLength, yMin, yMax), z]
					);
				}
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

export function createGridGlowStreakGeometry(
	length: number,
	dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
	options: GridGeometryOptions = {}
): FadedLineGeometryData {
	const positions: number[] = [];
	const alphas: number[] = [];
	const size = boardSize(dimensions);
	const xMin = -size[0] / 2;
	const xMax = size[0] / 2;
	const yMin = -size[1] / 2;
	const yMax = size[1] / 2;
	const zMin = -size[2] / 2;
	const zMax = size[2] / 2;
	const includeLayers = options.includeLayers ?? true;

	for (let col = 0; col <= dimensions.columns; col += 1) {
		const x = boundary(col, dimensions.columns);

		for (let height = 0; height <= dimensions.height; height += 1) {
			if (!includeLayers && height > 0) continue;

			const y = boundary(height, dimensions.height);

			for (let row = 0; row <= dimensions.rows; row += 1) {
				const z = boundary(row, dimensions.rows);
				const center: Vec3 = [x, y, z];

				pushFadedLine(positions, alphas, center, [clamp(x - length, xMin, xMax), y, z]);
				pushFadedLine(positions, alphas, center, [clamp(x + length, xMin, xMax), y, z]);
				if (includeLayers) {
					pushFadedLine(positions, alphas, center, [x, clamp(y - length, yMin, yMax), z]);
					pushFadedLine(positions, alphas, center, [x, clamp(y + length, yMin, yMax), z]);
				}
				pushFadedLine(positions, alphas, center, [x, y, clamp(z - length, zMin, zMax)]);
				pushFadedLine(positions, alphas, center, [x, y, clamp(z + length, zMin, zMax)]);
			}
		}
	}

	return { positions, alphas };
}

function pushGridPlaneLines(
	positions: number[],
	dimensions: BoardDimensions,
	y: number,
	xMin: number,
	xMax: number,
	zMin: number,
	zMax: number
): void {
	for (let row = 0; row <= dimensions.rows; row += 1) {
		const zPos = boundary(row, dimensions.rows);
		pushLine(positions, [xMin, y, zPos], [xMax, y, zPos]);
	}

	for (let col = 0; col <= dimensions.columns; col += 1) {
		const xPos = boundary(col, dimensions.columns);
		pushLine(positions, [xPos, y, zMin], [xPos, y, zMax]);
	}
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
