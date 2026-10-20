# Core correctness pass

Date: 2026-09-07

## Scope and findings

Read the goal objective, repository AGENTS, complete core implementation and existing core suite. Existing core baseline: **22 tests passed**. The current rules use gravity in each row/column, 13 undirected spatial directions, configurable Connect 4/5, and one score per maximal contiguous run. A move may finish several crossing lines simultaneously; blockers occupy space but never belong to a player.

Found and fixed a concrete input validation bug: fractional coordinates passed range-only guards. On the normal board, `applyMove(game, { row: 0.5, col: 0 })` could write index 3, aliasing height 3 of row 0 while recording an invalid row. This violates gravity and could also enter through replay. Flat coordinate conversion additionally accepted fractional indices and `NaN`. Integer checks now guard columns, cell coordinates, and flat indices. Valid integer move behavior is unchanged.

The new regression suite failed before the fix for fractional coordinates and NaN indices, then passed after it. Line detection itself passed the expanded matrix without requiring algorithm changes.

## Regression coverage

Added `axial-web/packages/core/src/regression.test.ts` with **124 new tests**, bringing the core suite to **146 tests**:

- All 13 spatial directions, Connect 4 and Connect 5, normal 6×6×7 and expanded 7×8×9 boards, both players, both opposite board edges, with winning-line lookup from every occupied cell. The direction fixtures are independent of the production direction table so a missing direction fails coverage.
- Every direction with a longer maximal run: one completed line, valid highlighted windows containing the played cell, and rejection of gaps, opponent interruptions and blockers.
- Three crossing lines completed by one move, unique score identifiers, and deduplicated shared highlight cells; distinct separated runs and player ownership.
- Full column exclusion/rejection, final-cell blocker rejection, full-board draw, win priority over draw, and rejection of moves after terminal state.
- Mixed tactical replay for both starting players, missing/nonadjacent second pieces, stale pair origins, and first-piece wins.
- Snapshot cloning and rejection paths preserve original boards, histories, nested special metadata and win lines.
- Round trips of every cell on both configured boards and malformed coordinate/replay rejection.

## Verification

- Baseline: `pnpm --filter @axial/core test` — 22/22 passed.
- Before fix: new suite demonstrated 2 failing regression cases (fractional coordinate and NaN index); 144 cases passed.
- After fix: `pnpm --filter @axial/core test` — 146/146 passed across 2 files, under one second of runner time.
- Formatted the new test file with the workspace Prettier binary.
- Standalone strict TypeScript validation of the implementation and new regression file passed using the installed TypeScript 6 CLI with `--ignoreConfig`; the initial command without that flag correctly reported TS5112 instead of compiling.

No AI, frontend, multiplayer, Unity, dependencies, or game rules were changed in this lane.
