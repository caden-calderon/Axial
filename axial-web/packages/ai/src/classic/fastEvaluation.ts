import { cellFromIndex, otherPlayer, type Player } from "@axial/core";
import {
  compareMoveIndicesByShape,
  countLineCompletionsForMove,
  evaluatePosition,
} from "./heuristic";
import { cellToMoveIndex, moveFromIndex, type MoveIndex } from "./geometry";
import { ClassicSearchState } from "./state";

export type FastMoveScore = {
  moveIndex: MoveIndex;
  score: number;
};

export function rankFastMoves(
  state: ClassicSearchState,
  player: Player,
  moves: readonly MoveIndex[] = state.legalMoveIndices(),
): FastMoveScore[] {
  return moves
    .map((moveIndex) => ({
      moveIndex,
      score: fastMoveScore(state, moveIndex, player),
    }))
    .sort((first, second) => {
      if (first.score !== second.score) return second.score - first.score;
      return compareMoveIndicesByShape(
        first.moveIndex,
        second.moveIndex,
        state.dimensions,
      );
    });
}

export function evaluateFastPosition(
  state: ClassicSearchState,
  player: Player,
  playerToMove: Player = player,
): number {
  const opponent = otherPlayer(player);
  if (state.winner === player) return 10_000_000;
  if (state.winner === opponent) return -10_000_000;

  const ownLinesNeeded = Math.max(
    1,
    state.winCondition.linesToWin - state.completedLineCount(player),
  );
  const opponentLinesNeeded = Math.max(
    1,
    state.winCondition.linesToWin - state.completedLineCount(opponent),
  );
  const ownThreats = fastThreatProfile(state, player);
  const opponentThreats = fastThreatProfile(state, opponent);
  const ownImmediate = ownLinesNeeded <= 1 ? ownThreats.cells.size : 0;
  const opponentImmediate =
    opponentLinesNeeded <= 1 ? opponentThreats.cells.size : 0;
  const ownTempo = playerToMove === player ? 1.65 : 1;
  const opponentTempo = playerToMove === opponent ? 1.9 : 1;

  return (
    evaluatePosition(state, player) +
    ownImmediate * 62_000 * ownTempo -
    opponentImmediate * 78_000 * opponentTempo +
    (ownThreats.segments * 18_000 * ownTempo) / Math.sqrt(ownLinesNeeded) -
    (opponentThreats.segments * 23_000 * opponentTempo) /
      Math.sqrt(opponentLinesNeeded)
  );
}

export function fastMoveScore(
  state: ClassicSearchState,
  moveIndex: MoveIndex,
  player: Player,
): number {
  const playerCounts =
    player === 1 ? state.playerOneCounts : state.playerTwoCounts;
  const opponentCounts =
    player === 1 ? state.playerTwoCounts : state.playerOneCounts;
  const cellIndex = state.dropCellIndex(moveIndex);
  const opponent = otherPlayer(player);
  const ownLineCompletions = countLineCompletionsForMove(
    state,
    moveIndex,
    player,
  );
  const opponentLineCompletions = countLineCompletionsForMove(
    state,
    moveIndex,
    opponent,
  );
  const remainingOwnLines = Math.max(
    1,
    state.winCondition.linesToWin - state.completedLineCount(player),
  );
  const remainingOpponentLines = Math.max(
    1,
    state.winCondition.linesToWin - state.completedLineCount(opponent),
  );
  let score =
    centerMoveScore(state, moveIndex) +
    state.completedLineCount(player) * 18_000 -
    state.completedLineCount(opponent) * 24_000 +
    ownLineCompletions * (remainingOwnLines <= 1 ? 220_000 : 130_000) +
    opponentLineCompletions * (remainingOpponentLines <= 1 ? 260_000 : 155_000);
  let ownCompletionBonuses = ownLineCompletions;
  let opponentCompletionBonuses = opponentLineCompletions;

  for (const segmentId of state.segmentTable.cellSegments[cellIndex]) {
    if (state.blockedCounts[segmentId] > 0) continue;

    const own = playerCounts[segmentId];
    const opp = opponentCounts[segmentId];
    const lineLength = state.winCondition.lineLength;

    if (opp === 0) {
      if (own === lineLength) {
        continue;
      } else if (own === lineLength - 1) {
        score += ownCompletionBonuses > 0 ? 100_000 : 280;
        ownCompletionBonuses = Math.max(0, ownCompletionBonuses - 1);
      } else if (own === lineLength - 2) {
        score += 1_200;
      } else if (own > 0) {
        score += 80 * own;
      } else {
        score += 8;
      }

      score += segmentPlayabilityScore(
        state,
        segmentId,
        cellIndex,
        player,
        true,
      );
    }

    if (own === 0) {
      if (opp === lineLength) {
        continue;
      } else if (opp === lineLength - 1) {
        score += opponentCompletionBonuses > 0 ? 70_000 : 320;
        opponentCompletionBonuses = Math.max(0, opponentCompletionBonuses - 1);
      } else if (opp === lineLength - 2) {
        score += 1_000;
      } else if (opp > 0) {
        score += 70 * opp;
      }

      score += segmentPlayabilityScore(
        state,
        segmentId,
        cellIndex,
        opponent,
        false,
      );
    }
  }

  return score;
}

function fastThreatProfile(
  state: ClassicSearchState,
  player: Player,
): { cells: Set<number>; segments: number } {
  const playerCounts =
    player === 1 ? state.playerOneCounts : state.playerTwoCounts;
  const opponentCounts =
    player === 1 ? state.playerTwoCounts : state.playerOneCounts;
  const cells = new Set<number>();
  let segments = 0;

  for (const segment of state.segmentTable.segments) {
    if (
      state.blockedCounts[segment.id] > 0 ||
      opponentCounts[segment.id] > 0 ||
      playerCounts[segment.id] !== state.winCondition.lineLength - 1
    ) {
      continue;
    }

    const playableCell = segment.cells.find((cellIndex) =>
      state.isPlayableCell(cellIndex),
    );
    if (
      playableCell === undefined ||
      countLineCompletionsForMove(
        state,
        cellToMoveIndex(playableCell, state.dimensions),
        player,
      ) === 0
    )
      continue;

    cells.add(playableCell);
    segments += 1;
  }

  return { cells, segments };
}

function segmentPlayabilityScore(
  state: ClassicSearchState,
  segmentId: number,
  placedCellIndex: number,
  player: Player,
  offensive: boolean,
): number {
  const segment = state.segmentTable.segments[segmentId];
  const ownCounts =
    player === 1 ? state.playerOneCounts : state.playerTwoCounts;
  const opponentCounts =
    player === 1 ? state.playerTwoCounts : state.playerOneCounts;
  if (opponentCounts[segmentId] > 0) return 0;

  const projectedCount = ownCounts[segmentId] + 1;
  if (projectedCount < state.winCondition.lineLength - 2) return 0;

  let playableEmpties = 0;
  let minimumSupport = Number.POSITIVE_INFINITY;
  for (const cellIndex of segment.cells) {
    if (cellIndex === placedCellIndex) continue;
    if (state.board[cellIndex] !== 0) continue;
    if (state.isPlayableCell(cellIndex)) playableEmpties += 1;

    const { height } = cellFromIndex(cellIndex, state.dimensions);
    const columnHeight =
      state.heights[cellToMoveIndex(cellIndex, state.dimensions)];
    minimumSupport = Math.min(
      minimumSupport,
      Math.max(0, height - columnHeight),
    );
  }

  const direction = offensive ? 1 : 1.16;
  const playableBonus = playableEmpties * 1_400 * direction;
  const supportBonus = Number.isFinite(minimumSupport)
    ? Math.max(0, 900 - minimumSupport * 220) * direction
    : 0;
  const independentThreatBonus =
    projectedCount === state.winCondition.lineLength - 1 && playableEmpties > 0
      ? 5_500 * direction
      : 0;

  return Math.round(playableBonus + supportBonus + independentThreatBonus);
}

function centerMoveScore(
  state: ClassicSearchState,
  moveIndex: MoveIndex,
): number {
  const move = moveFromIndex(moveIndex, state.dimensions);
  const centerRow = (state.dimensions.rows - 1) / 2;
  const centerCol = (state.dimensions.columns - 1) / 2;
  const distance =
    Math.abs(move.row - centerRow) * 1.3 + Math.abs(move.col - centerCol);
  return Math.max(0, 100 - distance * 16);
}
