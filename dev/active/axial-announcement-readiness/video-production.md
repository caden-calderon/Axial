# Axial web trailer production

September 22, 2026. Local first cut; Caden's artistic and speaker playback review is pending. Nothing has been published.

## Exports

- `axial-video/out/axial-trailer-landscape.mp4`: 1920 × 1080, 30 fps, 44 seconds, H.264/AAC.
- `axial-video/out/axial-trailer-portrait.mp4`: 1080 × 1920, 30 fps, 44 seconds, H.264/AAC.
- `axial-video/out/axial-opening-proof-landscape.mp4`: an earlier opening proof, retained for comparison; the full exports supersede it.

The Remotion compositions are editable in `axial-video/src/Trailer.tsx` and `TrailerProof.tsx`. Their local media sources are ignored by Git. Regeneration steps are in `axial-video/README.md`.

## Actual cut

| Time      | Picture                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------- |
| 0–12.5 s  | Five consecutive legal drops from one match: threat, block, fork, block, bottom-plane diagonal win. No narration. |
| 12.5–16 s | AXIAL title over the resolved real win; “This is Axial.”                                                          |
| 16–22 s   | Separate legal height-changing diagonal finish: “Connect four. In three dimensions.”                              |
| 22–27 s   | Real connect-five example and settings insert.                                                                    |
| 27–32 s   | Real 8 × 8 × 9 board example and settings insert.                                                                 |
| 32–39 s   | Legal two-line and three-line examples. The app's line-progress stills appear in landscape.                       |
| 39–44 s   | “Your move. Play Axial in your browser.” with playaxial.dev.                                                      |

The optional “Look for a line. Watch for theirs.” sentence was cut to give rule examples more time; the runtime remained 44 seconds. The first twelve seconds use slower clip playback and separate synthesized landing/win cues. Later titles communicate the same feature facts as the narration.

## Capture and checks

`capture-opening.mjs` and `capture-features.mjs` load saved match histories into the actual browser app, submit the next move through its keyboard control, and use Playwright's clock to step frames. The captured video is of the existing Three.js/Threlte board, not a reconstructed 3D scene. An initial `MediaRecorder` test produced only about six frames per second on software rendering; hardware ANGLE plus frame-by-frame screenshots captured smooth 30 fps clips. This required no production app changes.

The opening's complete 15-move history was verified with `createGame`/`applyMove` in the existing TypeScript core. Independent checks verified that the connect-five, two-line, three-line, and height-changing 3D examples finish legally; the larger-board example remains an intentionally unfinished position. These examples demonstrate legal game behavior, not AI quality or typical human play. Settings and line-progress stills came from the same browser app.

Remotion `pnpm lint` and `pnpm build` passed after the final composition edit. Both final MP4s were probed with FFprobe: H.264 video at 30 fps, AAC audio, 44.05-second container duration. Both were sampled at 16 points for visible gaps and layout. An initial portrait export cropped the board; the final export uses a fitted, enlarged source with the entire board visible, and its sampled frames were rechecked. The voice/audio tracks are present in the edit, but their subjective intelligibility, character, and balance have not been assessed on speakers by Caden.

The parallel repository check gate also passed locally: `pnpm check` (zero Svelte errors/warnings), `pnpm lint`, `CI=1 pnpm test:unit` (388 passed, 43 optional AI evaluations skipped), and `CI=1 pnpm build`. This does not substitute for a GitHub Actions run or live service checks.

## Creative limits

The board camera is static within each captured move. The planned overhead camera following a falling piece and in-scene orbit are absent; the first cut relies on continuous move states, timing, typography, and audio for motion. The opening win is a flat depth diagonal, so the separate 16–22 second example demonstrates a line that changes height. The portrait examples use separate framing but share captured game footage. If those shots are essential to the announcement, capture them in a second pass before publishing.

The synthetic narration uses Kokoro's `af_sarah` voice. Music and impact/win cues are original procedural layers in `make-audio.py`; they are editable separately. The video contains no Unity footage. A separate Unity clip can accompany the article if Caden chooses, but the current video accurately represents the live browser game.
