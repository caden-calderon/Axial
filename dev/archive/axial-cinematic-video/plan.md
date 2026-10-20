# Axial overview video: plan

Started 2026-10-18. Replaces the September Remotion trailer, which Caden rejected ("it's just bad").

## Direction (Caden, 2026-10-18)

- **One video for everywhere** (LinkedIn article, X, Instagram, website): "This is Axial", a quick overview of the game and its controls. No Unity/origin section (the article covers that separately).
- **Authentic look:** exactly what players see. Real page, real camera, real input, first-visit defaults (layer grid off). No bloom, no scripted cinematic camera. A first proof with a capture-only scripted camera and bloom was rejected as "a juiced up render" and removed.
- **Interface: a mix.** Full UI for controls and feature beats; panel collapsed for gameplay stretches; the edit punches in (footage is 2x density) where UI reads small.
- **Platforms:** desktop mouse controls, plus a short phone beat (touch, confirm-drop).
- **Overlays:** drawn cursor (headless has none) and short control labels styled like the game's own pills.
- **No voiceover.** Music: Caden picks a licensed track; the cut is conformed to its beats.

## Pipeline

1. `axial-video/scripts/record.mjs <take>` drives the real dev page with Playwright: real mouse moves, clicks, drags (orbit), wheel (zoom), CDP touch events on phone. `virtual-clock.js` owns the page's clock (rAF, `performance.now`, `Date.now`, timers, and every CSS/Web Animation), so each frame is captured at an exact 1/60 s step however slow the capture is. `pointer-overlay.js` draws the cursor/finger.
2. Takes (`scripts/takes/*.mjs`) seed `localStorage` (opponent mode, a restored match via the app's own session restore) and script the interaction; they `mark()` frames for captions.
3. Aiming uses a dev-only probe in `ColumnPicker.svelte` (`window.__axialScene.aim(row, col)`): it searches natural aim points on the column and returns one that the game's own `pickMove` resolves to that column. Compiled out of production.
4. Desktop: 1920x1080 at DPR 2 (3840x2160 frames). Phone: 414x736 at DPR 3 (1242x2208), 9:16.
5. Edit: Remotion `Overview` composition (1920x1080, 60 fps) in `axial-video/src/overview/`; captions keyed to take markers. 30 fps derivative for X via ffmpeg.

## Material

- Staged classic match (`CLASSIC_FORK`, `scripts/stage-game.ts`): legal, nobody passes up a win, two threat blocks, a real fork and a four-step staircase win. Played in Local mode by clicks from a restored position.
- Self-play (`scripts/find-games.ts`): `BIG_STAIRCASE` (9x9x9 connect five, five-layer staircase), `THREE_LINE_RACE` (7x8x8, three lines, 3-2 finish).
- Controls and phone takes play the real AI live (Medium).

## Cut (draft, ~48 s before music)

1. Welcome card "This is Axial" (the game's own), Skip.
2. Controls vs AI: Point to aim, Click to drop, The AI plays back, Drag to look around, Scroll to zoom.
3. Local match: "Or play a friend on one screen"; fork, block, staircase win, result card.
4. Settings (punched in): Four AI levels; board grows to 9x9x9; connect four or five, up to three lines.
5. Big board connect-five finish; three-line race finish.
6. Phone in a device outline: Plays on your phone. Tap to aim, tap to drop.
7. End card: AXIAL, "Connect four in 3D. Free in your browser.", playaxial.dev.

## Open

- Music track (Caden).
- 9:16 version: phone take led, desktop beats letterboxed or cropped; decide after the 16:9 review.
