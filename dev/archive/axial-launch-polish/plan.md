# Axial launch polish: plan

Status: complete, 2026-10-22. Two commits on `main`, both deployed (Worker and Pages):

- `81ed3d6` Fix launch blockers in online play, piece rendering and mode switching
- `c3d55c7` Add in-game feedback and a draggable phone settings sheet

## Why

The night before the public announcement, Caden hit a bug in an online match: the opponent switched their piece look from cube to orb mid-match, and one of Caden's pieces lost its body. That started a bug-hunting pass across online, local and AI play on all platforms. Caden then asked for two additions found while playtesting on a phone: drag the settings sheet to full height, and a way for players to report bugs or leave reviews.

## Bug hunt (`81ed3d6`)

Root cause of the reported bug: Threlte's `useAttach` restores a mesh's previous geometry when a child geometry unmounts, so swapping `<T.BoxGeometry>`/`<T.SphereGeometry>` inside one `<T.Mesh>` with `{#if}` left an empty `BufferGeometry`. Fix: `{#key shape}` around the whole mesh in `GamePiece.svelte` and `DropPreview.svelte`. Separately, appearance is now locked during a live online match (`appearanceLocked` in the online controller).

Other fixes in the same commit:

| Area          | Fix                                                                                                                                                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Online        | Ready carries the rules the guest saw; the server rejects with `rules-changed` if the host changed them. Start requires both players connected.                                                                                               |
| Online        | Heartbeat ping/pong (15 s, 6 s deadline) and resync deadline, so a silently dead socket or a locked phone recovers without pressing Resync. Resume checks on `visibilitychange` and bfcache `pageshow`.                                       |
| Online        | A second tab of the same room asks over BroadcastChannel before taking the seat, and a displaced tab no longer clears the other tab's credentials on Leave.                                                                                   |
| Online        | Leave during a live match asks for confirmation; the other player sees "<name> left the room" (`leftByPlayerId`). Double-tapping Join no longer fills the room.                                                                               |
| Online        | Network and non-JSON failures read as plain sentences; clipboard failures are handled.                                                                                                                                                        |
| Modes         | Switching Local/AI while a match is locked resumes the AI instead of stalling. Saved Tactical matches no longer restore (Tactical is Coming soon).                                                                                            |
| Local/AI      | Undo is disabled when the only move is the AI's opener. Undoing a finished game withdraws its session result.                                                                                                                                 |
| Phones        | Audio unlock retries on every gesture (iOS); no tap highlight over the board.                                                                                                                                                                 |
| Desktop/embed | Tall desktop windows use portrait framing. In the portfolio embed the wheel scrolls the host page unless Ctrl/Cmd is held. The drop preview follows the cell under a still cursor after wheel zoom. The drop preview pulse settles after 6 s. |

Protocol additions are backward compatible in both deploy orders.

## Feedback and phone sheet (`c3d55c7`)

- **Feedback**: see [feedback.md](feedback.md) for the design, spam protection and Cloudflare setup. It replaced the Reset view quick action at Caden's request.
- **Phone sheet**: a grab bar at the bottom of the portrait settings sheet (`GameStatusPanel.svelte`). Drag follows the finger; release snaps to the nearest of collapsed, half and full, or one stop past the starting state on a flick (0.45 px/ms, ignored if the finger rested for 120 ms). Tap toggles half and full, so keyboard and screen-reader users keep the old Full sheet behavior under the same accessible name. The hit area is the 44 px coarse target with negative margins.

## Verification

Check, lint, all unit suites and the full Playwright suite before each commit (`tutorial-glow` is timing-sensitive under full-suite load and passes alone). New coverage: `feedback.test.ts` (Worker), `feedback.e2e.ts` (form, failure path, backdrop, drag), plus additions to the online controller, game controller, audio, camera and room tests. Production smoke after deploy. Caden confirmed feedback email delivery and the sheet drag on his phone. The bug-hunt fixes also have a manual device checklist (two-phone online play, iPhone audio, embed scrolling) that Caden runs on real hardware.

## Deferred

Known, low impact, not fixed before launch:

- A client clock more than about 30 s off can block the rematch button.
- No per-command rate limit inside a room.
- Reconnect tokens travel in the WebSocket URL, so they can appear in edge logs.
- Touch swipes over the portfolio embed don't scroll the host page.
- A Join whose response is lost can still consume the seat.
- The AI's transposition table stores bounds as exact scores (search quality, not correctness of play).
- The bridge's `axial:ready` isn't sent when there is no referrer.
- Turnstile refuses DevTools-driven browsers, so the live feedback path can only be tested by hand; e2e stubs the Turnstile script.
