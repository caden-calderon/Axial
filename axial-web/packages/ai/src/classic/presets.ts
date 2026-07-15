import {
  DEFAULT_BOARD_DIMENSIONS,
  DEFAULT_WIN_CONDITION,
  type GameSnapshot,
} from "@axial/core";
import type { MctsOptions } from "./mcts";

export type ClassicAiDifficulty = "easy" | "medium" | "hard" | "nightmare";

type ClassicAiSearchPreset = MctsOptions & {
  simulations: number;
  maxTimeMs: number;
  earlyExitVisits: number;
  minimumSearchDepth: number;
};

const SEARCH_PRESETS = {
  easy: {
    simulations: 32,
    maxTimeMs: 140,
    progressiveBias: 0.08,
    lookaheadDepth: 0,
    lookaheadWeight: 0,
    lookaheadTimeFraction: 0.05,
    smartRolloutRate: 0.45,
    earlyExitVisits: 24,
    earlyExitRatio: 0.92,
    useRave: false,
    tacticalMode: "immediate-only",
    progressiveWidening: false,
    minimumSearchDepth: 1,
  },
  medium: {
    simulations: 320,
    maxTimeMs: 420,
    progressiveBias: 0.14,
    lookaheadDepth: 1,
    lookaheadMaxMoves: 8,
    lookaheadRootMaxMoves: 10,
    lookaheadNodeLimit: 900,
    lookaheadWeight: 0.16,
    lookaheadTimeFraction: 0.22,
    smartRolloutRate: 0.62,
    earlyExitVisits: 180,
    earlyExitRatio: 0.95,
    useRave: true,
    tacticalMode: "forced-only",
    progressiveWidening: true,
    progressiveWideningBase: 10,
    progressiveWideningExponent: 0.55,
    minimumSearchDepth: 2,
  },
  hard: {
    simulations: 1_600,
    maxTimeMs: 1_400,
    progressiveBias: 0.2,
    lookaheadDepth: 2,
    lookaheadMaxMoves: 10,
    lookaheadRootMaxMoves: 14,
    lookaheadNodeLimit: 4_000,
    lookaheadWeight: 0.36,
    lookaheadTimeFraction: 0.3,
    lookaheadOverrideMargin: 72_000,
    smartRolloutRate: 0.76,
    earlyExitVisits: 700,
    earlyExitRatio: 0.97,
    useRave: true,
    tacticalMode: "forced-only",
    progressiveWidening: true,
    progressiveWideningBase: 6,
    progressiveWideningExponent: 0.45,
    minimumSearchDepth: 3,
  },
  nightmare: {
    simulations: 6_000,
    maxTimeMs: 3_600,
    progressiveBias: 0.26,
    lookaheadDepth: 3,
    lookaheadMaxMoves: 12,
    lookaheadRootMaxMoves: 18,
    lookaheadNodeLimit: 16_000,
    lookaheadWeight: 0.62,
    lookaheadTimeFraction: 0.36,
    lookaheadOverrideMargin: 34_000,
    smartRolloutRate: 0.86,
    earlyExitVisits: 2_200,
    earlyExitRatio: 0.985,
    useRave: true,
    tacticalMode: "forced-only",
    progressiveWidening: true,
    progressiveWideningBase: 4,
    progressiveWideningExponent: 0.4,
    minimumSearchDepth: 3,
  },
} as const satisfies Record<ClassicAiDifficulty, ClassicAiSearchPreset>;

const BOARD_SCALE = {
  easy: 0.22,
  medium: 0.48,
  hard: 0.78,
  nightmare: 1.16,
} as const satisfies Record<ClassicAiDifficulty, number>;

export function classicAiSearchOptionsForGame(
  difficulty: ClassicAiDifficulty,
  game: GameSnapshot,
): MctsOptions {
  const preset: ClassicAiSearchPreset = SEARCH_PRESETS[difficulty];
  const winRuleMultiplier =
    1 +
    (game.winCondition.linesToWin - 1) * 0.34 +
    (game.winCondition.lineLength - DEFAULT_WIN_CONDITION.lineLength) * 0.16;
  const boardArea =
    (game.dimensions.rows * game.dimensions.columns) /
    (DEFAULT_BOARD_DIMENSIONS.rows * DEFAULT_BOARD_DIMENSIONS.columns);
  const boardBreadthMultiplier =
    1 + (Math.sqrt(boardArea) - 1) * BOARD_SCALE[difficulty];
  const heightMultiplier =
    1 +
    Math.max(0, game.dimensions.height - DEFAULT_BOARD_DIMENSIONS.height) *
      (difficulty === "nightmare" ? 0.055 : 0.04);
  const multiplier =
    winRuleMultiplier * boardBreadthMultiplier * heightMultiplier;
  const earlyExitMultiplier = Math.min(
    multiplier,
    difficulty === "nightmare" ? 2 : 1.65,
  );
  const lookaheadBreadthMultiplier =
    1 + (Math.sqrt(boardArea) - 1) * (difficulty === "nightmare" ? 0.38 : 0.24);
  const lookaheadNodeMultiplier = Math.min(
    multiplier,
    difficulty === "nightmare" ? 2.2 : 1.7,
  );
  const additionalLookaheadDepth =
    difficulty === "nightmare"
      ? Math.min(2, game.winCondition.linesToWin - 1)
      : difficulty === "hard" && game.winCondition.linesToWin > 1
        ? 1
        : 0;
  const lineRaceMultiplier =
    1 + Math.max(0, game.winCondition.linesToWin - 1) * 0.22;
  const minimumSearchDepth =
    preset.minimumSearchDepth +
    (difficulty === "nightmare" && game.winCondition.linesToWin > 1 ? 1 : 0);

  return {
    ...preset,
    simulations: Math.round(preset.simulations * multiplier),
    maxTimeMs: Math.round(preset.maxTimeMs * multiplier),
    earlyExitVisits: Math.round(preset.earlyExitVisits * earlyExitMultiplier),
    lookaheadDepth:
      preset.lookaheadDepth === undefined
        ? undefined
        : preset.lookaheadDepth + additionalLookaheadDepth,
    lookaheadWeight:
      preset.lookaheadWeight === undefined
        ? undefined
        : Math.min(0.9, preset.lookaheadWeight * lineRaceMultiplier),
    lookaheadOverrideMargin:
      preset.lookaheadOverrideMargin === undefined
        ? undefined
        : Math.round(preset.lookaheadOverrideMargin / lineRaceMultiplier),
    lookaheadTimeFraction:
      preset.lookaheadTimeFraction === undefined
        ? undefined
        : Math.min(
            0.48,
            preset.lookaheadTimeFraction +
              Math.max(0, game.winCondition.linesToWin - 1) * 0.04,
          ),
    minimumSearchDepth,
    lookaheadRootMaxMoves:
      preset.lookaheadRootMaxMoves === undefined
        ? undefined
        : Math.round(preset.lookaheadRootMaxMoves * lookaheadBreadthMultiplier),
    lookaheadNodeLimit:
      preset.lookaheadNodeLimit === undefined
        ? undefined
        : Math.round(preset.lookaheadNodeLimit * lookaheadNodeMultiplier),
  };
}
