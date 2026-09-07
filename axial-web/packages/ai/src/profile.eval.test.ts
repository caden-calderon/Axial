import { describe, expect, it } from "vitest";
import { createGame, type GameSnapshot } from "@axial/core";
import {
  ClassicSearchState,
  analyzeMctsMove,
  countImmediateThreats,
  evaluateLookaheadPosition,
  evaluatePosition,
  findForcingMoves,
  findLineCompletionMoves,
  replayClassicChallenge,
  rankFastMoves,
  scoreLegalMoves,
  selectLookaheadMove,
} from "./index";
import { classicChallengeById } from "./classic/challengeFixtures";

const profileEnabled = process.env.AXIAL_AI_PROFILE === "1";

describe.skipIf(!profileEnabled)("Classic search profiling", () => {
  it("profiles deterministic work on representative rule phases", () => {
    const captured = classicChallengeById(
      "connect4-two-line-max-second-captured-blunder",
    );
    if (!captured) throw new Error("Missing captured-loss fixture");

    const cases = [
      {
        id: "connect4-one-line-opening",
        game: createGame({ lineLength: 4, linesToWin: 1 }),
      },
      {
        id: "connect4-two-line-midgame",
        game: replayClassicChallenge(captured),
      },
      {
        id: "connect5-three-line-opening",
        game: createGame({ lineLength: 5, linesToWin: 3 }),
      },
    ] satisfies readonly { id: string; game: GameSnapshot }[];

    for (const profileCase of cases) {
      const state = ClassicSearchState.fromGame(profileCase.game);
      const player = profileCase.game.currentPlayer;
      const timings = {
        stateConversion: benchmark(80, () =>
          ClassicSearchState.fromGame(profileCase.game),
        ),
        clone: benchmark(300, () => state.clone()),
        evaluatePosition: benchmark(20, () => evaluatePosition(state, player)),
        evaluateLookaheadPosition: benchmark(2, () =>
          evaluateLookaheadPosition(state, player, player),
        ),
        immediateThreatScan: benchmark(8, () =>
          countImmediateThreats(state, player),
        ),
        scoreLegalMoves: benchmark(4, () => scoreLegalMoves(state, player)),
        rankFastMoves: benchmark(8, () => rankFastMoves(state, player)),
        lineCompletionScan: benchmark(8, () =>
          findLineCompletionMoves(state, player),
        ),
        forcingScan: benchmark(4, () => findForcingMoves(state, player)),
      };
      const lookahead = timed(() =>
        selectLookaheadMove(state, player, {
          depth: 3,
          maxMoves: 10,
          rootMaxMoves: 14,
          nodeLimit: 4_000,
        }),
      );
      const randomRollout = timed(() =>
        analyzeMctsMove(profileCase.game, {
          simulations: 80,
          lookaheadDepth: 0,
          smartRolloutRate: 0,
          useRave: false,
          progressiveWidening: true,
          progressiveWideningBase: 5,
          progressiveWideningExponent: 0.45,
          earlyExitVisits: 100_000,
          tacticalMode: "immediate-only",
          seed: 101,
        }),
      );
      const smartRollout = timed(() =>
        analyzeMctsMove(profileCase.game, {
          simulations: 80,
          lookaheadDepth: 0,
          smartRolloutRate: 0.86,
          useRave: true,
          progressiveWidening: true,
          progressiveWideningBase: 5,
          progressiveWideningExponent: 0.45,
          earlyExitVisits: 100_000,
          tacticalMode: "immediate-only",
          seed: 101,
        }),
      );

      console.log(
        `AXIAL_PROFILE ${JSON.stringify({
          id: profileCase.id,
          legalMoves: state.legalMoveIndices().length,
          timings,
          lookahead: {
            elapsedMs: lookahead.elapsedMs,
            nodes: lookahead.value?.nodes ?? 0,
            candidates: lookahead.value?.candidates.length ?? 0,
            complete: lookahead.value?.complete ?? false,
          },
          randomRollout: {
            elapsedMs: randomRollout.elapsedMs,
            simulations: randomRollout.value?.simulations ?? 0,
            maxDepth: randomRollout.value?.maxDepth ?? 0,
          },
          smartRollout: {
            elapsedMs: smartRollout.elapsedMs,
            simulations: smartRollout.value?.simulations ?? 0,
            maxDepth: smartRollout.value?.maxDepth ?? 0,
          },
        })}`,
      );

      expect(randomRollout.value?.simulations).toBe(80);
      expect(smartRollout.value?.simulations).toBe(80);
    }
  }, 300_000);
});

function benchmark(iterations: number, operation: () => unknown) {
  operation();
  const startedAt = performance.now();
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    operation();
  }
  const elapsedMs = performance.now() - startedAt;

  return {
    iterations,
    elapsedMs,
    perIterationMs: elapsedMs / iterations,
  };
}

function timed<T>(operation: () => T): { value: T; elapsedMs: number } {
  const startedAt = performance.now();
  const value = operation();
  return { value, elapsedMs: performance.now() - startedAt };
}
