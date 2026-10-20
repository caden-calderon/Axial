# Classic AI correctness audit

Date: 2026-09-07

## Branch recommendation

Retain both `b3276d3` and `1bff1e8` from `codex/classic-ai-mobile-overhaul`.
The centralized difficulty presets, worker boundary, bounded rollouts, common-depth
iterative lookahead, gravity-aware AMAF, and replay/evaluation infrastructure are a
coherent improvement over `main`. No canonical rule implementation changed in those
commits. Their historical machine results are useful context, not a new verification
or evidence that Max is unbeatable.

## Confirmed defects and corrections

1. **A fork can supply the opponent's winning cell.** A legal ten-ply replay gives
   Player 1 two winning threats after dropping at row 2, column 3, but that drop also
   exposes Player 2's winning cell directly above it. Both rich root tactics and fast
   quiescence used to classify the drop as a forcing fork. They now reject fork
   candidates when the opponent can win first. Root fork defenses also reject an
   immediately losing support drop.
2. **An existing maximal run received a phantom threat bonus.** With one four-cell
   line already completed in a two-line game, the fast evaluator counted extending
   that same run as an immediate winning threat. Changing only whose turn it was
   added 52,000 points. Fast threat profiling now verifies that the candidate cell
   increases the distinct completed-line count.
3. **Selective quiescence overstated a forced result.** Two prospective opponent
   forks received a 9,880,000 terminal score even when the defender could create an
   immediate counterthreat and require a reply first. Quiescence now considers
   bounded ranked counterplay alongside the fork squares. If that selective search
   finds no defense, it retains a static horizon value instead of claiming mate.

All three defects have explicit failing-before/passing-after regressions in
`axial-web/packages/ai/src/threatSafety.test.ts`. The first uses canonical replay;
the other two construct small gravity-valid search positions to isolate evaluation.

## Verification

- Before edits: AI unit suite 62 passed, 43 opt-in tests skipped.
- After edits: AI unit suite 65 passed, 43 opt-in tests skipped.
- Reduced-work challenge set: 13/13 passed.
- Full Max budget challenge set: 13/13 passed (40 seconds).
- Source formatting and `git diff --check`: passed.
- Controlled Max-versus-Hard: Max won 3/4 terminal games (67 seconds); it lost
  the standard-rule second seat, won the standard first seat, and won both seats
  with two lines required.
- Six-rule strategy-floor matrix: passed (12 seconds). The zero-search Connect-5
  two/three-line games reached the explicit 72-ply diagnostic cap, so this gate
  is not a full-game strength result. Full-budget variants remain separate.

## Limits and next work

These fixes improve tactical correctness; they do not establish a new strength
rating. The older full paired tournament and human challenge targets have not been
rerun. Wall-clock search remains scheduler-sensitive. Counterplay adds bounded
quiescence work, so future strength/throughput comparisons should include controlled
work and equal-clock runs, not infer strength from node counts alone.

The broader canonical/search parity suite reconstructs the search state from many
canonical positions. Longer incremental make/unmake parity is a separate useful
test target. Keep actual Caden replays as the next product strength evidence rather
than repeatedly optimizing only the existing thirteen fixtures.


## User-reported multi-line worker failure

The follow-up reproduced instant random moves after either player scored. The search engine itself continued on plain snapshots, but `cloneCompletedLine` retained the direction tuple by reference. Svelte proxied it in live state; native `Worker.postMessage` then threw `DataCloneError`, and the controller silently substituted a random move. Deep-copying the direction tuple fixes the boundary. Synchronous worker failures now clean up pending timers and terminate the broken worker; failed, missing or illegal search results pause with an explicit retry action. Tactical’s existing baseline remains separate.

A core regression wraps the tuple in a Proxy and verifies `structuredClone(cloneGame(game))`. Real-browser tests intercept the native worker transport without replacing the search, seed either player’s first line, and verify successful search telemetry. Both failed with the reported native serialization error before the fix. A third test injects one transport failure and verifies no substitute move, then a successful real search on retry. See feedback-followup.md for final gates.
