# Axial overview video: tasks

## Recorder

- [x] Virtual clock owning rAF, timers, Date, CSS/Web Animations.
- [x] Real-input recorder with cursor/finger overlay, markers, previews.
- [x] Dev-only aim probe in `ColumnPicker` verified against the game's own picking.
- [x] Web-app gates after the probe: check 0/0, lint, 162 web unit tests, production build; `__axialScene` absent from the build output.

## Takes

- [x] ~~desktop-intro (welcome card, Skip)~~ dropped: Caden called the tutorial-card opener lazy
- [x] desktop-reveal (front view reads as a Connect 4 rack, drop, orbit reveals depth; position from stage-reveal.ts)
- [x] desktop-modes (Local → Online → AI, four levels, a move, the AI's reply)
- [x] desktop-controls (aim, drop, AI reply, orbit, zoom)
- [x] desktop-match (restored local match: blocks, fork, staircase win, result)
- [x] desktop-settings (AI levels, board growth, connect five, lines)
- [x] desktop-bigboard (9x9x9 connect-five finish, Keep board, look around)
- [x] desktop-multiline (three-line race finish, Keep board, look around)
- [x] phone-play (tap to aim, Drop, AI, finger orbit, settings sheet)
- [x] Full-quality recordings (moves logged for sounds; controls and match re-recorded for that)

## Edit

- [x] Remotion `Overview` composition (shots, punch-ins, captions, phone scene, end card)
- [x] First render (56.6 s, 1080p60, game sounds); review fixes; sent to Caden
- [x] Script draft 3 agreed with Caden (`script.md`)
- [x] Cut 2 to the script (53.2 s): Title component, end card over the final board; sent to Caden
- [x] Game sounds on landings and win reveals (rendered from the shipped audio module)
- [x] Cut 3 (draft 4 of the script): fresh-context review; retiming (speed ramps, freeze frames), landing burst, slam titles, zoom-through cuts, impact pulses; re-recorded reveal (axis numbers off), controls and phone on matches under way; new desktop-ai take (the AI blocks a threat); desktop-and-phone scene; 5 s end card
- [x] Cut 4 (script draft 5): twists set up in the settings and cut to their payoffs; top bar whole or gone; no flashes or zoom-throughs; win shots end on their freeze before the result card; Max wins as the AI beat (new `desktop-twists`, `desktop-ai`, `stage-ai-win.ts`)
- [x] Cut 5 (script draft 6, 50.3 s): big-board take re-recorded (panel closed off camera, slow turn, side-on swing after the winning drop); Max-wins scene cut; one-colour wordmark with a shine on the end card
- [x] Cut 6 (53 s): settings clicks and the levels given room, slower wordmark shine, title scrims and shadows removed
- [x] Cut 7 (54.2 s): softer UI shadows in recordings (twists, modes re-recorded); more time on the Connect 5 and Lines clicks
- [x] Music: "A Solitary Pulse" conformed on its bar grid (`Music.tsx`, cut 8)
- [x] Caden approved cut 8 with the music (2026-10-20); it's the final cut (54.7 s; readability won over the old ~45 s target)
- [x] ~~30 fps derivative for X; 9:16 version~~ dropped: X takes 60 fps, and Caden is happy with 16:9 everywhere
- [x] README for the new workflow
