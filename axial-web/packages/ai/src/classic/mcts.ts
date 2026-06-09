import {
  type BoardDimensions,
  otherPlayer,
  type GameSnapshot,
  type Move,
  type Player,
} from "@axial/core";
import { createSeededRandom, randomIndex, type RandomSource } from "../random";
import {
  compareMoveIndicesByShape,
  countLineCompletionsForMove,
  findWinningMoves,
  selectHeuristicMove,
  selectTacticalMove,
} from "./heuristic";
import { moveFromIndex, type MoveIndex } from "./geometry";
import { selectLookaheadMove, type LookaheadMoveResult } from "./lookahead";
import { ClassicSearchState } from "./state";

export type MctsOptions = {
  simulations?: number;
  maxTimeMs?: number;
  exploration?: number;
  progressiveBias?: number;
  lookaheadDepth?: number;
  lookaheadMaxMoves?: number;
  lookaheadRootMaxMoves?: number;
  lookaheadNodeLimit?: number;
  lookaheadWeight?: number;
  lookaheadOverrideMargin?: number;
  seed?: number;
  smartRolloutRate?: number;
  earlyExitVisits?: number;
  earlyExitRatio?: number;
  useRave?: boolean;
};

export type MctsMoveStat = {
  move: Move;
  moveIndex: MoveIndex;
  visits: number;
  winRate: number;
  value: number;
};

export type MctsMoveResult = {
  move: Move;
  moveIndex: MoveIndex;
  simulations: number;
  elapsedMs: number;
  reason: "tactical" | "lookahead" | "search" | "heuristic";
  stats: MctsMoveStat[];
};

type RaveStat = {
  visits: number;
  value: number;
};

type RolloutResult = {
  winner: Player | 0;
  moves: PlayedMove[];
};

type PlayedMove = {
  player: Player;
  moveIndex: MoveIndex;
};

type RankedMove = {
  moveIndex: MoveIndex;
  score: number;
  prior: number;
};

const DEFAULT_SIMULATIONS = 300;
const DEFAULT_EXPLORATION = Math.SQRT2;
const DEFAULT_PROGRESSIVE_BIAS = 0.18;
const DEFAULT_LOOKAHEAD_WEIGHT = 0.32;
const LOOKAHEAD_PRIOR_SCALE = 160_000;
const DEFAULT_SMART_ROLLOUT_RATE = 0.72;
const DEFAULT_EARLY_EXIT_VISITS = 160;
const DEFAULT_EARLY_EXIT_RATIO = 0.86;
const RAVE_K = 500;

export function chooseMctsMove(
  game: GameSnapshot,
  options: MctsOptions = {},
): Move | null {
  return analyzeMctsMove(game, options)?.move ?? null;
}

export function analyzeMctsMove(
  game: GameSnapshot,
  options: MctsOptions = {},
): MctsMoveResult | null {
  if (game.status.state !== "playing") return null;

  const rootState = ClassicSearchState.fromGame(game);
  if (rootState.winner !== null) return null;

  const criticalTactical = selectTacticalMove(
    rootState,
    game.currentPlayer,
    "forced-only",
  );
  if (criticalTactical) {
    return {
      move: publicMoveFromIndex(
        criticalTactical.moveIndex,
        rootState.dimensions,
      ),
      moveIndex: criticalTactical.moveIndex,
      simulations: 0,
      elapsedMs: 0,
      reason: "tactical",
      stats: criticalTactical.candidates.map((candidate) => ({
        move: publicMoveFromIndex(candidate.moveIndex, rootState.dimensions),
        moveIndex: candidate.moveIndex,
        visits: 0,
        winRate: 0,
        value: candidate.score,
      })),
    };
  }

  const tactical = selectHeuristicMove(rootState, game.currentPlayer);
  if (!tactical) return null;

  const lookahead = selectRootLookahead(rootState, game.currentPlayer, options);
  const random = createSeededRandom(options.seed ?? 0xa71a1);
  const search = new MctsSearch(
    rootState,
    game.currentPlayer,
    random,
    options,
    lookahead,
  );
  return search.run(lookahead?.moveIndex ?? tactical.moveIndex);
}

class MctsNode {
  readonly children = new Map<MoveIndex, MctsNode>();
  readonly rave = new Map<MoveIndex, RaveStat>();
  readonly movePriors = new Map<MoveIndex, number>();
  readonly untriedMoves: MoveIndex[];
  visits = 0;
  value = 0;

  constructor(
    readonly parent: MctsNode | null,
    readonly moveIndex: MoveIndex | null,
    readonly playerJustMoved: Player,
    readonly depth: number,
    rankedMoves: readonly RankedMove[],
  ) {
    this.untriedMoves = rankedMoves.map((move) => move.moveIndex);
    for (const move of rankedMoves) {
      this.movePriors.set(move.moveIndex, move.prior);
    }
  }
}

class MctsSearch {
  private readonly root: MctsNode;
  private simulations = 0;

  constructor(
    private readonly rootState: ClassicSearchState,
    private readonly rootPlayer: Player,
    private readonly random: RandomSource,
    private readonly options: MctsOptions,
    private readonly rootLookahead: LookaheadMoveResult | null,
  ) {
    this.root = new MctsNode(
      null,
      null,
      otherPlayer(rootPlayer),
      0,
      rankedMoves(
        rootState,
        rootPlayer,
        rootLookahead,
        options.lookaheadWeight ?? DEFAULT_LOOKAHEAD_WEIGHT,
      ),
    );
  }

  run(fallbackMoveIndex: MoveIndex): MctsMoveResult {
    const start = performanceNow();
    const maxSimulations = this.options.simulations ?? DEFAULT_SIMULATIONS;
    const maxTimeMs = this.options.maxTimeMs;

    while (this.shouldContinue(start, maxSimulations, maxTimeMs)) {
      this.runSimulation();
      this.simulations += 1;

      if (this.shouldExitEarly()) break;
    }

    const elapsedMs = performanceNow() - start;
    const stats = this.rootStats();
    const selected = this.selectRootMove(stats);

    if (!selected) {
      return {
        move: publicMoveFromIndex(fallbackMoveIndex, this.rootState.dimensions),
        moveIndex: fallbackMoveIndex,
        simulations: this.simulations,
        elapsedMs,
        reason: "heuristic",
        stats,
      };
    }

    return {
      move: selected.stat.move,
      moveIndex: selected.stat.moveIndex,
      simulations: this.simulations,
      elapsedMs,
      reason: selected.reason,
      stats,
    };
  }

  private runSimulation(): void {
    const state = this.rootState.clone();
    const playedMoves: PlayedMove[] = [];
    let node = this.root;

    while (
      node.untriedMoves.length === 0 &&
      node.children.size > 0 &&
      state.winner === null &&
      !state.isDraw()
    ) {
      node = this.selectChild(node);
      state.makeMove(node.moveIndex!, node.playerJustMoved);
      playedMoves.push({
        player: node.playerJustMoved,
        moveIndex: node.moveIndex!,
      });
    }

    if (
      node.untriedMoves.length > 0 &&
      state.winner === null &&
      !state.isDraw()
    ) {
      const moveIndex = node.untriedMoves.shift()!;
      const player = otherPlayer(node.playerJustMoved);
      state.makeMove(moveIndex, player);
      playedMoves.push({ player, moveIndex });

      const child = new MctsNode(
        node,
        moveIndex,
        player,
        node.depth + 1,
        state.winner === null && !state.isDraw()
          ? rankedMoves(state, otherPlayer(player))
          : [],
      );
      node.children.set(moveIndex, child);
      node = child;
    }

    const rollout = rolloutFrom(
      state,
      node.playerJustMoved,
      this.random,
      this.options.smartRolloutRate ?? DEFAULT_SMART_ROLLOUT_RATE,
    );
    playedMoves.push(...rollout.moves);
    this.backpropagate(node, rollout.winner, playedMoves);
  }

  private selectChild(node: MctsNode): MctsNode {
    let bestChild: MctsNode | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    const exploration = this.options.exploration ?? DEFAULT_EXPLORATION;
    const useRave = this.options.useRave ?? true;
    const parentVisits = Math.max(1, node.visits);

    for (const child of node.children.values()) {
      if (child.visits === 0) return child;

      let valueEstimate = child.value / child.visits;
      const explorationScore =
        exploration * Math.sqrt(Math.log(parentVisits) / child.visits);
      let score = valueEstimate + explorationScore;
      const progressiveBias =
        this.options.progressiveBias ?? DEFAULT_PROGRESSIVE_BIAS;

      if (useRave && child.moveIndex !== null) {
        const rave = node.rave.get(child.moveIndex);
        if (rave && rave.visits > 0) {
          const beta =
            rave.visits /
            (child.visits +
              rave.visits +
              (4 * child.visits * rave.visits) / RAVE_K);
          valueEstimate =
            (1 - beta) * valueEstimate + beta * (rave.value / rave.visits);
          score = valueEstimate + explorationScore;
        }
      }

      if (progressiveBias > 0 && child.moveIndex !== null) {
        const prior = node.movePriors.get(child.moveIndex) ?? 0;
        score += (progressiveBias * prior) / (child.visits + 1);
      }

      if (
        score > bestScore ||
        (score === bestScore &&
          bestChild !== null &&
          bestChild.moveIndex !== null &&
          child.moveIndex !== null &&
          compareMoveIndicesByShape(
            child.moveIndex,
            bestChild.moveIndex,
            this.rootState.dimensions,
          ) < 0)
      ) {
        bestScore = score;
        bestChild = child;
      }
    }

    if (!bestChild) throw new Error("Cannot select from an empty MCTS node");
    return bestChild;
  }

  private backpropagate(
    node: MctsNode | null,
    winner: Player | 0,
    playedMoves: readonly PlayedMove[],
  ): void {
    while (node) {
      node.visits += 1;
      node.value += resultValue(winner, node.playerJustMoved);

      const playerToMove = otherPlayer(node.playerJustMoved);
      const raveValue = resultValue(winner, playerToMove);
      const futureSeen = new Set<MoveIndex>();

      for (let index = node.depth; index < playedMoves.length; index += 1) {
        const move = playedMoves[index]!;
        if (move.player !== playerToMove || futureSeen.has(move.moveIndex)) {
          continue;
        }
        futureSeen.add(move.moveIndex);

        const moveIndex = move.moveIndex;
        const stat = node.rave.get(moveIndex) ?? { visits: 0, value: 0 };
        stat.visits += 1;
        stat.value += raveValue;
        node.rave.set(moveIndex, stat);
      }

      node = node.parent;
    }
  }

  private shouldContinue(
    start: number,
    maxSimulations: number,
    maxTimeMs: number | undefined,
  ): boolean {
    if (this.simulations >= maxSimulations) return false;
    if (maxTimeMs === undefined) return true;
    return performanceNow() - start < maxTimeMs;
  }

  private shouldExitEarly(): boolean {
    const visitFloor =
      this.options.earlyExitVisits ?? DEFAULT_EARLY_EXIT_VISITS;
    if (this.simulations < visitFloor || this.root.children.size < 2) {
      return false;
    }

    const visits = [...this.root.children.values()].map(
      (child) => child.visits,
    );
    const totalVisits = visits.reduce((total, count) => total + count, 0);
    const topVisits = Math.max(...visits);
    const ratio = this.options.earlyExitRatio ?? DEFAULT_EARLY_EXIT_RATIO;

    return totalVisits > 0 && topVisits / totalVisits >= ratio;
  }

  private selectRootMove(
    stats: readonly MctsMoveStat[],
  ): { stat: MctsMoveStat; reason: "lookahead" | "search" } | null {
    const searchBest = stats[0];
    if (!searchBest) return null;

    const lookaheadBest = this.rootLookahead?.candidates[0];
    if (!lookaheadBest) return { stat: searchBest, reason: "search" };

    const margin = this.options.lookaheadOverrideMargin ?? 0;
    if (margin <= 0 || searchBest.moveIndex === lookaheadBest.moveIndex) {
      return { stat: searchBest, reason: "search" };
    }

    const searchBestLookaheadScore =
      this.rootLookahead.candidates.find(
        (candidate) => candidate.moveIndex === searchBest.moveIndex,
      )?.score ?? Number.NEGATIVE_INFINITY;
    if (lookaheadBest.score - searchBestLookaheadScore < margin) {
      return { stat: searchBest, reason: "search" };
    }

    const lookaheadStat = stats.find(
      (stat) => stat.moveIndex === lookaheadBest.moveIndex,
    );
    if (!lookaheadStat) return { stat: searchBest, reason: "search" };

    return { stat: lookaheadStat, reason: "lookahead" };
  }

  private rootStats(): MctsMoveStat[] {
    return [...this.root.children.values()]
      .map((child) => ({
        move: publicMoveFromIndex(child.moveIndex!, this.rootState.dimensions),
        moveIndex: child.moveIndex!,
        visits: child.visits,
        winRate: child.visits > 0 ? child.value / child.visits : 0,
        value: child.value,
      }))
      .sort((first, second) => {
        if (first.visits !== second.visits) return second.visits - first.visits;
        if (first.winRate !== second.winRate)
          return second.winRate - first.winRate;
        return compareMoveIndicesByShape(
          first.moveIndex,
          second.moveIndex,
          this.rootState.dimensions,
        );
      });
  }
}

function rankedMoves(
  state: ClassicSearchState,
  player: Player,
  lookahead: LookaheadMoveResult | null = null,
  lookaheadWeight = 0,
): RankedMove[] {
  const lookaheadScores = lookaheadScoreMap(lookahead);
  const lookaheadRange = lookaheadScoreRange(lookahead);
  const scored = state
    .legalMoveIndices()
    .map((moveIndex) => ({
      moveIndex,
      score:
        fastMoveScore(state, moveIndex, player) +
        lookaheadPriorScore(
          moveIndex,
          lookaheadScores,
          lookaheadRange,
          lookaheadWeight,
        ),
    }))
    .sort((first, second) => {
      if (first.score !== second.score) return second.score - first.score;
      return compareMoveIndicesByShape(
        first.moveIndex,
        second.moveIndex,
        state.dimensions,
      );
    });
  const bestScore = scored[0]?.score ?? 0;
  const worstScore = scored.at(-1)?.score ?? bestScore;
  const spread = Math.max(1, bestScore - worstScore);

  return scored.map((move) => ({
    ...move,
    prior: (move.score - worstScore) / spread,
  }));
}

function selectRootLookahead(
  state: ClassicSearchState,
  player: Player,
  options: MctsOptions,
): LookaheadMoveResult | null {
  const depth = options.lookaheadDepth ?? 0;
  if (depth <= 0) return null;

  return selectLookaheadMove(state, player, {
    depth,
    maxMoves: options.lookaheadMaxMoves,
    rootMaxMoves: options.lookaheadRootMaxMoves,
    nodeLimit: options.lookaheadNodeLimit,
  });
}

function lookaheadScoreMap(
  lookahead: LookaheadMoveResult | null,
): ReadonlyMap<MoveIndex, number> {
  const scores = new Map<MoveIndex, number>();
  for (const candidate of lookahead?.candidates ?? []) {
    scores.set(candidate.moveIndex, candidate.score);
  }
  return scores;
}

function lookaheadScoreRange(
  lookahead: LookaheadMoveResult | null,
): { worst: number; spread: number } | null {
  const candidates = lookahead?.candidates;
  if (!candidates || candidates.length === 0) return null;

  let best = Number.NEGATIVE_INFINITY;
  let worst = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    best = Math.max(best, candidate.score);
    worst = Math.min(worst, candidate.score);
  }

  return {
    worst,
    spread: Math.max(1, best - worst),
  };
}

function lookaheadPriorScore(
  moveIndex: MoveIndex,
  scores: ReadonlyMap<MoveIndex, number>,
  range: { worst: number; spread: number } | null,
  weight: number,
): number {
  if (!range || weight <= 0) return 0;

  const score = scores.get(moveIndex);
  if (score === undefined) return 0;

  return ((score - range.worst) / range.spread) * LOOKAHEAD_PRIOR_SCALE * weight;
}

function rolloutFrom(
  state: ClassicSearchState,
  previousPlayer: Player,
  random: RandomSource,
  smartRolloutRate: number,
): RolloutResult {
  const moves: PlayedMove[] = [];
  let player = otherPlayer(previousPlayer);

  while (state.winner === null && !state.isDraw()) {
    const moveIndex = chooseRolloutMove(
      state,
      player,
      random,
      smartRolloutRate,
    );
    if (moveIndex === null) break;

    state.makeMove(moveIndex, player);
    moves.push({ player, moveIndex });
    player = otherPlayer(player);
  }

  return {
    winner: state.winner ?? 0,
    moves,
  };
}

function chooseRolloutMove(
  state: ClassicSearchState,
  player: Player,
  random: RandomSource,
  smartRolloutRate: number,
): MoveIndex | null {
  const legalMoves = state.legalMoveIndices();
  if (legalMoves.length === 0) return null;

  const wins = findWinningMoves(state, player);
  if (wins.length > 0) return wins[0];

  const blocks = findWinningMoves(state, otherPlayer(player));
  if (blocks.length > 0) return blocks[0];

  if (state.winCondition.linesToWin > 1) {
    const lineProgress = bestLineCompletionMove(state, player);
    if (lineProgress !== null) return lineProgress;

    const lineBlock = bestLineCompletionMove(state, otherPlayer(player));
    if (lineBlock !== null) return lineBlock;
  }

  if (random() < smartRolloutRate) {
    const scored = legalMoves
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
    const topCount = Math.min(4, scored.length);
    const topIndex = randomIndex(topCount, random);
    return (
      scored[Math.max(0, topIndex)]?.moveIndex ?? scored[0]?.moveIndex ?? null
    );
  }

  return legalMoves[randomIndex(legalMoves.length, random)] ?? null;
}

function resultValue(winner: Player | 0, player: Player): number {
  if (winner === 0) return 0.5;
  return winner === player ? 1 : 0;
}

function performanceNow(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function publicMoveFromIndex(
  moveIndex: MoveIndex,
  dimensions: BoardDimensions,
): Move {
  const move = moveFromIndex(moveIndex, dimensions);
  return { row: move.row, col: move.col };
}

function fastMoveScore(
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
    ownLineCompletions * (remainingOwnLines <= 1 ? 95_000 : 42_000) +
    opponentLineCompletions * (remainingOpponentLines <= 1 ? 82_000 : 36_000);
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
    }
  }

  return score;
}

function bestLineCompletionMove(
  state: ClassicSearchState,
  player: Player,
): MoveIndex | null {
  let bestMove: MoveIndex | null = null;
  let bestCompletions = 0;

  for (const moveIndex of state.legalMoveIndices()) {
    const completions = countLineCompletionsForMove(state, moveIndex, player);
    if (
      completions > bestCompletions ||
      (completions === bestCompletions &&
        completions > 0 &&
        bestMove !== null &&
        compareMoveIndicesByShape(moveIndex, bestMove, state.dimensions) < 0)
    ) {
      bestMove = moveIndex;
      bestCompletions = completions;
    }
  }

  return bestCompletions > 0 ? bestMove : null;
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
