import { describe, expect, it } from 'vitest';
import { createWheelGestureClassifier, type WheelSample } from './wheelGesture';

function sample(overrides: Partial<WheelSample>): WheelSample {
	return { deltaX: 0, deltaY: 0, ctrlKey: false, timeStamp: 0, ...overrides };
}

describe('wheel gesture classifier', () => {
	it('zooms for straight up/down scrolling from a wheel or a trackpad', () => {
		const classify = createWheelGestureClassifier();
		expect(classify(sample({ deltaY: 100 }))).toBe('zoom');
		// Real Chrome-on-Linux touchpad values.
		expect(classify(sample({ deltaY: 5.25, timeStamp: 10 }))).toBe('zoom');
		expect(classify(sample({ deltaY: -63.1875, timeStamp: 20 }))).toBe('zoom');
	});

	it('still zooms when an up/down swipe is slightly crooked', () => {
		const classify = createWheelGestureClassifier();
		expect(classify(sample({ deltaX: 1, deltaY: 20 }))).toBe('zoom');
	});

	it('orbits for a sideways swipe', () => {
		const classify = createWheelGestureClassifier();
		expect(classify(sample({ deltaX: -10.5, deltaY: 5.25 }))).toBe('orbit');
	});

	it('keeps orbiting (tilting) when an orbit gesture turns up/down, through momentum', () => {
		const classify = createWheelGestureClassifier();
		expect(classify(sample({ deltaX: 8, deltaY: 2, timeStamp: 0 }))).toBe('orbit');
		expect(classify(sample({ deltaY: 30, timeStamp: 16 }))).toBe('orbit');
		expect(classify(sample({ deltaY: 4, timeStamp: 32 }))).toBe('orbit');
	});

	it('switches a zoom gesture to orbit once it moves sideways, never back', () => {
		const classify = createWheelGestureClassifier();
		expect(classify(sample({ deltaY: 10, timeStamp: 0 }))).toBe('zoom');
		expect(classify(sample({ deltaX: 12, deltaY: 3, timeStamp: 16 }))).toBe('orbit');
		expect(classify(sample({ deltaY: 10, timeStamp: 32 }))).toBe('orbit');
	});

	it('starts each new gesture as zoom again after a pause', () => {
		const classify = createWheelGestureClassifier();
		expect(classify(sample({ deltaX: 12, timeStamp: 0 }))).toBe('orbit');
		expect(classify(sample({ deltaY: 10, timeStamp: 500 }))).toBe('zoom');
	});

	it('always zooms for a pinch, which browsers send as a ctrl wheel', () => {
		const classify = createWheelGestureClassifier();
		expect(classify(sample({ deltaX: 12, timeStamp: 0 }))).toBe('orbit');
		expect(classify(sample({ deltaY: -4, ctrlKey: true, timeStamp: 16 }))).toBe('zoom');
		expect(classify(sample({ deltaX: 3, deltaY: -4, ctrlKey: true, timeStamp: 32 }))).toBe('zoom');
	});
});
