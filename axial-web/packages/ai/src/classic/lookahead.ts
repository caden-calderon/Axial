import { cellFromIndex, otherPlayer, type Player } from "@axial/core";
import { evaluateFastPosition, rankFastMoves } from "./fastEvaluation";
import {
  compareMoveIndicesByShape,
  countLineCompletionsForMove,
  findForcingMoves,
  findLineCompletionMoves,
  findWinningMoves,
} from "./heuristic";
import { cellToMoveIndex, type MoveIndex } from "./geometry";
import { ClassicSearchState } from "./state";

export type LookaheadOptions = {
  depth?: number;
  maxMoves?: number;
  rootMaxMoves?: number;
  nodeLimit?: number;
  maxTimeMs?: number;
  quiescenceDepth?: number;
};

export type LookaheadMoveScore = {
  moveIndex: MoveIndex;
  score: number;
  nodes: number;
  complete: boolean;
  completedDepth: number;
};

export type LookaheadMoveResult = {
  moveIndex: MoveIndex;
  score: number;
  depth: number;
  completedDepth: number;
  partialDepth: number;
  nodes: number;
  complete: boolean;
  transpositionHits: number;
  candidates: LookaheadMoveScore[];
};

type SearchContext = {
  rootPlayer: Player;
  maxMoves: number;
  nodeLimit: number;
  nodes: number;
  deadlineAt: number | null;
  quiescenceDepth: number;
  transpositions: Map<string, TranspositionEntry>;
  transpositionHits: number;
};

type SearchResult = {
  score: number;
  complete: boolean;
  cacheable: boolean;
};

type TranspositionEntry = {
  depth: number;
  score: number;
};

type CandidateProgress = {
  moveIndex: MoveIndex;
  score: number;
  nodes: number;
  completedDepth: number;
};

const DEFAULT_LOOKAHEAD_DEPTH = 2;
const DEFAULT_MAX_MOVES = 12;
const DEFAULT_ROOT_MAX_MOVES = 18;
const DEFAULT_NODE_LIMIT = 12_000;
const DEFAULT_QUIESCENCE_DEPTH = 2;
const QUIESCENCE_FORK_CANDIDATES = 10;
const TERMINAL_SCORE = 10_000_000;

export function selectLookaheadMove(
  state: ClassicSearchState,
  player: Player,
  options: LookaheadOptions = {},
): LookaheadMoveResult | null {
  if (state.winner !== null || state.isDraw()) return null;

  const requestedDepth = normalizedPositiveInteger(
    options.depth ?? DEFAULT_LOOKAHEAD_DEPTH,
  );
  if (requestedDepth <= 0) return null;
  if (options.maxTimeMs !== undefined && options.maxTimeMs <= 0) return null;

  const maxMoves = normalizedPositiveInteger(
    options.maxMoves ?? DEFAULT_MAX_MOVES,
  );
  const rootMaxMoves = normalizedPositiveInteger(
    options.rootMaxMoves ?? Math.max(DEFAULT_ROOT_MAX_MOVES, maxMoves),
  );
  const rootCandidates = candidateMoves(
    state,
    player,
    Math.max(1, rootMaxMoves),
    true,
  );
  if (rootCandidates.length === 0) return null;

  const startedAt = performanceNow();
  const context: SearchContext = {
    rootPlayer: player,
    maxMoves: Math.max(1, maxMoves),
    nodeLimit: Math.max(
      1,
      normalizedPositiveInteger(options.nodeLimit ?? DEFAULT_NODE_LIMIT),
    ),
    nodes: 0,
    deadlineAt:
      options.maxTimeMs === undefined
        ? null
        : startedAt + Math.max(0, options.maxTimeMs),
    quiescenceDepth: normalizedPositiveInteger(
      options.quiescenceDepth ?? DEFAULT_QUIESCENCE_DEPTH,
    ),
    transpositions: new Map(),
    transpositionHits: 0,
  };
  const progress = new Map<MoveIndex, CandidateProgress>();

  for (const moveIndex of rootCandidates) {
    state.makeMove(moveIndex, player);
    const score = evaluateFastPosition(state, player, otherPlayer(player));
    state.unmakeMove();
    progress.set(moveIndex, {
      moveIndex,
      score,
      nodes: 0,
      completedDepth: 0,
    });
  }

  let commonCompletedDepth = 0;
  let partialDepth = 0;

  for (let depth = 1; depth <= requestedDepth; depth += 1) {
    if (searchBudgetExhausted(context)) break;

    const iterationScores = new Map<MoveIndex, number>();
    let iterationComplete = true;
    partialDepth = depth;

    for (const moveIndex of rootCandidates) {
      if (searchBudgetExhausted(context)) {
        iterationComplete = false;
        break;
      }

      const beforeNodes = context.nodes;
      state.makeMove(moveIndex, player);
      const result = searchScore(
        state,
        otherPlayer(player),
        depth - 1,
        Number.NEGATIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        1,
        context,
      );
      state.unmakeMove();

      const candidate = progress.get(moveIndex)!;
      candidate.nodes += context.nodes - beforeNodes;
      if (!result.complete) {
        iterationComplete = false;
        break;
      }
      iterationScores.set(moveIndex, result.score);
    }

    if (!iterationComplete || iterationScores.size !== rootCandidates.length) {
      break;
    }

    commonCompletedDepth = depth;
    for (const moveIndex of rootCandidates) {
      const candidate = progress.get(moveIndex)!;
      candidate.score = iterationScores.get(moveIndex)!;
      candidate.completedDepth = depth;
    }
  }

  const candidates = [...progress.values()]
    .map((candidate) => ({
      ...candidate,
      complete: candidate.completedDepth >= requestedDepth,
    }))
    .sort((first, second) => {
      if (first.score !== second.score) return second.score - first.score;
      return compareMoveIndicesByShape(
        first.moveIndex,
        second.moveIndex,
        state.dimensions,
      );
    });
  const best = candidates[0];
  if (!best) return null;

  return {
    ...best,
    depth: requestedDepth,
    completedDepth: commonCompletedDepth,
    partialDepth,
    nodes: context.nodes,
    complete: commonCompletedDepth >= requestedDepth,
    transpositionHits: context.transpositionHits,
    candidates,
  };
}

export function evaluateLookaheadPosition(
  state: ClassicSearchState,
  player: Player,
  playerToMove: Player = player,
): number {
  const terminal = terminalScore(state, player, 0);
  return terminal ?? evaluateFastPosition(state, player, playerToMove);
}

function searchScore(
  state: ClassicSearchState,
  playerToMove: Player,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  context: SearchContext,
): SearchResult {
  if (searchBudgetExhausted(context)) {
    return {
      score: evaluateFastPosition(state, context.rootPlayer, playerToMove),
      complete: false,
      cacheable: false,
    };
  }
  context.nodes += 1;

  const terminal = terminalScore(state, context.rootPlayer, ply);
  if (terminal !== null) {
    return { score: terminal, complete: true, cacheable: true };
  }
  if (depth <= 0) {
    return quiescenceScore(
      state,
      playerToMove,
      alpha,
      beta,
      ply,
      context.quiescenceDepth,
      context,
    );
  }

  const key = state.positionKey(playerToMove);
  const cached = context.transpositions.get(key);
  if (cached && cached.depth >= depth) {
    context.transpositionHits += 1;
    return { score: cached.score, complete: true, cacheable: true };
  }

  const moves = candidateMoves(state, playerToMove, context.maxMoves, false);
  if (moves.length === 0) {
    return {
      score: evaluateFastPosition(state, context.rootPlayer, playerToMove),
      complete: true,
      cacheable: true,
    };
  }

  const maximizing = playerToMove === context.rootPlayer;
  let best = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  let cacheable = true;

  for (const moveIndex of moves) {
    state.makeMove(moveIndex, playerToMove);
    const result = searchScore(
      state,
      otherPlayer(playerToMove),
      depth - 1,
      alpha,
      beta,
      ply + 1,
      context,
    );
    state.unmakeMove();

    if (!result.complete) {
      return {
        score:
          best === Number.NEGATIVE_INFINITY || best === Number.POSITIVE_INFINITY
            ? result.score
            : best,
        complete: false,
        cacheable: false,
      };
    }

    if (maximizing) {
      best = Math.max(best, result.score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, result.score);
      beta = Math.min(beta, best);
    }

    if (alpha >= beta) {
      cacheable = false;
      break;
    }
    if (searchBudgetExhausted(context)) {
      return { score: best, complete: false, cacheable: false };
    }
  }

  if (cacheable) context.transpositions.set(key, { depth, score: best });
  return { score: best, complete: true, cacheable };
}

function quiescenceScore(
  state: ClassicSearchState,
  playerToMove: Player,
  alpha: number,
  beta: number,
  ply: number,
  depth: number,
  context: SearchContext,
): SearchResult {
  const standPat = evaluateFastPosition(
    state,
    context.rootPlayer,
    playerToMove,
  );
  if (depth <= 0 || searchBudgetExhausted(context)) {
    return {
      score: standPat,
      complete: !searchBudgetExhausted(context),
      cacheable: false,
    };
  }

  const wins = findFastWinningMoves(state, playerToMove);
  if (wins.length > 0) {
    state.makeMove(wins[0]!, playerToMove);
    const score = terminalScore(state, context.rootPlayer, ply + 1) ?? standPat;
    state.unmakeMove();
    return { score, complete: true, cacheable: false };
  }

  const opponent = otherPlayer(playerToMove);
  const opponentWins = findFastWinningMoves(state, opponent);
  if (opponentWins.length > 1) {
    const predictedWinner = opponent;
    return {
      score:
        predictedWinner === context.rootPlayer
          ? TERMINAL_SCORE - (ply + 2) * 30_000
          : -TERMINAL_SCORE + (ply + 2) * 30_000,
      complete: true,
      cacheable: false,
    };
  }
  if (opponentWins.length === 0) {
    return forcingQuiescenceScore(
      state,
      playerToMove,
      alpha,
      beta,
      ply,
      depth,
      standPat,
      context,
    );
  }

  const forcedBlock = opponentWins[0]!;
  state.makeMove(forcedBlock, playerToMove);
  const result = quiescenceScore(
    state,
    opponent,
    alpha,
    beta,
    ply + 1,
    depth - 1,
    context,
  );
  state.unmakeMove();
  return { ...result, cacheable: false };
}

function forcingQuiescenceScore(
  state: ClassicSearchState,
  playerToMove: Player,
  alpha: number,
  beta: number,
  ply: number,
  depth: number,
  standPat: number,
  context: SearchContext,
): SearchResult {
  const ownForks = findFastForkMoves(state, playerToMove);
  if (ownForks.length > 0) {
    return searchQuiescenceMoves(
      state,
      playerToMove,
      ownForks,
      alpha,
      beta,
      ply,
      depth,
      context,
    );
  }

  const opponent = otherPlayer(playerToMove);
  const opponentForks = findFastForkMoves(state, opponent);
  if (opponentForks.length === 0) {
    return { score: standPat, complete: true, cacheable: false };
  }

  const defensiveCandidates = uniqueMoves([...opponentForks]);
  const neutralizingMoves: MoveIndex[] = [];
  for (const moveIndex of defensiveCandidates) {
    if (searchBudgetExhausted(context)) {
      return { score: standPat, complete: false, cacheable: false };
    }

    state.makeMove(moveIndex, playerToMove);
    const remainingForks = findFastForkMoves(state, opponent);
    state.unmakeMove();
    if (remainingForks.length === 0) neutralizingMoves.push(moveIndex);
  }

  if (neutralizingMoves.length === 0) {
    return {
      score:
        opponent === context.rootPlayer
          ? TERMINAL_SCORE - (ply + 3) * 30_000
          : -TERMINAL_SCORE + (ply + 3) * 30_000,
      complete: true,
      cacheable: false,
    };
  }

  return searchQuiescenceMoves(
    state,
    playerToMove,
    neutralizingMoves,
    alpha,
    beta,
    ply,
    depth,
    context,
  );
}

function searchQuiescenceMoves(
  state: ClassicSearchState,
  playerToMove: Player,
  moves: readonly MoveIndex[],
  alpha: number,
  beta: number,
  ply: number,
  depth: number,
  context: SearchContext,
): SearchResult {
  const maximizing = playerToMove === context.rootPlayer;
  let best = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;

  for (const moveIndex of moves) {
    if (searchBudgetExhausted(context)) {
      return {
        score: Number.isFinite(best)
          ? best
          : evaluateFastPosition(state, context.rootPlayer, playerToMove),
        complete: false,
        cacheable: false,
      };
    }

    state.makeMove(moveIndex, playerToMove);
    const result = quiescenceScore(
      state,
      otherPlayer(playerToMove),
      alpha,
      beta,
      ply + 1,
      depth - 1,
      context,
    );
    state.unmakeMove();
    if (!result.complete) return result;

    if (maximizing) {
      best = Math.max(best, result.score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, result.score);
      beta = Math.min(beta, best);
    }
    if (alpha >= beta) break;
  }

  return { score: best, complete: true, cacheable: false };
}

function findFastForkMoves(
  state: ClassicSearchState,
  player: Player,
): MoveIndex[] {
  const forks: MoveIndex[] = [];
  const candidates = rankFastForkCandidates(state, player).slice(
    0,
    QUIESCENCE_FORK_CANDIDATES,
  );

  for (const moveIndex of candidates) {
    state.makeMove(moveIndex, player);
    const createsFork =
      state.winner === null && findFastWinningMoves(state, player).length >= 2;
    state.unmakeMove();
    if (createsFork) forks.push(moveIndex);
  }

  return forks;
}

function rankFastForkCandidates(
  state: ClassicSearchState,
  player: Player,
): MoveIndex[] {
  const playerCounts =
    player === 1 ? state.playerOneCounts : state.playerTwoCounts;
  const opponentCounts =
    player === 1 ? state.playerTwoCounts : state.playerOneCounts;
  const lineLength = state.winCondition.lineLength;

  return state
    .legalMoveIndices()
    .map((moveIndex) => {
      const cellIndex = state.dropCellIndex(moveIndex);
      let score = 0;

      for (const segmentId of state.segmentTable.cellSegments[cellIndex]) {
        if (
          state.blockedCounts[segmentId] > 0 ||
          opponentCounts[segmentId] > 0
        ) {
          continue;
        }
        const count = playerCounts[segmentId];
        if (count >= lineLength - 2) score += 100 + count * count * 20;
      }

      const { height } = cellFromIndex(cellIndex, state.dimensions);
      if (height + 1 < state.dimensions.height) {
        const supportedCell = cellIndex + 1;
        for (const segmentId of state.segmentTable.cellSegments[
          supportedCell
        ]) {
          if (
            state.blockedCounts[segmentId] === 0 &&
            opponentCounts[segmentId] === 0 &&
            playerCounts[segmentId] === lineLength - 1
          ) {
            score += 500;
          }
        }
      }

      return { moveIndex, score };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((first, second) => {
      if (first.score !== second.score) return second.score - first.score;
      return compareMoveIndicesByShape(
        first.moveIndex,
        second.moveIndex,
        state.dimensions,
      );
    })
    .map((candidate) => candidate.moveIndex);
}

function findFastWinningMoves(
  state: ClassicSearchState,
  player: Player,
): MoveIndex[] {
  if (state.winner !== null) return [];

  const playerCounts =
    player === 1 ? state.playerOneCounts : state.playerTwoCounts;
  const opponentCounts =
    player === 1 ? state.playerTwoCounts : state.playerOneCounts;
  const completionCells = new Set<number>();

  for (const segment of state.segmentTable.segments) {
    if (
      state.blockedCounts[segment.id] > 0 ||
      opponentCounts[segment.id] > 0 ||
      playerCounts[segment.id] !== state.winCondition.lineLength - 1
    ) {
      continue;
    }

    const cellIndex = segment.cells.find((cell) => state.isPlayableCell(cell));
    if (cellIndex !== undefined) completionCells.add(cellIndex);
  }

  const linesNeeded = Math.max(
    1,
    state.winCondition.linesToWin - state.completedLineCount(player),
  );
  const wins: MoveIndex[] = [];
  for (const cellIndex of completionCells) {
    const moveIndex = cellToMoveIndex(cellIndex, state.dimensions);
    if (countLineCompletionsForMove(state, moveIndex, player) >= linesNeeded) {
      wins.push(moveIndex);
    }
  }

  return wins.sort((first, second) =>
    compareMoveIndicesByShape(first, second, state.dimensions),
  );
}

function uniqueMoves(moves: readonly MoveIndex[]): MoveIndex[] {
  return [...new Set(moves)];
}

function terminalScore(
  state: ClassicSearchState,
  player: Player,
  ply: number,
): number | null {
  if (state.winner === player) return TERMINAL_SCORE - ply * 30_000;
  if (state.winner === otherPlayer(player)) {
    return -TERMINAL_SCORE + ply * 30_000;
  }
  if (state.isDraw()) return 0;
  return null;
}

function candidateMoves(
  state: ClassicSearchState,
  player: Player,
  maxMoves: number,
  includeForks: boolean,
): MoveIndex[] {
  const forced = criticalCandidateMoves(state, player, includeForks);
  const seen = new Set<MoveIndex>();
  const moves: MoveIndex[] = [];

  for (const moveIndex of forced) {
    if (!state.isLegalMove(moveIndex) || seen.has(moveIndex)) continue;
    seen.add(moveIndex);
    moves.push(moveIndex);
  }

  const targetMoveCount = Math.max(maxMoves, moves.length);
  for (const scored of rankFastMoves(state, player)) {
    if (moves.length >= targetMoveCount) break;
    if (seen.has(scored.moveIndex)) continue;
    seen.add(scored.moveIndex);
    moves.push(scored.moveIndex);
  }

  return moves;
}

function criticalCandidateMoves(
  state: ClassicSearchState,
  player: Player,
  includeForks: boolean,
): MoveIndex[] {
  const opponent = otherPlayer(player);
  const wins = findWinningMoves(state, player);
  if (wins.length > 0) return wins;

  const blocks = findWinningMoves(state, opponent);
  if (blocks.length > 0) return blocks;

  return [
    ...(state.winCondition.linesToWin > 1
      ? findLineCompletionMoves(state, player).map((move) => move.moveIndex)
      : []),
    ...(state.winCondition.linesToWin > 1
      ? findLineCompletionMoves(state, opponent).map((move) => move.moveIndex)
      : []),
    ...(includeForks
      ? findForcingMoves(state, player).map((move) => move.moveIndex)
      : findFastForkMoves(state, player)),
    ...(includeForks
      ? findForcingMoves(state, opponent).map((move) => move.moveIndex)
      : findFastForkMoves(state, opponent)),
  ].sort((first, second) =>
    compareMoveIndicesByShape(first, second, state.dimensions),
  );
}

function normalizedPositiveInteger(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function searchBudgetExhausted(context: SearchContext): boolean {
  return (
    context.nodes >= context.nodeLimit ||
    (context.deadlineAt !== null && performanceNow() >= context.deadlineAt)
  );
}

function performanceNow(): number {
  return globalThis.performance?.now() ?? Date.now();
}
