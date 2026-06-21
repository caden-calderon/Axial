export const WELCOME_TOUR_STORAGE_KEY = 'axial-welcome-tour-v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type WelcomeTourStartContext = {
	searchParams: URLSearchParams;
	embedMode: boolean;
	hasActiveMatch: boolean;
	hasOnlineIntent: boolean;
	hasSeenTour: boolean;
};

export function hasSeenWelcomeTour(storage: StorageLike | null | undefined): boolean {
	try {
		return storage?.getItem(WELCOME_TOUR_STORAGE_KEY) === 'seen';
	} catch {
		return false;
	}
}

export function markWelcomeTourSeen(storage: StorageLike | null | undefined): void {
	try {
		storage?.setItem(WELCOME_TOUR_STORAGE_KEY, 'seen');
	} catch {
		// Private or restricted storage should not block the game.
	}
}

export function clearWelcomeTourSeen(storage: StorageLike | null | undefined): void {
	try {
		storage?.removeItem(WELCOME_TOUR_STORAGE_KEY);
	} catch {
		// Private or restricted storage should not block the game.
	}
}

export function shouldStartWelcomeTour({
	searchParams,
	embedMode,
	hasActiveMatch,
	hasOnlineIntent,
	hasSeenTour
}: WelcomeTourStartContext): boolean {
	const tourFlag = normalizeTourFlag(searchParams.get('tour'));

	if (tourFlag === 'off') return false;
	if (tourFlag === 'force' || tourFlag === 'reset') return true;
	if (embedMode || hasActiveMatch || hasOnlineIntent) return false;

	return !hasSeenTour;
}

function normalizeTourFlag(value: string | null): 'force' | 'off' | 'reset' | null {
	if (!value) return null;

	const normalized = value.toLowerCase();
	if (normalized === '1' || normalized === 'true' || normalized === 'start') return 'force';
	if (
		normalized === '0' ||
		normalized === 'false' ||
		normalized === 'off' ||
		normalized === 'skip'
	) {
		return 'off';
	}
	if (normalized === 'reset') return 'reset';

	return null;
}
