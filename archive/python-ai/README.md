# Python AI (original version)

The opponent from the Unity version of Axial: Monte Carlo tree search over a 6×6×7 board, with threat detection and Numba-compiled board operations. Unity talked to it over a local socket. The browser game's TypeScript AI in [`axial-web/packages/ai`](../../axial-web/packages/ai/) is a separate, later design; [the research notes](../../dev/archive/axial-web-rebuild/classic-ai-research.md) explain how these baselines informed it.

| Folder                   | Contents                                                                                                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`engine/`](engine/)     | The shipped engine: `bitboard.py` (Numba JIT board, win and threat checks, rollouts), `mcts.py` (threat-aware MCTS), `axial_ai_server.py` (JSON-over-TCP server for Unity), `benchmark.py`, a terminal game, and a self-test |
| [`training/`](training/) | AlphaZero-style experiments: a residual policy/value network in PyTorch, PUCT search, self-play and adversarial training. Not used by the shipped game                                                                       |
| [`legacy/`](legacy/)     | Earlier board representations, MCTS and self-play versions, and the first technical spec                                                                                                                                     |

## Run

Requires [uv](https://docs.astral.sh/uv/). From this folder:

```sh
uv run python engine/test_simple.py          # self-test: board, MCTS, threats, AI vs random
uv run python engine/play_axial.py hard      # play against the AI in the terminal
uv run python engine/benchmark.py strength   # strength benchmarks
uv run python engine/axial_ai_server.py      # the Unity bridge, on 127.0.0.1:5555
```

`pyproject.toml` pins Python 3.12, NumPy, and Numba for the engine. The training scripts also need PyTorch, which is not pinned here, and look for checkpoints (not tracked) in `checkpoints_*/` under the working directory, so run them from `training/`.
