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
} from "./heuristic";
import { moveFromIndex, type MoveIndex } from "./geometry";
import { ClassicSearchState } from "./state";

export type MctsOptions = {
  simulations?: number;
  maxTimeMs?: number;
  exploration?: number;
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
  reason: "tactical" | "search" | "heuristic";
  stats: MctsMoveStat[];
};

type RaveStat = {
  visits: number;
  value: number;
};

type RolloutResult = {
  winner: Player | 0;
  playedByPlayer: Record<Player, Set<MoveIndex>>;
};

const DEFAULT_SIMULATIONS = 300;
const DEFAULT_EXPLORATION = Math.SQRT2;
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

  const tactical = selectHeuristicMove(rootState, game.currentPlayer);
  if (!tactical) return null;

  if (tactical.reason !== "heuristic") {
    return {
      move: publicMoveFromIndex(tactical.moveIndex, rootState.dimensions),
      moveIndex: tactical.moveIndex,
      simulations: 0,
      elapsedMs: 0,
      reason: "tactical",
      stats: tactical.candidates.map((candidate) => ({
        move: publicMoveFromIndex(candidate.moveIndex, rootState.dimensions),
        moveIndex: candidate.moveIndex,
        visits: 0,
        winRate: 0,
        value: candidate.score,
      })),
    };
  }

  const random = createSeededRandom(options.seed ?? 0xa71a1);
  const search = new MctsSearch(rootState, game.currentPlayer, random, options);
  return search.run(tactical.moveIndex);
}

class MctsNode {
  readonly children = new Map<MoveIndex, MctsNode>();
  readonly rave = new Map<MoveIndex, RaveStat>();
  visits = 0;
  value = 0;

  constructor(
    readonly parent: MctsNode | null,
    readonly moveIndex: MoveIndex | null,
    readonly playerJustMoved: Player,
    readonly untriedMoves: MoveIndex[],
  ) {}
}

class MctsSearch {
  private readonly root: MctsNode;
  private simulations = 0;

  constructor(
    private readonly rootState: ClassicSearchState,
    private readonly rootPlayer: Player,
    private readonly random: RandomSource,
    private readonly options: MctsOptions,
  ) {
    this.root = new MctsNode(
      null,
      null,
      otherPlayer(rootPlayer),
      orderedMoves(rootState, rootPlayer),
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
    const best = stats[0];

    if (!best) {
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
      move: best.move,
      moveIndex: best.moveIndex,
      simulations: this.simulations,
      elapsedMs,
      reason: "search",
      stats,
    };
  }

  private runSimulation(): void {
    const state = this.rootState.clone();
    const playedByPlayer = emptyPlayedMoves();
    let node = this.root;

    while (
      node.untriedMoves.length === 0 &&
      node.children.size > 0 &&
      state.winner === null &&
      !state.isDraw()
    ) {
      node = this.selectChild(node);
      state.makeMove(node.moveIndex!, node.playerJustMoved);
      playedByPlayer[node.playerJustMoved].add(node.moveIndex!);
    }

    if (
      node.untriedMoves.length > 0 &&
      state.winner === null &&
      !state.isDraw()
    ) {
      const moveIndex = node.untriedMoves.shift()!;
      const player = otherPlayer(node.playerJustMoved);
      state.makeMove(moveIndex, player);
      playedByPlayer[player].add(moveIndex);

      const child = new MctsNode(
        node,
        moveIndex,
        player,
        state.winner === null && !state.isDraw()
          ? orderedMoves(state, otherPlayer(player))
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
    mergePlayedMoves(playedByPlayer, rollout.playedByPlayer);
    this.backpropagate(node, rollout.winner, playedByPlayer);
  }

  private selectChild(node: MctsNode): MctsNode {
    let bestChild: MctsNode | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    const exploration = this.options.exploration ?? DEFAULT_EXPLORATION;
    const useRave = this.options.useRave ?? true;
    const parentVisits = Math.max(1, node.visits);

    for (const child of node.children.values()) {
      if (child.visits === 0) return child;

      const exploitation = child.value / child.visits;
      const explorationScore =
        exploration * Math.sqrt(Math.log(parentVisits) / child.visits);
      let score = exploitation + explorationScore;

      if (useRave && child.moveIndex !== null) {
        const rave = node.rave.get(child.moveIndex);
        if (rave && rave.visits > 0) {
          const beta =
            rave.visits /
            (child.visits +
              rave.visits +
              (4 * child.visits * rave.visits) / RAVE_K);
          score = (1 - beta) * score + beta * (rave.value / rave.visits);
        }
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
    playedByPlayer: Record<Player, Set<MoveIndex>>,
  ): void {
    while (node) {
      node.visits += 1;
      node.value += resultValue(winner, node.playerJustMoved);

      const playerToMove = otherPlayer(node.playerJustMoved);
      const raveValue = resultValue(winner, playerToMove);
      for (const moveIndex of playedByPlayer[playerToMove]) {
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

function orderedMoves(state: ClassicSearchState, player: Player): MoveIndex[] {
  return state
    .legalMoveIndices()
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
    })
    .map((score) => score.moveIndex);
}

function rolloutFrom(
  state: ClassicSearchState,
  previousPlayer: Player,
  random: RandomSource,
  smartRolloutRate: number,
): RolloutResult {
  const playedByPlayer = emptyPlayedMoves();
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
    playedByPlayer[player].add(moveIndex);
    player = otherPlayer(player);
  }

  return {
    winner: state.winner ?? 0,
    playedByPlayer,
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

function emptyPlayedMoves(): Record<Player, Set<MoveIndex>> {
  return {
    1: new Set<MoveIndex>(),
    2: new Set<MoveIndex>(),
  };
}

function mergePlayedMoves(
  target: Record<Player, Set<MoveIndex>>,
  source: Record<Player, Set<MoveIndex>>,
): void {
  for (const moveIndex of source[1]) target[1].add(moveIndex);
  for (const moveIndex of source[2]) target[2].add(moveIndex);
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

  for (const segmentId of state.segmentTable.cellSegments[cellIndex]) {
    if (state.blockedCounts[segmentId] > 0) continue;

    const own = playerCounts[segmentId];
    const opp = opponentCounts[segmentId];
    const lineLength = state.winCondition.lineLength;

    if (opp === 0) {
      if (own === lineLength - 1) score += 100_000;
      else if (own === lineLength - 2) score += 1_200;
      else if (own > 0) score += 80 * own;
      else score += 8;
    }

    if (own === 0) {
      if (opp === lineLength - 1) score += 70_000;
      else if (opp === lineLength - 2) score += 1_000;
      else if (opp > 0) score += 70 * opp;
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
