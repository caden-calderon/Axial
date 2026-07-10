import { describe, expect, it } from 'vitest';
import type { BoardDimensions } from '@axial/core';
import { resolveCameraFit } from './cameraFit';

const defaultBoard: BoardDimensions = { height: 6, rows: 6, columns: 7 };

describe('resolveCameraFit', () => {
	it('keeps phone portrait compact and leaves extra room for an expanded sheet', () => {
		const collapsed = resolveCameraFit(
			{ width: 390, height: 844, coarsePointer: true, controlsExpanded: false },
			defaultBoard
		);
		const expanded = resolveCameraFit(
			{ width: 390, height: 844, coarsePointer: true, controlsExpanded: true },
			defaultBoard
		);

		expect(collapsed.portrait).toBe(true);
		expect(expanded.boardScale).toBeLessThan(collapsed.boardScale);
		expect(collapsed.maxDistance).toBeGreaterThan(15.5);
	});

	it('uses a larger, closer fit for phone landscape than portrait', () => {
		const portrait = resolveCameraFit(
			{ width: 390, height: 844, coarsePointer: true, controlsExpanded: false },
			defaultBoard
		);
		const landscape = resolveCameraFit(
			{ width: 844, height: 390, coarsePointer: true, controlsExpanded: false },
			defaultBoard
		);

		expect(landscape.portrait).toBe(false);
		expect(landscape.boardScale).toBeGreaterThan(portrait.boardScale);
		expect(landscape.position[2]).toBeLessThan(portrait.position[2]);
	});

	it('accounts for an expanded desktop rail without changing the wide-screen mode', () => {
		const collapsed = resolveCameraFit(
			{ width: 1440, height: 900, coarsePointer: false, controlsExpanded: false },
			defaultBoard
		);
		const expanded = resolveCameraFit(
			{ width: 1440, height: 900, coarsePointer: false, controlsExpanded: true },
			defaultBoard
		);

		expect(expanded.compact).toBe(false);
		expect(expanded.boardScale).toBeLessThan(collapsed.boardScale);
		expect(expanded.target[0]).toBeLessThan(0);
	});

	it('scales oversized boards down in every viewport class', () => {
		const oversized: BoardDimensions = { height: 9, rows: 8, columns: 10 };
		const regular = resolveCameraFit(
			{ width: 1366, height: 768, coarsePointer: false, controlsExpanded: true },
			defaultBoard
		);
		const large = resolveCameraFit(
			{ width: 1366, height: 768, coarsePointer: false, controlsExpanded: true },
			oversized
		);

		expect(large.boardScale).toBeCloseTo(regular.boardScale * 0.7);
	});
});
