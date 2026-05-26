# Axial AI & RL Learning Guide

This guide is designed to take you from "Basic Python Script" to "Trained AI running in Unity".

---

## Part 1: The Architecture (The "What")

We are building a **Hybrid AI**, similar to the architecture used in AlphaGo Zero, but simplified.

### The Concept: Planner & Judge

Imagine a Chess Grandmaster.

1.  **The Planner (Search):** They look ahead. "If I move here, he moves there..." (Minimax / MCTS).
2.  **The Judge (Evaluation):** They look at a board and instantly know "White is winning." (Neural Network).

**Your Goal:**

- Write the **Planner** (Minimax or MCTS) to look ahead.
- Train the **Judge** (Neural Network) to give accurate scores for the leaf nodes.

---

## Part 2: The Tools (The "How")

### Q1: Which Library? (TensorFlow vs. PyTorch)

**Recommendation: PyTorch**

- **Why?** It is more "Pythonic", easier to debug, and the standard for research projects like this.
- **Usage:** We will use it to build a simple Feed-Forward Network (or a small CNN) that takes the 3D Board as input and outputs a Score (-1 to +1).

### Q2: Unity Integration?

**The Plugin: Unity Sentis (formerly Barracuda)**

- **Workflow:**
  1.  Train model in Python (PyTorch).
  2.  Export model to **.ONNX** format (Open Neural Network Exchange).
  3.  Import `.onnx` file into Unity.
  4.  Use **Unity Sentis** to run the model inside your C# game.
- **Note:** Yes, you will need to rewrite the `game` class (logic) in C# so Unity knows the rules.

---

## Part 3: The Curriculum (The Lessons)

### Lesson 1: The Planner (Minimax vs MCTS)

**Goal:** Understand how computers "think" ahead.

#### Option A: Minimax (The Classic)

- **Pros:** Simple to implement, guarantees optimal play if depth is sufficient.
- **Cons:** Brittle if depth is low. Struggles with high branching factors (like 3D Connect 4).
- **Optimization:** Alpha-Beta Pruning is mandatory.

#### Option B: Monte Carlo Tree Search (MCTS) (The Modern Standard)

- **Pros:** Handles high branching factors beautifully. "Anytime" algorithm (stop it whenever you want and get a result). This is what AlphaZero uses.
- **Cons:** Slightly more complex to implement.
- **Verdict:** For Axial (3D Connect 4), **MCTS is likely better**.

### Lesson 2: The Judge (Neural Networks)

**Goal:** Build a brain that "sees" the board.

- **Concept:** A function $f(board) = score$.
- **Input:** Your 4x4x4 board (flattened or as a 3D tensor).
- **Output:** A single float between -1 (Player 2 wins) and 1 (Player 1 wins).
- **Assignment:** Create a simple `Net` class in PyTorch.

### Lesson 3: The Training Loop (Self-Play)

**Goal:** Make the AI teach itself.

- **Concept:**
  1.  AI plays against itself (Copy A vs Copy B).
  2.  Planner uses the _current_ Judge to make moves.
  3.  Game ends (e.g., Player 1 wins).
  4.  **Data:** Save every board state from that game with the result (Winner = 1).
  5.  **Train:** Teach the Judge: "When you see this board, say 1".
- **Assignment:** Write the `train()` loop in Python.

### Lesson 4: Deployment (Unity)

**Goal:** Move the brain to the game.

- **Concept:** ONNX Export.
- **Assignment:**
  1.  `torch.onnx.export(model, ...)`
  2.  Drag into Unity.
  3.  Write C# script to feed Board -> Model -> Move.

---

## Checklist: What you need to know

By the end of this, you should be able to answer:

1.  [ ] Why do we need Alpha-Beta pruning?
2.  [ ] How do we turn a 4x4x4 numpy array into a Tensor?
3.  [ ] What is a "Loss Function" and which one do we use for winning/losing? (Hint: MSE or CrossEntropy).
4.  [ ] How does the AI play against itself without getting stuck in a loop? (Hint: Randomness/Temperature).

---

# Professor's Notes: Detailed Coursework

## Module 1: Game Theory & Optimization

### Minimax vs. MCTS

You asked if MCTS is better. **Yes.**

- **Minimax** tries to solve the tree. It says "I must check every branch to depth 4."
- **MCTS** explores the tree. It says "This branch looks promising, I'll spend 80% of my time here, and 20% checking the others just in case."
- **Why for Axial?** In 3D, you have 16 columns. Depth 4 = $16^4 = 65,536$ nodes. Depth 6 = $16^6 = 16,000,000$ nodes. Minimax chokes fast. MCTS focuses its energy on the good moves, allowing it to go "deeper" in the relevant paths.

### The Bleeding Edge: Python 3.13 (No-GIL) & Bitboards

You are absolutely correct. Python 3.13's free-threaded build is a game changer for CPU-bound tasks like this.

1.  **No-GIL Multithreading:**

    - **Old Python:** Threads were fake (only one ran at a time). You had to use `multiprocessing` (heavy memory overhead).
    - **Python 3.13:** You can spawn 16 threads on a 16-core CPU and they all run MCTS simulations in parallel on the _same_ memory.
    - **Impact:** Massive speedup for MCTS, which relies on running thousands of simulations.

2.  **Bitboards:**
    - **Concept:** Represent the 4x4x4 board (64 cells) as a single 64-bit integer (`uint64`).
    - **Speed:** Checking a win becomes a few bitwise operations (`&`, `>>`) instead of a loop. This is ~100x faster than Numpy.
    - **Synergy:** **No-GIL + Bitboards = C++ speeds in Python.** If you implement this, you can train a model that rivals professional engines.

### Implementation Difficulty: MCTS

Is MCTS harder? **Not really.**

- **Minimax:** Recursive function. Hard part is tuning Alpha-Beta and Move Ordering.
- **MCTS:** A Class with 4 steps:
  1.  **Selection:** Walk down the tree to a leaf.
  2.  **Expansion:** Add a new child node.
  3.  **Simulation:** Play random moves until game over (or use Neural Net).
  4.  **Backpropagation:** Update the scores up the tree.
- **Verdict:** It's more code (maybe 100 lines vs 20 lines), but it's robust. It doesn't need "tuning" like Minimax does.

---

## Module 2: Neural Networks (The Judge)

### The Input: Seeing the Board

A Neural Network (NN) is just a math function. It needs numbers as input.
Your board is a $4 \times 4 \times 4$ grid.

- **Raw Input:** A 3D array of integers (0, 1, 2).
- **Tensor Representation:** NNs prefer "One-Hot Encoding" or separated channels to understand players.
  - Channel 0: My pieces (1 where I have a piece, 0 else).
  - Channel 1: Opponent pieces (1 where they have a piece, 0 else).
  - Channel 2: Empty spaces (Optional, or implied).
  - **Final Shape:** $(2, 4, 4, 4)$ -> 2 Channels, Depth 4, Row 4, Col 4.

### The Architecture: CNN (Convolutional Neural Network)

Since this is a 3D spatial game (like 3D Chess), a **3D CNN** is best.

- **Conv3d Layer:** Scans small $3 \times 3 \times 3$ cubes of the board to find patterns (lines, blocks).
- **Linear Layer (Dense):** Takes those patterns and combines them into a final thought.
- **Output:** A single number (Tanh activation: -1 to 1).

### The Loss Function: How it Learns

We train by showing the AI examples:

- **Input:** A board state from a past game.
- **Target:** Who actually won that game? (1.0 or -1.0).
- **Loss (MSE):** $(Prediction - Target)^2$.
  - If AI guessed 0.2 but Player 1 won (1.0), error is $(0.2 - 1.0)^2 = 0.64$.
  - Backpropagation adjusts the weights to minimize this error.

---

## Module 3: Reinforcement Learning (Self-Play)

### The Loop

This is where the magic happens. We don't have a dataset of "Pro Axial Games". We have to make one.

1.  **Initialization:** Create a random, dumb AI.
2.  **Data Collection (The Arena):**
    - AI plays against itself for 100 games.
    - It uses MCTS/Minimax to look ahead, using its current (dumb) brain to judge leaf nodes.
    - **Crucial:** Even a dumb brain + Search is slightly smarter than just a dumb brain.
    - Save all board positions and the final winner.
3.  **Training (The Classroom):**
    - Take those 100 games of data.
    - Train the Neural Network on them.
    - "When you saw this board, Player 1 eventually won. So next time, rate this board higher."
4.  **Iteration:**
    - The AI is now slightly smarter.
    - Repeat Step 2. The games will be higher quality.
    - Repeat Step 3. The brain gets smarter.
    - Loop forever (or until satisfied).
