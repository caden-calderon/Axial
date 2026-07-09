# Axial Gameplay And Multiplayer Hardening

## Goal

Close the correctness gaps found in the July 2026 game audit without widening the milestone into a
new AI architecture, rendering overhaul, or multiplayer product expansion.

## Status

Completed on 2026-07-09. The implementation landed across the shared protocol, Durable Object room
state, online controller, local/AI controller, core rules, and committed Playwright coverage. It has
not been deployed in this lane.

## Scope

- Enforce the server-owned online start countdown.
- Let WebSocket and HTTPS fallback presence coexist without stealing the active socket identity.
- Reject stale client snapshots and ignore async network work from abandoned room sessions.
- Make room URLs reload-safe after create/join and clear them on explicit leave.
- Give `room:leave` unambiguous v1 semantics: expire the private room for both players.
- Restore the saved Local/AI mode accurately after reload.
- Make AI undo/redo operate at human decision points and never strand the game on an idle AI turn.
- Keep serious AI computation in the worker; use only a cheap legal move after worker failure.
- Fix expanded-board winning-line collection in `@axial/core`.
- Restore the Playwright quality gate and add focused regressions for each behavior.

## Architecture Decisions

### Presence

`activeConnectionId` represents only the current WebSocket. HTTPS fallback traffic refreshes a
short persisted lease instead. A player is publicly connected while either transport is healthy.
The Durable Object keeps one alarm and schedules it for the earliest of room expiry or an HTTP-only
presence lease deadline.

### Client network ordering

Room revisions are monotonic. A snapshot older than the accepted snapshot for the same room is
ignored. Async requests and socket callbacks also carry a controller generation so responses from a
room session that has been left or replaced cannot mutate current state. Fallback sync is
single-flight.

### Leave

Private rooms have no spectator or seat-replacement contract in v1. Explicit leave therefore
expires the room and notifies both players. While a room is active, the Local/AI selectors are
locked; users leave through the explicit room action instead of silently stranding a seat.

### AI history

In AI mode, undo rewinds to the previous human decision point. If an AI reply has completed, undo
removes the AI reply and the preceding human move as one unit; redo restores that unit. If the human
move is still awaiting its reply, undo removes only that move. Any resulting live AI turn schedules
the AI rather than leaving the board inert.

## Acceptance Criteria

- A move submitted before `match.playableAt` fails with a typed error and does not change revision or
  history.
- An HTTPS sync during a healthy socket session does not invalidate that socket.
- An HTTP-only player becomes disconnected after its lease expires; the room-expiry alarm remains
  scheduled correctly.
- Older or abandoned fetch/socket results cannot roll the UI backward or recreate a room after
  leave.
- Create/join writes `?room=CODE`; reload reconnects; explicit leave clears room intent and expires
  the room for the opponent.
- Saved AI mode renders as AI mode immediately after reload.
- AI undo/redo returns to complete decision points and never leaves an unscheduled AI turn.
- AI worker failure cannot run MCTS on the browser main thread.
- Winning-line lookup works at the outer edge of supported expanded boards.
- Unit, Worker integration, Playwright, type-check, lint, build, Wrangler type, and Worker dry-run
  gates pass.

## Verification

- `pnpm check`: passed with zero Svelte errors/warnings.
- `pnpm lint`: passed.
- `pnpm test:unit`: 125 tests passed across core (22), AI (39), Worker (11), and web (53).
- `pnpm --dir apps/web exec playwright test --reporter=list`: 8 tests passed, including the
  committed two-context multiplayer flow.
- `pnpm build`: passed; the known large game-route warning remains at 934.11 kB minified / 248.54
  kB gzip.
- `pnpm --filter @axial/multiplayer-worker exec wrangler types --check`: generated types are current.
- `pnpm deploy:multiplayer:dry-run`: passed at 73.88 KiB / 15.30 KiB gzip.
- `git diff --check`: passed.
