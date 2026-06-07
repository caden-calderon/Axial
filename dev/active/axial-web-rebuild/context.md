# Axial Web Rebuild Context

## Mission

Axial is being rebuilt from the preserved Unity/Python project into a polished browser-native strategy game. The active app is `axial-web/apps/web`, using SvelteKit, TypeScript, pnpm, Three.js, and Threlte. The old Unity project remains in `axial-unity/`.

Current next-session priority: start with a performance/refactor cleanup pass, especially the large Three.js/Threlte chunk warning, dead or duplicated code, and any obvious maintainability issues that accumulated during rapid gameplay/UI iteration. After that audit, handle Caden's next directed gameplay/UI changes.

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
- Future live multiplayer should be a separate Cloudflare Worker plus Durable Objects room service, with the web app remaining the frontend and `@axial/core` validating server-side moves.

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
- Tactical mode now has two playable specials in a fixed three-piece kit per player: two Blocker Combos and one Double Adjacent.
- Blocker Combo places a neutral gravity blocker first, then requires a regular piece in the same turn.
- Double Adjacent places one owned gravity piece, then requires a second owned gravity piece whose final landing cell is adjacent in the 26-neighbor 3D sense.
- Tactical replay history records special metadata on sub-actions so undo/redo and future AI/training can reconstruct same-player continuations.
- Piece appearance controls support cube, orb, and crystal shapes plus per-player color pickers.
- Board appearance uses an exact color picker instead of fixed scene presets. The Void purple remains the default board accent, and the old preset storage value is only used as a one-time color migration fallback.
- Piece shape and player colors lock after the first placed piece, including undo/review states; starting a new match unlocks them.
- Supported browsers expose a fullscreen toolbar button. Mobile users can also install Axial from the browser/home-screen flow for the more app-like experience.

## Visual/UI Decisions

- Corner logo is a clean AXIAL wordmark with current board dimensions underneath. The wordmark,
  dimensions, and centered desktop turn pill share a synchronized sequential glyph glow tied to the
  active board accent, with reduced-motion users getting static text.
- Turn labels use neutral language: `Your turn` and `Opponent's turn`.
- Desktop turn pill is top-centered, uses the same acrylic surface treatment as the controls, and is fixed-width so it does not resize between turn labels. The pill is intentionally shorter than the earlier version and uses larger status text.
- Mobile hides the turn pill and keeps the control pill tucked into the top-right corner.
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

Latest checks passed from `axial-web/apps/web` unless noted:

- 2026-06-07 Classic AI foresight pass from `axial-web/`: `pnpm --filter @axial/ai test:unit`,
  `pnpm check`, `pnpm lint`, `pnpm --filter @axial/web test:unit -- --run`,
  `pnpm --filter @axial/core test:unit`, and `pnpm build`.
- The foresight build retained only the known Three/Threlte route chunk warning; current route
  chunk is `843.05 kB` minified / `218.27 kB` gzip.
- `pnpm --filter @axial/web test:unit -- --run src/lib/game/state/gameController.test.ts` from `axial-web/`
- `pnpm --filter @axial/ai test:unit` from `axial-web/`
- `pnpm --filter @axial/core test:unit` from `axial-web/`
- `pnpm check`
- `pnpm lint`
- `pnpm build`
- `pnpm --filter @axial/web test:e2e`
- `pnpm smoke:production` against `https://playaxial.dev`
- `pnpm --filter @axial/web test:unit -- --run src/lib/game/state/gameController.test.ts`
- Browser plugin runtime was not exposed by tool discovery, so local Playwright fallback was used against `http://localhost:5174/`.
- Playwright fallback smoke passed: page loaded without page errors, AI mode selected, board clicks advanced through paired human/AI moves to `10 MOVES`.
- Worker smoke passed against `http://localhost:5173/`: Classic AI worker was created, page had no errors, and one human click advanced through the worker-backed AI reply to `2 MOVES`.
- Difficulty smoke passed against `http://localhost:5173/`: AI mode revealed Easy/Med/Hard/Max, Max selected correctly, the worker was created, and play advanced to `4 MOVES` with no page errors.

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

Visual verification used local Playwright screenshots because the Browser plugin was listed but the required Node REPL `js` execution tool was not exposed by tool discovery.

UI boundary cleanup from the 2026-06-07 follow-up:

- Split `GameStatusPanel.svelte` into focused UI sections:
  `PanelLiveStrip.svelte`, `MatchSettingsPanel.svelte`, `AppearancePanel.svelte`,
  `SessionRecordPanel.svelte`, and `TacticalLoadoutPanel.svelte`.
- Removed the stale `matchConfig` controller getter/import. Tactical test-only getters remain for
  explicit special-action assertions.
- Kept the refactor behavior-preserving; shared panel styling still comes from the existing global
  panel classes.

Board-dimension update from the 2026-06-07 follow-up:

- `@axial/core` now carries `dimensions` on `GameSnapshot`; `createGame`, `replayMoves`, legal
  moves, gravity, indexing, win-line scanning, and double-adjacent checks accept dynamic
  dimensions while keeping the 6 x 6 x 7 constants as default compatibility.
- Web scene geometry, labels, projected column picking, pieces, previews, and completed-line
  markers now render from `game.dimensions`.
- `@axial/ai` Classic geometry is now dimension-aware: row-major policy moves, cell-to-move
  mapping, segment tables, search-state heights, center bias, heuristic ordering, rollouts, and
  MCTS result conversion all use `game.dimensions`. Classic AI no longer falls back to random only
  because the board is larger.

Latest cleanup verification:

- `pnpm check`
- `pnpm lint`
- `pnpm build`
- `pnpm --filter @axial/core test:unit`
- `pnpm --filter @axial/ai test:unit`
- `pnpm --filter @axial/web test:unit -- --run`
- `pnpm --filter @axial/web test:e2e`
- Local Playwright fallback smoke against `http://localhost:5174/`: desktop board loaded, one
  move placed successfully, mobile board framed correctly, and no page errors, console errors, or
  failed requests were observed. Screenshots were written to `/tmp/axial-cleanup-desktop.png` and
  `/tmp/axial-cleanup-mobile.png`.
- Local Playwright fallback orbit-control smoke against preview `http://localhost:4173/`: board
  drag completed with no page errors, console errors, or failed requests. Screenshot was written to
  `/tmp/axial-cleanup-orbit-drag.png`.
- Local Playwright fallback smoke against current dev server `http://localhost:5173/`: desktop,
  Tactical Pieces mode, mobile collapsed, and mobile expanded all rendered with one canvas and no
  page errors, console errors, or failed requests. Screenshots were written to
  `/tmp/axial-cleanup-section-split-desktop-2.png`,
  `/tmp/axial-cleanup-section-split-tactical-2.png`,
  `/tmp/axial-cleanup-section-split-mobile-2.png`, and
  `/tmp/axial-cleanup-section-split-mobile-expanded.png`.
- Local Playwright fallback smoke for the board-size/modal pass against `http://localhost:5173/`:
  desktop expanded panel changed the board to 7 x 7 x 8, mobile expanded did the same, and a real
  seven-move Player 1 win opened the polished result modal. No page errors, console errors, or
  failed requests were observed. Screenshots were written to
  `/tmp/axial-expanded-pill-dimensions.png`, `/tmp/axial-mobile-expanded-dimensions.png`, and
  `/tmp/axial-result-modal-polished-2.png`.
- Local Playwright fallback smoke for the appearance/AI geometry pass against
  `http://localhost:5173/`: desktop and mobile expanded panels showed the grouped Board color /
  Piece look / Theme controls with custom `#4be0ff`, no repeated arena footer text, and no page
  errors, console errors, or failed requests. Desktop AI mode on a 7 x 7 x 8 board advanced through
  a worker-backed reply to `2 MOVES`. Screenshots were written to
  `/tmp/axial-appearance-custom-color-desktop.png`, `/tmp/axial-large-board-ai-reply.png`, and
  `/tmp/axial-appearance-custom-color-mobile.png`.
- Local Playwright fallback smoke for the AI timing/HUD/appearance polish pass against
  `http://localhost:5173/`: mobile expanded panel showed separate gradient P1/P2 pills, no Board
  color subheader, and glyph-split AXIAL/dimension HUD text. Max Classic AI did not respond within
  the first 900ms after a human move and completed the worker-backed reply after about 3.9s with no
  page errors, console errors, or failed requests. Screenshots were written to
  `/tmp/axial-ai-hud-appearance-polish-mobile.png` and
  `/tmp/axial-ai-thinking-delay-desktop.png`.
- Local Playwright fallback smoke for the synchronized HUD glow pass against
  `http://localhost:5173/`: AXIAL, board dimensions, and the centered turn pill all used the same
  `0s`, `0.12s`, `0.24s` glyph delay sequence; the center pill rendered shorter with larger text.
  Screenshot was written to `/tmp/axial-hud-sync-turn-chip.png`.
- Local Playwright fallback smoke for the confirm-drop/grid/AI pass against
  `http://localhost:5173/`: Confirm drop armed a column without placing on the first click and
  placed on the second click; Grid layers toggled to floor-only mode; Max Classic AI on an 8 x 8 x 8
  board did not reply before the visible thinking floor and completed the worker-backed reply after
  about 3.57s. No page errors, console errors, or failed requests were observed. Screenshots were
  written to `/tmp/axial-confirm-drop-armed.png`, `/tmp/axial-flat-grid-mode.png`, and
  `/tmp/axial-max-ai-large-board-delay.png`.
- Local Playwright fallback smoke for the square cue polish against `http://localhost:5173/`:
  Confirm drop stayed at `0 MOVES` after the first click, committed to `1 MOVE` after the second
  click, floor-only mode kept axis labels visible, and screenshots showed square confirm/last-move
  floor markers with no center ring through the preview piece. No page errors, console errors, or
  failed requests were observed. Screenshots were written to
  `/tmp/axial-square-confirm-floor-axis.png` and `/tmp/axial-square-last-move.png`.
- Local Playwright fallback smoke for the beam/platform and label-stability pass against
  `http://localhost:5173/`: Confirm drop stayed at `0 MOVES` after the first click, the beam began
  above the square floor plate, and grid/axis toggles at a low oblique angle kept labels visible
  without obvious readjustment. No page errors, console errors, or failed requests were observed.
  Screenshots were written to `/tmp/axial-beam-above-platform.png` and
  `/tmp/axial-axis-labels-after-toggles.png`.
- Local Playwright fallback smoke for the synced confirm-beam pass against `http://localhost:5173/`:
  Confirm drop stayed at `0 MOVES` after the first click, the beam was slightly higher contrast, and
  the beam opacity shared the same pulse phase as the preview piece and square floor plate. No page
  errors, console errors, or failed requests were observed. Screenshot was written to
  `/tmp/axial-synced-confirm-beam.png`.
- Classic AI fork-regression verification from `axial-web/`: `pnpm --filter @axial/ai test:unit`,
  `pnpm --filter @axial/web test:unit -- --run`, `pnpm --filter @axial/core test:unit`,
  `pnpm check`, `pnpm lint`, and `pnpm build` passed. The build kept the known
  Three/Threlte route chunk warning at `842.36 kB` minified / `218.10 kB` gzip.
- Favicon/PWA icon replacement verification passed: manifest JSON parsed, old SVG icon filenames no
  longer appeared in source references, `/icons/apple-touch-icon.png`, `/icons/axial-icon-192.png`,
  and `/icons/axial-icon-512.png` returned `200 OK` from the dev server, and the PWA E2E metadata
  test passed.

Useful screenshots in `axial-web/apps/web/` include:

- `axial-ui-match-console-desktop-light.png`
- `axial-ui-match-console-mobile-expanded-light.png`
- `axial-ui-match-console-mobile-collapsed-light.png`
- `axial-ai-random-desktop-light.png`
- `axial-ai-random-mobile-expanded-light.png`
- `axial-match-mode-card-desktop-light.png`
- `axial-match-mode-card-mobile-expanded-light.png`
- `axial-piece-customizer-desktop-light.png`
- `axial-piece-customizer-mobile-expanded-light.png`
- `axial-piece-appearance-locked-desktop-light.png`
- `axial-piece-appearance-locked-mobile-light.png`
- `axial-tactical-blocker-combo-desktop-light.png`
- `axial-tactical-blocker-combo-mobile-light.png`
- `axial-tactical-double-adjacent-desktop-light.png`
- `axial-tactical-double-adjacent-mobile-light.png`
- `axial-tactical-pieces-toolbar-desktop-light.png`
- `axial-tactical-pieces-toolbar-mobile-light.png`
- `axial-toolbar-scale-desktop-collapsed-dark.png`
- `axial-toolbar-scale-desktop-dark.png`
- `axial-toolbar-scale-mobile-dark.png`
- `axial-ui-desktop-turn-chip-fixed-longer-width.png`
- `axial-ui-mobile-light-centered-collapsed.png`
- `axial-ui-mobile-light-centered-expanded.png`
- `axial-polish-game-over-desktop.png`

## Key Files For Next Work

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
- `axial-web/apps/web/src/lib/game/scene/GamePiece.svelte`
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
