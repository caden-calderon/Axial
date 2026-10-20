# Axial AI And Portrait Controls Review Plan

Date: 2026-07-14

## Goal

Make the Classic AI difficulty ladder honest, measurably stronger at the top end, and correct under custom win rules, while restoring the compact mobile portrait controls to the top-right of the play surface.

## Audit Findings

1. The canonical core and `ClassicSearchState` agree across generated connect-4/connect-5 games with one, two, and three lines required. The custom-rule break is not a board-index or completed-line translation failure.
2. Changing a win rule while an AI-opening rematch is pending cancels the worker, rebuilds the game, and does not queue a replacement AI move. This can leave a two-line AI match stuck on the AI turn.
3. Difficulty presets currently stop on small simulation caps before their time ceilings. Representative Max searches used 760 simulations in roughly 0.7-1.0 seconds, then the controller delayed the move until a 2.45-second presentation floor. The visible wait therefore overstates the real search work.
4. MCTS expands every untried child before revisiting a node. With 42 root columns, even Max remains broad and shallow: 760 simulations average only about 18 visits per root move before accounting for deeper branching.
5. Easy, Medium, Hard, and Max all share the same fork-level tactical gate. Many human-visible positions therefore produce the same zero-simulation move at every level even though their nominal search budgets differ.
6. Existing tests prove legality and selected tactical fixtures, but do not record tree depth/stop reason, enforce difficulty capability separation, or evaluate custom rules and alternating starters through the evaluation harness.
7. In portrait, the collapsed control surface is a nearly full-width bottom sheet. Its fixed width leaves unused toolbar space and conflicts with the requested top-right menu placement. Landscape already uses the desired right-side model.
8. The first follow-up benchmark exposed a deeper custom-rule failure: with a tight search budget, Max won only 2 of 12 alternating-seat games against the rule-aware heuristic across connect 4/5 and one/two/three-line targets. MCTS was discarding a better deterministic strategy when rollout visits were too shallow.
9. Completed non-terminal lines were underweighted relative to generic fork pressure, and near-complete segment scoring could still reward extending an already banked maximal run even though that extension cannot create another line.
10. Root lookahead used one global node counter. Early root candidates could consume the entire allowance, leaving later candidates with static evaluation and incomparable search depth.
11. `maxTimeMs` bounded only the MCTS loop. Heuristic preparation and root lookahead occurred before the timer, so configured time was not the full decision time.
12. The first all-rules harness capped every game at 72 moves even though the default board has 252 cells. Its long Connect-5 results were unfinished games, not draws.
13. Fixed-depth lookahead can reach its node/time allowance partway through a candidate. The partial score remains useful as a bounded prior, but the old telemetry reported only the requested depth and hid whether every candidate completed.
14. Treating every speculative line-race pattern as a forced move weakens two-line play by suppressing stronger counter-threats. Only immediately bankable distinct lines justify an additional three-line tactical safeguard; speculative races must remain search decisions.
15. A collapsed portrait panel using intrinsic width still measures its visually hidden body. The result looked content-width in CSS but remained almost viewport-wide at 320px.
16. Six 44px toolbar actions cannot coexist beside the brand on narrow phones. Undo, redo, and fullscreen must remain available in the open sheet rather than forcing the closed control to grow or shrinking touch targets.
17. The narrow expanded top-right rail collides with contextual confirmation UI and does not provide the requested half/full vertical takeover states.
18. Mobile tutorial and confirmation bars still reserved 3.7rem for the removed bottom sheet, leaving them unnecessarily high; the tutorial action row could also exceed the safe inline bounds.
19. `ShinyText` declared an infinite animation in shorthand and then overrode it with `animation-iteration-count: 1`, so every logo glow stopped after one sweep.
20. Portrait toolbar rows used `justify-content: flex-end`, placing all residual width on the left and making the circular controls visibly off-center.
21. Tutorial spotlights measured the full target even when most of it was scrolled outside the half-sheet clip. The rules step therefore highlighted a stale oversized region, while the appearance step could collapse to a thin strip.
22. Portrait tutorial cards still used desktop side placement and a fixed height estimate. Steps targeting the open sheet could overlap its controls instead of occupying the unobstructed lower half of the viewport.
23. The collapsed three-action pill retained individually outlined circular buttons plus loose gaps, producing uneven-looking nested margins despite the toolbar being mathematically centered.
24. Expanding the portrait controls replaced the compact segmented pill with a centered row of circular buttons. The theme and collapse actions shifted left even though they persist across both states, making one control feel like two unrelated components.
25. Portrait camera-fit multiplied board scale by `0.88` whenever controls expanded. That compensation belonged to side-rail layouts; the full-width top sheet overlays the scene and should not resize the board behind it.
26. Tactical is not part of the current product priority while Classic AI still has unresolved human-play failures. Leaving Tactical selectable implies a supported strategy surface and distracts from the Classic overhaul.

## Architecture Decisions

### AI correctness

- Requeue the AI after a pre-move win-condition change, matching the existing board-size and difficulty lifecycle.
- Add a browser regression for the AI-opener plus custom-win-rule sequence.
- Keep worker cancellation and stale-request shielding unchanged.

### Search strength and difficulty

- Add progressive widening to MCTS so high-branching nodes revisit promising moves before expanding all 42 columns.
- Keep immediate win/block behavior universal, but make fork foresight difficulty-aware: Easy sees immediate tactics; stronger levels retain fork creation/prevention.
- Raise real Hard/Max work ceilings and make time the practical strong-mode limiter instead of a low simulation cap.
- Replace the large difficulty-specific fake thinking delay with one short response floor; stronger modes should feel slower because they search longer.
- Return search telemetry (`maxDepth`, root child count, and budget stop reason) through the worker boundary so tests and future diagnostics can verify what happened.

### Custom-rule evaluation

- Extend the pure evaluation harness to accept win condition, board dimensions, starting player, and a rule-appropriate move cap.
- Add generated core/search-state parity coverage for multi-line rules.
- Add deterministic tests for progressive widening and preset scaling; keep long strength matches as an explicit evaluation command rather than bloating the default unit gate.
- Treat productive line completions and opponent line progress as mandatory root candidates in cumulative-line lookahead.
- Reject phantom line progress from extensions of an already completed maximal run.
- Value banked lines at objective scale and deepen Max lookahead as the target rises from one to three lines.
- Divide lookahead node/time budgets across root candidates and make the configured time budget cover heuristic, lookahead, and MCTS together.
- Preserve the rule-aware heuristic as a strategy floor: if MCTS does not reach the minimum depth for a difficulty/rule combination, it may not override that anchor with noisy visits.
- Add an all-rules deterministic floor command and a separate full-budget two-line Max-versus-heuristic command.
- Add terminal full-budget variant challenges for Connect 4/5 and one/two/three-line objectives. Score alternating seats instead of assuming second-player wins are always achievable.
- Report requested lookahead depth and whether every root candidate completed so partial deadline-bounded work is observable rather than mislabeled.
- In three-line objectives, preserve a heuristic anchor only when it directly banks a new distinct line or blocks an opponent's directly bankable line. Do not force speculative line-race patterns in two-line play.

### Portrait controls

- Keep 44px touch targets and the intentionally status-free collapsed mobile state.
- In portrait, keep only reset, theme, and expand in the collapsed surface so it fits beside the brand; retain history and fullscreen actions in the open sheet.
- Expand into a full-width top sheet that covers the brand and occupies half the viewport by default.
- Restore the explicit half/full sheet toggle, with the full state taking the complete portrait display.
- Center toolbar actions from the actual inner width so both mobile and desktop gutters remain even.
- Place tutorial and selected-drop actions directly on the bottom safe area; the top sheet owns a higher layer only where it physically covers them.
- Default grid layers off for new users while preserving any stored preference.
- Keep the logo shine infinite unless reduced-motion disables it.
- Preserve the current coarse-landscape and desktop rail behavior.
- Before measuring a tutorial target inside the top sheet, scroll it into the visible clip and intersect its spotlight with that clip.
- Place portrait sheet tutorial cards below the half sheet using the measured card height, and keep the card hidden for the single layout-preparation frame so stale geometry never flashes.
- Treat the collapsed controls as one segmented pill: equal outer gutters, contiguous 44px actions, and subtle separators instead of three competing circular outlines.
- Grow the Classic portrait toolbar leftward from the same top-right anchor when expanded. Keep reset, theme, and collapse at identical coordinates and retain the segmented shape for the additional history/fullscreen actions.
- Keep portrait camera position, target, field of view, and board scale stable across collapsed and half-sheet states. Continue compensating for expanded rails in landscape and desktop layouts.
- Preserve Tactical implementation for later, but disable its rule selector with a clear Coming soon treatment until Classic strength is credible.

## Non-goals

- Neural/self-play integration.
- Rust/WASM migration.
- Tactical special-piece AI.
- Multiplayer rule changes.
- Production deployment, commit, or push unless requested after verification.

## Verification

- `pnpm --filter @axial/ai test:unit`
- `pnpm --filter @axial/ai eval:rules`
- `pnpm --filter @axial/ai eval:rules:full`
- `pnpm --filter @axial/web test:unit -- --run`
- focused Playwright AI lifecycle and responsive UI tests
- `pnpm check`
- `pnpm lint`
- full workspace unit suite
- `pnpm build`
- portrait screenshots at 320x568, 390x844, and 430x932; landscape at 844x390
- `git diff --check`
