/**
 * Public by design: the matching secret lives only on the room server. Dev builds use
 * Cloudflare's always-pass invisible test key, which pairs with the test secret in the
 * worker's .dev.vars (the real widget refuses DevTools-driven browsers, so local testing
 * and automation would otherwise never get a token).
 */
export const TURNSTILE_SITE_KEY = import.meta.env.DEV
	? '1x00000000000000000000BB'
	: '0x4AAAAAAFh1Geo28AaZJR05';
export const TURNSTILE_ACTION = 'feedback';

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TOKEN_TIMEOUT_MS = 20_000;

type TurnstileOptions = {
	sitekey: string;
	action?: string;
	callback?: (token: string) => void;
	'error-callback'?: (code: string) => boolean | void;
	'expired-callback'?: () => void;
	'timeout-callback'?: () => void;
};

type TurnstileApi = {
	render: (container: HTMLElement, options: TurnstileOptions) => string | undefined;
	remove: (widgetId: string) => void;
};

declare global {
	interface Window {
		turnstile?: TurnstileApi;
	}
}

let scriptLoad: Promise<TurnstileApi> | null = null;

/** Loads Cloudflare's script once, on first use, so players who never send feedback never fetch it. */
function loadTurnstile(): Promise<TurnstileApi> {
	if (window.turnstile) return Promise.resolve(window.turnstile);
	scriptLoad ??= new Promise<TurnstileApi>((resolve, reject) => {
		const script = document.createElement('script');
		script.src = SCRIPT_URL;
		script.async = true;
		script.onload = () => {
			if (window.turnstile) resolve(window.turnstile);
			else reject(new Error('Spam check failed to start.'));
		};
		script.onerror = () => reject(new Error('Spam check failed to load.'));
		document.head.append(script);
	}).catch((error: unknown) => {
		// Let the next attempt retry the download instead of reusing the failure.
		scriptLoad = null;
		throw error;
	});
	return scriptLoad;
}

/**
 * Runs the invisible check in `container` and resolves with a fresh single-use token.
 * Each send gets its own widget, so a retry after an error never reuses a spent token.
 */
export async function requestTurnstileToken(container: HTMLElement): Promise<string> {
	const turnstile = await loadTurnstile();
	return new Promise<string>((resolve, reject) => {
		// Callbacks can only run after render returns, but they close over the id, so hold it in an object.
		const widget: { id?: string } = {};
		const finish = (outcome: () => void) => {
			clearTimeout(timeout);
			if (widget.id) turnstile.remove(widget.id);
			outcome();
		};
		const failed = () =>
			finish(() => reject(new Error("The spam check didn't finish. Try sending again.")));
		const timeout = setTimeout(failed, TOKEN_TIMEOUT_MS);

		widget.id = turnstile.render(container, {
			sitekey: TURNSTILE_SITE_KEY,
			action: TURNSTILE_ACTION,
			callback: (token) => finish(() => resolve(token)),
			'error-callback': () => {
				failed();
				return true;
			},
			'expired-callback': failed,
			'timeout-callback': failed
		});
	});
}
