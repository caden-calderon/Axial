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
- [ ] Add golden-position fixtures from the Python project.

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
- [ ] Add undo/redo.
- [ ] Add game over modal and replay controls.
- [ ] Add graphics quality settings.

## Phase 2: Browser AI

- [ ] Create `packages/ai`.
- [ ] Implement random and greedy players.
- [ ] Port enhanced MCTS to TypeScript.
- [ ] Move MCTS into a Web Worker.
- [ ] Add progress and cancellation messages.
- [ ] Add difficulty presets.
- [ ] Benchmark AI strength and latency.

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
- [ ] Build richer glass/acrylic board material.
- [x] Build first pass of emissive/glossy player piece materials.
- [ ] Add selective bloom or glow pass.
- [ ] Add convincing contact cues without broad fake ground shadows.
- [ ] Add quality presets.
- [ ] Test desktop and mobile viewports.

## Immediate Next Polish Candidates

- [ ] Review the current board in-browser with Caden's latest label expectations and make any tiny label opacity/placement adjustments.
- [ ] Add game-over modal with winner, move count, rematch, and replay entry points.
- [ ] Add undo/redo backed by canonical move history.
- [ ] Add graphics quality presets for glow/postprocessing, shadows/contact cues, and low-power mode.
- [ ] Improve the glass/acrylic board material and selective bloom so glow feels intentional rather than uniformly bright.
- [ ] Run a desktop/mobile visual pass for text fit, control placement, camera framing, and click/tap ergonomics.
- [ ] Keep AI work paused until the playable web remake feels polished enough to be the main version.

## Phase 4: Neural AI

- [ ] Audit existing `Training/` code and checkpoints.
- [ ] Decide ONNX vs TensorFlow.js export path.
- [ ] Rebuild self-play/training scripts with reproducible config.
- [ ] Train baseline policy/value model.
- [ ] Export browser model artifact.
- [ ] Integrate model-assisted AI in browser.
- [ ] Evaluate against heuristic/MCTS baselines.
