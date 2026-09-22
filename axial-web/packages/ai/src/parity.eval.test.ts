import { describe, expect, it } from "vitest";
import {
  MAX_BOARD_DIMENSION,
  MIN_BOARD_COLUMNS,
  MIN_BOARD_HEIGHT,
  MIN_BOARD_ROWS,
  applyMove,
  createGame,
  legalMoves,
  type BoardDimensions,
  type GameSnapshot,
  type WinCondition,
} from "@axial/core";
import { ClassicSearchState, createSeededRandom } from "./index";

const parityEvaluationEnabled = process.env.AXIAL_AI_PARITY_EVAL === "1";

const RULES = [
  { lineLength: 4, linesToWin: 1 },
  { lineLength: 4, linesToWin: 2 },
  { lineLength: 4, linesToWin: 3 },
  { lineLength: 5, linesToWin: 1 },
  { lineLength: 5, linesToWin: 2 },
  { lineLength: 5, linesToWin: 3 },
] as const satisfies readonly WinCondition[];

describe.skipIf(!parityEvaluationEnabled)(
  "Classic canonical/search-state exhaustive dimension parity",
  () => {
    it("matches every supported dimension and Classic rule combination", () => {
      let games = 0;
      let positions = 0;

      for (const dimensions of supportedDimensions()) {
        for (const rule of RULES) {
          const seed =
            dimensions.height * 1_000_003 +
            dimensions.rows * 10_007 +
            dimensions.columns * 101 +
            rule.lineLength * 17 +
            rule.linesToWin;
          const random = createSeededRandom(seed);
          const startingPlayer = seed % 2 === 0 ? 1 : 2;
          let game = createGame(rule, dimensions, startingPlayer);

          assertParity(game, dimensions, rule, positions);
          positions += 1;

          while (game.status.state === "playing") {
            const moves = legalMoves(game.board, dimensions);
            const move = moves[Math.floor(random() * moves.length)];
            if (!move) {
              throw new Error(
                `No legal move in playing game ${dimensionLabel(dimensions)} ${ruleLabel(rule)}`,
              );
            }

            game = applyMove(game, move);
            assertParity(game, dimensions, rule, positions);
            positions += 1;
          }

          games += 1;
        }
      }

      console.log(
        `AXIAL_PARITY ${JSON.stringify({ games, positions, rules: RULES.length, dimensions: supportedDimensions().length })}`,
      );
      expect(games).toBe(supportedDimensions().length * RULES.length);
      expect(positions).toBeGreaterThan(games);
    }, 900_000);
  },
);

function assertParity(
  game: GameSnapshot,
  dimensions: BoardDimensions,
  rule: WinCondition,
  position: number,
): void {
  const search = ClassicSearchState.fromGame(game);

  if (search.board.length !== game.board.length) {
    throw parityError("board length", dimensions, rule, position);
  }
  for (let index = 0; index < game.board.length; index += 1) {
    if (search.board[index] !== game.board[index]) {
      throw parityError(`board cell ${index}`, dimensions, rule, position);
    }
  }

  for (const player of [1, 2] as const) {
    const canonicalLines = game.completedLines.filter(
      (line) => line.player === player,
    ).length;
    if (search.completedLineCount(player) !== canonicalLines) {
      throw parityError(
        `Player ${player} lines ${search.completedLineCount(player)} != ${canonicalLines}`,
        dimensions,
        rule,
        position,
      );
    }
  }

  const canonicalWinner =
    game.status.state === "won" ? game.status.winner : null;
  if (search.winner !== canonicalWinner) {
    throw parityError(
      `winner ${String(search.winner)} != ${String(canonicalWinner)}`,
      dimensions,
      rule,
      position,
    );
  }
}

function supportedDimensions(): BoardDimensions[] {
  const dimensions: BoardDimensions[] = [];

  for (
    let height = MIN_BOARD_HEIGHT;
    height <= MAX_BOARD_DIMENSION;
    height += 1
  ) {
    for (let rows = MIN_BOARD_ROWS; rows <= MAX_BOARD_DIMENSION; rows += 1) {
      for (
        let columns = MIN_BOARD_COLUMNS;
        columns <= MAX_BOARD_DIMENSION;
        columns += 1
      ) {
        dimensions.push({ height, rows, columns });
      }
    }
  }

  return dimensions;
}

function parityError(
  message: string,
  dimensions: BoardDimensions,
  rule: WinCondition,
  position: number,
): Error {
  return new Error(
    `Parity mismatch (${message}) at generated position ${position}, ${dimensionLabel(dimensions)}, ${ruleLabel(rule)}`,
  );
}

function dimensionLabel(dimensions: BoardDimensions): string {
  return `${dimensions.height}x${dimensions.rows}x${dimensions.columns}`;
}

function ruleLabel(rule: WinCondition): string {
  return `connect-${rule.lineLength}/${rule.linesToWin}-lines`;
}
