import {
  DEFAULT_BOARD_DIMENSIONS,
  DEFAULT_WIN_CONDITION,
  applyMove,
  cellCount,
  createGame,
  type BoardDimensions,
  type GameSnapshot,
  type Move,
  type Player,
  type WinCondition,
} from "@axial/core";
import { createSeededRandom, type RandomSource } from "./random";

export type AiPlayer = (
  game: GameSnapshot,
  random: RandomSource,
) => Move | null;

export type MatchPlayerConfig = Record<Player, AiPlayer>;

export type MatchResult = {
  winner: Player | 0;
  moves: Move[];
  finalGame: GameSnapshot;
  illegalMoveBy: Player | null;
};

export type EvaluationResult = {
  games: number;
  playerOneWins: number;
  playerTwoWins: number;
  draws: number;
  illegalMoves: number;
  results: MatchResult[];
};

export function playAiMatch({
  players,
  seed = 1,
  maxMoves,
  winCondition = DEFAULT_WIN_CONDITION,
  dimensions = DEFAULT_BOARD_DIMENSIONS,
  startingPlayer = 1,
}: {
  players: MatchPlayerConfig;
  seed?: number;
  maxMoves?: number;
  winCondition?: WinCondition;
  dimensions?: BoardDimensions;
  startingPlayer?: Player;
}): MatchResult {
  let game = createGame(winCondition, dimensions, startingPlayer);
  const random = createSeededRandom(seed);
  const moves: Move[] = [];
  const moveLimit = maxMoves ?? cellCount(dimensions);

  while (game.status.state === "playing" && moves.length < moveLimit) {
    const player = game.currentPlayer;
    const move = players[player](game, random);

    if (!move) {
      return {
        winner: player === 1 ? 2 : 1,
        moves,
        finalGame: game,
        illegalMoveBy: player,
      };
    }

    try {
      game = applyMove(game, move);
    } catch {
      return {
        winner: player === 1 ? 2 : 1,
        moves,
        finalGame: game,
        illegalMoveBy: player,
      };
    }

    moves.push(move);
  }

  return {
    winner:
      game.status.state === "won"
        ? game.status.winner
        : game.status.state === "draw"
          ? 0
          : 0,
    moves,
    finalGame: game,
    illegalMoveBy: null,
  };
}

export function runEvaluation({
  players,
  games,
  seed = 1,
  maxMoves,
  winCondition = DEFAULT_WIN_CONDITION,
  dimensions = DEFAULT_BOARD_DIMENSIONS,
  startingPlayer = 1,
}: {
  players: MatchPlayerConfig;
  games: number;
  seed?: number;
  maxMoves?: number;
  winCondition?: WinCondition;
  dimensions?: BoardDimensions;
  startingPlayer?: Player;
}): EvaluationResult {
  const results: MatchResult[] = [];

  for (let index = 0; index < games; index += 1) {
    results.push(
      playAiMatch({
        players,
        seed: seed + index,
        maxMoves,
        winCondition,
        dimensions,
        startingPlayer,
      }),
    );
  }

  return {
    games,
    playerOneWins: results.filter((result) => result.winner === 1).length,
    playerTwoWins: results.filter((result) => result.winner === 2).length,
    draws: results.filter((result) => result.winner === 0).length,
    illegalMoves: results.filter((result) => result.illegalMoveBy !== null)
      .length,
    results,
  };
}
