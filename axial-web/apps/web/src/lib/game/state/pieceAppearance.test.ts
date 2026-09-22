import { describe, expect, it } from 'vitest';
import { normalizePieceColor, parsePieceShape } from './pieceAppearance';

describe('piece appearance settings', () => {
	it('normalizes valid hex colors', () => {
		expect(normalizePieceColor('#A1B2C3', '#000000')).toBe('#a1b2c3');
	});

	it('falls back for invalid color values', () => {
		expect(normalizePieceColor('blue', '#123456')).toBe('#123456');
		expect(normalizePieceColor(null, '#123456')).toBe('#123456');
	});

	it('parses supported piece shapes', () => {
		expect(parsePieceShape('cube')).toBe('cube');
		expect(parsePieceShape('orb')).toBe('orb');
		expect(parsePieceShape('swap')).toBeNull();
		expect(parsePieceShape(null)).toBeNull();
	});

	it('restores retired Crystal preferences as Cube', () => {
		expect(parsePieceShape('crystal')).toBe('cube');
	});
});
