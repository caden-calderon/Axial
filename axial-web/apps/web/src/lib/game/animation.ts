import type { BoardDimensions, PlacedMove } from '@axial/core';

export const PIECE_DROP_DURATION_MIN_SECONDS = 0.26;
export const PIECE_DROP_DURATION_MAX_SECONDS = 0.5;
export const PIECE_IMPACT_DURATION_SECONDS = 0.18;
export const COMPLETED_LINE_DRAW_DURATION_SECONDS = 0.72;
export const COMPLETED_LINE_SETTLE_DURATION_SECONDS = 0.24;

// A result never covers the final landing or the line that explains the win.
export const GAME_OVER_MODAL_DELAY_MS = Math.round(
	(PIECE_DROP_DURATION_MAX_SECONDS +
		PIECE_IMPACT_DURATION_SECONDS +
		COMPLETED_LINE_DRAW_DURATION_SECONDS +
		COMPLETED_LINE_SETTLE_DURATION_SECONDS +
		0.12) *
		1000
);

export function pieceDropDuration(dimensions: BoardDimensions, height: number): number {
	const layers = Math.max(1, dimensions.height - height);
	return Math.min(
		PIECE_DROP_DURATION_MAX_SECONDS,
		Math.max(PIECE_DROP_DURATION_MIN_SECONDS, 0.17 + Math.sqrt(layers) * 0.11)
	);
}

/** Gravity accelerates toward the landing; the small rebound never penetrates its support. */
export function samplePieceDrop(elapsed: number, duration: number, reducedMotion = false) {
	if (reducedMotion || elapsed >= duration + PIECE_IMPACT_DURATION_SECONDS) {
		return { remaining: 0, rebound: 0, compression: 0, impact: 0, settled: true };
	}
	const progress = Math.max(0, Math.min(elapsed / duration, 1));
	const impactProgress = Math.max(
		0,
		Math.min((elapsed - duration) / PIECE_IMPACT_DURATION_SECONDS, 1)
	);
	return {
		remaining: 1 - progress * progress,
		rebound: Math.sin(impactProgress * Math.PI) * (1 - impactProgress) * 0.09,
		compression: Math.sin(impactProgress * Math.PI * 2) * (1 - impactProgress) * 0.065,
		impact: elapsed >= duration ? Math.pow(1 - impactProgress, 2) : 0,
		settled: false
	};
}

export function sceneMoveKey(move: PlacedMove, index: number): string {
	return `${index}:${move.player}:${move.kind}:${move.height}:${move.row}:${move.col}`;
}

export function hasSameMoveHistory(
	previous: readonly PlacedMove[],
	next: readonly PlacedMove[]
): boolean {
	return (
		previous.length === next.length &&
		previous.every((move, index) => sceneMoveKey(move, index) === sceneMoveKey(next[index], index))
	);
}

/** A fresh placement animates. Restore, catch-up and replacement snapshots appear settled. */
export function isSingleMoveAppend(
	previous: readonly PlacedMove[],
	next: readonly PlacedMove[]
): boolean {
	return (
		next.length === previous.length + 1 &&
		previous.every((move, index) => sceneMoveKey(move, index) === sceneMoveKey(next[index], index))
	);
}

/** Keep fast replies above their supporting piece, without delaying unrelated columns. */
export function createLandingSequence() {
	const landings = new Map<string, number>();
	return {
		reserve(move: PlacedMove, dimensions: BoardDimensions, nowSeconds: number): number {
			const column = `${move.row}:${move.col}`;
			const duration = pieceDropDuration(dimensions, move.height);
			const previousLanding = landings.get(column);
			const delay =
				previousLanding === undefined
					? 0
					: Math.max(0, previousLanding + 0.06 - nowSeconds - duration);
			landings.set(column, nowSeconds + delay + duration);
			return delay;
		},
		clear() {
			landings.clear();
		}
	};
}
