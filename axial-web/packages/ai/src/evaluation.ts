import {
  applyMove,
  createGame,
  type GameSnapshot,
  type Move,
  type Player,
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
  maxMoves = 252,
}: {
  players: MatchPlayerConfig;
  seed?: number;
  maxMoves?: number;
}): MatchResult {
  let game = createGame();
  const random = createSeededRandom(seed);
  const moves: Move[] = [];

  while (game.status.state === "playing" && moves.length < maxMoves) {
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
}: {
  players: MatchPlayerConfig;
  games: number;
  seed?: number;
}): EvaluationResult {
  const results: MatchResult[] = [];

  for (let index = 0; index < games; index += 1) {
    results.push(playAiMatch({ players, seed: seed + index }));
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
