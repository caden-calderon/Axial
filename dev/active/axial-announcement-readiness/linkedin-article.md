# Axial: From a Hand-Controlled Unity Game to the Browser

Hey, it's been a while, but I thought I'd hop back on here and share a fun project I was working on a little while back.

This is Axial.

I finished the original version without ever really posting about it. Recently, I rebuilt it for the browser so more people could try it. Revisiting the project reminded me how much went into the original hand tracking and AI, and I wanted to share that story too.

You can play the browser version at [playaxial.dev](https://playaxial.dev).

Axial started as a random idea: Connect 4 in three dimensions.

You take turns dropping pieces into a board, where gravity pulls them down to the lowest available space. The goal is to connect four of your pieces in a straight line, across the board, vertically through a stack, or diagonally through the volume. Rotate the board and a position that looked harmless can suddenly reveal a threat you completely missed.

The original board had a 6 × 7 footprint, with each column holding up to six pieces. That meant 252 spaces, with winning lines possible in 13 directions. That gave me a spatial game to build an interface around, and a much larger search problem for the AI.

I built that first version in Unity and C#, with a Python program running the opponent. For the controls, I experimented with playing entirely through hand gestures captured by a regular webcam.

## Building the hand controls

Using MediaPipe hand tracking, you could bring your hand near a piece, pinch your thumb and index finger to grab it, move it over the board, and release to drop it. You could also hold the board with one hand and pinch and drag with the other to rotate it. The interaction was meant to make the board feel like something you could reach into and manipulate.

Getting that to work involved a lot more than recognizing a pinch.

[MediaPipe](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/python) gave me 21 tracked points on each hand, including the wrist, knuckles and fingertips. You can picture them as a moving skeleton laid over the webcam image. My job was to turn those points into controls for reaching into the board, picking something up and putting it where you intended.

One of the hardest parts was depth. Moving left and right in the camera image is straightforward to map onto a screen. Moving toward and away from the camera is trickier. MediaPipe's image landmarks include depth relative to the wrist, but that is different from knowing where to place the whole hand in the game.

I used apparent hand size as a rough depth signal: a hand generally looks larger when it is closer to the camera and smaller when it is farther away. But the hand can also look smaller without moving away at all.

Curl your fingers and the distance from your wrist to a fingertip shrinks. Close an open hand into a fist and its outline takes up less space in the image. Early measurements confused those changes with movement in depth. The gesture meant to grab a piece could also make it jump away from you.

The first part of the solution was to measure the palm using wrist and knuckle landmarks. Those points change much less when you bend your fingers. That separated the measurement used for depth from the fingers used to grab and release.

Rotation introduced another problem. Imagine holding a ruler horizontally in front of a camera, then turning it upright without moving it farther away. Its left-to-right span shrinks to almost nothing, even though the ruler itself has not become shorter. Its length now runs vertically through the image. The same thing can happen when you tilt your hand side to side in a wave, with your palm still facing the camera. A measurement that only watches horizontal palm width can mistake that rotation for a change in depth.

My solution, PalmMaxDimension, combined three measurements: the horizontal span between the index and little-finger knuckles, the vertical span between those same points, and the distance from the wrist to the middle-finger knuckle.

Each measurement had its own expected size range. I converted them onto a common 0-to-1 scale, so a naturally longer measurement would not automatically dominate, then took the largest of those normalized readings as the depth signal.

You can think of it as giving the system several rulers to work with. If one reading collapses as the hand turns, another can still provide a useful sense of its size. Taking the maximum lets that reading carry the estimate instead of averaging the collapsed measurement into it. Using the palm also keeps finger curls from changing the estimate as much.

This did not make the hand a perfect depth sensor. Turning your hand edge-on can still hide dimensions, just as a card looks thinner when viewed from the side. Hand size and calibration still matter, too. But it made turning the hand and moving the fingers less likely to cause unwanted jumps in depth, which gave me a workable control scheme using a regular webcam.

Even a relatively still hand produces small frame-to-frame changes in the tracked points. I blended new readings with recent ones and smoothed how a held piece followed the hand. The balance mattered: too little smoothing let the piece shake, while too much made it lag behind deliberate movement.

Brief tracking losses remained a separate limitation. If the tracker lost sight of the hand, it could release a held piece. That smoothing could reduce noisy movement, but it could not fill in a missing detection. I cover these limits and the interaction details in the original technical report.

## Building the opponent

The other major part of the original project was the AI.

On the original board, a player could have up to 42 columns to choose from on a turn. Each move opens up possible replies, and each reply leads to more choices. The number of paths grows quickly. I used Monte Carlo Tree Search (MCTS), aka the GOAT of search algorithms, to focus the AI's limited thinking time on promising moves.

You can think of MCTS as giving the AI a scratch board. It tries possible continuations of the match, keeps track of how they turn out, and uses that experience to decide which options deserve a closer look.

Technically, those possibilities form a tree, with each branch representing a move. The search follows a path through known positions, adds a new one, and plays out a simulated continuation, called a rollout. It then carries the outcome back through the positions that led there, updating their visit counts and results.

The search faces a familiar choice: spend more time on options that already look promising, or investigate ones it has barely tried. UCT is the rule I used to balance those choices, combining previous results with an exploration bonus. That helps keep the AI from settling too quickly on the first decent option it finds.

After searching, the original engine chose the move it had visited most. Because the search tends to return to promising moves, this favors sustained evidence over a good result from only a few trials.

The simulated games also needed some tactical awareness. For example, if the opponent can win on the next turn, a simulated game that ignores the necessary block is not a useful model of careful play. Completely random rollouts can miss these situations and give misleading evidence about a position. I added checks for wins and threats before the main search, prioritized promising moves during expansion, and used guided rollouts that looked for wins, blocks and developing threats.

Making all of those simulations practical was another piece of the work. A single move or win check is small, but the search repeats those operations throughout many imagined games. Their cost adds up quickly.

I represented the 3D board as a numbered strip of cells in a NumPy array, with each vertical column stored together. Each cell needed just one byte to identify whether it was empty or occupied by either player. Numba compiled the repeatedly used board operations and simulations into machine code, letting those busy loops run without interpreting each step as Python.

I also kept useful search work between turns. If the move actually played was one the AI had already explored, I could keep that branch and its statistics as the starting point for the next search. This is subtree reuse: keeping the notes for the position you reached instead of throwing away the whole notebook after every move. If that position had not been explored, the search started fresh.

Unity handled the scene and hand interaction while the Python process handled the AI and game-state validation. The two exchanged moves over a local TCP connection. Keeping that computation separate allowed the interface to continue updating while the opponent searched.

## Bringing Axial to the browser

Recently, I came back to Axial with a more practical goal: make it easier for someone else to try.

The result is a browser rebuild using SvelteKit, TypeScript, Three.js and Threlte. You can open a link and play. This version uses mouse and touch controls; the webcam gesture interface belongs to the original Unity game.

The browser version gives you more ways to play. You can switch from connect four to connect five, change the board size, or require two or three completed lines to win. With multiple lines required, making your first connection does not end the match. You keep building on the same board, trying to create the next line while defending against your opponent. Extending an already completed line still counts as that same line; you need to form another distinct one.

The AI carries forward the original idea of MCTS with tactical checks, rebuilt in TypeScript. The most meaningful changes are how it looks ahead and how it understands those expanded rules.

The browser engine also adds alpha-beta lookahead. Alongside the evidence from simulated games, it compares selected sequences of moves while assuming the opponent will choose the strongest reply it examines. Think: “This move looks promising, but what is their best answer?” It searches within limits on depth and computation, and skips branches once they cannot change a decision in that search.

Requiring multiple lines changes what the AI needs to value. In a three-line match, completing one line is progress rather than victory, so it has to weigh that progress against the opponent’s next opportunities. Gravity adds another trap: a useful piece can also provide the support an opponent needs to land a winning piece directly above it.

Longer matches also make full simulations more expensive. The browser engine can stop a simulation after a set number of moves and evaluate the unfinished position, leaving time to explore other possibilities.

The computation now runs in a Web Worker, which handles the search separately from the browser interface. You can keep rotating and inspecting the board while the opponent thinks. It brings the same separation I needed in the original Unity/Python version into an experience someone can try through a link.

You can play against the AI, take turns with someone on the same device, or invite a friend to a private online game. Looking back at the original report, browser play and online multiplayer were both listed as future work. It is satisfying to return to the project and see those ideas become part of it.

Across both versions, the challenge was making the technical work translate into something that felt good to play: hand controls that stayed steady without feeling sluggish, and an opponent that could think without freezing the game.

For anyone interested in the original implementation, I wrote two companion papers:

- [**Axial: A 3D Strategy Game with Gesture-Based Hand Tracking Controls**](https://github.com/caden-calderon/Axial/blob/main/docs/papers/01-Axial-Game-and-Hand-Tracking.pdf) covers the Unity game, the depth-estimation experiments, gesture detection, smoothing and interaction design.
- [**Monte Carlo Tree Search for 3D Connect Four: Tackling Combinatorial Explosion with Intelligent Sampling**](https://github.com/caden-calderon/Axial/blob/main/docs/papers/02-Axial-AI-and-MCTS.pdf) covers the original Python opponent, search design, tactical heuristics, optimization and the evaluation I wrote up at the time.

These are the original reports from the 2025 Unity/Python project. They document that version; the browser rebuild came later.

You can try the current game at [playaxial.dev](https://playaxial.dev), and explore the code on [GitHub](https://github.com/caden-calderon/Axial).

I'd love to hear what you think, whether you try a match or take a look at the technical side. I've got lots of other projects and cool things I've been working on that I'll be sharing soon, too.

Feel free to connect with me here, or follow me on X/Twitter at [@caden_calderon](https://x.com/caden_calderon). I post over there too, and I'm looking to grow my connections with people building interesting things.
