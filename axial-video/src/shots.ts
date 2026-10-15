// Editorial timings in seconds. Keep this aligned with web-trailer-script.md.
export const FPS = 30;

export const shots = [
  {
    id: "01",
    start: 0,
    end: 2,
    title: "A threat appears",
    picture:
      "Close three-quarter view. A piece lands, leaving one clear space to complete the line.",
    voice: "",
    sound: "Low synth bed. Foreground the first impact.",
  },
  {
    id: "02",
    start: 2,
    end: 4,
    title: "The first block",
    picture:
      "Opponent fills that space. Keep the line and blocking piece in the same frame.",
    voice: "",
    sound: "Second impact answers the first. A quiet pulse starts.",
  },
  {
    id: "03",
    start: 4,
    end: 6.5,
    title: "Two ways through",
    picture:
      "Widen slightly. The next piece creates two winning routes in the same match.",
    voice: "",
    sound: "Pulse builds. Let the piece settle.",
  },
  {
    id: "04",
    start: 6.5,
    end: 8.5,
    title: "One route closes",
    picture:
      "Opponent blocks the row. Begin a small orbit toward the surviving diagonal.",
    voice: "",
    sound: "Tension rises. Keep the movement restrained.",
  },
  {
    id: "05",
    start: 8.5,
    end: 10.5,
    title: "The winning drop",
    picture:
      "Frame the final destination and the three pieces it will connect. Hold through impact.",
    voice: "",
    sound: "Pull back the music before impact. Real landing and win sound.",
  },
  {
    id: "06",
    start: 10.5,
    end: 12.5,
    title: "Let the win register",
    picture:
      "Hold the actual line highlight. Settle into a clear angle before revealing the name.",
    voice: "",
    sound: "Tension resolves into a softer, wider chord.",
  },
  {
    id: "07",
    start: 12.5,
    end: 16,
    title: "AXIAL",
    picture:
      "Title over the resolved board. Preserve the game’s colors and atmosphere.",
    voice: "This is Axial.",
    sound: "Music opens up. Pause after the name.",
  },
  {
    id: "08",
    start: 16,
    end: 21,
    title: "Connect four. Think in 3D.",
    picture:
      "New match. Show a drop, board depth, and a raised stack or line involving height.",
    voice: "Connect four. In three dimensions.",
    sound: "Game sound remains audible beneath the voice.",
  },
  {
    id: "09",
    start: 21,
    end: 24,
    title: "Read both sides",
    picture:
      "Two clear views: a developing line and the opponent’s nearby pieces.",
    voice: "Look for a line. Watch for theirs.",
    sound: "Two purposeful cuts at most. First optional cut if pacing drags.",
  },
  {
    id: "10",
    start: 24,
    end: 29,
    title: "Connect five",
    picture:
      "Short settings insert, then a separate example match completing five pieces.",
    voice: "Then change the rules. Connect five.",
    sound: "Light interface tick; cut to the result on a pulse.",
  },
  {
    id: "11",
    start: 29,
    end: 33,
    title: "Choose your board",
    picture:
      "Board-size control, then a wider board. Hold the result longer than the menu.",
    voice: "Change the size of the board.",
    sound: "Keep a steady pulse and space around the narration.",
  },
  {
    id: "12",
    start: 33,
    end: 39,
    title: "Two lines. Or three.",
    picture:
      "Separate line-goal examples. Show actual completed lines and progress clearly.",
    voice: "Make it two lines to win. Or three.",
    sound: "Ease the pace so the rule difference can register.",
  },
  {
    id: "13",
    start: 39,
    end: 44,
    title: "Your move.",
    picture:
      "Quiet board to AXIAL end card. Keep playaxial.dev visible for at least three seconds.",
    voice: "Your move. Play Axial in your browser.",
    sound: "Pause after ‘Your move.’ Let the music decay through the end.",
  },
] as const;

export const DURATION_IN_FRAMES = shots[shots.length - 1].end * FPS;
