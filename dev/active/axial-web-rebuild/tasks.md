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
- [x] Track completed lines as stable game-state markers during active multi-line matches.
- [ ] Add golden-position fixtures from the Python project.

## Deployment

- [x] Choose Cloudflare Pages as the first public host for `playaxial.dev`.
- [x] Switch SvelteKit from `adapter-auto` to explicit `@sveltejs/adapter-cloudflare`.
- [x] Pin the Cloudflare build Node version with `axial-web/.node-version`.
- [x] Document Cloudflare Pages build settings, Porkbun/Cloudflare DNS setup, and future multiplayer direction.
- [ ] Create the Cloudflare Pages project from Git.
- [ ] Move authoritative DNS for `playaxial.dev` from Porkbun DNS to the Cloudflare nameservers assigned to the zone.
- [ ] Attach `playaxial.dev` as the Pages custom domain after the first successful deploy.
- [ ] Add the future multiplayer Worker/Durable Object app when live invite links become the active task.

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
- [ ] Add progress messages from long-running Classic AI search.
- [x] Add difficulty presets.
- [x] Keep Classic AI rule-aware for configurable connect length and line-count win targets.
- [x] Improve Classic AI heuristic/MCTS behavior for 2-3-line targets by valuing and blocking non-terminal line progress.
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
- [x] Add a pre-match Classic/Tactical rules selector.
- [x] Add pre-match connect-length and lines-to-win controls for both modes.
- [x] Lock opponent mode and rules after the first placement until a new match/reset.
- [x] Remove inactive center-turn-pill arrow/side-expand affordance after Tactical actions moved to the top-right Pieces mode.
- [x] Differentiate the Double Adjacent icon from the general Pieces/loadout icon.
- [x] Restore desktop top-right control pill height while preserving the compact mobile toolbar.
- [ ] Build richer glass/acrylic board material.
- [x] Build first pass of emissive/glossy player piece materials.
- [ ] Add selective bloom or glow pass.
- [ ] Add convincing contact cues without broad fake ground shadows.
- [ ] Add quality presets.
- [x] Test desktop and mobile viewports.

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
