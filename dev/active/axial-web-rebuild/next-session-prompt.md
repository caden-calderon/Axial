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

Begin with an engineering cleanup and performance pass before adding new features.

Primary starting goals:

1. Investigate the large Three.js/Threlte game chunk warning from `pnpm build`.
2. Audit the current web/game code for dead code, duplicated helpers, stale abstractions, and unclear boundaries.
3. Keep initial cleanup refactors behavior-preserving unless Caden explicitly asks for a gameplay/UI change in the same area.
4. After the cleanup map is clear, handle Caden's next requested gameplay/UI changes.

Caden expects to bring more additions and fixes next session. Do not push every tiny local edit; develop locally until the batch is worth pushing or Caden asks for a push.

## Current Production State

- Public site: `https://playaxial.dev`.
- Cloudflare Pages project: `playaxial`.
- GitHub integration is enabled; pushes to `main` deploy production.
- Porkbun remains the registrar, Cloudflare is authoritative DNS.
- The app has PWA metadata/icons, iOS home-screen metadata, and a SvelteKit service worker.
- Supported browsers show a fullscreen toolbar button.

## Current Game State

- Board: 6 x 6 x 7, 252 cells, 42 gravity columns.
- Win conditions are configurable before match start:
  - connect 4 or connect 5,
  - 1, 2, or 3 completed lines required to win.
- Multi-line scoring counts maximal contiguous runs, not every overlapping window. A connect-5 in connect-4 mode counts as one line unless it forms a crossing/separate run.
- Classic and Tactical modes are playable.
- Tactical currently has two fixed specials: Blocker Combo and Double Adjacent.
- Classic AI uses worker-backed TypeScript MCTS/search with Easy, Medium, Hard, and Max presets.
- Tactical AI is intentionally still a random normal-move baseline.
- Completed lines render with an animated line draw/glow and persistent marker.
- The game-over modal waits for line animation timing before opening.
- Last placed piece glows/pulses.
- Dark mode uses solid scene colors, not radial/background color fields.
- Piece drops are slower and softer than the first version.
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
- `axial-web/apps/web/src/lib/game/scene/CompletedLineLayer.svelte`
- `axial-web/apps/web/src/lib/game/state/gameController.svelte.ts`
- `axial-web/apps/web/src/lib/game/ui/GameStatusPanel.svelte`
- `axial-web/apps/web/src/routes/layout.css`

For rules/AI cleanup:

- `axial-web/packages/core/src/index.ts`
- `axial-web/packages/core/src/index.test.ts`
- `axial-web/packages/ai/src/index.ts`
- `axial-web/packages/ai/src/index.test.ts`
- `axial-web/apps/web/src/lib/game/state/aiWorkerClient.ts`
- `axial-web/apps/web/src/lib/game/workers/classicAi.worker.ts`

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
- `pnpm --filter @axial/web test:e2e`
- local desktop/mobile Playwright visual smoke

Known non-blocking issue to start with:

- `pnpm build` warns that a game chunk is larger than 500 kB after minification.

Important judgment:

- Do not chase bundle splitting blindly. Axial is currently a one-screen WebGL game, so some large first-load code is expected. The right answer may be a measured split, an intentional deferral, or removing accidental imports/dead code. Verify before changing architecture.
