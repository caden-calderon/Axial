# Axial Classic AI Overhaul Context

Date: 2026-07-15

Status: implementation, machine evaluation, and repo verification complete. Recorded Caden challenge gate pending.

## Start here

1. `plan.md` for the baseline, architecture decision, and full evidence tables.
2. `tasks.md` for completed work and the remaining human gate.
3. `axial-web/packages/ai/src/classic/challengeFixtures.ts` for permanent strategy positions.
4. `axial-web/packages/ai/src/paired.eval.test.ts` for equal-clock frozen-baseline tournaments.
5. `axial-web/packages/ai/src/rules.eval.test.ts` and `strength.eval.test.ts` for full-preset and difficulty separation gates.

## Preservation contract

- Do not reset, revert, discard, commit, or push unless Caden explicitly requests it.
- Frozen baseline: `classic-max-pre-overhaul-2026-07-15`, commit `b3276d389967eeec1eccad208e3d003fcc67210e`, branch `codex/classic-ai-mobile-overhaul`.
- The frozen bundle used by local comparisons is `/tmp/axial-classic-ai-baseline.mjs`; regenerate it from the detached `/tmp/axial-classic-ai-baseline` worktree if `/tmp` is cleared.
- Tactical/special-piece AI, RL, multiplayer behavior, and broad UI work remain out of scope.

## Current engine

Engine id: `classic-max-hybrid-threat-v1`

Primary implementation:

- `classic/state.ts`: canonical-compatible mutable search state plus dual incremental hashes.
- `classic/fastEvaluation.ts`: fast segment-aware move ordering and leaf evaluation.
- `classic/lookahead.ts`: iterative-deepening alpha-beta, common-depth root scores, bounded transpositions, and threat quiescence.
- `classic/heuristic.ts`: corrected mandatory candidate selection and conservative fork defense.
- `classic/mcts.ts`: bounded value-aware rollouts, gravity-correct AMAF identity, selected-branch depth gate, and phase telemetry.
- `classic/presets.ts`: centralized actual difficulty budgets.
- `classic/challenges.ts` and `challengeFixtures.ts`: versioned replay/expectation/observation contract and 13 fixtures.
- Worker/client message files: additive telemetry; request and stale-result lifecycle remain compatible.
- `gameController.svelte.ts`: fake 420 ms thinking floor removed.

Persistent MCTS subtree reuse was evaluated but not enabled. Per-decision transpositions capture safe reuse; cross-request promotion needs bounded memory and exact invalidation for undo/reset/rule changes before it is worth the lifecycle risk.

## Final evidence snapshot

- Parity: 600 games, 57,006 positions, six rules, 100 supported dimension tuples.
- Golden challenges: 13/13 reduced and 13/13 real Max.
- Equal-clock baseline challenge comparison: strict gains at Connect-4/two-line (5/5 versus 4/5) and Connect-4/three-line (1/1 versus 0/1); non-regression elsewhere.
- Equal-clock frozen-Max tournament: 38-24 over 62 terminal games; per-rule hybrid/frozen results are 6-6, 5-5, 6-4, 8-2, 6-4, 7-3.
- Full-preset rule games: Max won both seats in Connect-4/two-line, Connect-4/three-line, and all three Connect-5 variants. Max also beat Easy 4-0 across Connect-4 one/two-line from both seats.
- Deterministic Max-versus-Hard: 3-1 in two repeated runs with identical seeded histories.
- Controlled ladder: Easy 7/13, Medium 10/13, Hard 13/13, Max 13/13; mean selected depth 0.77, 1.23, 1.38, 1.85. Direct Max-versus-Hard supplies the strength distinction after the fixture set saturates.
- Current profile: fast ranking is roughly 23x-46x faster than the rich legacy scorer; depth-3 common lookahead completes 643-1,163 nodes in 75-335 ms on representative cases.

Deadline-bounded results are not deterministic from a seed alone. Repeated Connect-5 paired margins varied from 9-1 to 6-4 and 10-0 to 7-3 while remaining positive. Reproducibility claims must use controlled work; product comparisons may use equal clocks and must report variability.

## Commands and final results

Run from `axial-web`:

```text
pnpm --filter @axial/ai test:unit              # 62 passed, 43 opt-in skipped
pnpm --filter @axial/ai eval:parity            # 600 / 57,006 / 6 / 100
pnpm --filter @axial/ai eval:challenges        # 13 passed
pnpm --filter @axial/ai eval:challenge:full    # 13 passed
pnpm --filter @axial/ai eval:challenges:baseline
pnpm --filter @axial/ai eval:ladder
pnpm --filter @axial/ai eval:rules
pnpm --filter @axial/ai eval:rules:full
pnpm --filter @axial/ai eval:variants
pnpm --filter @axial/ai eval:strength
pnpm --filter @axial/ai eval:strength:hard
pnpm --filter @axial/ai eval:profile
pnpm --filter @axial/ai eval:paired
```

`eval:variants` can exceed the shell process window when all rules are run together. Filter the longest rule by seat without changing its budget:

```text
AXIAL_AI_VARIANT=connect5-three-lines AXIAL_AI_SEAT=1 pnpm --filter @axial/ai eval:variants
AXIAL_AI_VARIANT=connect5-three-lines AXIAL_AI_SEAT=2 pnpm --filter @axial/ai eval:variants
```

Likewise, refresh paired latency per rule with `AXIAL_AI_PAIRED_RULE=<rule-label>`; valid labels are in `paired.eval.test.ts`.

Final workspace gate after implementation was green:

- `pnpm check`: 0 Svelte errors and 0 warnings; TypeScript checks passed.
- `pnpm lint`: passed.
- `pnpm test`: core 22, AI 62, multiplayer worker 11, web unit 64, Playwright 16 all passed.
- `pnpm build`: passed; the existing >500 kB chunk advisory remains non-blocking.
- AI source Prettier check and `git diff --check`: passed.

## Known gaps and next work

1. Caden replay histories were not supplied. Add them with `source.kind = "caden-game"`, preserve the exact dimensions/rules/history, and run a meaningful alternating-seat set before scoring the 70%/80% human targets.
2. Do not call Max unbeatable. Machine evidence is substantially stronger, but the human gate is intentionally open.
3. Connect-4 one-line and two-line tied the frozen Max in the latest full paired tournament. Two-line has a strict captured-fixture gain; add more paired openings if those modes remain a product concern.
4. Full Max still consumes multi-second budgets and wall-clock outcomes remain scheduler-sensitive. Use deterministic work for regressions and equal clocks for product comparisons.
5. TypeScript remains the recommended pre-RL implementation. Reconsider Rust/WASM only after a larger human set demonstrates a strength ceiling and profiling shows throughput—not search/value quality—is the blocker.
