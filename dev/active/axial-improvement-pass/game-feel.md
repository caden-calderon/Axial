# Game feel, scene and presentation

Date: 2026-09-07

## Findings and implementation

- The old random 1.02–1.28s eased-out fall approached its support slowly. The new bounded height-dependent fall accelerates under gravity, followed by a restrained compression/rebound and a brief landing ring. A per-column landing reservation keeps fast stacked replies behind their supporting piece; unrelated columns remain independent.
- Only a fresh single move appended to the same history animates. Existing pieces and lines initialize settled; restore/reconnect catch-up and scene recovery do not replay the entire board. Player/kind are included in move render keys; dimension replacements remount geometry.
- Undo and bulk history replacements remount the piece/line presentation, cancel pending landing callbacks and silence already-scheduled sound. Ordinary single appends and duplicate snapshots preserve the current components.
- Winning lines start after the final fall/impact. A real scene-completion gate prevents result overlays from obscuring an unfinished line, even under a slow renderer. This covers Local/AI and Online. A five-second recovery fallback prevents a broken scene from making results inaccessible.
- Draw completion accepts only the terminal piece's settlement callback, so an earlier fast piece cannot reveal the result over the last fall. Semantically identical online snapshots preserve active marker callbacks and per-column landing reservations.
- Scene completion waits for Svelte to apply the settled Three.js object state and for that frame to paint before exposing a result. A version and cancellable animation-frame handle prevent a deferred reveal from surviving reset, history replacement, teardown or fallback recovery.
- Reduced motion renders drops, previews and line markers statically and disables orbit inertia. Fresh reduced-motion moves may still play opted-in sound; restored histories remain silent.
- Settled pieces remove fall-trail meshes; settled line tasks stop. The line front uses a fixed geometry with scale rather than reallocating sphere geometry on every frame.
- The initial camera target offset pushed the board toward the right rail. Projection offsets now place it in the free playfield without overwriting the player's orbit/zoom during same-mode resizes and panel toggles. Portrait top-sheet framing remains fixed.
- Portrait's farther camera was inside fixed desktop fog, making pieces almost disappear. Fog now follows the framing distance, restoring phone piece contrast in both themes.
- Keyboard selection has a compact visible coordinate/layer readout and a current-state screen-reader announcement. Held activation keys do not create repeat moves; arrow navigation cancels an older staged drop. Invalid notices clear when history changes.
- Intro copy explicitly teaches stacking, spatial diagonals and player bands. Multi-line matches show current scores within the Match section; How to play explains maximal-run scoring. Result dialogs describe the winning direction(s) and totals while preserving all review/rematch actions.

## Evidence and limits

- Pure motion tests cover acceleration, continuity, support bounds, reduced-motion samples, restoration-vs-append classification, bounded duration and stacked landing reservations.
- Projection tests cover initial geometry beside rails and stable camera references. Browser regressions inspect actual rendered pieces/lines and the actual orbit/zoom state.
- Three final lifecycle regressions failed against the preserved pre-fix production build: a rapid full-board draw showed its result with the final piece 0.93 board units above its landing; an identical online snapshot lost the timely win callback; and undo retained a piece's in-flight impact. These exercise the actual app and renderer, rather than a separate animation model.
- In-app visual review covered desktop, phone, light/dark, collapsed/expanded controls, keyboard feedback and multi-line score layout. See context.md for final run totals and viewport matrix.
- Audio is a restrained opt-in implementation. Scheduling, browser activation and cleanup are tested; perceived sound quality still benefits from the owner's listening check.
- Dense-board software rendering remains a performance limit: the 252-piece cube fixture at 1366×768 needed more than five seconds to mount and exceeded the test's 30-second timing window. The legal full-board draw regression uses the supported crystal appearance at 800×600 and records only the final column to keep instrumentation manageable. This does not establish dense cube/orb performance on physical GPUs; shared piece geometry and draw-call reduction are sensible future profiling targets.

## Implementation references

Installed Threlte supports reactive `useTask({ running })` and on-demand rendering. Tasks that only update OrbitControls use `autoInvalidate: false` and explicitly invalidate on camera changes. [Threlte useTask](https://threlte.xyz/docs/reference/core/use-task)

Svelte's `prefersReducedMotion` is a reactive media query shared by scene components. The installed runtime implementation was verified in addition to the documented behavior. [Svelte motion](https://svelte.dev/docs/svelte/svelte-motion)
