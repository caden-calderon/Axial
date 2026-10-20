# Experience audit (A), 2026-10-14

Read-only audit of `axial-web/apps/web` at 793e0db by a subagent, with the app running on a production preview. Measurements used headless Chrome with software WebGL (SwiftShader): compare frame times with each other, not with real GPUs; draw-call, shader-program, WebGL-context and paint counts don't depend on the renderer. Artifacts (screenshots, scripts, Lighthouse reports) are in `/tmp/axial-opus-review/experience/` for this session only.

Decisions for every finding are in `plan.md`; shipped commits are listed in `tasks.md`.

| ID  | Sev      | Finding (evidence)                                                                                                                               |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | P1 phone | "Review match" leaves phones on an empty board with only Reset/Theme/Expand visible; one Reset tap deletes the match.                            |
| A2  | P2       | Reset clears an in-progress match in one tap with no confirm or undo.                                                                            |
| A3  | P2       | Renders at 60 fps forever once a piece exists (104 frames per 2 s idle vs 0 on an empty board).                                                  |
| A4  | P2       | Shader recompiles: first move 94 ms frame (7 → 10 programs), win 106 ms (10 → 14), next match 48 ms. Caused by point lights added and removed.   |
| A5  | P2       | 80 pieces: 352 draw calls, 329 geometries, 351 materials, 7.9 ms render CPU per frame.                                                           |
| A6  | P2       | Transmission costs ≈29% of frame time; on/off screenshots differ by a mean of 2.25/255 per pixel.                                                |
| A7  | P2       | Preview missing after drops until the pointer changes cell; preview in the AI's colour during its turn.                                          |
| A8  | P2       | Floor-plane picking: pointing at a layer-1 piece picked a neighbouring column, layer 2 another, layers 3–6 nothing.                              |
| A9  | P2       | 9 practice cycles created 19 WebGL contexts and "Too many active WebGL contexts" warnings.                                                       |
| A10 | P2       | 947 kB main chunk; with 4× CPU throttle, a 1,325 ms long task and LCP 2.43 s. Also the favicon 500 / unknown-path 500 and the late font preload. |
| A11 | P3       | Endless ShinyText sweep: 465 paints in 3 s on an idle empty board.                                                                               |
| A12 | P3       | Height numbers drawn over pieces in the board centre.                                                                                            |
| A13 | P3       | Desktop/tablet framing low; bottom labels clipped.                                                                                               |
| A14 | P3       | Lighthouse a11y 95: turn chip live region empty; several names don't contain visible text.                                                       |
| A15 | P3       | Mixed position vocabulary (X/Y/Z, H/R/C, row/column/layer).                                                                                      |
| A16 | P3       | Tour heading text content had two spaces before and after "Axial" (`This is··Axial··`).                                                          |
| A17 | P3       | Bottom bars touch the home indicator; landscape confirm bar covers ≈30% of the board; Restart board 32 px.                                       |
| A18 | P3       | 37 canvas textures created per 360° orbit.                                                                                                       |
| A19 | P3       | Arrow keys reversed after orbiting 180°.                                                                                                         |
| A20 | P3       | Any uncaught page error restarts the scene and resets the camera.                                                                                |
| A21 | P3       | Panel micro-labels ≈9.4 px on phones.                                                                                                            |
| A22 | P3       | Audio peaks ≈−21 dBFS; no sound when an intermediate line is scored.                                                                             |
| A-x | P3       | Turn chip says "wins" before the line is drawn.                                                                                                  |

Checked and good (per A): no GPU leaks across 8 matches (practice excepted); empty board renders nothing when idle; reduced motion respected; result modal focus and sizes; touch confirm-drop; keyboard play and focus rings; lazy QR encoder; AI only in its worker; no long tasks while orbiting; Lighthouse Best Practices and SEO 100.
