import { describe, it } from "vitest";
import { replayMoves, type Move } from "@axial/core";
import {
  ClassicSearchState,
  analyzeMctsMove,
  analyzeHeuristicMove,
  classicAiSearchOptionsForGame,
  findForcingMoves,
  findLineCompletionMoves,
  findWinningMoves,
  moveFromIndex,
  selectTacticalMove,
  selectLookaheadMove,
} from "./index";

const forensicsEnabled = process.env.AXIAL_AI_FORENSICS === "1";

const TWO_LINE_MAX_SECOND_LOSS = [
  { row: 4, col: 2 },
  { row: 3, col: 3 },
  { row: 2, col: 2 },
  { row: 3, col: 2 },
  { row: 3, col: 1 },
  { row: 1, col: 3 },
  { row: 3, col: 5 },
  { row: 4, col: 1 },
  { row: 2, col: 3 },
  { row: 2, col: 1 },
  { row: 4, col: 4 },
  { row: 4, col: 3 },
  { row: 2, col: 4 },
  { row: 2, col: 5 },
  { row: 3, col: 4 },
  { row: 1, col: 2 },
  { row: 5, col: 3 },
  { row: 5, col: 4 },
  { row: 1, col: 4 },
  { row: 2, col: 0 },
  { row: 2, col: 6 },
] as const satisfies readonly Move[];

const STANDARD_MAX_SECOND_LOSS = [
  { row: 2, col: 3 },
  { row: 1, col: 3 },
  { row: 3, col: 2 },
  { row: 1, col: 4 },
  { row: 1, col: 2 },
  { row: 2, col: 3 },
  { row: 2, col: 2 },
  { row: 4, col: 2 },
  { row: 0, col: 2 },
] as const satisfies readonly Move[];

const CURRENT_TWO_LINE_MAX_SECOND_LOSS = [
  { row: 3, col: 4 },
  { row: 3, col: 4 },
  { row: 2, col: 4 },
  { row: 4, col: 4 },
  { row: 2, col: 1 },
  { row: 2, col: 4 },
  { row: 1, col: 1 },
  { row: 4, col: 4 },
  { row: 3, col: 1 },
  { row: 4, col: 1 },
  { row: 1, col: 3 },
  { row: 0, col: 1 },
  { row: 2, col: 3 },
  { row: 2, col: 2 },
  { row: 1, col: 4 },
  { row: 1, col: 4 },
  { row: 1, col: 2 },
  { row: 4, col: 5 },
  { row: 0, col: 4 },
] as const satisfies readonly Move[];

const TWO_LINE_MAX_VS_HARD_SECOND_LOSS = [
  { row: 1, col: 3 },
  { row: 1, col: 3 },
  { row: 2, col: 3 },
  { row: 3, col: 3 },
  { row: 2, col: 2 },
  { row: 2, col: 4 },
  { row: 3, col: 1 },
  { row: 0, col: 4 },
  { row: 4, col: 0 },
  { row: 2, col: 1 },
  { row: 1, col: 2 },
  { row: 3, col: 4 },
  { row: 1, col: 4 },
  { row: 1, col: 5 },
  { row: 1, col: 1 },
] as const satisfies readonly Move[];

const TWO_LINE_MAX_VS_HARD_FIRST_LOSS = [
  { row: 2, col: 3 },
  { row: 4, col: 3 },
  { row: 2, col: 3 },
  { row: 2, col: 1 },
  { row: 2, col: 3 },
  { row: 2, col: 3 },
  { row: 3, col: 2 },
  { row: 4, col: 1 },
  { row: 1, col: 4 },
  { row: 3, col: 1 },
  { row: 0, col: 5 },
  { row: 4, col: 2 },
  { row: 3, col: 4 },
  { row: 4, col: 4 },
  { row: 1, col: 1 },
  { row: 5, col: 1 },
] as const satisfies readonly Move[];

const CAPTURED_LOSSES = [
  {
    label: "pre-overhaul-two-lines",
    moves: TWO_LINE_MAX_SECOND_LOSS,
    winCondition: { lineLength: 4, linesToWin: 2 },
    maxPlayer: 2,
  },
  {
    label: "hybrid-standard",
    moves: STANDARD_MAX_SECOND_LOSS,
    winCondition: { lineLength: 4, linesToWin: 1 },
    maxPlayer: 2,
  },
  {
    label: "hybrid-two-lines",
    moves: CURRENT_TWO_LINE_MAX_SECOND_LOSS,
    winCondition: { lineLength: 4, linesToWin: 2 },
    maxPlayer: 2,
  },
  {
    label: "hybrid-vs-hard-two-lines-max-second",
    moves: TWO_LINE_MAX_VS_HARD_SECOND_LOSS,
    winCondition: { lineLength: 4, linesToWin: 2 },
    maxPlayer: 2,
  },
  {
    label: "hybrid-vs-hard-two-lines-max-first",
    moves: TWO_LINE_MAX_VS_HARD_FIRST_LOSS,
    winCondition: { lineLength: 4, linesToWin: 2 },
    maxPlayer: 1,
  },
] as const;

describe.skipIf(!forensicsEnabled)("Classic captured-loss forensics", () => {
  it.each(CAPTURED_LOSSES)(
    "reports the threat state before every Max move in $label",
    ({ label, moves, winCondition, maxPlayer }) => {
      const firstMaxPly = maxPlayer === 1 ? 0 : 1;
      for (let ply = firstMaxPly; ply < moves.length; ply += 2) {
        const prefix = moves.slice(0, ply);
        const game = replayMoves(prefix, winCondition);
        if (
          game.status.state !== "playing" ||
          game.currentPlayer !== maxPlayer
        ) {
          break;
        }

        const state = ClassicSearchState.fromGame(game);
        const toMoves = (indices: readonly number[]) =>
          indices.map((moveIndex) => {
            const move = moveFromIndex(moveIndex, state.dimensions);
            return { row: move.row, col: move.col };
          });
        const selected = moves[ply];
        const opponent = maxPlayer === 1 ? 2 : 1;
        const tactical = selectTacticalMove(state, maxPlayer, "forced-only");
        const defensiveCandidates = state
          .legalMoveIndices()
          .map((moveIndex) => {
            state.makeMove(moveIndex, maxPlayer);
            const opponentForks = findForcingMoves(state, opponent).filter(
              (move) => move.kind === "fork",
            ).length;
            const opponentWins = findWinningMoves(state, opponent).length;
            state.unmakeMove();

            return {
              move: toMoves([moveIndex])[0],
              opponentForks,
              opponentWins,
            };
          })
          .sort(
            (first, second) =>
              first.opponentWins - second.opponentWins ||
              first.opponentForks - second.opponentForks,
          )
          .slice(0, 8);

        console.log(
          `AXIAL_FORENSICS ${JSON.stringify({
            label,
            beforePly: ply + 1,
            maxPlayer,
            selected,
            tactical:
              tactical === null
                ? null
                : {
                    move: toMoves([tactical.moveIndex])[0],
                    reason: tactical.reason,
                  },
            heuristic: analyzeHeuristicMove(game)?.move ?? null,
            maxWins: toMoves(findWinningMoves(state, maxPlayer)),
            opponentWins: toMoves(findWinningMoves(state, opponent)),
            maxLineCompletions: findLineCompletionMoves(state, maxPlayer).map(
              (entry) => ({
                move: toMoves([entry.moveIndex])[0],
                completions: entry.completions,
              }),
            ),
            opponentLineCompletions: findLineCompletionMoves(
              state,
              opponent,
            ).map((entry) => ({
              move: toMoves([entry.moveIndex])[0],
              completions: entry.completions,
            })),
            maxForcing: findForcingMoves(state, maxPlayer).map((entry) => ({
              move: toMoves([entry.moveIndex])[0],
              kind: entry.kind,
              threats: entry.threats,
            })),
            opponentForcing: findForcingMoves(state, opponent).map((entry) => ({
              move: toMoves([entry.moveIndex])[0],
              kind: entry.kind,
              threats: entry.threats,
            })),
            completedLines: {
              1: state.completedLineCount(1),
              2: state.completedLineCount(2),
            },
            defensiveCandidates,
          })}`,
        );
      }
    },
  );

  it("compares common-depth search on the standard loss opening", () => {
    const game = replayMoves(STANDARD_MAX_SECOND_LOSS.slice(0, 1), {
      lineLength: 4,
      linesToWin: 1,
    });
    const state = ClassicSearchState.fromGame(game);

    for (const depth of [3]) {
      const result = selectLookaheadMove(state, 2, {
        depth,
        maxMoves: 12,
        rootMaxMoves: 18,
        nodeLimit: 100_000,
        quiescenceDepth: 2,
      });

      console.log(
        `AXIAL_FORENSICS_LOOKAHEAD ${JSON.stringify({
          depth,
          selected:
            result === null
              ? null
              : moveFromIndex(result.moveIndex, state.dimensions),
          completedDepth: result?.completedDepth ?? 0,
          partialDepth: result?.partialDepth ?? 0,
          nodes: result?.nodes ?? 0,
          top: result?.candidates.slice(0, 8).map((candidate) => ({
            move: moveFromIndex(candidate.moveIndex, state.dimensions),
            score: candidate.score,
            completedDepth: candidate.completedDepth,
          })),
        })}`,
      );
    }
  });

  it("compares Hard and Max at the first two-line race divergence", () => {
    const cases = [
      {
        label: "max-first-before-bank",
        game: replayMoves(TWO_LINE_MAX_VS_HARD_FIRST_LOSS.slice(0, 10), {
          lineLength: 4,
          linesToWin: 2,
        }),
        seed: 22 + 10 * 101,
      },
      {
        label: "max-second-before-line-race",
        game: replayMoves(TWO_LINE_MAX_VS_HARD_SECOND_LOSS.slice(0, 7), {
          lineLength: 4,
          linesToWin: 2,
        }),
        seed: 21 + 7 * 101,
      },
    ];

    for (const forensicCase of cases) {
      for (const difficulty of ["hard", "nightmare"] as const) {
        const result = analyzeMctsMove(forensicCase.game, {
          ...classicAiSearchOptionsForGame(difficulty, forensicCase.game),
          seed: forensicCase.seed,
        });
        console.log(
          `AXIAL_FORENSICS_DIFFICULTY ${JSON.stringify({
            label: forensicCase.label,
            difficulty,
            move: result?.move ?? null,
            reason: result?.reason ?? null,
            selectedDepth: result?.telemetry.selectedMoveDepth ?? 0,
            maxDepth: result?.maxDepth ?? 0,
            simulations: result?.simulations ?? 0,
            lookaheadCompletedDepth: result?.lookaheadCompletedDepth ?? 0,
            lookaheadPartialDepth: result?.lookaheadPartialDepth ?? 0,
            elapsedMs: result?.elapsedMs ?? 0,
            top: result?.stats.slice(0, 6) ?? [],
          })}`,
        );
      }
    }
  }, 120_000);

  it("compares focused depth-four roots at the remaining Hard divergence", () => {
    const game = replayMoves(TWO_LINE_MAX_VS_HARD_SECOND_LOSS.slice(0, 7), {
      lineLength: 4,
      linesToWin: 2,
    });
    const state = ClassicSearchState.fromGame(game);

    for (const rootMaxMoves of [18, 14]) {
      const result = selectLookaheadMove(state, game.currentPlayer, {
        depth: 4,
        maxMoves: rootMaxMoves === 18 ? 12 : 10,
        rootMaxMoves,
        nodeLimit: 24_000,
        quiescenceDepth: 2,
      });
      console.log(
        `AXIAL_FORENSICS_FOCUSED_ROOT ${JSON.stringify({
          rootMaxMoves,
          selected:
            result === null
              ? null
              : moveFromIndex(result.moveIndex, state.dimensions),
          completedDepth: result?.completedDepth ?? 0,
          partialDepth: result?.partialDepth ?? 0,
          nodes: result?.nodes ?? 0,
          top: result?.candidates.slice(0, 10).map((candidate) => ({
            move: moveFromIndex(candidate.moveIndex, state.dimensions),
            score: candidate.score,
            completedDepth: candidate.completedDepth,
          })),
        })}`,
      );
    }
  }, 120_000);

  it("compares common depths at the frozen captured blunder", () => {
    const game = replayMoves(TWO_LINE_MAX_SECOND_LOSS.slice(0, 15), {
      lineLength: 4,
      linesToWin: 2,
    });
    const state = ClassicSearchState.fromGame(game);

    for (const depth of [3, 4]) {
      const result = selectLookaheadMove(state, game.currentPlayer, {
        depth,
        maxMoves: 12,
        rootMaxMoves: 18,
        nodeLimit: 100_000,
        quiescenceDepth: 3,
      });
      console.log(
        `AXIAL_FORENSICS_CAPTURED_DEPTH ${JSON.stringify({
          depth,
          selected:
            result === null
              ? null
              : moveFromIndex(result.moveIndex, state.dimensions),
          completedDepth: result?.completedDepth ?? 0,
          nodes: result?.nodes ?? 0,
          top: result?.candidates.slice(0, 12).map((candidate) => ({
            move: moveFromIndex(candidate.moveIndex, state.dimensions),
            score: candidate.score,
          })),
        })}`,
      );
    }
  }, 120_000);

  it("locates the first avoidable decision in the frozen two-line loss", () => {
    for (let ply = 1; ply <= 15; ply += 2) {
      const game = replayMoves(TWO_LINE_MAX_SECOND_LOSS.slice(0, ply), {
        lineLength: 4,
        linesToWin: 2,
      });
      const state = ClassicSearchState.fromGame(game);
      const result = selectLookaheadMove(state, game.currentPlayer, {
        depth: 3,
        maxMoves: 12,
        rootMaxMoves: 18,
        nodeLimit: 20_000,
        quiescenceDepth: 3,
      });
      const capturedMove = TWO_LINE_MAX_SECOND_LOSS[ply];
      const capturedMoveIndex =
        capturedMove === undefined
          ? null
          : (state.legalMoveIndices().find((moveIndex) => {
              const move = moveFromIndex(moveIndex, state.dimensions);
              return (
                move.row === capturedMove.row && move.col === capturedMove.col
              );
            }) ?? null);
      const capturedCandidate = result?.candidates.find(
        (candidate) => candidate.moveIndex === capturedMoveIndex,
      );
      console.log(
        `AXIAL_FORENSICS_LOSS_BOUNDARY ${JSON.stringify({
          beforePly: ply + 1,
          capturedMove,
          selected:
            result === null
              ? null
              : moveFromIndex(result.moveIndex, state.dimensions),
          selectedScore: result?.score ?? null,
          capturedScore: capturedCandidate?.score ?? null,
          completedDepth: result?.completedDepth ?? 0,
          nodes: result?.nodes ?? 0,
        })}`,
      );
    }
  }, 120_000);
});
