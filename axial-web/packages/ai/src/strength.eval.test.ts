import { describe, expect, it } from "vitest";
import {
  applyMove,
  createGame,
  type Move,
  type Player,
  type WinCondition,
} from "@axial/core";
import {
  analyzeMctsMove,
  classicAiSearchOptionsForGame,
  type ClassicAiDifficulty,
  type MctsStopReason,
} from "./index";

type MatchSummary = {
  label: string;
  workMode: "preset-wall-clock" | "deterministic-controlled";
  playerOne: ClassicAiDifficulty;
  playerTwo: ClassicAiDifficulty;
  winner: Player | 0;
  moves: number;
  simulations: number;
  maxDepth: number;
  terminal: boolean;
  moveHistory: Move[];
  stopReasons: Record<MctsStopReason, number>;
};

const strengthEvaluationEnabled = process.env.AXIAL_AI_STRENGTH_EVAL === "1";
const strengthOpponent: ClassicAiDifficulty =
  process.env.AXIAL_AI_STRENGTH_OPPONENT === "hard" ? "hard" : "easy";

describe.skipIf(!strengthEvaluationEnabled)(
  "Classic AI strength evaluation",
  () => {
    it("makes Max beat the selected opponent from both seats under standard and two-line rules", () => {
      const matches = [
        playDifficultyMatch({
          label: "standard-max-second",
          winCondition: { lineLength: 4, linesToWin: 1 },
          playerOne: strengthOpponent,
          playerTwo: "nightmare",
          seed: 11,
        }),
        playDifficultyMatch({
          label: "standard-max-first",
          winCondition: { lineLength: 4, linesToWin: 1 },
          playerOne: "nightmare",
          playerTwo: strengthOpponent,
          seed: 12,
        }),
        playDifficultyMatch({
          label: "two-lines-max-second",
          winCondition: { lineLength: 4, linesToWin: 2 },
          playerOne: strengthOpponent,
          playerTwo: "nightmare",
          seed: 21,
        }),
        playDifficultyMatch({
          label: "two-lines-max-first",
          winCondition: { lineLength: 4, linesToWin: 2 },
          playerOne: "nightmare",
          playerTwo: strengthOpponent,
          seed: 22,
        }),
      ];

      console.log(`AXIAL_AI_STRENGTH ${JSON.stringify(matches)}`);

      const maxWins = matches.filter((match) => {
        const maxPlayer = match.playerOne === "nightmare" ? 1 : 2;
        return match.winner === maxPlayer;
      }).length;
      expect(matches.every((match) => match.terminal)).toBe(true);
      if (strengthOpponent === "hard") {
        expect(maxWins).toBeGreaterThanOrEqual(3);
      } else {
        expect(maxWins).toBe(matches.length);
      }
      expect(matches.every((match) => match.maxDepth > 1)).toBe(true);
    }, 300_000);
  },
);

function playDifficultyMatch({
  label,
  winCondition,
  playerOne,
  playerTwo,
  seed,
}: {
  label: string;
  winCondition: WinCondition;
  playerOne: ClassicAiDifficulty;
  playerTwo: ClassicAiDifficulty;
  seed: number;
}): MatchSummary {
  let game = createGame(winCondition);
  let simulations = 0;
  let maxDepth = 0;
  const stopReasons: Record<MctsStopReason, number> = {
    tactical: 0,
    simulations: 0,
    time: 0,
    "early-exit": 0,
  };

  while (game.status.state === "playing") {
    const difficulty = game.currentPlayer === 1 ? playerOne : playerTwo;
    const preset = classicAiSearchOptionsForGame(difficulty, game);
    const controlledHardOptions =
      strengthOpponent === "hard"
        ? {
            simulations: difficulty === "nightmare" ? 256 : 128,
            maxTimeMs: undefined,
            lookaheadNodeLimit: difficulty === "nightmare" ? 4_000 : 1_200,
            earlyExitVisits: 100_000,
          }
        : {};
    const result = analyzeMctsMove(game, {
      ...preset,
      ...controlledHardOptions,
      seed: seed + game.moveHistory.length * 101,
    });

    if (!result) break;
    simulations += result.simulations;
    maxDepth = Math.max(maxDepth, result.maxDepth);
    stopReasons[result.stopReason] += 1;
    game = applyMove(game, result.move);
  }

  return {
    label,
    workMode:
      strengthOpponent === "hard"
        ? "deterministic-controlled"
        : "preset-wall-clock",
    playerOne,
    playerTwo,
    winner: game.status.state === "won" ? game.status.winner : 0,
    moves: game.moveHistory.length,
    simulations,
    maxDepth,
    terminal: game.status.state !== "playing",
    moveHistory: game.moveHistory.map(({ row, col }) => ({ row, col })),
    stopReasons,
  };
}
