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
