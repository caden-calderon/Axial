import { describe, expect, it } from "vitest";
import {
  analyzeMctsMove,
  classicAiSearchOptionsForGame,
  isExpectedChallengeMove,
  observeClassicChallenge,
  replayClassicChallenge,
  type ClassicChallengePosition,
} from "./index";
import { CLASSIC_CHALLENGE_FIXTURES } from "./classic/challengeFixtures";

// Widen the literal fixture tuple so optional expectation fields are readable.
const CHALLENGES: readonly ClassicChallengePosition[] =
  CLASSIC_CHALLENGE_FIXTURES;

const challengeEvaluationEnabled = process.env.AXIAL_AI_CHALLENGE_EVAL === "1";
const challengeFilter = process.env.AXIAL_AI_CHALLENGE ?? "all";
const fullBudget = process.env.AXIAL_AI_CHALLENGE_FULL === "1";
const configuredSeed = Number(process.env.AXIAL_AI_SEED);

describe.skipIf(!challengeEvaluationEnabled)(
  "Classic deterministic challenge evaluation",
  () => {
    for (const challenge of CHALLENGES) {
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
                  // Reduced, deterministic work that still lets the tree search and a
                  // depth-3 lookahead decide. A minimum depth the search can't reach would
                  // certify only the heuristic fallback.
                  simulations: 180,
                  progressiveBias: 0.24,
                  lookaheadDepth: 3,
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
                  minimumSearchDepth: 3,
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
          if (challenge.tags.includes("strategy")) {
            // Strategy fixtures exist to test the search, not the one-ply fallback.
            expect(result!.reason).not.toBe("heuristic");
          }
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
