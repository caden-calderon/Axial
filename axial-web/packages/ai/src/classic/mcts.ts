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
  findWinningMoves,
  selectHeuristicMove,
  selectTacticalMove,
  type TacticalMoveMode,
} from "./heuristic";
import { moveFromIndex, type MoveIndex } from "./geometry";
import { selectLookaheadMove, type LookaheadMoveResult } from "./lookahead";
import { ClassicSearchState } from "./state";
import { evaluateFastPosition, fastMoveScore } from "./fastEvaluation";

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
  lookaheadTimeFraction?: number;
  seed?: number;
  smartRolloutRate?: number;
  rolloutMaxMoves?: number;
  rolloutEvaluationScale?: number;
  earlyExitVisits?: number;
  earlyExitRatio?: number;
  useRave?: boolean;
  tacticalMode?: TacticalMoveMode;
  progressiveWidening?: boolean;
  progressiveWideningBase?: number;
  progressiveWideningExponent?: number;
  minimumSearchDepth?: number;
};

export type MctsStopReason = "tactical" | "simulations" | "time" | "early-exit";

export type MctsMoveStat = {
  move: Move;
  moveIndex: MoveIndex;
  visits: number;
  winRate: number;
  value: number;
  maxDepth: number;
};

export type MctsPhaseTimings = {
  stateConversionMs: number;
  tacticalMs: number;
  heuristicMs: number;
  lookaheadMs: number;
  treeSearchMs: number;
  totalMs: number;
};

export type MctsTelemetry = {
  phaseMs: MctsPhaseTimings;
  lookaheadNodes: number;
  lookaheadCandidates: number;
  lookaheadCompletedCandidates: number;
  treeNodes: number;
  rolloutMoves: number;
  maxRolloutMoves: number;
  selectedMoveDepth: number;
};

export type MctsMoveResult = {
  move: Move;
  moveIndex: MoveIndex;
  simulations: number;
  elapsedMs: number;
  maxDepth: number;
  rootChildren: number;
  lookaheadDepth: number;
  lookaheadCompletedDepth: number;
  lookaheadPartialDepth: number;
  lookaheadComplete: boolean;
  stopReason: MctsStopReason;
  reason: "tactical" | "lookahead" | "search" | "heuristic";
  stats: MctsMoveStat[];
  telemetry: MctsTelemetry;
};

type RaveStat = {
  visits: number;
  value: number;
};

type RolloutResult = {
  winner: Player | 0;
  terminal: boolean;
  valueForPlayerOne: number;
  moves: PlayedMove[];
};

type PlayedMove = {
  player: Player;
  moveIndex: MoveIndex;
  cellIndex: number;
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
const DEFAULT_ROLLOUT_MAX_MOVES = 48;
const DEFAULT_ROLLOUT_EVALUATION_SCALE = 220_000;
const DEFAULT_EARLY_EXIT_VISITS = 160;
const DEFAULT_EARLY_EXIT_RATIO = 0.86;
const DEFAULT_PROGRESSIVE_WIDENING_BASE = 6;
const DEFAULT_PROGRESSIVE_WIDENING_EXPONENT = 0.45;
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
  const decisionStart = performanceNow();

  const stateStart = performanceNow();
  const rootState = ClassicSearchState.fromGame(game);
  const stateConversionMs = performanceNow() - stateStart;
  if (rootState.winner !== null) return null;

  const tacticalStart = performanceNow();
  const criticalTactical = selectTacticalMove(
    rootState,
    game.currentPlayer,
    options.tacticalMode ?? "forced-only",
  );
  const tacticalMs = performanceNow() - tacticalStart;
  if (criticalTactical) {
    const totalMs = performanceNow() - decisionStart;
    return {
      move: publicMoveFromIndex(
        criticalTactical.moveIndex,
        rootState.dimensions,
      ),
      moveIndex: criticalTactical.moveIndex,
      simulations: 0,
      elapsedMs: totalMs,
      maxDepth: 0,
      rootChildren: 0,
      lookaheadDepth: 0,
      lookaheadCompletedDepth: 0,
      lookaheadPartialDepth: 0,
      lookaheadComplete: true,
      stopReason: "tactical",
      reason: "tactical",
      stats: criticalTactical.candidates.map((candidate) => ({
        move: publicMoveFromIndex(candidate.moveIndex, rootState.dimensions),
        moveIndex: candidate.moveIndex,
        visits: 0,
        winRate: 0,
        value: candidate.score,
        maxDepth: 0,
      })),
      telemetry: emptyTelemetry({
        stateConversionMs,
        tacticalMs,
        totalMs,
      }),
    };
  }

  const heuristicStart = performanceNow();
  const tactical = selectHeuristicMove(rootState, game.currentPlayer);
  const heuristicMs = performanceNow() - heuristicStart;
  if (!tactical) return null;

  const remainingDecisionTime =
    options.maxTimeMs === undefined
      ? undefined
      : Math.max(0, options.maxTimeMs - (performanceNow() - decisionStart));
  const boundedOptions = {
    ...options,
    maxTimeMs: remainingDecisionTime,
  };
  const lookaheadStart = performanceNow();
  const lookahead = selectRootLookahead(
    rootState,
    game.currentPlayer,
    boundedOptions,
  );
  const lookaheadMs = performanceNow() - lookaheadStart;
  const remainingSearchTime =
    options.maxTimeMs === undefined
      ? undefined
      : Math.max(0, options.maxTimeMs - (performanceNow() - decisionStart));
  const random = createSeededRandom(options.seed ?? 0xa71a1);
  const search = new MctsSearch(
    rootState,
    game.currentPlayer,
    random,
    { ...boundedOptions, maxTimeMs: remainingSearchTime },
    lookahead,
  );
  const result = search.run(
    lookahead?.moveIndex ?? tactical.moveIndex,
    tactical.moveIndex,
  );
  const totalMs = performanceNow() - decisionStart;
  return {
    ...result,
    elapsedMs: totalMs,
    telemetry: {
      ...result.telemetry,
      phaseMs: {
        stateConversionMs,
        tacticalMs,
        heuristicMs,
        lookaheadMs,
        treeSearchMs: result.telemetry.phaseMs.treeSearchMs,
        totalMs,
      },
      lookaheadNodes: lookahead?.nodes ?? 0,
      lookaheadCandidates: lookahead?.candidates.length ?? 0,
      lookaheadCompletedCandidates:
        lookahead?.candidates.filter((candidate) => candidate.complete)
          .length ?? 0,
    },
  };
}

class MctsNode {
  readonly children = new Map<MoveIndex, MctsNode>();
  readonly rave = new Map<MoveIndex, RaveStat>();
  readonly movePriors = new Map<MoveIndex, number>();
  readonly untriedMoves: MoveIndex[];
  visits = 0;
  value = 0;
  maxDescendantDepth: number;

  constructor(
    readonly parent: MctsNode | null,
    readonly moveIndex: MoveIndex | null,
    readonly cellIndex: number | null,
    readonly playerJustMoved: Player,
    readonly depth: number,
    rankedMoves: readonly RankedMove[],
  ) {
    this.maxDescendantDepth = depth;
    this.untriedMoves = rankedMoves.map((move) => move.moveIndex);
    for (const move of rankedMoves) {
      this.movePriors.set(move.moveIndex, move.prior);
    }
  }
}

class MctsSearch {
  private readonly root: MctsNode;
  private simulations = 0;
  private maxDepth = 0;
  private nodesCreated = 1;
  private rolloutMoves = 0;
  private maxRolloutMoves = 0;

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

  run(
    fallbackMoveIndex: MoveIndex,
    strategicAnchorMoveIndex: MoveIndex,
  ): MctsMoveResult {
    const start = performanceNow();
    const maxSimulations = this.options.simulations ?? DEFAULT_SIMULATIONS;
    const maxTimeMs = this.options.maxTimeMs;
    let stopReason: Exclude<MctsStopReason, "tactical"> = "simulations";

    while (this.simulations < maxSimulations) {
      if (maxTimeMs !== undefined && performanceNow() - start >= maxTimeMs) {
        stopReason = "time";
        break;
      }

      this.runSimulation();
      this.simulations += 1;

      if (this.shouldExitEarly()) {
        stopReason = "early-exit";
        break;
      }
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
        maxDepth: this.maxDepth,
        rootChildren: this.root.children.size,
        lookaheadDepth: this.rootLookahead?.depth ?? 0,
        lookaheadCompletedDepth: this.rootLookahead?.completedDepth ?? 0,
        lookaheadPartialDepth: this.rootLookahead?.partialDepth ?? 0,
        lookaheadComplete: this.rootLookahead?.complete ?? true,
        stopReason,
        reason: this.rootLookahead ? "lookahead" : "heuristic",
        stats,
        telemetry: this.telemetry(elapsedMs, fallbackMoveIndex),
      };
    }

    const minimumSearchDepth = Math.max(
      0,
      this.options.minimumSearchDepth ?? 0,
    );
    if (selected.stat.maxDepth < minimumSearchDepth) {
      return {
        move: publicMoveFromIndex(
          strategicAnchorMoveIndex,
          this.rootState.dimensions,
        ),
        moveIndex: strategicAnchorMoveIndex,
        simulations: this.simulations,
        elapsedMs,
        maxDepth: this.maxDepth,
        rootChildren: this.root.children.size,
        lookaheadDepth: this.rootLookahead?.depth ?? 0,
        lookaheadCompletedDepth: this.rootLookahead?.completedDepth ?? 0,
        lookaheadPartialDepth: this.rootLookahead?.partialDepth ?? 0,
        lookaheadComplete: this.rootLookahead?.complete ?? true,
        stopReason,
        reason: "heuristic",
        stats,
        telemetry: this.telemetry(
          elapsedMs,
          strategicAnchorMoveIndex,
          selected.stat.maxDepth,
        ),
      };
    }

    return {
      move: selected.stat.move,
      moveIndex: selected.stat.moveIndex,
      simulations: this.simulations,
      elapsedMs,
      maxDepth: this.maxDepth,
      rootChildren: this.root.children.size,
      lookaheadDepth: this.rootLookahead?.depth ?? 0,
      lookaheadCompletedDepth: this.rootLookahead?.completedDepth ?? 0,
      lookaheadPartialDepth: this.rootLookahead?.partialDepth ?? 0,
      lookaheadComplete: this.rootLookahead?.complete ?? true,
      stopReason,
      reason: selected.reason,
      stats,
      telemetry: this.telemetry(elapsedMs, selected.stat.moveIndex),
    };
  }

  private runSimulation(): void {
    const state = this.rootState.clone();
    const playedMoves: PlayedMove[] = [];
    let node = this.root;

    while (state.winner === null && !state.isDraw()) {
      if (this.canExpand(node)) {
        const moveIndex = node.untriedMoves.shift()!;
        const player = otherPlayer(node.playerJustMoved);
        const entry = state.makeMove(moveIndex, player);
        playedMoves.push({ player, moveIndex, cellIndex: entry.cellIndex });

        const child = new MctsNode(
          node,
          moveIndex,
          entry.cellIndex,
          player,
          node.depth + 1,
          state.winner === null && !state.isDraw()
            ? rankedMoves(state, otherPlayer(player))
            : [],
        );
        node.children.set(moveIndex, child);
        this.nodesCreated += 1;
        node = child;
        this.maxDepth = Math.max(this.maxDepth, node.depth);
        break;
      }

      if (node.children.size === 0) break;

      node = this.selectChild(node);
      const entry = state.makeMove(node.moveIndex!, node.playerJustMoved);
      playedMoves.push({
        player: node.playerJustMoved,
        moveIndex: node.moveIndex!,
        cellIndex: entry.cellIndex,
      });
      this.maxDepth = Math.max(this.maxDepth, node.depth);
    }

    const rollout = rolloutFrom(
      state,
      node.playerJustMoved,
      this.random,
      this.options.smartRolloutRate ?? DEFAULT_SMART_ROLLOUT_RATE,
      this.options.rolloutMaxMoves ?? DEFAULT_ROLLOUT_MAX_MOVES,
      this.options.rolloutEvaluationScale ?? DEFAULT_ROLLOUT_EVALUATION_SCALE,
    );
    this.rolloutMoves += rollout.moves.length;
    this.maxRolloutMoves = Math.max(this.maxRolloutMoves, rollout.moves.length);
    playedMoves.push(...rollout.moves);
    this.backpropagate(node, rollout, playedMoves);
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

      if (useRave && child.cellIndex !== null) {
        const rave = node.rave.get(child.cellIndex);
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

  private canExpand(node: MctsNode): boolean {
    if (node.untriedMoves.length === 0) return false;
    if (node.children.size === 0) return true;
    if (this.options.progressiveWidening === false) return true;

    const base = Math.max(
      1,
      this.options.progressiveWideningBase ?? DEFAULT_PROGRESSIVE_WIDENING_BASE,
    );
    const exponent = Math.min(
      1,
      Math.max(
        0.05,
        this.options.progressiveWideningExponent ??
          DEFAULT_PROGRESSIVE_WIDENING_EXPONENT,
      ),
    );
    const childLimit = Math.ceil(base + Math.pow(node.visits + 1, exponent));

    return node.children.size < childLimit;
  }

  private backpropagate(
    node: MctsNode | null,
    rollout: RolloutResult,
    playedMoves: readonly PlayedMove[],
  ): void {
    const treeDepth = node?.depth ?? 0;
    while (node) {
      node.visits += 1;
      node.maxDescendantDepth = Math.max(node.maxDescendantDepth, treeDepth);
      const distanceToResult = Math.max(1, playedMoves.length - node.depth);
      node.value += rolloutValue(
        rollout,
        node.playerJustMoved,
        distanceToResult,
      );

      const playerToMove = otherPlayer(node.playerJustMoved);
      const raveValue = rolloutValue(rollout, playerToMove, distanceToResult);
      const futureSeen = new Set<number>();

      for (let index = node.depth; index < playedMoves.length; index += 1) {
        const move = playedMoves[index]!;
        if (move.player !== playerToMove || futureSeen.has(move.cellIndex)) {
          continue;
        }
        futureSeen.add(move.cellIndex);

        const stat = node.rave.get(move.cellIndex) ?? { visits: 0, value: 0 };
        stat.visits += 1;
        stat.value += raveValue;
        node.rave.set(move.cellIndex, stat);
      }

      node = node.parent;
    }
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
        maxDepth: child.maxDescendantDepth,
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

  private telemetry(
    elapsedMs: number,
    selectedMoveIndex: MoveIndex,
    searchSelectedDepth?: number,
  ) {
    return {
      phaseMs: {
        stateConversionMs: 0,
        tacticalMs: 0,
        heuristicMs: 0,
        lookaheadMs: 0,
        treeSearchMs: elapsedMs,
        totalMs: elapsedMs,
      },
      lookaheadNodes: this.rootLookahead?.nodes ?? 0,
      lookaheadCandidates: this.rootLookahead?.candidates.length ?? 0,
      lookaheadCompletedCandidates:
        this.rootLookahead?.candidates.filter((candidate) => candidate.complete)
          .length ?? 0,
      treeNodes: this.nodesCreated,
      rolloutMoves: this.rolloutMoves,
      maxRolloutMoves: this.maxRolloutMoves,
      selectedMoveDepth:
        searchSelectedDepth ??
        this.root.children.get(selectedMoveIndex)?.maxDescendantDepth ??
        0,
    } satisfies MctsTelemetry;
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
    maxTimeMs:
      options.maxTimeMs === undefined
        ? undefined
        : options.maxTimeMs *
          Math.min(0.6, Math.max(0.05, options.lookaheadTimeFraction ?? 0.3)),
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

  return (
    ((score - range.worst) / range.spread) * LOOKAHEAD_PRIOR_SCALE * weight
  );
}

function rolloutFrom(
  state: ClassicSearchState,
  previousPlayer: Player,
  random: RandomSource,
  smartRolloutRate: number,
  maxMoves: number,
  evaluationScale: number,
): RolloutResult {
  const moves: PlayedMove[] = [];
  let player = otherPlayer(previousPlayer);
  const moveLimit = Math.max(0, Math.floor(maxMoves));

  while (state.winner === null && !state.isDraw() && moves.length < moveLimit) {
    const moveIndex = chooseRolloutMove(
      state,
      player,
      random,
      smartRolloutRate,
    );
    if (moveIndex === null) break;

    const entry = state.makeMove(moveIndex, player);
    moves.push({ player, moveIndex, cellIndex: entry.cellIndex });
    player = otherPlayer(player);
  }

  const terminal = state.winner !== null || state.isDraw();
  const valueForPlayerOne = terminal
    ? state.winner === 1
      ? 1
      : state.winner === 2
        ? 0
        : 0.5
    : normalizedPositionValue(state, player, evaluationScale);

  return {
    winner: state.winner ?? 0,
    terminal,
    valueForPlayerOne,
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
    if (state.winCondition.linesToWin === 1) {
      const topCount = Math.min(4, scored.length);
      return scored[randomIndex(topCount, random)]?.moveIndex ?? null;
    }

    const topCount = Math.min(6, scored.length);
    return selectWeightedRolloutMove(scored.slice(0, topCount), random);
  }

  return legalMoves[randomIndex(legalMoves.length, random)] ?? null;
}

function selectWeightedRolloutMove(
  moves: readonly { moveIndex: MoveIndex; score: number }[],
  random: RandomSource,
): MoveIndex | null {
  const bestScore = moves[0]?.score;
  const worstScore = moves.at(-1)?.score;
  if (bestScore === undefined || worstScore === undefined) return null;

  const scoreSpan = Math.max(1, bestScore - worstScore);
  const temperature = Math.max(1_500, scoreSpan * 0.2);
  const weights = moves.map((move) =>
    Math.exp((move.score - bestScore) / temperature),
  );
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let target = random() * totalWeight;

  for (let index = 0; index < moves.length; index += 1) {
    target -= weights[index]!;
    if (target <= 0) return moves[index]!.moveIndex;
  }

  return moves.at(-1)?.moveIndex ?? null;
}

function rolloutValue(
  result: RolloutResult,
  player: Player,
  distanceToResult: number,
): number {
  if (!result.terminal || result.winner === 0) {
    return player === 1
      ? result.valueForPlayerOne
      : 1 - result.valueForPlayerOne;
  }

  const urgency = 0.5 * Math.exp(-Math.max(0, distanceToResult) / 80);
  return result.winner === player ? 0.5 + urgency : 0.5 - urgency;
}

function normalizedPositionValue(
  state: ClassicSearchState,
  playerToMove: Player,
  evaluationScale: number,
): number {
  const scale = Math.max(1, evaluationScale);
  const score = evaluateFastPosition(state, 1, playerToMove);
  return 0.5 + Math.tanh(score / scale) * 0.49;
}

function emptyTelemetry({
  stateConversionMs,
  tacticalMs,
  heuristicMs = 0,
  totalMs,
}: {
  stateConversionMs: number;
  tacticalMs: number;
  heuristicMs?: number;
  totalMs: number;
}): MctsTelemetry {
  return {
    phaseMs: {
      stateConversionMs,
      tacticalMs,
      heuristicMs,
      lookaheadMs: 0,
      treeSearchMs: 0,
      totalMs,
    },
    lookaheadNodes: 0,
    lookaheadCandidates: 0,
    lookaheadCompletedCandidates: 0,
    treeNodes: 0,
    rolloutMoves: 0,
    maxRolloutMoves: 0,
    selectedMoveDepth: 0,
  };
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
