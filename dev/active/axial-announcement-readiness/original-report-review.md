# Original reports: announcement editorial review

Status: source and relevant PDF pages inspected; original artifacts preserved. No report rewrite, game change, publication or Unity runtime test performed.

## Recovered original PDFs

The game report is **Axial: A 3D Strategy Game with Gesture-Based Hand Tracking Controls**, 16 pages, dated December 11, 2025. The AI report is **Monte Carlo Tree Search for 3D Connect Four: Tackling Combinatorial Explosion with Intelligent Sampling**, 14 pages, dated December 2025. Both credit Caden Calderon. The sources remain in `Reports/Game_Report.tex` and `Reports/AI_Report.tex`.

- `output/pdf/axial-original-game-report.pdf`: exact copy of `home/caden/Downloads/Reports.pdf` inside `CS462.zip`. SHA-256 `6f0f6e3eb62be53809811a0b48a55569ea58ede7f966aab218033662f0c06257`.
- `output/pdf/axial-original-ai-report.pdf`: exact copy of `home/caden/Downloads/Reports-1.pdf` inside `caden_calderon.zip`. SHA-256 `c6c1d80133dc8abcd3bf67ebe41a852cdb7be7faf5d8799ae619f3f00b855a72`.

These are extracted original documents, not newly compiled or corrected editions. The game PDF already fixes the LaTeX source's “Flat diagonals (4)” typo to six. The AI PDF reports 20/20 Enhanced-vs-Basic wins, whereas its checked-in LaTeX source reports 15/20. This difference makes source provenance important; do not silently rebuild over the originals. Original evaluation numbers are historical author-reported results, not results independently reproduced in this session.

Relevant visual checks: game title and pages 7–10 (Table 3, sections 4.2–4.5 and Listing 2), AI title and pages 12–13 (evaluation and Table 4). The game PDF has an overlong smoothing sentence extending into the right margin on page 8; it needs layout cleanup before a polished re-release. This was not a complete all-page layout audit.

The old public Drive URL in `main/README.txt` resolves to a page titled `CS462.zip - Google Drive`, not a directly readable paper. The public GitHub report links expose LaTeX sources. No new public PDF URL has been created.

## Strongest Unity story

- Regular webcam + MediaPipe hand landmarks → C# interaction: pinch to grab, release to drop, one hand holds while the other pinches/drags to rotate. `PinchDetector.cs`, `GrabController.cs`, `GamePiece.cs`, `RotationController.cs` under `axial-unity/Assets/MediaPipeUnity/Samples/Scenes/Hand Landmark Detection/main/` support this directly.
- Game report section 4.3 / PDF Table 3 records failed depth proxies: fingertip/bounding-box measurements confuse finger curling with distance, and one-axis width changes with hand orientation. Treat the experiment history as Caden's original report, not a new experiment performed here.
- `HandTracker3D.cs:329` computes normalized palm width in screen X, width in screen Y and wrist-to-middle-knuckle height, then takes the maximum. It uses wrist/knuckle landmarks rather than finger tips for this depth proxy. It is an interaction heuristic, not metric depth reconstruction or full rotation invariance.
- Hand-size and position interpolation, smoothed pinch point/object following, movement dead zones, separate pinch/release thresholds and consecutive-frame confirmation reduce instability. Source checks: `HandTracker3D.cs:413`, `GrabController.cs:220`, `GrabController.cs:508`, `PinchDetector.cs:202`. Avoid the paper's absolute “immune,” “eliminated jitter” and “any webcam” wording.
- Original Python AI: tactical checks, MCTS/UCT, flat uint8 NumPy state, Numba-compiled repeated board/rollout operations and subtree reuse. `main/mcts.py:163`, `:208`, `:373`; `main/bitboard.py`; `main/axial_ai_server.py:250`. No need to explain the TCP protocol in the LinkedIn caption.

## Web story

The web version is a separate SvelteKit/TypeScript/Three.js/Threlte implementation, not a Unity WebGL export. Pointer placement and orbit controls, practice-game onboarding and completed-line feedback make the spatial game usable through the browser. The AI combines MCTS, bounded alpha-beta lookahead and tactical checks in a Web Worker. Rule options allow board-size changes, connect four/five and one/two/three completed lines; multiple-line matches continue on the same board. AI, shared-device and private online play can be mentioned without room-infrastructure detail.

Evidence: web `package.json`, `game/scene/ColumnPicker.svelte`, `OrbitCameraControls.svelte`, `game/onboarding/practiceGame.ts`, `game/ui/MatchSettingsPanel.svelte`, `game/ui/MatchLineProgress.svelte`, `game/state/classicAi.worker.ts`; AI `classic/mcts.ts` and `classic/lookahead.ts`; core `index.ts`.

## Before promoting the papers as revised technical references

Preserve original PDFs and label any revision separately. The game report is the best primary companion for this announcement because its sections 4–5 explain the distinctive hand-interaction work; the AI report is a useful second reference.

- Game report: soften claims of gesture immunity/perfect rotation stability; these are heuristics with calibration limits. The three measurements are 2D projected palm measurements, not three orthogonal 3D distances. Exact smoothing/dead-zone values in the report do not all match the current preserved C# defaults; describe them as historical settings only if a matching scene/version supports them. Fix the page 8 overflow in a revised edition.
- AI report: `3^252` counts unrestricted assignments, not reachable legal states. Do not claim bounded minimax/alpha-beta is categorically impossible; the current browser uses it alongside MCTS.
- The report's full-rollout RAVE explanation exceeds the implementation: `main/mcts.py:326` returns an empty rollout-moves list, and backpropagation updates from tree-path moves. Describe exactly what exists or revise that section.
- Adaptive time-budget helper is not called by the Unity Python server, which passes simulation counts to search. Avoid presenting that helper as integrated live behavior.
- Benchmark ratios are not all isolated measured JIT speedups: `main/benchmark.py:591` estimates Python simulation throughput, and the rollout comparison changes policy as well as compilation. No original run receipts were located by the focused review. Keep 619 sims/sec, 24x/125x and win-rate claims out of the announcement.
- The LaTeX sources contain commented figure placeholders and dynamic dates. The original PDFs have fixed 2025 dates; do not give them a new creation date by blindly recompiling.

These findings are editorial follow-up, not a request to rewrite the historical project or remove its functionality. The LinkedIn draft uses claims supported by both the relevant source and report, omitting uncertain quantitative claims.

## Article comprehension pass

The article was expanded after Caden clarified its format and requested explanations for both technical and general readers. Additional inspection covered the full hand-routing code, landmark-to-scene placement, normalized palm measurements, grid snapping and rotation, original search selection/expansion/rollout/backpropagation/root advancement, Python server move flow, historical web AI design decisions, current common-depth lookahead, input discrimination and rule-specific threat regressions.

Key explanations now grounded in those details:

- MediaPipe provides detection/landmarks; Caden's work maps those outputs into a usable spatial controller. Official result documentation confirms image-landmark depth is relative to the wrist, not an absolute scene-position control: https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/python. This avoids saying MediaPipe has no 3D output.
- `HandTracker3D.CalculateHandSize` normalizes three projected palm measurements and takes their maximum. The article explains this as a comparable 0-to-1 scale and a less orientation-sensitive depth proxy, not an exact reconstruction.
- `GamePiece.UpdateGridPosition` uses an additional hysteresis margin before switching its locked column. This links the mathematical idea to a visible problem: flickering between adjacent columns. It is separate from `PinchDetector`'s grab/release thresholds.
- The Python board's one-byte-per-cell flat representation and height-contiguous indexing explain what the NumPy/Numba optimization actually changes. Search outcome/visit statistics, tactical guided rollouts, UCT exploration and subtree reuse are explained without the disputed RAVE or benchmark claims.
- `classic/lookahead.ts:139` commits new root scores only after every retained candidate completes the iteration. The article explains why a time-limited search needs comparable completed analysis, without claiming equal node counts or perfect/exhaustive play.
- `placementGesture.ts` tracks maximum pointer travel and blocks multi-touch placement; the tutorial has a real isolated winning move. These supply concrete browser interaction examples.
- `threatSafety.test.ts` covers an already-completed run extension and a gravity-support trap; core maximal-run scoring and fast evaluation distinguish line progress from match victory. The article uses the former as its accessible rules/AI example.

Scope remains editorial: code and existing regression tests were read, not changed or rerun. No new gameplay, physical webcam, performance, player-study or benchmark result is claimed. The original-vs-browser distinction remains explicit: cross-turn subtree reuse is described only for Python; web uses its current per-decision search. Original papers remain byte-for-byte intact.

## Original versus browser AI: comparison behind the revision

The two opponents share MCTS plus tactical guidance, but the browser engine is not just the Python code translated into TypeScript. Current source comparison supports the following:

- Original Python uses threat-ordered tree expansion and tactical guided rollouts toward a terminal outcome (`main/mcts.py`, `main/bitboard.py:460`). The current web engine adds direct alpha-beta lookahead and capped rollouts that score unfinished positions (`classic/lookahead.ts`, `classic/mcts.ts:777`).
- The Unity server initializes a connect-four, one-line game. The Python board library already parameterizes dimensions and line length, so do not claim Python was inherently unable to represent connect five. The browser's cumulative two/three-line objective and rule-aware evaluation are a substantive additional responsibility (`main/axial_ai_server.py:207`, core maximal-line scoring, `classic/fastEvaluation.ts`).
- Python keeps eligible explored subtrees across turns. Web builds a new `MctsSearch` for a decision and uses bounded within-decision reuse in lookahead. The article describes subtree reuse only in its original Python section.
- Browser state supports make/unmake and affected-segment updates, and search includes progressive widening and more detailed threat handling. These are real implementation differences but not all need to be listed in a general-audience article.
- Separate Python process versus browser Web Worker changes deployment and responsiveness boundaries. It does not itself establish stronger play. No stronger-than-original or exact speedup claim is made.

The revised article explains the shared idea once, then emphasizes alpha-beta lookahead, the different match objective and bounded browser work. It removes the selected UI prose and the earlier completed-depth bookkeeping detail to keep this section focused.

## Follow-up: requested source-to-PDF conversion

Caden requested PDFs of both checked-in LaTeX sources after approving the final article pass. New `output/pdf/Game_Report.pdf` (15 pages) and `output/pdf/AI_Report.pdf` (14 pages) preserve the source content, retain the historical dates, and receive only layout improvements. All 29 pages were rendered and visually checked. Recovered originals remain unchanged. The conversion does not revise the technical claims identified above; it is not a corrected scholarly edition. See `pdf-build-notes.md` for exact source changes, commands, checksums and verification. The article uses local PDF links pending authorized public hosting.
