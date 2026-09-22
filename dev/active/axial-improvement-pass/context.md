# Axial improvement pass — context

Updated: 2026-09-21. Branch: `codex/axial-improvement-pass`, based on the user's `1bff1e8` predecessor work. Caden approved committing and pushing the completed improvement and polish pass after local playtesting. Original `main` and `codex/classic-ai-mobile-overhaul` branches remain intact. Unity, dependencies and production configuration remain untouched; merge and deployment are separate steps. Historical validation notes below describe the work before this commit.

## Latest user feedback

September 21 playtest polish is documented in [polish-2026-09-21.md](polish-2026-09-21.md). It supersedes the band markers and spatial result prose below: pieces now use color without bands/wireframe, results show moves and persisted match duration, Online setup opens below its mode switch, tutorial slides 1/2/7 use revised copy, and AI turns have a cancellable 650 ms presentation minimum. The latest tutorial exercise now requires an actual fourth-piece win on an isolated 24-piece practice board; UI text uses locally bundled Inter with a consistent weight scale while the brand styling stays separate, and the inset settings scroller now hides native rails on every viewport while preserving scrolling, with hover clearance for toolbar icons and a persistent glowing practice target; Crystal is removed with saved preferences mapped to Cube, the border sweep no longer competes with hover, and the toolbar scrolls with settings. Search behavior and budgets are unchanged. Current focused checks pass; the separate release findings in [merge-review-2026-09-21.md](merge-review-2026-09-21.md) remain open.

Latest compact-layout follow-up: hover/focus hints now use the app theme, mobile controls use individual circular buttons with an animated sheet, and the turn chip clears the settings panel at intermediate widths. Tutorial text is nonselectable, with compact typography and placement checked through every step on phones, landscape screens and small laptops. Evidence is recorded in the final section of the September 21 polish notes.

Session-end UI fixes also suppress transient native tutorial scrollbars during typing and preserve hover clearance in expanded compact settings. Hover regressions now wait for the completed transform, including 320px and 540px widths. The remaining release/security/share-preview work is still tracked in the merge review.

The follow-up in [feedback-followup.md](feedback-followup.md) supersedes the original panel framing and score/result layout below. Settings now overlay a stationary board with no projection or scale change. Completed-line snapshots copy direction tuples so native AI workers can continue after either player scores; search failures expose retry rather than random fallback. Score progress sits inside Match settings, and the result dialog uses a compact outcome and actions without redundant target text.

## Implemented

- Retained the reviewed Classic AI/mobile branch, then corrected three tactical evaluation mistakes: losing support forks, phantom maximal-run extension threats, and overstated quiescence wins. The existing Easy/Medium/Hard/Max worker architecture remains.
- Rejected invalid fractional/NaN coordinates and expanded canonical rule coverage across all 13 spatial line directions, both players, Connect 4/5, maximal runs, crossings, blockers, terminal states and replay.
- Replaced slow eased-out drops with bounded gravity falls, small impacts and landing rings. Fast stacks preserve support order. Restored boards appear settled and silent. Win/draw results wait for the actual terminal scene sequence, with a recovery fallback.
- Added reduced-motion behavior throughout drops, previews, completed lines and camera inertia. Fixed phone piece contrast by matching fog to camera framing.
- Preserved orbit/zoom through panel toggles and same-mode resizes without resetting the camera; the follow-up removes panel-dependent projection offsets and scale changes entirely. Removed unconditional GPU draws from idle camera and board-label tasks.
- Prevented drag-return and multi-touch releases from becoming accidental placements. Added visible keyboard coordinates, fresh screen-reader state, held-key protection and cancellation of stale staged selections.
- Improved onboarding copy, spatial result descriptions, and multi-line score visibility. Preserved the existing phone top sheet, control order, collapsed status behavior, branding and local/AI/Online setup.
- Added quiet procedural impact, invalid-input and win sounds, off by default, with immediate mute, user-gesture activation, visibility handling and resource cleanup.
- Hardened online terminal errors, late transport responses, expired sessions and stale-revision recovery. Duplicate snapshots preserve active scene animation state. Server authority and existing room infrastructure remain.

See [plan.md](plan.md) for decisions and architecture; the focused [core](core.md), [AI](ai.md), [multiplayer](multiplayer.md), [interaction](interaction.md), [audio](audio.md), and [game-feel](game-feel.md) notes contain reproductions and implementation evidence. [The web README](../../../axial-web/README.md) now explains local setup, rules, architecture and verification.

## Validation

Follow-up verification: all 365 unit tests pass; check/lint and fresh production builds pass. The production browser run passed 31 of 32 cases, followed by 2/2 passing board-position cases after fixing an asynchronous frame-observation race in the new test. All 32 cases have passing evidence across those runs. Full details and manual UI checks are in [feedback-followup.md](feedback-followup.md). The original pass evidence below is retained as history.

- Original main baseline passed: core 22, AI 39, web 63, Worker 11, and 13 browser tests. The imported branch was inspected and its relevant unit baselines rechecked before lane changes.
- Current unit coverage: core 147, AI 65, web 142, Worker 11 (365 tests). AI's 43 longer opt-in evaluations remain skipped in the default unit command.
- Initial improvement-pass production-preview browser gate passed **27/27**, with one worker and no retries or skips (1.9 minutes). Eleven new tests inspect real Three.js renders, camera state, first result appearance and AudioContext starts. Three lifecycle regressions demonstrably failed against the preserved pre-fix build: rapid full-board draw staging, identical online snapshot during a win, and undo during a fall. The final draw assertion verifies that the displayed terminal piece is fully settled when the result first appears.
- AI reduced/full-budget challenge sets each passed 13/13. Six-rule strategy floor passed. A small controlled Max-versus-Hard check finished 3–1 for Max; this is a diagnostic, not a strength rating.
- Workspace check/lint passed with zero Svelte errors/warnings. Production build passed with the existing large-chunk advisory. The final page/scene changes passed targeted lint and Svelte checks; the final browser source was formatted/linted. `git diff --check` passed.
- Manual in-app visual review covered 1440×900, 967×743, 844×390 landscape, 390×844 and 320×568; light/dark, expanded/collapsed controls, keyboard readout, score strip and result dialog. Temporary viewport override was reset. Clean reload logged no browser errors.
- Two-player tests use the real local Worker for room creation/join, readiness/countdown, moves, refresh/reconnect and leave. Eight additional rooms each accepted exactly one of four concurrent guest requests.

## Local preview and remaining limits

The web development server is left running at `http://127.0.0.1:5173/?tour=0`; the local room service is at port 8787 with a command-line origin override for local invitation links. Health returned 200, a disposable room returned the correct local invite URL, and that room was expired afterward. The in-app preview is reset to a fresh Local match with two lines to win, dark theme, and the user’s current sound preference preserved. Development runtime details can change between sessions; use the README commands to restart them.

Physical-phone touch behavior, perceived sound quality on an output device, public-network deployment and full human AI strength assessment remain external acceptance checks. Dense cube boards were slow under the software test renderer; the full-board draw regression now uses Orb at 800×600 following Crystal removal; game-feel.md retains the earlier historical measurements. No deployment was attempted. This implementation pass and its local validation are complete; these results do not imply that the unshipped branch was verified in production.
