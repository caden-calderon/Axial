# Cinematic shots and sound design

Status: researched proposal, September 22, 2026. Extends `web-trailer-script.md`. No camera code, game behavior, storyboard timing, recording or sound assets changed in this pass.

## Recommended approach

Use the existing Svelte/Threlte scene as the set, with a small local capture entry that gives us a programmable camera and explicit presentation time. Export those shots for editing in Remotion. Continue using ordinary gameplay captures for the settings and product-interface shots.

We are not limited to what the player can reach with the mouse. The current camera restrictions serve gameplay: fixed target, no panning and a minimum zoom distance. They are not restrictions of Three.js. Moving a virtual camera closer or above the piece creates a new perspective with actual geometry and parallax, unlike enlarging a screen recording.

The first implementation should prove one falling-piece shot and one readable winning reveal. Keep it small: a few named shots with camera positions, targets and timings. Do not build a general-purpose cinematic editor.

## What the current code gives us

| Existing mechanism | Consequence for capture |
| --- | --- |
| `AxialWorld.svelte` creates a perspective camera and OrbitControls. Desktop framing uses 42° vertical FOV, minimum distance 7.2, fixed origin target and no pan. | Replace gameplay camera control only in the capture entry. Close-ups and camera following become possible without changing game rules. |
| `GamePiece.svelte` names its piece group, calculates its location using `cellPosition`, and samples `samplePieceDrop`. | The piece path can also drive the camera. Resolve board rotation/scale before using a position as a world-space camera target. |
| `animation.ts` provides pure drop sampling, acceleration, rebound and compression. Drops last 0.26–0.5 seconds; impact lasts 0.18 seconds. | Reuse this motion and sample it more slowly for selected shots. A default bottom-layer fall is about 0.44 seconds, so around 0.3× playback gives roughly 1.46 seconds of travel. |
| Piece and completed-line playback currently use `performance.now()`. Highlight pulses and labels also use frame deltas. | A programmable camera alone does not create repeatable frame exports. These visual clocks need a capture-time input or a static capture configuration. |
| `AxialWorld.svelte` distinguishes appended moves from restored histories, and uses a landing queue. | Loading a snapshot does not automatically replay the drop. Stage the settled board, then schedule the selected legal move's presentation explicitly. |
| The board group rotates by -0.34 radians and scales with screen/board size. Fog derives from normal framing. | A capture camera must account for the transformed board and set deliberate framing/fog. Do not blindly reuse desktop fit logic for macro or portrait shots. |
| Pieces use transparent physical materials and additive glow layers. Shadows are disabled on the current Canvas. | Extreme close-ups need visual checks for transparency, clipping and the flat highlight detail. Shadow or depth-of-field effects would be additional work, not something already present. |

Local sources: `axial-web/apps/web/src/lib/game/scene/AxialWorld.svelte`, `GamePiece.svelte`, `CompletedLineMarker.svelte`, `cameraFit.ts`, `geometry.ts`, and `axial-web/apps/web/src/lib/game/animation.ts`.

## The overhead falling-piece shot

Imagine the camera descending alongside the piece, above it and slightly to one side. The piece stays fairly stable in the frame while the grid below expands toward us. That is the visual cue that makes the descent feel deep.

1. Start high enough to show the piece and a recognizable landing area beneath it.
2. Follow the piece's sampled position, adding an upward and sideways offset. Start testing about 10–20° away from a perfectly vertical view. The exact offset should come from looking at the real frame.
3. Use a stable camera orientation. A perfectly vertical camera needs an appropriate up vector to avoid an ambiguous orientation; a slightly angled shot also makes the piece's side visible.
4. Ease the camera out of its descent before contact while the piece continues. This lets the landing read and avoids a violent stop or camera collision with the board.
5. Cut on or just after impact to a wider diagonal view that explains the win. Hold the actual winning-line animation before the title reveal.

For a strict top-down alternate, keep the piece off-center enough that it does not obscure its destination. Test both versions. Do not rely on a fully centered overhead shot to communicate height: it can flatten the board and conceal the exact space we want viewers to see.

Use perspective projection for this shot. An orthographic view removes the perspective scaling that helps communicate the camera's descent. Moving the camera and changing lens FOV are separate choices; start with a fixed FOV and a smooth physical move, then adjust only if framing needs it.

## Proposed shot family

These are camera options within the existing 44-second structure, not extra scenes to add indiscriminately.

| Shot | Purpose and motion | Best placement |
| --- | --- | --- |
| Readable three-quarter master | Establish the threatened line and empty destination. Small push-in; keep both colors in view. | Opening threat and first block. |
| Overhead descent | Follow the falling piece with a slight offset, grid advancing beneath it. Slow selected travel, then release into the landing. | Final winning drop, where it has the greatest payoff. |
| Low oblique landing | Camera just above the landing layer, looking across the destination and adjacent pieces. Foreground pieces give depth, but must not hide the block. | One blocking move, about 1–2 seconds. |
| Lateral move past a foreground piece | Small sideways translation reveals the next threat through parallax. Keep the threatened cells sharp and visible. | Fork setup, replacing a static angle. |
| Winning-line reveal | Start offset from the diagonal, then move slightly until all four pieces and the connecting line are visible together. | Immediately after final impact. |
| Slow pullback for title | Settle into a quiet wider composition with space for AXIAL. | “This is Axial.” |

Save the most unusual camera move for the final drop. The blocking shots need clear spatial information. Constant motion and a new extreme angle on every move would weaken the tense-match story.

The validated opening currently wins along the bottom plane. A later gameplay shot must show a raised stack or a line that changes height. The overhead camera adds cinematic depth, but it does not turn a flat winning line into an elevated one.

## Capture architecture and alternatives

**Preferred: reuse the real scene with explicit time.** Add a local development capture entry and the smallest optional presentation hooks to the existing scene. Normal gameplay retains its current camera, timing, input and reduced-motion behavior.

The capture entry supplies a legal move list, staged starting board, current shot time, camera path/target and output dimensions. It controls piece descent, impact, highlight pulse and line reveal from the same clock. It can hide controls, labels and previews for a hero shot. Settings footage still uses the actual interface.

For a deterministic export, frame N maps to a specific shot time. Update the scene and camera, wait for Svelte updates and GPU drawing, then capture that frame. Repeating the same frame should reproduce its state; seeking backward must not leave a stale landing or already-completed line. Audio is assembled separately using the same event times.

Threlte exposes manual rendering and renderer/camera access, but `advance()` does not itself replace our `performance.now()` animation clocks. Its installed scheduler simply marks a frame for rendering. Explicit animation time remains necessary. [Threlte context documentation](https://threlte.xyz/docs/reference/core/use-threlte/).

Start with a browser preview and a short export at 1080p. If real-time OBS capture is stable, it is useful for quick takes. For the precise slow-motion shots, frame-by-frame image export is the quality route to prove: rendering can take longer than playback without dropping temporal samples. This requires implementing and validating the capture bridge; it is not already available in the installed storyboard project.

Render at explicit pixel dimensions with controlled DPR. A 3840×2160 canvas at DPR 2 would request an unnecessarily large 7680×4320 backing buffer. Test GPU capability and image quality before choosing 4K source capture. Portrait shots need their own camera framing.

| Alternative | Tradeoff |
| --- | --- |
| Record manual mouse orbits only | Fast for normal gameplay, but difficult to repeat or synchronize with a subsecond falling piece. Useful supporting footage. |
| Rebuild the board inside Remotion/React Three Fiber | Direct frame-driven rendering, but duplicates the Svelte scene and risks material/animation drift. Remotion's Three integration targets React Three Fiber, not Svelte components. [Official integration](https://www.remotion.dev/docs/three). |
| Rebuild/export into Blender | Potential for elaborate lighting and depth of field, but Three materials and procedural effects do not become an identical Blender scene automatically. Extra work is justified only if we choose a visual treatment the actual scene cannot deliver. |

No additional editor or 3D package is needed for the recommended first proof. Remotion remains the assembly tool; the small capture extension belongs alongside the real game scene. The proposed extension is a scoped implementation decision to discuss before editing that code.

## Sound design: make the game feel tactile

The existing game sounds are a good starting identity. `gameAudio.ts` builds impacts from a short descending low tone plus two brighter tones, with distinct pitches for each player and a small height variation. Wins use three staggered tones. There are no existing whoosh or cinematic ambience assets in that module.

Proposed separate sound layers:

| Layer | Character and use |
| --- | --- |
| Axial impact | Preserve the game's short, clean electronic landing. Keep the two players subtly distinguishable. |
| Added contact texture | A quiet glass/ceramic-like tick and restrained low body can give a close-up weight. Keep it small enough to suit the pieces. This is an editorial layer, not a new gameplay feature. |
| Falling air | Short filtered-noise descent that builds with motion, then stops at contact. Use it primarily on the hero drop. |
| Tension bed | Low, slowly evolving synth tone. Introduce a sparse pulse after the first block. Avoid a busy melody. |
| Pre-impact space | Reduce the music and sweep roughly 0.15–0.25 seconds before the decisive impact. Test the gap against the footage. |
| Winning release | Actual win motif with a soft, wider tonal tail. Leave enough room for the line to appear and the name to be spoken. |
| Interface details | Quiet, short ticks on rule selections, used only where a visible action benefits. |

No automatic whoosh on every cut. Contrast between restrained moments and one satisfying impact will do more for the opening than constant loud effects.

The first custom effects can be synthesized from tones, noise and envelopes and rendered to WAV. The browser's `OfflineAudioContext` can render a scheduled audio graph into a buffer without recording speaker output. Adapting the existing tone recipes requires a small offline renderer; the current live audio controller cannot simply be replaced with an OfflineAudioContext because its unlock/state checks assume live playback. [Offline rendering documentation](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext/startRendering).

Record or recreate the dry game sounds separately, then add cinematic layers in the edit. If footage is slowed, place a fresh impact at the retimed contact frame; do not slow the entire audio track and accidentally drag the pitch down. Keep narration, music, impacts and movement effects independently adjustable.

Voice treatment: the original female synthetic voice remains clear and close, with a narrow pitch range. Test a very subtle doubled/filtered layer underneath it for an artificial quality. Keep the intelligible dry voice dominant, especially on phone speakers. Music should recede under speech. Effects should survive mono playback; avoid relying on deep bass alone for the landing.

Keep licensed music and any external effects' source/usage information with the assets. Original procedural sounds would reduce the need for stock-effect browsing. No asset purchase or generation has been made in this planning pass.

## First proof and acceptance

Before committing to all camera paths, build one 4–6 second proof containing the overhead descent, impact and a readable wider winning-line reveal. Compare strict top-down against slightly offset overhead. Add only a temporary tension bed and impact layers, not final music or paid narration.

Check:

- The destination, fall, contact and winning line are legible with the sound muted.
- Board state and piece colors stay continuous across angles; no mirroring or invented pieces.
- The camera avoids geometry clipping, transparency artifacts and disorienting flips.
- Slowed motion remains smooth and the frame can be reproduced from the same time input.
- Real gameplay still uses the original drop timing, controls, audio callbacks and reduced-motion behavior.
- Landscape and portrait both retain the relevant pieces and winning line.
- Sound aligns with contact, works on small speakers and leaves a convincing pause before the payoff.

Only after that proof should we capture the full opening and lock the music/voice pacing. Existing script timings remain provisional until they are tested against real moving footage.
