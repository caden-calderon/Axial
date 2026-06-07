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
  getClassicMoveIndices,
  getClassicMoves,
  getSegmentTable,
  moveCountForDimensions,
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
  selectTacticalMove,
  type ForcingMove,
  type HeuristicMoveResult,
  type MoveScore,
  type TacticalMoveMode,
} from "./classic/heuristic";
export {
  analyzeMctsMove,
  chooseMctsMove,
  type MctsMoveResult,
  type MctsMoveStat,
  type MctsOptions,
} from "./classic/mcts";
export {
  evaluateLookaheadPosition,
  selectLookaheadMove,
  type LookaheadMoveResult,
  type LookaheadMoveScore,
  type LookaheadOptions,
} from "./classic/lookahead";
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

  const moves = legalMoves(game.board, game.dimensions);
  if (moves.length === 0) return null;

  const index = randomMoveIndex(moves.length, random);
  const move = moves[index];
  return { row: move.row, col: move.col };
}

function randomMoveIndex(moveCount: number, random: RandomSource): number {
  return randomIndex(moveCount, random);
}
