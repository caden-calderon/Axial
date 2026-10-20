# Axial Classic AI Overhaul Plan

Date: 2026-07-15

Status: implementation and machine evaluation complete; recorded Caden challenge gate pending.

## Goal

Build the strongest practical pre-RL Classic opponent for Connect 4 and Connect 5 with one, two, or three distinct maximal lines required to win. Max is an "unbeatable" north-star, not a claim: the label remains unsupported until focused strategy fixtures, paired tournaments, and recorded Caden challenge games provide the evidence.

Caden's human-play failures outrank the previous optimistic evaluation summaries. The first obligation is to reproduce and explain those failures, not to defend the current tuning.

## Scope and invariants

In scope:

- Classic mode only, including supported custom board dimensions.
- Heuristic evaluation, adversarial lookahead, threat-space search, MCTS, rollouts, backup semantics, state representation, persistent search, performance, presets, worker integration, telemetry, and evaluation.
- Larger real Max budgets only after measured evidence shows that added work improves decisions.
- A TypeScript optimization path first, with a Rust/WASM migration recommendation only if profiling demonstrates a practical ceiling.

Out of scope:

- Tactical/special-piece AI, RL, policy/value networks, AlphaZero, ONNX, multiplayer behavior, broad UI redesign, fake thinking delays, and main-thread search.
- Commit, push, reset, revert, or discard operations unless Caden explicitly requests them.

Hard invariants:

- The canonical `@axial/core` snapshot remains the public state contract.
- Heavy search remains in the Web Worker; cancellation and stale-request shielding remain intact.
- Distinct completed lines use maximal contiguous runs. Overlapping windows in one maximal run never count as multiple lines.
- Seeded equal-work evaluation must be deterministic. Wall-clock evaluation is reported separately because deadline-bounded search is machine sensitive.

## Frozen baseline

Baseline name: `classic-max-pre-overhaul-2026-07-15`

- Branch: `codex/classic-ai-mobile-overhaul`
- Commit: `b3276d389967eeec1eccad208e3d003fcc67210e`
- Commit subject: `Overhaul Classic AI and portrait controls`
- Worktree at freeze: clean. The lane still treats all pre-existing repository state as preserved and will not rewrite history.
- Max preset: 6,000 base simulations, 3,600 ms base whole-decision limit, depth-3 base lookahead, 16,000 base lookahead nodes, smart rollout rate 0.86, RAVE, progressive bias, and progressive widening. Rule scaling raises the observed Connect-5/three-line decision cap to about 6.65 seconds.

| Command | Wall time | Result | What it actually proves |
| --- | ---: | --- | --- |
| `pnpm --filter @axial/ai test:unit` | 10.18 s | 52 passed, 15 skipped | Current deterministic unit suite is green. |
| `pnpm --filter @axial/ai eval:rules` | 12.96 s | 1 passed | Heuristic-only floor: zero simulations and zero lookahead. All four Connect-5 multi-line games truncated non-terminal at 72 moves. |
| `pnpm --filter @axial/ai eval:rules:full` | 87.60 s | 1 passed | Two empty-board Connect-4/two-line games against the heuristic; Max won both. Lookahead was incomplete on 6 and 12 Max decisions. |
| `pnpm --filter @axial/ai eval:variants` | 1,008.31 s | 12 passed | Eight terminal empty-board games for four selected variants. Connect-4/three-line split by opener; the other three variant pairs were Max wins in this run. |
| `pnpm --filter @axial/ai eval:strength` | 61.72 s | 1 passed | Max won 3 of 4 against Easy. Contrary to the test title, Max lost `two-lines-max-second`; the assertion permits one loss. |

Baseline conclusions:

1. The green rule matrix is not a Max evaluation. It disables MCTS and lookahead, aggregates line counts, and accepts non-terminal Connect-5 truncations.
2. The strength test title says Max wins both seats under both rules, while its assertion only requires three wins. This run passed with a real Max loss.
3. Full-budget tests begin from an empty board against one deterministic heuristic. They do not cover captured human positions, paired seeded openings, the frozen Max at equal work, Hard separation, or diverse opponent styles.
4. Most long-horizon Max decisions do not finish their requested root lookahead. In the two Connect-5/three-line games, 70 Max decisions reported incomplete lookahead and 53 final choices used the heuristic anchor.
5. Nominally seeded wall-clock games are not fully reproducible. The prior lane recorded an 88-move Connect-5/two-line second-seat game; this frozen rerun ended in 56 moves under the same code path.
6. Passing these commands is useful regression evidence, but it does not contradict Caden's play-test result or establish coherent multi-line planning.

## Required decision-pipeline audit

The audit follows this exact chain and records representation, value perspective, time ownership, cancellation, and telemetry at every boundary:

```text
canonical game
-> ClassicSearchState conversion
-> tactical/heuristic anchor
-> root lookahead
-> move ordering and priors
-> MCTS selection/expansion
-> rollout policy
-> backup/value semantics
-> root selection/override
-> worker response
-> controller lifecycle
```

The investigation will test, rather than assume, the following hypotheses:

- Terminal-only MCTS backup erases strategically essential non-terminal line progress.
- Rollouts greedily bank or block the first line and fail to model multi-line races, denial, tempo, support, forks, and distinct future lines.
- Partial root searches create incomparable candidate scores and consume a large fraction of Max's budget.
- Rebuilding the tree each move discards useful work and prevents deeper practical search.
- The current evaluator lacks playable-endpoint, support, parity, independent-threat, and completed-run-extension semantics needed by Connect 5.
- RAVE perspective/weighting, progressive bias, widening, draw value, result-distance shaping, and root override rules may be internally consistent yet strategically harmful.
- Allocation, cloning, full line scans, or rollout length may cap TypeScript throughput before the algorithm reaches useful depth.

## Architecture decision gate

No broad engine tuning or replacement begins until challenge fixtures and profiling exist. The architecture will be selected by measured failure class, with this provisional ranking used for investigation:

1. **Hybrid threat-space/quiescence search plus improved TypeScript MCTS.** Add forced-threat extensions and local adversarial certainty around tactical instability; give MCTS a durable non-terminal/implicit-minimax signal for long races. This is the leading candidate because Axial combines a 42-move root with sharp gravity tactics.
2. **MCTS with implicit-minimax or non-terminal value backup.** Preserve broad stochastic planning while backing up strategically meaningful heuristic values, especially completed-line progress and denial. Risk: biased values can double-count priors or overwhelm rollout evidence.
3. **Persistent tree reuse, transposition caching, and incremental hashing.** Promote the selected subtree after each move and reuse state/evaluation work. This is likely complementary rather than sufficient by itself; it increases depth but cannot repair a wrong value signal.
4. **Iterative-deepening negamax/alpha-beta with a transposition table.** Strong candidate for forced lines and stable equal-work determinism. Risk: 42 legal root moves and long multi-line horizons may make it too selective without excellent ordering and threat pruning.
5. **Improved rollout-only TypeScript MCTS.** Lower-risk evolutionary option, but not favored unless fixtures show rollout policy—not backup/horizon—is the dominant defect.
6. **Rust/WASM search.** A deployment option only after TypeScript profiling and optimized algorithms demonstrate insufficient throughput. A faster implementation of the wrong search is not a solution.

The final architecture decision must document fixture outcomes, profile data, expected strength gain, implementation risk, deterministic behavior, worker impact, and rollback surface for each option.

## Architecture decision - locked 2026-07-15

Selected design: **TypeScript hybrid threat search plus value-aware MCTS**, implemented behind the existing pure package and Web Worker boundary.

Measured basis:

- Exhaustive canonical/search parity passed across 600 generated games, 57,006 intermediate positions, all 100 supported dimension tuples, and all six Classic rules. Representation correctness is not the current failure.
- On the captured two-line Max loss, full-budget Max repeated the losing move. It spent 1,935 ms evaluating only 262 lookahead nodes; none of 18 root candidates completed the requested depth. It then spent 2,862 ms on 1,663 simulations and 21,606 rollout plies.
- `ClassicSearchState` conversion and cloning cost about 0.01-0.04 ms per operation in the deterministic profile. They are not the primary ceiling.
- `evaluatePosition` costs about 0.01-0.09 ms, but `evaluateLookaheadPosition` costs about 2.2-5.7 ms and full move ordering costs about 2.5-7.3 ms because both repeatedly scan forks, line completions, and all legal moves inside each node.
- A nominal 4,000-node depth-3 lookahead completed only 420-574 nodes and took 1.4-4.4 seconds on representative positions. The current Max cannot make root scores comparable before its deadline.
- Terminal rollouts remain expensive: 80 simulations cost roughly 0.09-1.16 seconds depending on rule/phase. Connect-5/three-line rollouts are the worst case.
- Current RAVE keys AMAF statistics by gravity column. The same column played later lands at a different height, so those actions are not interchangeable. This violates the intended action identity and can contaminate values.
- The global `maxDepth` strategy floor proves only that some branch reached the threshold; it does not prove the selected root move received meaningful depth.
- The tactical blocker treats several independent opponent fork-creation moves as interchangeable and returns after occupying only one. The captured loss reached four fork-creating replies, then two simultaneous terminal columns.
- The three-line direct-line guard bypasses search whenever the heuristic happens to bank or deny one line. This directly creates the reported individual-line greediness.

Selected components, in implementation order:

1. **Fast incremental analysis and ordering.** Remove nested `scoreLegalMoves`/`findForcingMoves` calls from every adversarial node. Use affected segments, playable endpoints, support distance, distinct-line progress, immediate threats, and compact deterministic ordering. Keep the richer evaluator at leaf boundaries only where its cost is bounded.
2. **Comparable iterative-deepening adversarial spine.** Replace one partial fixed-depth pass with iterative deepening over the root set. Only a depth completed for all retained root candidates becomes the authoritative comparison. Add alpha-beta/negamax, a bounded transposition table with incremental two-lane hashes, immediate-losing-move pruning, and short quiescence/forced-threat extensions.
3. **Correct tactical certainty.** Immediate terminal wins remain universal. Immediate terminal defense remains mandatory. Own proven forks may remain tactical. An opponent fork block is only a hard return when the move actually removes the forced set; multiple independent fork creators go to adversarial search. Remove the unconditional three-line bank/block return.
4. **Bounded value-aware MCTS rollouts.** Preserve MCTS for broad quiet positions, but cap rollout plies and back up a normalized non-terminal evaluation at the horizon. Terminal results remain exact. Non-terminal line progress, denial, and tempo therefore survive backup instead of disappearing until a full game ends.
5. **Non-greedy multi-line rollout policy.** Terminal wins/blocks remain forced. Non-terminal banking and denial become weighted candidates rather than unconditional first choices, allowing counter-threats, support, forks, and race tempo to compete.
6. **Gravity-correct AMAF or no RAVE.** Key AMAF by the actual dropped cell, not only the row/column move index; disable it for a preset if paired ablation shows no benefit.
7. **Selected-branch evidence and telemetry.** Enforce minimum useful depth on the selected root branch, not global tree maximum. Report common completed lookahead depth, partial depth, candidate coverage, per-phase time, tree nodes, rollout plies, selected-branch depth, and root statistics through the worker.
8. **Persistent reuse as a second optimization, not the first fix.** The worker already survives between completed requests. After value/search correctness stabilizes, evaluate promoting the AI move plus human reply subtree. Reuse is accepted only with bounded memory, exact history/hash validation, and cancellation/reset invalidation.

Why the alternatives rank lower:

- **Improved rollout-only MCTS** cannot repair incomplete adversarial root comparisons, the false fork-block gate, or sparse non-terminal values by itself.
- **Pure negamax/alpha-beta** is attractive for tactics and determinism but too brittle as the sole planner across a 42-100 move root and long multi-line races. It is the deterministic spine, not the whole engine.
- **Persistent tree reuse alone** makes the existing value mistakes deeper and more confident.
- **Rust/WASM** is rejected for this phase. The profile shows orders-of-magnitude algorithmic waste in TypeScript while state operations are already cheap. Re-profile after the hybrid is optimized; migrate only if correct TypeScript search then misses the strength/latency gates.

Rollback boundaries:

- Fast ordering/evaluation, adversarial search, rollout value, AMAF identity, and presets remain separate modules/options.
- Deterministic fixtures and equal-work ablations must precede enabling each component in Max.
- The existing worker/client public request shape remains compatible; new telemetry fields are additive.
- Persistent reuse, if attempted, remains worker-local and can fall back to a fresh root without changing canonical game state.

## Implemented outcome

Engine/config id: `classic-max-hybrid-threat-v1`

The selected hybrid was implemented without changing the canonical game contract or moving search onto the main thread:

- `ClassicSearchState` now maintains two incremental 32-bit position hashes through make/unmake/clone for a bounded adversarial-search transposition table.
- `fastEvaluation.ts` provides affected-segment move ordering and leaf evaluation with playable endpoints, support distance, distinct-line progress, immediate threats, and race tempo.
- Root lookahead is now iterative-deepening alpha-beta with common-depth commitment, bounded root breadth, transpositions, and tactical quiescence for wins, blocks, and forks. A partial deeper iteration never overwrites the last depth completed for every retained root move.
- Tactical returns are limited to proven terminal/forcing behavior. A fork defense is mandatory only when the move neutralizes the remaining fork set, forced candidates cannot be replaced by higher-scoring non-forced moves, and the former unconditional three-line bank/block guard is gone.
- MCTS rollouts are bounded and back up a normalized non-terminal leaf value when the horizon is reached. Terminal results remain exact. Multi-line rollout ordering samples several high-value race moves instead of unconditionally taking the first non-terminal line bank/block.
- AMAF/RAVE is keyed by the actual dropped cell, not a gravity column whose landing height changes over time.
- Search-depth gating is based on the search-selected root branch. Phase time, nodes, rollout plies, common/partial lookahead depth, candidate coverage, and selected-branch depth are additive worker telemetry.
- Easy/Medium/Hard/Max presets remain centralized. The controller's artificial 420 ms response floor was removed; only real search time remains.
- Persistent MCTS subtree promotion was evaluated and deliberately deferred. The measured defects were value, tactical certainty, and root-score comparability; reuse before those fixes would have amplified bad values and added cancellation/reset state. Incremental hashes and bounded per-decision transpositions capture the low-risk reuse first.

## Final measured evidence

### Correctness and golden positions

- Canonical/search parity: 600 generated legal games, 57,006 intermediate positions, all six rules, and all 100 supported dimension tuples passed.
- Focused challenge suite: 13/13 at reduced deterministic work and 13/13 with the real Max preset. Coverage includes immediate wins/blocks, support, forks/double threats, distinct-line banking/denial, completed-run extension rejection, captured race blunders, Connect-5 buildup, and two/three-line tempo.
- Default AI unit gate: 62 passed, 43 opt-in evaluations skipped after the final fixture addition.
- The full workspace tests include controller reset/undo/rule-change stale-work scenarios and all 16 Playwright tests.

Equal-clock frozen-baseline challenge decisions at 250 ms:

| Rule | Frozen Max | Hybrid Max | Interpretation |
| --- | ---: | ---: | --- |
| Connect 4 / 1 line | 4/4 | 4/4 | Non-regression. |
| Connect 4 / 2 lines | 4/5 | 5/5 | Strict captured-fork improvement. |
| Connect 4 / 3 lines | 0/1 | 1/1 | Strict improvement: search now evaluates the former guard bypass. |
| Connect 5 / 1 line | 1/1 | 1/1 | Non-regression. |
| Connect 5 / 2 lines | 1/1 | 1/1 | Non-regression plus deeper completed lookahead. |
| Connect 5 / 3 lines | 1/1 | 1/1 | Non-regression plus deeper completed lookahead. |

The critical Connect-4/two-line criterion is a strict fixture gain rather than a tournament win: its latest full paired series tied 5-5. This distinction is intentional and must not be collapsed into the aggregate result.

### Equal-clock frozen-Max tournament

The final refresh used a 250 ms decision clock, mirrored seats, static openings, generated balanced midgames, and rule-matched challenge positions. Every one of 62 games terminated; there were zero draws, truncations, illegal/no-move results, or hidden aggregate failures.

| Rule | Hybrid wins | Frozen wins | Latest series | Earlier observed series |
| --- | ---: | ---: | --- | --- |
| Connect 4 / 1 line | 6 | 6 | tie | 6-6 |
| Connect 4 / 2 lines | 5 | 5 | tie | 5-5 |
| Connect 4 / 3 lines | 6 | 4 | hybrid win | 5-5 |
| Connect 5 / 1 line | 8 | 2 | hybrid win | 8-2 |
| Connect 5 / 2 lines | 6 | 4 | hybrid win | 9-1 |
| Connect 5 / 3 lines | 7 | 3 | hybrid win | 10-0 |
| **Total** | **38** | **24** | **hybrid majority** | **43-19** |

Wall-clock seeding does not make deadline-bounded node counts deterministic. The repeated Connect-5 series stayed positive but changed margins; deterministic controlled-work gates are therefore used for reproducibility claims, while equal-clock games remain the product-latency comparison.

Candidate p50/p95 decision time in the same 250 ms paired tournament:

| Rule | Overall | Opening | Midgame | Late |
| --- | ---: | ---: | ---: | ---: |
| Connect 4 / 1 line | 13.33 / 254.66 ms | 21.51 / 254.66 ms | 7.71 / 10.91 ms | no samples |
| Connect 4 / 2 lines | 250.73 / 256.33 ms | 252.07 / 259.09 ms | 18.90 / 253.77 ms | no samples |
| Connect 4 / 3 lines | 251.07 / 258.90 ms | 254.92 / 259.55 ms | 250.75 / 256.27 ms | 21.75 / 251.41 ms |
| Connect 5 / 1 line | 250.94 / 254.69 ms | 251.31 / 255.40 ms | 251.91 / 255.32 ms | 250.62 / 253.67 ms |
| Connect 5 / 2 lines | 251.65 / 256.13 ms | 253.44 / 256.39 ms | 252.38 / 257.73 ms | 251.37 / 254.77 ms |
| Connect 5 / 3 lines | 252.16 / 258.44 ms | 254.58 / 264.84 ms | 254.77 / 261.35 ms | 251.46 / 256.56 ms |

### Full-preset strength

Every full-preset terminal match gate passed:

| Rule | Opponent | Max as P1 | Max as P2 |
| --- | --- | --- | --- |
| Connect 4 / 1 line | Easy preset | win in 7 plies | win in 8 plies |
| Connect 4 / 2 lines | rule-aware heuristic | 2-0 in 15 plies | 2-1 in 18 plies |
| Connect 4 / 3 lines | rule-aware heuristic | 3-1 in 19 plies | 3-0 in 20 plies |
| Connect 5 / 1 line | rule-aware heuristic | 1-0 in 123 plies | 1-0 in 48 plies |
| Connect 5 / 2 lines | rule-aware heuristic | 2-0 in 25 plies | 2-0 in 120 plies |
| Connect 5 / 3 lines | rule-aware heuristic | 3-0 in 177 plies | 3-2 in 148 plies |

`eval:variants` starts at Connect-4/three-line, so Connect-4/one-line uses the actual Max-versus-Easy preset gate. Max also beat Easy from both seats in Connect-4/two-line, making that full-preset command 4-0 overall.

The deterministic controlled-work Max-versus-Hard gate uses 256 versus 128 simulations and 4,000 versus 1,200 lookahead nodes with no deadline. It passed 3-1 twice with identical seeded histories: Max split Connect-4/one-line 1-1 and won both Connect-4/two-line seats. This is the reproducible capability separation; real preset wall-clock Max-versus-Hard remained deadline-sensitive and varied between 2-2 and 3-1.

Controlled golden-suite ladder after the final fixture:

| Difficulty | All fixtures | Strategic fixtures | Mean selected depth |
| --- | ---: | ---: | ---: |
| Easy | 7/13 | 5/9 | 0.77 |
| Medium | 10/13 | 6/9 | 1.23 |
| Hard | 13/13 | 9/9 | 1.38 |
| Max | 13/13 | 9/9 | 1.85 |

Hard and Max saturate this fixture set, so their actual strength separation comes from the direct deterministic 3-1 match gate, not elapsed time alone.

### Performance profile and language decision

The new fast move ranker costs 0.07-0.19 ms per full root ranking versus 3.14-5.24 ms for the rich legacy scorer on representative positions: roughly 23x-46x faster. Current depth-3 common lookahead completed 643-1,163 nodes in 75-335 ms; the frozen implementation completed only 420-574 nodes in 1.4-4.4 seconds on the comparable profile. State conversion and clone remain small at roughly 0.01-0.04 ms.

**Conclusion: TypeScript still has substantial headroom; Rust/WASM is not the next pre-RL step.** The dominant gains came from search semantics and removing repeated full-board work, not from changing language. A Rust/WASM port would add serialization, deployment, debugging, and dual-implementation risk while current TypeScript already clears parity, full-game strength, latency, worker, and cancellation gates. Reconsider only after a larger human challenge set identifies a strength ceiling and profiling shows optimized search throughput—not value quality—as the blocker.

## Remaining evidence gaps

- No meaningful recorded Caden challenge set was supplied. The 70% human score gate and 80% "feels unbeatable" north-star remain pending; Max is not described as unbeatable.
- Connect-4 one-line and two-line tied the frozen engine in the latest equal-clock tournament. They meet non-regression, and two-line has a strict captured-fixture gain, but broader paired openings are still the right next evidence if those modes remain a concern.
- Full-preset decisions intentionally consume approximately 3.6-6.6 seconds by rule. The p50/p95 phase table above is the equal-clock 250 ms comparison; product-scale full-preset phase percentiles should be refreshed if preset budgets change.
- Persistent subtree reuse remains a measured follow-up, not unfinished correctness work. Require bounded memory, exact hash/history validation, and invalidation tests for undo/reset/rule change before enabling it.

## Challenge-position and evaluation contract

Each permanent challenge records:

- stable id, description, source, dimensions, win condition, move history, player to move, and optional seed/opening id;
- expected legal moves or strategic properties rather than overfitting every position to one coordinate;
- required properties such as immediate win/block, new distinct-line bank, direct denial, support trap avoidance, fork creation/prevention, independent Connect-5 threats, or tempo preservation;
- forbidden properties, captured engine move/result, telemetry, and regression tags.

Evaluation is split into five layers:

1. Fast deterministic CI correctness and golden fixtures.
2. Focused strategy fixtures, including synthetic adversarial positions and recorded Caden losses.
3. Reduced-budget paired tournaments using equal work, mirrored openings, and alternating seats.
4. Opt-in full-budget wall-clock tournaments with p50/p95 latency and explicit truncations.
5. Recorded Caden challenge games, targeting at least 70% score and treating 80%+ as the "feels unbeatable" north-star.

Every tournament reports each of the six rule combinations separately. Aggregate scores may summarize but never hide a weak rule.

## Implementation phases and gates

### Phase 1: baseline and reproduction

- Freeze the current code/config/results under the named baseline.
- Define a versioned challenge fixture format and add synthetic multi-line/Connect-5 failures.
- Capture Caden games as soon as move histories are available.
- Reconfirm canonical/search-state parity over generated legal games and supported dimensions.
- Correct evaluation assertions that overstate their evidence.

Gate: deterministic failures exist before broad tuning.

### Phase 2: measured architecture decision

- Instrument candidate coverage, completed depth, per-phase time, simulations, rollout length, allocations/proxies, and stop reasons.
- Audit values, perspectives, root selection, line semantics, and worker/controller lifecycle.
- Benchmark targeted experimental branches/options against the same fixed fixtures and equal-work baseline.
- Finalize the ranked architecture decision in this file before production implementation.

Gate: chosen design is tied to measured failure causes and has explicit rollback boundaries.

### Phase 3: implementation

- Implement small typed modules with unit tests beside each behavior.
- Preserve deterministic seeded behavior, worker isolation, cancellation, stale-request protection, and canonical state.
- Add persistent/cached structures only with lifecycle and memory bounds.
- Keep presets centralized in `classic/presets.ts`.

Gate: the focused golden suite passes with no parity or lifecycle regression.

### Phase 4: evaluation and tuning

- Compare frozen and new Max at equal work for every critical rule.
- Establish actual Easy < Medium < Hard < Max capability separation.
- Run full-budget paired series, report terminal wins/losses/draws/truncations, and record p50/p95 time.
- Tune only parameters supported by repeated paired evidence.

Gate: new Max beats the frozen baseline in every critical custom rule and does not lose a paired rule series to the rule-aware heuristic.

### Phase 5: verification and handoff

- Run `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build`, and `git diff --check`.
- Publish before/after strength and latency tables by rule, remaining evidence gaps, and the TypeScript versus Rust/WASM conclusion.
- Keep the human challenge gate explicitly pending if the recorded set is not meaningful in size.

## Acceptance criteria

The objective's correctness, strategy, strength, performance, UX, and difficulty-ladder criteria are binding. In particular:

- No illegal/stale result or line-count regression.
- 100% focused tactical/strategic golden suite pass.
- New Max improves over frozen Max at equal wall-clock or equal-work budgets in every critical custom rule, not only in aggregate.
- Full-budget Max does not lose a paired rule series to the rule-aware heuristic and shows reproducible separation from Hard.
- No "unbeatable" claim without a meaningful recorded human set.
