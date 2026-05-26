# Axial Web Rebuild Context

## Current Source Project

Axial is currently a Unity + Python desktop project:

- Game: 3D Connect-4 variant on a 6 x 6 x 7 board.
- Objective: connect 4 in any horizontal, vertical, planar diagonal, or 3D diagonal direction.
- Interaction: Unity/MediaPipe hand tracking in the original project. Rebuild will start with mouse/pointer controls.
- AI runtime: Python enhanced MCTS, Numba-accelerated 1D board, TCP JSON bridge to Unity.
- Training experiments: PyTorch policy/value network and neural MCTS exist under `Training/`, but they are not the active Unity runtime path.

Important current implementation details:

- Board index formula: `idx = h + r * D + c * D * R`
- Dimensions: `D = 6` height, `R = 6` rows/depth, `C = 7` columns.
- Legal moves are 42 surface columns `(row, col)`; gravity selects the first empty height.
- Active AI uses tactical checks before MCTS:
  - take immediate wins
  - block immediate opponent wins
  - create double threats
  - block opponent forcing moves
  - use smart rollouts and center bias

## Rebuild Goal

Rebuild Axial as a browser-playable SvelteKit + TypeScript + pnpm project with Three.js/Threlte for 3D rendering. Use this as an opportunity to improve architecture, UX, visuals, maintainability, testability, and AI strength.

Initial scope excludes MediaPipe hand tracking. Mouse, touch, and pointer interactions are the target controls.

User decisions locked on 2026-05-26:

- New web project lives at `axial-web/`.
- Existing Unity project should be retained at `axial-unity/`.
- `axial-web/` is intended to overtake Unity as the main version.
- Priority order: make the web remake beautiful and polished first, then return to stronger AI/training.
- Visual direction starts as elegant sci-fi glass, with architecture open to selectable future scenes/vibes.

## Current Web Implementation

`axial-web/` is now a pnpm workspace with:

- `apps/web/`: SvelteKit + TypeScript app using Threlte/Three.js for the playable 3D route.
- `packages/core/`: pure TypeScript game rules package with typed-array board representation and unit tests.

The web app is organized into focused layers:

- `src/lib/game/state/`: Svelte game controller, persistence, current labels, and move orchestration.
- `src/lib/game/scene/`: Threlte scene, board geometry, pieces, previews, and raycast hit volumes.
- `src/lib/game/theming/`: scene palettes and selectable scene metadata.
- `src/lib/game/ui/`: HUD, status panel, and scene selector components.

The current route disables SSR at the page boundary with `+page.ts` because the first route is WebGL-only. If we add docs, menus, or non-game pages, keep those routes SSR-capable and lazy-load the 3D play route.

Current visual-label behavior:

- Bottom perimeter numbers are generated as four clockwise rails around the board.
- X/Y axis letters are fixed side-rail candidates with smooth opacity fades instead of position swaps.
- Z labels and height numbers are fixed corner-rail candidates with opacity crossfades; they no longer physically slide through the cube as the camera crosses center.
- Text labels use a non-depth-tested basic material so labels behave like a readable board overlay rather than disappearing behind dense grid lines.

## Session Handoff - 2026-05-26

Latest polish work focused on board readability and label behavior. `BoardLabels.svelte` now treats labels as a stable board overlay:

- Bottom numbers follow the clockwise perimeter pattern Caden requested.
- X and Y axis letters fade between fixed side candidates instead of swapping positions abruptly.
- Z labels fade between fixed corner rails instead of physically traveling across the board.
- Back-side rails are allowed to fade to zero opacity, reducing duplicate readable labels.

Last verified commands from `axial-web/`:

- `pnpm --filter @axial/core test:unit`
- `pnpm check`
- `pnpm lint`
- `pnpm build`

All passed. Known non-blocking build warnings remain:

- The game route has a large Three.js/Threlte chunk.
- `adapter-auto` cannot detect a production environment during local build.

The Browser plugin runtime was listed but its executable browser control API was not exposed in the session. Visual checks used local Playwright screenshots as a fallback. Useful recent screenshots live in `axial-web/apps/web/` with names beginning `axis-label-fade-static-v2-`.

No known blocker remains in the label system. Caden may still want small hands-on tuning after orbiting the board for a few minutes.

Recommended next work before AI:

- Finish core game-loop polish: game-over modal, rematch/replay controls, undo/redo.
- Add graphics quality settings and a mobile viewport pass.
- Improve the glass/acrylic board material and selective bloom/glow.
- Add better contact cues for pieces without returning to broad fake ground shadows.
- Keep AI work deferred until the visual and control feel is locked.

## Current Stack Guidance Checked

- SvelteKit supports disabling SSR per page with `export const ssr = false`; doing this globally turns the app into an SPA. For WebGL/Three.js we should isolate browser-only rendering to the game route/component rather than disabling SSR everywhere unless we intentionally ship as a pure game SPA.
- Threlte scenes are typically structured as a `<Canvas>` containing a direct child scene component. Scene-level components can use `interactivity()` from `@threlte/extras` for pointer/click events via raycasting.
- Three.js supports strong browser visuals through physical/standard materials, shadows, environment lighting, custom shaders, postprocessing/bloom, and instancing/reused geometry for performance.

## Non-Goals For First Build

- No hand tracking in phase 1.
- No multiplayer in phase 1.
- No attempt to port Unity code line-for-line.
- No trained/neural AI in phase 1.
- No Python backend required for browser gameplay, unless training/offline tooling needs Python.
