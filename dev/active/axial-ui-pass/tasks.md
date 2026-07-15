# Axial UI Pass Tasks

Status: implementation and local QA complete; real-device PWA smoke remains.

## Review Gate

- [x] Review the full plan with Caden.
- [x] Confirm the portrait control direction; the original bottom-sheet approval was superseded by Caden's 2026-07-14 top-right override.
- [x] Confirm staged-drop default for new coarse-pointer users.
- [x] Confirm light mode remains a fully supported target.
- [x] Confirm keyboard board navigation belongs in this pass.
- [x] Preserve hidden turn/status information while mobile controls are collapsed.

## Milestone 0: Baseline and Contracts

- [ ] Add viewport screenshot baselines for 1440 x 900, 1366 x 768, 1024 x 768, 390 x 844, 375 x 667, 320 x 568, and 844 x 390.
- [x] Cover panel collapsed/expanded, dark/light, Local/AI/Online/Tactical, and tutorial states.
- [x] Add coarse-pointer target-size assertions.
- [x] Add mobile input-font assertion.
- [x] Add 320px collision assertion.
- [x] Add tutorial focus-containment and focus-restore tests.
- [x] Add pure camera-fit helper tests across aspect ratios and board dimensions.
- [x] Add semantic z-index, target-size, panel, type, safe-area, motion-duration, and easing tokens.

## Milestone 1: Responsive Playfield

- [x] Switch the main shell to dynamic viewport sizing.
- [x] Apply top, right, bottom, and left safe-area insets.
- [x] Remove minimum-width brand/control overlap.
- [x] Define the usable playfield rectangle from visible UI insets.
- [x] Implement tested aspect- and inset-aware camera fit.
- [x] Account for expanded desktop/landscape rails in scene framing.
- [x] Preserve the intentionally minimal collapsed-mobile state without persistent turn/status UI.
- [x] Show selected row/column and landing layer only while a move is armed.
- [x] Add a reset-view affordance.
- [x] Verify orientation changes and browser-chrome resize without scene jumps.

## Milestone 2: Touch-safe, State-driven Controls

- [x] Add a shared responsive control-surface shell.
- [x] Render portrait controls as a compact top-right dropdown.
- [x] Retain desktop and coarse-landscape rail behavior.
- [x] Support accessible collapsed and expanded portrait states from one stable anchor.
- [x] Raise coarse-pointer target sizes to at least 44px.
- [x] Raise mobile input text to at least 16px.
- [x] Add visible scroll continuation.
- [x] Promote Online create/join/lobby actions when Online is selected.
- [x] Condense locked match setup into a live summary after play begins.
- [x] Condense locked piece appearance while retaining live-safe appearance settings.
- [x] Preserve advanced board/rule customization behind progressive disclosure.
- [x] Default new coarse-pointer users to staged placement.
- [x] Preserve persisted confirm-drop preference.
- [x] Expose confirm/cancel from a contextual surface only while a move is armed.
- [ ] Add optional subtle haptic feedback only if it remains non-blocking and user-controllable.

## Milestone 3: Onboarding, Help, and Accessibility

- [x] Build the shared native-dialog shell.
- [x] Migrate welcome-tour modal behavior.
- [x] Migrate local game-over behavior.
- [x] Migrate interactive Online result behavior.
- [x] Treat Online countdown as announced, non-interactive status.
- [x] Trap focus, restore focus, and define Escape policy per overlay.
- [x] Fix invalid ARIA on brand and board dimensions.
- [x] Add a normal How to Play entry.
- [x] Allow Replay tutorial from the UI.
- [x] Replace passive board step with camera practice.
- [x] Add a safe practice preview/placement step.
- [ ] Keep the first typed welcome headline; shorten later-step reveal latency.
- [x] Add concise mouse, touch, and keyboard gesture references.
- [x] Add keyboard navigation across the 6 x 7 drop-column plane.
- [x] Announce selected row, column, landing layer, current player, and invalid/full-column states.
- [x] Add non-color-only P1/P2 differentiation.
- [ ] Verify 200% zoom, reduced motion, and keyboard-only flows.

## Milestone 4: Theme and Motion Refinement

- [x] Retune light-mode field and depth hierarchy.
- [x] Retune light-mode grid intersections and labels.
- [x] Verify piece contrast across representative user-selected colors.
- [x] Warn on visually close player colors while retaining band differentiation.
- [x] Convert perpetual HUD shine to first-load/state-change events.
- [x] Add turn-handoff feedback.
- [x] Add selected-column and placement-confirmation feedback.
- [ ] Add Online arrival/ready feedback.
- [ ] Add Tactical multi-action progress feedback.
- [x] Centralize reduced-motion behavior.
- [x] Verify motion never delays access to content or controls.

## Milestone 5: Quality, Performance, and Release QA

- [ ] Run production-build mobile and desktop traces.
- [ ] Record LCP, CLS, interaction readiness, frame pacing, and battery-sensitive scene cost.
- [ ] Decide whether Auto / High / Battery quality presets are justified.
- [ ] If justified, add adaptive DPR/effect limits without changing game state.
- [x] Lazy-load QR generation after bundle measurement moved roughly 23 KB out of the initial route chunk.
- [x] Run `pnpm check`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm test:unit`.
- [x] Run `pnpm build`.
- [x] Run `pnpm --filter @axial/web test:e2e`.
- [x] Run the committed two-context multiplayer flow.
- [x] Run `pnpm deploy:multiplayer:dry-run` after shared Online/config changes.
- [x] Run `git diff --check`.
- [ ] Smoke an installed PWA on a real phone in portrait and landscape.
- [ ] Verify background/resume, safe areas, Online reconnect, and orientation changes.
- [x] Re-run the UI audit against the original viewport matrix.

## Post-release Correctness Follow-up

- [x] Align the dimensions readout to the AXIAL wordmark.
- [x] Guarantee the user opens the first game of every AI-mode series.
- [x] Preserve alternating openers for uninterrupted AI rematches.
- [x] Reset the AI series after switching through Local or Online.
- [x] Cancel stale AI work on undo, reset, and mode changes.
- [x] Add a bounded timeout and fresh-worker recovery for unresponsive MCTS requests.
- [x] Add unit and browser regressions for undo recovery, cancel/retry, and opener lifecycle.
- [x] Reposition portrait controls from the bottom to the top-right without restoring collapsed status UI.
- [x] Remove unused collapsed-toolbar space and expand the panel downward from the same anchor.
