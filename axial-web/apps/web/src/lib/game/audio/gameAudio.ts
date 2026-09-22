import type { Player } from '@axial/core';

export const SOUND_PREFERENCE_KEY = 'axial-sound-enabled';

type AudioStorage = Pick<Storage, 'getItem' | 'setItem'>;
type AudioVisibility = Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>;

export type GameAudioOptions = {
	createContext?: () => AudioContext | null;
	getStorage?: () => AudioStorage | null;
	visibility?: AudioVisibility | null;
};

export type GameAudio = {
	readonly enabled: boolean;
	/** Read the opt-in preference once. This never creates a context or plays audio. */
	hydrate(): boolean;
	setEnabled(enabled: boolean): boolean;
	toggle(): boolean;
	/** Call directly from a user gesture; enabling alone never starts audio. */
	unlock(): Promise<boolean>;
	/** Call at a fresh move's landing, never while restoring or replaying snapshots. */
	playImpact(player: Player, height: number): void;
	playWin(player: Player): void;
	playInvalid(): void;
	/** Silence active and future voices, e.g. on reset, undo or snapshot replacement. */
	cancel(): void;
	destroy(): void;
};

type Voice = {
	oscillator: OscillatorNode;
	gain: GainNode | null;
	started: boolean;
};

type Tone = {
	frequency: number;
	endFrequency?: number;
	volume: number;
	duration: number;
	delay?: number;
	type?: OscillatorType;
};

const MAX_VOICES = 12;

/** Optional, browser-local sound. No timers, assets, game-state subscriptions or deferred playback. */
export function createGameAudio(options: GameAudioOptions = {}): GameAudio {
	const createContext =
		options.createContext ??
		(() =>
			typeof window !== 'undefined' && typeof window.AudioContext === 'function'
				? new window.AudioContext({ latencyHint: 'interactive' })
				: null);
	const getStorage =
		options.getStorage ?? (() => (typeof window === 'undefined' ? null : window.localStorage));
	const visibility =
		options.visibility === undefined
			? typeof document === 'undefined'
				? null
				: document
			: options.visibility;
	const voices = new Set<Voice>();
	let enabled = false;
	let hydrated = false;
	let destroyed = false;
	let unlocked = false;
	let activation = 0;
	let warned = false;
	let context: AudioContext | null = null;
	let pendingUnlock: Promise<boolean> | null = null;
	let lastInvalidTime = -Infinity;

	function report(error: unknown) {
		if (warned) return;
		warned = true;
		console.warn('[Axial audio] Optional sound is unavailable; the match can continue.', error);
	}

	function attempt(action: () => void) {
		try {
			action();
		} catch (error) {
			// Device loss and browser policy must not interrupt a move or the remaining cleanup.
			report(error);
		}
	}

	function release(voice: Voice, stop: boolean) {
		voices.delete(voice);
		voice.oscillator.onended = null;
		if (stop) {
			const now = context?.currentTime ?? 0;
			if (voice.gain) {
				attempt(() => voice.gain!.gain.cancelScheduledValues(now));
				attempt(() => voice.gain!.gain.setValueAtTime(0, now));
			}
			if (voice.started) attempt(() => voice.oscillator.stop(now));
		}
		attempt(() => voice.oscillator.disconnect());
		if (voice.gain) attempt(() => voice.gain!.disconnect());
	}

	function cancel() {
		for (const voice of voices) release(voice, true);
		lastInvalidTime = -Infinity;
	}

	function onVisibilityChange() {
		if (!visibility?.hidden) return;
		activation += 1;
		unlocked = false;
		cancel();
	}

	visibility?.addEventListener('visibilitychange', onVisibilityChange);

	function setEnabled(next: boolean) {
		if (destroyed) return enabled;
		enabled = next;
		if (!enabled) {
			activation += 1;
			unlocked = false;
			cancel();
		}
		attempt(() => getStorage()?.setItem(SOUND_PREFERENCE_KEY, String(enabled)));
		return enabled;
	}

	async function unlock(): Promise<boolean> {
		if (destroyed || !enabled || visibility?.hidden) return false;
		if (pendingUnlock) return pendingUnlock;
		try {
			if (!context || context.state === 'closed') context = createContext();
			if (!context) return false;
			const activeContext = context;
			const activeActivation = activation;
			if (activeContext.state === 'running') {
				unlocked = true;
				return true;
			}
			// Invoke resume synchronously within the originating gesture, before yielding.
			pendingUnlock = activeContext
				.resume()
				.then(() => {
					unlocked =
						!destroyed &&
						enabled &&
						!visibility?.hidden &&
						activation === activeActivation &&
						context === activeContext &&
						activeContext.state === 'running';
					return unlocked;
				})
				.catch((error: unknown) => {
					unlocked = false;
					report(error);
					return false;
				})
				.finally(() => {
					pendingUnlock = null;
				});
			return pendingUnlock;
		} catch (error) {
			unlocked = false;
			report(error);
			return false;
		}
	}

	function schedule(activeContext: AudioContext, tone: Tone) {
		if (voices.size >= MAX_VOICES) release(voices.values().next().value!, true);
		const voice: Voice = {
			oscillator: activeContext.createOscillator(),
			gain: null,
			started: false
		};
		// Track partial construction too, so a failed node allocation cannot leak a voice.
		voices.add(voice);
		const oscillator = voice.oscillator;
		const gain = activeContext.createGain();
		voice.gain = gain;
		const start = activeContext.currentTime + 0.005 + (tone.delay ?? 0);
		const end = start + tone.duration;
		oscillator.type = tone.type ?? 'sine';
		oscillator.frequency.setValueAtTime(tone.frequency, start);
		if (tone.endFrequency) {
			oscillator.frequency.exponentialRampToValueAtTime(tone.endFrequency, start + 0.06);
		}
		gain.gain.setValueAtTime(0, start);
		gain.gain.linearRampToValueAtTime(tone.volume, start + 0.004);
		gain.gain.exponentialRampToValueAtTime(0.0001, end);
		oscillator.connect(gain);
		gain.connect(activeContext.destination);
		oscillator.onended = () => release(voice, false);
		oscillator.start(start);
		voice.started = true;
		oscillator.stop(end + 0.015);
	}

	function play(action: (activeContext: AudioContext) => void) {
		if (destroyed || !enabled || !unlocked || visibility?.hidden || context?.state !== 'running') {
			return;
		}
		try {
			action(context);
		} catch (error) {
			unlocked = false;
			report(error);
			cancel();
		}
	}

	return {
		get enabled() {
			return enabled;
		},
		hydrate() {
			if (destroyed || hydrated) return enabled;
			hydrated = true;
			attempt(() => {
				enabled = getStorage()?.getItem(SOUND_PREFERENCE_KEY) === 'true';
			});
			return enabled;
		},
		setEnabled,
		toggle: () => setEnabled(!enabled),
		unlock,
		playImpact(player, height) {
			if ((player !== 1 && player !== 2) || !Number.isFinite(height)) return;
			play((activeContext) => {
				const lift = 1 + Math.max(0, Math.min(9, height)) * 0.008;
				const fundamental = (player === 1 ? 760 : 640) * lift;
				schedule(activeContext, {
					frequency: player === 1 ? 180 : 155,
					endFrequency: player === 1 ? 125 : 110,
					volume: 0.055,
					duration: 0.14
				});
				schedule(activeContext, { frequency: fundamental, volume: 0.026, duration: 0.23 });
				schedule(activeContext, { frequency: fundamental * 1.46, volume: 0.008, duration: 0.09 });
			});
		},
		playWin(player) {
			if (player !== 1 && player !== 2) return;
			play((activeContext) => {
				const root = player === 1 ? 330 : 293.66;
				[1, 1.25, 1.5].forEach((ratio, index) => {
					schedule(activeContext, {
						frequency: root * ratio,
						volume: 0.032,
						duration: 0.32 + index * 0.065,
						delay: index * 0.07
					});
				});
			});
		},
		playInvalid() {
			play((activeContext) => {
				if (activeContext.currentTime - lastInvalidTime < 0.12) return;
				lastInvalidTime = activeContext.currentTime;
				schedule(activeContext, { frequency: 110, volume: 0.02, duration: 0.065 });
			});
		},
		cancel,
		destroy() {
			if (destroyed) return;
			destroyed = true;
			activation += 1;
			unlocked = false;
			cancel();
			visibility?.removeEventListener('visibilitychange', onVisibilityChange);
			const activeContext = context;
			context = null;
			if (activeContext && activeContext.state !== 'closed') {
				attempt(() => {
					void activeContext.close().catch(report);
				});
			}
		}
	};
}
