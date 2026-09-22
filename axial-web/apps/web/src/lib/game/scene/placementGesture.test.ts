import { describe, expect, it } from 'vitest';
import { createPlacementGesture } from './placementGesture';

function pointer(pointerId = 1, x = 20, y = 30, button = 0) {
	return { pointerId, clientX: x, clientY: y, button };
}

describe('board placement gestures', () => {
	it('accepts a short primary tap once', () => {
		const gesture = createPlacementGesture();
		gesture.down(pointer(), 100);
		expect(gesture.up(pointer(), 200)).toBe(true);
		expect(gesture.up(pointer(), 210)).toBe(false);
	});

	it('accepts the movement and time boundaries, but rejects holds and larger movement', () => {
		const gesture = createPlacementGesture();
		gesture.down(pointer(), 0);
		expect(gesture.up(pointer(1, 28, 30), 650)).toBe(true);
		gesture.down(pointer(), 1000);
		expect(gesture.up(pointer(), 1651)).toBe(false);
		gesture.down(pointer(), 2000);
		expect(gesture.up(pointer(1, 28.1, 30), 2100)).toBe(false);
	});

	it('rejects a camera drag even when it returns to its starting point', () => {
		const gesture = createPlacementGesture();
		gesture.down(pointer(), 0);
		gesture.move(pointer(1, 200, 30));
		gesture.move(pointer());
		expect(gesture.up(pointer(), 300)).toBe(false);
	});

	it('measures diagonal travel and checks release coordinates without a move event', () => {
		const gesture = createPlacementGesture();
		gesture.down(pointer(), 0);
		expect(gesture.up(pointer(1, 26, 36), 100)).toBe(false);
	});

	it('rejects both fingers of a pinch, regardless of which releases first', () => {
		for (const firstRelease of [1, 2]) {
			const gesture = createPlacementGesture();
			gesture.down(pointer(1), 0);
			gesture.down(pointer(2), 50);
			expect(gesture.up(pointer(firstRelease), 100)).toBe(false);
			expect(gesture.up(pointer(firstRelease === 1 ? 2 : 1), 200)).toBe(false);
			gesture.down(pointer(3), 300);
			expect(gesture.up(pointer(3), 400)).toBe(true);
		}
	});

	it('keeps a pinch blocked until every finger releases, including added fingers', () => {
		const gesture = createPlacementGesture();
		gesture.down(pointer(1), 0);
		gesture.down(pointer(2), 10);
		expect(gesture.up(pointer(2), 20)).toBe(false);
		gesture.down(pointer(3), 30);
		expect(gesture.up(pointer(1), 40)).toBe(false);
		expect(gesture.up(pointer(3), 50)).toBe(false);
	});

	it('ignores a secondary touch when the primary finger began outside the board', () => {
		const gesture = createPlacementGesture();
		gesture.down({ ...pointer(2), isPrimary: false }, 0);
		expect(gesture.up(pointer(2), 100)).toBe(false);
	});

	it('rejects right-button presses and mismatched pointer releases', () => {
		const gesture = createPlacementGesture();
		gesture.down(pointer(1, 20, 30, 2), 0);
		expect(gesture.up(pointer(1, 20, 30, 2), 100)).toBe(false);
		gesture.down(pointer(1), 200);
		expect(gesture.up(pointer(2), 250)).toBe(false);
		expect(gesture.up(pointer(1), 300)).toBe(true);
	});

	it('cancels a departing or interrupted pointer and permits the next fresh tap', () => {
		const gesture = createPlacementGesture();
		gesture.down(pointer(), 0);
		gesture.cancel(1);
		expect(gesture.up(pointer(), 100)).toBe(false);
		gesture.down(pointer(), 200);
		expect(gesture.up(pointer(), 300)).toBe(true);
	});

	it('does not turn a cancelled pinch into a tap for the remaining finger', () => {
		const gesture = createPlacementGesture();
		gesture.down(pointer(1), 0);
		gesture.down(pointer(2), 10);
		gesture.cancel(2);
		expect(gesture.up(pointer(1), 20)).toBe(false);
	});

	it('resets all gesture state when the picker is destroyed', () => {
		const gesture = createPlacementGesture();
		gesture.down(pointer(1), 0);
		gesture.down(pointer(2), 10);
		gesture.reset();
		expect(gesture.up(pointer(1), 20)).toBe(false);
		gesture.down(pointer(3), 30);
		expect(gesture.up(pointer(3), 40)).toBe(true);
	});
});
