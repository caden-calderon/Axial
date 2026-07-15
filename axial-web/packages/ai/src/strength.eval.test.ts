import { describe, expect, it } from "vitest";
import {
  applyMove,
  createGame,
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
  playerOne: ClassicAiDifficulty;
  playerTwo: ClassicAiDifficulty;
  winner: Player | 0;
  moves: number;
  simulations: number;
  maxDepth: number;
  stopReasons: Record<MctsStopReason, number>;
};

const strengthEvaluationEnabled = process.env.AXIAL_AI_STRENGTH_EVAL === "1";

describe.skipIf(!strengthEvaluationEnabled)(
  "Classic AI strength evaluation",
  () => {
    it("makes Max beat Easy from both seats under standard and two-line rules", () => {
      const matches = [
        playDifficultyMatch({
          label: "standard-max-second",
          winCondition: { lineLength: 4, linesToWin: 1 },
          playerOne: "easy",
          playerTwo: "nightmare",
          seed: 11,
        }),
        playDifficultyMatch({
          label: "standard-max-first",
          winCondition: { lineLength: 4, linesToWin: 1 },
          playerOne: "nightmare",
          playerTwo: "easy",
          seed: 12,
        }),
        playDifficultyMatch({
          label: "two-lines-max-second",
          winCondition: { lineLength: 4, linesToWin: 2 },
          playerOne: "easy",
          playerTwo: "nightmare",
          seed: 21,
        }),
        playDifficultyMatch({
          label: "two-lines-max-first",
          winCondition: { lineLength: 4, linesToWin: 2 },
          playerOne: "nightmare",
          playerTwo: "easy",
          seed: 22,
        }),
      ];

      console.log(`AXIAL_AI_STRENGTH ${JSON.stringify(matches)}`);

      const maxWins = matches.filter((match) => {
        const maxPlayer = match.playerOne === "nightmare" ? 1 : 2;
        return match.winner === maxPlayer;
      }).length;

      expect(maxWins).toBeGreaterThanOrEqual(3);
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
    const result = analyzeMctsMove(game, {
      ...classicAiSearchOptionsForGame(difficulty, game),
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
    playerOne,
    playerTwo,
    winner: game.status.state === "won" ? game.status.winner : 0,
    moves: game.moveHistory.length,
    simulations,
    maxDepth,
    stopReasons,
  };
}
