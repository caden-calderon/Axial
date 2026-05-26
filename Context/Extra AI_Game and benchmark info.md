# **Project Axial: Comprehensive Data & Context Compilation**

**Use this document as the primary source of truth for all technical specifications, benchmarks, and game design details.**

## **1\. Game Overview**

* **Title:** Axial  
* **Genre:** 3D Gravity-Based Strategy (3D Connect 4 Variant)  
* **Board Dimensions:** $6 \\times 6 \\times 7$ grid (252 total cells).  
* **Objective:** Connect 4 pieces in any direction (horizontal, vertical, diagonal, or 3D diagonal) within the 3D volume.  
* **Input Method:** Hand Tracking (User gestures drop pieces).  
* **Platform:** Desktop PC (originally scoped for AR).

## **2\. The Core Challenge: Combinatorial Explosion**

The primary technical hurdle was the sheer mathematical complexity of the board state, rendering traditional solvers impossible.

* **Comparison:**  
  * *Standard Connect 4 (*$7 \\times 6$*):* \~4.5 trillion states (Solved).  
  * *Axial (*$6 \\times 6 \\times 7$*):* $3^{252} \\approx 10^{120}$ states.  
* **Scale:** $10^{120}$ is approximately the number of atoms in the universe.  
* **Why Minimax Failed:**  
  * Minimax time complexity is $O(b^d)$.  
  * With a branching factor ($b$) of 42 and a required search depth ($d$) of 20+, the calculation ($42^{20}$) is computationally impossible.  
  * *Observation:* Even optimized 2D solvers struggle past depth 8-10.

## **3\. The Solution: Monte Carlo Tree Search (MCTS)**

Instead of an exhaustive search, the project uses MCTS, an "Anytime Algorithm" that samples the search space intelligently.

* **Core Logic:**  
  1. **Selection:** Pick a promising node using the UCT (Upper Confidence Bound for Trees) formula.  
  2. **Expansion:** Add a new child node to the tree.  
  3. **Simulation:** Play a random game from that point to a terminal state.  
  4. **Backpropagation:** Update statistics (wins/visits) back up the tree.  
* **Key Advantage:** The algorithm can be stopped at any time (after 100 or 10,000 simulations) and will always have a "best move" ready.

### **MCTS Enhancements**

To improve performance beyond basic random sampling, two specific enhancements were added:

1. **Tactical Threat Detection (Heuristic Layer):**  
   * Runs *before* the MCTS search.  
   * **Priority 1:** Instant Win (100% chance to take).  
   * **Priority 2:** Forced Block (100% chance to block opponent win).  
   * **Priority 3:** Fork Creation (70% chance to create a double-threat).  
   * *Reasoning:* Deterministic handling catches simple tactical moves that random simulations might miss.  
2. **RAVE (Rapid Action Value Estimation):**  
   * *Purpose:* Solves the "Cold Start" problem in the search tree.  
   * *Logic:* "If move X worked well in other parts of the tree, assume it is good here too until proven otherwise."  
   * *Formula:* Score \= $(1-\\beta) \\cdot UCT \+ \\beta \\cdot RAVE$.

## **4\. Technical Benchmarks & Optimization (The Numba Journey)**

To achieve real-time gameplay, the Python backend had to be optimized using **Numba JIT (Just-In-Time) compilation**. Pure Python was too slow for the required simulation volume.

### **Performance Data (Source: Project Presentation)**

| Operation | Pure Python Time | Numba JIT Time | Speedup Factor |
| :---- | :---- | :---- | :---- |
| **Win Check** | \~100 $\\mu$s | **\~0.8** $\\mu$**s** | **125x** |
| **Full Rollout** | \~9.6 ms | **\~0.4 ms** | **24x** |
| **Simulations/Sec** | \~25 sims/sec | **\~619 sims/sec** | **\~24x** |

* **Real-Time Impact:** The jump to \~619 simulations/second allows the AI to look deep enough into the game tree to be competitive without causing lag for the player.  
* **Data Structure:** Switched from a 3D NumPy array (slow) to a **1D Byte Array** accessed via flat indexing (idx \= h \+ r\*D \+ c\*D\*R) to enable Numba compatibility.

## **5\. Evaluation Results**

The AI was tested against baseline opponents to validate playing strength.

* **Hypothesis 1 (MCTS vs Random):**  
  * *Result:* **100% Win Rate** for MCTS.  
* **Hypothesis 2 (MCTS vs Greedy 1-Step Lookahead):**  
  * *Result:* **100% Win Rate** for MCTS.  
  * *Observation:* The Greedy AI consistently fell for "traps" (forks) that the MCTS predicted 3+ turns in advance.  
* **Hypothesis 3 (Enhanced vs Basic):**  
  * *Result:* Enhanced MCTS (with heuristics) dominated the Basic implementation.

## **6\. Architecture & Implementation Details**

* **Decoupled Architecture:**  
  * **"The Brain" (Python):** Handles high-performance logic, MCTS, and state management.  
  * **"The Body" (Unity):** Handles visualization, hand tracking, and user interaction.  
  * **Communication:** ZeroMQ (JSON) connects the two layers with \<2ms latency (imperceptible to humans).  
* **Inverse Kinematics (IK):** The Unity avatar (a stylized character) uses IK to physically reach for the column selected by the Python AI, creating a grounded sense of presence.

## **7\. Scope Pivot & Future Work**

* **Scope Adjustment:** The project transitioned from a fully AR headset experience to a **Desktop Application** due to time constraints and hardware limitations.  
* **Design Challenge:** Implementing **Hand Tracking** as the exclusive input method on Desktop (replacing mouse/keyboard) to maintain the "immersive" feel of the original AR concept.  
* **Future Goals:**  
  * Deploy to WebGL (browser-playable).  
  * Train a Neural Network (AlphaZero style) to replace the MCTS simulation phase for instant inference.  
  * Port to dedicated AR Hardware (e.g., Nicla Vision).