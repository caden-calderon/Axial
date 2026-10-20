# Axial overview video

"This is Axial": a short overview of the browser game and its controls, for LinkedIn, X, Instagram and the website. Everything on screen is the real game as players see it, driven by real mouse and touch input and recorded frame by frame, then edited in Remotion. No voiceover; music is chosen separately.

## How the footage is made

`scripts/record.mjs <take>` opens the real web app (dev server) in headless Chrome and plays a take from `scripts/takes/`:

- `virtual-clock.js` gives the page one clock that the recorder advances by exactly 1/60 s per frame. It owns `requestAnimationFrame`, `performance.now`, `Date.now`, `setTimeout`/`setInterval` and every CSS and Web Animation, so the 3D board, the interface and the AI's turn pacing all play back at true speed however slowly frames are captured.
- `pointer-overlay.js` draws a cursor (desktop) or fingertip (phone), since headless Chrome has none.
- Takes move a real mouse, click, drag to orbit, scroll to zoom, or send touch events. `take.cell(row, col)` asks a development-only probe in the game's `ColumnPicker` for a point the game's own picking resolves to that column, so every click is one a player could make. The probe is compiled out of production builds.
- The one change to the game's look: recordings soften the interface's drop shadows (`--shadow`, 44% → 14% black). Punched in and encoded to 8-bit h.264, the shipped 48 px shadows read as heavy dark halos with visible steps around the turn chip, toolbar and panel.
- `take.offCamera(steps)` runs set-up steps (turning the camera before the first frame, say) on the clock without recording them.
- Takes seed `localStorage` to choose the opponent or restore a match through the app's own session restore; otherwise every take shows first-visit defaults.
- Each take writes `public/footage/<take>.mp4` and `<take>.markers.json`: labelled frames for captions, and every move with its frame, cell and height, so the edit can place the game's own sounds.

Desktop takes record 1920×1080 at 2× density (3840×2160 frames); the phone take records 414×736 at 3× (1242×2208).

| Take                | Shows                                                                                                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `desktop-reveal`    | Opening (axis numbers off): the board square from the front reads as a Connect 4 rack; a drop, then an orbit shows the rows behind                                                            |
| `desktop-controls`  | Against the AI on the staged match at move 16: aim, click to drop, the reply, drag to orbit, scroll to zoom                                                                                   |
| `desktop-modes`     | The opponent switch (Local, Online, AI) and the AI's four levels (the game only allows these before a match starts)                                                                           |
| `desktop-ai`        | Against Max (`'nightmare'` in storage) on a staged position (`stage-ai-win.ts`): orange ignores blue's climbing diagonal and the AI completes it (not in the current cut)                     |
| `desktop-twists`    | A fresh board: open settings, grow the board to 9×9×9, connect five, three lines to win (a marker on each click)                                                                              |
| `desktop-match`     | A local match restored at move 24 and played out: blocks, a fork, a staircase win                                                                                                             |
| `desktop-settings`  | AI levels, growing the board, connect five, lines to win (not in the current cut)                                                                                                             |
| `desktop-bigboard`  | 9×9×9 connect-five finish: the board turning slowly (settings closed off camera), the winning drop, a turn side-on so the staircase reads as five in a row, then Keep board and a look around |
| `desktop-multiline` | Three-lines-to-win finish (3-2), then a look around                                                                                                                                           |
| `phone-play`        | Portrait phone, staged match at move 20 against the AI: finger orbit, tap to aim, Drop, the AI's reply                                                                                        |

Match material lives in `scripts/takes/matches.mjs`. The opening position is staged with `scripts/stage-reveal.ts` and the classic match with `scripts/stage-game.ts` (legal moves, nobody passes up a win, a real fork); the big-board and three-line games are the shipped AI playing itself (`scripts/find-games.ts`). Bundle either TypeScript script with the workspace esbuild, aliasing `@axial/core`/`@axial/ai` to `../axial-web/packages/*/src/index.ts`.

`scripts/render-game-sounds.mjs` renders the game's impact and win sounds by running the shipped audio module against an `OfflineAudioContext` (lifted 12 dB for mixing under music).

## Run

Recording needs `ffmpeg` on `PATH` and Google Chrome (headless Chrome's WebGL). The recorder looks for
Chrome at `/run/current-system/sw/bin/google-chrome`; set `AXIAL_RECORD_CHROME` to its path elsewhere.

```bash
# 1. The game, in development mode (separate terminal)
cd axial-web/apps/web && pnpm dev --host 127.0.0.1 --port 5173

# 2. Dependencies, footage and sounds
cd axial-video
pnpm install --frozen-lockfile
node scripts/record.mjs desktop-controls            # full quality
node scripts/record.mjs desktop-controls --preview  # 1x, 30 fps
node scripts/render-game-sounds.mjs

# 3. Music: "A Solitary Pulse (Future Garage Motive)" by 9JackJack8, Pixabay Content License
#    (https://pixabay.com/music/soft-house-a-solitary-pulse-future-garage-motive-463685/)
mkdir -p public/audio/music
curl -L -o public/audio/music/solitary-pulse.mp3 \
  'https://cdn.pixabay.com/download/audio/2026/01/09/audio_6488410046.mp3?filename=9jackjack8-a-solitary-pulse-future-garage-motive-463685.mp3'

# 4. Edit and render
pnpm dev                 # Remotion Studio on :3333
pnpm render:overview     # out/axial-overview-1080p60.mp4
```

Footage, audio and renders are local and ignored by Git. Rebuild them with the commands above.

## Edit

`src/overview/Overview.tsx` is the cut, following the script in `dev/archive/axial-cinematic-video/script.md`: an ordered list of segments, each a slice of a take between two markers, with optional punch-ins (the footage is 2× density, so up to 2× stays sharp) and captions keyed to markers. Lines of the script are set large over the board (`Title`); control and feature labels use the game's pill styling (`Caption`), both in the game's typeface. The game's sounds play at each move's landing and at the win reveal.

Segments are built with `shot(take, from, to, options, build)`. `options.beats` retimes a shot against the take's own frames (`{ source, rate }` changes speed from a source frame; `{ freeze, seconds }` holds a freeze frame), and `build` gets `local()`, which maps a source frame to the frame where it appears after retiming, so cues and pushes stay on their actions. `Shot` also does impact pulses (`kick`) and `hideChrome`, which keeps the game's top bar entirely out of frame; the edit's rule is that the top bar is either whole or gone, never cut in half. A win shot ends on its freeze frame, and `shot()` throws if one runs past the moment the game's result card appears. `Devices` shows a desktop take in a browser window beside the phone take.

## Music

`Music.tsx` cuts the track (130 bpm) on its bar grid and checks that the edit lands on it. The first drop
falls on the cut to the twists; 16 bars later the breakdown starts on the cut to the AI levels. The
breakdown is cut to four bars (its first two, then the two that build into the second drop), so the
second drop lands on the desktop-and-phone scene, which runs three bars. The track's outro plays
under the end card and fades out. Splices crossfade over six frames. If a change to the edit moves
one of those cuts off its bar, `checkMusicSync` throws with the frame the music wants.
