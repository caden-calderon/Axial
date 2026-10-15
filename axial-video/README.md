# Axial trailer

Remotion project for the 44-second browser-game trailer. The live game is in `../axial-web`. `TrailerLandscape` (1920 × 1080) and `TrailerPortrait` (1080 × 1920) use frame-stepped captures of actual Svelte/Threlte gameplay, original narration, procedural music, and game-inspired sound cues. The two storyboard compositions remain available for reference.

## Edit and render

```bash
cd /home/caden/projects/Axial/axial-video
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm build
pnpm render:landscape
pnpm render:portrait
```

Studio runs on the URL printed by `pnpm dev` (normally port 3333). Exports land in `out/` and are ignored by Git. A local Chromium install is used by default; set `REMOTION_BROWSER_EXECUTABLE` for a different path.

In a fresh clone, rebuild the local footage and audio below before rendering.

## Rebuild local media

The media clips, model weights, audio, and exports are deliberately local and ignored. To recapture the same gameplay, start `cd ../axial-web && pnpm dev --host 127.0.0.1 --port 5173`, then run:

```bash
node scripts/capture-opening.mjs
node scripts/capture-features.mjs
```

The scripts use the web app's existing Playwright dependency, saved local match state, real keyboard placements, and a frame-stepped browser clock. They need Chromium and FFmpeg installed. They save MP4 clips and stills in `public/footage/`. Opening moves 11–15 and the five rule examples were checked against the shared game core. See [the script and move rationale](../dev/active/axial-announcement-readiness/web-trailer-script.md) for the narrative and limits.

Narration was generated with the Apache-2.0 [Kokoro model](https://huggingface.co/hexgrad/Kokoro-82M), using its `af_sarah` voice through the MIT [kokoro-onnx runtime](https://github.com/thewh1teagle/kokoro-onnx). `scripts/make-audio.py` recreates the narration, music bed, and effects in `public/audio/` from locally cached weights. On this machine, Python 3.12, `kokoro-onnx==0.6.1`, and `soundfile==0.14.0` produced the audio. Download `kokoro-v1.0.int8.onnx` and `voices-v1.0.bin` from the [runtime's model-files-v1.1 release](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1) into `.cache/kokoro/`, then run `./.venv/bin/python scripts/make-audio.py` from this directory. The chosen voice is an original synthetic voice, not an imitation of a particular person. Keep the original dry voice and sound layers editable before final publication.

`public/fonts/` holds the app's Inter font and its license. No web-app source or dependency changes are required to render the trailer.

## Review status

The full trailer shows a legal five-move threat/block/fork/win sequence, a height-changing 3D line, connect-five, a larger board, and two/three-line objectives. The optional “Look for a line. Watch for theirs.” voice beat was removed to give the real customization examples enough time. Landscape and portrait are separately composed. Visual pacing, voice character, and perceived audio balance still need Caden's playback review before the videos are posted.
