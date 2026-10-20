// Stages a classic-board match for the trailer under the real rules. Self-play wins on the floor
// in 9-20 moves, which hides the third dimension, so the finish is designed instead:
//
//   orange's piece at row 2, col 4, layer 3 forks: it makes three in a row on layer 3 (cols 2-4,
//   open at col 1) and lifts the column so the top step of a staircase (cols 1-4, layers 1-4)
//   becomes playable. Blue blocks the row; orange climbs the staircase and wins.
//
// Random filler pieces are scattered around that skeleton until the position is believable: no
// threats before the fork, exactly those two after it, and blue never has a win. Then a move
// order is searched in which players alternate, pieces stack by gravity and nobody ever passes up
// an immediate win (so a threat can only appear in the fork itself).
//
//   node <bundle> [SEED=n] [PIECES=31]   (bundle with esbuild; see axial-video/README.md)
import { applyMove, createGame, type GameSnapshot, type Move, type Player } from '@axial/core';

type Stack = { row: number; col: number; players: Player[] };
type Design = { stacks: Stack[]; finish: Move[] };

const DIMENSIONS = { height: 6, rows: 6, columns: 7 };
const WIN = { lineLength: 4, linesToWin: 1 };
const FINISH: Move[] = [
	{ row: 2, col: 4 },
	{ row: 2, col: 1 },
	{ row: 2, col: 4 }
];

function seededRandom(start: number) {
	let state = start >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function winningMoves(game: GameSnapshot): Move[] {
	const wins: Move[] = [];
	for (let row = 0; row < game.dimensions.rows; row += 1) {
		for (let col = 0; col < game.dimensions.columns; col += 1) {
			try {
				if (applyMove(game, { row, col }).status.state === 'won') wins.push({ row, col });
			} catch {
				// Full column.
			}
		}
	}
	return wins;
}

function generate(random: () => number, pieceCount: number): Design {
	const stacks = new Map<string, Player[]>();
	const fillers: { id: string; index: number }[] = [];
	const at = (row: number, col: number) => {
		const id = `${row}:${col}`;
		if (!stacks.has(id)) stacks.set(id, []);
		return stacks.get(id)!;
	};
	const filler = (row: number, col: number) => {
		const stack = at(row, col);
		fillers.push({ id: `${row}:${col}`, index: stack.length });
		stack.push(random() < 0.5 ? 1 : 2);
	};
	filler(2, 2);
	filler(2, 3);
	filler(2, 3);
	filler(2, 4);
	filler(2, 4);
	at(2, 1).push(1);
	filler(2, 1);
	at(2, 1).push(2); // blue's block
	at(2, 2).push(1, 1);
	at(2, 3).push(1);
	at(2, 4).push(1, 1); // the fork, then the win
	const locked = new Set(['2:1', '2:2', '2:3', '2:4']);
	const count = () => [...stacks.values()].reduce((sum, players) => sum + players.length, 0);
	for (let guard = 0; count() < pieceCount && guard < 500; guard += 1) {
		// Bias toward the middle so the action stays in one tall cluster.
		const row = Math.min(5, Math.max(0, Math.round(2.5 + (random() + random() - 1) * 3)));
		const col = Math.min(6, Math.max(0, Math.round(3 + (random() + random() - 1) * 3.5)));
		if (locked.has(`${row}:${col}`) || at(row, col).length >= 5) continue;
		filler(row, col);
	}
	// Orange moves first and last, so it has exactly one more piece than blue: recolour fillers.
	const balance = () => {
		const ones = [...stacks.values()].flat().filter((player) => player === 1).length;
		return ones - (count() - ones) - 1;
	};
	while (balance() !== 0) {
		const want: Player = balance() > 0 ? 2 : 1;
		const candidates = fillers.filter(({ id, index }) => stacks.get(id)![index] !== want);
		const pick = candidates[Math.floor(random() * candidates.length)];
		stacks.get(pick.id)![pick.index] = want;
	}
	return {
		stacks: [...stacks.entries()].map(([id, players]) => {
			const [row, col] = id.split(':').map(Number);
			return { row, col, players };
		}),
		finish: FINISH
	};
}

/** The position just before the finish, filled directly; null if it already contains a line. */
function prefinish(design: Design): GameSnapshot | null {
	let game = createGame(WIN, DIMENSIONS, 1);
	for (const stack of design.stacks) {
		const players = [...stack.players];
		for (const move of design.finish) if (move.row === stack.row && move.col === stack.col) players.pop();
		for (const player of players) {
			game = applyMove({ ...game, currentPlayer: player }, stack);
			if (game.status.state !== 'playing') return null;
		}
	}
	return game;
}

function solveOrder(design: Design, random: () => number, budget: number): Move[] | null {
	const key = (row: number, col: number) => `${row}:${col}`;
	const remaining = new Map(design.stacks.map((stack) => [key(stack.row, stack.col), [...stack.players]]));
	for (const move of design.finish) remaining.get(key(move.row, move.col))!.pop();
	const total = [...remaining.values()].reduce((sum, players) => sum + players.length, 0);
	const order: Move[] = [];
	let attempts = 0;

	const search = (game: GameSnapshot): boolean => {
		if ((attempts += 1) > budget) return false;
		if (order.length === total) {
			let finished = game;
			for (const move of design.finish) {
				if (finished.status.state !== 'playing') return false;
				finished = applyMove(finished, move);
			}
			return finished.status.state === 'won';
		}
		const options = [...remaining.entries()]
			.filter(([, players]) => players[0] === game.currentPlayer)
			.map(([cell]) => cell)
			.sort(() => random() - 0.5);
		for (const cell of options) {
			const [row, col] = cell.split(':').map(Number);
			const next = applyMove(game, { row, col });
			if (next.status.state !== 'playing') continue;
			// Nobody passes up a win: the player to move next must not have one available.
			if (winningMoves(next).length > 0) continue;
			const players = remaining.get(cell)!;
			players.shift();
			order.push({ row, col });
			if (search(next)) return true;
			order.pop();
			players.unshift(game.currentPlayer);
		}
		return false;
	};

	return search(createGame(WIN, DIMENSIONS, 1)) ? [...order, ...design.finish] : null;
}

const random = seededRandom(Number(process.env.SEED ?? 7));
const pieceCount = Number(process.env.PIECES ?? 31);
const rejected = { line: 0, earlyThreat: 0, fork: 0, order: 0 };
const reject = (reason: keyof typeof rejected) => (rejected[reason] += 1);
const sameMove = (a: Move, b: Move) => a.row === b.row && a.col === b.col;
for (let tries = 1; tries <= Number(process.env.TRIES ?? 20_000); tries += 1) {
	if (tries % 500 === 0) console.error(tries, JSON.stringify(rejected));
	const design = generate(random, pieceCount);
	const position = prefinish(design);
	if (!position) {
		reject('line');
		continue;
	}
	const beforeFork = { ...position, currentPlayer: 1 as Player };
	if (winningMoves(beforeFork).length > 0 || winningMoves({ ...position, currentPlayer: 2 }).length > 0) {
		reject('earlyThreat');
		continue;
	}
	const afterFork = applyMove(beforeFork, FINISH[0]);
	const threats = winningMoves({ ...afterFork, currentPlayer: 1 });
	const forks =
		afterFork.status.state === 'playing' &&
		winningMoves(afterFork).length === 0 &&
		threats.length === 2 &&
		threats.some((move) => sameMove(move, FINISH[1])) &&
		threats.some((move) => sameMove(move, FINISH[2]));
	if (!forks) {
		reject('fork');
		continue;
	}
	const moves = solveOrder(design, random, Number(process.env.BUDGET ?? 40_000));
	if (!moves) {
		reject('order');
		continue;
	}
	console.error(tries, JSON.stringify(rejected));
	const final = moves.reduce((game, move) => applyMove(game, move), createGame(WIN, DIMENSIONS, 1));
	// Moves that block a threat the opponent created with the move before: montage material.
	const blocks: number[] = [];
	moves.reduce((game, move, index) => {
		const threats = winningMoves({ ...game, currentPlayer: game.currentPlayer === 1 ? 2 : 1 });
		if (index > 0 && threats.some((threat) => sameMove(threat, move))) blocks.push(index);
		return applyMove(game, move);
	}, createGame(WIN, DIMENSIONS, 1));
	console.log(
		JSON.stringify({
			tries,
			pieces: moves.length,
			maxStack: Math.max(...design.stacks.map((stack) => stack.players.length)),
			winner: final.status.state === 'won' ? final.status.winner : null,
			finalLine: final.completedLines.at(-1)?.cells,
			blocks,
			moves: moves.map((move) => [move.row, move.col])
		})
	);
	break;
}
