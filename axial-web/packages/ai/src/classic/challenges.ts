import {
  applyMove,
  replayMoves,
  type BoardDimensions,
  type GameSnapshot,
  type Move,
  type Player,
  type WinCondition,
} from "@axial/core";
import type { MctsMoveResult, MctsStopReason } from "./mcts";

export const CLASSIC_CHALLENGE_FORMAT_VERSION = 1 as const;

export type ClassicChallengeProperty =
  | "wins-immediately"
  | "blocks-immediate-loss"
  | "banks-distinct-line"
  | "denies-distinct-line"
  | "creates-fork"
  | "prevents-fork"
  | "avoids-support-trap"
  | "creates-independent-threats"
  | "preserves-race-tempo"
  | "builds-connect-five"
  | "avoids-completed-run-extension";

export type ClassicChallengeSource =
  | {
      kind: "synthetic";
      description: string;
    }
  | {
      kind: "caden-game";
      gameId: string;
      description: string;
    };

export type ClassicChallengeExpectation = {
  properties: readonly ClassicChallengeProperty[];
  allowedMoves?: readonly Move[];
  forbiddenMoves?: readonly Move[];
  notes: string;
};

export type ClassicChallengeObservation = {
  engineVersion: string;
  capturedAt: string;
  selectedMove: Move | null;
  decisionReason: MctsMoveResult["reason"] | null;
  elapsedMs: number;
  simulations: number;
  maxDepth: number;
  rootBreadth: number;
  lookaheadRequestedDepth: number;
  lookaheadCompletedDepth: number;
  lookaheadPartialDepth: number;
  lookaheadComplete: boolean;
  stopReason: MctsStopReason | null;
  completedLinesBefore: Readonly<Record<Player, number>>;
  completedLinesAfter: Readonly<Record<Player, number>>;
  notes?: string;
};

export type ClassicChallengePosition = {
  version: typeof CLASSIC_CHALLENGE_FORMAT_VERSION;
  id: string;
  description: string;
  source: ClassicChallengeSource;
  dimensions: BoardDimensions;
  winCondition: WinCondition;
  startingPlayer: Player;
  moveHistory: readonly Move[];
  playerToMove: Player;
  expectation: ClassicChallengeExpectation;
  tags: readonly string[];
  observations: readonly ClassicChallengeObservation[];
};

export function replayClassicChallenge(
  challenge: ClassicChallengePosition,
): GameSnapshot {
  if (challenge.version !== CLASSIC_CHALLENGE_FORMAT_VERSION) {
    throw new Error(
      `Unsupported Classic challenge version ${String(challenge.version)}`,
    );
  }
  if (challenge.id.trim().length === 0) {
    throw new Error("Classic challenge id must not be empty");
  }

  const game = replayMoves(
    challenge.moveHistory,
    challenge.winCondition,
    challenge.dimensions,
    challenge.startingPlayer,
  );

  if (game.status.state !== "playing") {
    throw new Error(
      `Classic challenge ${challenge.id} must stop at a playable position`,
    );
  }
  if (game.currentPlayer !== challenge.playerToMove) {
    throw new Error(
      `Classic challenge ${challenge.id} expects Player ${challenge.playerToMove} but replay yields Player ${game.currentPlayer}`,
    );
  }

  validateExpectedMoves(challenge, game);
  return game;
}

export function observeClassicChallenge(
  challenge: ClassicChallengePosition,
  engineVersion: string,
  capturedAt: string,
  result: MctsMoveResult | null,
  notes?: string,
): ClassicChallengeObservation {
  const game = replayClassicChallenge(challenge);
  const after = result?.move ? applyMove(game, result.move) : game;

  return {
    engineVersion,
    capturedAt,
    selectedMove: result?.move ?? null,
    decisionReason: result?.reason ?? null,
    elapsedMs: result?.elapsedMs ?? 0,
    simulations: result?.simulations ?? 0,
    maxDepth: result?.maxDepth ?? 0,
    rootBreadth: result?.rootChildren ?? 0,
    lookaheadRequestedDepth: result?.lookaheadDepth ?? 0,
    lookaheadCompletedDepth: result?.lookaheadCompletedDepth ?? 0,
    lookaheadPartialDepth: result?.lookaheadPartialDepth ?? 0,
    lookaheadComplete: result?.lookaheadComplete ?? true,
    stopReason: result?.stopReason ?? null,
    completedLinesBefore: completedLineCounts(game),
    completedLinesAfter: completedLineCounts(after),
    ...(notes ? { notes } : {}),
  };
}

export function isExpectedChallengeMove(
  challenge: ClassicChallengePosition,
  move: Move,
): boolean {
  const allowed = challenge.expectation.allowedMoves;
  if (allowed && !allowed.some((candidate) => sameMove(candidate, move))) {
    return false;
  }

  return !challenge.expectation.forbiddenMoves?.some((candidate) =>
    sameMove(candidate, move),
  );
}

function validateExpectedMoves(
  challenge: ClassicChallengePosition,
  game: GameSnapshot,
): void {
  const expectedMoves = [
    ...(challenge.expectation.allowedMoves ?? []),
    ...(challenge.expectation.forbiddenMoves ?? []),
  ];

  for (const move of expectedMoves) {
    try {
      applyMove(game, move);
    } catch {
      throw new Error(
        `Classic challenge ${challenge.id} references illegal move row=${move.row}, col=${move.col}`,
      );
    }
  }
}

function completedLineCounts(
  game: GameSnapshot,
): Readonly<Record<Player, number>> {
  return {
    1: game.completedLines.filter((line) => line.player === 1).length,
    2: game.completedLines.filter((line) => line.player === 2).length,
  };
}

function sameMove(first: Move, second: Move): boolean {
  return first.row === second.row && first.col === second.col;
}
