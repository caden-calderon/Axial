import {
  DEFAULT_BOARD_DIMENSIONS,
  cellFromIndex,
  otherPlayer,
  type BoardDimensions,
  type GameSnapshot,
  type Move,
  type Player,
} from "@axial/core";
import { ClassicSearchState } from "./state";
import { moveFromIndex, type MoveIndex } from "./geometry";

export type MoveScore = {
  moveIndex: MoveIndex;
  score: number;
  reason: "win" | "block" | "forcing" | "block-forcing" | "heuristic";
  ownThreats: number;
  opponentThreats: number;
};

export type HeuristicMoveResult = {
  move: Move;
  moveIndex: MoveIndex;
  score: number;
  reason: MoveScore["reason"];
  candidates: MoveScore[];
};

export type ForcingMove = {
  moveIndex: MoveIndex;
  threats: number;
  immediateThreats: number;
  lineThreats: number;
  kind: "fork" | "line-race";
};

export type TacticalMoveMode = "forced-only" | "include-line-races";

const WIN_SCORE = 1_000_000;
const BLOCK_SCORE = 800_000;
const FORCING_SCORE = 180_000;
const BLOCK_FORCING_SCORE = 120_000;

export function chooseHeuristicMove(game: GameSnapshot): Move | null {
  return analyzeHeuristicMove(game)?.move ?? null;
}

export function analyzeHeuristicMove(
  game: GameSnapshot,
): HeuristicMoveResult | null {
  if (game.status.state !== "playing") return null;

  const state = ClassicSearchState.fromGame(game);
  const result = selectHeuristicMove(state, game.currentPlayer);
  if (!result) return null;

  return {
    ...result,
    move: publicMoveFromIndex(result.moveIndex, state.dimensions),
  };
}

export function selectHeuristicMove(
  state: ClassicSearchState,
  player: Player,
): Omit<HeuristicMoveResult, "move"> | null {
  if (state.winner !== null) return null;

  const legalMoves = state.legalMoveIndices();
  if (legalMoves.length === 0) return null;

  const tactical = selectTacticalMove(state, player, "include-line-races");
  if (tactical) return tactical;

  const candidates = scoreLegalMoves(state, player);
  const best = candidates[0];
  if (!best) return null;

  return {
    moveIndex: best.moveIndex,
    score: best.score,
    reason: best.reason,
    candidates,
  };
}

export function selectTacticalMove(
  state: ClassicSearchState,
  player: Player,
  mode: TacticalMoveMode = "include-line-races",
): Omit<HeuristicMoveResult, "move"> | null {
  const opponent = otherPlayer(player);
  const immediateWins = findWinningMoves(state, player);
  if (immediateWins.length > 0) {
    return scoredResult(state, player, immediateWins, "win", WIN_SCORE);
  }

  const immediateBlocks = findWinningMoves(state, opponent);
  if (immediateBlocks.length > 0) {
    return scoredResult(state, player, immediateBlocks, "block", BLOCK_SCORE);
  }

  const forcingMoves = tacticalForcingMoves(state, player, mode);
  if (forcingMoves.length > 0) {
    return scoredResult(
      state,
      player,
      forcingMoves.map((move) => move.moveIndex),
      "forcing",
      FORCING_SCORE,
    );
  }

  const opponentForcingMoves = tacticalForcingMoves(state, opponent, mode);
  if (opponentForcingMoves.length > 0) {
    return scoredResult(
      state,
      player,
      opponentForcingMoves.map((move) => move.moveIndex),
      "block-forcing",
      BLOCK_FORCING_SCORE,
    );
  }

  return null;
}

export function scoreLegalMoves(
  state: ClassicSearchState,
  player: Player,
): MoveScore[] {
  return state
    .legalMoveIndices()
    .map((moveIndex) => scoreMove(state, moveIndex, player))
    .sort((first, second) =>
      compareMoveScores(first, second, state.dimensions),
    );
}

export function scoreMove(
  state: ClassicSearchState,
  moveIndex: MoveIndex,
  player: Player,
): MoveScore {
  const opponent = otherPlayer(player);
  const ownLineCompletions = countLineCompletionsForMove(
    state,
    moveIndex,
    player,
  );
  const blockedOpponentLineCompletions = countLineCompletionsForMove(
    state,
    moveIndex,
    opponent,
  );
  const ownImmediateBlockValue = wouldWin(state, moveIndex, opponent)
    ? BLOCK_SCORE / 4
    : 0;

  state.makeMove(moveIndex, player);
  const ownThreats = countImmediateThreats(state, player);
  const opponentThreats = countImmediateThreats(state, opponent);
  const ownLineThreats = countLineCompletionThreats(state, player);
  const opponentLineThreats = countLineCompletionThreats(state, opponent);
  const ownForkPressure = Math.max(0, ownThreats - 1);
  const opponentForkDanger = Math.max(0, opponentThreats - 1);
  const score =
    evaluatePosition(state, player) +
    lineCompletionScore(state, player, ownLineCompletions, false) +
    lineCompletionScore(state, opponent, blockedOpponentLineCompletions, true) +
    ownImmediateBlockValue +
    ownThreats * 1_700 +
    ownForkPressure * 8_500 -
    opponentThreats * 11_000 -
    opponentForkDanger * 9_500 +
    ownLineThreats * lineThreatScore(state, player, false) * 1.25 -
    opponentLineThreats * lineThreatScore(state, opponent, true) * 1.5 +
    centerScoreForLastMove(state);
  state.unmakeMove();

  return {
    moveIndex,
    score,
    reason: "heuristic",
    ownThreats,
    opponentThreats,
  };
}

export function evaluatePosition(
  state: ClassicSearchState,
  player: Player,
): number {
  const opponent = otherPlayer(player);

  if (state.winner === player) return WIN_SCORE;
  if (state.winner === opponent) return -WIN_SCORE;

  const ownCounts =
    player === 1 ? state.playerOneCounts : state.playerTwoCounts;
  const opponentCounts =
    player === 1 ? state.playerTwoCounts : state.playerOneCounts;

  let score =
    state.completedLineCount(player) *
      completedLineValue(state, player, false) -
    state.completedLineCount(opponent) *
      completedLineValue(state, opponent, true);

  for (const segment of state.segmentTable.segments) {
    const own = ownCounts[segment.id];
    const opp = opponentCounts[segment.id];
    const blocked = state.blockedCounts[segment.id];
    if (blocked > 0 || (own > 0 && opp > 0)) continue;

    if (own > 0) {
      score += segmentScore(own, state.winCondition.lineLength, false);
      if (
        own === state.winCondition.lineLength - 1 &&
        segmentHasPlayableEmpty(state, segment.id)
      ) {
        score += 950;
      }
    } else if (opp > 0) {
      score -= segmentScore(opp, state.winCondition.lineLength, true);
      if (
        opp === state.winCondition.lineLength - 1 &&
        segmentHasPlayableEmpty(state, segment.id)
      ) {
        score -= 1_150;
      }
    }
  }

  for (let cellIndex = 0; cellIndex < state.board.length; cellIndex += 1) {
    const cell = state.board[cellIndex];
    if (cell !== 1 && cell !== 2) continue;

    const pieceScore = centerScoreForCell(state, cellIndex);
    score += cell === player ? pieceScore : -pieceScore;
  }

  return score;
}

export function findWinningMoves(
  state: ClassicSearchState,
  player: Player,
): MoveIndex[] {
  const wins: MoveIndex[] = [];

  for (const moveIndex of state.legalMoveIndices()) {
    if (wouldWin(state, moveIndex, player)) wins.push(moveIndex);
  }

  return wins.sort((first, second) =>
    compareMoveIndicesByShape(first, second, state.dimensions),
  );
}

export function findForcingMoves(
  state: ClassicSearchState,
  player: Player,
): ForcingMove[] {
  const forcing: ForcingMove[] = [];

  for (const moveIndex of state.legalMoveIndices()) {
    state.makeMove(moveIndex, player);
    const immediateThreats = countImmediateThreats(state, player);
    const lineThreats = countLineCompletionThreats(state, player);
    const linesNeeded = Math.max(
      1,
      state.winCondition.linesToWin - state.completedLineCount(player),
    );
    state.unmakeMove();

    const createsFork = immediateThreats >= 2;
    const createsLineRace =
      state.winCondition.linesToWin > 1 && lineThreats >= linesNeeded + 1;

    if (createsFork || createsLineRace) {
      forcing.push({
        moveIndex,
        threats: Math.max(immediateThreats, lineThreats),
        immediateThreats,
        lineThreats,
        kind: createsFork ? "fork" : "line-race",
      });
    }
  }

  return forcing.sort((first, second) => {
    if (first.kind !== second.kind) return first.kind === "fork" ? -1 : 1;
    if (first.threats !== second.threats) return second.threats - first.threats;
    if (first.immediateThreats !== second.immediateThreats) {
      return second.immediateThreats - first.immediateThreats;
    }
    if (first.lineThreats !== second.lineThreats) {
      return second.lineThreats - first.lineThreats;
    }
    return compareMoveIndicesByShape(
      first.moveIndex,
      second.moveIndex,
      state.dimensions,
    );
  });
}

function tacticalForcingMoves(
  state: ClassicSearchState,
  player: Player,
  mode: TacticalMoveMode,
): ForcingMove[] {
  const moves = findForcingMoves(state, player);
  if (mode === "include-line-races") return moves;

  return moves.filter((move) => move.kind === "fork");
}

export function countImmediateThreats(
  state: ClassicSearchState,
  player: Player,
): number {
  let threats = 0;

  for (const moveIndex of state.legalMoveIndices()) {
    if (wouldWin(state, moveIndex, player)) threats += 1;
  }

  return threats;
}

export function countLineCompletionThreats(
  state: ClassicSearchState,
  player: Player,
): number {
  let threats = 0;

  for (const moveIndex of state.legalMoveIndices()) {
    const completions = countLineCompletionsForMove(state, moveIndex, player);
    if (completions > 0) threats += completions;
  }

  return threats;
}

export function countLineCompletionsForMove(
  state: ClassicSearchState,
  moveIndex: MoveIndex,
  player: Player,
): number {
  const before = state.completedLineCount(player);
  state.makeMove(moveIndex, player);
  const after = state.completedLineCount(player);
  state.unmakeMove();

  return Math.max(0, after - before);
}

export function compareMoveScores(
  first: MoveScore,
  second: MoveScore,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): number {
  if (first.score !== second.score) return second.score - first.score;
  return compareMoveIndicesByShape(
    first.moveIndex,
    second.moveIndex,
    dimensions,
  );
}

export function compareMoveIndicesByShape(
  firstIndex: MoveIndex,
  secondIndex: MoveIndex,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): number {
  const firstCenter = planarCenterDistance(firstIndex, dimensions);
  const secondCenter = planarCenterDistance(secondIndex, dimensions);
  if (firstCenter !== secondCenter) return firstCenter - secondCenter;
  return firstIndex - secondIndex;
}

function scoredResult(
  state: ClassicSearchState,
  player: Player,
  moveIndices: MoveIndex[],
  reason: MoveScore["reason"],
  baseScore: number,
): Omit<HeuristicMoveResult, "move"> {
  const forcedScores = moveIndices.map((moveIndex) => {
    const scored = scoreMove(state, moveIndex, player);
    return {
      ...scored,
      reason,
      score: baseScore + scored.score,
    };
  });
  const candidates = [
    ...forcedScores,
    ...scoreLegalMoves(state, player).filter(
      (candidate) => !moveIndices.includes(candidate.moveIndex),
    ),
  ].sort((first, second) => compareMoveScores(first, second, state.dimensions));
  const best = candidates[0];

  return {
    moveIndex: best.moveIndex,
    score: best.score,
    reason: best.reason,
    candidates,
  };
}

function wouldWin(
  state: ClassicSearchState,
  moveIndex: MoveIndex,
  player: Player,
): boolean {
  const completedByMove = countLineCompletionsForMove(state, moveIndex, player);

  return (
    state.completedLineCount(player) + completedByMove >=
    state.winCondition.linesToWin
  );
}

function segmentHasPlayableEmpty(
  state: ClassicSearchState,
  segmentId: number,
): boolean {
  const segment = state.segmentTable.segments[segmentId];
  return segment.cells.some((cell) => state.isPlayableCell(cell));
}

function segmentScore(
  count: number,
  lineLength: number,
  defensive: boolean,
): number {
  if (count >= lineLength) return WIN_SCORE;

  const remaining = lineLength - count;
  const base = defensive ? 3 : 2;
  const urgency = defensive ? 1.18 : 1;
  return Math.round(
    Math.pow(base + count, count) * 8 * urgency * (6 - remaining),
  );
}

function completedLineValue(
  state: ClassicSearchState,
  player: Player,
  defensive: boolean,
): number {
  const completed = state.completedLineCount(player);
  const remaining = Math.max(1, state.winCondition.linesToWin - completed);
  const base = state.winCondition.linesToWin > 1 ? 34_000 : 18_000;
  const urgency = defensive ? 1.28 : 1;
  const closeness = 1 + (state.winCondition.linesToWin - remaining) * 0.32;

  return Math.round(base * urgency * closeness);
}

function lineCompletionScore(
  state: ClassicSearchState,
  player: Player,
  completions: number,
  defensive: boolean,
): number {
  if (completions <= 0) return 0;

  const completed = state.completedLineCount(player);
  const remaining = Math.max(1, state.winCondition.linesToWin - completed);
  const base = state.winCondition.linesToWin > 1 ? 48_000 : 12_000;
  const urgency = defensive ? 1.2 : 1;
  const closeness = remaining <= 1 ? 1.45 : 1 + (1 / remaining) * 0.35;
  const forkBonus = completions > 1 ? 1 + (completions - 1) * 0.42 : 1;

  return Math.round(completions * base * urgency * closeness * forkBonus);
}

function lineThreatScore(
  state: ClassicSearchState,
  player: Player,
  defensive: boolean,
): number {
  const completed = state.completedLineCount(player);
  const remaining = Math.max(1, state.winCondition.linesToWin - completed);
  const base = state.winCondition.linesToWin > 1 ? 2_600 : 800;
  const urgency = defensive ? 1.18 : 1;

  return Math.round((base * urgency) / Math.sqrt(remaining));
}

function centerScoreForLastMove(state: ClassicSearchState): number {
  const lastMove = state.moveStack.at(-1);
  return lastMove ? centerScoreForCell(state, lastMove.cellIndex) * 3 : 0;
}

function centerScoreForCell(
  state: ClassicSearchState,
  cellIndex: number,
): number {
  const { height, row, col } = cellFromIndex(cellIndex, state.dimensions);
  const centerHeight = (state.dimensions.height - 1) / 2;
  const centerRow = (state.dimensions.rows - 1) / 2;
  const centerCol = (state.dimensions.columns - 1) / 2;
  const distance =
    Math.abs(row - centerRow) * 1.35 +
    Math.abs(col - centerCol) * 1.15 +
    Math.abs(height - centerHeight) * 0.2;

  return Math.max(0, 10 - distance * 2);
}

function planarCenterDistance(
  moveIndex: MoveIndex,
  dimensions: BoardDimensions,
): number {
  const move = moveFromIndex(moveIndex, dimensions);
  const centerRow = (dimensions.rows - 1) / 2;
  const centerCol = (dimensions.columns - 1) / 2;
  return Math.abs(move.row - centerRow) + Math.abs(move.col - centerCol);
}

function publicMoveFromIndex(
  moveIndex: MoveIndex,
  dimensions: BoardDimensions,
): Move {
  const move = moveFromIndex(moveIndex, dimensions);
  return { row: move.row, col: move.col };
}
