# Next Session Prompt

We are continuing the Axial web rebuild in `/home/caden/projects/Axial`.

Read and follow:

- `/home/caden/projects/Axial/AGENTS.md`
- `/home/caden/projects/Axial/dev/active/axial-web-rebuild/context.md`
- `/home/caden/projects/Axial/dev/active/axial-web-rebuild/plan.md`
- `/home/caden/projects/Axial/dev/active/axial-web-rebuild/tasks.md`

The active app is `axial-web/apps/web`. It is a SvelteKit + TypeScript + pnpm project using Three.js/Threlte. The old Unity version is preserved in `axial-unity/`. Do not start AI/training work yet; the current priority is visual, interaction, and game-loop polish before AI.

Current state:

- The 6 x 6 x 7 board is playable with mouse/click controls.
- The board uses projected column picking, drop preview, vertical-only drop animation, beveled cube pieces, scene themes, dark/light mode, and a collapsible top-right control panel.
- Axis labels are toggleable. Bottom numbers are clockwise perimeter rails. X/Y labels are fixed side candidates with camera-based fade. Z labels are fixed corner rail candidates with camera-based fade.
- Recent verification passed: `pnpm --filter @axial/core test:unit`, `pnpm check`, `pnpm lint`, and `pnpm build`.
- Known build warnings are the large Three.js/Threlte game chunk and local `adapter-auto` environment detection.

Start by inspecting these files:

- `axial-web/apps/web/src/lib/game/scene/BoardLabels.svelte`
- `axial-web/apps/web/src/lib/game/scene/BoardGrid.svelte`
- `axial-web/apps/web/src/lib/game/scene/GamePiece.svelte`
- `axial-web/apps/web/src/lib/game/scene/ColumnPicker.svelte`
- `axial-web/apps/web/src/lib/game/scene/AxialWorld.svelte`
- `axial-web/apps/web/src/lib/game/scene/geometry.ts`
- `axial-web/apps/web/src/lib/game/state/gameController.svelte.ts`
- `axial-web/apps/web/src/lib/game/ui/GameStatusPanel.svelte`
- `axial-web/apps/web/src/lib/game/theming/sceneThemes.ts`

Use the Codex Browser plugin for visual verification if its runtime is exposed. If it is not exposed, report the concrete plugin issue and use local Playwright screenshots as the fallback.

Goal for the session:

Polish the web remake before AI. First review the current game in-browser, then choose and implement the highest-impact polish slice. Good candidates are game-over modal/replay controls, undo/redo, richer glass/acrylic material, selective bloom/glow, better piece contact cues, graphics quality settings, mobile viewport polish, or minor label opacity tuning if needed.

Keep files under 1000 LOC, preserve the current architecture, update the active docs/tasks as work is completed, and run `pnpm check`, `pnpm lint`, `pnpm build`, plus focused unit tests and visual screenshots.
