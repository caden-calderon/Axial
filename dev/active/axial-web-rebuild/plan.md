# Axial Web Rebuild Plan

## Direction

Make Axial a polished browser-native strategy game. The active screen should remain the playable 3D board with compact controls, clear game state, and excellent visual readability.

Near-term priority: begin the next session with a performance/refactor cleanup pass before new feature work. Focus first on the large Three.js/Threlte chunk warning, dead or duplicated code, component boundaries, and any maintainability issues from rapid iteration. After that audit, handle Caden's next directed gameplay/UI changes.

Classic-mode AI remains an important future lane. The target is an AI opponent that can beat Caden, and the current recommendation is documented in `dev/active/axial-web-rebuild/classic-ai-research.md`.

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
- Keep heavy visual dependencies out of the page controller. Classic MCTS should run through the
  worker in normal play, with any main-thread fallback loaded dynamically.
- Avoid broad visual dependency barrels when the app only needs a few Three helpers; prefer local
  scene helpers or explicit Three example modules when that keeps the bundle shape clearer.
- Keep the top-right status panel shell small. Match setup, appearance controls, tactical loadout
  details, and session stats should live in focused UI section components rather than one large
  mixed markup file.

## Active Implementation Choices

- WebGL game route disables SSR at the page boundary; do not leak Three/Threlte imports into server-executed code.
- Undo/redo/replay use canonical row/column move history and `replayMoves`.
- Control UI is an acrylic top-right panel that expands downward with stable width/radius.
- Expanded controls are organized as a match console: live state, Match, Appearance, and Session.
  The panel body is split into focused section components while the shell owns expansion and
  toolbar mode state.
- Match setup exposes local play, Classic AI, pre-match `Classic`/`Tactical` rules, board dimensions, win rules, and AI difficulty.
- Tactical mode currently has a fixed three-piece kit per player: two Blocker Combos and one Double Adjacent.
- Tactical sub-actions are replay-visible with special metadata so undo/redo and future AI training can reconstruct same-player continuations.
- Tactical actions are exposed through a `Pieces` mode in the top-right control pill; the dropdown shows either normal setup/status or piece details depending on whether Pieces mode is active.
- The centered desktop turn pill is a status-only chip with no arrow/expansion affordance; Tactical piece actions live in the top-right Pieces toolbar mode.
- Desktop control pills share the centered turn pill's full-height acrylic scale, while mobile keeps the tighter compact control height.
- Game-over modal actions distinguish `New match`, `Review from start`, and `Keep board`.
- Classic AI uses difficulty-aware minimum visible thinking time in addition to its worker search
  budget: Easy stays brisk, while Max waits long enough to feel deliberate even when the worker
  finds a fast obvious move. Larger boards scale Max's worker budget by board breadth/height, and
  true tactical forks are enforced before MCTS simulations. Softer non-terminal line-race
  heuristics still search, but immediate win, immediate block, own fork creation, and opponent fork
  prevention are treated as tactical root decisions.
- Classic MCTS combines UCT, RAVE, threat-ordered expansion, smart rollouts, and progressive bias.
  Progressive bias uses the fast heuristic move ranking as a decaying prior during child selection,
  with stronger difficulty presets passing larger bias values.
- Classic MCTS also uses bounded alpha-beta tactical lookahead for the stronger presets. The
  lookahead layer evaluates tempo-aware immediate threats, fork moves, center/shape, and multi-line
  race pressure; MCTS consumes it as a root prior and Max/Hard can let it override noisy rollout
  results when the deterministic score gap is large enough.
- RAVE should remain scoped to AMAF value estimates: blend AMAF with exploitation, then add
  exploration/progressive bias; update each node only from moves played after that node.
- Appearance setup includes exact board-grid color, piece shape, separate per-player gradient color
  pills, light/dark mode, axis-number visibility, grid-layer visibility, and click-to-confirm drop.
- Click-to-confirm is controller-owned board input state: first click arms a move, clicking a
  different column re-arms, and clicking the armed column commits. The scene receives the active
  preview plus a locked flag for the staged-column animation. The armed preview uses a tall,
  tapered beam and cell-sized square floor plate; preview meshes render above the grid so floor
  lines do not read as stripes through the piece. The beam begins just above the floor plate so it
  does not pierce the marker, and its contrast/pulse are tied to the same animation phase as the
  preview piece and square plate.
- Grid-layer visibility is a scene preference. Full cube grid remains default; floor-only mode
  swaps to reduced floor geometry while axis labels remain controlled only by the axis-number
  toggle. Axis labels stay mounted while hidden and live outside the grid remount key so toggling
  grid layers/axis numbers does not reset their camera-facing visibility state.
- Board color is live and persisted. Piece shape and player colors are pre-match loadout settings:
  they are editable on a fresh board, then locked after the first placed piece until
  `New match`/reset.
- Opponent mode and match rules are also pre-match setup choices and lock after the first placement.
- Board dimensions are pre-match setup choices. The baseline is 6 x 6 x 7, each dimension can be
  increased up to 10, and dimension changes reset only a fresh board; active/review boards stay
  locked.
- Win rules are pre-match setup choices for both Classic and Tactical: players can choose connect 4 or connect 5, and require 1, 2, or 3 completed lines to win. The core game snapshot carries the selected win condition so replay, undo/redo, and AI evaluate the same rules.
- Completed lines are first-class visual state during active play. They should be recomputed from board ownership, keyed with stable IDs, and rendered as persistent in-board markers so multi-line modes communicate progress before the final win.
- Result overlays should not interrupt critical board-state animation; after a winning line appears, the game-over modal waits for the completed-line draw/settle timing before opening.
- Result overlays should feel like part of the win sequence: the modal uses a short backdrop/dialog
  entrance animation and aligned action buttons after the completed-line delay.
- The SvelteKit app now uses `@sveltejs/adapter-cloudflare` directly instead of `adapter-auto`; Cloudflare Pages build settings, DNS notes, release workflow, and production smoke checklist live in `dev/active/axial-web-rebuild/deployment.md`.
- The game shell disables browser text selection to preserve a game-like interaction feel.
- Mobile app-like play is supported through PWA install metadata and a fullscreen toolbar control where the browser exposes the Fullscreen API.
- Desktop turn pill is independent from the AXIAL wordmark and fixed-width at top center, with a
  shorter pill width and larger status text than the first centered version.
- The AXIAL wordmark, board-dimension HUD text, and centered desktop turn pill use a synchronized
  subtle sequential glyph glow tied to the active board accent.
- Mobile keeps controls smaller, tucked top-right, and hides the turn pill.
- Variant mode design is tracked in `dev/active/axial-web-rebuild/variant-modes.md`; classic rules remain the default.

## Near-Term Priorities

1. Continue the cleanup audit in `apps/web/src/lib/game`, `packages/core`, and `packages/ai` for dead code, duplicated logic, stale helpers, and component boundaries that should be cleaned before more features land. The first web UI pass removed the unused `@threlte/extras` dependency, split the status panel into focused sections, and trimmed a stale controller getter.
2. Treat the remaining large Three.js/Threlte chunk warning as measured and acceptable for now: the 2026-06-07 cleanup removed accidental `@threlte/extras` and normal-path `@axial/ai` imports, reducing the client page chunk from `993.16 kB` minified / `273.01 kB` gzip to roughly `833 kB` minified / `216 kB` gzip after the follow-up section split. Revisit code-splitting when Axial gains a non-game first route, an intentional loading shell, or graphics-quality tiers.
3. Keep refactors behavior-preserving unless Caden explicitly asks for gameplay changes in the same area.
4. Respond to Caden-directed UI/gameplay changes after the cleanup pass has produced a clear map of risks and quick wins.
5. Add progress messages for longer Classic AI searches.
6. Extend the seeded evaluation harness with larger random/greedy/heuristic/basic-MCTS benchmark suites and JSONL-style match logs, including expanded board sizes, connect-5, and 2-3-line win targets.
7. Tune the TypeScript heuristic/MCTS/lookahead engine against those benchmarks and direct Caden
   challenge games. First benchmark target after the 2026-06-07 fork/lookahead fixes is to measure
   tactical-suite pass rate and latency across 6 x 6 x 7 through 10 x 10 x 10 boards, including
   connect-5 and 2-3-line win conditions.
8. Consider a dedicated benchmark CLI/script once match logging shape is clear.
9. Keep the old Python MCTS runnable only as a reference/baseline through the root `uv` environment.
10. Add PyTorch/training dependencies only when neural self-play work resumes.
11. Treat AlphaZero/PyTorch/ONNX as a later measured upgrade once the teacher/evaluation harness can prove neural guidance improves strength.
12. Benchmark and tune Classic AI latency/strength on expanded board sizes now that search geometry is dimension-aware.
13. Keep Tactical/special-piece AI deferred until Classic-mode AI is locked.
14. Add editable loadout UX for choosing the three Tactical specials when returning to Tactical polish.
15. Keep the production deploy loop healthy with local checks, Cloudflare deployment review, and production smoke tests before/after significant changes.

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

- Training pipeline cleanup.
- Neural model export/inference.
- Multiplayer.
- Hand tracking.

Older architecture details are archived in `dev/active/axial-web-rebuild/archive/2026-05-26-background.md`.
