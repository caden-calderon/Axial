# Axial overview video: context

## Current state (2026-10-20)

- Done. Caden approved cut 8 (54.7 s, 1080p60, music conformed); it's the final video:
  `axial-video/out/axial-overview-1080p60.mp4` (ignored by Git; `pnpm render:overview` rebuilds it).
  No 30 fps or 9:16 versions: X takes 60 fps and 16:9 works everywhere.
- Committed on `announcement-readiness` and merged into `main`.
- The web app keeps one development-only change for the recorder: the aim probe in `ColumnPicker.svelte`
  (`import.meta.env.DEV`, compiled out of production builds).
- Old September pipeline removed from `axial-video` (Trailer/Storyboard/TrailerProof, capture-opening/features, make-audio.py).

## Cut 2 (2026-10-18)

- Caden's feedback on cut 1: the tutorial card as an opener was lazy, and the cut after "This is Axial" jumped
  (the angle, zoom and brightness all changed at once). The script is now agreed: `script.md` (draft 3).
- New: `take.offCamera()` in the recorder, `stage-reveal.ts`, the `desktop-reveal` and `desktop-modes` takes, the
  `Title` component, and an `EndCard` over the final board.
- Found while recording: `onlineController.svelte.ts:64` defaults every online player's display name to
  'Caden'. It's visible in the modes take. Flagged to Caden, not fixed.

## Cut 3 (2026-10-18)

- Caden's notes on cut 2: much better, but give the text room to breathe and make it more energetic. A
  fresh-context Opus review gave a per-beat readability table and edit ideas. Script draft 4 records
  what was taken up.
- Edit tools: speed ramps and freeze frames (`shot()` beats, applied via Remotion `<Freeze>` time
  remapping; `GameSounds` follows the retiming), impact pulses, freeze flashes, zoom-through cuts,
  slam titles, the `Devices` scene.
- Re-recorded: `desktop-reveal` (axis numbers off), `desktop-controls` and `phone-play` (matches
  under way). New: `desktop-ai` (Hard blocks orange's staged threat at move 24). The cut 2 versions
  are backed up in `/tmp/axial-cine/*.cut2.*`.
- The real game only allows opponent and difficulty changes before a match starts (`setupLocked`;
  switching to AI starts a new board), so the modes shot is on an empty board by necessity.
- Medium self-play classic games all end flat on the floor (`find-games.ts`, 16 games), so they're no
  use for a phone win.

## Cut 4 (2026-10-18)

- Caden's cut 3 notes, the plan he agreed to and the changes are in `script.md` (draft 5).
- In storage and saved matches, the AI's "Max" is `'nightmare'`. A saved match with `'max'` is
  silently rejected and the game starts a fresh board.
- The result card appears 1.76 s after the winning move (`GAME_OVER_MODAL_DELAY_MS`), about 0.15 s
  after the line finishes drawing.
- The game's top bar is the top 128 px (1080 space): wordmark at x 30-190, turn chip at x 865-1055,
  toolbar at x 1620-1905.
- The staged match (`CLASSIC_FORK`) never gives blue an immediate win. `stage-ai-win.ts` searches
  short continuations of it instead.

## Cut 5 (2026-10-20)

- Caden's cut 4 notes and the changes are in `script.md` (draft 6). Render: `axial-video/out/review/axial-overview-cut5-1080p60.mp4`.
- The cut 4 big-board take is backed up in `/tmp/axial-cine/desktop-bigboard.cut4.*`.
- The winning five in the big-board match runs along the rows at column 5, height 4 down to 0. Side-on means
  looking along the columns; `LINE_DX=-230 LINE_DY=-120` gets there from the take's opening angle.
- `desktop-ai` is no longer in the cut but stays recorded.

## Environment

- NixOS laptop (p16s). No ffmpeg on PATH: `nix shell nixpkgs#ffmpeg -c ...`. Chrome: `/run/current-system/sw/bin/google-chrome` (headless WebGL works on the Iris Xe via ANGLE/Vulkan).
- Web dev server must run: `cd axial-web/apps/web && pnpm dev --host 127.0.0.1 --port 5173`.
- Capture speed ~2-3 frames/s at 4K with UI screenshots.

## Gotchas learned

- Playwright's `waitForFunction` polls on rAF by default; the virtual clock owns rAF, so poll by interval.
- The app defers the 3D scene behind timers/frames: the recorder pumps the virtual clock until the canvas mounts (before frame 0).
- Vite HMR reloads the page on any source edit (even `svelte-kit sync`): the recorder swallows the HMR websocket.
- Clicking the empty landing cell does nothing: the game picks the stack under the pointer or the floor tile. Hence the aim probe. Low camera angles can hide centre stacks entirely; takes orbit to a higher view first.
- Touch screens default to confirm-drop (tap to aim, then Drop). Takes seed no preferences so first-visit defaults show.
- The result card appears ~1.8 s after a win and blurs the board; finale takes click "Keep board" before looking around.
- Odd frame widths break libx264: phone viewport is 414x736.

## Game observation for Caden

Competent self-play (Medium, Hard) wins classic Axial on the floor in 9-20 moves; the third dimension barely appears. Worth a separate design discussion.
