# Axial Web Rebuild Plan

## Direction

Make Axial a polished browser-native strategy game. The active screen should remain the playable 3D board with compact controls, clear game state, and excellent visual readability.

Near-term priority: shift from visual/UI polish into serious Classic-mode AI planning. The target is an AI opponent that can beat Caden. Research and architecture decisions should come before large implementation or training work. The current recommendation is documented in `dev/active/axial-web-rebuild/classic-ai-research.md`.

## Current Architecture

- `axial-web/apps/web`: SvelteKit + TypeScript app with Three.js/Threlte rendering.
- `axial-web/packages/core`: pure TypeScript rules package.
- `axial-web/packages/ai`: pure TypeScript AI move-selection package.
- `axial-unity`: preserved Unity version.
- Production deployment target: Cloudflare Pages at `https://playaxial.dev`, with Porkbun kept as registrar and Cloudflare used as authoritative DNS.

Important boundaries:

- Keep game rules in `packages/core`, independent of Svelte/DOM/Three.
- Keep AI move selection in `packages/ai`, independent of Svelte/DOM/Three.
- Keep UI in `apps/web/src/lib/game/ui`.
- Keep 3D/rendering in `apps/web/src/lib/game/scene`.
- Keep scene palette metadata in `apps/web/src/lib/game/theming`.
- Keep controller/persistence/replay orchestration in `apps/web/src/lib/game/state`.

## Active Implementation Choices

- WebGL game route disables SSR at the page boundary; do not leak Three/Threlte imports into server-executed code.
- Undo/redo/replay use canonical row/column move history and `replayMoves`.
- Control UI is an acrylic top-right panel that expands downward with stable width/radius.
- Expanded controls are organized as a match console: live state, Match, Appearance, and Session.
- Match setup currently exposes local play, a random baseline AI opponent, and a pre-match `Classic`/`Tactical` rules selector; editable dimensions, timers, and AI difficulty are deferred until behavior exists.
- Tactical mode currently has a fixed three-piece kit per player: two Blocker Combos and one Double Adjacent.
- Tactical sub-actions are replay-visible with special metadata so undo/redo and future AI training can reconstruct same-player continuations.
- Tactical actions are exposed through a `Pieces` mode in the top-right control pill; the dropdown shows either normal setup/status or piece details depending on whether Pieces mode is active.
- The centered desktop turn pill is a status-only chip with no arrow/expansion affordance; Tactical piece actions live in the top-right Pieces toolbar mode.
- Desktop control pills share the centered turn pill's full-height acrylic scale, while mobile keeps the tighter compact control height.
- Game-over modal actions distinguish `New match`, `Review from start`, and `Keep board`.
- Appearance setup includes live scene theme, piece shape, per-player piece colors, light/dark mode, and axis-number visibility.
- Piece shape and player colors are pre-match loadout settings: they are editable on a fresh board, then locked after the first placed piece until `New match`/reset.
- Opponent mode and match rules are also pre-match setup choices and lock after the first placement.
- Win rules are pre-match setup choices for both Classic and Tactical: players can choose connect 4 or connect 5, and require 1, 2, or 3 completed lines to win. The core game snapshot carries the selected win condition so replay, undo/redo, and AI evaluate the same rules.
- Completed lines are first-class visual state during active play. They should be recomputed from board ownership, keyed with stable IDs, and rendered as persistent in-board markers so multi-line modes communicate progress before the final win.
- Result overlays should not interrupt critical board-state animation; after a winning line appears, the game-over modal waits for the completed-line draw/settle timing before opening.
- The SvelteKit app now uses `@sveltejs/adapter-cloudflare` directly instead of `adapter-auto`; Cloudflare Pages build settings, DNS notes, release workflow, and production smoke checklist live in `dev/active/axial-web-rebuild/deployment.md`.
- The game shell disables browser text selection to preserve a game-like interaction feel.
- Desktop turn pill is independent from the AXIAL wordmark and fixed-width at top center.
- Mobile keeps controls smaller, tucked top-right, and hides the turn pill.
- Variant mode design is tracked in `dev/active/axial-web-rebuild/variant-modes.md`; classic rules remain the default.

## Near-Term Priorities

1. Add progress messages for longer Classic AI searches.
2. Extend the seeded evaluation harness with larger random/greedy/heuristic/basic-MCTS benchmark suites and JSONL-style match logs, including connect-5 and 2-3-line win targets.
3. Tune the TypeScript heuristic/MCTS engine against those benchmarks and direct Caden challenge games.
4. Consider a dedicated benchmark CLI/script once match logging shape is clear.
5. Keep the old Python MCTS runnable only as a reference/baseline through the root `uv` environment.
6. Add PyTorch/training dependencies only when neural self-play work resumes.
7. Treat AlphaZero/PyTorch/ONNX as a later measured upgrade once the teacher/evaluation harness can prove neural guidance improves strength.
8. Keep Tactical/special-piece AI deferred until Classic-mode AI is locked.
9. Respond to Caden-directed UI/visual changes when needed.
10. Add editable loadout UX for choosing the three Tactical specials when returning to Tactical polish.
11. Keep the production deploy loop healthy with local checks, Cloudflare deployment review, and production smoke tests before/after significant changes.

## Testing Expectations

For UI/visual changes:

- Run `pnpm check`.
- Run `pnpm lint`.
- Run `pnpm build`.
- Use Browser plugin if its required runtime is exposed.
- If Browser plugin runtime is missing, say so and use local Playwright screenshots.

For game-core changes:

- Also run `pnpm --filter @axial/core test:unit` from `axial-web/`.
- Add focused tests when rules, replay, undo/redo, or serialization change.

For AI changes:

- Run `pnpm --filter @axial/ai test:unit` from `axial-web/`.
- Run web checks if controller/UI integration changes.

## Deferred Work

- Web Worker MCTS.
- Training pipeline cleanup.
- Neural model export/inference.
- Multiplayer.
- Hand tracking.

Older architecture details are archived in `dev/active/axial-web-rebuild/archive/2026-05-26-background.md`.
