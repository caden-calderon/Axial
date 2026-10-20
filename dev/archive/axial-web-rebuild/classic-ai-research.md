# Classic AI Research And Architecture

Date: 2026-06-06

## Goal

Build a Classic-mode opponent that can beat Caden. Random and greedy baselines are useful sanity checks, but they are not the real benchmark.

Classic constraints:

- Board is 6 x 6 x 7, with 252 cells and 42 gravity columns.
- Win condition is connect 4 across 13 positive directions.
- Tactical/special-piece AI is out of scope until Classic strength is locked.
- Browser play must remain responsive; serious search needs an async worker boundary.

## Current Code Audit

The web rebuild is in good shape for AI work:

- `axial-web/packages/core/src/index.ts` has pure Classic/Tactical rules, legal moves, gravity, win/draw detection, replay, and immutable snapshots.
- `axial-web/packages/ai/src/index.ts` currently has only `chooseRandomMove`, so it is a baseline package rather than a serious engine.
- `axial-web/apps/web/src/lib/game/state/gameController.svelte.ts` queues the current random AI with a timeout in the Svelte controller. Serious AI should move behind an async/cancellable AI client, ideally backed by a Web Worker.

The preserved AI work is richer than the current web package:

- `main/bitboard.py` and `main/mcts.py` contain a Numba-backed flat-array engine with threat detection, immediate win/block, forcing-move detection, threat-scored expansion, smart rollouts, RAVE statistics, and root reuse.
- `main/axial_ai_server.py` wrapped that engine for Unity with difficulty levels based on simulation count.
- `Training/Axial_Network.py`, `Training/Axial_MCTS_NN.py`, and `Training/Axial_Train.py` implement an AlphaZero-shaped policy/value network plus PUCT self-play loop.
- Saved histories show real training runs, including `Training/checkpoints_hard/training_history.pkl` with 40 iterations, 100 games per iteration, and a 100k-example replay buffer.

Reproducibility gap:

- There is no `requirements.txt`, `pyproject.toml`, or environment lock for the Python AI.
- The current local and bundled Python runtimes have `numpy`, but not `numba` or `torch`, so the preserved AI cannot currently run in this session.
- Caden approved using `uv`, not direct `pip`, for installing/evaluating Python AI dependencies.
- A root `pyproject.toml` now defines the Python 3.12 `numpy`/`numba` environment needed for preserved MCTS baseline checks; PyTorch/training dependencies should be added as a separate neural phase so MCTS evaluation does not require a heavy training install.

Preserved MCTS smoke result:

- Command: `uv run --python 3.12 python main/test_simple.py`
- Result: all preserved component tests passed after first-run Numba compilation.
- 1000 smart rollouts: 6.92s, about 145 rollouts/sec.
- 500-simulation MCTS move: 3.96s, about 126 simulations/sec.
- 2-second budget run: 329 simulations, about 163 simulations/sec.
- AI vs random smoke: 10-0.

Interpretation: the old MCTS is a useful tactical baseline and reference, but its current speed profile is too slow for normal browser play. The rewrite should preserve the tactical ideas while improving representation, testability, cancellation, seeded reproducibility, and UI-friendly latency.

TypeScript implementation result:

- Added precomputed Classic geometry in `@axial/ai`: row-major move indices, 954 winning segments, and reverse cell-to-segment lookup.
- Correct segment breakdown is height 126, row 126, column 144, two-axis 414, and 3D 144.
- Added a mutable Classic search state with `Uint8Array` board/heights, segment counts, blocked-line counts, make/unmake, and winner tracking.
- Added deterministic heuristic selection: immediate win, immediate block, forcing move, block forcing move, then line/center scoring.
- Added seeded AI-vs-AI evaluation helpers.
- Added deterministic MCTS with threat-ordered expansion, smart rollouts, RAVE-style statistics, simulation/time budgets, early exit, and root stats.
- Connected Classic AI opponent mode to bounded MCTS through a Vite Web Worker; Tactical AI remains random/deferred.
- Added a cancellable Classic AI client so reset/undo/mode changes terminate stale worker requests.
- Added pre-match AI difficulty presets: Easy, Medium, Hard, and Max. Hard keeps the current default budget; Max uses a larger worker-only budget.
- Focused timing after fast affected-line MCTS ordering: 40 empty-board simulations in about 261ms under Vitest.

2026-06-07 tactical regression review:

- Reproduced Caden's open-ended horizontal trap: if a player has an open two, the opponent must
  block one extension before the player can create a three with two winning ends.
- Root cause: the TypeScript heuristic still detected the position as `block-forcing`, but
  `analyzeMctsMove` only treated immediate wins/blocks as hard tactical returns. Fork
  creation/prevention was downgraded to a fallback hint, allowing MCTS visits to override it under
  normal Hard/Max budgets.
- Fix direction: split forcing moves into true immediate-threat forks versus softer multi-line
  races. MCTS now exits tactically for immediate win, immediate block, own true fork, and opponent
  true-fork block, while still letting search evaluate non-forced line-race strategy.
- Added default MCTS progressive bias using the existing fast heuristic ranking as a decaying UCT
  prior. This follows Chaslot et al.'s progressive-bias idea: domain knowledge guides early search,
  then fades as node visits accumulate. Stronger web difficulties pass larger progressive-bias
  values.
- Added fixtures for default connect-4, expanded-board connect-4, and connect-5 fork prevention so
  this class of trap stays covered across board sizes/rules.

2026-06-07 foresight/RAVE review:

- Caden can still beat Max by building double traps. The tactical gate blocks already-visible
  forks, but plain rollout MCTS is still too willing to choose moves that allow the opponent to
  create a fork one ply later, especially through gravity support on higher cells.
- Research direction: keep MCTS, but give it a deterministic adversarial spine. Lanctot et al.'s
  implicit-minimax work supports storing heuristic/minimax guidance alongside rollout values, and
  Allis-style Connect-Four search reinforces that threat knowledge and exact-ish local search matter
  in tactical connection games.
- Added `classic/lookahead.ts`: a bounded alpha-beta lookahead over the existing mutable
  `ClassicSearchState`. It orders urgent wins/blocks/forks first, limits breadth for browser
  latency, evaluates tempo-aware immediate threats, fork moves, center/shape, and multi-line races,
  and works with connect-4/connect-5 plus 1-3-line win targets.
- MCTS now uses root lookahead as a stronger prior and optional override when deterministic search
  sees a materially better move. Difficulty presets diverge in actual engine behavior: Easy has no
  lookahead, Medium has shallow lookahead, Hard searches two plies, and Max searches three plies with
  a larger node cap and stronger override.
- RAVE audit: the TypeScript implementation was blending AMAF value into the whole UCT score,
  which accidentally damped exploration/progressive bias. It now blends AMAF with only the value
  estimate, then adds exploration and progressive bias. AMAF updates are also scoped to moves played
  after each node's position rather than the entire simulated path.
- Added a gravity-support fork fixture: the AI must avoid filling the lower cell of a center column
  when that makes the opponent's height-one fork playable next turn. This covers the class of trap
  where the AI creates the support needed for the opponent's future tactic.

## 2026-07-14 Difficulty And Custom-Rule Audit

Caden reported that the difficulty ladder felt identical, Max MCTS completed suspiciously quickly, and custom rules such as two lines to win could break the opponent. The audit found three separate causes rather than one rule-engine defect:

- Generated parity checks across connect 4/5 and one/two/three-line games found the canonical core and mutable search state agree on completed lines and winners.
- Changing the win condition during an AI-opening rematch cancelled the pending worker and rebuilt the game without queuing replacement AI work, leaving a valid AI turn stuck.
- MCTS expanded all 42 root columns before revisiting a move. The old Max cap of 760 simulations was therefore broad and shallow, often finishing in roughly 0.7-1.0 seconds before a 2.45-second UI delay made it look as if more work occurred.
- All difficulties used the same fork-level tactical gate, so many visible positions returned the same zero-simulation answer regardless of budget.

Implemented correction:

- MCTS now supports progressive widening, with narrower/deeper widening on Hard and Max and deliberately broad behavior on Easy.
- Search results expose maximum depth, root children, and stop reason through the worker boundary.
- Presets moved into `@axial/ai`: Easy uses immediate win/block only; Medium, Hard, and Max retain fork tactics, increasingly deep alpha-beta guidance, and real budgets up to 6000 simulations/3.6 seconds before rule and board scaling.
- The controller uses one short 420ms response floor instead of difficulty-specific fake delays.
- Win-condition changes requeue the AI opener, and Playwright covers the two-lines-to-win sequence.
- The evaluation harness now accepts win conditions, dimensions, starters, and rule-appropriate move caps.
- Tactical AI is still a random baseline. The setup UI now says so and hides Classic difficulty controls in Tactical mode.

Verification includes generated search/core parity, progressive-widening depth assertions, preset separation, worker/controller regressions, and an opt-in actual-budget command: `pnpm --filter @axial/ai eval:strength`. In the final four-game smoke, Max beat Easy from both seats under both default and two-line rules, reached depth 4, and completed 1,808-4,881 total simulations per match. This is evidence of meaningful separation, not a statistical rating or proof that Max can yet beat expert human play.

### Cumulative-line correction after review

The initial pass still did not prove multi-line competence. A follow-up Max-versus-rule-aware-heuristic matrix reproduced Caden's concern: shallow Max won only 2 of 12 games across connect 4/5 and one/two/three-line modes. The rule counter was correct; MCTS was overriding a better strategic anchor with noisy rollout visits.

The correction makes cumulative-line strategy structural rather than a budget multiplier:

- Productive non-terminal line completions and blocks are always considered by root lookahead.
- Extensions of an already banked maximal run are not treated as fresh line progress.
- Completed lines receive objective-scale evaluation weight, with deeper/stronger Max lookahead as two/three-line targets rise.
- Lookahead node and time budgets are divided across root candidates, preventing the earliest candidate from exhausting the entire deterministic search.
- The public decision budget now includes heuristic preparation, lookahead, and MCTS.
- Every difficulty has a minimum useful tree depth. If search remains shallower, the engine keeps the rule-aware heuristic move instead of accepting noisy MCTS visits.
- Faster rollout wins receive more value than slower wins, improving discrimination between root moves with similarly high terminal win rates.

New commands separate concerns:

- `pnpm --filter @axial/ai eval:rules` checks the deterministic strategy floor for all six Classic rule combinations from both seats.
- `pnpm --filter @axial/ai eval:rules:full` checks actual Max search against the stronger heuristic in two-line mode. Max won both seats, reached depth 4, and banked two lines against one in each game.
- `pnpm --filter @axial/ai eval:strength` still checks the difficulty ladder against Easy under standard and two-line rules; the refreshed result remained 4-0 for Max.

This is credible evidence that two-line Max has a strategy and improves on the deterministic floor. It still is not a broad Elo estimate; recorded Caden losses remain future evidence work.

### Full Connect-5 and three-line continuation

The 2026-07-15 continuation closed the missing full-budget variant coverage and corrected two evaluation/search assumptions:

- The old 72-move matrix could truncate a 252-cell Connect-5 game without a terminal result. Full challenges now run to a real terminal state or the board cell count.
- Root lookahead exposes whether every deadline-bounded candidate completed. Partial scores remain useful priors, but are no longer presented as uniformly completed depth.
- A direct three-line completion/block safeguard prevents generic search from surrendering an immediately bankable distinct line. It intentionally does not force speculative two-line races, because doing so regressed the existing two-line strength gate.
- `pnpm --filter @axial/ai eval:variants` covers alternating-seat Connect-4/three-line and Connect-5 one/two/three-line challenges.

Final-policy results against the rule-aware heuristic:

- Connect-4/three-line split by opener: Max won 3-1 as Player 1 and lost 1-3 as Player 2.
- Connect-5/two-line: Max won 2-1 from both seats in 65 and 88 moves.
- Connect-5/three-line: Max won 3-2 from both seats in 117 and 100 moves, reaching search depth 6/4.
- Standard Connect-5 baseline: Max won from both seats; the longer game required 120 moves.

These are terminal full-budget challenge results, not an Elo rating. The next credible strength step is paired seeded openings plus recorded human challenge positions, not another one-off empty-board win claim.

## Caden Decision Update

On 2026-06-06, Caden agreed with the staged direction:

1. Build MCTS/search strength first.
2. Then train a reinforcement/self-play policy-value model once search and evaluation are trustworthy.
3. Rewrite the Classic AI in the web rebuild instead of moving the old Python code wholesale.
4. Use the old MCTS as a reference implementation, benchmark target, and idea source.

This changes the migration framing from "port the old engine" to "rewrite the engine with preserved lessons." The old code is valuable, but it was written under older constraints and should not define the new architecture.

## Research Summary

AlphaZero/AlphaGo Zero style self-play is plausible, but expensive and evaluation-heavy. The relevant pattern is a policy/value network trained from self-play games, with MCTS producing stronger move targets and better subsequent self-play. AlphaZero generalizes this idea to chess, shogi, and Go using only rules, while AlphaGo Zero specifically shows the policy/value network improving tree search quality over iterations.

MCTS remains a strong near-term fit because Axial has a high branching factor and a large state space. UCT was introduced specifically to balance exploration and exploitation in Monte Carlo planning, and RAVE/AMAF-style estimates can reduce cold-start weakness by sharing action value information across subtrees.

Classic Connect Four solvers are not directly portable because Axial has 42 gravity columns and 252 cells, but the solver playbook is highly relevant: compact board representation, alpha-beta/negamax, transposition tables, move ordering, direct losing-move pruning, and threat analysis. Victor Allis' Connect Four work and Pascal Pons' solver/tutorial both reinforce that threat-space knowledge plus efficient representation matters enormously.

Browser deployment points toward:

- Web Workers for search so the 3D UI never blocks.
- ONNX Runtime Web if/when a neural model is exported. WASM is the broad CPU fallback; WebGPU support is available but browser support is narrower and should be treated as an optimization path.
- PyTorch's current ONNX exporter uses `torch.onnx.export(..., dynamo=True)` as the recommended path for modern export.

Useful references:

- AlphaZero: https://arxiv.org/abs/1712.01815
- AlphaGo Zero accepted manuscript: https://discovery.ucl.ac.uk/id/eprint/10045895/
- UCT: https://aima.cs.berkeley.edu/~russell/classes/cs294/s11/readings/Kocsis%2BSzepesvari%3A2006.pdf
- RAVE: https://ics.uci.edu/~dechter/courses/ics-295/winter-2018/papers/mcts-gelly-silver.pdf
- Progressive bias: https://cris.maastrichtuniversity.nl/en/publications/progressive-strategies-for-monte-carlo-tree-search/
- Implicit minimax backups: https://arxiv.org/abs/1406.0486
- Allis Connect Four: https://journals.sagepub.com/doi/abs/10.3233/ICG-1988-11410
- Pascal Pons Connect Four solver: https://github.com/PascalPons/connect4
- Pascal Pons solver tutorial: https://blog.gamesolver.org/
- ONNX Runtime Web: https://onnxruntime.ai/docs/get-started/with-javascript/web.html
- PyTorch ONNX export: https://docs.pytorch.org/docs/main/onnx_export.html
- MDN Web Workers: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers

## State Space Notes

The common `3^252 ~= 10^120` estimate is a raw cell-state upper bound and is useful for communicating scale, but gravity gives a tighter still-enormous upper bound.

Each gravity column has:

`sum(2^h for h=0..6) = 127`

possible filled-prefix ownership states before parity/win legality constraints. With 42 columns:

`127^42 ~= 10^88`

This is still far beyond exact full solving for the active board, but it is a better engineering estimate than the raw cell upper bound.

There are 954 distinct length-4 winning segments on the 6 x 6 x 7 board:

- Height: 126
- Row: 126
- Column: 144
- Two-axis diagonals: 414 total
- 3D diagonals: 144 total

That is small enough to precompute once and use for line-count updates, threat detection, heuristic scoring, tensor features, and golden tests.

## Architecture Options

### Option A: TypeScript Heuristic MCTS In A Worker

Rewrite the preserved Python teacher's best ideas in `@axial/ai` as a browser-native Classic engine:

- Precompute the 954 winning segments.
- Add a mutable search state with column heights, move/unmove stack, and incremental line counts.
- Rebuild immediate win/block, threat scoring, forcing-move detection, and center/shape heuristics.
- Add MCTS with time/simulation budgets, root reuse, optional RAVE, and deterministic seeded randomness.
- Run in a Web Worker with cancellation/progress messages.

Pros:

- Fastest route to a serious browser opponent.
- Keeps runtime dependency surface small.
- Directly improves the playable app.
- Gives a teacher/evaluator for later neural work.

Cons:

- TypeScript may be slower than Numba/Rust for high simulation counts.
- Needs careful tests because search bugs are easy to hide behind plausible moves.

### Option B: Rust/WASM Search Engine

Build Classic search in Rust, compile to WASM, and run it in a worker.

Pros:

- Better performance ceiling for bitboards, transposition tables, and exact-ish tactical search.
- Stronger long-term engine foundation if TypeScript hits a wall.

Cons:

- More build/tooling complexity.
- Slower to integrate with the current Svelte/pnpm workspace.
- Still needs a TypeScript worker/client boundary.

### Option C: Python/PyTorch AlphaZero Pipeline

Clean up the existing training code and train a policy/value model, then export to ONNX for browser inference.

Pros:

- Best long-term path if we want model-assisted MCTS or near-instant policy play.
- Existing prototype and checkpoints provide a head start.

Cons:

- Requires reproducible Python environment, evaluation harness, and training compute.
- Existing checkpoint strength is unproven against a strong MCTS teacher and Caden.
- Neural-only play is unlikely to be enough; model-assisted search is the better target.

### Option D: Solver-Inspired Exact/Threat Search

Use alpha-beta/negamax, transposition tables, proof-number ideas, or threat-space search for forced wins and late-game exactness.

Pros:

- Excellent for tactical certainty, endgames, and obvious human traps.
- Complements MCTS well.

Cons:

- Full solving the active board is unrealistic.
- Needs strong representation and careful pruning to avoid exploding.

## Recommended Direction

Use a hybrid staged path:

1. Build a strong heuristic/MCTS teacher first in the web AI package.
2. Put it behind a worker/client interface and benchmark it against random, greedy, and the preserved Python design when an environment is available.
3. Use that engine to generate golden positions, Caden challenge logs, and eventually training data.
4. Return to neural self-play only after the teacher/evaluation harness can prove whether a network is improving play beyond MCTS alone.
5. Move to Rust/WASM only if TypeScript search cannot hit the needed latency/strength budget.

This path maximizes near-term playable strength while preserving the AlphaZero path as a later, measured upgrade instead of a speculative rewrite.

Rewrite guidance:

- Do not move the old `main/` or `Training/` code into `axial-web` as production code.
- Rebuild the Classic engine in `axial-web/packages/ai` with small, testable TypeScript modules.
- Preserve ideas that are still good: immediate win/block, forcing move detection, threat scoring, RAVE, root reuse, and smart rollouts.
- Revisit or replace pieces that are likely brittle: ad hoc tuning constants, Python-server shape, old randomization, and any assumptions not backed by fixtures/benchmarks.
- Keep the Python implementation runnable through a `uv` environment for baseline comparison and future training, not as the browser runtime.

## Representation Decision

Keep two layers:

- Public/canonical game state remains the current `Uint8Array` board and replay moves from `@axial/core`.
- AI search state becomes an internal Classic-only mutable representation optimized for speed.

Recommended search representation:

- `Uint8Array` board using the same `idx = h + r * D + c * D * R` formula.
- `Uint8Array(42)` column heights.
- Precomputed `Move[]` with explicit row/col and stable `moveIndex = row * BOARD_COLUMNS + col`.
- Precomputed 954 winning segment cell lists.
- Reverse index from cell to segment ids for incremental updates.
- Per-segment counts for player 1 and player 2, updated on make/unmake.
- Optional later bitboards using fixed 4-lane 64-bit or 8-lane 32-bit representation if benchmarks justify it.

Policy/tensor convention:

- Use row-major policy index `row * BOARD_COLUMNS + col`.
- Add explicit mapping tests because current `legalMoves` iterates columns outermost while the neural prototype uses row-major policy indices.

Symmetries:

- Horizontal board symmetries are row mirror, column mirror, and both. The board is 6 x 7 in the row/column plane, so 90-degree rotation is not a symmetry.
- Height mirroring is not valid because gravity breaks it.
- Use player-perspective channels for neural tensors.

## Benchmarks

Baseline opponents:

- Random legal move.
- Greedy immediate win/block plus center bias.
- Heuristic evaluator without MCTS.
- Basic MCTS with random or smart rollouts.
- Enhanced MCTS teacher.
- Neural MCTS and raw neural policy only after model work resumes.

Strength targets:

- `hard` should beat random at least 99% over 500 seeded games.
- `hard` should beat greedy at least 95% over 300 seeded games.
- `hard` should beat basic MCTS at least 70% over 200 games at equal or lower latency.
- `nightmare` should be at least parity with the preserved Python enhanced MCTS when run under comparable budgets.
- Direct Caden benchmark: over a recorded match set with both first/second-player games, target >60% win rate initially, then >70% after tuning.

Latency targets:

- All serious AI runs off the main thread.
- `easy`: under 250 ms typical.
- `medium`: under 750 ms typical.
- `hard`: under 1.5 s p95 on Caden's machine.
- `nightmare`: can take 3-5 s if the UI shows thinking/progress and cancellation remains reliable.

Reproducibility targets:

- Seeded AI configs.
- JSONL match logs with engine version, seed, budget, move, score/stats, final result, and git commit.
- Golden fixtures for wins, blocks, fork threats, gravity edge cases, and replay conversion.
- Cross-check web core and AI search representation on generated random legal games.

## First Implementation Slice

Do not start with training. The first code slice should be:

1. Add Classic AI fixtures and precomputed line tables in `@axial/ai`.
2. Add deterministic heuristic move selection: immediate win, immediate block, forcing move, threat/center score.
3. Add an evaluation harness that can run AI-vs-AI seeded matches from Node/Vitest.
4. Integrate the heuristic AI as a selectable stronger baseline only after package tests pass.

Then add MCTS and worker integration as the next slice.

After MCTS is strong and measurable, resume the neural path:

1. Rebuild the Python training stack with `uv` metadata and checked-in config.
2. Train a policy-value model from self-play/search-improved targets.
3. Export a browser inference artifact, likely ONNX first unless benchmarks suggest otherwise.
4. Compare raw model play, model-assisted MCTS, and pure heuristic/MCTS before integrating it into user-facing difficulty presets.

## Open Questions For Caden

- What is the maximum acceptable think time for the strongest in-browser opponent?
- Should the first strong AI be aggressively tuned to win, or should difficulty presets preserve a fair medium mode?
- Are we comfortable adding a dedicated Python environment under the repo for training and checkpoint evaluation?
- Should Caden challenge games be stored locally for analysis/replay once AI work begins?
