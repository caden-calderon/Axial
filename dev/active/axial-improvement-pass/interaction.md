# Board pointer gesture correction

## Problem

`ColumnPicker.svelte` previously stored only the latest pointer-down position and compared it with the release position. A camera drag that travelled away and returned within eight pixels could place a piece. A second touch could replace the first touch's candidate, allowing a pinch release to place a piece. Pointer cancellation was not handled.

## Change

The picker now delegates tap recognition to `placementGesture.ts`, a small pure stateful helper:

- A primary press/release qualifies only when maximum travel stays within eight pixels and duration stays within 650 ms (inclusive).
- Movement is tracked while the pointer is pressed, including the final release coordinates.
- Pointer IDs are tracked independently. Multi-touch cancels placement until all fingers release; a secondary touch is also rejected if the primary touch began outside the picker.
- Right-button gestures and unmatched releases cannot place a piece.
- Pointer leave/cancel discards the candidate and clears hover. Picker cleanup removes all event listeners and resets gesture state.

Camera controls and board hit testing remain unchanged.

## Verification

Eleven pure tests cover clicks, threshold boundaries, diagonal travel, a drag returning to its origin, both pinch release orders, fingers added during a pinch, secondary touches, right clicks, unmatched pointer IDs, cancel/leave behavior, and teardown/reset. All pass. Prettier and targeted ESLint pass.

Browser interaction checks are coordinated by the root task; this lane did not open another browser.

## Camera rendering while idle

Orbit controls previously used a Threlte task with its default `autoInvalidate: true`. That kept requesting GPU draws even when the camera was unchanged, overriding the scene's default on-demand rendering.

The camera update task now uses `autoInvalidate: false`. A Three.js OrbitControls `change` listener invalidates the frame while orbit, zoom, or damping actually moves the camera; cleanup removes the listener before disposing the controls. The update task still runs so damping completes normally. The original pass also invalidated projection offsets explicitly. The feedback follow-up removes those offsets entirely: panel expansion no longer changes board scale or projection. Normal camera aspect updates still handle viewport resizing.

An actual-render browser test then identified a second unconditional render source: `BoardLabels` was also using the default auto-invalidating task. It now initializes against the mounted camera, uses `autoInvalidate: false`, and requests frames only while its smooth direction-following changes by a visible amount. A 0.0001 direction threshold prevents an asymptotic interpolation tail from requesting frames indefinitely. Hidden labels skip this work and initialize again when shown.

Billboard texture and opacity effects now explicitly invalidate their changes. Opacity updates no longer set `material.needsUpdate`, since opacity is a uniform update and does not need shader recompilation. This preserves initial texture visibility and smooth label crossfades under on-demand rendering.

These changes address needless GPU drawing for an empty board and for a settled board with reduced motion. Other intentionally active animations may still request frames. Installed Threlte task types/source and Three.js OrbitControls event behavior were inspected before making the changes. The actual-render idle browser regression passed after a fresh production build.
