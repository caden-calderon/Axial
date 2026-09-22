type PointerPosition = {
	pointerId: number;
	clientX: number;
	clientY: number;
};

type PointerPress = PointerPosition & {
	button: number;
	isPrimary?: boolean;
};

const MAX_TRAVEL_PX = 8;
const MAX_HOLD_MS = 650;

/** Distinguish a board tap from orbit, hold, and pinch gestures. */
export function createPlacementGesture() {
	const pointers = new Set<number>();
	let blocked = false;
	let candidate: {
		pointerId: number;
		x: number;
		y: number;
		startedAt: number;
		maxTravelSquared: number;
	} | null = null;

	function down(event: PointerPress, now: number): void {
		if (pointers.has(event.pointerId)) return;
		pointers.add(event.pointerId);
		if (pointers.size > 1 || event.button !== 0 || event.isPrimary === false) {
			blocked = true;
			candidate = null;
			return;
		}
		if (blocked) return;
		candidate = {
			pointerId: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			startedAt: now,
			maxTravelSquared: 0
		};
	}

	function move(event: PointerPosition): void {
		if (candidate?.pointerId !== event.pointerId) return;
		const dx = event.clientX - candidate.x;
		const dy = event.clientY - candidate.y;
		candidate.maxTravelSquared = Math.max(candidate.maxTravelSquared, dx * dx + dy * dy);
	}

	function up(event: PointerPress, now: number): boolean {
		move(event);
		const elapsed = candidate ? now - candidate.startedAt : -1;
		const isTap = Boolean(
			!blocked &&
			candidate?.pointerId === event.pointerId &&
			event.button === 0 &&
			elapsed >= 0 &&
			elapsed <= MAX_HOLD_MS &&
			candidate.maxTravelSquared <= MAX_TRAVEL_PX * MAX_TRAVEL_PX
		);
		if (candidate?.pointerId === event.pointerId) candidate = null;
		pointers.delete(event.pointerId);
		if (pointers.size === 0) blocked = false;
		return isTap;
	}

	function cancel(pointerId: number): void {
		candidate = null;
		pointers.delete(pointerId);
		// A cancelled pinch remains blocked while any other finger is still down.
		blocked = pointers.size > 0;
	}

	function reset(): void {
		pointers.clear();
		candidate = null;
		blocked = false;
	}

	return { down, move, up, cancel, reset };
}
