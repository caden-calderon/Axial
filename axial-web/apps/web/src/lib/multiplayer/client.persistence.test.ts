import { afterEach, expect, it, vi } from 'vitest';
import { clearCredentials, loadCredentials, saveCredentials } from './client';

vi.mock('$app/environment', () => ({ browser: true }));

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it('retains reconnect credentials in session storage when the localStorage getter is denied', () => {
	const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.stubGlobal('localStorage', {});
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!;
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		get() {
			throw new DOMException('Access denied', 'SecurityError');
		}
	});
	const values = new Map<string, string>();
	vi.stubGlobal('sessionStorage', {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key)
	});
	const credentials = {
		roomCode: 'ABCD2345',
		playerId: 'host',
		reconnectToken: 'host-token',
		seat: 1 as const,
		isHost: true,
		displayName: 'Host'
	};
	try {
		expect(() => saveCredentials(credentials)).not.toThrow();
		expect(loadCredentials(credentials.roomCode)).toEqual(credentials);
		clearCredentials(credentials.roomCode);
		expect(loadCredentials(credentials.roomCode)).toBeNull();
	} finally {
		Object.defineProperty(globalThis, 'localStorage', descriptor);
		warning.mockRestore();
	}
});
