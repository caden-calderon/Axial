import { describe, expect, it } from 'vitest';
import { createSessionRecord, recordCompletedGame } from './sessionRecord';

describe('session record', () => {
	it('leaves active games unchanged', () => {
		expect(
			recordCompletedGame(createSessionRecord(), { state: 'playing', currentPlayer: 1 })
		).toEqual({
			playerOneWins: 0,
			playerTwoWins: 0,
			draws: 0
		});
	});

	it('records player one wins', () => {
		expect(
			recordCompletedGame(createSessionRecord(), { state: 'won', winner: 1, line: [] })
		).toEqual({
			playerOneWins: 1,
			playerTwoWins: 0,
			draws: 0
		});
	});

	it('records player two wins', () => {
		expect(
			recordCompletedGame(createSessionRecord(), { state: 'won', winner: 2, line: [] })
		).toEqual({
			playerOneWins: 0,
			playerTwoWins: 1,
			draws: 0
		});
	});

	it('records draws', () => {
		expect(recordCompletedGame(createSessionRecord(), { state: 'draw' })).toEqual({
			playerOneWins: 0,
			playerTwoWins: 0,
			draws: 1
		});
	});
});
