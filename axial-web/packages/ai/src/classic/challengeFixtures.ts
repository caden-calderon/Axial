import {
  DEFAULT_BOARD_DIMENSIONS,
  type BoardDimensions,
  type Move,
} from "@axial/core";
import {
  CLASSIC_CHALLENGE_FORMAT_VERSION,
  type ClassicChallengePosition,
} from "./challenges";

const DEFAULT_DIMENSIONS = {
  ...DEFAULT_BOARD_DIMENSIONS,
} as const satisfies BoardDimensions;

const move = (row: number, col: number): Move => ({ row, col });

export const CLASSIC_CHALLENGE_FIXTURES = [
  {
    version: CLASSIC_CHALLENGE_FORMAT_VERSION,
    id: "connect4-immediate-win",
    description: "Take a legal terminal Connect-4 win before any search.",
    source: {
      kind: "synthetic",
      description: "Canonical immediate-win regression position.",
    },
    dimensions: DEFAULT_DIMENSIONS,
    winCondition: { lineLength: 4, linesToWin: 1 },
    startingPlayer: 1,
    moveHistory: [
      move(2, 0),
      move(0, 0),
      move(2, 1),
      move(0, 1),
      move(2, 2),
      move(0, 2),
    ],
    playerToMove: 1,
    expectation: {
      properties: ["wins-immediately"],
      allowedMoves: [move(2, 3)],
      notes: "The terminal win is mandatory and should spend no tree budget.",
    },
    tags: ["connect4", "one-line", "tactical", "ci"],
    observations: [],
  },
  {
    version: CLASSIC_CHALLENGE_FORMAT_VERSION,
    id: "connect4-immediate-block",
    description: "Block the opponent's only immediate terminal Connect-4 win.",
    source: {
      kind: "synthetic",
      description: "Canonical immediate-block regression position.",
    },
    dimensions: DEFAULT_DIMENSIONS,
    winCondition: { lineLength: 4, linesToWin: 1 },
    startingPlayer: 1,
    moveHistory: [
      move(5, 6),
      move(2, 0),
      move(5, 5),
      move(2, 1),
      move(0, 6),
      move(2, 2),
    ],
    playerToMove: 1,
    expectation: {
      properties: ["blocks-immediate-loss"],
      allowedMoves: [move(2, 3)],
      notes: "Any other move loses on the next ply.",
    },
    tags: ["connect4", "one-line", "defense", "ci"],
    observations: [],
  },
  {
    version: CLASSIC_CHALLENGE_FORMAT_VERSION,
    id: "connect4-height-one-support-trap",
    description:
      "Avoid supplying the gravity support that lets the opponent create a height-one fork.",
    source: {
      kind: "synthetic",
      description:
        "Legal replay replacement for the earlier hand-built inconsistent search-state fixture.",
    },
    dimensions: DEFAULT_DIMENSIONS,
    winCondition: { lineLength: 4, linesToWin: 1 },
    startingPlayer: 2,
    moveHistory: [
      move(5, 6),
      move(2, 2),
      move(2, 1),
      move(2, 2),
      move(2, 4),
      move(2, 5),
      move(5, 5),
      move(2, 4),
    ],
    playerToMove: 2,
    expectation: {
      properties: ["avoids-support-trap", "prevents-fork"],
      forbiddenMoves: [move(2, 3)],
      notes:
        "The center drop makes the opponent's currently unsupported fork cell playable.",
    },
    tags: ["connect4", "support", "fork", "gravity", "strategy"],
    observations: [],
  },
  {
    version: CLASSIC_CHALLENGE_FORMAT_VERSION,
    id: "connect4-max-second-opening-fork-race",
    description:
      "Avoid the reply that let Easy force two independent winning columns within three turns.",
    source: {
      kind: "synthetic",
      description:
        "Captured from the hybrid standard-rules Max-vs-Easy strength loss.",
    },
    dimensions: DEFAULT_DIMENSIONS,
    winCondition: { lineLength: 4, linesToWin: 1 },
    startingPlayer: 1,
    moveHistory: [move(2, 3)],
    playerToMove: 2,
    expectation: {
      properties: ["prevents-fork", "preserves-race-tempo"],
      forbiddenMoves: [move(1, 3)],
      notes:
        "The captured reply at row=1,col=3 was followed by row=3,col=2; row=1,col=4; row=1,col=2; row=2,col=3; row=2,col=2, leaving two immediate wins.",
    },
    tags: [
      "connect4",
      "one-line",
      "captured-loss",
      "fork",
      "opening",
      "critical",
    ],
    observations: [],
  },
  {
    version: CLASSIC_CHALLENGE_FORMAT_VERSION,
    id: "connect4-two-line-bank-distinct",
    description:
      "Bank a new maximal line instead of extending an existing run.",
    source: {
      kind: "synthetic",
      description: "Distinct-line accounting and productive banking fixture.",
    },
    dimensions: DEFAULT_DIMENSIONS,
    winCondition: { lineLength: 4, linesToWin: 2 },
    startingPlayer: 1,
    moveHistory: [
      move(2, 0),
      move(5, 6),
      move(2, 1),
      move(5, 5),
      move(2, 2),
      move(4, 6),
    ],
    playerToMove: 1,
    expectation: {
      properties: ["banks-distinct-line"],
      allowedMoves: [move(2, 3)],
      notes: "This is non-terminal progress toward a two-line objective.",
    },
    tags: ["connect4", "two-lines", "banking", "ci"],
    observations: [],
  },
  {
    version: CLASSIC_CHALLENGE_FORMAT_VERSION,
    id: "connect4-two-line-reject-completed-run-extension",
    description:
      "Complete a separate second line instead of extending an already banked maximal run.",
    source: {
      kind: "synthetic",
      description:
        "Replay-backed regression for maximal-run accounting and productive second-line selection.",
    },
    dimensions: DEFAULT_DIMENSIONS,
    winCondition: { lineLength: 4, linesToWin: 2 },
    startingPlayer: 1,
    moveHistory: [
      move(2, 0),
      move(5, 6),
      move(2, 1),
      move(5, 5),
      move(2, 2),
      move(4, 6),
      move(2, 3),
      move(5, 4),
      move(3, 0),
      move(4, 5),
      move(3, 1),
      move(0, 6),
      move(3, 2),
      move(1, 5),
    ],
    playerToMove: 1,
    expectation: {
      properties: ["banks-distinct-line", "avoids-completed-run-extension"],
      allowedMoves: [move(3, 3)],
      forbiddenMoves: [move(2, 4)],
      notes:
        "Row 2 is already one maximal completed run. Extending it does not create a second line; row=3,col=3 does.",
    },
    tags: ["connect4", "two-lines", "banking", "maximal-run", "strategy", "ci"],
    observations: [],
  },
  {
    version: CLASSIC_CHALLENGE_FORMAT_VERSION,
    id: "connect4-two-line-direct-denial",
    description: "Deny a directly bankable opponent line in a two-line race.",
    source: {
      kind: "synthetic",
      description: "Direct non-terminal line denial fixture.",
    },
    dimensions: DEFAULT_DIMENSIONS,
    winCondition: { lineLength: 4, linesToWin: 2 },
    startingPlayer: 1,
    moveHistory: [
      move(0, 6),
      move(2, 0),
      move(1, 6),
      move(2, 1),
      move(0, 5),
      move(2, 2),
    ],
    playerToMove: 1,
    expectation: {
      properties: ["denies-distinct-line", "preserves-race-tempo"],
      allowedMoves: [move(2, 3)],
      notes: "The denial is direct, but remains non-terminal for both sides.",
    },
    tags: ["connect4", "two-lines", "denial", "tempo", "ci"],
    observations: [],
  },
  {
    version: CLASSIC_CHALLENGE_FORMAT_VERSION,
    id: "connect4-two-line-max-second-captured-blunder",
    description:
      "Avoid the first strategically losing Max commitment in the captured two-line replay.",
    source: {
      kind: "synthetic",
      description:
        "Captured verbatim from the frozen two-lines-max-second strength loss; replace the source kind with caden-game when a human replay is supplied.",
    },
    dimensions: DEFAULT_DIMENSIONS,
    winCondition: { lineLength: 4, linesToWin: 2 },
    startingPlayer: 1,
    moveHistory: [
      move(4, 2),
      move(3, 3),
      move(2, 2),
      move(3, 2),
      move(3, 1),
      move(1, 3),
      move(3, 5),
    ],
    playerToMove: 2,
    expectation: {
      properties: ["prevents-fork", "preserves-race-tempo"],
      allowedMoves: [move(2, 3)],
      forbiddenMoves: [move(4, 1)],
      notes:
        "Frozen Max played row=4,col=1. Depth-3 common search scores that move at -2,207 and row=2,col=3 at +99,182. The later row=1,col=2 position is already a forced loss for every move and is retained only as forensic evidence.",
    },
    tags: [
      "connect4",
      "two-lines",
      "captured-loss",
      "fork",
      "tempo",
      "critical",
    ],
    observations: [],
  },
  {
    version: CLASSIC_CHALLENGE_FORMAT_VERSION,
    id: "connect5-open-four-fork-build",
    description:
      "Extend an open Connect-5 buildup into two independent next-turn winning endpoints.",
    source: {
      kind: "synthetic",
      description: "Connect-5 long-sequence and independent-threat fixture.",
    },
    dimensions: DEFAULT_DIMENSIONS,
    winCondition: { lineLength: 5, linesToWin: 1 },
    startingPlayer: 1,
    moveHistory: [
      move(2, 2),
      move(5, 6),
      move(2, 3),
      move(5, 5),
      move(2, 4),
      move(4, 6),
    ],
    playerToMove: 1,
    expectation: {
      properties: [
        "creates-fork",
        "creates-independent-threats",
        "builds-connect-five",
      ],
      allowedMoves: [move(2, 1), move(2, 5)],
      notes:
        "Either endpoint creates a four-piece run with two distinct playable winning continuations.",
    },
    tags: ["connect5", "one-line", "fork", "buildup", "strategy"],
    observations: [],
  },
  {
    version: CLASSIC_CHALLENGE_FORMAT_VERSION,
    id: "connect4-two-line-forced-fork-block-outranks-progress",
    description:
      "Neutralize the opponent's only fork even when banking a line has the larger heuristic score.",
    source: {
      kind: "synthetic",
      description:
        "Captured from the hybrid Max-vs-Easy strength loss; exposed a forced-candidate selection bug in scoredResult.",
    },
    dimensions: DEFAULT_DIMENSIONS,
    winCondition: { lineLength: 4, linesToWin: 2 },
    startingPlayer: 1,
    moveHistory: [
      move(3, 4),
      move(3, 4),
      move(2, 4),
      move(4, 4),
      move(2, 1),
      move(2, 4),
      move(1, 1),
      move(4, 4),
      move(3, 1),
      move(4, 1),
      move(1, 3),
      move(0, 1),
      move(2, 3),
      move(2, 2),
      move(1, 4),
    ],
    playerToMove: 2,
    expectation: {
      properties: ["prevents-fork", "preserves-race-tempo"],
      allowedMoves: [move(1, 2)],
      forbiddenMoves: [move(1, 4)],
      notes:
        "The fork block is mandatory. Banking at row=1,col=4 leaves two opponent terminal replies next turn.",
    },
    tags: [
      "connect4",
      "two-lines",
      "captured-loss",
      "fork",
      "tactical",
      "critical",
    ],
    observations: [],
  },
  {
    version: CLASSIC_CHALLENGE_FORMAT_VERSION,
    id: "connect4-three-line-direct-bank-guard",
    description:
      "Captured position where the current three-line guard bypasses all search for an individual line action.",
    source: {
      kind: "synthetic",
      description:
        "Promoted from the prior three-line regression; retained to test whether direct banking/denial belongs in search rather than an unconditional return.",
    },
    dimensions: DEFAULT_DIMENSIONS,
    winCondition: { lineLength: 4, linesToWin: 3 },
    startingPlayer: 1,
    moveHistory: [
      move(2, 3),
      move(2, 3),
      move(2, 3),
      move(2, 3),
      move(3, 3),
      move(3, 3),
      move(1, 3),
      move(4, 3),
      move(0, 3),
      move(1, 3),
      move(4, 3),
      move(0, 3),
      move(2, 2),
      move(2, 4),
      move(3, 1),
    ],
    playerToMove: 2,
    expectation: {
      properties: ["denies-distinct-line", "preserves-race-tempo"],
      notes:
        "The baseline returns row=0,col=4 with zero simulations. The overhaul must prove the move strategically; it may not pass only because all search was skipped.",
    },
    tags: ["connect4", "three-lines", "race", "guard-bypass", "strategy"],
    observations: [],
  },
  {
    version: CLASSIC_CHALLENGE_FORMAT_VERSION,
    id: "connect5-two-line-independent-race-build",
    description:
      "Create two independent Connect-5 banking threats in a two-line race.",
    source: {
      kind: "synthetic",
      description:
        "Cross-axis Connect-5 tempo fixture for the two-line objective.",
    },
    dimensions: DEFAULT_DIMENSIONS,
    winCondition: { lineLength: 5, linesToWin: 2 },
    startingPlayer: 1,
    moveHistory: [
      move(2, 0),
      move(5, 6),
      move(2, 1),
      move(4, 6),
      move(2, 3),
      move(5, 5),
      move(0, 2),
      move(4, 5),
      move(1, 2),
      move(5, 4),
      move(3, 2),
      move(4, 4),
    ],
    playerToMove: 1,
    expectation: {
      properties: [
        "creates-independent-threats",
        "builds-connect-five",
        "preserves-race-tempo",
      ],
      allowedMoves: [move(2, 2)],
      notes:
        "The intersection creates playable banking threats on different axes; blocking one does not erase the other.",
    },
    tags: ["connect5", "two-lines", "independent-threats", "tempo", "strategy"],
    observations: [],
  },
  {
    version: CLASSIC_CHALLENGE_FORMAT_VERSION,
    id: "connect5-three-line-independent-race-build",
    description:
      "Create two independent Connect-5 banking threats instead of extending one isolated run.",
    source: {
      kind: "synthetic",
      description:
        "Cross-axis Connect-5 tempo fixture for the three-line objective.",
    },
    dimensions: DEFAULT_DIMENSIONS,
    winCondition: { lineLength: 5, linesToWin: 3 },
    startingPlayer: 1,
    moveHistory: [
      move(2, 0),
      move(5, 6),
      move(2, 1),
      move(4, 6),
      move(2, 3),
      move(5, 5),
      move(0, 2),
      move(4, 5),
      move(1, 2),
      move(5, 4),
      move(3, 2),
      move(4, 4),
    ],
    playerToMove: 1,
    expectation: {
      properties: [
        "creates-independent-threats",
        "builds-connect-five",
        "preserves-race-tempo",
      ],
      allowedMoves: [move(2, 2)],
      notes:
        "The intersection creates playable row=2,col=4 and row=4,col=2 banking threats on different axes.",
    },
    tags: [
      "connect5",
      "three-lines",
      "independent-threats",
      "tempo",
      "strategy",
    ],
    observations: [],
  },
] as const satisfies readonly ClassicChallengePosition[];

export function classicChallengeById(
  id: string,
): ClassicChallengePosition | undefined {
  return CLASSIC_CHALLENGE_FIXTURES.find((fixture) => fixture.id === id);
}
