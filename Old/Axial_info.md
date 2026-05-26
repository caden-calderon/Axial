# Project Context: Axial (AI & Game Logic)

## 1. Project Overview

**Project Name:** Axial
**Type:** 3D Augmented Reality Strategy Game
[cite_start]**Academic Context:** A unified project for Game Design (CS462) and Artificial Intelligence (CS440)[cite: 2].
[cite_start]**Core Concept:** A futuristic, gravity-based strategy game (similar to a 3D "Connect 4") played in an augmented reality space[cite: 39].

## 2. Current Development Phase: Python AI Training

**Status:** We are currently in the **Backend/Logic Phase**.
[cite_start]**Immediate Goal:** Develop the core game logic in Python to facilitate "Self-Play" training for a Reinforcement Learning (RL) model[cite: 68].
[cite_start]**Note:** While the final product will be in Unity with custom AR hardware[cite: 7, 33], the current focus is strictly on the **Python environment** and **AI architecture**.

---

## 3. The Game Rules (The Environment)

The game logic must model the following rules strictly:

### The Board

- **Structure:** A 3D Grid.
- [cite_start]**Dimensions:** Variable, but standard training sizes are $4\times4\times4$ or $5\times5\times5$[cite: 46].
- [cite_start]**Visualization:** Conceptually, this is a luminous holographic grid floating in space[cite: 45].

### The Mechanics

- **Turn-Based:** Two players (Human vs. AI) take turns.
- **Gravity Rule:** Players do not place pieces in specific cells. Instead, they select a **Column**. [cite_start]The piece "falls" to the lowest available empty space in that column[cite: 49].
  - _Constraint:_ If a column is full (vertical height reached), no piece can be placed there.
  - [cite_start]_Strategy:_ Controlling the bottom layers is required to access upper layers[cite: 50].
- [cite_start]**Special Pieces:** The game allows for a limited number of "special pieces" used to disrupt the opponent[cite: 51]. (Implement as a toggleable feature/variable).

### Win Condition

- [cite_start]**Objective:** Align a set number of pieces (e.g., 4) in a contiguous row[cite: 48].
- **Vectors:** Winning lines can be formed:
  - Horizontally (X-axis or Z-axis)
  - Vertically (Y-axis)
  - Diagonally (across planes or through the 3D cube volume).

---

## 4. The AI Architecture (The Agent)

[cite_start]The AI opponent uses a hybrid "Planner and Judge" architecture[cite: 58].

### Part A: The Planner (Search)

- [cite_start]**Algorithm:** Minimax (Adversarial Search)[cite: 61].
- **Function:** Explores the tree of possible moves and counter-moves to a specific depth.
- [cite_start]**Optimization:** Will likely require Alpha-Beta pruning to manage search space[cite: 81].

### Part B: The Judge (Evaluation)

- [cite_start]**Algorithm:** Reinforcement Learning (Neural Network)[cite: 64].
- **Role:** Acts as the evaluation function for the Minimax leaf nodes.
- **Input:** The board state at the end of the Minimax search depth.
- [cite_start]**Output:** A probability score (strategic value) indicating the likelihood of winning from that position[cite: 76].
- **Training Method:** Self-Play. [cite_start]The AI plays millions of games against itself to learn patterns and intuition[cite: 68].

### [cite_start]The Integrated Flow [cite: 73, 74, 75, 76, 77]

1.  **AI's Turn:** Minimax generates potential move paths.
2.  **Evaluation:** For each resulting board state (leaf node), the board is passed to the **RL Judge**.
3.  **Scoring:** The RL Judge returns a score (e.g., "0.8 Win Probability").
4.  **Decision:** Minimax selects the move leading to the highest-scored future state.

---

## 5. Technical Requirements (Python)

To support this architecture, the code requires:

1.  **Efficient State Representation:**
    - Use `numpy` (or bitboards if performance demands) to represent the 3D grid.
    - Fast validation logic for checking "Four-in-a-row" across 3D diagonals.
2.  **Modular Game Loop:**
    - A class structure that handles state updates, legal move generation (checking non-full columns), and turn switching.
3.  **RL Interface:**
    - A PyTorch/TensorFlow (or similar) definition for the Neural Network.
    - A pipeline to feed the Board State -> Neural Net -> Scalar Score.
4.  **Data Generation:**
    - A loop to run automated games (Self-Play) and store `(State, Action, Reward)` tuples for training.

## 6. Future Roadmap (Context)

- Eventually, this logic needs to communicate with **Unity**.
- [cite_start]Inputs will come from **MediaPipe** hand tracking (identifying a pinch gesture and column selection)[cite: 53, 54].
- Keep the core logic decoupled from the rendering engine to allow for easy export (e.g., ONNX model export) later.
