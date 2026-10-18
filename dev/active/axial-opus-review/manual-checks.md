# Manual checks for the Opus review changes

Run the branch locally (`cd axial-web && pnpm build && pnpm preview --host 127.0.0.1`) or a preview deploy. Each item is one visible change.

## Desktop

- [ ] The board sits a little higher on load; every floor number (X 1–7, Y 1–6) is fully on screen at your usual window size.
- [ ] Height numbers 1–6 stand on the board's left edge, not across the middle of a crowded board; orbiting fades them to the new left edge.
- [ ] After a drop, the preview piece reappears under a resting mouse without moving to another cell.
- [ ] Against the AI, no preview follows the mouse while it is thinking.
- [ ] Pointing at a piece in a tall stack previews and drops into that stack's column.
- [ ] The newest piece pulses for a couple of seconds after landing, then keeps a steady glow.
- [ ] The first move and the winning line play without a hitch; so does the first move of the next match.
- [ ] The turn chip keeps showing the turn while the winning piece falls and its line draws, then says who won.
- [ ] Keyboard: orbit about half way round, then Right still moves the cursor right on screen.
- [ ] Pieces (cube and orb) and the grid layers look the same as before (glass transmission removed).
- [ ] Hard and Max sometimes take their full thinking time when blocking a fork, where they used to answer instantly. Decide whether that trade is right.

## Phone (portrait)

- [ ] On load, the HUD and tour appear before the board (the board follows a moment later).
- [ ] Win a match, tap "Review match": a Review bar shows "Move 0 of n" with Back/Next; stepping to the end brings the result back.
- [ ] Bottom bars (confirm drop, review, practice) sit clear of the home indicator.
- [ ] The welcome tour title reads "This is Axial" with single spaces.
- [ ] Entering and leaving the tour practice doesn't flash or reset to a black canvas.

## Landscape phone

- [ ] All floor numbers are on screen; height numbers on the left edge.

## Other

- [ ] An unknown URL (e.g. `/nope`) shows the "This square isn't on the board" page with a Play Axial link (status 404).
- [ ] Online: a move sent right after the opponent reconnects is accepted, not bounced.
