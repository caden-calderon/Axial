import { describe, expect, it } from "vitest";
import {
  analyzeMctsMove,
  classicAiSearchOptionsForGame,
  isExpectedChallengeMove,
  observeClassicChallenge,
  replayClassicChallenge,
} from "./index";
import { CLASSIC_CHALLENGE_FIXTURES } from "./classic/challengeFixtures";

const challengeEvaluationEnabled = process.env.AXIAL_AI_CHALLENGE_EVAL === "1";
const challengeFilter = process.env.AXIAL_AI_CHALLENGE ?? "all";
const fullBudget = process.env.AXIAL_AI_CHALLENGE_FULL === "1";
const configuredSeed = Number(process.env.AXIAL_AI_SEED);

describe.skipIf(!challengeEvaluationEnabled)(
  "Classic deterministic challenge evaluation",
  () => {
    for (const challenge of CLASSIC_CHALLENGE_FIXTURES) {
      it.skipIf(challengeFilter !== "all" && challengeFilter !== challenge.id)(
        `satisfies ${challenge.id}`,
        () => {
          const game = replayClassicChallenge(challenge);
          const result = analyzeMctsMove(
            game,
            fullBudget
              ? {
                  ...classicAiSearchOptionsForGame("nightmare", game),
                  seed: Number.isFinite(configuredSeed)
                    ? configuredSeed
                    : fixtureSeed(challenge.id),
                }
              : {
                  simulations: 180,
                  progressiveBias: 0.24,
                  lookaheadDepth: 2,
                  lookaheadMaxMoves: 10,
                  lookaheadRootMaxMoves: 14,
                  lookaheadNodeLimit: 1_400,
                  lookaheadWeight: 0.7,
                  lookaheadOverrideMargin: 1,
                  smartRolloutRate: 0.76,
                  useRave: true,
                  tacticalMode: "forced-only",
                  progressiveWidening: true,
                  progressiveWideningBase: 5,
                  progressiveWideningExponent: 0.45,
                  minimumSearchDepth: 4,
                  seed: fixtureSeed(challenge.id),
                },
          );
          const observation = observeClassicChallenge(
            challenge,
            fullBudget
              ? "classic-max-hybrid-threat-v1-full-budget"
              : "classic-max-hybrid-threat-v1-reduced-work",
            "2026-07-15T00:00:00.000Z",
            result,
          );
          console.log(
            `AXIAL_CHALLENGE ${JSON.stringify({ id: challenge.id, ...observation, searchTelemetry: result?.telemetry ?? null })}`,
          );

          expect(result).not.toBeNull();
          if (
            challenge.expectation.allowedMoves ||
            challenge.expectation.forbiddenMoves
          ) {
            expect(isExpectedChallengeMove(challenge, result!.move)).toBe(true);
          }
        },
        fullBudget ? 30_000 : 10_000,
      );
    }
  },
);

function fixtureSeed(id: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
