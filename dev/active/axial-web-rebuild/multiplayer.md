# Axial Online Multiplayer Plan

## Goal

Add a polished online friend-vs-friend mode for Axial without weakening the current local/AI game.
Players should be able to create a private lobby, share a short join code/link/QR code, set display
names, choose rules before the match starts, play a server-validated match, survive refreshes and
mobile connection drops, and rematch cleanly.

This is a major architecture feature. Plan the protocol and room lifecycle before implementation.

## Product Shape

First MVP:

- Private room creation from the web app.
- Short room code, copy invite link, and QR code.
- Join-by-code and join-by-link flows.
- Player display names with length/content validation.
- Host-controlled pre-match rules:
  - Classic mode first.
  - Board dimensions.
  - Connect length.
  - Lines to win.
- Player ready flow before the match starts.
- Server-assigned seats: Player 1 / Player 2, with random/swap option later.
- Server-authoritative moves and winner/draw detection.
- Explicit connection states in UI.
- Automatic reconnect after refresh, mobile sleep, network change, or transient server restart.
- Rematch after game over.

Do not include in v1 unless explicitly pulled in:

- Tactical special-piece multiplayer.
- Public matchmaking.
- Accounts/auth.
- Ranked stats.
- Chat.
- Host-controlled takebacks.
- Cross-room spectator directory.

## Architecture Decision

Use a separate Cloudflare Worker plus Durable Objects room service.

Rationale:

- A multiplayer room needs one authoritative coordinator for turn order, move validation, reconnect
  tokens, player presence, and event ordering.
- Cloudflare Durable Objects are intended for stateful coordination among multiple clients, including
  chat/collaboration/multiplayer-style workloads.
- Durable Objects can act as WebSocket servers, and Cloudflare recommends the Hibernation WebSocket
  API for cost-efficient idle connections.
- Keeping the room service outside the Svelte app preserves the current frontend architecture and
  lets the server import `@axial/core` without pulling WebSocket/server code into the game route.

Suggested package layout:

```text
axial-web/
  apps/
    web/
    multiplayer-worker/
      src/
        index.ts
        roomObject.ts
        protocol.ts
        roomState.ts
        validation.ts
        roomCodes.ts
      test/
        roomObject.test.ts
      wrangler.toml
```

Shared packages:

- `@axial/core`: canonical rules, replay, move validation, win detection.
- `@axial/multiplayer-protocol`: a small pure TypeScript protocol package shared by the Worker and
  web route so command/event envelopes, serializable snapshots, room errors, and credentials do not
  drift.

### 2026-06-18 MVP Architecture Lock

The first implementation landed as:

- `axial-web/apps/multiplayer-worker`: standalone Cloudflare Worker app.
- `axial-web/packages/multiplayer-protocol`: shared protocol/types only; no Cloudflare, Svelte, or
  Three dependencies.
- Durable Object binding: `AXIAL_ROOM`.
- Durable Object class: `RoomObject`.
- Wrangler config: `wrangler.jsonc` with `compatibility_date` set to `2026-06-18`,
  `nodejs_compat`, observability enabled, and `new_sqlite_classes` migration for `RoomObject`.
- Local/prototype API shape:
  - `POST /api/rooms` creates a private room and host credentials.
  - `POST /api/rooms/:code/join` joins the second player.
  - `GET /api/rooms/:code/socket` upgrades to the room WebSocket.
  - `GET /health` supports local smoke checks.
- Production route: mount the Worker under same-origin `https://playaxial.dev/api/rooms*` with
  `https://playaxial.dev/health` for smoke checks. This avoids CORS and keeps invite links on the
  public game domain. The web app still reads `PUBLIC_AXIAL_MULTIPLAYER_API` so preview/fallback
  endpoints can move without changing UI code.
- Web route shape:
  - `/` remains the playable game route and now exposes Local, AI, and Online in the existing setup
    sidebar.
  - Online mode uses the existing 3D board for rendering and routes moves to the room service.
  - Invite links use `/?room=CODE`; `/room` and `/room/[code]` remain as compatibility redirects to
    `/?online=1` and `/?room=CODE`.
  - Keep room networking in `src/lib/multiplayer` and the Worker package, not inside the local/AI
    controller.
- Room codes: 8 characters from a Crockford-style alphabet excluding ambiguous characters, displayed
  as `XXXX-XXXX`. This is still voice/share friendly while giving roughly 40 bits of invite entropy.
- QR payload: the canonical invite URL (`/?room=CODE`). The web sidebar renders a scannable QR image
  from that payload; the backend contract still only returns the payload/link.
- Initial seat policy: creator is host and Player 1, joiner is Player 2. Random first player and
  side swapping are deferred.
- Spectators remain deferred. A third valid browser tab for the same player uses the duplicate-tab
  policy below rather than spectator mode.

Implementation status:

- `@axial/multiplayer-worker` implements the HTTP and WebSocket room service.
- `@axial/multiplayer-protocol` shares command/event/snapshot/error types between worker and web.
- The main Svelte game route implements Local, AI, and Online modes in the existing sidebar and 3D
  board. `/room` and `/room/[code]` are legacy shims that redirect into the main route.
- Production Worker deployment is live as `axial-multiplayer`, current verified version
  `4a0f9b12-361c-4f1e-ae21-d4f2d7671514`, with routes `playaxial.dev/api/rooms*` and
  `playaxial.dev/health`.
- 2026-06-18/19 production hardening: WebSocket remains the preferred live transport, but the room
  service also exposes HTTPS fallback endpoints `POST /api/rooms/:code/sync` and
  `POST /api/rooms/:code/commands`. The web client starts fallback polling/commands when WSS cannot
  connect, so desktop browsers or networks that block WebSockets can still host, ready, play, and
  resync through the same server-authoritative Durable Object. Successful fallback traffic counts as
  a healthy connection; the UI only shows reconnecting when both transports have gone stale.
- 2026-06-19 integrated UI pass: Online mode now renders the authoritative snapshot through the
  existing Threlte board, places lobby/invite/QR/ready controls inside the main sidebar, and preserves
  the local/AI controller for offline play.
- QR payload, invite URL, copy button, and scannable QR image are available in the Online sidebar.

## Server Authority

The room service owns:

- Room code and room metadata.
- Player seats and reconnect tokens.
- Player names and presence.
- Host/ready state.
- Match settings before start.
- Canonical game state.
- Move log and room event log.
- Monotonic `revision`.
- Game over and rematch state.
- Room expiration.

The client owns:

- Rendering and animation.
- Input collection.
- Connection UI state.
- Local optimistic affordances, if any.
- Reconnect token storage.

The client never owns canonical board state in multiplayer. If a client prediction disagrees with
the room snapshot, the room snapshot wins.

## Room Lifecycle

1. `created`: host has a room code and reconnect token.
2. `waiting`: second player can join; host can configure allowed rules.
3. `ready`: both players have names and have pressed ready.
4. `playing`: moves are accepted only from the current player's active seat.
5. `ended`: winner/draw is final; rematch votes can begin.
6. `rematching`: players choose same rules or proposed tweaks later.
7. `expired`: room no longer accepts reconnects or commands.

Room expiry policy:

- Waiting rooms with no connected players expire after 15 minutes.
- Waiting rooms with at least one connected player can live for up to 6 hours.
- Active matches with no connected players expire after 2 hours. Active matches with at least one
  connected player stay alive and show opponent-disconnected state instead of forcing a v1 forfeit.
- Completed rooms expire 45 minutes after game over unless a rematch starts.
- The Durable Object stores room metadata, player seats, reconnect-token hashes, match settings,
  canonical replay/game snapshot, rematch votes, room event history, revision, and expiry metadata
  in SQLite-backed storage. In-memory state is a cache only.
- The Durable Object uses a single alarm per room to enforce expiry and reschedule the next expiry
  point after relevant mutations.

## Protocol Principles

Use versioned JSON envelopes.

```ts
type ClientCommand = {
  source: 'axial-client';
  version: 1;
  id: string;
  roomCode?: string;
  playerId?: string;
  reconnectToken?: string;
  lastSeenRevision?: number;
  type: string;
  payload?: unknown;
};

type ServerEvent = {
  source: 'axial-room';
  version: 1;
  id: string;
  revision: number;
  type: string;
  payload?: unknown;
};
```

Command families:

- `room:create`
- `room:join`
- `room:connect`
- `room:set-name`
- `room:set-rules`
- `room:ready`
- `game:play-move`
- `room:resync`
- `room:leave`
- `room:rematch-vote`

Server event families:

- `room:created`
- `room:snapshot`
- `room:player-joined`
- `room:player-updated`
- `room:player-disconnected`
- `room:player-reconnected`
- `room:rules-updated`
- `room:ready-updated`
- `game:started`
- `game:move-accepted`
- `game:move-rejected`
- `game:ended`
- `room:rematch-updated`
- `room:expired`
- `room:error`

Every accepted mutating command increments `revision`. Rejected commands should not mutate state and
should return a typed error.

For v1, reconnect always sends a fresh private `room:snapshot` after credentials are validated. The
room also keeps a bounded event log for tests, debugging, and later event catch-up, but the full
snapshot remains the correctness path because Axial snapshots are small.

## Reconnection Design

Room code is public. Reconnect token is secret.

On create/join:

- Server returns `playerId` and `reconnectToken`.
- Client stores them locally for that room.
- Reconnect tokens are seat-specific and not displayed in share URLs.

On reconnect:

- Client sends `roomCode`, `playerId`, `reconnectToken`, and `lastSeenRevision`.
- Server validates the token.
- If the event gap is small and available, server sends missed events.
- Otherwise server sends a full `room:snapshot`.
- If another socket is already active for that seat, server applies duplicate-tab policy.

Duplicate-tab policy:

- Latest valid socket wins for a player seat.
- The new socket receives a private snapshot after auth.
- The old socket receives a `room:error` with `duplicate-connection`, then closes.
- Do not allow a socket with only the room code to take a seat.
- Spectator mode can be added later for extra tabs.

Grace periods:

- Mobile sleep/refresh should not forfeit immediately.
- Show opponent disconnected with countdown/soft waiting state.
- Forfeit-on-timeout can be an optional later rule, not v1 default.

## Network And Error Handling

Client connection states:

- `idle`
- `creating`
- `joining`
- `connecting`
- `connected`
- `reconnecting`
- `resyncing`
- `opponent-disconnected`
- `expired`
- `fatal-error`

Server error categories:

- `invalid-message`
- `unsupported-version`
- `duplicate-connection`
- `room-not-found`
- `room-full`
- `invalid-name`
- `invalid-rules`
- `not-host`
- `not-your-turn`
- `illegal-move`
- `stale-revision`
- `auth-failed`
- `room-expired`
- `rate-limited`
- `internal-error`

Error responses should be safe for UI display but also structured enough for tests and debugging.

## Security

- Generate room codes with enough entropy for private invites.
- Keep room creation/join payloads tiny and bounded. Production rate limiting should be enforced at
  the Worker/Cloudflare route level before public launch; no global rate-limit Durable Object should
  be introduced in v1.
- Keep reconnect tokens secret and random.
- Store only reconnect-token hashes in Durable Object storage.
- Use timing-safe token verification.
- Validate all payloads before mutation.
- Clamp display names by length and render as text only.
- Reject HTML/control characters in names or normalize aggressively.
- Never trust client board state.
- Avoid logging reconnect tokens.
- Enforce an allow-list for browser HTTP/WebSocket origins when `ALLOWED_ORIGINS` is configured,
  while remembering that WebSocket origins are advisory and not a replacement for room/reconnect
  tokens.

## UX Ideas

Core:

- Online mode in the existing Match setup.
- Create room and join-by-code controls in the Online sidebar.
- Copy invite link.
- QR code join.
- Display names.
- Ready buttons.
- Clear seat labels and "waiting for friend".
- Connection pill for reconnecting/resyncing.
- Opponent disconnected state with calm copy.
- Rematch button.

Polish:

- QR code styled with the Axial cube mark.
- "Opponent joined" board pulse.
- Names floating near player indicators.
- Sound/vibration when it becomes your turn.
- Share final board/replay link.
- Best-of-3 room option.
- Rule preset chips: Classic, Connect 5, Bigger Board, Race to 2 Lines.
- Practice vs AI while waiting, only if it does not complicate room state.

Later:

- Spectator mode with independent camera.
- Rematch with rule tweaks.
- Swap sides/random first player.
- Optional turn timer.
- Friend disconnect can become "let AI take over" after a grace period.
- Replay export for future AI training/evaluation.

## Testing Plan

Worker/unit tests:

- Room code generation uniqueness/format.
- Create/join/name validation.
- Host-only rule changes.
- Ready/start transition.
- Legal move acceptance.
- Illegal/out-of-turn move rejection.
- Game over detection.
- Reconnect token validation.
- Duplicate-tab behavior.
- Revision/resync behavior.
- Room expiration.

Web/e2e tests:

- Two browser contexts create and join a room.
- Names appear for both players.
- Host sets rules before start.
- Both ready and match starts.
- Player 1 move appears for Player 2.
- Player 2 move appears for Player 1.
- Refresh one player and reconnect to same seat.
- Simulate network close and resync.
- Complete a short forced game if using a tiny test board or seeded room helper.
- 2026-06-19 ad hoc local smoke covered the integrated 3D route: host creates a room from `/?online=1`,
  guest joins on a mobile viewport through `/?room=CODE`, both ready, host makes a server-validated
  move on the 3D canvas, and both clients receive the revision/move update.

Manual smoke:

- Desktop to mobile via QR code.
- Mobile sleep/lock then reconnect.
- Copy invite link across browsers.
- Bad code, full room, expired room, and duplicate-tab UI.

## Cloudflare Work Needed

No Caden-side Cloudflare action is needed for design and local implementation.

Before production deploy, the project will need:

- A Worker app name.
- Durable Object binding and migration in `wrangler.toml`.
- Wrangler auth through `wrangler login` or a Cloudflare API token.
- A route decision:
  - mount under `https://playaxial.dev/api/rooms/*`, or
  - use a worker subdomain/custom domain while prototyping.
- Review of Workers/Durable Objects free-tier limits after the expected traffic shape is clearer.

Do not block architecture work on dashboard setup. Build locally first, then deploy once the protocol
and first room flow are passing.

## Primary Sources

- Cloudflare Durable Objects overview: https://developers.cloudflare.com/durable-objects/
- Cloudflare Durable Objects WebSockets best practices: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Cloudflare WebSocket Hibernation server example: https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/
- Cloudflare Durable Object lifecycle: https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/
