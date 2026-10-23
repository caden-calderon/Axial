/**
 * Decides whether a wheel gesture zooms or orbits the board.
 *
 * Straight up/down scrolling zooms, whether it comes from a mouse wheel or a two-finger
 * trackpad swipe. A swipe that moves sideways orbits, and once it is orbiting its up/down
 * movement tilts the board. A pinch, which browsers send as a wheel with `ctrlKey` set, always
 * zooms.
 *
 * Going by direction rather than guessing the device keeps mouse wheels safe: a wheel only
 * scrolls vertically, so it can never orbit by accident (a tilt wheel or Shift+wheel scrolls
 * sideways and orbits, which is a sensible response).
 *
 * A gesture lasts until the wheel goes quiet. It can switch from zoom to orbit as soon as it
 * moves clearly sideways, but never back, so momentum after lift-off doesn't flip it.
 */

export type WheelIntent = 'orbit' | 'zoom';

export type WheelSample = {
	deltaX: number;
	deltaY: number;
	ctrlKey: boolean;
	timeStamp: number;
};

/** Momentum events arrive every frame; a longer gap means the fingers started a new gesture. */
const GESTURE_GAP_MS = 220;
/** Sideways movement must be at least half the vertical movement, so a slightly crooked
 * up/down swipe still zooms. */
const SIDEWAYS_RATIO = 0.5;

export function createWheelGestureClassifier(): (sample: WheelSample) => WheelIntent {
	let gestureIntent: WheelIntent = 'zoom';
	let lastTime = Number.NEGATIVE_INFINITY;

	return (sample) => {
		const startsGesture = sample.timeStamp - lastTime > GESTURE_GAP_MS;
		lastTime = sample.timeStamp;
		if (sample.ctrlKey) {
			gestureIntent = 'zoom';
			return 'zoom';
		}
		if (startsGesture) gestureIntent = 'zoom';
		if (gestureIntent === 'zoom' && isSideways(sample)) gestureIntent = 'orbit';
		return gestureIntent;
	};
}

function isSideways({ deltaX, deltaY }: WheelSample): boolean {
	return Math.abs(deltaX) >= 1 && Math.abs(deltaX) >= Math.abs(deltaY) * SIDEWAYS_RATIO;
}
