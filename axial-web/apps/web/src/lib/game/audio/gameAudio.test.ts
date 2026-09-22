import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGameAudio, SOUND_PREFERENCE_KEY } from './gameAudio';

class FakeParam {
	setValueAtTime = vi.fn();
	linearRampToValueAtTime = vi.fn();
	exponentialRampToValueAtTime = vi.fn();
	cancelScheduledValues = vi.fn();
}

class FakeOscillator {
	type: OscillatorType = 'sine';
	frequency = new FakeParam();
	onended: (() => void) | null = null;
	connect = vi.fn();
	disconnect = vi.fn();
	start = vi.fn();
	stop = vi.fn();
}

class FakeGain {
	gain = new FakeParam();
	connect = vi.fn();
	disconnect = vi.fn();
}

class FakeContext {
	state: AudioContextState = 'suspended';
	currentTime = 10;
	destination = {};
	oscillators: FakeOscillator[] = [];
	gains: FakeGain[] = [];
	createOscillator = vi.fn(() => {
		const oscillator = new FakeOscillator();
		this.oscillators.push(oscillator);
		return oscillator;
	});
	createGain = vi.fn(() => {
		const gain = new FakeGain();
		this.gains.push(gain);
		return gain;
	});
	resume = vi.fn(async () => {
		this.state = 'running';
	});
	close = vi.fn(async () => {
		this.state = 'closed';
	});
}

class FakeVisibility extends EventTarget {
	hidden = false;
	setHidden(hidden: boolean) {
		this.hidden = hidden;
		this.dispatchEvent(new Event('visibilitychange'));
	}
}

function setup(preference: string | null = null) {
	const context = new FakeContext();
	const createContext = vi.fn(() => context as unknown as AudioContext);
	const visibility = new FakeVisibility();
	const storage = {
		getItem: vi.fn(() => preference),
		setItem: vi.fn()
	};
	const audio = createGameAudio({ createContext, visibility, getStorage: () => storage });
	return { audio, context, createContext, visibility, storage };
}

afterEach(() => vi.restoreAllMocks());

describe('optional game audio', () => {
	it('defaults to silence and never creates a context for hydration or a restored match', async () => {
		const { audio, createContext } = setup();
		expect(audio.enabled).toBe(false);
		expect(audio.hydrate()).toBe(false);
		audio.playImpact(1, 0);
		audio.playWin(1);
		audio.playInvalid();
		expect(await audio.unlock()).toBe(false);
		audio.destroy();
		expect(createContext).not.toHaveBeenCalled();
	});

	it('hydrates a saved opt-in without starting sound or queuing pre-gesture events', async () => {
		const { audio, context, createContext, storage } = setup('true');
		expect(audio.hydrate()).toBe(true);
		audio.playImpact(1, 0);
		audio.playWin(1);
		expect(createContext).not.toHaveBeenCalled();
		expect(await audio.unlock()).toBe(true);
		expect(createContext).toHaveBeenCalledTimes(1);
		expect(context.resume).toHaveBeenCalledTimes(1);
		expect(context.oscillators).toHaveLength(0);
		audio.playImpact(1, 0);
		expect(context.oscillators).toHaveLength(3);
		expect(await audio.unlock()).toBe(true);
		expect(context.resume).toHaveBeenCalledTimes(1);
		expect(storage.setItem).not.toHaveBeenCalled();
		audio.destroy();
	});

	it.each(['false', 'yes', '1', '', null])(
		'requires an explicit true preference, received %s',
		(value) => {
			const { audio } = setup(value);
			expect(audio.hydrate()).toBe(false);
			audio.destroy();
		}
	);

	it('persists toggle changes without creating audio and only hydrates once', () => {
		const { audio, storage, createContext } = setup('true');
		expect(audio.hydrate()).toBe(true);
		expect(audio.toggle()).toBe(false);
		expect(storage.setItem).toHaveBeenLastCalledWith(SOUND_PREFERENCE_KEY, 'false');
		expect(audio.hydrate()).toBe(false);
		expect(storage.getItem).toHaveBeenCalledTimes(1);
		expect(audio.setEnabled(true)).toBe(true);
		expect(storage.setItem).toHaveBeenLastCalledWith(SOUND_PREFERENCE_KEY, 'true');
		expect(createContext).not.toHaveBeenCalled();
		audio.destroy();
	});

	it('uses quiet bounded envelopes and different impact tones for each player', async () => {
		const { audio, context } = setup();
		audio.setEnabled(true);
		await audio.unlock();
		audio.playImpact(1, 0);
		const firstPitch = context.oscillators[1].frequency.setValueAtTime.mock.calls[0][0];
		audio.playImpact(2, 0);
		const secondPitch = context.oscillators[4].frequency.setValueAtTime.mock.calls[0][0];
		expect(firstPitch).not.toBe(secondPitch);
		for (const gain of context.gains) {
			expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0, 10.005);
			const [peak, peakAt] = gain.gain.linearRampToValueAtTime.mock.calls[0];
			expect(peak).toBeGreaterThan(0);
			expect(peak).toBeLessThanOrEqual(0.055);
			expect(peakAt).toBeGreaterThan(10.005);
			const [tail, tailAt] = gain.gain.exponentialRampToValueAtTime.mock.calls[0];
			expect(tail).toBe(0.0001);
			expect(tailAt).toBeLessThan(10.25);
		}
		audio.playImpact(1, NaN);
		expect(context.oscillators).toHaveLength(6);
		audio.destroy();
	});

	it('schedules a short winning chord on the audio clock and cancels every future note', async () => {
		const { audio, context } = setup('true');
		audio.hydrate();
		await audio.unlock();
		audio.playWin(2);
		expect(context.oscillators).toHaveLength(3);
		const starts = context.oscillators.map((oscillator) => oscillator.start.mock.calls[0][0]);
		expect(starts[0]).toBeCloseTo(10.005);
		expect(starts[1] - starts[0]).toBeCloseTo(0.07);
		expect(starts[2] - starts[1]).toBeCloseTo(0.07);
		for (const oscillator of context.oscillators) {
			expect(oscillator.stop.mock.calls[0][0]).toBeLessThan(10.65);
		}
		audio.cancel();
		for (const oscillator of context.oscillators) {
			expect(oscillator.stop).toHaveBeenLastCalledWith(10);
			expect(oscillator.disconnect).toHaveBeenCalledOnce();
			expect(oscillator.onended).toBeNull();
		}
		for (const gain of context.gains) {
			expect(gain.gain.cancelScheduledValues).toHaveBeenCalledWith(10);
			expect(gain.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 10);
			expect(gain.disconnect).toHaveBeenCalledOnce();
		}
		audio.destroy();
	});

	it('mute cancels all voices immediately and re-enabling never replays them', async () => {
		const { audio, context } = setup('true');
		audio.hydrate();
		await audio.unlock();
		audio.playWin(1);
		audio.setEnabled(false);
		expect(
			context.oscillators.every((oscillator) => oscillator.disconnect.mock.calls.length === 1)
		).toBe(true);
		audio.setEnabled(true);
		audio.playImpact(1, 0);
		expect(context.oscillators).toHaveLength(3);
		await audio.unlock();
		expect(context.oscillators).toHaveLength(3);
		audio.playImpact(1, 0);
		expect(context.oscillators).toHaveLength(6);
		audio.destroy();
	});

	it('silences hidden tabs and requires a fresh gesture after returning', async () => {
		const { audio, context, visibility } = setup('true');
		audio.hydrate();
		await audio.unlock();
		audio.playImpact(1, 0);
		visibility.setHidden(true);
		audio.playWin(1);
		expect(await audio.unlock()).toBe(false);
		expect(context.oscillators).toHaveLength(3);
		expect(context.oscillators[0].stop).toHaveBeenLastCalledWith(10);
		visibility.setHidden(false);
		audio.playImpact(2, 0);
		expect(context.oscillators).toHaveLength(3);
		await audio.unlock();
		audio.playImpact(2, 0);
		expect(context.oscillators).toHaveLength(6);
		audio.destroy();
	});

	it('does not create a context while the tab is hidden', async () => {
		const { audio, visibility, createContext } = setup('true');
		audio.hydrate();
		visibility.setHidden(true);
		expect(await audio.unlock()).toBe(false);
		expect(createContext).not.toHaveBeenCalled();
		audio.destroy();
	});

	it('disconnects naturally ended sources and does not retain them until reset', async () => {
		const { audio, context } = setup('true');
		audio.hydrate();
		await audio.unlock();
		audio.playInvalid();
		context.oscillators[0].onended?.();
		expect(context.oscillators[0].disconnect).toHaveBeenCalledOnce();
		expect(context.gains[0].disconnect).toHaveBeenCalledOnce();
		audio.cancel();
		expect(context.oscillators[0].stop).toHaveBeenCalledOnce();
		expect(context.oscillators[0].disconnect).toHaveBeenCalledOnce();
		audio.destroy();
	});

	it('limits impact polyphony and throttles rapidly repeated invalid input', async () => {
		const { audio, context } = setup('true');
		audio.hydrate();
		await audio.unlock();
		for (let index = 0; index < 10; index += 1) audio.playImpact(1, 0);
		expect(
			context.oscillators.filter((oscillator) => oscillator.disconnect.mock.calls.length === 0)
		).toHaveLength(12);
		audio.cancel();
		audio.playInvalid();
		audio.playInvalid();
		expect(context.oscillators).toHaveLength(31);
		context.currentTime += 0.13;
		audio.playInvalid();
		expect(context.oscillators).toHaveLength(32);
		audio.destroy();
	});

	it('discards sounds while resuming and does not allow a late unlock to bypass mute', async () => {
		const { audio, context, createContext } = setup('true');
		let resolveResume!: () => void;
		context.resume.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveResume = () => {
						context.state = 'running';
						resolve();
					};
				})
		);
		audio.hydrate();
		const first = audio.unlock();
		const second = audio.unlock();
		audio.playImpact(1, 0);
		audio.setEnabled(false);
		audio.setEnabled(true);
		resolveResume();
		expect(await first).toBe(false);
		expect(await second).toBe(false);
		expect(context.resume).toHaveBeenCalledOnce();
		expect(createContext).toHaveBeenCalledOnce();
		audio.playWin(1);
		expect(context.oscillators).toHaveLength(0);
		expect(await audio.unlock()).toBe(true);
		audio.destroy();
	});

	it('destroy cancels notes, closes once, removes listeners and blocks pending or future work', async () => {
		const { audio, context, visibility, storage } = setup('true');
		const remove = vi.spyOn(visibility, 'removeEventListener');
		audio.hydrate();
		await audio.unlock();
		audio.playWin(1);
		audio.destroy();
		audio.destroy();
		expect(context.close).toHaveBeenCalledOnce();
		expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
		expect(context.oscillators.every((oscillator) => oscillator.onended === null)).toBe(true);
		expect(await audio.unlock()).toBe(false);
		audio.playImpact(1, 0);
		audio.toggle();
		expect(context.oscillators).toHaveLength(3);
		expect(storage.setItem).not.toHaveBeenCalled();
	});

	it('does not revive audio when a pending resume finishes after disposal', async () => {
		const { audio, context } = setup('true');
		let resolveResume!: () => void;
		context.resume.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveResume = () => {
						context.state = 'running';
						resolve();
					};
				})
		);
		audio.hydrate();
		const pending = audio.unlock();
		audio.destroy();
		resolveResume();
		expect(await pending).toBe(false);
		audio.playWin(1);
		expect(context.oscillators).toHaveLength(0);
		expect(context.close).toHaveBeenCalledOnce();
	});

	it('isolates storage errors while leaving the user toggle functional', () => {
		const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const audio = createGameAudio({
			getStorage: () => {
				throw new Error('Storage denied');
			},
			visibility: null
		});
		expect(audio.hydrate()).toBe(false);
		expect(audio.setEnabled(true)).toBe(true);
		expect(audio.toggle()).toBe(false);
		expect(warning).toHaveBeenCalledOnce();
		audio.destroy();
	});

	it('treats an unavailable context as silent and construction/resume failures as recoverable', async () => {
		const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const factory = vi.fn<() => AudioContext | null>(() => null);
		const audio = createGameAudio({
			createContext: factory,
			getStorage: () => null,
			visibility: null
		});
		audio.setEnabled(true);
		expect(await audio.unlock()).toBe(false);
		expect(warning).not.toHaveBeenCalled();
		factory.mockImplementationOnce(() => {
			throw new Error('No output device');
		});
		expect(await audio.unlock()).toBe(false);
		const context = new FakeContext();
		context.resume.mockRejectedValueOnce(new Error('Autoplay denied'));
		factory.mockReturnValue(context as unknown as AudioContext);
		expect(await audio.unlock()).toBe(false);
		expect(await audio.unlock()).toBe(true);
		expect(warning).toHaveBeenCalledOnce();
		audio.destroy();
	});

	it('cleans up partially constructed voices and allows the match callback to return normally', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { audio, context } = setup('true');
		audio.hydrate();
		await audio.unlock();
		context.createGain.mockImplementationOnce(() => {
			throw new Error('Node allocation failed');
		});
		expect(() => audio.playImpact(1, 0)).not.toThrow();
		expect(context.oscillators[0].disconnect).toHaveBeenCalledOnce();
		expect(context.oscillators[0].stop).not.toHaveBeenCalled();
		expect(await audio.unlock()).toBe(true);
		audio.playImpact(1, 0);
		expect(context.oscillators).toHaveLength(4);
		audio.destroy();
	});

	it('continues cleanup when one source fails to stop and absorbs close rejection', async () => {
		const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { audio, context } = setup('true');
		audio.hydrate();
		await audio.unlock();
		audio.playWin(1);
		context.oscillators[0].stop.mockImplementation(() => {
			throw new Error('Device lost');
		});
		context.close.mockRejectedValue(new Error('Already closed'));
		expect(() => audio.destroy()).not.toThrow();
		await Promise.resolve();
		expect(
			context.oscillators.every((oscillator) => oscillator.disconnect.mock.calls.length === 1)
		).toBe(true);
		expect(context.gains.every((gain) => gain.disconnect.mock.calls.length === 1)).toBe(true);
		expect(warning).toHaveBeenCalledOnce();
	});
});
