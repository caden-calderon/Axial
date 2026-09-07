import {
  applyMove,
  createGame,
  legalMoves,
  replayMoves,
  type Move,
  type Player,
  type WinCondition,
} from "@axial/core";
import { beforeAll, describe, expect, it } from "vitest";
import {
  analyzeMctsMove,
  type MctsMoveResult,
  type MctsOptions,
} from "./index";
import { CLASSIC_CHALLENGE_FIXTURES } from "./classic/challengeFixtures";

type Engine = {
  analyzeMctsMove: typeof analyzeMctsMove;
};

type EngineId = "baseline" | "hybrid";

type DecisionSample = {
  engine: EngineId;
  phase: "opening" | "midgame" | "late";
  elapsedMs: number;
  simulations: number;
  treeNodes: number;
  lookaheadNodes: number;
  rootChildren: number;
  selectedDepth: number;
  completedLookaheadDepth: number;
};

type PairedMatch = {
  rule: string;
  opening: string;
  hybridPlayer: Player;
  outcome: "hybrid-win" | "baseline-win" | "draw" | "truncated" | "no-move";
  winner: Player | 0;
  moves: number;
  history: Move[];
  decisions: DecisionSample[];
};

type RuleSummary = {
  rule: string;
  hybridWins: number;
  baselineWins: number;
  draws: number;
  truncations: number;
  noMoves: number;
  hybridLatencyMs: { p50: number; p95: number };
  baselineLatencyMs: { p50: number; p95: number };
  latencyByPhaseMs: Record<
    DecisionSample["phase"],
    {
      hybrid: { p50: number; p95: number };
      baseline: { p50: number; p95: number };
    }
  >;
  hybridMeanSimulations: number;
  baselineMeanSimulations: number;
  hybridMeanTreeNodes: number;
  baselineMeanTreeNodes: number;
  hybridMeanLookaheadNodes: number;
  baselineMeanLookaheadNodes: number;
  hybridMeanSelectedDepth: number;
  baselineMeanSelectedDepth: number;
  hybridMeanCompletedLookaheadDepth: number;
  baselineMeanCompletedLookaheadDepth: number;
};

type TournamentOpening = {
  id: string;
  moves: readonly Move[];
};

const pairedEvaluationEnabled = process.env.AXIAL_AI_PAIRED_EVAL === "1";
const baselineBundle =
  process.env.AXIAL_AI_BASELINE_BUNDLE ?? "/tmp/axial-classic-ai-baseline.mjs";
const timeBudgetMs = finiteInteger(process.env.AXIAL_AI_PAIRED_TIME_MS, 250);
const maxMoves = finiteInteger(process.env.AXIAL_AI_PAIRED_MAX_MOVES, 252);
const ruleFilter = process.env.AXIAL_AI_PAIRED_RULE ?? "all";
const openingFilter = process.env.AXIAL_AI_PAIRED_OPENING ?? "all";
const deterministicWork = process.env.AXIAL_AI_PAIRED_DETERMINISTIC === "1";

const RULES = [
  {
    label: "connect4-one-line",
    winCondition: { lineLength: 4, linesToWin: 1 },
  },
  {
    label: "connect4-two-lines",
    winCondition: { lineLength: 4, linesToWin: 2 },
  },
  {
    label: "connect4-three-lines",
    winCondition: { lineLength: 4, linesToWin: 3 },
  },
  {
    label: "connect5-one-line",
    winCondition: { lineLength: 5, linesToWin: 1 },
  },
  {
    label: "connect5-two-lines",
    winCondition: { lineLength: 5, linesToWin: 2 },
  },
  {
    label: "connect5-three-lines",
    winCondition: { lineLength: 5, linesToWin: 3 },
  },
] as const satisfies readonly {
  label: string;
  winCondition: WinCondition;
}[];

const OPENINGS = [
  {
    id: "cross-center-a",
    moves: [
      { row: 2, col: 3 },
      { row: 3, col: 3 },
    ],
  },
  {
    id: "cross-center-b",
    moves: [
      { row: 3, col: 2 },
      { row: 2, col: 4 },
    ],
  },
] as const satisfies readonly { id: string; moves: readonly Move[] }[];

let baselineEngine: Engine;

describe.skipIf(!pairedEvaluationEnabled)(
  "Classic frozen-baseline paired tournament",
  () => {
    beforeAll(async () => {
      baselineEngine = (await import(baselineBundle)) as Engine;
      if (typeof baselineEngine.analyzeMctsMove !== "function") {
        throw new Error(
          `Baseline bundle ${baselineBundle} does not export analyzeMctsMove`,
        );
      }
    });

    it("compares the hybrid and frozen Max under mirrored paired budgets", () => {
      const matches: PairedMatch[] = [];
      const activeRules = RULES.filter(
        (rule) => ruleFilter === "all" || rule.label === ruleFilter,
      );
      if (activeRules.length === 0) {
        throw new Error(`Unknown paired rule filter ${ruleFilter}`);
      }
      const usedOpenings = new Set<string>();

      for (const rule of activeRules) {
        const activeOpenings = openingsForRule(rule.winCondition).filter(
          (opening) => openingFilter === "all" || opening.id === openingFilter,
        );
        if (activeOpenings.length === 0) continue;

        for (const opening of activeOpenings) {
          usedOpenings.add(opening.id);
          matches.push(
            playPairedMatch(rule, opening, 1),
            playPairedMatch(rule, opening, 2),
          );
        }
      }
      if (matches.length === 0) {
        throw new Error(`Unknown paired opening filter ${openingFilter}`);
      }

      const summaries = activeRules.map((rule) =>
        summarizeRule(
          rule.label,
          matches.filter((match) => match.rule === rule.label),
        ),
      );
      console.log(
        `AXIAL_AI_PAIRED ${JSON.stringify({
          baseline: "classic-max-pre-overhaul-2026-07-15",
          candidate: "classic-max-hybrid-threat-v1",
          mode: deterministicWork ? "deterministic-work" : "equal-clock",
          timeBudgetMs,
          maxMoves,
          ruleFilter,
          openings: [...usedOpenings],
          summaries,
          matches: matches.map(compactMatch),
        })}`,
      );

      expect(matches.every((match) => match.outcome !== "no-move")).toBe(true);
      for (const summary of summaries) {
        expect(summary.truncations).toBe(0);
        expect(summary.hybridWins).toBeGreaterThanOrEqual(summary.baselineWins);
      }
    }, 900_000);
  },
);

function playPairedMatch(
  rule: (typeof RULES)[number],
  opening: TournamentOpening,
  hybridPlayer: Player,
): PairedMatch {
  let game = replayMoves(opening.moves, rule.winCondition);
  const decisions: DecisionSample[] = [];
  let noMove = false;

  while (
    game.status.state === "playing" &&
    game.moveHistory.length < maxMoves
  ) {
    const engineId: EngineId =
      game.currentPlayer === hybridPlayer ? "hybrid" : "baseline";
    const engine = engineId === "hybrid" ? { analyzeMctsMove } : baselineEngine;
    const result = engine.analyzeMctsMove(game, {
      ...equalClockOptions(rule.winCondition),
      seed: decisionSeed(rule.label, opening.id, game.moveHistory.length),
    }) as MctsMoveResult | null;

    if (result === null) {
      noMove = true;
      break;
    }

    decisions.push({
      engine: engineId,
      phase: gamePhase(game.moveHistory.length, game.winCondition),
      elapsedMs: result.elapsedMs,
      simulations: result.simulations,
      treeNodes: result.telemetry?.treeNodes ?? 0,
      lookaheadNodes: result.telemetry?.lookaheadNodes ?? 0,
      rootChildren: result.rootChildren,
      selectedDepth: result.telemetry?.selectedMoveDepth ?? result.maxDepth,
      completedLookaheadDepth: result.lookaheadCompletedDepth ?? 0,
    });
    game = applyMove(game, result.move);
  }

  const winner = game.status.state === "won" ? game.status.winner : 0;
  const outcome = noMove
    ? "no-move"
    : game.status.state === "draw"
      ? "draw"
      : game.status.state === "playing"
        ? "truncated"
        : winner === hybridPlayer
          ? "hybrid-win"
          : "baseline-win";

  return {
    rule: rule.label,
    opening: opening.id,
    hybridPlayer,
    outcome,
    winner,
    moves: game.moveHistory.length,
    history: game.moveHistory.map(({ row, col }) => ({ row, col })),
    decisions,
  };
}

function openingsForRule(winCondition: WinCondition): TournamentOpening[] {
  const targetMoves =
    winCondition.lineLength === 5
      ? 16 + winCondition.linesToWin * 16
      : 8 + winCondition.linesToWin * 8;

  return [
    ...OPENINGS,
    generateBalancedOpening(
      winCondition,
      "balanced-midgame-a",
      0x51a7,
      targetMoves,
    ),
    generateBalancedOpening(
      winCondition,
      "balanced-midgame-b",
      0xc4d3,
      targetMoves,
    ),
    ...CLASSIC_CHALLENGE_FIXTURES.filter(
      (challenge) =>
        challenge.winCondition.lineLength === winCondition.lineLength &&
        challenge.winCondition.linesToWin === winCondition.linesToWin &&
        PAIRED_CHALLENGE_IDS.has(challenge.id),
    ).map((challenge) => ({
      id: `challenge-${challenge.id}`,
      moves: challenge.moveHistory,
    })),
  ];
}

const PAIRED_CHALLENGE_IDS = new Set([
  "connect4-height-one-support-trap",
  "connect4-max-second-opening-fork-race",
  "connect4-two-line-max-second-captured-blunder",
  "connect4-three-line-direct-bank-guard",
  "connect5-open-four-fork-build",
  "connect5-two-line-independent-race-build",
  "connect5-three-line-independent-race-build",
]);

function generateBalancedOpening(
  winCondition: WinCondition,
  id: string,
  seed: number,
  targetMoves: number,
): TournamentOpening {
  let game = createGame(winCondition);
  let randomState = seed >>> 0;
  const random = () => {
    randomState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
    return randomState / 0x1_0000_0000;
  };

  while (
    game.status.state === "playing" &&
    game.moveHistory.length < targetMoves
  ) {
    const candidates = legalMoves(game.board, game.dimensions)
      .map((move) => ({ move, order: random() }))
      .sort((first, second) => first.order - second.order);
    const selected = candidates.find((candidate) => {
      const next = applyMove(game, candidate.move);
      if (next.status.state !== "playing") return false;
      const playerOneLines = next.completedLines.filter(
        (line) => line.player === 1,
      ).length;
      const playerTwoLines = next.completedLines.filter(
        (line) => line.player === 2,
      ).length;
      return (
        Math.abs(playerOneLines - playerTwoLines) <= 1 &&
        !hasImmediateTerminalMove(next)
      );
    });
    if (!selected) break;
    game = applyMove(game, selected.move);
  }

  return {
    id,
    moves: game.moveHistory.map(({ row, col }) => ({ row, col })),
  };
}

function hasImmediateTerminalMove(
  game: ReturnType<typeof createGame>,
): boolean {
  return legalMoves(game.board, game.dimensions).some(
    (move) => applyMove(game, move).status.state === "won",
  );
}

function equalClockOptions(winCondition: WinCondition): MctsOptions {
  if (deterministicWork) {
    return {
      simulations: 0,
      progressiveBias: 0.24,
      lookaheadDepth: 2,
      lookaheadMaxMoves: 10,
      lookaheadRootMaxMoves: 14,
      lookaheadNodeLimit: 800,
      lookaheadWeight: 0.62,
      lookaheadOverrideMargin: 1,
      smartRolloutRate: 0.86,
      earlyExitVisits: 100_000,
      earlyExitRatio: 1,
      useRave: true,
      tacticalMode: "forced-only",
      progressiveWidening: true,
      progressiveWideningBase: 4,
      progressiveWideningExponent: 0.4,
      minimumSearchDepth: 0,
    };
  }

  return {
    simulations: 100_000,
    maxTimeMs: timeBudgetMs,
    progressiveBias: 0.24,
    lookaheadDepth: 2,
    lookaheadMaxMoves: 10,
    lookaheadRootMaxMoves: 14,
    lookaheadNodeLimit: 4_000,
    lookaheadWeight: 0.62,
    lookaheadOverrideMargin: 34_000,
    lookaheadTimeFraction: 0.36,
    smartRolloutRate: 0.86,
    rolloutMaxMoves:
      42 +
      (winCondition.lineLength - 4) * 6 +
      (winCondition.linesToWin - 1) * 4,
    rolloutEvaluationScale: 210_000,
    earlyExitVisits: 100_000,
    earlyExitRatio: 1,
    useRave: true,
    tacticalMode: "forced-only",
    progressiveWidening: true,
    progressiveWideningBase: 4,
    progressiveWideningExponent: 0.4,
    minimumSearchDepth: 2,
  };
}

function summarizeRule(
  rule: string,
  matches: readonly PairedMatch[],
): RuleSummary {
  const decisions = matches.flatMap((match) => match.decisions);
  const hybridDecisions = decisions.filter(
    (decision) => decision.engine === "hybrid",
  );
  const baselineDecisions = decisions.filter(
    (decision) => decision.engine === "baseline",
  );

  return {
    rule,
    hybridWins: matches.filter((match) => match.outcome === "hybrid-win")
      .length,
    baselineWins: matches.filter((match) => match.outcome === "baseline-win")
      .length,
    draws: matches.filter((match) => match.outcome === "draw").length,
    truncations: matches.filter((match) => match.outcome === "truncated")
      .length,
    noMoves: matches.filter((match) => match.outcome === "no-move").length,
    hybridLatencyMs: latencySummary(hybridDecisions),
    baselineLatencyMs: latencySummary(baselineDecisions),
    latencyByPhaseMs: {
      opening: phaseLatencySummary(decisions, "opening"),
      midgame: phaseLatencySummary(decisions, "midgame"),
      late: phaseLatencySummary(decisions, "late"),
    },
    hybridMeanSimulations: mean(
      hybridDecisions.map((decision) => decision.simulations),
    ),
    baselineMeanSimulations: mean(
      baselineDecisions.map((decision) => decision.simulations),
    ),
    hybridMeanTreeNodes: mean(
      hybridDecisions.map((decision) => decision.treeNodes),
    ),
    baselineMeanTreeNodes: mean(
      baselineDecisions.map((decision) => decision.treeNodes),
    ),
    hybridMeanLookaheadNodes: mean(
      hybridDecisions.map((decision) => decision.lookaheadNodes),
    ),
    baselineMeanLookaheadNodes: mean(
      baselineDecisions.map((decision) => decision.lookaheadNodes),
    ),
    hybridMeanSelectedDepth: mean(
      hybridDecisions.map((decision) => decision.selectedDepth),
    ),
    baselineMeanSelectedDepth: mean(
      baselineDecisions.map((decision) => decision.selectedDepth),
    ),
    hybridMeanCompletedLookaheadDepth: mean(
      hybridDecisions.map((decision) => decision.completedLookaheadDepth),
    ),
    baselineMeanCompletedLookaheadDepth: mean(
      baselineDecisions.map((decision) => decision.completedLookaheadDepth),
    ),
  };
}

function compactMatch(match: PairedMatch) {
  const hybridDecisions = match.decisions.filter(
    (decision) => decision.engine === "hybrid",
  );
  const baselineDecisions = match.decisions.filter(
    (decision) => decision.engine === "baseline",
  );

  return {
    rule: match.rule,
    opening: match.opening,
    hybridPlayer: match.hybridPlayer,
    outcome: match.outcome,
    winner: match.winner,
    moves: match.moves,
    historyTail:
      match.outcome === "baseline-win" ? match.history.slice(-12) : undefined,
    hybrid: {
      decisions: hybridDecisions.length,
      latencyMs: latencySummary(hybridDecisions),
      meanSimulations: mean(
        hybridDecisions.map((decision) => decision.simulations),
      ),
      meanTreeNodes: mean(
        hybridDecisions.map((decision) => decision.treeNodes),
      ),
      meanLookaheadNodes: mean(
        hybridDecisions.map((decision) => decision.lookaheadNodes),
      ),
      meanSelectedDepth: mean(
        hybridDecisions.map((decision) => decision.selectedDepth),
      ),
    },
    baseline: {
      decisions: baselineDecisions.length,
      latencyMs: latencySummary(baselineDecisions),
      meanSimulations: mean(
        baselineDecisions.map((decision) => decision.simulations),
      ),
      meanTreeNodes: mean(
        baselineDecisions.map((decision) => decision.treeNodes),
      ),
      meanLookaheadNodes: mean(
        baselineDecisions.map((decision) => decision.lookaheadNodes),
      ),
      meanSelectedDepth: mean(
        baselineDecisions.map((decision) => decision.selectedDepth),
      ),
    },
  };
}

function phaseLatencySummary(
  decisions: readonly DecisionSample[],
  phase: DecisionSample["phase"],
) {
  return {
    hybrid: latencySummary(
      decisions.filter(
        (decision) => decision.engine === "hybrid" && decision.phase === phase,
      ),
    ),
    baseline: latencySummary(
      decisions.filter(
        (decision) =>
          decision.engine === "baseline" && decision.phase === phase,
      ),
    ),
  };
}

function gamePhase(
  movesPlayed: number,
  winCondition: WinCondition,
): DecisionSample["phase"] {
  const lengthOffset = winCondition.lineLength - 4;
  const openingEnd = 12 + lengthOffset * 8;
  const lateStart = 36 + lengthOffset * 20;
  if (movesPlayed < openingEnd) return "opening";
  if (movesPlayed < lateStart) return "midgame";
  return "late";
}

function latencySummary(decisions: readonly DecisionSample[]): {
  p50: number;
  p95: number;
} {
  const values = decisions
    .map((decision) => decision.elapsedMs)
    .sort((first, second) => first - second);
  return {
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
  };
}

function percentile(
  values: readonly number[],
  percentileValue: number,
): number {
  if (values.length === 0) return 0;
  const index = Math.min(
    values.length - 1,
    Math.max(0, Math.ceil(values.length * percentileValue) - 1),
  );
  return round(values[index]!);
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return round(
    values.reduce((total, value) => total + value, 0) / values.length,
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function decisionSeed(rule: string, opening: string, ply: number): number {
  let hash = 0x811c9dc5;
  for (const character of `${rule}:${opening}:${ply}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function finiteInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
