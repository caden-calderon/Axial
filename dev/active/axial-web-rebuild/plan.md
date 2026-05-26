# Axial Web Rebuild Plan

## Product Direction

Make Axial feel like a polished browser-native strategy game rather than a Unity project embedded in the web. The first screen should be the playable 3D board with a compact control surface, not a marketing landing page.

The target experience:

- A cinematic but readable 6 x 6 x 7 transparent cube.
- Clear hover/selection feedback for 42 playable columns.
- Smooth piece drop animations with gravity and impact feedback.
- Mouse/touch-friendly camera controls.
- Light and dark themes.
- Difficulty selection with AI thinking feedback.
- Local human-vs-AI as the primary game mode.
- Strong internal architecture so later work can add trained models, multiplayer, hand tracking, or mobile polish without rewriting everything again.

## Proposed Repository Shape

Use a pnpm workspace and keep the old Unity/Python project intact while building the new version beside it. The root should eventually have:

```text
axial-web/              # new browser-native main version
axial-unity/            # preserved Unity version
```

```text
axial-web/
  apps/
    web/                  # SvelteKit app
  packages/
    core/                 # Pure TypeScript game engine
    ai/                   # Runtime AI players, workers, model adapters
    renderer/             # Threlte/Three scene components and visual systems
    ui/                   # Shared Svelte UI components/theme primitives
    shared/               # Types, constants, utilities
  tools/
    training/             # Python training pipeline, exports browser-ready model artifacts
    benchmarks/           # AI and engine performance scripts
  docs/
    architecture/
    ai/
    visual-design/
```

Strong reason to keep Python: model training. Browser/runtime code should be TypeScript, but serious neural training is still much better served by Python + PyTorch. The trained model can be exported to ONNX or TensorFlow.js format for browser inference.

## Architecture

### 1. Game Core

`packages/core` should be pure TypeScript with no Svelte, DOM, or Three.js dependency.

Responsibilities:

- Board representation.
- Move generation.
- Gravity/drop logic.
- Win detection across the 13 canonical directions.
- Undo/redo or immutable transition support.
- Serialization for workers, saves, replays, and tests.
- Evaluation helpers for AI.

Representation:

- Start with typed arrays: `Uint8Array(252)` for clarity and speed.
- Preserve the current flat index formula for continuity.
- Wrap indexing in named helpers so renderer and AI do not duplicate coordinate math.
- Consider bitboards later if profiling says typed arrays are not enough.

Tests:

- Unit tests for every direction class.
- Gravity edge cases.
- Draw detection.
- Invalid move rejection.
- Property tests for coordinate/index round trips.

### 2. AI Runtime

`packages/ai` should expose a consistent player interface:

```ts
interface AiPlayer {
  chooseMove(state: GameState, options: AiOptions): Promise<MoveDecision>;
}
```

Initial opponents:

- Random: debugging/baseline.
- Greedy: immediate win/block plus heuristic scoring.
- Enhanced MCTS: TypeScript port of the current Python AI, running in a Web Worker.
- Neural-guided MCTS: later phase, combines search with a trained policy/value model.

Runtime model:

- AI runs off the main thread in Web Workers.
- UI receives progress events: simulations, best move so far, principal variation, confidence.
- Difficulty controls map to time budgets and/or simulation budgets, not just raw simulation counts.
- Keep the player interface stable so stronger models can replace simpler ones.

### 3. Training Pipeline

Training remains a separate offline pipeline under `tools/training`.

Recommended path:

- Preserve current Python/PyTorch work as reference, then rewrite the pipeline cleanly.
- Generate self-play data using the same rules as `packages/core`.
- Train a compact policy/value network.
- Export browser inference artifacts:
  - ONNX for `onnxruntime-web`, or
  - TensorFlow.js graph/model if that proves easier to bundle.
- Add model cards/metadata: architecture, training data version, Elo estimate, benchmark results.

Training levels:

- Level 1: heuristic/MCTS only.
- Level 2: MCTS distilled policy model for fast move suggestions.
- Level 3: policy/value guided MCTS.
- Level 4: stronger self-play model with curriculum and adversarial evaluation.

### 4. Rendering

`packages/renderer` should own the Threlte scene, while `apps/web` composes it with UI.

Visual direction:

- Board as a realistic glass/acrylic lattice cube.
- Subtle beveled rails or translucent rods instead of heavy opaque grid lines.
- Pieces as glossy spheres, capsules, or rounded pucks with emissive cores.
- Theme-aware material palettes:
  - dark: deep graphite environment, cyan/orange/blue energy accents
  - light: frosted glass board, clean studio lighting, softer glow
- Bloom only on emissive accents, not the whole screen.
- Shadows and contact cues so pieces feel grounded in cells.
- Subtle idle motion: board breathing glow, slow light sweep, hovered column pulse.

Performance:

- Reuse geometries/materials.
- Consider instanced meshes for board markers and settled pieces.
- Avoid 252 independent heavy custom-shader meshes unless profiling permits it.
- Use reduced postprocessing on mobile/low-power mode.

Interaction:

- Orbit/pan camera with constrained angles.
- Hover a column to preview drop height.
- Click/tap to commit a move.
- Optional keyboard shortcuts later.
- Touch-first layout should not require precise tiny clicks.

### 5. SvelteKit App

`apps/web` responsibilities:

- App shell and routing.
- Theme persistence.
- Settings drawer/panel.
- Game state orchestration.
- Save/replay UI.
- Worker lifecycle.
- Accessibility overlays and non-3D status text.

Rendering strategy:

- Disable SSR only for the game route or for the game component boundary as needed.
- Avoid importing Three.js/Threlte from server-executed code.
- If the first version is truly a single-page game, global `ssr = false` is acceptable, but route-level isolation leaves more room for docs/dev pages later.

Suggested screens/panels:

- Main play view: board full screen, compact HUD.
- Settings drawer: difficulty, theme, graphics quality, camera sensitivity, animation speed.
- AI panel: thinking state, simulations, move confidence, optional explanation.
- Game over modal: winner, move count, rematch, replay.
- Debug panel gated behind dev mode.

### 6. Persistence and Replays

Add replay support early because it helps testing, UX, and AI training.

- Move history as canonical `(row, col, player)` list.
- Deterministic reconstruction from seed + moves.
- Export/import replay JSON.
- Snapshot tests can replay known tactical positions.

## Key Decisions

### TypeScript Core vs WASM

Start with TypeScript typed arrays. It is faster to build, easier to test, and good enough until proven otherwise.

Escalate to Rust/WASM only if:

- MCTS performance is materially worse than target.
- Neural-guided search needs heavier board evaluation.
- Worker parallelism plus typed arrays is not enough.

### Client-Only AI vs Server AI

Start client-only for browser playability. A server AI can be added later for heavyweight models, matchmaking, anti-cheat, or cloud-hosted training demos.

### Model Inference Format

Defer final choice until a proof-of-concept:

- ONNX Runtime Web is attractive for Python/PyTorch export and WebGPU/WebAssembly backends.
- TensorFlow.js may be simpler for browser deployment if model size and ops are friendly.

## Phased Delivery

### Phase 0: Foundation

- Create pnpm workspace.
- Scaffold SvelteKit app.
- Add TypeScript, linting, formatting, tests.
- Build pure game core with tests.
- Port current board/win logic carefully.

### Phase 1: Beautiful Playable 3D MVP

- Threlte scene with generated board.
- Pointer hover and click-to-drop.
- Local human vs human first; basic AI can wait until visuals and controls feel good.
- Piece drop animations.
- Light/dark theme.
- Elegant sci-fi glass visual direction.
- Scene/theme architecture that can later support multiple selectable vibes.

### Phase 2: Browser AI

- Port enhanced MCTS to TypeScript.
- Run AI in Web Worker.
- Add difficulty/time controls.
- Add progress UI.
- Benchmark against random/greedy/basic MCTS.

### Phase 3: Visual Polish And Scene Variants

- Glass/acrylic board materials.
- Emissive pieces and selective bloom.
- Better lighting and shadows.
- Camera constraints and cinematic transitions.
- Quality presets.
- Optional scene/vibe selector once the primary visual language works.

### Phase 4: Better AI Models

- Clean Python training pipeline.
- Self-play data generation.
- Train compact policy/value model.
- Export model for browser inference.
- Add neural-guided MCTS or model-assisted move ordering.

### Phase 5: Productization

- Replay browser.
- Tutorial/assist mode.
- Mobile/touch polish.
- Deployment pipeline.
- Optional hosted benchmarks/model leaderboard.

## Risks

- MCTS in TypeScript may need careful worker design to avoid UI stalls.
- Web neural inference may be too large or slow unless model architecture is intentionally compact.
- Threlte/Three SSR boundaries can cause build issues if browser-only imports leak into server code.
- Great visuals can hurt readability. Strategy clarity should win over effects.
- AI training can consume project scope quickly; lock the runtime AI interface before chasing model quality.
