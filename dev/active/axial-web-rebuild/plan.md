# Axial Web Rebuild Plan

## Direction

Make Axial a polished browser-native strategy game. The active screen should remain the playable 3D board with compact controls, clear game state, and excellent visual readability.

Near-term priority: validate the first online multiplayer foundation on real desktop/phone clients.
The implementation covers private friend-vs-friend Classic rooms in the main 3D game route with
short join codes, invite links, QR images, player names, server-authoritative move validation,
robust reconnects, and clear network/error states. Portfolio bridge production setup is paused for
now.

Classic-mode AI remains an important future lane. The target is an AI opponent that can beat Caden, and the current recommendation is documented in `dev/active/axial-web-rebuild/classic-ai-research.md`.

## Current Architecture

- `axial-web/apps/web`: SvelteKit + TypeScript app with Three.js/Threlte rendering.
- `axial-web/packages/core`: pure TypeScript rules package.
- `axial-web/packages/ai`: pure TypeScript AI move-selection package.
- `axial-unity`: preserved Unity version.
- Production deployment target: Cloudflare Pages at `https://playaxial.dev`, with Porkbun kept as registrar and Cloudflare used as authoritative DNS.

Important boundaries:

- Keep game rules in `packages/core`, independent of Svelte/DOM/Three.
- Keep AI move selection in `packages/ai`, independent of Svelte/DOM/Three.
- Keep UI in `apps/web/src/lib/game/ui`.
- Keep 3D/rendering in `apps/web/src/lib/game/scene`.
- Keep scene palette metadata in `apps/web/src/lib/game/theming`.
- Keep controller/persistence/replay orchestration in `apps/web/src/lib/game/state`.
- Keep heavy visual dependencies out of the page controller. Classic MCTS should run through the
  worker in normal play, with any main-thread fallback loaded dynamically.
- Avoid broad visual dependency barrels when the app only needs a few Three helpers; prefer local
  scene helpers or explicit Three example modules when that keeps the bundle shape clearer.
- Keep the top-right status panel shell small. Match setup, appearance controls, tactical loadout
  details, and session stats should live in focused UI section components rather than one large
  mixed markup file.
- Keep portfolio integration code behind an explicit embed/bridge boundary. The portfolio site
  should not depend on Svelte component internals, controller runes, Three scene objects, or local
  storage details.
- Keep multiplayer authority out of the frontend. The web app may predict/render optimistically, but
  the room service owns canonical turn order, moves, match settings, player seats, reconnection, and
  conflict resolution.
- Keep the first multiplayer backend as a separate worker app/package, likely
  `axial-web/apps/multiplayer-worker`, with `@axial/core` as a shared dependency. Avoid mixing room
  server code into Svelte route components.
- Keep shared multiplayer protocol types in `axial-web/packages/multiplayer-protocol`; this avoids
  web/worker drift while keeping Cloudflare and Svelte dependencies out of the protocol layer.

## Active Implementation Choices

- WebGL game route disables SSR at the page boundary; do not leak Three/Threlte imports into server-executed code.
- Online multiplayer is integrated into the WebGL game route. The right control panel exposes
  Local, AI, and Online modes; Online reuses the existing 3D board for rendering/animation while the
  room service remains authoritative. Legacy `/room` and `/room/[code]` routes are compatibility
  redirects into `/?online=1` and `/?room=CODE`.
- `axial-web/apps/multiplayer-worker` owns canonical multiplayer state. It uses a Cloudflare Worker
  entrypoint plus one SQLite-backed Durable Object per 8-character room code, validates Classic
  moves through `@axial/core`, stores reconnect-token hashes, uses hibernatable WebSockets, and
  returns full private snapshots on reconnect/resync. Production routes are same-origin:
  `playaxial.dev/api/rooms*` and `playaxial.dev/health`.
- WebSocket remains the preferred online transport, but HTTPS sync/command fallback is treated as a
  healthy transport when it is succeeding. The UI should only surface reconnecting when both
  transports have gone stale long enough to matter to a player.
- Undo/redo/replay use canonical row/column move history and `replayMoves`.
- Control UI is an acrylic top-right panel that expands downward with stable width/radius.
- Expanded controls are organized as a match console: live state, Match, Appearance, and Session.
  The panel body is split into focused section components while the shell owns expansion and
  toolbar mode state.
- Match setup exposes Local, AI, and Online modes, pre-match `Classic`/`Tactical` rules, board
  dimensions, win rules, and AI difficulty. Online v1 is Classic-only; Tactical multiplayer remains
  locked out in the UI until explicitly scoped.
- Tactical mode currently has a fixed three-piece kit per player: two Blocker Combos and one Double Adjacent.
- Tactical sub-actions are replay-visible with special metadata so undo/redo and future AI training can reconstruct same-player continuations.
- Tactical actions are exposed through a `Pieces` mode in the top-right control pill; the dropdown shows either normal setup/status or piece details depending on whether Pieces mode is active.
- The centered desktop turn pill is a status-only chip with no arrow/expansion affordance; Tactical piece actions live in the top-right Pieces toolbar mode.
- Desktop control pills share the centered turn pill's full-height acrylic scale, while mobile keeps the tighter compact control height.
- Game-over modal actions distinguish `New match`, `Review from start`, and `Keep board`.
- Classic AI uses difficulty-aware minimum visible thinking time in addition to its worker search
  budget: Easy stays brisk, while Max waits long enough to feel deliberate even when the worker
  finds a fast obvious move. Larger boards scale Max's worker budget by board breadth/height, and
  true tactical forks are enforced before MCTS simulations. Softer non-terminal line-race
  heuristics still search, but immediate win, immediate block, own fork creation, and opponent fork
  prevention are treated as tactical root decisions.
- Classic MCTS combines UCT, RAVE, threat-ordered expansion, smart rollouts, and progressive bias.
  Progressive bias uses the fast heuristic move ranking as a decaying prior during child selection,
  with stronger difficulty presets passing larger bias values.
- Classic MCTS also uses bounded alpha-beta tactical lookahead for the stronger presets. The
  lookahead layer evaluates tempo-aware immediate threats, fork moves, center/shape, and multi-line
  race pressure; MCTS consumes it as a root prior and Max/Hard can let it override noisy rollout
  results when the deterministic score gap is large enough.
- Classic AI multi-line evaluation must mirror core maximal-line semantics: a longer contiguous run
  is one line, not multiple overlapping length-N windows. Segment-level heuristics can rank threats,
  but completed segment windows inside an already-completed maximal run should not count as extra
  line progress.
- RAVE should remain scoped to AMAF value estimates: blend AMAF with exploitation, then add
  exploration/progressive bias; update each node only from moves played after that node.
- Appearance setup includes exact board-grid color, piece shape, separate per-player gradient color
  pills, light/dark mode, axis-number visibility, grid-layer visibility, and click-to-confirm drop.
- Click-to-confirm is controller-owned board input state: first click arms a move, clicking a
  different column re-arms, and clicking the armed column commits. The scene receives the active
  preview plus a locked flag for the staged-column animation. The armed preview uses a tall,
  tapered beam and cell-sized square floor plate; preview meshes render above the grid so floor
  lines do not read as stripes through the piece. The beam begins just above the floor plate so it
  does not pierce the marker, and its contrast/pulse are tied to the same animation phase as the
  preview piece and square plate.
- Grid-layer visibility is a scene preference. Full cube grid remains default; floor-only mode
  swaps to reduced floor geometry while axis labels remain controlled only by the axis-number
  toggle. Axis labels stay mounted while hidden and live outside the grid remount key so toggling
  grid layers/axis numbers does not reset their camera-facing visibility state.
- Board color is live and persisted. Piece shape and player colors are pre-match loadout settings:
  they are editable on a fresh board, then locked after the first placed piece until
  `New match`/reset.
- Opponent mode and match rules are also pre-match setup choices and lock after the first placement.
- Board dimensions are pre-match setup choices. The baseline is 6 x 6 x 7, each dimension can be
  increased up to 10, and dimension changes reset only a fresh board; active/review boards stay
  locked.
- Win rules are pre-match setup choices for both Classic and Tactical: players can choose connect 4 or connect 5, and require 1, 2, or 3 completed lines to win. The core game snapshot carries the selected win condition so replay, undo/redo, and AI evaluate the same rules.
- Completed lines are first-class visual state during active play. They should be recomputed from board ownership, keyed with stable IDs, and rendered as persistent in-board markers so multi-line modes communicate progress before the final win.
- Result overlays should not interrupt critical board-state animation; after a winning line appears, the game-over modal waits for the completed-line draw/settle timing before opening.
- Result overlays should feel like part of the win sequence: the modal uses a short backdrop/dialog
  entrance animation and aligned action buttons after the completed-line delay.
- The SvelteKit app now uses `@sveltejs/adapter-cloudflare` directly instead of `adapter-auto`; Cloudflare Pages build settings, DNS notes, release workflow, and production smoke checklist live in `dev/active/axial-web-rebuild/deployment.md`.
- The game shell disables browser text selection to preserve a game-like interaction feel.
- Mobile app-like play is supported through PWA install metadata and a fullscreen toolbar control where the browser exposes the Fullscreen API.
- Mobile/touch breakpoints should key off coarse-pointer capability as well as viewport width so
  phone landscape does not accidentally adopt desktop HUD/pill sizing.
- Active match recovery should preserve canonical replay progress first. Renderer recovery can
  remount the Three/Threlte scene, but the source of truth remains controller/core game state and the
  autosaved replay payload.
- Portfolio embed mode should be opt-in, probably through `?embed=1&bridge=1`. Embedded play can
  reuse the same controller/game state, but bridge concerns should live in focused modules such as
  `apps/web/src/lib/game/bridge/protocol.ts`, `stateSnapshot.ts`, and a Svelte/browser-side bridge
  lifecycle helper instead of being scattered across page markup.
- The bridge contract should be versioned and semantic. Axial-to-host messages should include
  `axial:ready`, `axial:state`, `axial:ack`, and `axial:error`. Host-to-Axial messages should start
  with safe commands only: `axial:get-state`, `axial:set-settings`, and possibly `axial:new-game` /
  `axial:set-rules` if the portfolio UX needs them.
- The portfolio LLM does not need to make moves. The existing worker-backed MCTS remains the actual
  AI opponent. Avoid adding host-controlled move commands unless a later product requirement
  clearly needs them.
- Bridge state snapshots should be compact but useful for narration: match mode/status, current
  player, winner, move count, dimensions, win condition, last move, move history, settings, and
  eventually threat summaries or immediate winning moves. Any threat summary should come from pure
  core/AI helpers, not ad hoc DOM/scene inspection.
- Bridge commands must validate payloads, respect match locks, and return explicit errors for
  unsupported or unsafe requests. A request to change rules after the first move should fail or
  require a deliberate new-match command; a request to lower AI difficulty/theme/grid/labels can be
  applied live if current controller rules allow it.
- Iframe security should be intentional before public portfolio use: configure `frame-ancestors`
  for `'self'` plus the portfolio origin once known, do not rely on `X-Frame-Options`, validate
  `event.origin`, never use `*` as `targetOrigin` after handshake if an origin is known, and ignore
  malformed messages without mutating game state.
- Desktop turn pill is independent from the AXIAL wordmark and fixed-width at top center, with a
  shorter pill width and larger status text than the first centered version.
- The AXIAL wordmark, board-dimension HUD text, and centered desktop turn pill use a synchronized
  subtle sequential glyph glow tied to the active board accent.
- Mobile keeps controls smaller, tucked top-right, and hides the turn pill.
- Variant mode design is tracked in `dev/active/axial-web-rebuild/variant-modes.md`; classic rules remain the default.

## Portfolio Bridge V1 Architecture

Decision for the first implementation pass:

- Bridge activation is explicit and browser-only: Axial starts the bridge only when loaded in an
  iframe with `?embed=1&bridge=1`. Normal `https://playaxial.dev/` behavior remains unchanged.
- The bridge contract is a versioned `postMessage` envelope with `source`, `version`, `id`, `type`,
  and optional `payload`. Axial emits `axial:ready`, `axial:state`, `axial:ack`, and `axial:error`.
  The host can send `axial:get-state` and `axial:set-settings` in v1.
- V1 deliberately excludes host-controlled board moves, rule changes, and new-match commands. Those
  can be added later with explicit product approval and separate reset/staleness semantics.
- State snapshots are semantic data derived from the controller and `@axial/core` snapshots:
  match mode, status, opponent mode, bridge-facing AI difficulty, current player, winner, move
  count, dimensions, win condition, last move, move history, settings, lock flags, AI thinking, and
  a compact threat summary from pure core move simulation.
- Move coordinates in the bridge are one-based row/column/layer values for narration. The bridge
  does not expose board arrays, local-storage payloads, Threlte/Three objects, or Svelte runes.
- `axial:set-settings` accepts only safe presentation/setup fields: theme, labels, grid layers,
  confirm drop, board color, opponent mode, and AI difficulty. Live presentation changes can apply
  during a match. Opponent mode and AI difficulty continue to respect the existing setup lock.
- Payload validation happens before mutation. Invalid payloads or locked setup changes fail the
  whole request and return a typed error without partial application.
- Origin security defaults closed for external sites. The bridge always allows same-origin parent
  pages for local/static smoke tests and reads additional allowed origins from
  `PUBLIC_AXIAL_BRIDGE_ORIGINS`. Until Caden provides the portfolio origin, production external
  portfolio control should remain disabled.
- Initial `axial:ready` uses the iframe referrer origin only if that origin is allow-listed. Replies
  use the exact trusted `event.origin`; untrusted origins are ignored without mutating state.
- Tests should cover protocol validation, origin allow-list behavior, snapshot serialization,
  locked-setting errors, same-origin iframe ready/get-state/settings flow, malformed payload errors,
  and an untrusted external parent receiving no response.
- 2026-06-09 implementation status: v1 is implemented in `apps/web/src/lib/game/bridge/` and wired
  from `apps/web/src/routes/+page.svelte`. The same-origin iframe harness lives at
  `apps/web/static/embed-bridge-smoke.html`, with Playwright coverage in
  `apps/web/e2e/bridge.e2e.ts`. The remaining production release decision is the real portfolio
  origin for `PUBLIC_AXIAL_BRIDGE_ORIGINS` and the matching `frame-ancestors` policy.

## Multiplayer Architecture Direction

Planning doc: `dev/active/axial-web-rebuild/multiplayer.md`.

Initial recommendation:

- Use a Cloudflare Worker as the public API/WebSocket entrypoint and a Durable Object class as the
  room coordinator. Cloudflare's Durable Objects are designed for stateful coordination across
  clients, including multiplayer-style room coordination, and the WebSocket Hibernation API should
  be preferred so idle WebSocket rooms can sleep without disconnecting clients.
- One room code maps to one Durable Object instance. The object stores room metadata, players,
  reconnect tokens, canonical game snapshot, move log, event revision, ready/rematch state, and any
  spectator presence.
- The server validates every move with `@axial/core`; clients never submit or decide canonical board
  state.
- Every accepted command increments a monotonic `revision`. Clients can reconnect with
  `roomCode`, `playerId`, `reconnectToken`, and `lastSeenRevision` so the room can resend a full
  snapshot or a bounded event catch-up.
- Start with Classic mode only unless Caden explicitly wants Tactical online in v1. Tactical
  special sub-actions make the protocol and turn-continuation rules more complex.
- Design protocol messages before implementation. Commands should include `create-room`, `join`,
  `set-name`, `set-rules`, `ready`, `play-move`, `resync`, `rematch`, `leave`, and optional
  `spectate`. Server events should include `room-snapshot`, `player-joined`, `player-updated`,
  `match-started`, `move-accepted`, `move-rejected`, `player-disconnected`, `player-reconnected`,
  `game-ended`, `rematch-state`, `room-expired`, and `error`.
- UX states should be explicit: creating, joining, waiting, ready, starting, playing, reconnecting,
  resyncing, opponent disconnected, ended, expired, and fatal error.
- Reconnect design is a first-class feature, not polish. Store a per-seat secret reconnect token in
  local storage/session storage, allow a grace period for mobile sleep/refresh, and prevent a second
  tab or attacker with only the public room code from taking over a seat.
- Plan for observability and supportability: typed error codes, reason strings suitable for UI, and
  small structured logs around room creation, join failures, reconnect failures, and move rejection.

## Near-Term Priorities

1. Run the live desktop/phone manual smoke on a clean DNS path: open `https://playaxial.dev`, choose
   Online on desktop, create a private room, open the `https://playaxial.dev/?room=CODE` invite on
   phone, ready both players, make a server-validated 3D-board move, refresh one client, and confirm
   reconnect/resync.
2. If the current CSU/HFS Wi-Fi still resolves `*.playaxial.dev` to `65.52.200.44`/`::1`, switch
   the test device to cellular or DNS `1.1.1.1`/`8.8.8.8` before debugging application behavior.
3. Harden the multiplayer foundation with a committed two-browser Playwright e2e smoke, mobile sleep
   manual pass, and production-route smoke from a clean DNS/network.
4. Continue protocol/UI polish only inside the v1 scope: private Classic rooms, reconnect, resync,
   rematch, typed errors, QR/link handling, and the compact integrated sidebar. Keep Tactical,
   public matchmaking,
   accounts, chat, ranking, and host takebacks deferred.
5. Confirm the portfolio origin and configure `PUBLIC_AXIAL_BRIDGE_ORIGINS` plus the production
   `frame-ancestors` header only when the portfolio bridge becomes active again.
6. Continue the cleanup audit in `apps/web/src/lib/game`, `packages/core`, and `packages/ai` for dead code, duplicated logic, stale helpers, and component boundaries that should be cleaned before more features land. The first web UI pass removed the unused `@threlte/extras` dependency, split the status panel into focused sections, and trimmed a stale controller getter.
7. Treat the remaining large Three.js/Threlte chunk warning as measured and acceptable for now: the 2026-06-07 cleanup removed accidental `@threlte/extras` and normal-path `@axial/ai` imports, reducing the client page chunk from `993.16 kB` minified / `273.01 kB` gzip to roughly `833 kB` minified / `216 kB` gzip after the follow-up section split. Revisit code-splitting when Axial gains a non-game first route, an intentional loading shell, or graphics-quality tiers.
8. Keep refactors behavior-preserving unless Caden explicitly asks for gameplay changes in the same area.
9. Add progress messages for longer Classic AI searches.
10. Extend the seeded evaluation harness with larger random/greedy/heuristic/basic-MCTS benchmark suites and JSONL-style match logs, including expanded board sizes, connect-5, and 2-3-line win targets.
11. Tune the TypeScript heuristic/MCTS/lookahead engine against those benchmarks and direct Caden
   challenge games. First benchmark target after the 2026-06-07 fork/lookahead fixes is to measure
   tactical-suite pass rate and latency across 6 x 6 x 7 through 10 x 10 x 10 boards, including
   connect-5 and 2-3-line win conditions.
12. Consider a dedicated benchmark CLI/script once match logging shape is clear.
13. Keep the old Python MCTS runnable only as a reference/baseline through the root `uv` environment.
14. Add PyTorch/training dependencies only when neural self-play work resumes.
15. Treat AlphaZero/PyTorch/ONNX as a later measured upgrade once the teacher/evaluation harness can prove neural guidance improves strength.
16. Benchmark and tune Classic AI latency/strength on expanded board sizes now that search geometry is dimension-aware.
17. Keep Tactical/special-piece AI deferred until Classic-mode AI is locked.
18. Add editable loadout UX for choosing the three Tactical specials when returning to Tactical polish.
19. Keep the production deploy loop healthy with local checks, Cloudflare deployment review, and production smoke tests before/after significant changes.

## Testing Expectations

For UI/visual changes:

- Run `pnpm check`.
- Run `pnpm lint`.
- Run `pnpm build`.
- Use Browser plugin if its required runtime is exposed.
- If Browser plugin runtime is missing, say so and use local Playwright screenshots.

For portfolio embed/bridge changes:

- Add protocol/serialization unit tests for state snapshots, payload validation, and command
  handling.
- Add a browser/e2e smoke with a parent page or test harness iframe that verifies `ready`,
  `get-state`, settings changes, ack/error replies, and origin rejection.
- Run `pnpm check`, `pnpm lint`, `pnpm build`, and focused web tests from `axial-web/`.
- Before production release, verify response headers for `playaxial.dev` and the portfolio origin's
  ability to iframe the app.

For multiplayer changes:

- Add worker/protocol unit tests for room lifecycle, payload validation, move validation,
  reconnect/resync, duplicate-tab behavior, and typed errors.
- Run package-specific Worker checks once `apps/multiplayer-worker` exists.
- Add a two-browser-context Playwright smoke for create/join/name/ready/move/reconnect once the web
  client is wired.
- Run `pnpm --filter @axial/core test:unit` when server move validation touches core behavior or
  depends on new core exports.

For game-core changes:

- Also run `pnpm --filter @axial/core test:unit` from `axial-web/`.
- Add focused tests when rules, replay, undo/redo, or serialization change.

For AI changes:

- Run `pnpm --filter @axial/ai test:unit` from `axial-web/`.
- Run web checks if controller/UI integration changes.

## Deferred Work

- Training pipeline cleanup.
- Neural model export/inference.
- Hand tracking.

Older architecture details are archived in `dev/active/axial-web-rebuild/archive/2026-05-26-background.md`.
