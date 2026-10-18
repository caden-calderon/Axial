# LinkedIn article edit log

Exact article changes from the first pass after Caden requested before-and-after tracking. This log is separate from the article and is not publication copy.

## Revision 1: focused tracking section and no em dashes

Article length: 2170 words before; 2063 words after.

Before SHA-256: `28e671a56a39ac560d33e4d271cd59109001c534d826ba970a0ecb17e665cad7`

After SHA-256: `af21db9feab2bef5d599278aa7d85cf4adb1e512e9fdff90a7f906b5c3c12bc1`

All five article edits are listed below. The rest of the article, including both paper links, is unchanged. The quoted before text preserves original punctuation so the changes are auditable.

### 1. Simplify the remaining depth-tracking jargon

**Before**

But it reduced the unwanted coupling between gestures, orientation and depth enough to build a control scheme around a regular webcam.

**After**

But it made turning the hand and moving the fingers less likely to cause unwanted jumps in depth, which gave me a workable control scheme using a regular webcam.

**Reason:** Replaces “unwanted coupling” with the visible effect while preserving the qualification about imperfect depth sensing.

### 2. Condense smoothing and interaction details around the main problems

**Before**

I blended new tracking readings with recent ones to smooth out small fluctuations, then applied smoothing to the way a held piece followed the hand. Tiny movements inside a small “dead zone” were ignored. The aim was for deliberate movement to come through without passing every little shake on to the piece.

For a pinch, the fingers had to come close enough to begin a grab, then separate farther to release it. I also required the gesture to persist across consecutive frames. That gap between the grab and release thresholds is called hysteresis. It is similar to a thermostat using different temperatures to turn heating on and off: a tiny change near one threshold should not make the state constantly flip back and forth.

Visual feedback mattered alongside the tracking. Nearby objects highlighted to show what you could grab, and a ghost preview showed where a piece would land. Column snapping used its own hysteresis, keeping the selection on the current column until your hand moved far enough into the next one. That helped stop a piece flickering between two choices when you hovered near their boundary.

Together, these details helped the player see what was selected, where it would go, and what releasing their fingers would do.

**After**

I smoothed the tracking readings and the way a held piece followed the hand, filtering out small fluctuations while trying to keep intentional movement responsive. Losing detection was a separate problem: if the camera briefly lost the hand, an active grab could end. Smoothing could reduce jitter, but it could not supply a missing observation.

Making the controls usable meant balancing those limits. The piece needed to feel steady without feeling slow to respond. I go into the filtering, gesture detection and placement feedback in the original technical report.

**Reason:** Keeps the stability-versus-latency tradeoff and accurately describes detection loss. Removes dead-zone mechanics, threshold explanation, thermostat analogy, visual-feedback list and column hysteresis from the article. The preceding jitter paragraph remains unchanged.

### 3. Remove em dashes from the lookahead explanation

**Before**

Think of it as checking a specific sequence—“if I do this, they can respond with that”—alongside the broader evidence from simulated games.

**After**

Think of it as checking “if I do this, they can respond with that,” alongside the broader evidence from simulated games.

**Reason:** Removes the em dashes and a redundant phrase while keeping the example.

### 4. Make the simulation time limit more concrete

**Before**

With these longer matches, simulations can also stop at a move limit and judge the position reached, keeping each one from consuming too much of the thinking budget.

**After**

For these longer matches, a simulation can stop after a set number of moves and evaluate the position reached. That leaves time to explore other possibilities before choosing a move.

**Reason:** Explains what the limit accomplishes instead of relying on “thinking budget.”

### 5. Remove em dashes and simplify the Web Worker explanation

**Before**

The computation now runs in a Web Worker—a separate background task in the browser—so you can keep rotating and inspecting the board while the opponent thinks.

**After**

The computation now runs in a Web Worker, which handles the search separately from the browser interface. You can keep rotating and inspecting the board while the opponent thinks.

**Reason:** Splits the sentence and removes the em dashes. The following sentence connecting this to the Unity/Python separation remains unchanged.

## Verification notes

The tracking-loss sentence is supported by `DualHandManager` hiding undetected hands, `HandTracker3D.HideHand` disabling landmarks, `PinchDetector.Update` releasing an active pinch when its landmarks are unavailable, and `GrabController.OnPinchReleased` releasing the object. No missed-frame grace period or prediction behavior is claimed. No gameplay code, papers or media were changed.

## Revision 2: polish Caden’s ruler and MCTS edits

This revision starts from Caden’s latest edited file, including his other wording changes. Only the two selected paragraphs were modified.

Before SHA-256: `8825236ab32aef43adfd50b3c2ca2fe4d99cd48e0a1055563028d1e13c6cf52c`

After SHA-256: `bdb4ee4d941b80b824f7a51f47d3dd3da924b013f720a83dc16352dd1dc89f33`

### 1. Clarify the ruler and waving analogy

**Before**

Rotation introduced another problem. Imagine holding a ruler horizontally in front of a camera, then turning it upright without moving it farther away. If you measure only its left-to-right span, the horizontal distance, the ruler appears to shrink almost to nothing as its rotated vertically. The ruler has not become shorter; most of its length is now running vertically through the image. A measurement of palm width along just one image axis can fail for the same reason as a person rotates their hand like in a waving motion.

**After**

Rotation introduced another problem. Imagine holding a ruler horizontally in front of a camera, then turning it upright without moving it farther away. Its left-to-right span shrinks to almost nothing, even though the ruler itself has not become shorter. Its length now runs vertically through the image. The same thing can happen when you tilt your hand side to side in a wave, with your palm still facing the camera. A measurement that only watches horizontal palm width can mistake that rotation for a change in depth.

**Reason:** Preserves Caden’s waving example, clarifies that the palm stays facing the camera, and removes the repeated definition of horizontal distance.

### 2. Keep the MCTS joke while tightening the explanation

**Before**

On the original board, a player could have up to 42 columns to choose from on a turn. Every possible response branches into more responses, so trying to exhaustively evaluate the game quickly becomes impractical. I used Monte Carlo Tree Search, aka MCTS, aka the goat search algorithm, to spend a limited amount of computation exploring promising possibilities.

**After**

On the original board, a player could have up to 42 columns to choose from on a turn. Each move opens up possible replies, and each reply leads to more choices. The number of paths grows quickly. I used Monte Carlo Tree Search (MCTS), aka the GOAT of search algorithms, to focus the AI's limited thinking time on promising moves.

**Reason:** Keeps Caden’s playful GOAT line, removes the repeated “aka,” and makes the branching problem more concrete.

## Revision 3: approved final pass and readable papers

Caden approved the review suggestions except shortening the palm-depth explanation. That entire explanation, including both ruler passages and the limitations, remains unchanged. The chosen opening, GOAT aside and closing invitation are also preserved.

Before SHA-256: `bdb4ee4d941b80b824f7a51f47d3dd3da924b013f720a83dc16352dd1dc89f33`

After SHA-256: `78dd6fd8d7d0a5abe7f19f7d4bd74e4abd640bf6c61cf943bc0a04e7d60c8cbe`

### 1. Tighten the introduction and add an early play link

**Before**

I finished the original version a while ago and never really posted about it. Recently, I revisited it and decided to rebuild it for the browser so more people could play and try it. Going back through the project also reminded me how much work went into the original Unity version, especially the hand tracking and AI. That feels worth sharing along with what it has become today.

**After**

I finished the original version without ever really posting about it. Recently, I rebuilt it for the browser so more people could try it. Revisiting the project reminded me how much went into the original hand tracking and AI, and I wanted to share that story too.

You can play the browser version at [playaxial.dev](https://playaxial.dev).

**Reason:** Preserves the chosen opening while reducing repeated chronology and giving readers a way to try the game immediately.

### 2. State the winning condition explicitly

**Before**

The goal is to connect a line of your pieces, but those lines can travel across the board, vertically through a stack, or diagonally through the volume.

**After**

The goal is to connect four of your pieces in a straight line, across the board, vertically through a stack, or diagonally through the volume.

**Reason:** Makes the original rules clear even to someone unfamiliar with Connect Four.

### 3. Make the original board dimensions easier to picture

**Before**

The original board had 252 cells arranged in a 6 × 6 × 7 grid, with winning lines possible in 13 directions.

**After**

The original board had a 6 × 7 footprint, with each column holding up to six pieces. That meant 252 spaces, with winning lines possible in 13 directions.

**Reason:** Connects the physical arrangement to the 42 available columns discussed in the AI section; checked against the original board configuration.

### 4. Add a hand-controls section heading

**Before**

Using MediaPipe hand tracking, you could bring your hand near a piece,

**After**

## Building the hand controls

Using MediaPipe hand tracking, you could bring your hand near a piece,

**Reason:** Provides a navigation point without changing the detailed palm-depth explanation.

### 5. Condense smoothing and clarify the tracking-loss limitation

**Before**

Then there was the noise. Even a relatively still hand produces small frame-to-frame changes in tracked landmarks. If a held piece follows every change directly, it shakes. If you smooth everything too heavily, the interaction starts to feel delayed.

I smoothed the tracking readings and the way a held piece followed the hand, filtering out small fluctuations while trying to keep intentional movement responsive. Losing detection was a separate problem: if the camera briefly lost the hand, an active grab could end. Smoothing could reduce jitter, but it could not supply a missing observation.

Making the controls usable meant balancing those limits. The piece needed to feel steady without feeling slow to respond. I go into the filtering, gesture detection and placement feedback in the original technical report.

**After**

Even a relatively still hand produces small frame-to-frame changes in the tracked points. I blended new readings with recent ones and smoothed how a held piece followed the hand. The balance mattered: too little smoothing let the piece shake, while too much made it lag behind deliberate movement.

Brief tracking losses remained a separate limitation. If the tracker lost sight of the hand, it could release a held piece. That smoothing could reduce noisy movement, but it could not fill in a missing detection. I cover these limits and the interaction details in the original technical report.

**Reason:** Explains the mechanism in plain language and distinguishes filtering noisy observations from missing hand detections.

### 6. Add an original-AI section heading

**Before**

The other major part of the original project was the AI.

**After**

## Building the opponent

The other major part of the original project was the AI.

**Reason:** Gives readers a clear transition from the controls to the original Python opponent.

### 7. Explain the most-visited choice after the search-selection rule

**Before**

Technically, those possibilities form a tree, with each branch representing a move. The search follows a path through known positions, adds a new one, and plays out a simulated continuation, called a rollout. It then carries the outcome back through the positions that led there, updating their visit counts and results. After searching, the original engine chose the move it had visited most.

The search faces a familiar choice: spend more time on options that already look promising, or investigate ones it has barely tried. UCT is the rule I used to balance those choices, combining previous results with an exploration bonus. That helps keep the AI from settling too quickly on the first decent option it finds.

**After**

Technically, those possibilities form a tree, with each branch representing a move. The search follows a path through known positions, adds a new one, and plays out a simulated continuation, called a rollout. It then carries the outcome back through the positions that led there, updating their visit counts and results.

The search faces a familiar choice: spend more time on options that already look promising, or investigate ones it has barely tried. UCT is the rule I used to balance those choices, combining previous results with an exploration bonus. That helps keep the AI from settling too quickly on the first decent option it finds.

After searching, the original engine chose the move it had visited most. Because the search tends to return to promising moves, this favors sustained evidence over a good result from only a few trials.

**Reason:** Connects the final move choice to how MCTS allocates exploration, while retaining the existing technical explanation.

### 8. Add a browser-rebuild section heading

**Before**

Recently, I came back to Axial with a more practical goal: make it easier for someone else to try.

**After**

## Bringing Axial to the browser

Recently, I came back to Axial with a more practical goal: make it easier for someone else to try.

**Reason:** Marks the transition from the original project to the recent rebuild.

### 9. Clarify what alpha-beta adds to the browser AI

**Before**

Alongside simulations, the browser engine adds alpha-beta lookahead: a direct examination of selected moves and replies, within limits on depth and computation. Think of it as checking “if I do this, they can respond with that,” alongside the broader evidence from simulated games. The pruning part cuts short a branch once the search has enough information to rule it out of the current comparison.

**After**

The browser engine also adds alpha-beta lookahead. Alongside the evidence from simulated games, it compares selected sequences of moves while assuming the opponent will choose the strongest reply it examines. Think: “This move looks promising, but what is their best answer?” It searches within limits on depth and computation, and skips branches once they cannot change a decision in that search.

**Reason:** Explains the strongest-reply assumption and avoids presenting the additional search as merely another version of simulations.

### 10. Separate multi-line strategy from simulation cost

**Before**

The new rules also change what a good move means. In a three-line match, completing one line is progress toward a larger goal. The AI has to weigh that progress against what its opponent can do next. Even a useful piece can give the opponent the support they need to land a winning piece directly above it. For these longer matches, a simulation can stop after a set number of moves and evaluate the position reached. That leaves time to explore other possibilities before choosing a move.

**After**

Requiring multiple lines changes what the AI needs to value. In a three-line match, completing one line is progress rather than victory, so it has to weigh that progress against the opponent’s next opportunities. Gravity adds another trap: a useful piece can also provide the support an opponent needs to land a winning piece directly above it.

Longer matches also make full simulations more expensive. The browser engine can stop a simulation after a set number of moves and evaluate the unfinished position, leaving time to explore other possibilities.

**Reason:** Separates the changed match objective, the gravity trap, and the reason for capped simulations.

### 11. Add a short reflection connecting the two versions

**Before**

For anyone interested in the original implementation, I wrote two companion papers:

**After**

Across both versions, the challenge was making the technical work translate into something that felt good to play: hand controls that stayed steady without feeling sluggish, and an opponent that could think without freezing the game.

For anyone interested in the original implementation, I wrote two companion papers:

**Reason:** Connects the engineering choices to the experience of playing without inventing an anecdote or a new performance claim.

### 12. Link readable local PDFs and describe their provenance accurately

**Before**

- [**Axial: A 3D Strategy Game with Gesture-Based Hand Tracking Controls**](https://github.com/caden-calderon/Axial/blob/main/Reports/Game_Report.tex) covers the Unity game, the depth-estimation experiments, gesture detection, smoothing and interaction design.
- [**Monte Carlo Tree Search for 3D Connect Four: Tackling Combinatorial Explosion with Intelligent Sampling**](https://github.com/caden-calderon/Axial/blob/main/Reports/AI_Report.tex) covers the original Python opponent, search design, tactical heuristics, optimization and the evaluation I wrote up at the time.

The linked LaTeX sources document the original 2025 Unity/Python project. The browser rebuild came later.

**After**

- [**Axial: A 3D Strategy Game with Gesture-Based Hand Tracking Controls**](/home/caden/projects/Axial/output/pdf/Game_Report.pdf) covers the Unity game, the depth-estimation experiments, gesture detection, smoothing and interaction design.
- [**Monte Carlo Tree Search for 3D Connect Four: Tackling Combinatorial Explosion with Intelligent Sampling**](/home/caden/projects/Axial/output/pdf/AI_Report.pdf) covers the original Python opponent, search design, tactical heuristics, optimization and the evaluation I wrote up at the time.

These PDFs were compiled from the LaTeX sources for the original 2025 Unity/Python project. They document that version; the browser rebuild came later.

**Reason:** Uses readable PDFs in the local draft. These are new compilations of the checked-in sources, not the differing archived submission PDFs. Public PDF URLs still need to replace the local links before publication.

Every replacement was checked for a unique match. Reversing these replacements restores the exact incoming draft. The article contains no em dashes. PDF production and source formatting changes are documented separately in `pdf-build-notes.md`.

## Revision 4: select and organize the archived papers

Caden requested the better original versions in an easy-to-identify location. Only the paper links and their provenance sentence changed. The article body is otherwise unchanged.

Before SHA-256: `78dd6fd8d7d0a5abe7f19f7d4bd74e4abd640bf6c61cf943bc0a04e7d60c8cbe`

After SHA-256: `977d87ae1ed705ca884c3c3cedc797e804503c06f85a89cd592d3c6d1912760e`

**Before**

- [**Axial: A 3D Strategy Game with Gesture-Based Hand Tracking Controls**](/home/caden/projects/Axial/output/pdf/Game_Report.pdf) covers the Unity game, the depth-estimation experiments, gesture detection, smoothing and interaction design.
- [**Monte Carlo Tree Search for 3D Connect Four: Tackling Combinatorial Explosion with Intelligent Sampling**](/home/caden/projects/Axial/output/pdf/AI_Report.pdf) covers the original Python opponent, search design, tactical heuristics, optimization and the evaluation I wrote up at the time.

These PDFs were compiled from the LaTeX sources for the original 2025 Unity/Python project. They document that version; the browser rebuild came later.

**After**

- [**Axial: A 3D Strategy Game with Gesture-Based Hand Tracking Controls**](/home/caden/projects/Axial/output/pdf/axial-papers/01-Axial-Game-and-Hand-Tracking.pdf) covers the Unity game, the depth-estimation experiments, gesture detection, smoothing and interaction design.
- [**Monte Carlo Tree Search for 3D Connect Four: Tackling Combinatorial Explosion with Intelligent Sampling**](/home/caden/projects/Axial/output/pdf/axial-papers/02-Axial-AI-and-MCTS.pdf) covers the original Python opponent, search design, tactical heuristics, optimization and the evaluation I wrote up at the time.

These are the original reports from the 2025 Unity/Python project. They document that version; the browser rebuild came later.

**Reason:** Select the archived originals and link the clearly named copies in `output/pdf/axial-papers/`. The game original retains its colored diagrams and corrected direction count. The AI original is selected for archival fidelity, not verification of its differing win-rate result. The alternatives and exact differences are documented alongside the selected files. Public hosting is still pending.

## Revision 5: prepare public PDF links

Only the two paper link destinations changed. The article wording and report files are unchanged. These GitHub URLs will resolve after the prepared `docs/papers/` files are committed and pushed; they are not live at this local stage.

Before SHA-256: `977d87ae1ed705ca884c3c3cedc797e804503c06f85a89cd592d3c6d1912760e`

After SHA-256: `19f0e7beec7580ece3948bac8e8d3b63133f456dcc1061c8d344ef53aaa23e21`

### 1. Game and hand tracking report

**Before**

`/home/caden/projects/Axial/output/pdf/axial-papers/01-Axial-Game-and-Hand-Tracking.pdf`

**After**

`https://github.com/caden-calderon/Axial/blob/main/docs/papers/01-Axial-Game-and-Hand-Tracking.pdf`

### 2. AI and MCTS report

**Before**

`/home/caden/projects/Axial/output/pdf/axial-papers/02-Axial-AI-and-MCTS.pdf`

**After**

`https://github.com/caden-calderon/Axial/blob/main/docs/papers/02-Axial-AI-and-MCTS.pdf`

**Reason:** The LinkedIn article needs links readers can open after the repository update. `docs/papers/README.md` records the archived PDFs' provenance and unresolved differences.

## Revision 6: full editorial rewrite (October 14)

Caden asked for a full editorial pass ("your call") and then preferred the rewrite to the previous draft. Because this was a restructure rather than sentence-level edits, there is no per-sentence before/after here. The complete previous article is preserved in git at commit `793e0db` (`dev/active/axial-announcement-readiness/linkedin-article.md`).

Article length: 2123 words before; 1795 words after.

Before SHA-256: `19f0e7beec7580ece3948bac8e8d3b63133f456dcc1061c8d344ef53aaa23e21`

After SHA-256: `e63f250c58b03e608437414677d99feb9370e6a83708231ab01772a4feddf719`

What changed:

- **Hook first.** The opening now gets to Connect Four in 3D, played with bare hands through a webcam, within the first few paragraphs, and drops the meta paragraph about revisiting the project.
- **Voice.** Contractions and plainer phrasing throughout. Removed setup lines such as "Getting that to work involved a lot more than recognizing a pinch" and "The balance mattered:".
- **The failed attempts are back.** Added the report's eight measurement methods and the fist "teleport" failure (Game report, Table 3). Caden confirmed both are accurate.
- **Depth section kept whole.** The palm-only measurement, the ruler analogy, the three normalized measurements, the maximum and the edge-on card limitation all remain, with tighter wording.
- **Pinch hysteresis** returns as one plain sentence; the column-snapping hysteresis stays out.
- **AI section shortened.** MCTS is explained as "learning by playing out the future," with UCT named in a single parenthetical. Subtree reuse is kept as the notebook analogy.
- **Browser section has a reason.** It opens with why: the original needed the Unity game, the Python server and a webcam set up (confirmed by Caden). The three AI differences are now bold-labelled bullets.
- **Media placeholders** `[VIDEO]`, `[CLIP]` and `[IMAGE]` mark where visuals go.

## Revision 7: restore original title

Before SHA-256: `e63f250c58b03e608437414677d99feb9370e6a83708231ab01772a4feddf719`

After SHA-256: `74425fd20bba5220e9fc2da04184311b9bef4e5c9f0afab0bcf17b4bd0a6e46a`

**Before**

I Built 3D Connect Four You Play With Your Hands. Then I Rebuilt It for the Browser.

**After**

Axial: From a Hand-Controlled Unity Game to the Browser

**Reason:** Caden prefers the original title.

## Revision 8: figures and Unity clips

Caden asked for pictures and graphics to help explain the article. Only placement lines were inserted; no article prose changed. Each item below is a new line placed directly after the quoted sentence.

Before SHA-256: `74425fd20bba5220e9fc2da04184311b9bef4e5c9f0afab0bcf17b4bd0a6e46a`

After SHA-256: `3454fbb3f810558991ffabe3bbda402064a06516c5702cff40c4d76657f4f022`

| After the sentence | Inserted media |
| --- | --- |
| "Hold the board with one hand and drag with the other to spin it around." | `unity-grab-drop.mp4`, 16 s from Caden's original class demo (0:19–0:35), cropped to the game view, no audio |
| `## Reaching into a webcam` (replaces the `[CLIP: Unity hand-tracking gameplay]` placeholder) | `unity-rotate.mp4`, 10 s two-hand rotation (1:03–1:13) |
| "…picking up a piece was my job." | `landmarks.png`: 21 landmarks, with palm points highlighted |
| "…could send it flying away from you." | `fist.png`: open hand versus fist, with fingertip and palm measurements and the depth each one implies |
| "…instead of averaging the collapsed one in." | `rulers.png`: three hand angles; bar lengths come from `HandTracker3D.CalculateHandSize`'s formula and normalization ranges applied to an illustrative hand |
| "…instead of one lucky result." | `mcts.png`: a seeded 480-game UCT run over five moves with made-up win chances (labelled illustrative) |
| "Same idea as the separate Python process, just inside your browser." | `architecture.png`: Unity ⇄ Python versus page ⇄ Web Worker |

Media lives in `docs/media/article/`. The diagram sources are in `src/` and are re-rendered with `render.sh`. The MP4 clips and the source video in `axial-video/source/` are git-ignored. The remaining `[VIDEO: browser trailer]` and `[IMAGE: match settings]` placeholders wait on the code review and the new trailer.

## Revision 9: remove architecture figure

Before SHA-256: `3454fbb3f810558991ffabe3bbda402064a06516c5702cff40c4d76657f4f022`

After SHA-256: `8485cee4412062ed8db0e48503ff4857096bb3182f9b1f2e683cba14468db589`

**Before**

…Same idea as the separate Python process, just inside your browser.

![Unity and Python in the original, page and Web Worker in the browser](../../../docs/media/article/architecture.png)

**After**

…Same idea as the separate Python process, just inside your browser.

**Reason:** Caden decided the "Keep the thinking off the screen" figure isn't needed. Its image and source file were deleted; the other four figures and both clips stay.
