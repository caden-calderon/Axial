import { afterEach, expect, it, vi } from 'vitest';
import { readStorage, removeStorage, writeStorage } from './browserStorage';

vi.mock('$app/environment', () => ({ browser: true }));

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it('warns once and keeps storage failures outside the caller control flow', () => {
	const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
	const unavailable = () => {
		throw new DOMException('Access denied', 'SecurityError');
	};
	vi.stubGlobal('localStorage', {
		getItem: unavailable,
		setItem: unavailable,
		removeItem: unavailable
	});
	expect(readStorage('localStorage', 'match')).toBeNull();
	expect(() => writeStorage('localStorage', 'match', 'value')).not.toThrow();
	expect(() => removeStorage('localStorage', 'match')).not.toThrow();
	expect(warning).toHaveBeenCalledOnce();
	expect(warning.mock.calls[0]?.[0]).toContain('may not persist');
});

it('preserves successful reads, writes, and removals in the selected backend', () => {
	const values = new Map<string, string>();
	vi.stubGlobal('sessionStorage', {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key)
	});
	writeStorage('sessionStorage', 'room', 'credentials');
	expect(readStorage('sessionStorage', 'room')).toBe('credentials');
	removeStorage('sessionStorage', 'room');
	expect(readStorage('sessionStorage', 'room')).toBeNull();
});
