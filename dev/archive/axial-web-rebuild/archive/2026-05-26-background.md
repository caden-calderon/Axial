# Axial Web Rebuild Background Archive

Archived on 2026-05-26 to keep the active handoff docs short. Read this only if you need deeper architectural background.

## Source Project

Axial began as a Unity + Python desktop project:

- Unity handled the original 3D game and MediaPipe hand tracking.
- Python handled the active AI runtime through enhanced MCTS, Numba-accelerated 1D board representation, and a TCP JSON bridge to Unity.
- Training experiments exist under `Training/` with PyTorch policy/value work, but that is not the current runtime priority.

The rebuild intentionally preserves the Unity project in `axial-unity/` and creates the new browser-native version in `axial-web/`.

## Product Direction

Make Axial feel like a polished browser-native strategy game rather than a Unity project embedded in the web. The first screen should be the playable 3D board with compact controls, not a landing page.

Target experience:

- Cinematic but readable transparent 6 x 6 x 7 cube.
- Clear hover/selection feedback for 42 playable columns.
- Smooth gravity drop animations with impact/contact cues.
- Mouse/touch-friendly camera controls.
- Light and dark themes.
- Local human-vs-AI later, but AI waits until the visual/control foundation feels locked.

## Original Architecture Notes

`packages/core` should stay pure TypeScript with no Svelte, DOM, or Three.js dependency. It owns board representation, move generation, gravity/drop logic, win detection, undo/replay primitives, serialization, and later AI evaluation helpers.

Start with typed arrays for clarity and speed. Consider bitboards or Rust/WASM only if profiling proves TypeScript typed arrays are insufficient.

Browser AI should eventually live in `packages/ai`, expose a stable async player interface, and run heavier search in Web Workers. Difficulty should map to time/simulation budgets rather than arbitrary labels.

Training should remain offline in Python/PyTorch, likely under `tools/training`, with browser inference exported later through ONNX Runtime Web or TensorFlow.js after a proof of concept.

Rendering should remain Three.js/Threlte based. Prefer reusable geometries/materials, instancing where helpful, selective bloom only on intentional emissive accents, and reduced effects on mobile/low-power modes.

The game route currently disables SSR at the page boundary because it is WebGL-only. If the project adds docs, menus, or other non-game routes, keep those SSR-capable and lazy-load the 3D play route.

## Preserved Decisions

- Keep Python for serious model training.
- Start with TypeScript core and client-only playability.
- Keep AI/training deferred until the web game feels polished.
- Use canonical move history for replay/undo/redo.
- Avoid global SSR disable unless the app intentionally becomes a pure game SPA.
