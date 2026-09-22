import { describe, expect, it } from "vitest";
import {
  ClassicSearchState,
  analyzeMctsMove,
  classicAiSearchOptionsForGame,
  isExpectedChallengeMove,
  moveFromIndex,
  observeClassicChallenge,
  replayClassicChallenge,
  selectLookaheadMove,
} from "./index";
import { CLASSIC_CHALLENGE_FIXTURES } from "./classic/challengeFixtures";

describe("Classic challenge fixtures", () => {
  it("have unique ids and replay to the declared player", () => {
    const ids = new Set<string>();

    for (const challenge of CLASSIC_CHALLENGE_FIXTURES) {
      expect(ids.has(challenge.id)).toBe(false);
      ids.add(challenge.id);

      const game = replayClassicChallenge(challenge);
      expect(game.status.state).toBe("playing");
      expect(game.currentPlayer).toBe(challenge.playerToMove);
      expect(game.moveHistory).toHaveLength(challenge.moveHistory.length);
    }
  });

  it("cover every required strategic regression class", () => {
    const properties = new Set(
      CLASSIC_CHALLENGE_FIXTURES.flatMap(
        (challenge) => challenge.expectation.properties,
      ),
    );
    const required = [
      "wins-immediately",
      "blocks-immediate-loss",
      "banks-distinct-line",
      "denies-distinct-line",
      "creates-fork",
      "prevents-fork",
      "avoids-support-trap",
      "creates-independent-threats",
      "preserves-race-tempo",
      "builds-connect-five",
      "avoids-completed-run-extension",
    ] as const;

    expect(required.filter((property) => !properties.has(property))).toEqual(
      [],
    );
  });

  it("applies allowed and forbidden move contracts", () => {
    const supportTrap = CLASSIC_CHALLENGE_FIXTURES.find(
      (challenge) => challenge.id === "connect4-height-one-support-trap",
    );
    const immediateWin = CLASSIC_CHALLENGE_FIXTURES.find(
      (challenge) => challenge.id === "connect4-immediate-win",
    );

    expect(supportTrap).toBeDefined();
    expect(immediateWin).toBeDefined();
    expect(isExpectedChallengeMove(supportTrap!, { row: 2, col: 3 })).toBe(
      false,
    );
    expect(isExpectedChallengeMove(supportTrap!, { row: 0, col: 0 })).toBe(
      true,
    );
    expect(isExpectedChallengeMove(immediateWin!, { row: 2, col: 3 })).toBe(
      true,
    );
    expect(isExpectedChallengeMove(immediateWin!, { row: 2, col: 4 })).toBe(
      false,
    );
  });

  it("records an engine result with rule-progress telemetry", () => {
    const challenge = CLASSIC_CHALLENGE_FIXTURES.find(
      (candidate) => candidate.id === "connect4-two-line-bank-distinct",
    );
    expect(challenge).toBeDefined();

    const game = replayClassicChallenge(challenge!);
    const result = analyzeMctsMove(game, {
      ...classicAiSearchOptionsForGame("nightmare", game),
      simulations: 0,
      maxTimeMs: 0,
      seed: 17,
    });
    const observation = observeClassicChallenge(
      challenge!,
      "test-engine",
      "2026-07-15T00:00:00.000Z",
      result,
    );

    expect(observation.selectedMove).toEqual({ row: 2, col: 3 });
    expect(observation.completedLinesBefore[1]).toBe(0);
    expect(observation.completedLinesAfter[1]).toBe(1);
    expect(observation.stopReason).toBe("simulations");
  });
});

describe("Classic Max failure regressions", () => {
  it("never lets heuristic progress replace a mandatory fork block", () => {
    const challenge = CLASSIC_CHALLENGE_FIXTURES.find(
      (candidate) =>
        candidate.id ===
        "connect4-two-line-forced-fork-block-outranks-progress",
    );
    expect(challenge).toBeDefined();

    const result = analyzeMctsMove(replayClassicChallenge(challenge!), {
      simulations: 0,
      maxTimeMs: 0,
      seed: 19,
    });

    expect(result?.reason).toBe("tactical");
    expect(result?.move).toEqual({ row: 1, col: 2 });
  });

  it("sees past the captured standard opening fork race", () => {
    const challenge = CLASSIC_CHALLENGE_FIXTURES.find(
      (candidate) => candidate.id === "connect4-max-second-opening-fork-race",
    );
    expect(challenge).toBeDefined();

    const game = replayClassicChallenge(challenge!);
    const state = ClassicSearchState.fromGame(game);
    const result = selectLookaheadMove(state, game.currentPlayer, {
      depth: 3,
      maxMoves: 12,
      rootMaxMoves: 18,
      nodeLimit: 16_000,
    });

    expect(result?.completedDepth).toBe(3);
    expect(
      result === null ? null : moveFromIndex(result.moveIndex, game.dimensions),
    ).not.toMatchObject({ row: 1, col: 3 });
  });

  it("does not let the former three-line guard bypass search", () => {
    const challenge = CLASSIC_CHALLENGE_FIXTURES.find(
      (candidate) => candidate.id === "connect4-three-line-direct-bank-guard",
    );
    expect(challenge).toBeDefined();

    const game = replayClassicChallenge(challenge!);
    const result = analyzeMctsMove(game, {
      simulations: 32,
      lookaheadDepth: 1,
      lookaheadMaxMoves: 6,
      lookaheadRootMaxMoves: 8,
      lookaheadNodeLimit: 200,
      minimumSearchDepth: 1,
      seed: 3_867,
    });

    expect(result?.reason).not.toBe("tactical");
    expect(result?.simulations).toBe(32);
    expect(result?.lookaheadCompletedDepth).toBe(1);
  });
});
