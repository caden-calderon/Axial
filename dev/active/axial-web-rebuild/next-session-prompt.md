# Next Session Prompt

We are continuing the Axial web rebuild in `/home/caden/projects/Axial`.

Start by reading:

- `/home/caden/projects/Axial/AGENTS.md`
- `/home/caden/projects/Axial/dev/active/axial-web-rebuild/context.md`
- `/home/caden/projects/Axial/dev/active/axial-web-rebuild/plan.md`
- `/home/caden/projects/Axial/dev/active/axial-web-rebuild/tasks.md`

The active app is `axial-web/apps/web`, a SvelteKit + TypeScript + pnpm app using Three.js/Threlte. The preserved Unity project is `axial-unity/`.

Next-session focus:

- Shift from visual/UI polish to serious Classic-mode AI planning.
- Goal: design and eventually train an AI opponent for the Classic game that can beat Caden.
- Treat "better than Caden" as the real benchmark, not just beating the random baseline.
- Do not start with Tactical/special-piece AI. Keep the first serious AI target locked to Classic rules.
- Start with architecture, research, and trade-off discussion before implementing or training.

Current game state:

- Classic board: 6 x 6 x 7, 252 cells, 42 gravity columns, connect 4 across horizontal, vertical, planar diagonal, and 3D diagonal directions.
- The web app is playable with projected column picking, drop preview, animated pieces, scene themes, light/dark mode, and toggleable axis labels.
- Undo/redo, game-over modal, new match, review-from-start, and keep-board actions are implemented.
- AI mode is unlocked with a first-pass random legal-move opponent in `axial-web/packages/ai`.
- The expanded match console shows Match, Appearance, and Session sections with pre-match Local/AI and Classic/Tactical setup controls.
- Tactical mode is playable with two Blocker Combos and one Double Adjacent per player, but Tactical AI/training should wait.
- Turn-time Tactical actions are available from a `Pieces` mode in the top-right control pill.
- Opponent mode, rules mode, piece shape, and player colors lock after the first placement; reset/new match unlocks them.
- Core rules and replay metadata already support Classic and Tactical, but Classic is the AI training target for now.

AI discussion goals:

- Research and compare plausible approaches for a strong Classic-mode opponent:
  - AlphaZero/AlphaGo-style self-play with policy/value network plus MCTS.
  - Strong handcrafted heuristic search and threat-space search.
  - MCTS with engineered rollout/evaluation features.
  - Hybrid path: heuristic/MCTS teacher first, neural model later.
  - Any exact/solver-inspired ideas that are realistic for a 6 x 6 x 7 connect-4-like game.
- Decide what "serious AI" means in measurable terms:
  - win rate against random/greedy/MCTS baselines,
  - latency budget in-browser,
  - strength against Caden,
  - training/evaluation reproducibility.
- Inspect the preserved Unity/Python project and existing training code before designing from scratch.
- Decide whether the training engine should be Python/PyTorch, TypeScript, Rust/WASM, or a hybrid.
- Decide what representation to use for search/training: current typed-array board, bitboards, feature planes, symmetry transforms, replay tensors, etc.
- Plan a staged path from baseline to strong opponent before writing large code.

Important files/directories to inspect:

- `axial-web/packages/core/src/index.ts`
- `axial-web/packages/core/src/index.test.ts`
- `axial-web/packages/ai/src/index.ts`
- `axial-web/apps/web/src/lib/game/state/gameController.svelte.ts`
- `axial-web/apps/web/src/routes/+page.svelte`
- `axial-unity/`
- Any existing Python/training/AI folders in the preserved project.
- `dev/active/axial-web-rebuild/variant-modes.md`

Expected workflow:

1. Review the current rules/core/AI state and preserved AI/training code.
2. Do focused research where current information matters; prefer primary/official sources and cite them.
3. Brainstorm 2-3 viable AI architecture paths with trade-offs.
4. Recommend a staged plan for building an AI that can beat Caden in Classic mode.
5. Update active docs/tasks with the chosen direction.
6. Only begin implementation after the plan is agreed or clearly low-risk.
7. When coding AI/core behavior, run focused tests:
   - `pnpm --filter @axial/core test:unit`
   - `pnpm --filter @axial/ai test:unit`
   - `pnpm check`, `pnpm lint`, `pnpm build` for web integration changes.

Use the Codex Browser plugin for visual/browser verification if its runtime is exposed. If the required Node REPL `js` tool is not exposed, report that concrete plugin issue and use local Playwright screenshots as fallback.

Recent checks passed:

- `pnpm --filter @axial/core test:unit`
- `pnpm --filter @axial/ai test:unit`
- `pnpm --filter @axial/web test:unit -- --run`
- `pnpm check`
- `pnpm lint`
- `pnpm build`

Known non-blocking build warnings:

- Large Three.js/Threlte game chunk.
- `adapter-auto` cannot detect a production environment during local build.
