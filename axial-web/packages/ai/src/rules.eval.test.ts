import { describe, expect, it } from "vitest";
import {
  applyMove,
  cellCount,
  createGame,
  type Player,
  type WinCondition,
} from "@axial/core";
import {
  analyzeMctsMove,
  classicAiSearchOptionsForGame,
  chooseHeuristicMove,
} from "./index";

type RuleMatchSummary = {
  rule: WinCondition;
  maxPlayer: Player;
  winner: Player | 0;
  moves: number;
  maxDepth: number;
  maxLookaheadDepth: number;
  incompleteLookaheadDecisions: number;
  maxDecisionMs: number;
  simulations: number;
  maxLines: number;
  opponentLines: number;
  terminal: boolean;
  anchorOverrides: number;
  reasons: Record<"tactical" | "lookahead" | "search" | "heuristic", number>;
  trace?: RuleMoveTrace[];
};

type RuleMoveTrace = {
  ply: number;
  player: Player;
  agent: "max" | "heuristic";
  move: { row: number; col: number };
  strategicAnchor?: { row: number; col: number };
  reason?: "tactical" | "lookahead" | "search" | "heuristic";
  maxDepth?: number;
  lookaheadDepth?: number;
  lookaheadComplete?: boolean;
  simulations?: number;
  completedLinesAfter: number;
};

const ruleEvaluationEnabled = process.env.AXIAL_AI_RULE_EVAL === "1";
const fullRuleEvaluationEnabled = process.env.AXIAL_AI_FULL_RULE_EVAL === "1";
const variantEvaluationEnabled = process.env.AXIAL_AI_VARIANT_EVAL === "1";
const variantEvaluationFilter = process.env.AXIAL_AI_VARIANT ?? "all";
const variantSeatFilter = process.env.AXIAL_AI_SEAT;
const traceEnabled = process.env.AXIAL_AI_TRACE === "1";
const RULES: readonly WinCondition[] = [
  { lineLength: 4, linesToWin: 1 },
  { lineLength: 4, linesToWin: 2 },
  { lineLength: 4, linesToWin: 3 },
  { lineLength: 5, linesToWin: 1 },
  { lineLength: 5, linesToWin: 2 },
  { lineLength: 5, linesToWin: 3 },
];

describe.skipIf(!ruleEvaluationEnabled)("Classic AI rule matrix", () => {
  it("keeps a deterministic strategy floor in every Classic mode", () => {
    const summaries: RuleMatchSummary[] = [];

    for (const rule of RULES) {
      for (const maxPlayer of [1, 2] as const) {
        const summary = playRuleMatch(rule, maxPlayer, {
          maxMoves: 72,
          maxTimeMs: null,
          simulationCap: 0,
          lookaheadDepth: 0,
        });
        summaries.push(summary);
        console.log(`AXIAL_RULE_MATCH ${JSON.stringify(summary)}`);
      }
    }

    const maxWins = summaries.filter((summary) => {
      return summary.winner === summary.maxPlayer;
    }).length;
    const opponentWins = summaries.filter((summary) => {
      return summary.winner !== 0 && summary.winner !== summary.maxPlayer;
    }).length;
    const cumulativeLineSummaries = summaries.filter(
      (summary) => summary.rule.linesToWin > 1,
    );
    const maxCumulativeLines = cumulativeLineSummaries.reduce(
      (total, summary) => total + summary.maxLines,
      0,
    );
    const opponentCumulativeLines = cumulativeLineSummaries.reduce(
      (total, summary) => total + summary.opponentLines,
      0,
    );

    expect(summaries).toHaveLength(RULES.length * 2);
    expect(summaries.every((summary) => summary.maxDepth === 0)).toBe(true);
    expect(summaries.every((summary) => summary.maxDecisionMs < 600)).toBe(
      true,
    );
    expect(maxWins).toBeGreaterThanOrEqual(opponentWins);
    expect(maxCumulativeLines).toBeGreaterThanOrEqual(opponentCumulativeLines);
  }, 180_000);
});

describe.skipIf(!fullRuleEvaluationEnabled)(
  "Classic AI full-budget cumulative-line challenge",
  () => {
    it("scores Max against the rule-aware heuristic from both seats in two-line mode", () => {
      const seats = ([1, 2] as const).filter(
        (player) =>
          variantSeatFilter === undefined ||
          Number(variantSeatFilter) === player,
      );
      const summaries = seats.map((maxPlayer) => {
        const summary = playRuleMatch(
          { lineLength: 4, linesToWin: 2 },
          maxPlayer,
          {
            maxMoves: cellCount(
              createGame({ lineLength: 4, linesToWin: 2 }).dimensions,
            ),
          },
        );
        console.log(`AXIAL_FULL_RULE_MATCH ${JSON.stringify(summary)}`);
        return summary;
      });

      const maxWins = summaries.filter(
        (summary) => summary.winner === summary.maxPlayer,
      ).length;
      const opponentWins = summaries.filter(
        (summary) =>
          summary.winner !== 0 && summary.winner !== summary.maxPlayer,
      ).length;

      expect(summaries.every((summary) => summary.terminal)).toBe(true);
      if (variantSeatFilter === undefined) {
        expect(maxWins).toBeGreaterThanOrEqual(opponentWins);
        expect(maxWins).toBeGreaterThanOrEqual(1);
      }
      expect(summaries.every((summary) => summary.maxDepth >= 4)).toBe(true);
    }, 240_000);
  },
);

const VARIANT_CHALLENGES = [
  {
    id: "connect4-three-lines",
    rule: { lineLength: 4, linesToWin: 3 },
  },
  {
    id: "connect5-standard",
    rule: { lineLength: 5, linesToWin: 1 },
  },
  {
    id: "connect5-two-lines",
    rule: { lineLength: 5, linesToWin: 2 },
  },
  {
    id: "connect5-three-lines",
    rule: { lineLength: 5, linesToWin: 3 },
  },
] as const satisfies readonly {
  id: string;
  rule: WinCondition;
}[];

describe.skipIf(!variantEvaluationEnabled)(
  "Classic AI full-budget variant challenges",
  () => {
    for (const challenge of VARIANT_CHALLENGES) {
      const challengeEnabled =
        variantEvaluationFilter === "all" ||
        variantEvaluationFilter === challenge.id;
      const summaries: RuleMatchSummary[] = [];

      for (const maxPlayer of [1, 2] as const) {
        it.skipIf(
          !challengeEnabled ||
            (variantSeatFilter !== undefined &&
              Number(variantSeatFilter) !== maxPlayer),
        )(
          `finishes ${challenge.id} with Max as Player ${maxPlayer}`,
          () => {
            const summary = playRuleMatch(challenge.rule, maxPlayer, {
              maxMoves: cellCount(createGame(challenge.rule).dimensions),
            });
            summaries.push(summary);
            console.log(
              `AXIAL_VARIANT_MATCH ${JSON.stringify({ id: challenge.id, ...summary })}`,
            );
            const minimumSearchDepth =
              classicAiSearchOptionsForGame(
                "nightmare",
                createGame(challenge.rule),
              ).minimumSearchDepth ?? 0;

            expect(summary.terminal).toBe(true);
            expect(
              summary.simulations === 0 ||
                summary.maxDepth >= minimumSearchDepth,
            ).toBe(true);
          },
          900_000,
        );
      }

      it.skipIf(!challengeEnabled || variantSeatFilter !== undefined)(
        `scores the alternating-seat ${challenge.id} pair`,
        () => {
          const maxWins = summaries.filter(
            (summary) => summary.winner === summary.maxPlayer,
          ).length;
          const opponentWins = summaries.filter(
            (summary) =>
              summary.winner !== 0 && summary.winner !== summary.maxPlayer,
          ).length;
          const maxLines = summaries.reduce(
            (total, summary) => total + summary.maxLines,
            0,
          );
          const opponentLines = summaries.reduce(
            (total, summary) => total + summary.opponentLines,
            0,
          );

          expect(summaries).toHaveLength(2);
          expect(maxWins).toBeGreaterThanOrEqual(opponentWins);
          expect(maxWins).toBeGreaterThanOrEqual(1);
          expect(maxLines).toBeGreaterThanOrEqual(opponentLines);
        },
        1_000,
      );
    }
  },
);

function playRuleMatch(
  rule: WinCondition,
  maxPlayer: Player,
  budget: {
    maxMoves: number;
    maxTimeMs?: number | null;
    simulationCap?: number;
    lookaheadNodeLimit?: number;
    lookaheadDepth?: number;
  },
): RuleMatchSummary {
  let game = createGame(rule);
  let maxDepth = 0;
  let maxLookaheadDepth = 0;
  let incompleteLookaheadDecisions = 0;
  let maxDecisionMs = 0;
  let simulations = 0;
  let anchorOverrides = 0;
  const reasons = {
    tactical: 0,
    lookahead: 0,
    search: 0,
    heuristic: 0,
  };
  const trace: RuleMoveTrace[] | null = traceEnabled ? [] : null;

  while (
    game.status.state === "playing" &&
    game.moveHistory.length < budget.maxMoves
  ) {
    const player = game.currentPlayer;
    if (player !== maxPlayer) {
      const move = chooseHeuristicMove(game);
      if (!move) break;
      game = applyMove(game, move);
      trace?.push({
        ply: game.moveHistory.length,
        player,
        agent: "heuristic",
        move,
        completedLinesAfter: game.completedLines.filter(
          (line) => line.player === player,
        ).length,
      });
      continue;
    }

    const strategicAnchor = chooseHeuristicMove(game);
    const preset = classicAiSearchOptionsForGame("nightmare", game);
    const result = analyzeMctsMove(game, {
      ...preset,
      simulations:
        budget.simulationCap === undefined
          ? preset.simulations
          : Math.min(
              budget.simulationCap,
              preset.simulations ?? budget.simulationCap,
            ),
      maxTimeMs:
        budget.maxTimeMs === null
          ? undefined
          : (budget.maxTimeMs ?? preset.maxTimeMs),
      lookaheadNodeLimit:
        budget.lookaheadNodeLimit ?? preset.lookaheadNodeLimit,
      lookaheadDepth: budget.lookaheadDepth ?? preset.lookaheadDepth,
      seed:
        313 +
        game.moveHistory.length * 17 +
        maxPlayer +
        rule.lineLength * 101 +
        rule.linesToWin * 1_009,
    });
    if (!result) break;

    maxDepth = Math.max(maxDepth, result.maxDepth);
    maxLookaheadDepth = Math.max(maxLookaheadDepth, result.lookaheadDepth);
    if (result.lookaheadDepth > 0 && !result.lookaheadComplete) {
      incompleteLookaheadDecisions += 1;
    }
    maxDecisionMs = Math.max(maxDecisionMs, result.elapsedMs);
    simulations += result.simulations;
    reasons[result.reason] += 1;
    if (
      strategicAnchor &&
      (strategicAnchor.row !== result.move.row ||
        strategicAnchor.col !== result.move.col)
    ) {
      anchorOverrides += 1;
    }
    game = applyMove(game, result.move);
    trace?.push({
      ply: game.moveHistory.length,
      player,
      agent: "max",
      move: result.move,
      ...(strategicAnchor ? { strategicAnchor } : {}),
      reason: result.reason,
      maxDepth: result.maxDepth,
      lookaheadDepth: result.lookaheadDepth,
      lookaheadComplete: result.lookaheadComplete,
      simulations: result.simulations,
      completedLinesAfter: game.completedLines.filter(
        (line) => line.player === player,
      ).length,
    });
  }

  return {
    rule,
    maxPlayer,
    winner: game.status.state === "won" ? game.status.winner : 0,
    moves: game.moveHistory.length,
    maxDepth,
    maxLookaheadDepth,
    incompleteLookaheadDecisions,
    maxDecisionMs,
    simulations,
    maxLines: game.completedLines.filter((line) => line.player === maxPlayer)
      .length,
    opponentLines: game.completedLines.filter(
      (line) => line.player !== maxPlayer,
    ).length,
    terminal: game.status.state !== "playing",
    anchorOverrides,
    reasons,
    ...(trace ? { trace } : {}),
  };
}
