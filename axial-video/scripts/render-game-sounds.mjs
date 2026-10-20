// Renders the game's own sound effects to WAV by running the shipped audio module
// (axial-web/apps/web/src/lib/game/audio/gameAudio.ts) against an OfflineAudioContext.
//
//   node scripts/render-game-sounds.mjs
//
// Needs the web dev server (AXIAL_RECORD_URL, default http://127.0.0.1:5173), which serves the
// module source. Writes public/audio/impact-p{1,2}-h{0..9}.wav and win-p{1,2}.wav (ignored),
// lifted 12 dB for mixing under music.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, '../public/audio');
const requireFromWeb = createRequire(resolve(here, '../../axial-web/apps/web/package.json'));
const { chromium } = requireFromWeb('@playwright/test');
const appUrl = process.env.AXIAL_RECORD_URL ?? 'http://127.0.0.1:5173';

const browser = await chromium.launch({
	executablePath: process.env.AXIAL_RECORD_CHROME ?? '/run/current-system/sw/bin/google-chrome'
});
try {
	const page = await browser.newPage();
	await page.goto(`${appUrl}/?tour=0`);
	const sounds = await page.evaluate(async () => {
		const { createGameAudio } = await import('/src/lib/game/audio/gameAudio.ts');
		const sampleRate = 48_000;

		// The module only plays into a running context; an offline one runs once rendering starts.
		async function render(play) {
			const offline = new OfflineAudioContext(2, sampleRate * 1.2, sampleRate);
			const context = new Proxy(offline, {
				get(target, key) {
					if (key === 'state') return 'running';
					if (key === 'resume') return () => Promise.resolve();
					const value = Reflect.get(target, key, target);
					return typeof value === 'function' ? value.bind(target) : value;
				}
			});
			const audio = createGameAudio({ createContext: () => context, getStorage: () => null, visibility: null });
			audio.setEnabled(true);
			await audio.unlock();
			play(audio);
			const buffer = await offline.startRendering();
			return wav(buffer);
		}

		// The game mixes its sounds quietly (about -22 dBFS peaks) for headphones at a desk; a video
		// plays them under music, so they are lifted 12 dB. Timbre and timing are unchanged.
		const GAIN = 4;

		function wav(buffer) {
			const channels = buffer.numberOfChannels;
			const frames = buffer.length;
			const bytes = new DataView(new ArrayBuffer(44 + frames * channels * 2));
			const text = (offset, value) => [...value].forEach((char, index) => bytes.setUint8(offset + index, char.charCodeAt(0)));
			text(0, 'RIFF');
			bytes.setUint32(4, 36 + frames * channels * 2, true);
			text(8, 'WAVEfmt ');
			bytes.setUint32(16, 16, true);
			bytes.setUint16(20, 1, true);
			bytes.setUint16(22, channels, true);
			bytes.setUint32(24, buffer.sampleRate, true);
			bytes.setUint32(28, buffer.sampleRate * channels * 2, true);
			bytes.setUint16(32, channels * 2, true);
			bytes.setUint16(34, 16, true);
			text(36, 'data');
			bytes.setUint32(40, frames * channels * 2, true);
			const data = [...Array(channels)].map((_, channel) => buffer.getChannelData(channel));
			for (let frame = 0; frame < frames; frame += 1) {
				for (let channel = 0; channel < channels; channel += 1) {
					const sample = Math.max(-1, Math.min(1, data[channel][frame] * GAIN));
					bytes.setInt16(44 + (frame * channels + channel) * 2, sample * 0x7fff, true);
				}
			}
			let binary = '';
			const raw = new Uint8Array(bytes.buffer);
			for (let index = 0; index < raw.length; index += 0x8000) {
				binary += String.fromCharCode(...raw.subarray(index, index + 0x8000));
			}
			return btoa(binary);
		}

		const result = {};
		for (const player of [1, 2]) {
			for (let height = 0; height <= 9; height += 1) {
				result[`impact-p${player}-h${height}`] = await render((audio) => audio.playImpact(player, height));
			}
			result[`win-p${player}`] = await render((audio) => audio.playWin(player));
		}
		return result;
	});

	await mkdir(output, { recursive: true });
	for (const [name, base64] of Object.entries(sounds)) {
		await writeFile(resolve(output, `${name}.wav`), Buffer.from(base64, 'base64'));
	}
	console.log(`Wrote ${Object.keys(sounds).length} sounds to ${output}`);
} finally {
	await browser.close();
}
