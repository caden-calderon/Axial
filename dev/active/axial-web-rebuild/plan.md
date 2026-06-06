# Axial Web Rebuild Plan

## Direction

Make Axial a polished browser-native strategy game. The active screen should remain the playable 3D board with compact controls, clear game state, and excellent visual readability.

Near-term priority: shift from visual/UI polish into serious Classic-mode AI planning. The target is an AI opponent that can beat Caden. Research and architecture decisions should come before large implementation or training work.

## Current Architecture

- `axial-web/apps/web`: SvelteKit + TypeScript app with Three.js/Threlte rendering.
- `axial-web/packages/core`: pure TypeScript rules package.
- `axial-web/packages/ai`: pure TypeScript AI move-selection package.
- `axial-unity`: preserved Unity version.

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
- The game shell disables browser text selection to preserve a game-like interaction feel.
- Desktop turn pill is independent from the AXIAL wordmark and fixed-width at top center.
- Mobile keeps controls smaller, tucked top-right, and hides the turn pill.
- Variant mode design is tracked in `dev/active/axial-web-rebuild/variant-modes.md`; classic rules remain the default.

## Near-Term Priorities

1. Research and compare serious Classic-mode AI approaches: AlphaZero-style self-play, strong heuristic search, MCTS, threat-space search, and hybrid teacher/model paths.
2. Audit the preserved Unity/Python AI and training code before designing from scratch.
3. Define measurable strength targets, including baseline win rates, latency budget, reproducible evaluation, and "beats Caden" as the real benchmark.
4. Decide the training/search stack and representation: Python/PyTorch, TypeScript, Rust/WASM, typed arrays, bitboards, tensor feature planes, and symmetry handling.
5. Produce a staged Classic AI implementation plan before starting large-scale training.
6. Keep Tactical/special-piece AI deferred until Classic-mode AI is locked.
7. Respond to Caden-directed UI/visual changes when needed.
8. Add editable loadout UX for choosing the three Tactical specials when returning to Tactical polish.

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
