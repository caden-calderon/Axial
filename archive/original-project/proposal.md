# **Project Axial** Caden Calderon 

## **A Unified Project for CS462 (Game Design) & CS440 (Artificial Intelligence)**

### **The Big Idea: Bridging Worlds**

For my projects in each class, I want to go beyond a single course and build something that synthesizes the concepts in both Game Design and Artificial Intelligence. My goal is to create a complete, playable augmented reality experience from the ground up. This involves three core challenges that map directly to my coursework:

1. **The Hardware:** Building a custom, lightweight AR headset because why not. Turning a regular game into augmented space sounded cool.   
2. **The Game (CS462):** Designing and developing "Axial," a 3D strategic game controlled entirely by intuitive hand gestures.  
3. **The AI (CS440):** Engineering a challenging AI opponent that combines classic search algorithms with modern reinforcement learning.

This document outlines my plan to tackle these three integrated parts, creating one cohesive and ambitious final project that satisfies both classes project requirements. 

### **The AR Platform: Hardware and Integration** This portion of the project is focused on the entire user-facing experience: the hardware they wear, the world they see, and the game they play.

#### **The Custom AR Hardware**

A huge part of game design is the platform itself, and I want to start by getting my hands dirty. My plan is to build my own AR headset/glasses. This is something I’ve wanted to do for a while and I've had some of the parts I need but now I think I know how to piece them together. Researching thousands of parts it feels like at this point, I’ve been able to frankenstein together parts to hopefully give me my own working AR glasses.  Here is a picture for you:

Google glass inspired – those were really ahead of their time to be honest. Anyway, this is an older picture and I've actually decided to swap out some of the parts here in favor for others but the main things are as follows : 

**The Core Components:**

| Prism waveguide module | USB camera | Mini USB Hub Breakout Board  |
| :---- | :---- | :---- |
| Got this sucker off of some Chinese site, surprised it even came. Pretty cool, the cheapest waveguide I could afford, the only downside is I'm forced to use micro hdmi to use it. So with this set up it will be 2 cords coming off of the headset unfortunately. I do plan on getting the thinnest version of each cord and just wrapping them into one. I'm limited by my lack of EE skills and am forced to use pre-made parts.  | This is a small camera module that works like a standard webcam. It's a UVC (USB Video Class) device, which means it should be plug-and-play with some of the software I plan to use like opencv and mediapipes.  | This tiny board acts as the central connection point, converting a single USB-C input into multiple downstream ports. This allows the camera and 9dof imu to be hardwired, consolidating them into a single data stream. |
| ![Prism waveguide module][image1] | ![USB camera][image2] | ![Mini USB hub breakout board][image3] |

**System Architecture and Assembly**  
To maintain a lightweight and streamlined form factor, the components will be integrated without bulky connectors:

1. **De-soldering:** The standard USB ports on the camera module and 9dof imu board will be removed.  
2. **Hardwiring:** The data and power lines for each device will be soldered directly to the downstream ports on the USB hub breakout board.  
3. **Single Cable Connection:** The breakout board's USB-C port will serve as the single connection to the host computer, which will manage the data streams from the camera and IMU as two distinct devices.  
4. **Enclosure:** A custom, ergonomic 3D-printed enclosure will be designed to house all components and mount them onto a pair of glasses.

**Software Pipeline & Unity Integration**   
A significant technical task is creating a software pipeline to interface the custom hardware with the Unity game engine. The goal is to process the raw imu data for head tracking and the live camera feed for hand tracking, presenting them to Unity as a single, unified AR device controller.

**Contingency Plan**  
Building custom hardware is ambitious and carries inherent risks. If stable, low-latency performance cannot be achieved with the custom prototype, I will pivot to using a commercial headset available in the NUI Lab, such as the HoloLens. This ensures that the core development of the game and AI can proceed regardless of the hardware outcome.

#### **The Game: Axial**

Axial is a 3D, gravity-based strategy game, kind of like a futuristic, floating Connect 4\. It's designed to be minimalist and abstract, focusing purely on strategy and the novelty of the AR interaction.

I had AI generate some concept art to help better visualize the game: 

| ![AI-generated concept art of a floating 3D board][image4] | ![AI-generated concept art of a floating 3D board][image5] |
| :---- | :---- |

### **Gameplay and Rules** Players are presented with a luminous, holographic grid floating in their physical space. The game board's dimensions will be adjustable, with planned sizes like 4x4x4, 5x5x5, and maybe bigger to offer varying levels of difficulty and strategic depth.

**Objective:** Players take turns dropping their colored pieces into one of the grid's columns. The first player to align a set number of their pieces in a row—horizontally, vertically, or diagonally in any dimension—wins.

**Gravity Mechanic:** Pieces fall to the lowest available space in a selected column. This bottom-up building mechanic makes control of the lower levels critical for executing late-game strategies.

**Special Pieces:** To add another layer of strategy, players will have a limited number of special pieces they can use to disrupt their opponent's plans.

### **Gesture-Based Controls** The entire game is designed to be controller-free. Using the headset's camera feed and Google's MediaPipe library for real-time hand tracking, players will interact with the game through natural gestures. For example, a user might perform a pinch gesture to select a piece from a virtual menu, move their hand to the desired column, and release it to drop it. 

**The AI Opponent**  
The AI for Axial is where the concepts from CS440 are put into practice. The goal is to create a hybrid AI that demonstrates a sophisticated understanding of adversarial search, rational decision-making, and reinforcement learning.

### **A Hybrid Approach: The Planner and The Judge** The AI's intelligence is built on a two-part system that combines the strengths of classic and modern AI techniques to create a formidable opponent.

### **The Strategic Planner: Minimax** At its core, the AI will use the Minimax algorithm to handle its tactical, turn-by-turn thinking. This is a perfect application of the adversarial search concepts from class. Minimax will act as the AI's paranoid inner voice, exploring a tree of possible moves and counter-moves several steps into the future, assuming I'll always make the best possible move against it.

**The Expert Judge: Reinforcement Learning**  
The problem with Minimax is that it can't see the entire game. I don’t have the compute power for that. Its search has a limited depth, it also makes sure the AI also isn't taking its sweet time. To solve this, it needs an expert to evaluate the quality of the board positions at the end of its search. This is where the RL model comes in. I will train a neural network through a process of self-play, having it play millions of games of Axial against itself. Through this process, the model will learn the subtle patterns and develop an almost gut feeling for what constitutes a strong or weak position—an intuition far too complex to hard-code. This is kinda what google did in its alphaGO. 

### **Integrated Decision-Making** The Planner and the Judge are not separate AIs but a single, integrated system. When it is the AI's turn, the decision-making process is as follows:

1. The Minimax Planner explores a sequence of potential moves to its maximum search depth.  
2. For each potential outcome, it presents the resulting board state to the RL Judge.  
3. The RL Judge returns a single, authoritative score for that board state, quantifying its strategic value (e.g., "this position has a 75% probability of leading to a win").  
4. Minimax uses these scores to compare the different paths, ultimately selecting the move that leads to the most promising future state as validated by its expert Judge.

This hybrid approach creates a powerful evaluation function for a classic search algorithm, resulting in a truly intelligent and challenging opponent.

**Final thoughts:**  
To be frank this is how I see this working in my head, plans are subject to change as I progress. I may add alpha-beta bruning to the AI if searching becomes too grand for my compute and I may add some other features if given the time. Overall should be a cool comprehensive project and TA’s I have been given permission by both professors to combine both semester projects into one. 

**Project Axial** is a strategic board game that reimagines "Connect 4" as a complex, three-dimensional challenge played on a 6x6x7 grid with gravity mechanics.

It aims to achieve a complex and fun game to battle a high-level AI opponent. 

[image1]: images/prism-waveguide.png

[image2]: images/usb-camera.png

[image3]: images/usb-hub.png

[image4]: images/concept-art-1.png

[image5]: images/concept-art-2.png