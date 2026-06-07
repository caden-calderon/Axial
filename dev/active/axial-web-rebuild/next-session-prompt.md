# Next Session Prompt

We are continuing the Axial web rebuild in `/home/caden/projects/Axial`.

Start by reading:

- `/home/caden/projects/Axial/AGENTS.md`
- `/home/caden/projects/Axial/dev/active/axial-web-rebuild/context.md`
- `/home/caden/projects/Axial/dev/active/axial-web-rebuild/plan.md`
- `/home/caden/projects/Axial/dev/active/axial-web-rebuild/tasks.md`
- `/home/caden/projects/Axial/dev/active/axial-web-rebuild/deployment.md`

The active app is `axial-web/apps/web`, a SvelteKit + TypeScript + pnpm app using Three.js/Threlte. The preserved Unity/Python project remains in `axial-unity/`.

## Session Focus

Continue from the latest gameplay/UI polish batch and handle Caden's next requested changes.

Primary starting goals:

1. Read the current docs and inspect the latest local diff/status before editing.
2. Keep Classic AI improvement benchmark-driven: Max is now slower/stronger on larger boards, but
   formal strength and latency benchmarks are still pending.
3. Add progress/status messaging for longer Classic AI searches if AI feel remains the active lane.
4. Keep refactors scoped and behavior-preserving unless Caden explicitly asks for gameplay/UI changes.

Caden expects to bring more additions and fixes next session. Do not push every tiny local edit; develop locally until the batch is worth pushing or Caden asks for a push.

## Current Production State

- Public site: `https://playaxial.dev`.
- Cloudflare Pages project: `playaxial`.
- GitHub integration is enabled; pushes to `main` deploy production.
- Porkbun remains the registrar, Cloudflare is authoritative DNS.
- The app has PWA metadata/icons, iOS home-screen metadata, and a SvelteKit service worker.
- Favicon/PWA icons now use Caden's updated `AxialLOGO.png` render. The source copy lives at
  `axial-web/apps/web/static/icons/axial-logo.png`; generated icon sizes use a modest crop around
  the app-icon frame.
- Supported browsers show a fullscreen toolbar button.

## Current Game State

- Board defaults to 6 x 6 x 7, 252 cells, 42 gravity columns. Setup can increase dimensions up to
  10 x 10 x 10 before the first move.
- Win conditions are configurable before match start:
  - connect 4 or connect 5,
  - 1, 2, or 3 completed lines required to win.
- Multi-line scoring counts maximal contiguous runs, not every overlapping window. A connect-5 in connect-4 mode counts as one line unless it forms a crossing/separate run.
- Classic and Tactical modes are playable.
- Tactical currently has two fixed specials: Blocker Combo and Double Adjacent.
- Classic AI uses worker-backed TypeScript MCTS/search with Easy, Medium, Hard, and Max presets.
  Max now has larger board-size-scaled budgets and non-terminal forcing/block-forcing heuristic
  moves search instead of instantly returning.
- Tactical AI is intentionally still a random normal-move baseline.
- Completed lines render with an animated line draw/glow and persistent marker.
- The game-over modal waits for line animation timing before opening.
- Last placed piece glows/pulses.
- Dark mode uses solid scene colors, not radial/background color fields.
- Piece drops use a stronger ease-out so they slow more gradually into the final cell.
- Appearance includes toggles for full grid/floor-only grid layers, axis numbers, and click-to-confirm
  drop. Confirm drop arms a column on first click and commits on the second click.
- Mobile app-like play is supported through install metadata plus the fullscreen toolbar button.

## Files To Inspect First

For bundle/performance cleanup:

- `axial-web/apps/web/vite.config.ts`
- `axial-web/apps/web/svelte.config.js`
- `axial-web/apps/web/package.json`
- `axial-web/apps/web/src/routes/+page.svelte`
- `axial-web/apps/web/src/lib/game/scene/AxialScene.svelte`
- `axial-web/apps/web/src/lib/game/scene/AxialWorld.svelte`
- `axial-web/apps/web/src/lib/game/scene/GamePiece.svelte`
- `axial-web/apps/web/src/lib/game/scene/BoardGrid.svelte`
- `axial-web/apps/web/src/lib/game/scene/DropPreview.svelte`
- `axial-web/apps/web/src/lib/game/scene/CompletedLineMarker.svelte`
- `axial-web/apps/web/src/lib/game/state/gameController.svelte.ts`
- `axial-web/apps/web/src/lib/game/ui/GameStatusPanel.svelte`
- `axial-web/apps/web/src/lib/game/ui/AppearancePanel.svelte`
- `axial-web/apps/web/src/routes/layout.css`

For rules/AI cleanup:

- `axial-web/packages/core/src/index.ts`
- `axial-web/packages/core/src/index.test.ts`
- `axial-web/packages/ai/src/index.ts`
- `axial-web/packages/ai/src/index.test.ts`
- `axial-web/packages/ai/src/classic/mcts.ts`
- `axial-web/packages/ai/src/classic/heuristic.ts`
- `axial-web/apps/web/src/lib/game/state/classicAiClient.ts`
- `axial-web/apps/web/src/lib/game/state/classicAi.worker.ts`

Docs:

- `dev/active/axial-web-rebuild/classic-ai-research.md`
- `dev/active/axial-web-rebuild/variant-modes.md`

## Suggested Workflow

1. Run or inspect the latest build warning before editing:
   - `cd /home/caden/projects/Axial/axial-web`
   - `pnpm build`
2. Determine what is actually in the large chunk:
   - inspect build output,
   - inspect imports from scene/UI files,
   - check whether Three/Threlte are all loaded on the first route by design,
   - decide whether lazy-loading the game scene or splitting heavy visual layers is worth it.
3. Audit for cleanup candidates:
   - unused exports/imports,
   - duplicated geometry/rules helpers,
   - component props that can be simplified,
   - stale screenshots/artifacts,
   - dead UI branches after recent toolbar/PWA changes,
   - overly large components that should be split only if it reduces real complexity.
4. Make a short plan before refactoring. Prefer small, behavior-preserving cleanups with focused tests.
5. After cleanup, ask for or proceed with Caden's next requested gameplay/UI changes.
6. Update `context.md`, `plan.md`, and `tasks.md` as decisions land.

## Verification Expectations

For cleanup/refactor-only changes:

- `pnpm check`
- `pnpm lint`
- `pnpm build`
- focused unit tests for touched packages:
  - `pnpm --filter @axial/core test:unit`
  - `pnpm --filter @axial/ai test:unit`
  - `pnpm --filter @axial/web test:unit -- --run`

For visual/UI changes:

- `pnpm --filter @axial/web test:e2e`
- Desktop and mobile visual smoke.
- Use the Codex Browser plugin if its required runtime tool is exposed. If it is not exposed, state that concrete issue and use local Playwright screenshots as fallback.

For production pushes:

- Push only when Caden asks or when a coherent batch is ready.
- After pushing `main`, check the Cloudflare Pages deployment and smoke `https://playaxial.dev`.

## Recent Checks From The Previous Session

- `pnpm check`
- `pnpm lint`
- `pnpm build`
- `pnpm --filter @axial/ai test:unit`
- `pnpm --filter @axial/web test:unit -- --run src/lib/game/state/gameController.test.ts`
- `pnpm --filter @axial/web test:e2e`
- local Playwright visual smoke for confirm-drop, floor-only grid mode, and Max AI delay on an
  8 x 8 x 8 board
- local Playwright visual smoke for square confirm/last-move floor markers and axis labels in
  floor-only mode
- local Playwright visual smoke for the beam/platform fix, axis-label toggle stability, and synced
  higher-contrast confirm-drop beam
- manifest JSON parse, static icon URL checks, and PWA E2E metadata checks after replacing the
  favicon/PWA icon assets

Latest visual behavior to preserve:

- Click-to-confirm uses a tall tapered armed-column beam and a square cell-floor plate, not a
  circular ring. The beam starts above the floor plate, is slightly higher contrast, and pulses in
  sync with the preview piece and square cell plate.
- Last-move emphasis also uses a square floor plate.
- Hover/drop previews render above the grid so floor lines do not visually cut through pieces.
- Axis numbers can stay visible when `Grid layers` is off.
- Favicon/PWA icons use the cropped generated outputs from
  `axial-web/apps/web/static/icons/axial-logo.png`; avoid reintroducing the old SVG icon assets.

Known non-blocking issue to start with:

- `pnpm build` warns that the game route chunk is larger than 500 kB after minification. Latest
  observed route chunk: `842.28 kB` minified / `218.07 kB` gzip.

Important judgment:

- Do not chase bundle splitting blindly. Axial is currently a one-screen WebGL game, so some large first-load code is expected. The right answer may be a measured split, an intentional deferral, or removing accidental imports/dead code. Verify before changing architecture.
