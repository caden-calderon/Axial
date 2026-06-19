# Axial Web Rebuild Context

## Mission

Axial is being rebuilt from the preserved Unity/Python project into a polished browser-native strategy game. The active app is `axial-web/apps/web`, using SvelteKit, TypeScript, pnpm, Three.js, and Threlte. The old Unity project remains in `axial-unity/`.

Current multiplayer status: the first robust online multiplayer foundation is implemented and the
room Worker is deployed on Cloudflare. It supports private Classic rooms with short room codes,
invite links, QR payloads, display names, host rules, ready flow, server-authoritative moves,
reconnect tokens, revision snapshots, duplicate-tab takeover, opponent-disconnected state, and
rematch. Production browser smoke from this machine is currently blocked by the local CSU/HFS
recursive DNS path returning stale/bad `*.playaxial.dev` records even though Cloudflare
authoritative DNS and Google DNS return the correct Cloudflare records.

Classic-mode AI remains an important future lane. Caden wants an AI opponent that can beat him as the benchmark. Tactical/special-piece AI remains deferred.

Research and architecture notes for the Classic AI direction now live in `dev/active/axial-web-rebuild/classic-ai-research.md`.

## Game Facts

- Board: 6 x 6 x 7, with 252 cells.
- Board dimensions now start at the 6 x 6 x 7 baseline and can be increased pre-match up to
  10 x 10 x 10 from the web setup panel. Dimensions lock after the first move or while redo
  history exists.
- Objective defaults to connect 4 horizontally, vertically, planar diagonally, or 3D diagonally.
- Active web rules now support pre-match win-condition variants for both Classic and Tactical: connect 4 or connect 5, with 1, 2, or 3 completed lines required to win.
- Legal moves: 42 surface columns `(row, col)`; gravity selects the first empty height.
- Core index formula: `idx = h + r * D + c * D * R`.
- Active web core lives in `axial-web/packages/core`.
- Baseline browser AI lives in `axial-web/packages/ai`.
- Serious AI target for the next phase is Classic mode only, not Tactical mode.

## Current Web State

The web app is playable and split into focused layers:

- `src/lib/game/state/`: controller, persistence, labels, undo/redo/replay orchestration.
- `src/lib/game/scene/`: Threlte scene, board grid, labels, pieces, previews, projected column picking.
- `src/lib/game/theming/`: scene palettes and selectable scene metadata.
- `src/lib/game/ui/`: HUD, status panel, game-over modal, scene selector.
- `packages/ai`: pure TypeScript AI move selection helpers.

Deployment state:

- Caden bought `playaxial.dev` through Porkbun.
- `https://playaxial.dev` is live on Cloudflare Pages.
- `https://playaxial.pages.dev` is the Pages preview/project URL.
- GitHub integration is enabled; pushes to `main` trigger production Cloudflare Pages deployments.
- The app uses the explicit `@sveltejs/adapter-cloudflare` adapter.
- The app has local PWA install metadata: manifest, Axial icons, iOS home-screen tags, and a SvelteKit service worker. Installed mobile launches should use browser app display modes instead of a normal tab when supported.
- Favicon/PWA icon assets use Caden's downloaded `AxialLOGO.png` app-icon render. The original
  source is preserved at `axial-web/apps/web/static/icons/axial-logo.png`; generated favicon,
  apple-touch, 192px, and 512px icons use a modest crop around the app-icon frame so the cube mark
  reads larger at small sizes. The old SVG icon assets are no longer referenced.
- Deployment notes and dashboard values live in `dev/active/axial-web-rebuild/deployment.md`.
- Porkbun remains the registrar, and Cloudflare is the authoritative DNS host with nameservers `gwen.ns.cloudflare.com` and `melnicoff.ns.cloudflare.com`.
- Production smoke can be run with `pnpm smoke:production` from `axial-web/`.
- Live multiplayer now has a separate Cloudflare Worker plus Durable Objects room service under
  `axial-web/apps/multiplayer-worker`, with shared protocol types in
  `axial-web/packages/multiplayer-protocol`. The web app remains the frontend and `@axial/core`
  validates server-side moves.
- 2026-06-18/19 multiplayer production deploy: Worker `axial-multiplayer` is deployed with Durable
  Object binding `AXIAL_ROOM` and routes `playaxial.dev/api/rooms*` plus `playaxial.dev/health`.
  Pages production deployed commit `f0289aa`, so `/room` is live on the Pages project. The local
  shell/Chromium resolver on the current network returns `65.52.200.44` and `::1` for
  `playaxial.dev`, while `@8.8.8.8` and Cloudflare authoritative nameservers return Cloudflare
  proxy IPs. Use a clean DNS path, phone cellular, or DNS override before judging the live
  desktop/phone multiplayer smoke.
- Multiplayer planning notes live in `dev/active/axial-web-rebuild/multiplayer.md`.
- 2026-06-09 iframe/header check: the repo has no app-level CSP, `_headers`, `X-Frame-Options`,
  or `frame-ancestors` config. `https://playaxial.pages.dev/` responded without CSP/XFO and should
  be iframe-embeddable. Local command-line header checks against the custom domain
  `https://playaxial.dev/` were inconsistent from this environment because DNS/connection behavior
  looked stale/weird, although browser navigation worked. Before shipping the portfolio embed,
  verify custom-domain headers from a clean network and/or Cloudflare dashboard.

Portfolio embed/bridge direction:

- Keep Axial as its own app/site and embed it from the portfolio via iframe.
- Add an explicit opt-in mode such as `?embed=1&bridge=1` instead of exposing every page load as an
  integration surface.
- Use a versioned `window.postMessage` protocol between the iframe and portfolio host.
- Axial should emit `ready`, state snapshots, acknowledgements, and errors. The portfolio host
  should be able to request state and send safe commands such as difficulty/theme/grid/label
  settings. It should not need to make board moves; the existing Axial MCTS remains the real
  opponent.
- The first state snapshot should be compact and semantic for the portfolio-side LLM: mode/status,
  current player, winner, move count, dimensions, win condition, last move, move history, relevant
  settings, and optional threat summaries/winning-move context when available.
- Security should be explicit: add a `frame-ancestors` CSP allow-list once the portfolio origin is
  known, validate `event.origin` before obeying commands, reply with a specific `targetOrigin`, and
  reject malformed/unsupported commands with typed bridge errors.
- 2026-06-09 v1 bridge implementation landed under `apps/web/src/lib/game/bridge/` with versioned
  protocol types, payload validation, state snapshots, and a page lifecycle helper. The route starts
  the bridge only when framed with `?embed=1&bridge=1`. Same-origin parents are allowed for local
  smoke tests; external portfolio origins must be configured through `PUBLIC_AXIAL_BRIDGE_ORIGINS`
  before they can control settings.
- V1 host commands are intentionally narrow: `axial:get-state` and `axial:set-settings`. Settings
  include theme, axis labels, grid layers, confirm drop, board color, opponent mode, and bridge-facing
  AI difficulty (`max` maps to the internal `nightmare` preset). Host-controlled moves, rules, and
  new-game/reset commands remain deferred until Caden explicitly wants those semantics.
- Bridge snapshots expose semantic, one-based move coordinates plus mode/status, opponent settings,
  current player, winner, move count, dimensions, win condition, settings, lock flags, AI thinking,
  and a compact threat summary from pure core simulations. They do not expose raw board arrays,
  Three/Threlte objects, Svelte internals, or local-storage payloads.
- 2026-06-18 update: portfolio bridge remains useful but is paused while multiplayer becomes the
  active planning target. Do not remove the bridge docs/code; just do not let it distract the next
  goal.

Multiplayer direction:

- Build online play as a server-authoritative room system, not peer-to-peer.
- Use one Durable Object instance per room/code so each room has a single coordinator for players,
  spectators, command ordering, canonical game state, and reconnect state.
- Use WebSockets for low-latency play and hibernatable Durable Object WebSockets for cost-efficient
  idle rooms when deployed on Cloudflare.
- First product target: private Classic room creation, short code, invite link, QR code, player
  names, ready flow, host-selected rules before start, server-validated moves, reconnect tokens,
  opponent-disconnected UI, rematch, and graceful room expiration.
- Multiplayer should eventually share core serialization concepts with replay/bridge work, but it
  needs its own protocol because it is authoritative and networked.
- 2026-06-18 implementation status: `@axial/multiplayer-worker` exposes `POST /api/rooms`,
  `POST /api/rooms/:code/join`, `GET /api/rooms/:code/socket`, and `GET /health`; `RoomObject`
  stores room state and bounded event history in SQLite-backed Durable Object storage and uses
  hibernatable WebSockets with compact socket attachments. `@axial/multiplayer-protocol` owns
  command/event/snapshot/error types. The Svelte app has `/room` and `/room/[code]` routes that keep
  multiplayer separate from the existing local/AI game route.

Implemented gameplay/UX:

- Playable 6 x 6 x 7 board with projected column picking.
- Drop preview and animated beveled cube pieces.
- Exact board-grid color picker, dark/light mode, toggleable axis labels, and toggleable grid
  layers. Full 3D grid remains the default; floor-only mode preserves the board footprint while
  hiding the upper/layer lattice.
- Click-to-confirm drop is a persisted desktop/mobile input option. The first click arms a column,
  clicking another column re-arms there, and clicking the armed column commits the drop.
- Undo, redo, rematch, and replay-from-start via canonical move history.
- Game-over modal with winner, move count, rematch, replay, and review actions.
- Collapsible top-right control panel with smooth downward expansion.
- Expanded match console with Match, Appearance, and Session sections.
- Session record tracks Player 1 wins, Player 2 wins, and draws once per completed match.
- AI opponent mode is unlocked. Classic mode now uses a bounded TypeScript MCTS/search opponent in a Web Worker on default and expanded board sizes; Tactical mode still uses random normal moves because special-piece AI is deferred.
- Classic AI has pre-match difficulty presets: Easy, Medium, Hard, and Max. Hard preserves a strong
  midrange worker budget; Max uses a larger worker-only budget that scales with board area/height.
  AI replies also have difficulty-aware minimum visible thinking time so stronger settings feel more
  deliberate even when the worker finds an obvious move quickly.
- Classic MCTS now treats true tactical forks as non-negotiable root decisions: immediate wins,
  immediate blocks, own fork creation, and opponent fork prevention return before simulations. This
  fixes the open-ended horizontal trap regression where MCTS could override the heuristic
  `block-forcing` move.
- Classic MCTS also uses progressive bias: the existing fast heuristic move ranking becomes a
  decaying UCT prior, with stronger difficulty presets passing larger bias values. RAVE remains
  enabled for Medium/Hard/Max.
- Classic MCTS now has deterministic tactical lookahead for foresight beyond already-visible forks.
  Medium/Hard/Max use increasing bounded alpha-beta depths, and Max uses the lookahead as both a
  root prior and a stronger override when it sees materially better trap-avoidance or setup moves.
- The RAVE implementation was audited during the lookahead pass: AMAF now blends into the value
  estimate only, and node AMAF updates use moves that occur after that node rather than the whole
  simulated path.
- Match setup exposes `Classic` and `Tactical` modes and locks opponent/rules after the first placement.
- Match setup exposes win-rule controls for connect length and completed lines needed; those settings are persisted and lock after the first placement.
- Match setup exposes board dimensions as clickable pre-match number controls. Bigger boards reset
  the fresh game immediately and persist locally.
- The latest placed move gets a pulsing 3D glow so returning to the board makes the most recent placement easy to find.
- Completed lines are now visible before the match ends. The core snapshot exposes stable completed-line IDs, and the scene renders each line with a draw-through animation, traveling glow bead, final pulse, and idle glowing marker.
- The game-over modal is delayed after wins so the completed-line draw animation can finish before the result overlay appears.
- Piece drops use a stronger ease-out curve than the first implementation so placements slow more
  progressively as they settle into the final cell.
- Dark scene backgrounds use one solid field color per scene instead of the earlier radial color fields/aurora treatment.
- Multi-line scoring counts maximal contiguous runs, not every overlapping length-N window. In connect-4 / 2-lines mode, five in a row is one completed line, while crossing or separate completed runs count separately.
- Classic AI scoring now follows that same maximal-line rule: overlapping length-4 windows inside a
  five-cell run are not valued as separate completed lines or high-priority second-line progress.
- Tactical mode now has two playable specials in a fixed three-piece kit per player: two Blocker Combos and one Double Adjacent.
- Blocker Combo places a neutral gravity blocker first, then requires a regular piece in the same turn.
- Double Adjacent places one owned gravity piece, then requires a second owned gravity piece whose final landing cell is adjacent in the 26-neighbor 3D sense.
- Tactical replay history records special metadata on sub-actions so undo/redo and future AI/training can reconstruct same-player continuations.
- Piece appearance controls support cube, orb, and crystal shapes plus per-player color pickers.
- Board appearance uses an exact color picker instead of fixed scene presets. The Void purple remains the default board accent, and the old preset storage value is only used as a one-time color migration fallback.
- Piece shape and player colors lock after the first placed piece, including undo/review states; starting a new match unlocks them.
- Supported browsers expose a fullscreen toolbar button. Mobile users can also install Axial from the browser/home-screen flow for the more app-like experience.
- Active matches autosave to local storage using canonical replay history, dimensions, rules,
  opponent settings, and redo state. Reloading after a browser issue restores the board instead of
  losing progress.
- The game route wraps the 3D scene in a recovery boundary and listens for WebGL context loss. A
  recoverable render failure remounts the board scene while preserving controller/game state; repeated
  scene failures fall back to a small manual board restart control.

## Visual/UI Decisions

- Corner logo is a clean AXIAL wordmark with current board dimensions underneath. The wordmark,
  dimensions, and centered desktop turn pill share a synchronized sequential glyph glow tied to the
  active board accent, with reduced-motion users getting static text.
- Turn labels use neutral language: `Your turn` and `Opponent's turn`.
- Desktop turn pill is top-centered, uses the same acrylic surface treatment as the controls, and is fixed-width so it does not resize between turn labels. The pill is intentionally shorter than the earlier version and uses larger status text.
- Mobile hides the turn pill and keeps the control pill tucked into the top-right corner.
- Mobile/touch layouts stay mobile in landscape as well as portrait: the center turn pill remains
  hidden, the toolbar keeps compact touch sizing, and the scene uses compact camera framing on
  coarse-pointer devices even when viewport width exceeds the old 720px breakpoint.
- Collapsed controls keep the same rounded shape and clip hidden panel content to zero height, so the icon row is truly centered vertically.
- Tactical turns use a `Pieces` mode in the top-right control pill: the leftmost toolbar button swaps normal controls for special-piece actions, while the dropdown opens either the normal setup menu or piece details depending on the active toolbar mode.
- The centered desktop turn pill is now status-only, with no arrow or inactive side-expansion affordance.
- Desktop top-right controls use the same full-height acrylic pill scale as the centered turn pill, while mobile keeps the smaller compact toolbar.
- The disabled Tactical pieces button is hidden in Classic mode so the toolbar has room for the fullscreen control without crowding the default mobile layout.
- The Double Adjacent special uses a distinct copy-plus icon so it does not read as the general Pieces/loadout button.
- Light mode is warmer/desaturated, with stronger board-grid contrast and glow accents.
- Dark mode uses a solid scene field to keep the board readable and avoid colored background circles competing with pieces/lines.
- Axis labels behave as a readable overlay: bottom numbers on clockwise perimeter rails; X/Y fixed side candidates; Z fixed corner rail candidates; camera-based fades prevent duplicate clutter.
- Expanded controls now behave like a match console: a compact live strip, local/AI mode surface, Classic/Tactical rules selector, current setup cards, grouped appearance controls, and a session record.
- AI mode is represented in the Match section. Classic AI uses bounded worker-backed MCTS; Tactical AI is intentionally still a random normal-move baseline until Tactical search is designed.
- Board dimensions, connect length, clock state, and Tactical kit counts are shown as current setup facts; match mode is editable only before the active match starts.
- Board dimensions, connect length, target line count, and Tactical kit counts are shown as current setup facts; match mode and win condition are editable only before the active match starts.
- Game-over actions are labeled by intent: `New match` clears the board, `Review from start` rewinds the completed move list for redo stepping, and `Keep board` dismisses the result.
- Game-over modal action alignment was cleaned up, and the modal now eases in with a short
  backdrop/dialog animation after the completed-line delay.
- Text selection is disabled on the game shell so dragging across the HUD/panel does not create browser text highlights.
- Piece style and player colors are live appearance settings persisted in local storage and applied to placed pieces and drop previews.
- Piece style and color choices behave like pre-match loadout choices: they are editable on a fresh board, then locked for the active match once any piece has been placed.
- Appearance setup is grouped as Board color, Piece look, and Theme. Board color remains editable live; piece shape/colors lock after the first placement. Player color pickers are two separate gradient pills, while the board-color picker remains a single full-width pill. The session footer no longer repeats the old arena/theme text.
- Appearance setup also owns compact Grid layers, Axis numbers, and Confirm drop toggles. The
  confirm-drop armed state renders a soft column beam plus a square floor plate so the staged column
  reads as intentional before the second click commits.
- Tactical/special-piece brainstorming and implementation notes are captured in `dev/active/axial-web-rebuild/variant-modes.md`.

## Recent Verification

Latest checks passed from `axial-web/` unless noted:

- 2026-06-18/19 multiplayer production-route pass: `pnpm --filter @axial/multiplayer-worker types`,
  `pnpm --filter @axial/multiplayer-worker check`, `pnpm --filter @axial/multiplayer-worker
  test:unit`, `pnpm --filter @axial/multiplayer-worker lint`, `pnpm check`, and `pnpm
  deploy:multiplayer:dry-run` passed. `pnpm deploy:multiplayer` deployed Worker version
  `77cccbe4-3a41-4984-9983-dcf8a1d7bd03` and attached routes `playaxial.dev/api/rooms*` and
  `playaxial.dev/health`. The new smoke runner passed against local Worker dev with
  `AXIAL_MULTIPLAYER_SMOKE_URL=http://localhost:8787 pnpm smoke:production:multiplayer`.
  `pnpm smoke:production:multiplayer` and Chromium navigation to `https://playaxial.dev/room` are
  blocked from this machine by upstream DNS returning `65.52.200.44`/`::1` for `playaxial.dev`;
  authoritative Cloudflare DNS and `@8.8.8.8` return the expected Cloudflare records.
- 2026-06-18 multiplayer foundation: `pnpm check`, `pnpm lint`, `pnpm test:unit`, and `pnpm build`
  passed. Worker-focused checks also passed: `pnpm --filter @axial/multiplayer-worker check` and
  `pnpm --filter @axial/multiplayer-worker test:unit` with 6 Worker-runtime tests. Local Playwright
  fallback smoke verified `http://localhost:5174/room` against Worker dev on `http://localhost:8787`:
  host creates a room, guest joins on mobile viewport, both ready, host plays a server-validated
  move, guest sees the revision/move update, and no browser console warnings/errors were observed.
  Codex in-app Browser was not usable in this session because the plugin reported
  `privileged native pipe bridge is not available; browser-client is not trusted`.
- 2026-06-09 portfolio bridge v1: `pnpm check`,
  `pnpm --filter @axial/web test:unit -- --run`, `pnpm --filter @axial/web test:e2e`,
  `pnpm lint`, `pnpm build`, and `pnpm test:unit` passed. Build retained only the known large
  Three/Threlte route chunk warning at `855.41 kB` minified / `222.63 kB` gzip.
- 2026-06-09 mobile/recovery/AI-line pass: `pnpm --filter @axial/ai test:unit`,
  `pnpm --filter @axial/web test:unit -- --run`, `pnpm --filter @axial/core test:unit`,
  `pnpm check`, `pnpm lint`, and `pnpm build` passed. Local Playwright fallback verified mobile
  portrait/landscape compact layout, mobile theme toggle, and active-match restore.
- Historical visual-smoke details, screenshot paths, bundle-cleanup notes, and older AI verification
  logs were archived to
  `dev/active/axial-web-rebuild/archive/2026-06-18-verification-history.md`.

Known non-blocking build warnings:

- Large Three.js/Threlte game chunk. The 2026-06-07 cleanup pass reduced the client page
  chunk from `993.16 kB` minified / `273.01 kB` gzip to `831.24 kB` minified /
  `215.85 kB` gzip, but the route still exceeds Vite's default 500 kB warning threshold.
  After the icon replacement and confirm-beam sync pass, the route is `842.28 kB` minified /
  `218.07 kB` gzip.

Bundle cleanup decision from the 2026-06-07 pass:

- Removed the broad `@threlte/extras` route import by replacing the extras barrel usages with
  local scene helpers: a small OrbitControls wrapper, canvas-backed billboard labels, and direct
  Three `RoundedBoxGeometry`.
- Removed the now-unused `@threlte/extras` package dependency and lockfile entries after source
  imports were fully eliminated.
- Removed the normal-path runtime `@axial/ai` import from the page controller. Classic MCTS stays
  worker-backed, and the rare main-thread MCTS fallback now loads dynamically only if the worker
  path fails.
- Sourcemap inspection after cleanup shows the remaining route bulk is dominated by Three core,
  Three module glue, Three OrbitControls, Threlte core, and Axial's actual page/scene/UI code.
  Manual chunking or lazy-loading the scene would mostly move the same first-play WebGL payload
  into another required chunk, so defer larger splitting until there is a non-game first route,
  a deliberate loading shell, or a quality-tier architecture.

## Key Files For Next Work

For multiplayer, start with `dev/active/axial-web-rebuild/multiplayer.md` and the proposed
`axial-web/apps/multiplayer-worker` package layout in `next-session-prompt.md`.

For existing web/game work:

- `axial-web/apps/web/src/routes/layout.css`
- `axial-web/apps/web/src/lib/game/ui/GameHud.svelte`
- `axial-web/apps/web/src/lib/game/ui/GameStatusPanel.svelte`
- `axial-web/apps/web/src/lib/game/ui/GameOverModal.svelte`
- `axial-web/apps/web/src/lib/game/scene/BoardGrid.svelte`
- `axial-web/apps/web/src/lib/game/scene/BoardLabels.svelte`
- `axial-web/apps/web/src/lib/game/scene/GamePiece.svelte`
- `axial-web/apps/web/src/lib/game/scene/ColumnPicker.svelte`
- `axial-web/apps/web/src/lib/game/scene/AxialWorld.svelte`
- `axial-web/apps/web/src/lib/game/scene/geometry.ts`
- `axial-web/apps/web/src/lib/game/state/gameController.svelte.ts`
- `axial-web/apps/web/src/lib/game/state/pieceAppearance.ts`
- `axial-web/apps/web/src/lib/game/scene/DropPreview.svelte`
- `axial-web/packages/core/src/index.ts`
- `axial-web/packages/ai/src/index.ts`
- `dev/active/axial-web-rebuild/variant-modes.md`
- `axial-web/apps/web/src/lib/game/theming/sceneThemes.ts`

## Next AI Candidates

- Caden locked the Classic AI direction on 2026-06-06: rewrite MCTS/search in the web repo first, then train a policy-value model with self-play/RL after search and evaluation are trustworthy.
- First implementation landed in `@axial/ai`: precomputed 954 winning segments, row-major move indices, mutable Classic search state, heuristic tactical selector, seeded evaluation harness, and deterministic MCTS with RAVE-style statistics.
- Classic AI opponent mode now calls bounded MCTS through a Vite Web Worker. Difficulty budgets are
  larger than the first pass and scale with board area/height; Max starts at `760` simulations /
  `2200ms` before board and win-rule multipliers.
- Classic AI search now reads `game.winCondition`, including connect-5 and multi-line targets, through dynamic segment tables.
- Classic AI search now reads `game.dimensions`; expanded board sizes use dimension-aware segment
  tables, move indices, center scoring, and MCTS rollouts instead of the old random fallback.
- Classic AI now gives multi-line modes stronger strategy weight: non-terminal line completions are valuable, opponent line progress is blocked, line-completion forks influence forcing moves, rollouts pursue/block line progress, and search budgets scale upward for connect-5 / 2-3-line variants.
- Classic AI no longer short-circuits MCTS for non-terminal forcing/block-forcing heuristic moves;
  only immediate wins, immediate blocks, true own forks, and true opponent-fork blocks bypass search.
  Root heuristic scoring now weighs fork creation and opponent immediate replies more aggressively.
- Classic AI now has a bounded tactical lookahead layer that scores future trap setup/avoidance
  before rollouts. It includes coverage for a gravity-support trap where an AI move would make the
  opponent's height-one fork playable on the next turn.
- The app has a cancellable Classic AI client: reset/undo/mode changes terminate stale worker requests before they can play old moves.
- The Match panel exposes AI strength when AI mode is selected; the setting persists and locks with the rest of setup after the first move.
- Keep the old Python MCTS runnable only as a reference/baseline, not as production code moved into `axial-web`.
- Root `pyproject.toml`/`uv.lock` now provide a Python 3.12 `numpy`/`numba` environment for preserved MCTS checks.
- Preserved MCTS smoke command passed: `uv run --python 3.12 python main/test_simple.py`.
- Baseline preserved MCTS speed from that run: 1000 smart rollouts in 6.92s, 500-simulation move in 3.96s, 2-second budget produced 329 simulations, and AI beat random 10-0.
- New TypeScript MCTS focused test timing after fast affected-line ordering: 40 simulations on the empty board in about 261ms under Vitest.
- Keep the web core's `Uint8Array` board and replay moves as canonical app state; use an internal Classic search state with column heights, precomputed 954 winning segments, incremental line counts, seeded randomness, and explicit row-major policy indices.
- Define measurable strength with seeded matches against random, greedy, heuristic, basic MCTS, enhanced MCTS/Python teacher, and direct Caden challenge games.
- Next AI engineering step: add progress messages for longer searches and larger benchmark runs.
- Add PyTorch/training dependencies only when neural work resumes.
- Treat AlphaZero/PyTorch/ONNX as a later measured upgrade after the teacher/evaluation harness proves whether neural guidance improves play beyond MCTS alone.
- Keep Tactical/special-piece AI deferred until Classic-mode AI direction is locked.

## Next Polish Candidates

- More Caden-directed UI changes.
- Confirm-drop visuals now use a tall tapered column beam, square cell-floor markers, and preview
  compositing that keeps grid lines from drawing through hover pieces. Last-move floor emphasis uses
  the same square marker language. The armed beam starts above the floor marker so it does not cut
  through the platform, uses a little more contrast, and pulses in sync with the preview piece and
  square plate.
- Axis labels remain available in floor-only grid mode; `Grid layers` and `Axis numbers` are
  independent visual toggles. Labels remain mounted while hidden and outside the grid remount key to
  reduce camera-angle flicker on toggle.
- Add editable loadout UX for choosing the three Tactical specials.
- Graphics quality settings.
- Richer glass/acrylic board material.
- Selective bloom or intentional glow pass.
- Better piece contact cues without broad fake ground shadows.
- Further mobile viewport tuning.

Older architecture/background details were archived to `dev/active/axial-web-rebuild/archive/2026-05-26-background.md`.
