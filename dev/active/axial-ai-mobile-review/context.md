# Axial AI And Portrait Controls Context

Status: AI and portrait UI implementation complete; live-device visual review remains open.

Start here:

1. `plan.md`
2. `tasks.md`
3. `../axial-web-rebuild/classic-ai-research.md`
4. `../axial-ui-pass/context.md`

Important constraints:

- Heavy Classic search stays in the Web Worker. Browser-main-thread failure fallback remains a cheap legal move.
- Collapsed mobile remains status-free.
- Collapsed portrait controls remain status-free beside the brand; expanded portrait controls use half/full top-sheet states. Coarse landscape and desktop retain their rail behavior.
- Custom line rules use maximal contiguous runs, not overlapping length-N windows.
- Existing user changes in the worktree must be preserved.

Baseline evidence from 2026-07-14:

- Worktree was clean before this lane.
- AI package: 39 tests passed.
- Focused web state suite: 63 tests passed.
- Generated canonical/search-state parity passed across 240 seeded games spanning connect 4/5 and one/two/three lines to win.
- Representative Max MCTS calls completed 760 simulations in about 0.7-1.0 seconds, below the 2.45-second visible response floor.
- A four-game actual-preset smoke had Max beat Easy from both seats under default and two-line rules; this proves some separation, but is not a statistically meaningful strength rating.
- In-app Browser failed because the privileged native pipe bridge was unavailable and the browser client was not trusted; local Playwright/Chromium is the active visual QA surface.

Implemented result:

- Classic MCTS now uses difficulty-tuned progressive widening and reports maximum depth, root breadth, and stop reason.
- Difficulty presets live in `@axial/ai`, not the Svelte controller. Easy uses immediate-only tactical knowledge; Medium, Hard, and Max retain fork tactics and receive increasingly deeper lookahead/search budgets.
- The former 0.78-2.45 second difficulty-specific presentation delays are replaced by one 0.42 second response floor. Hard and Max now feel slower only when they perform more search work.
- Win-condition changes requeue an AI-opening turn after cancelling stale work.
- Tactical remains a random baseline; the UI no longer presents Classic difficulty levels as if they change Tactical behavior.
- Portrait controls use a compact three-action pill beside the brand. Opening restores all actions in a full-width half-height top sheet with an explicit full-height state.
- A real-budget four-match evaluation had Max beat Easy from both seats under both default and two-line rules. Max searches reached depth 4-5; the command is `pnpm --filter @axial/ai eval:strength`.

2026-07-14 cumulative-line strategy follow-up:

- Caden correctly rejected lifecycle correctness and Max-versus-Easy as sufficient evidence for multi-line strategy.
- A harder alternating-seat diagnostic across all six Classic rule combinations initially had shallow Max win only 2 of 12 games against the existing rule-aware heuristic. Root win rates were saturated and MCTS routinely overrode better banking/race decisions.
- Non-terminal line completions and blocks are now first-class lookahead candidates. Completed lines carry objective-scale value, while extending an existing maximal run is filtered when it cannot bank another line.
- Lookahead now divides its node/time allowance across root candidates instead of letting the earliest move consume the entire budget.
- Difficulty presets specify a minimum useful tree depth. Search that does not reach it falls back to the rule-aware strategic anchor rather than making a noisy MCTS choice.
- Connect 4/5 and two/three-line Max modes deepen lookahead and strengthen its influence as the cumulative target rises. An expanded-board connect-5/three-line fixture covers the same strategy floor.
- The configured decision budget now includes heuristic preparation, root lookahead, and MCTS. In the full two-line evaluation, the scaled Max cap was about 4.824 seconds and measured decisions stayed within one simulation's granularity of that total.
- `pnpm --filter @axial/ai eval:rules` now runs a fast deterministic strategy-floor matrix across connect 4/5 and one/two/three-line modes from both seats.
- `pnpm --filter @axial/ai eval:rules:full` runs the direct full-budget two-line test. The final policy beat the rule-aware heuristic from both seats, reached depth 4, and finished 2-0 and 2-1 in 17 and 20 moves (11,698 and 14,534 total simulations).
- The refreshed `eval:strength` still had Max beat Easy 4/4 across standard and two-line modes, now in about 60 seconds because the time cap covers the whole decision.

2026-07-15 full-variant continuation:

- The earlier 72-move evaluation cap could leave a 252-cell Connect-5 game in progress while reporting winner `0`. Match summaries now distinguish terminal games, and full variant challenges use the board cell count as their move ceiling.
- `pnpm --filter @axial/ai eval:variants` runs opt-in full-budget challenges for Connect-4/three-line plus Connect-5 with one, two, and three lines required. Each challenge runs Max from both seats and scores the alternating pair.
- Lookahead now reports whether all bounded root searches completed. Partial deadline-bounded scores remain available as heuristic priors because replacing them with strict iterative deepening measurably weakened the two-line gate; the worker and evaluation telemetry no longer imply that partial depth was complete.
- A three-line trace showed Max allowing the opponent to bank a second line after overriding the rule-aware anchor. Three-line search now preserves an anchor that directly banks a distinct line or blocks an immediately bankable opponent line.
- The first safeguard was too broad and forced speculative line-race patterns. That regressed two-line play, so two-line races remain search decisions unless they are terminal wins/blocks; the additional direct-line safeguard is limited to three-line objectives.
- Final-policy Connect-4/three-line produced the expected alternating first-player split: Max won 3-1 as Player 1 and lost 1-3 as Player 2, with both games ending in 21 moves.
- Final-policy Connect-5/two-line Max won 2-1 from both seats in 65 and 88 moves, reaching depth 5.
- Final-policy Connect-5/three-line Max won 3-2 from both seats in 117 and 100 moves. The searches reached depth 6 and 4 respectively and stayed within the scaled 6.64-second decision ceiling.
- The standard Connect-5 baseline also had Max win from both seats. One second-seat game required 120 moves, which is why terminal evaluation rather than a 72-move shortcut matters.

2026-07-15 portrait interaction correction:

- The closed portrait pill now exposes reset, theme, and expand at 44px; undo, redo, and fullscreen remain available immediately after opening. An explicit width prevents the hidden panel body from inflating the collapsed surface.
- The open portrait panel is a full-width top sheet covering the logo and half of the viewport. The restored sheet-size action switches between half and full display takeover.
- Toolbar rows are centered from equal inner gutters on portrait and desktop. The former portrait end alignment was the source of the visible right shift.
- Tutorial practice and selected-drop bars now sit on the bottom safe area instead of reserving room for the retired bottom sheet. The practice bar uses safe left/right insets and an icon-only continue action on narrow phones.
- Grid layers default off on a new session. Hydration still respects an existing `axial-grid-layers` preference.
- The AXIAL wordmark shine no longer stops after its first 2.92-second cycle; the contradictory one-iteration override was removed while reduced-motion behavior remains unchanged.
- Portrait camera framing stays laterally centered under the full-width sheet rather than shifting away from a rail that no longer exists.

2026-07-15 tutorial and collapsed-pill follow-up:

- Every portrait tutorial step now prepares its layout after the panel state settles, scrolls sheet targets into view, and clips the spotlight to the actual `.panel-body-clip` viewport.
- Tutorial cards for open-sheet steps are placed below the half sheet using their measured height. Rules, appearance, and finish no longer overlap the controls or highlight off-screen content.
- The menu-toggle spotlight uses a smaller viewport allowance, so the right-edge target reads as a compact rounded square instead of a tall cropped capsule.
- The collapsed portrait pill is 142px wide at the tested phone sizes, with equal 5px outer gutters and three contiguous 44px actions separated by subtle rules.
- Portrait browser coverage now walks all seven tutorial steps and asserts card bounds, panel/card non-overlap, spotlight clipping, target containment, pill dimensions, equal gutters, and touch-target size.
- The lookahead root-budget unit test no longer mixes its deterministic node-allocation contract with an unrelated wall-clock deadline; deadline behavior remains covered by the separate end-to-end decision-budget test.

2026-07-15 portrait control continuity follow-up:

- The expanded Classic toolbar now uses the same segmented visual language as the collapsed pill and grows leftward from the same top-right edge.
- Reset, theme, and expand/collapse remain at identical measured coordinates (`x=245/289/333`, `y=11` at 390x844) through the state change. Fullscreen precedes those persistent actions so added controls do not displace them.
- Portrait camera-fit no longer scales the board down when the top sheet opens. Position, target, field of view, and board scale remain identical because the sheet overlays rather than reallocates the scene viewport.
- Landscape and desktop still adjust scale/target for their expanded side rails.
- Responsive browser coverage asserts persistent control coordinates and the shared 12px segmented-button radius; the pure camera-fit test asserts identical portrait framing across expansion.

2026-07-15 Tactical pause:

- Tactical remains implemented internally but is no longer selectable from the match-rules control.
- The disabled 44px Tactical option carries a visible Coming soon badge and an accessible `Tactical mode — coming soon` label.
- Classic stays selected, and choosing AI continues to expose the active Classic difficulty ladder.
- The browser regression now asserts that Tactical is disabled and Classic AI strength remains available.

Final local verification:

- `pnpm check`, `pnpm lint`, `pnpm test:unit`, and `pnpm build`: pass.
- Workspace unit totals after the full-variant continuation: 22 core, 52 AI, 65 web, and 11 Worker tests passed; 15 opt-in evaluation tests are skipped by the default unit gate.
- Full Playwright suite: 16/16 pass, including the two-browser multiplayer flow, half/full portrait sheets, safe tutorial/confirmation bounds, grid-off defaults, and infinite wordmark shine.
- The AI lifecycle browser regression also passed 3/3 repeated runs after replacing a click actionability race with keyboard activation on the transient post-reset mode control.
- Final responsive screenshots inspected at 320x568, 390x844 collapsed/half/full, phone tutorial practice, phone selected-drop confirmation, 430x932, 844x390, and 1440x900.
- `git diff --check`: pass.

Remaining evidence gap: the full variant challenges close the missing rule-mode coverage, but they are still a small seeded sample and not an Elo estimate or a claim that Max beats expert humans. Recorded Caden challenge games, paired seeded openings, and broader tournament statistics remain the next strength gate. Partial-lookahead frequency also shows a future optimization opportunity, but strict iterative deepening is not acceptable unless it first recovers the current strength gates.
