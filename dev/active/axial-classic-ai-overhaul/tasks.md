# Axial Classic AI Overhaul Tasks

## Phase 1 - Baseline and reproduction

- [x] Read the previous AI/mobile lane and Classic AI research.
- [x] Preserve and identify the current branch/commit/worktree state.
- [x] Freeze `classic-max-pre-overhaul-2026-07-15` configuration and results.
- [x] Run the original unit, rule, variant, and strength commands before engine changes.
- [x] Document why the original evaluations overstated Max strength.
- [x] Define a versioned replay/challenge fixture format.
- [x] Add synthetic fixtures for every required tactical/strategic regression class.
- [ ] Add captured Caden loss/replay fixtures when exact histories are available.
- [x] Correct misleading terminal/draw/truncation and permissive strength reporting.
- [x] Reconfirm canonical/search-state parity for every rule and supported dimension tuple.

## Phase 2 - Pipeline audit and architecture decision

- [x] Audit canonical conversion, gravity, line semantics, and value perspective.
- [x] Audit tactical/heuristic anchors and Connect-5/multi-line evaluation.
- [x] Audit lookahead breadth, candidate completion, score comparability, and quiescence.
- [x] Audit MCTS selection, expansion, widening, priors, RAVE/AMAF, and backup perspective.
- [x] Audit rollout greed, sparse non-terminal values, draw value, and distance shaping.
- [x] Audit root override, selected-branch depth, worker messages, cancellation, stale protection, and controller lifecycle.
- [x] Profile state conversion, cloning, ordering, evaluation, lookahead, simulations, and rollout length.
- [x] Compare hybrid threat search, implicit-value MCTS, pure alpha-beta, persistent reuse, rollout-only tuning, and Rust/WASM.
- [x] Lock the measured hybrid architecture and rollback boundaries in `plan.md` before implementation.

## Phase 3 - Implementation

- [x] Add fast segment-aware evaluation and deterministic move ordering.
- [x] Add iterative-deepening alpha-beta with common-depth root scores, quiescence, and bounded transpositions.
- [x] Add dual incremental hashes with clone/undo tests.
- [x] Correct mandatory fork blocking, forced-candidate priority, and the three-line search bypass.
- [x] Add support, endpoint, fork/double-threat, denial, distinct-line, completed-run, tempo, and Connect-5 features.
- [x] Add bounded non-terminal rollout evaluation and non-greedy multi-line rollout selection.
- [x] Key AMAF/RAVE by actual dropped cell identity.
- [x] Gate on search-selected branch depth and carry additive phase/depth/node telemetry through the worker/client.
- [x] Preserve deterministic seeded equal-work behavior and canonical public state.
- [x] Keep every difficulty preset centralized in `classic/presets.ts`.
- [x] Remove the artificial controller thinking delay.
- [x] Evaluate cross-request subtree reuse and intentionally defer it behind lifecycle/memory validation.
- [x] Add focused unit and regression tests beside each behavior.

## Phase 4 - Evaluation and tuning

- [x] Split deterministic controlled-work gates from wall-clock product comparisons.
- [x] Add mirrored/alternating paired openings, generated midgames, and challenge starts.
- [x] Report all six rules independently.
- [x] Distinguish terminal wins, losses, draws, truncations, illegal moves, and no-move failures.
- [x] Compare hybrid Max with frozen Max under equal 250 ms clocks.
- [x] Run full-preset Max versus the rule-aware heuristic from both seats across the custom rule matrix.
- [x] Establish controlled Easy < Medium < Hard and direct reproducible Max > Hard separation.
- [x] Report p50/p95 decision latency by rule and opening/midgame/late phase.
- [x] Run repeated paired evidence and retain wall-clock variability in the report.
- [ ] Run a meaningful recorded Caden challenge set and score the 70%/80% human gates.

## Phase 5 - Verification and handoff

- [x] Run the focused golden suite at 13/13 reduced and 13/13 real Max.
- [x] Run exhaustive parity over 600 games and 57,006 positions.
- [x] Run opt-in full-preset rule games and split the longest seats around the process ceiling.
- [x] Run deterministic Max-versus-Hard twice and confirm identical 3-1 histories.
- [x] Run `pnpm check`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm test`.
- [x] Run `pnpm build`.
- [x] Run the explicit AI Prettier check.
- [x] Run `git diff --check`.
- [x] Review the complete diff and preserve unrelated work.
- [x] Publish baseline, strength, latency, difficulty, and full-game evidence by rule.
- [x] Document wall-clock sensitivity and the pending human gate without claiming "unbeatable."
- [x] Give a direct TypeScript-headroom versus Rust/WASM conclusion.
