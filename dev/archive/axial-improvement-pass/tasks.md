# Tasks

- [x] Read objective and current docs; inspect git state and predecessor work.
- [x] Preserve predecessor commits on a new improvement branch.
- [x] Run app in the in-app browser and inspect main baseline.
- [x] Confirm baseline suite outcomes.
- [x] Correct important AI and multiplayer findings with regression tests.
- [x] Improve 3D game feel, motion accessibility, and restore behavior.
- [x] Improve contextual UX/onboarding/result clarity after live review.
- [x] Decide and implement restrained optional audio if justified.
- [x] Complete desktop/mobile, keyboard, reduced motion, lifecycle and online QA.
- [x] Verify final review fixes for rapid draw, duplicate-snapshot win staging and undo during a fall; confirm failures on the old build and passes on the new build.
- [x] Complete workspace gates and document final evidence/limitations.


## Feedback follow-up

- [x] Reproduce and fix native worker serialization after either player's first scored line.
- [x] Remove silent random fallback and verify worker failure/retry cleanup.
- [x] Make settings overlay a stationary board on desktop and phone.
- [x] Move scores into Match settings and simplify result hierarchy/actions.
- [x] Inspect two-line victory, score progress, review/redo, keep-board, and 320px light/dark layouts in the in-app browser.
- [x] Finish final production-preview regression gate and record evidence (31/32 full run, then both board-position tests pass after fixing the test frame wait).


## September 21 tutorial and controls follow-up

- [x] Clarify introductory tutorial copy and replace staging with an actual winning practice drop.
- [x] Preserve saved matches and verify practice reentry/early exit.
- [x] Fix automatic border sweep competing with pointer movement.
- [x] Remove Crystal and migrate saved shape preferences to Cube.
- [x] Scroll toolbar with the settings panel and preserve mobile spotlight clipping.
- [x] Pass workspace check/lint, 140 web unit tests and 27/27 production-preview browser checks.


## Fuller practice and UI consistency

- [x] Populate a legal 24-piece practice position with short stacks and one winning target.
- [x] Inset the scrollbar and keep toolbar positions stable through open/collapse.
- [x] Bundle a consistent UI typeface, standardize weights and preserve brand styling.
- [x] Verify slow font loading and immediate control after tutorial exit.
- [x] Pass workspace checks/lint, 141 web unit tests, 31/31 production browser checks and a fresh-build 3/3 font follow-up.


## Tutorial target and scrollbar follow-up

- [x] Add persistent glowing winning tile and matching practice instructions.
- [x] Hide native settings scrollbars at all viewport sizes, preserving scrolling.
- [x] Fix expanded/collapsed toolbar hover and focus clipping.
- [x] Pass checks/lint/build and final 12/12 scoped production browser checks.

## Themed hints and compact layouts

- [x] Replace native hover titles with themed, accessible hints for mouse and keyboard.
- [x] Remove mobile toolbar nesting/dividers and smooth sheet expansion.
- [x] Prevent intermediate-width status/settings overlap and fit the Tactical badge.
- [x] Disable tutorial text selection and verify all steps on phones, landscape and small laptops.
- [x] Pass type checks, lint, focused unit tests and 29/29 fresh production browser checks.

## Session-end visual fixes

- [x] Remove transient tutorial scrollbar flashing during typing.
- [x] Restore hover clearance in expanded compact controls.
- [x] Reproduce both defects before fixing, and check hover after its transition settles.
- [x] Pass checks/lint/build and 32/32 scoped production browser regressions; retain session handoff notes.
