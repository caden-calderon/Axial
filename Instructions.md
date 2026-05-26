**I** need you to write two distinct technical reports for a single software project. If you have any questions along the way please ask and I will clarify for you. 

This is a joint project submitted for two different classes simultaneously:

1. **AI Class:** Focuses on the Monte Carlo Tree Search (MCTS), algorithms, optimizations, and decision logic, etc.  
2. **Game Design Class:** Focuses on the Gameplay, Hand Tracking controls, UX, and Graphics, etc.

**Rationale for Separation:** Even though this is one codebase, the reports must focus on different aspects while briefly contextualizing the other. Each report is just shifting focus:

* **In the AI Report:** The "Game" is just the **environment**. Focus on the MCTS algorithm, state management, heuristics, optimization, etc. Still mention the game and the hand tracking as they are relevant and connected but do not deep dive into this side of the code, that's for the other report and vise versa.   
  **In the Game Report:** The "AI" is just a **mechanic**. Focus on the User Experience (UX), the hand-tracking controls, game mechanics, etc. Again, I still talk about the AI, maybe a little how it works, etc, but it's not as detailed as in the AI report. 

I will first begin with you getting the proper context you need. You will go through everything from the project proposal to the code base. Do not write the full report yet; just absorb the information as I provide it. I will say when I want its time to write the report. 

Right now lets go from the beginning and get a high level overview before jumping into the code. Here I have provided my original project proposal (Slightly outdated as things changed but still relevant), a file with extra info and benchmark data. This file contains the **correct** benchmarks, board dimensions, and architectural details and is more up to date. I used this for my project presentation so you will see script talking lines. I have also provided the report overview, what needs to be included, etc for each. 

**Note for original project proposal:**  
**This is the original and obviously as development took place things changed from the original plans. Some of the most notable being :** 

* This was originally an AR project but is now a PC desktop application. This is not the only change you will notice from the original project proposal as you go through the code base such as minimax \-\> Monte carlo tree search, no Special Pieces, and board size being set at 6x6x7, etc, be aware of the discrepancies.   
* It is a single-player game vs. an AI.  
* **Control Scheme:** The user plays using hand-tracking gestures, not a mouse/keyboard.  
* **AI:** The opponent uses a Monte Carlo Tree Search (MCTS) algorithm with adjustable difficulty (based on simulation count).

Just kinda note these things to not get confused. 

Please read and understand everything in the “Context” folder. **Do not write the report yet.** This should provide a high level overview of what my project is and kinda how it works. It should set you up to fully understand the code and everything else in the next chat. Briefly report back everything you learned and any questions you may have that I can clarify. I want to make sure you know what you are doing before we jump into code and report writing. 

