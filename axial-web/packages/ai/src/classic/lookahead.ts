import { otherPlayer, type Player } from "@axial/core";
import {
  compareMoveIndicesByShape,
  countImmediateThreats,
  countLineCompletionThreats,
  evaluatePosition,
  findLineCompletionMoves,
  findForcingMoves,
  findWinningMoves,
  scoreLegalMoves,
} from "./heuristic";
import { type MoveIndex } from "./geometry";
import { ClassicSearchState } from "./state";

export type LookaheadOptions = {
  depth?: number;
  maxMoves?: number;
  rootMaxMoves?: number;
  nodeLimit?: number;
  maxTimeMs?: number;
};

export type LookaheadMoveScore = {
  moveIndex: MoveIndex;
  score: number;
  nodes: number;
  complete: boolean;
};

export type LookaheadMoveResult = {
  moveIndex: MoveIndex;
  score: number;
  depth: number;
  nodes: number;
  complete: boolean;
  candidates: LookaheadMoveScore[];
};

type SearchContext = {
  rootPlayer: Player;
  maxMoves: number;
  nodeLimit: number;
  nodes: number;
  deadlineAt: number | null;
};

type SearchResult = {
  score: number;
  complete: boolean;
};

const DEFAULT_LOOKAHEAD_DEPTH = 2;
const DEFAULT_MAX_MOVES = 12;
const DEFAULT_ROOT_MAX_MOVES = 18;
const DEFAULT_NODE_LIMIT = 12_000;
const TERMINAL_SCORE = 10_000_000;

export function selectLookaheadMove(
  state: ClassicSearchState,
  player: Player,
  options: LookaheadOptions = {},
): LookaheadMoveResult | null {
  if (state.winner !== null || state.isDraw()) return null;

  const depth = normalizedPositiveInteger(
    options.depth ?? DEFAULT_LOOKAHEAD_DEPTH,
  );
  if (depth <= 0) return null;
  if (options.maxTimeMs !== undefined && options.maxTimeMs <= 0) return null;

  const maxMoves = normalizedPositiveInteger(
    options.maxMoves ?? DEFAULT_MAX_MOVES,
  );
  const rootMaxMoves = normalizedPositiveInteger(
    options.rootMaxMoves ?? Math.max(DEFAULT_ROOT_MAX_MOVES, maxMoves),
  );
  const candidates = candidateMoves(state, player, Math.max(1, rootMaxMoves));
  if (candidates.length === 0) return null;

  const totalNodeLimit = Math.max(
    1,
    normalizedPositiveInteger(options.nodeLimit ?? DEFAULT_NODE_LIMIT),
  );
  const nodeLimitPerCandidate = Math.max(
    1,
    Math.floor(totalNodeLimit / candidates.length),
  );
  const start = performanceNow();
  const decisionDeadline =
    options.maxTimeMs === undefined
      ? null
      : start + Math.max(0, options.maxTimeMs);
  const scored: LookaheadMoveScore[] = [];
  let totalNodes = 0;
  for (let index = 0; index < candidates.length; index += 1) {
    if (
      decisionDeadline !== null &&
      performanceNow() >= decisionDeadline &&
      scored.length > 0
    ) {
      break;
    }

    const moveIndex = candidates[index]!;
    const remainingCandidates = candidates.length - index;
    const remainingTime =
      decisionDeadline === null
        ? null
        : Math.max(0, decisionDeadline - performanceNow());
    const context: SearchContext = {
      rootPlayer: player,
      maxMoves: Math.max(1, maxMoves),
      nodeLimit: nodeLimitPerCandidate,
      nodes: 0,
      deadlineAt:
        remainingTime === null
          ? null
          : performanceNow() + remainingTime / remainingCandidates,
    };

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

    totalNodes += context.nodes;
    scored.push({
      moveIndex,
      score: result.score,
      nodes: context.nodes,
      complete: result.complete,
    });
  }

  scored.sort((first, second) => {
    if (first.score !== second.score) return second.score - first.score;
    return compareMoveIndicesByShape(
      first.moveIndex,
      second.moveIndex,
      state.dimensions,
    );
  });

  const best = scored[0];
  if (!best) return null;

  return {
    ...best,
    depth,
    nodes: totalNodes,
    complete:
      scored.length === candidates.length &&
      scored.every((candidate) => candidate.complete),
    candidates: scored,
  };
}

export function evaluateLookaheadPosition(
  state: ClassicSearchState,
  player: Player,
  playerToMove: Player = player,
): number {
  const terminal = terminalScore(state, player, 0);
  if (terminal !== null) return terminal;

  const opponent = otherPlayer(player);
  const ownImmediateThreats = countImmediateThreats(state, player);
  const opponentImmediateThreats = countImmediateThreats(state, opponent);
  const ownForkMoves = countForkMoves(state, player);
  const opponentForkMoves = countForkMoves(state, opponent);
  const ownLineThreats = countLineCompletionThreats(state, player);
  const opponentLineThreats = countLineCompletionThreats(state, opponent);
  const ownLinesNeeded = Math.max(
    1,
    state.winCondition.linesToWin - state.completedLineCount(player),
  );
  const opponentLinesNeeded = Math.max(
    1,
    state.winCondition.linesToWin - state.completedLineCount(opponent),
  );

  let score = evaluatePosition(state, player);

  score += threatValue(ownImmediateThreats, playerToMove === player, false);
  score -= threatValue(
    opponentImmediateThreats,
    playerToMove === opponent,
    true,
  );

  score += ownForkMoves * (playerToMove === player ? 88_000 : 52_000);
  score -= opponentForkMoves * (playerToMove === opponent ? 112_000 : 68_000);

  if (state.winCondition.linesToWin > 1) {
    score += multiLineThreatValue(
      ownLineThreats,
      ownLinesNeeded,
      playerToMove === player,
      false,
    );
    score -= multiLineThreatValue(
      opponentLineThreats,
      opponentLinesNeeded,
      playerToMove === opponent,
      true,
    );
  }

  return score;
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
  context.nodes += 1;

  const terminal = terminalScore(state, context.rootPlayer, ply);
  if (terminal !== null) return { score: terminal, complete: true };

  if (depth <= 0) {
    return {
      score: evaluateLookaheadPosition(state, context.rootPlayer, playerToMove),
      complete: true,
    };
  }
  if (searchBudgetExhausted(context)) {
    return {
      score: evaluateLookaheadPosition(state, context.rootPlayer, playerToMove),
      complete: false,
    };
  }

  const moves = candidateMoves(state, playerToMove, context.maxMoves);
  if (moves.length === 0) {
    return {
      score: evaluateLookaheadPosition(state, context.rootPlayer, playerToMove),
      complete: true,
    };
  }

  if (playerToMove === context.rootPlayer) {
    let best = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < moves.length; index += 1) {
      const moveIndex = moves[index]!;
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

      best = Math.max(best, result.score);
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
      if (
        !result.complete ||
        (index < moves.length - 1 && searchBudgetExhausted(context))
      ) {
        return { score: best, complete: false };
      }
    }
    return { score: best, complete: true };
  }

  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < moves.length; index += 1) {
    const moveIndex = moves[index]!;
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

    best = Math.min(best, result.score);
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
    if (
      !result.complete ||
      (index < moves.length - 1 && searchBudgetExhausted(context))
    ) {
      return { score: best, complete: false };
    }
  }

  return { score: best, complete: true };
}

function terminalScore(
  state: ClassicSearchState,
  player: Player,
  ply: number,
): number | null {
  if (state.winner === player) return TERMINAL_SCORE - ply * 30_000;
  if (state.winner === otherPlayer(player))
    return -TERMINAL_SCORE + ply * 30_000;
  if (state.isDraw()) return 0;
  return null;
}

function candidateMoves(
  state: ClassicSearchState,
  player: Player,
  maxMoves: number,
): MoveIndex[] {
  const forced = criticalCandidateMoves(state, player);
  const seen = new Set<MoveIndex>();
  const moves: MoveIndex[] = [];

  for (const moveIndex of forced) {
    if (!state.isLegalMove(moveIndex) || seen.has(moveIndex)) continue;
    seen.add(moveIndex);
    moves.push(moveIndex);
  }

  const targetMoveCount = Math.max(maxMoves, moves.length);
  for (const scored of scoreLegalMoves(state, player)) {
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
    ...findForcingMoves(state, player)
      .filter((move) => move.kind === "fork")
      .map((move) => move.moveIndex),
    ...findForcingMoves(state, opponent)
      .filter((move) => move.kind === "fork")
      .map((move) => move.moveIndex),
  ].sort((first, second) =>
    compareMoveIndicesByShape(first, second, state.dimensions),
  );
}

function countForkMoves(state: ClassicSearchState, player: Player): number {
  return findForcingMoves(state, player).filter((move) => move.kind === "fork")
    .length;
}

function threatValue(
  threats: number,
  hasTempo: boolean,
  defensive: boolean,
): number {
  if (threats <= 0) return 0;

  const base = defensive ? 32_000 : 26_000;
  const tempo = hasTempo ? 5.6 : 1.35;
  const forkMultiplier = threats > 1 ? 1 + (threats - 1) * 2.4 : 1;

  return Math.round(threats * base * tempo * forkMultiplier);
}

function multiLineThreatValue(
  threats: number,
  linesNeeded: number,
  hasTempo: boolean,
  defensive: boolean,
): number {
  if (threats <= 0) return 0;

  const base = defensive ? 14_000 : 11_000;
  const tempo = hasTempo ? 1.75 : 1;
  const racePressure =
    threats >= linesNeeded ? 1.6 : 1 / Math.sqrt(linesNeeded);

  return Math.round(threats * base * tempo * racePressure);
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
