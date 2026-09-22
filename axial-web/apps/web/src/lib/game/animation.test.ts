import { describe, expect, it } from 'vitest';
import { applyMove, createGame } from '@axial/core';
import {
	GAME_OVER_MODAL_DELAY_MS,
	PIECE_DROP_DURATION_MAX_SECONDS,
	PIECE_IMPACT_DURATION_SECONDS,
	COMPLETED_LINE_DRAW_DURATION_SECONDS,
	COMPLETED_LINE_SETTLE_DURATION_SECONDS,
	createLandingSequence,
	hasSameMoveHistory,
	isSingleMoveAppend,
	pieceDropDuration,
	samplePieceDrop
} from './animation';

describe('placement staging', () => {
	it('recognizes a duplicate snapshot without confusing appends or replacement moves', () => {
		const empty = createGame();
		const first = applyMove(empty, { row: 0, col: 0 });
		const other = applyMove(empty, { row: 1, col: 0 });
		expect(hasSameMoveHistory(first.moveHistory, structuredClone(first.moveHistory))).toBe(true);
		expect(hasSameMoveHistory(first.moveHistory, other.moveHistory)).toBe(false);
		expect(hasSameMoveHistory(empty.moveHistory, first.moveHistory)).toBe(false);
		expect(hasSameMoveHistory(first.moveHistory, empty.moveHistory)).toBe(false);
	});

	it('accelerates under gravity and lands continuously without penetrating support', () => {
		const duration = pieceDropDuration({ height: 6, rows: 6, columns: 7 }, 0);
		expect(samplePieceDrop(0, duration).remaining).toBe(1);
		expect(samplePieceDrop(duration / 2, duration).remaining).toBeCloseTo(0.75);
		expect(samplePieceDrop(duration, duration).remaining).toBe(0);
		for (let time = 0; time <= duration + 0.3; time += 0.005) {
			const sample = samplePieceDrop(time, duration);
			expect(sample.remaining + sample.rebound).toBeGreaterThanOrEqual(0);
			expect(sample.compression).toBeLessThan(0.07);
		}
		expect(samplePieceDrop(duration + PIECE_IMPACT_DURATION_SECONDS, duration)).toEqual({
			remaining: 0,
			rebound: 0,
			compression: 0,
			impact: 0,
			settled: true
		});
	});

	it('uses shorter falls for tall stacks and bounds the largest supported board', () => {
		const board = { height: 9, rows: 9, columns: 10 };
		expect(pieceDropDuration(board, 8)).toBeLessThan(pieceDropDuration(board, 0));
		expect(pieceDropDuration(board, 0)).toBeLessThanOrEqual(PIECE_DROP_DURATION_MAX_SECONDS);
	});

	it('reduced motion presents a fully settled piece immediately', () => {
		expect(samplePieceDrop(0, 0.5, true)).toEqual({
			remaining: 0,
			rebound: 0,
			compression: 0,
			impact: 0,
			settled: true
		});
	});

	it('reveals results only after the longest landing and completed-line sequence', () => {
		expect(GAME_OVER_MODAL_DELAY_MS / 1000).toBeGreaterThan(
			PIECE_DROP_DURATION_MAX_SECONDS +
				PIECE_IMPACT_DURATION_SECONDS +
				COMPLETED_LINE_DRAW_DURATION_SECONDS +
				COMPLETED_LINE_SETTLE_DURATION_SECONDS
		);
	});

	it('distinguishes fresh moves from undo, snapshot replacement, and reconnect catch-up', () => {
		const empty = createGame();
		const first = applyMove(empty, { row: 0, col: 0 });
		const second = applyMove(first, { row: 1, col: 0 });
		const alternative = applyMove(empty, { row: 2, col: 0 });
		expect(isSingleMoveAppend(empty.moveHistory, first.moveHistory)).toBe(true);
		expect(isSingleMoveAppend(first.moveHistory, second.moveHistory)).toBe(true);
		expect(isSingleMoveAppend(empty.moveHistory, second.moveHistory)).toBe(false);
		expect(isSingleMoveAppend(second.moveHistory, first.moveHistory)).toBe(false);
		expect(isSingleMoveAppend(alternative.moveHistory, second.moveHistory)).toBe(false);
		expect(isSingleMoveAppend(first.moveHistory, first.moveHistory)).toBe(false);
	});
});

it('stages a fast reply after its support lands, while other columns stay immediate', () => {
	const game = createGame();
	const lower = applyMove(game, { row: 0, col: 0 });
	const upper = applyMove(lower, { row: 0, col: 0 });
	const other = applyMove(upper, { row: 1, col: 0 });
	const sequence = createLandingSequence();
	expect(sequence.reserve(lower.lastMove!, game.dimensions, 0)).toBe(0);
	const delay = sequence.reserve(upper.lastMove!, game.dimensions, 0.005);
	expect(delay + 0.005 + pieceDropDuration(game.dimensions, 1)).toBeGreaterThan(
		pieceDropDuration(game.dimensions, 0)
	);
	expect(sequence.reserve(other.lastMove!, game.dimensions, 0.01)).toBe(0);
	sequence.clear();
	expect(sequence.reserve(lower.lastMove!, game.dimensions, 0)).toBe(0);
});
