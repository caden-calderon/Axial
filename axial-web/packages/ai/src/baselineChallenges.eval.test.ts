import { beforeAll, describe, expect, it } from "vitest";
import {
  analyzeMctsMove,
  classicAiSearchOptionsForGame,
  isExpectedChallengeMove,
  replayClassicChallenge,
  type MctsMoveResult,
  type MctsOptions,
} from "./index";
import { CLASSIC_CHALLENGE_FIXTURES } from "./classic/challengeFixtures";

type Engine = {
  analyzeMctsMove: typeof analyzeMctsMove;
};

type ChallengeDecision = {
  id: string;
  rule: string;
  engine: "baseline" | "hybrid";
  passed: boolean;
  move: { row: number; col: number } | null;
  reason: MctsMoveResult["reason"] | null;
  elapsedMs: number;
  simulations: number;
  lookaheadCompletedDepth: number;
};

const evaluationEnabled = process.env.AXIAL_AI_BASELINE_CHALLENGE_EVAL === "1";
const baselineBundle =
  process.env.AXIAL_AI_BASELINE_BUNDLE ?? "/tmp/axial-classic-ai-baseline.mjs";
const timeBudgetMs = finiteInteger(
  process.env.AXIAL_AI_BASELINE_CHALLENGE_TIME_MS,
  250,
);

let baselineEngine: Engine;

describe.skipIf(!evaluationEnabled)(
  "Classic frozen-baseline challenge comparison",
  () => {
    beforeAll(async () => {
      baselineEngine = (await import(baselineBundle)) as Engine;
      if (typeof baselineEngine.analyzeMctsMove !== "function") {
        throw new Error(
          `Baseline bundle ${baselineBundle} does not export analyzeMctsMove`,
        );
      }
    });

    it("compares strategic decisions under identical clocks", () => {
      const decisions: ChallengeDecision[] = [];

      for (const challenge of CLASSIC_CHALLENGE_FIXTURES) {
        const game = replayClassicChallenge(challenge);
        const options = equalClockOptions(game, challenge.id);
        for (const [engineId, engine] of [
          ["baseline", baselineEngine],
          ["hybrid", { analyzeMctsMove }],
        ] as const) {
          const result = engine.analyzeMctsMove(game, options);
          decisions.push({
            id: challenge.id,
            rule: `${challenge.winCondition.lineLength}/${challenge.winCondition.linesToWin}`,
            engine: engineId,
            passed: challengePasses(challenge.id, challenge, result),
            move: result?.move ?? null,
            reason: result?.reason ?? null,
            elapsedMs: round(result?.elapsedMs ?? 0),
            simulations: result?.simulations ?? 0,
            lookaheadCompletedDepth: result?.lookaheadCompletedDepth ?? 0,
          });
        }
      }

      const rules = [...new Set(decisions.map((decision) => decision.rule))];
      const summaries = rules.map((rule) => {
        const forRule = decisions.filter((decision) => decision.rule === rule);
        return {
          rule,
          baselinePassed: forRule.filter(
            (decision) => decision.engine === "baseline" && decision.passed,
          ).length,
          hybridPassed: forRule.filter(
            (decision) => decision.engine === "hybrid" && decision.passed,
          ).length,
          total: forRule.length / 2,
        };
      });

      console.log(
        `AXIAL_AI_BASELINE_CHALLENGES ${JSON.stringify({
          timeBudgetMs,
          summaries,
          decisions,
        })}`,
      );

      expect(decisions.every((decision) => decision.move !== null)).toBe(true);
      for (const summary of summaries) {
        expect(summary.hybridPassed).toBeGreaterThanOrEqual(
          summary.baselinePassed,
        );
      }
      expect(
        summaries.find((summary) => summary.rule === "4/2")!.hybridPassed,
      ).toBeGreaterThan(
        summaries.find((summary) => summary.rule === "4/2")!.baselinePassed,
      );
      expect(
        summaries.find((summary) => summary.rule === "4/3")!.hybridPassed,
      ).toBeGreaterThan(
        summaries.find((summary) => summary.rule === "4/3")!.baselinePassed,
      );
    }, 300_000);
  },
);

function challengePasses(
  id: string,
  challenge: (typeof CLASSIC_CHALLENGE_FIXTURES)[number],
  result: MctsMoveResult | null,
): boolean {
  if (!result || !isExpectedChallengeMove(challenge, result.move)) {
    return false;
  }
  if (id === "connect4-three-line-direct-bank-guard") {
    return result.reason !== "tactical" && result.simulations > 0;
  }
  return true;
}

function equalClockOptions(
  game: Parameters<typeof classicAiSearchOptionsForGame>[1],
  id: string,
): MctsOptions {
  return {
    ...classicAiSearchOptionsForGame("nightmare", game),
    simulations: 100_000,
    maxTimeMs: timeBudgetMs,
    earlyExitVisits: 100_000,
    earlyExitRatio: 1,
    seed: fixtureSeed(id),
  };
}

function fixtureSeed(id: string): number {
  let hash = 0x811c9dc5;
  for (const character of id) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function finiteInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
