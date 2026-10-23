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
	return adjustRecord(record, status, 1);
}

/** Take back a result that undo has reversed, so the match is counted by how it really ended. */
export function withdrawCompletedGame(record: SessionRecord, status: GameStatus): SessionRecord {
	return adjustRecord(record, status, -1);
}

function adjustRecord(record: SessionRecord, status: GameStatus, step: 1 | -1): SessionRecord {
	if (status.state === 'playing') return record;

	if (status.state === 'draw') {
		return { ...record, draws: Math.max(0, record.draws + step) };
	}

	return status.winner === 1
		? { ...record, playerOneWins: Math.max(0, record.playerOneWins + step) }
		: { ...record, playerTwoWins: Math.max(0, record.playerTwoWins + step) };
}
