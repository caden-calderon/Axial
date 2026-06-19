# Axial Web Rebuild Tasks

## Planning

- [x] Review current Unity/Python project structure.
- [x] Confirm active game rules, board dimensions, and AI runtime path.
- [x] Check current SvelteKit/Threlte/Three.js docs for key architecture constraints.
- [x] Draft initial rebuild architecture.
- [ ] Review plan with Caden and lock phase 0/1 scope.

## Phase 0: Foundation

- [x] Decide final new project location: `axial-web/`.
- [x] Decide preserved Unity project location: `axial-unity/`.
- [x] Create pnpm workspace.
- [x] Scaffold SvelteKit + TypeScript app.
- [x] Add lint, format, unit test, and browser test commands.
- [x] Create `packages/core`.
- [x] Implement board constants and coordinate helpers.
- [x] Implement legal moves, gravity drops, win detection, draw detection.
- [x] Add initial game-core tests.
- [x] Add configurable win conditions for connect 4/connect 5 and 1-3 completed lines.
- [x] Add pre-match configurable board dimensions from the 6 x 6 x 7 baseline up to 10 x 10 x 10.
- [x] Track completed lines as stable game-state markers during active multi-line matches.
- [ ] Add golden-position fixtures from the Python project.

## Deployment

- [x] Choose Cloudflare Pages as the first public host for `playaxial.dev`.
- [x] Switch SvelteKit from `adapter-auto` to explicit `@sveltejs/adapter-cloudflare`.
- [x] Pin the Cloudflare build Node version with `axial-web/.node-version`.
- [x] Document Cloudflare Pages build settings, Porkbun/Cloudflare DNS setup, and future multiplayer direction.
- [x] Create the Cloudflare Pages project from Git.
- [x] Move authoritative DNS for `playaxial.dev` from Porkbun DNS to the Cloudflare nameservers assigned to the zone.
- [x] Attach `playaxial.dev` as the Pages custom domain after the first successful deploy.
- [x] Add a lightweight automated production smoke command.
- [x] Document the release workflow, production smoke checklist, and rollback habit.
- [x] Add PWA install metadata, branded icons, and a lightweight service worker.
- [x] Replace favicon/PWA icon assets with Caden's updated `AxialLOGO.png` render and derive the
  generated icon sizes from a modest app-icon-frame crop.
- [x] Deploy the first multiplayer Worker/Durable Object service to production routes on
  `playaxial.dev/api/rooms*` and `playaxial.dev/health`.
- [ ] Verify production/custom-domain iframe headers for `playaxial.dev` from a clean network or
  Cloudflare dashboard before portfolio embedding.
- [ ] Add an explicit `frame-ancestors` policy for the portfolio origin once the portfolio URL is
  known.
- [x] Add the future multiplayer Worker/Durable Object app when live invite links become the active task.

## Online Multiplayer

- [x] Write and review the multiplayer architecture before implementation: room lifecycle, protocol,
  server authority, reconnection, storage, deployment shape, security, error handling, tests, and
  rollout.
- [x] Create a separate multiplayer Worker app/package, likely `axial-web/apps/multiplayer-worker`,
  with Durable Object room bindings and `@axial/core` as the rules dependency.
- [x] Add a room creation endpoint that returns a short room code, invite URL, QR payload, and host
  reconnect token.
- [x] Add join-by-code and join-by-link flow with display-name entry and validation.
- [x] Add server-authoritative lobby state: host settings, player seats, player names, ready state,
  spectators if enabled, room expiration, and typed errors.
- [x] Add WebSocket protocol with versioned command/event envelopes and monotonic room revisions.
- [x] Validate every move server-side with `@axial/core`; clients must not decide canonical board
  state.
- [x] Add reconnect tokens, refresh/mobile-sleep recovery, duplicate-tab handling, last-seen
  revision resync, and opponent-disconnected grace state.
- [x] Add rematch flow after game over, with same rules first and optional rule tweaks later.
- [x] Add explicit host `Start game` after both players are ready, including a start/countdown
  overlay that displays players, match settings, and opening player.
- [x] Add online result/rematch overlay with rematch/leave/keep-board actions, opponent rematch
  intent, and a server-enforced 30-second rematch decision deadline.
- [x] Swap the starting player on online rematches.
- [x] Add client UI for create room, join room, QR payload, copy invite link, names, ready state,
  connection state, reconnecting/resyncing, opponent disconnected, and room expired.
- [x] Integrate Online mode into the existing main 3D game route/sidebar with Local, AI, and Online
  mode selection.
- [x] Preserve full formatted room-code visibility in the integrated sidebar on desktop and mobile.
- [x] Replace the temporary authoritative 2D online board with the existing Threlte 3D board fed by
  server snapshots.
- [x] Keep `/room` and `/room/[code]` as compatibility redirects into `/?online=1` and `/?room=CODE`.
- [x] Render a real scannable QR image from the invite URL in the Online sidebar.
- [x] Reduce false reconnect noise by treating successful HTTPS sync/command fallback as a healthy
  transport when WebSocket is flaky.
- [x] Add focused unit/integration tests for room lifecycle, command validation, move validation,
  reconnect/resync, duplicate tabs, stale revisions, and error codes.
- [x] Add Worker production deploy helpers and a production multiplayer smoke runner.
- [ ] Run the production desktop/phone manual multiplayer smoke from a clean DNS path.
  - 2026-06-18/19: Worker deploy succeeded and Pages production deployed the multiplayer UI, but
    this workstation's CSU/HFS resolver returns stale/bad `*.playaxial.dev` records
    (`65.52.200.44` and `::1`). Test on phone cellular or DNS `1.1.1.1`/`8.8.8.8` before treating
    the failure as an app bug.
- [ ] Add local end-to-end smoke with two browser contexts playing a full room match.
  - 2026-06-18: ad hoc Playwright fallback smoke passed for two browser contexts and one
    server-validated move.
  - 2026-06-19: ad hoc Playwright smoke passed for the integrated main-route 3D Online flow with
    desktop host, mobile guest, QR image, both ready, and one server-validated 3D-board move. Commit
    this as a repeatable e2e test in a follow-up.
  - 2026-06-19: Worker dry-run passed and `pnpm deploy:multiplayer` deployed version
    `4a0f9b12-361c-4f1e-ae21-d4f2d7671514`.
  - 2026-06-19: ad hoc Playwright smoke passed for full-code display, explicit host start,
    start/countdown overlay, result/rematch overlay, opponent rematch intent, rematch deadline UI,
    and Match 2 with swapped opener. Worker dry-run passed and `pnpm deploy:multiplayer` deployed
    version `b158cd16-5485-4179-8207-1a81891930f0`.
  - 2026-06-19: `pnpm smoke:production:multiplayer` is still blocked on this workstation by local
    resolution to `::1`/`65.52.200.44`, while authoritative Cloudflare nameservers and `@8.8.8.8`
    return Cloudflare proxy IPs.

## Portfolio Embed Bridge

- [x] Write the bridge architecture before implementation: message protocol, state snapshot shape,
  safe command list, file/module boundaries, security model, test plan, and rollout steps.
- [x] Add opt-in iframe/embed mode, likely `?embed=1&bridge=1`, without changing normal standalone
  play.
- [x] Create a focused bridge module boundary under the web app, keeping protocol types,
  serialization, validation, and browser lifecycle separate from scene/UI internals.
- [x] Emit versioned `axial:ready`, `axial:state`, `axial:ack`, and `axial:error` messages to the
  host.
- [x] Accept only safe host commands initially: `axial:get-state` and `axial:set-settings`; leave
  new-match/rule commands deferred until explicitly approved.
- [x] Expose compact semantic state for the portfolio-side LLM: status, current player, winner,
  move count, board dimensions, win condition, last move, move history, settings, and optional
  threat context.
- [x] Validate `postMessage` origin and payloads, use exact `targetOrigin` replies after handshake,
  and reject unsupported commands without mutating state.
- [x] Add unit tests for snapshot serialization and command validation.
- [x] Add an iframe/e2e smoke harness for ready/state/settings/error flows and origin rejection.
- [ ] Configure the real portfolio origin in `PUBLIC_AXIAL_BRIDGE_ORIGINS` and production
  `frame-ancestors` once Caden confirms the URL.
- [ ] Smoke the production iframe from the actual portfolio parent.

## Phase 1: Beautiful Playable 3D MVP

- [x] Create Threlte game route/component.
- [x] Build generated 6 x 6 x 7 board.
- [x] Add camera controls.
- [x] Add column hover/pick raycasting.
- [x] Add drop preview.
- [x] Animate piece drops.
- [x] Add local game state orchestration.
- [x] Add basic HUD and settings panel.
- [x] Add light/dark theme.
- [x] Establish elegant sci-fi glass scene style.
- [x] Leave scene style API open for future selectable vibes.
- [x] Add first selectable scene variants.
- [x] Split game route into state, scene, theming, and UI layers.
- [x] Add undo/redo.
- [x] Add game over modal and replay controls.
- [x] Clarify game-over actions as new match, review from start, and keep board.
- [ ] Add graphics quality settings.

## Phase 2: Browser AI

- [x] Create `packages/ai`.
- [x] Implement random legal-move player.
- [x] Wire AI opponent mode into the web controller.
- [x] Audit preserved Unity/Python AI and training code before designing the serious Classic AI.
- [x] Research AlphaZero-style self-play, heuristic search, MCTS, threat-space search, and hybrid approaches for Classic Axial.
- [x] Draft Classic AI benchmark targets, including baselines, latency, reproducibility, and direct strength against Caden.
- [x] Draft Classic AI architecture and staged training/search recommendation in `classic-ai-research.md`.
- [x] Draft board representation plan for search/training: canonical typed array, internal line-count search state, policy indices, symmetries, and later bitboards/tensors.
- [x] Review Classic AI recommendation with Caden and lock the first implementation direction: rewrite MCTS/search in the web repo first, then train a model with self-play/RL.
- [x] Add reproducible `uv` Python AI environment metadata for preserved Numba MCTS evaluation.
- [x] Smoke-run preserved Python MCTS through `uv` and capture baseline performance.
- [ ] Add PyTorch/training dependencies to the `uv` environment when neural work resumes.
- [x] Add Classic AI golden fixtures and precomputed winning segment tests.
- [x] Add seeded AI-vs-AI evaluation harness and baseline match reporting.
- [x] Rewrite immediate win/block and threat-scored heuristic player in TypeScript.
- [ ] Rewrite Caden's existing stronger heuristic/greedy ideas in TypeScript.
- [x] Rewrite first enhanced MCTS in TypeScript using the old Python MCTS as a reference and benchmark.
- [x] Wire Classic AI opponent mode to bounded MCTS search while keeping Tactical AI random/deferred.
- [x] Move Classic MCTS into a Web Worker.
- [x] Add cancellation path for stale Classic AI worker requests.
- [x] Add difficulty-aware visible thinking delay for Classic AI replies.
- [ ] Add progress messages from long-running Classic AI search.
- [x] Add difficulty presets.
- [x] Alternate the starting player after each played/completed Local or AI match reset.
- [x] Keep Classic AI rule-aware for configurable connect length and line-count win targets.
- [x] Improve Classic AI heuristic/MCTS behavior for 2-3-line targets by valuing and blocking non-terminal line progress.
- [x] Fix Classic AI multi-line scoring so a five-cell contiguous run is not valued as two
  overlapping connect-4 lines.
- [x] Generalize Classic AI search geometry for expanded board dimensions.
- [x] Scale Classic AI budgets by board size for stronger Max play and remove the instant MCTS
  shortcut for non-terminal forcing/block-forcing moves.
- [x] Fix the Classic MCTS open-ended fork regression by making true fork creation/prevention a
  hard tactical root decision again, with coverage for default boards, expanded boards, and
  connect-five rules.
- [x] Add progressive bias to Classic MCTS so fast heuristic move ranking guides early UCT/RAVE
  selection and decays as child visits accumulate.
- [x] Add bounded tactical lookahead to Classic MCTS so stronger difficulties can avoid next-turn
  fork setup, gravity-support traps, and multi-line race pressure before rollouts converge.
- [x] Audit and correct RAVE selection/backpropagation so AMAF blends with value estimates and each
  node only receives future-move AMAF updates from its own position.
- [ ] Benchmark AI strength and latency.
- [ ] Train or build a Classic-mode opponent that can beat Caden.

## Phase 3: Visual Polish

- [ ] Define visual palette for light and dark modes.
- [x] Replace transparent rail meshes with stable line/shell board rendering.
- [x] Replace spherical pieces with beveled cube pieces.
- [x] Improve piece drop easing and hide awkward spawn height.
- [x] Move controls/status into a collapsible top-right panel.
- [x] Add glowing grid intersections and brighter outer-edge treatment.
- [x] Add toggleable transparent axis/number labels.
- [x] Add seeded variation to drop arcs and tumble.
- [x] Add dispersed line glow around grid intersections.
- [x] Replace occluding hitboxes with camera-projected column picking.
- [x] Make axis labels fade between visible sides as the camera rotates.
- [x] Replace hard-ended glow streaks with alpha-faded line glow.
- [x] Enforce one active axis label rail per axis and fully hide back-side labels.
- [x] Keep one visible X, Y, and Z label separated across centered and angled views.
- [x] Replace moving axis-label anchors with static X/Y/Z candidates that fade by camera angle.
- [x] Refresh corner brand with board dimensions.
- [x] Tune light mode contrast and warmth.
- [x] Smooth and clean up the controls panel expansion.
- [x] Keep controls panel width and corner radius stable between collapsed and expanded states.
- [x] Fix collapsed controls toolbar vertical centering by removing hidden body height from the pill.
- [x] Replace Solar/Azure UI labels with neutral player/opponent turn language.
- [x] Center the desktop turn pill at the top and match controls height/color without resizing between turns.
- [x] Tighten mobile HUD and controls scale.
- [x] Rebuild expanded controls into a Match, Appearance, and Session console.
- [x] Add session record for Player 1 wins, Player 2 wins, and draws.
- [x] Add visible Classic match-mode card to the Match console.
- [x] Disable browser text selection across the game shell.
- [x] Add selectable piece shapes: cube, orb, and crystal.
- [x] Add persisted Player 1 and Player 2 piece color pickers.
- [x] Lock piece shape and colors after the first placed piece until a new match/reset.
- [x] Add pulsing last-move glow so the newest placement is easy to spot.
- [x] Render completed lines with a draw-through glow animation and persistent idle marker.
- [x] Delay the game-over modal until the completed-line animation can finish.
- [x] Slow and soften piece drop animation timing.
- [x] Replace dark-mode radial color fields with a solid scene background.
- [x] Add a fullscreen toolbar control for browsers that support the Fullscreen API.
- [x] Add a pre-match Classic/Tactical rules selector.
- [x] Add pre-match connect-length and lines-to-win controls for both modes.
- [x] Add pre-match board-size controls and remove the repeated setup stat tiles from the expanded pill.
- [x] Lock opponent mode and rules after the first placement until a new match/reset.
- [x] Remove inactive center-turn-pill arrow/side-expand affordance after Tactical actions moved to the top-right Pieces mode.
- [x] Differentiate the Double Adjacent icon from the general Pieces/loadout icon.
- [x] Restore desktop top-right control pill height while preserving the compact mobile toolbar.
- [x] Replace preset grid themes with exact board-color picker and grouped Appearance controls.
- [x] Add synchronized sequential glow to the AXIAL/dimensions HUD and center turn pill, and restore
  separate gradient P1/P2 color pills.
- [x] Add a persisted click-to-confirm drop option with an armed-column preview animation.
- [x] Add a persisted grid-layer visibility option with a floor-only board mode.
- [x] Make the piece drop ease-out more gradual as pieces settle.
- [x] Polish confirm-drop/last-move scene cues with cell-sized square plates, a taller tapered
  armed-column beam, preview-over-grid compositing, and axis labels in floor-only mode.
- [x] Stop the armed-column beam from piercing the square floor marker and keep axis-label state
  stable across grid/axis toggle changes.
- [x] Keep mobile/touch layout compact in landscape: no center turn pill, compact toolbar sizing,
  and compact camera framing on coarse-pointer devices.
- [x] Add active-match autosave/restore and a lightweight scene recovery path for WebGL/context or
  runtime scene failures.
- [ ] Build richer glass/acrylic board material.
- [x] Build first pass of emissive/glossy player piece materials.
- [ ] Add selective bloom or glow pass.
- [ ] Add convincing contact cues without broad fake ground shadows.
- [ ] Add quality presets.
- [x] Test desktop and mobile viewports.

## Immediate Next Engineering Candidates

- [x] Analyze the large Three.js/Threlte game chunk warning and decide on code-splitting, lazy loading, dependency trimming, or accepting the current bundle with documentation.
  - 2026-06-07: removed accidental `@threlte/extras` and normal-path `@axial/ai` imports from the page route. Client page chunk dropped from `993.16 kB` minified / `273.01 kB` gzip to `831.24 kB` minified / `215.85 kB` gzip. Remaining warning is dominated by the expected Three/Threlte WebGL payload and is accepted for now.
- [ ] Audit `apps/web/src/lib/game` for dead code, duplicated component logic, stale helpers, and UI/scene/state boundaries that should be cleaned before more features land.
  - 2026-06-07 follow-up: removed unused `@threlte/extras` dependency/lock entries, split `GameStatusPanel` into focused section components, and removed a stale `matchConfig` controller getter/import.
- [ ] Audit `packages/core` and `packages/ai` for unused exports, duplicated rules/search logic, and tests that should be tightened.
  - 2026-06-07 follow-up: generalized Classic AI geometry for non-default board dimensions and
    added focused dynamic-board AI tests. Larger-board strength/latency benchmarking remains open.
  - 2026-06-07 AI follow-up: Max Classic AI now uses larger board-scaled budgets and broader
    forcing/block-forcing heuristic moves run through MCTS instead of returning instantly.
  - 2026-06-07 fork-regression follow-up: true immediate-threat forks are split from softer
    line-race forcing moves. MCTS returns immediately for wins, blocks, own forks, and opponent
    fork blocks; non-forced line-race strategy still searches. Progressive bias was added to
    improve early move selection under high branching factors.
  - 2026-06-07 foresight follow-up: added bounded alpha-beta tactical lookahead as a root MCTS prior
    and optional Hard/Max override, tuned difficulty presets to diverge more, and corrected RAVE's
    AMAF value blending/update scope.
- [ ] Keep initial cleanup refactors behavior-preserving unless Caden's next requested changes touch the same area.
- [x] Re-run focused unit/e2e/build checks after cleanup and before pushing.
  - 2026-06-07 follow-up: `pnpm check`, `pnpm lint`, `pnpm build`, `pnpm --filter @axial/core test:unit`, `pnpm --filter @axial/ai test:unit`, `pnpm --filter @axial/web test:unit -- --run`, `pnpm --filter @axial/web test:e2e`, and local Playwright fallback visual smokes passed.
  - 2026-06-07 fork-regression follow-up: `pnpm --filter @axial/ai test:unit`,
    `pnpm --filter @axial/web test:unit -- --run`, `pnpm --filter @axial/core test:unit`,
    `pnpm check`, `pnpm lint`, and `pnpm build` passed. Build retained only the known
    Three/Threlte route chunk warning.
  - 2026-06-07 foresight follow-up: `pnpm --filter @axial/ai test:unit`, `pnpm check`,
    `pnpm lint`, `pnpm --filter @axial/web test:unit -- --run`,
    `pnpm --filter @axial/core test:unit`, and `pnpm build` passed. Build retained only the known
    Three/Threlte route chunk warning at `843.05 kB` minified / `218.27 kB` gzip.

## Tactical Variants

- [x] Capture Classic vs Tactical mode design notes.
- [x] Add core match config constants for Classic and future Tactical.
- [x] Define first-pass special-piece candidates: blocker combo, double adjacent, phase piece.
- [x] Add match config foundation for Classic vs Tactical.
- [x] Prototype blocker combo behind Tactical mode.
- [x] Add neutral blocker cells to core and keep Classic `applyMove` behavior intact.
- [x] Add replay/undo support for blocker action history.
- [x] Render blockers and blocker drop previews distinctly from player pieces.
- [x] Prototype double-adjacent special piece behind Tactical mode.
- [x] Add fixed Tactical kit counts: two Blocker Combos and one Double Adjacent.
- [x] Add replay/undo support for same-player Double Adjacent action history.
- [x] Add desktop/mobile top-right toolbar Pieces mode for turn-time Tactical actions.
- [ ] Prototype phase/non-gravity piece behind Tactical mode.

## Immediate Next Polish Candidates

- [x] Review the current board in-browser with Caden's latest label expectations and make any tiny label opacity/placement adjustments.
- [x] Add game-over modal with winner, move count, rematch, and replay entry points.
- [x] Add undo/redo backed by canonical move history.
- [x] Replace placeholder expanded-panel content with match setup, appearance controls, and session stats.
- [x] Unlock AI mode with a random legal-move opponent.
- [x] Capture tactical special-piece design notes.
- [x] Add match config foundation for Classic vs Tactical modes.
- [x] Share configurable win-condition rules across Classic and Tactical modes.
- [x] Add live piece appearance controls before tactical special pieces.
- [x] Treat piece shape/colors as pre-match choices once the active match starts.
- [x] Make Tactical selectable and playable with the first blocker-combo special.
- [x] Add Double Adjacent as the second playable Tactical special.
- [x] Move turn-time special use into top-right toolbar Pieces mode instead of requiring the expanded setup panel.
- [ ] Add editable loadout UX for choosing the three Tactical specials.
- [ ] Add graphics quality presets for glow/postprocessing, shadows/contact cues, and low-power mode.
- [ ] Improve the glass/acrylic board material and selective bloom so glow feels intentional rather than uniformly bright.
- [x] Run a desktop/mobile visual pass for text fit, control placement, camera framing, and click/tap ergonomics.
- [x] Polish game-over modal alignment and add an entrance animation after the line-draw delay.
- [ ] Keep training/neural AI work paused until the playable web remake feels polished enough to be the main version.

## Phase 4: Neural AI

- [x] Audit existing `Training/` code and checkpoints.
- [x] Decide serious-AI path: MCTS/search first, then AlphaZero-style policy/value training with self-play/RL if benchmarks justify it.
- [ ] Decide ONNX vs TensorFlow.js export path.
- [ ] Rebuild self-play/training scripts with reproducible `uv` config.
- [ ] Train baseline policy/value model.
- [ ] Export browser model artifact.
- [ ] Integrate model-assisted AI in browser.
- [ ] Evaluate against heuristic/MCTS baselines.
