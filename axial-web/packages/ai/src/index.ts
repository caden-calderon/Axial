import { legalMoves, type GameSnapshot, type Move } from "@axial/core";

export type RandomSource = () => number;

export function chooseRandomMove(
  game: GameSnapshot,
  random: RandomSource = Math.random,
): Move | null {
  if (game.status.state !== "playing") return null;

  const moves = legalMoves(game.board);
  if (moves.length === 0) return null;

  const index = randomMoveIndex(moves.length, random);
  const move = moves[index];
  return { row: move.row, col: move.col };
}

function randomMoveIndex(moveCount: number, random: RandomSource): number {
  const value = random();
  const normalized = Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 0.999999999)
    : 0;
  return Math.floor(normalized * moveCount);
}
