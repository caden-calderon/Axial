# Axial Web Rebuild Context

## Mission

Axial is being rebuilt from the preserved Unity/Python project into a polished browser-native strategy game. The active app is `axial-web/apps/web`, using SvelteKit, TypeScript, pnpm, Three.js, and Threlte. The old Unity project remains in `axial-unity/`.

Current priority: move from visual/UI polish into serious Classic-mode AI planning. Caden wants an AI opponent that can beat him as the benchmark. The next session should research and compare approaches before starting large implementation or training work. Tactical/special-piece AI remains deferred.

## Game Facts

- Board: 6 x 6 x 7, with 252 cells.
- Objective: connect 4 horizontally, vertically, planar diagonally, or 3D diagonally.
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

Implemented gameplay/UX:

- Playable 6 x 6 x 7 board with projected column picking.
- Drop preview and animated beveled cube pieces.
- Scene themes, dark/light mode, and toggleable axis labels.
- Undo, redo, rematch, and replay-from-start via canonical move history.
- Game-over modal with winner, move count, rematch, replay, and review actions.
- Collapsible top-right control panel with smooth downward expansion.
- Expanded match console with Match, Appearance, and Session sections.
- Session record tracks Player 1 wins, Player 2 wins, and draws once per completed match.
- AI opponent mode is unlocked with a first-pass random legal-move opponent.
- Match setup exposes `Classic` and `Tactical` modes and locks opponent/rules after the first placement.
- Tactical mode now has two playable specials in a fixed three-piece kit per player: two Blocker Combos and one Double Adjacent.
- Blocker Combo places a neutral gravity blocker first, then requires a regular piece in the same turn.
- Double Adjacent places one owned gravity piece, then requires a second owned gravity piece whose final landing cell is adjacent in the 26-neighbor 3D sense.
- Tactical replay history records special metadata on sub-actions so undo/redo and future AI/training can reconstruct same-player continuations.
- Piece appearance controls support cube, orb, and crystal shapes plus per-player color pickers.
- Piece shape and player colors lock after the first placed piece, including undo/review states; starting a new match unlocks them.

## Visual/UI Decisions

- Corner logo is a clean AXIAL wordmark with `6 x 6 x 7` dimensions underneath.
- Turn labels use neutral language: `Your turn` and `Opponent's turn`.
- Desktop turn pill is top-centered, uses the same acrylic surface treatment as the controls, and is fixed-width so it does not resize between `Your turn` and `Opponent's turn`.
- Mobile hides the turn pill and keeps the control pill tucked into the top-right corner.
- Collapsed controls keep the same rounded shape and clip hidden panel content to zero height, so the icon row is truly centered vertically.
- Tactical turns use a `Pieces` mode in the top-right control pill: the leftmost toolbar button swaps normal controls for special-piece actions, while the dropdown opens either the normal setup menu or piece details depending on the active toolbar mode.
- The centered desktop turn pill is now status-only, with no arrow or inactive side-expansion affordance.
- Desktop top-right controls use the same full-height acrylic pill scale as the centered turn pill, while mobile keeps the smaller compact toolbar.
- The Double Adjacent special uses a distinct copy-plus icon so it does not read as the general Pieces/loadout button.
- Light mode is warmer/desaturated, with stronger board-grid contrast and glow accents.
- Axis labels behave as a readable overlay: bottom numbers on clockwise perimeter rails; X/Y fixed side candidates; Z fixed corner rail candidates; camera-based fades prevent duplicate clutter.
- Expanded controls now behave like a match console: a compact live strip, local/AI mode surface, Classic/Tactical rules selector, current setup cards, live appearance controls, and a session record.
- AI mode is represented in the Match section and currently uses a random legal-move opponent as the baseline behavior.
- Board dimensions, connect length, clock state, and Tactical kit counts are shown as current setup facts; match mode is editable only before the active match starts.
- Game-over actions are labeled by intent: `New match` clears the board, `Review from start` rewinds the completed move list for redo stepping, and `Keep board` dismisses the result.
- Text selection is disabled on the game shell so dragging across the HUD/panel does not create browser text highlights.
- Piece style and player colors are live appearance settings persisted in local storage and applied to placed pieces and drop previews.
- Piece style and color choices behave like pre-match loadout choices: they are editable on a fresh board, then locked for the active match once any piece has been placed.
- Tactical/special-piece brainstorming and implementation notes are captured in `dev/active/axial-web-rebuild/variant-modes.md`.

## Recent Verification

Latest checks passed from `axial-web/apps/web` unless noted:

- `pnpm --filter @axial/web test:unit -- --run` from `axial-web/`
- `pnpm --filter @axial/ai test:unit` from `axial-web/`
- `pnpm --filter @axial/core test:unit` from `axial-web/`
- `pnpm check`
- `pnpm lint`
- `pnpm build`

Known non-blocking build warnings:

- Large Three.js/Threlte game chunk.
- `adapter-auto` cannot detect a production environment during local build.

Visual verification used local Playwright screenshots because the Browser plugin was listed but the required Node REPL `js` execution tool was not exposed by tool discovery.

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

- Research AlphaZero-style self-play, strong heuristic search, MCTS, threat-space search, and hybrid teacher/model approaches for Classic Axial.
- Inspect the preserved Unity/Python project for existing AI, training, checkpoints, heuristics, and reusable evaluation ideas.
- Define a measurable strength benchmark, including win rates against baselines and direct play against Caden.
- Decide the training/search stack: Python/PyTorch, TypeScript, Rust/WASM, or a hybrid.
- Decide the board representation for search/training: current typed arrays, bitboards, tensor feature planes, symmetry transforms, and replay formats.
- Produce a staged implementation plan before starting large-scale training.
- Keep Tactical/special-piece AI deferred until Classic-mode AI direction is locked.

## Next Polish Candidates

- More Caden-directed UI changes.
- Add editable loadout UX for choosing the three Tactical specials.
- Graphics quality settings.
- Richer glass/acrylic board material.
- Selective bloom or intentional glow pass.
- Better piece contact cues without broad fake ground shadows.
- Further mobile viewport tuning.

Older architecture/background details were archived to `dev/active/axial-web-rebuild/archive/2026-05-26-background.md`.
