# Optional procedural game audio

Date: 2026-09-07

## Implementation

`axial-web/apps/web/src/lib/game/audio/gameAudio.ts` provides a small imperative controller. It has no dependencies, downloaded assets, game-state subscriptions, JavaScript timers, or Svelte runes. Sounds are generated with short oscillator/gain envelopes on the Web Audio clock:

- A restrained falling low tone and two quieter resonant partials form the placement sound. The two players have different pitches, with a slight height adjustment.
- A three-note major chord resolves a newly won match in less than 0.65 seconds.
- A quiet 65 ms low tick acknowledges invalid input; repeated invalid events are limited to one per 120 ms.
- At most 12 oscillator voices can be live or scheduled simultaneously. Natural `ended` events release every node.

Sound defaults **off**. The preference key is `axial-sound-enabled`, and only the stored string `true` opts in. Storage access failure leaves the in-memory setting usable and cannot interrupt the match.

## Public integration contract

Import `createGameAudio` from `$lib/game/audio/gameAudio`.

- `enabled`: current preference; UI owns its reactive mirror.
- `hydrate(): boolean`: read the preference once, without creating a context or playing anything.
- `setEnabled(value): boolean` / `toggle(): boolean`: save and return the setting. Turning sound off immediately cancels every active or scheduled voice. Turning it on does not create a context or replay old events.
- `unlock(): Promise<boolean>`: call directly inside a pointer, keyboard, or toggle gesture. Context creation and `resume()` occur within that gesture. The promise resolves false for disabled, hidden, disposed, unsupported, or blocked audio. Callers may safely use `void audio.unlock()`.
- `playImpact(player, height)`: call on a fresh piece's landing. The module does not inspect snapshots; restoration, reconnect catch-up and initial game mount must not call it. Intentional redo can use the same live landing callback.
- `playWin(player)`: call once when the winning result is newly presented, after landing. An intermediate completed line in a multi-line objective is not a match win.
- `playInvalid()`: call for a rejected live input when useful.
- `cancel()`: stop all active and scheduled voices on reset, undo, snapshot replacement, or navigation. This retains the setting and the existing unlocked context.
- `destroy()`: cancel voices, remove the visibility listener, and close the context. Idempotent; later calls cannot start audio or alter the preference.

The controller installs a visibility listener. Hiding a tab cancels its voices and revokes activation; returning requires another user gesture. Events arriving while disabled, hidden, suspended, locked, or disposed are discarded. Nothing is queued for later playback. An asynchronous resume that completes after muting, hiding, or disposal cannot revive activation.

Browser/device audio failures are caught, partially created nodes are released, and one console warning preserves diagnostic evidence without flooding the console. Cleanup continues if an individual node fails to stop or disconnect. Missing Web Audio support is a normal silent fallback.

## Verification

- Before audio edits: web unit baseline passed **79 tests in 13 files**.
- Added **22 audio tests** using an injected mock AudioContext, storage and visibility source. These cover opt-in hydration, user-gesture creation, discarded pre-unlock events, bounded envelopes, player differentiation, precise chord timing, scheduled-note cancellation, mute/re-enable, hidden tabs, natural node cleanup, polyphony limits, invalid-input throttling, delayed resume races, idempotent disposal, storage/device failure, partial node allocation and rejected context closure.
- `pnpm --filter @axial/web exec vitest run src/lib/game/audio/gameAudio.test.ts` — **22/22 passed**.
- Scoped ESLint and standalone strict TypeScript checks passed; both source files formatted with the existing web Prettier configuration.
- Timing, cancellation and resource ownership are verified automatically. The integrated browser regression also observes real AudioContext oscillator starts on live impact, with no replay on reload and immediate mute. Auditory taste and actual output-device quality still need a listening check.

## API references consulted

- [MDN Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices): create/resume from a user gesture and provide user sound controls.
- [MDN AudioContext.resume](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume): asynchronous resume and rejection behavior.
- [MDN AudioScheduledSourceNode.stop](https://developer.mozilla.org/en-US/docs/Web/API/AudioScheduledSourceNode/stop): replacing future stop times and preventing a not-yet-started source from sounding.
- [MDN AudioParam.cancelScheduledValues](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/cancelScheduledValues): remove future envelope changes before muting.
- [MDN AudioContext.close](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/close): release context resources during teardown.
- [MDN visibilitychange](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event): cancel sounds when the page becomes hidden.
