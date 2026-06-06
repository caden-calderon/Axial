import { legalMoves, type GameSnapshot, type Move } from "@axial/core";
import { randomIndex, type RandomSource } from "./random";

export { createSeededRandom, type RandomSource } from "./random";
export {
  CELL_SEGMENTS,
  CLASSIC_MOVES,
  CLASSIC_MOVE_COUNT,
  CLASSIC_MOVE_INDICES,
  DEFAULT_SEGMENT_TABLE,
  SEGMENT_AXIS_COUNTS,
  WINNING_SEGMENTS,
  cellToMoveIndex,
  getSegmentTable,
  moveFromIndex,
  moveToIndex,
  type ClassicMove,
  type MoveIndex,
  type SegmentAxis,
  type SegmentTable,
  type WinningSegment,
} from "./classic/geometry";
export { ClassicSearchState } from "./classic/state";
export {
  analyzeHeuristicMove,
  chooseHeuristicMove,
  compareMoveIndicesByShape,
  countImmediateThreats,
  countLineCompletionThreats,
  countLineCompletionsForMove,
  evaluatePosition,
  findForcingMoves,
  findWinningMoves,
  scoreLegalMoves,
  scoreMove,
  selectHeuristicMove,
  type HeuristicMoveResult,
  type MoveScore,
} from "./classic/heuristic";
export {
  analyzeMctsMove,
  chooseMctsMove,
  type MctsMoveResult,
  type MctsMoveStat,
  type MctsOptions,
} from "./classic/mcts";
export {
  playAiMatch,
  runEvaluation,
  type AiPlayer,
  type EvaluationResult,
  type MatchPlayerConfig,
  type MatchResult,
} from "./evaluation";

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
  return randomIndex(moveCount, random);
}
