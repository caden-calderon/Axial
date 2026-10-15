import { browser } from '$app/environment';

type StorageKind = 'localStorage' | 'sessionStorage';
let warned = false;

function warnUnavailable(error: unknown): void {
	if (warned) return;
	warned = true;
	console.warn(
		'[Axial] Browser storage is unavailable. Play can continue, but saved games, preferences, and room reconnect credentials may not persist.',
		error
	);
}

export function getBrowserStorage(kind: StorageKind): Storage | null {
	if (!browser) return null;
	try {
		return globalThis[kind];
	} catch (error) {
		warnUnavailable(error);
		return null;
	}
}

export function readStorage(kind: StorageKind, key: string): string | null {
	try {
		return getBrowserStorage(kind)?.getItem(key) ?? null;
	} catch (error) {
		warnUnavailable(error);
		return null;
	}
}

export function writeStorage(kind: StorageKind, key: string, value: string): void {
	try {
		getBrowserStorage(kind)?.setItem(key, value);
	} catch (error) {
		warnUnavailable(error);
	}
}

export function removeStorage(kind: StorageKind, key: string): void {
	try {
		getBrowserStorage(kind)?.removeItem(key);
	} catch (error) {
		warnUnavailable(error);
	}
}
