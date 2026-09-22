export type PieceShape = 'cube' | 'orb';

export type PieceColors = {
	playerOne: string;
	playerTwo: string;
};

export type PieceShapeOption = {
	value: PieceShape;
	label: string;
};

export const PIECE_SHAPE_OPTIONS: PieceShapeOption[] = [
	{ value: 'cube', label: 'Cube' },
	{ value: 'orb', label: 'Orb' }
];

export const DEFAULT_PIECE_COLORS: PieceColors = {
	playerOne: '#b87043',
	playerTwo: '#3d7491'
};

export function normalizePieceColor(value: string | null, fallback: string): string {
	return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;
}

export function parsePieceShape(value: string | null): PieceShape | null {
	// Preserve saved preferences from before Crystal was retired.
	if (value === 'crystal') return 'cube';

	return PIECE_SHAPE_OPTIONS.some((option) => option.value === value)
		? (value as PieceShape)
		: null;
}
