import type { GameStatus } from '@axial/core';

export type SessionRecord = {
	playerOneWins: number;
	playerTwoWins: number;
	draws: number;
};

export function createSessionRecord(): SessionRecord {
	return {
		playerOneWins: 0,
		playerTwoWins: 0,
		draws: 0
	};
}

export function recordCompletedGame(record: SessionRecord, status: GameStatus): SessionRecord {
	if (status.state === 'playing') return record;

	if (status.state === 'draw') {
		return { ...record, draws: record.draws + 1 };
	}

	return status.winner === 1
		? { ...record, playerOneWins: record.playerOneWins + 1 }
		: { ...record, playerTwoWins: record.playerTwoWins + 1 };
}
