import { describe, expect, it } from "vitest";
import {
  analyzeMctsMove,
  classicAiSearchOptionsForGame,
  isExpectedChallengeMove,
  replayClassicChallenge,
  type ClassicAiDifficulty,
  type MctsOptions,
} from "./index";
import { CLASSIC_CHALLENGE_FIXTURES } from "./classic/challengeFixtures";

type LadderSummary = {
  difficulty: ClassicAiDifficulty;
  passed: number;
  strategicPassed: number;
  total: number;
  strategicTotal: number;
  meanElapsedMs: number;
  meanSimulations: number;
  meanSelectedDepth: number;
  decisions: {
    id: string;
    passed: boolean;
    move: { row: number; col: number } | null;
    elapsedMs: number;
    simulations: number;
    selectedDepth: number;
    reason: "tactical" | "lookahead" | "search" | "heuristic" | null;
  }[];
};

const ladderEvaluationEnabled = process.env.AXIAL_AI_LADDER_EVAL === "1";
const DIFFICULTIES = [
  "easy",
  "medium",
  "hard",
  "nightmare",
] as const satisfies readonly ClassicAiDifficulty[];

const CONTROLLED_WORK = {
  easy: { simulations: 24, lookaheadNodeLimit: 0 },
  medium: { simulations: 64, lookaheadNodeLimit: 300 },
  hard: { simulations: 128, lookaheadNodeLimit: 1_200 },
  nightmare: { simulations: 256, lookaheadNodeLimit: 4_000 },
} as const satisfies Record<
  ClassicAiDifficulty,
  Pick<MctsOptions, "simulations" | "lookaheadNodeLimit">
>;

describe.skipIf(!ladderEvaluationEnabled)(
  "Classic AI controlled capability ladder",
  () => {
    it("measures each difficulty on the same deterministic strategy suite", () => {
      const summaries = DIFFICULTIES.map(evaluateDifficulty);

      console.log(`AXIAL_AI_LADDER ${JSON.stringify(summaries)}`);

      expect(summaries.every((summary) => summary.total > 0)).toBe(true);
      expect(
        summaries.every((summary) =>
          summary.decisions.every((decision) => decision.move !== null),
        ),
      ).toBe(true);
      expect(summaries[1]!.passed).toBeGreaterThan(summaries[0]!.passed);
      expect(summaries[2]!.passed).toBeGreaterThan(summaries[1]!.passed);
      expect(summaries[3]!.passed).toBeGreaterThanOrEqual(summaries[2]!.passed);
      for (let index = 1; index < summaries.length; index += 1) {
        expect(summaries[index]!.meanSelectedDepth).toBeGreaterThan(
          summaries[index - 1]!.meanSelectedDepth,
        );
      }
    }, 300_000);
  },
);

function evaluateDifficulty(difficulty: ClassicAiDifficulty): LadderSummary {
  const decisions = CLASSIC_CHALLENGE_FIXTURES.map((challenge) => {
    const game = replayClassicChallenge(challenge);
    const preset = classicAiSearchOptionsForGame(difficulty, game);
    const work = CONTROLLED_WORK[difficulty];
    const result = analyzeMctsMove(game, {
      ...preset,
      ...work,
      maxTimeMs: undefined,
      earlyExitVisits: 100_000,
      seed: challengeSeed(challenge.id, difficulty),
    });
    const passed =
      result !== null && isExpectedChallengeMove(challenge, result.move);

    return {
      id: challenge.id,
      passed,
      move: result?.move ?? null,
      elapsedMs: round(result?.elapsedMs ?? 0),
      simulations: result?.simulations ?? 0,
      selectedDepth: result?.telemetry.selectedMoveDepth ?? 0,
      reason: result?.reason ?? null,
    };
  });
  const strategicIds = new Set(
    CLASSIC_CHALLENGE_FIXTURES.filter(
      (challenge) =>
        challenge.tags.includes("strategy") ||
        challenge.tags.includes("critical"),
    ).map((challenge) => challenge.id),
  );
  const strategicDecisions = decisions.filter((decision) =>
    strategicIds.has(decision.id),
  );

  return {
    difficulty,
    passed: decisions.filter((decision) => decision.passed).length,
    strategicPassed: strategicDecisions.filter((decision) => decision.passed)
      .length,
    total: decisions.length,
    strategicTotal: strategicDecisions.length,
    meanElapsedMs: mean(decisions.map((decision) => decision.elapsedMs)),
    meanSimulations: mean(decisions.map((decision) => decision.simulations)),
    meanSelectedDepth: mean(
      decisions.map((decision) => decision.selectedDepth),
    ),
    decisions,
  };
}

function challengeSeed(id: string, difficulty: ClassicAiDifficulty): number {
  let hash = 0x811c9dc5;
  for (const character of `${id}:${difficulty}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return round(
    values.reduce((total, value) => total + value, 0) / values.length,
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
