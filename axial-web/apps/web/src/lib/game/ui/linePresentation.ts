import type { GameSnapshot, Player } from '@axial/core';

export function completedLineCounts(
	game: Pick<GameSnapshot, 'completedLines'>
): Record<Player, number> {
	const counts: Record<Player, number> = { 1: 0, 2: 0 };
	for (const line of game.completedLines) counts[line.player] += 1;
	return counts;
}
