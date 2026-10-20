# Axial AI And Portrait Controls Tasks

## Architecture and reproduction

- [x] Map core, search-state, MCTS, lookahead, worker, controller, and settings paths.
- [x] Cross-check canonical and AI completed-line state over generated custom-rule games.
- [x] Measure real simulations and elapsed search work by difficulty.
- [x] Run a small alternating-seat Easy/Max smoke under default and two-line rules.
- [x] Capture portrait and landscape UI baselines.
- [x] Document decisions and non-goals.

## AI correctness and search

- [x] Requeue AI work after pre-move win-rule changes.
- [x] Add progressive widening to high-branching MCTS nodes.
- [x] Add difficulty-aware tactical foresight.
- [x] Make strong presets use real search time rather than presentation delay.
- [x] Add worker-safe search telemetry.
- [x] Extend evaluation inputs for custom rules, board sizes, and starters.
- [x] Add generated multi-line parity and search-regression tests.
- [x] Stop advertising Classic difficulty levels for the Tactical random baseline.

## Cumulative-line strategy follow-up

- [x] Benchmark Max against the rule-aware heuristic across all six Classic rule combinations.
- [x] Reproduce shallow MCTS overriding stronger deterministic line strategy.
- [x] Promote productive non-terminal line completions/blocks into root lookahead candidates.
- [x] Filter extensions that cannot create a distinct maximal line.
- [x] Reweight completed-line progress for two/three-line objectives.
- [x] Divide root lookahead budgets fairly across candidates.
- [x] Bound the entire decision rather than only the MCTS loop.
- [x] Add a minimum-depth strategy floor for underdeveloped searches.
- [x] Cover connect 4/5, two/three-line targets, and expanded boards with fixtures.
- [x] Add deterministic all-rules and full-budget two-line evaluation commands.
- [x] Verify full-budget Max beats the rule-aware heuristic from both seats in two-line mode.

## Mobile portrait controls

- [x] Move collapsed portrait controls to the top-right region.
- [x] Make the collapsed pill content-width without unused trailing/leading space.
- [x] Expand downward from the same anchor.
- [x] Update camera-fit language/tests away from bottom-sheet assumptions where needed.
- [x] Update responsive Playwright assertions.

## Portrait interaction correction

- [x] Fit the status-free collapsed pill beside the logo without shrinking 44px targets.
- [x] Move history and fullscreen actions into the open portrait sheet.
- [x] Replace the narrow portrait rail with a full-width half-height top sheet.
- [x] Restore half/full portrait sheet states.
- [x] Center mobile and desktop toolbar gutters.
- [x] Keep tutorial practice content within narrow viewport bounds.
- [x] Move selected-drop confirmation to the bottom safe area and avoid half-sheet overlap.
- [x] Default grid layers off while preserving stored preferences.
- [x] Keep the AXIAL shine cycling until reduced-motion disables it.
- [x] Add browser coverage for collapsed width, sheet states, alignment, safe contextual bars, grid defaults, and infinite shine.

## Full-variant continuation

- [x] Stop classifying 72-move Connect-5 truncations as draws.
- [x] Add terminal, alternating-seat full-budget challenges for Connect 4/5 and multi-line objectives.
- [x] Record per-match reason counts, strategic-anchor overrides, actual maximum depth, and lookahead completion telemetry.
- [x] Reproduce and correct a three-line search override that surrendered a directly bankable opponent line.
- [x] Keep speculative two-line races searchable rather than forcing the heuristic line-race choice.
- [x] Verify final-policy Connect-5/two-line Max wins from both seats.
- [x] Verify final-policy Connect-5/three-line Max wins from both seats.
- [x] Re-run the full workspace and browser gates after the full-variant continuation.

## Tutorial and collapsed-pill follow-up

- [x] Reproduce every portrait tutorial step against the half-height top sheet.
- [x] Scroll tutorial targets into the sheet viewport before measurement.
- [x] Clip spotlights to the visible sheet scroller instead of off-screen target bounds.
- [x] Keep open-sheet tutorial cards below the sheet using measured card height.
- [x] Prevent stale tutorial geometry from flashing during panel state changes.
- [x] Tighten the collapsed pill to equal outer gutters and contiguous 44px segmented actions.
- [x] Extend portrait Playwright coverage through all seven tutorial steps and exact pill geometry.
- [x] Separate the deterministic lookahead node-budget test from wall-clock deadline behavior.

## Portrait control continuity follow-up

- [x] Keep the expanded Classic toolbar anchored to the collapsed pill's right and top edges.
- [x] Preserve reset, theme, and collapse coordinates through expansion.
- [x] Use segmented controls instead of circular expanded actions in portrait.
- [x] Keep portrait camera framing and board scale stable while the top sheet opens or closes.
- [x] Preserve landscape and desktop rail-aware camera compensation.
- [x] Add coordinate, radius, and camera-fit regression coverage.

## Tactical pause

- [x] Disable Tactical selection without deleting its implementation.
- [x] Add a visible and accessible Coming soon treatment.
- [x] Keep Classic and its AI difficulty controls as the active path.
- [x] Replace the Tactical baseline browser expectation with paused-mode coverage.

## Verification

- [x] Run focused AI tests.
- [x] Run focused controller and worker-client tests.
- [x] Run responsive and AI lifecycle Playwright tests.
- [x] Run the opt-in real-budget Max-versus-Easy strength evaluation.
- [x] Inspect portrait and landscape screenshots.
- [x] Run `pnpm check`, `pnpm lint`, full unit tests, and build.
- [x] Run `git diff --check` and review the final diff.
- [x] Re-run the full workspace and Playwright gates after the cumulative-line strategy correction.
- [x] Re-run the full 16-test Playwright suite after the portrait interaction correction.
