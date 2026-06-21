import { describe, expect, it } from 'vitest';
import {
	clearWelcomeTourSeen,
	hasSeenWelcomeTour,
	markWelcomeTourSeen,
	shouldStartWelcomeTour,
	WELCOME_TOUR_STORAGE_KEY
} from './welcomeTour';

function params(search = ''): URLSearchParams {
	return new URLSearchParams(search);
}

function startContext(overrides: Partial<Parameters<typeof shouldStartWelcomeTour>[0]> = {}) {
	return {
		searchParams: params(),
		embedMode: false,
		hasActiveMatch: false,
		hasOnlineIntent: false,
		hasSeenTour: false,
		...overrides
	};
}

describe('welcome tour gating', () => {
	it('starts for first-time standalone users', () => {
		expect(shouldStartWelcomeTour(startContext())).toBe(true);
	});

	it('does not auto-start after completion or in special entry modes', () => {
		expect(shouldStartWelcomeTour(startContext({ hasSeenTour: true }))).toBe(false);
		expect(shouldStartWelcomeTour(startContext({ embedMode: true }))).toBe(false);
		expect(shouldStartWelcomeTour(startContext({ hasActiveMatch: true }))).toBe(false);
		expect(shouldStartWelcomeTour(startContext({ hasOnlineIntent: true }))).toBe(false);
	});

	it('honors explicit query controls', () => {
		expect(
			shouldStartWelcomeTour(
				startContext({ searchParams: params('tour=1'), hasSeenTour: true, embedMode: true })
			)
		).toBe(true);
		expect(
			shouldStartWelcomeTour(
				startContext({ searchParams: params('tour=reset'), hasSeenTour: true })
			)
		).toBe(true);
		expect(shouldStartWelcomeTour(startContext({ searchParams: params('tour=0') }))).toBe(false);
	});
});

describe('welcome tour storage', () => {
	it('reads, writes, and clears the seen flag defensively', () => {
		const values = new Map<string, string>();
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => {
				values.set(key, value);
			},
			removeItem: (key: string) => {
				values.delete(key);
			}
		};

		expect(hasSeenWelcomeTour(storage)).toBe(false);
		markWelcomeTourSeen(storage);
		expect(values.get(WELCOME_TOUR_STORAGE_KEY)).toBe('seen');
		expect(hasSeenWelcomeTour(storage)).toBe(true);
		clearWelcomeTourSeen(storage);
		expect(hasSeenWelcomeTour(storage)).toBe(false);
	});
});
