import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGameController, MIN_AI_TURN_MS } from './gameController.svelte';

vi.mock('$app/environment', () => ({ browser: true }));
const { requestMove } = vi.hoisted(() => ({ requestMove: vi.fn() }));
vi.mock('./classicAiClient', () => ({
	createClassicAiClient: () => ({ requestMove, cancelPending() {}, terminate() {} })
}));

let controllers: ReturnType<typeof createGameController>[];

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout'] });
	vi.setSystemTime(new Date('2026-09-21T12:00:00Z'));
	const storage = new Map<string, string>();
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => storage.set(key, value),
		removeItem: (key: string) => storage.delete(key)
	});
	vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
	requestMove.mockReset().mockResolvedValue({ move: { row: 1, col: 0 } });
	controllers = [];
});

afterEach(() => {
	for (const controller of controllers) controller.destroy();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

function controller() {
	const instance = createGameController();
	controllers.push(instance);
	return instance;
}

describe('AI turn pacing', () => {
	it('starts search immediately but holds a fast reply until the minimum turn time', async () => {
		const game = controller();
		game.setOpponentMode('ai');
		game.playMove({ row: 0, col: 0 });
		expect(requestMove).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(MIN_AI_TURN_MS - 1);
		expect(game.game.moveHistory).toHaveLength(1);
		expect(game.aiThinking).toBe(true);
		await vi.advanceTimersByTimeAsync(1);
		expect(game.game.moveHistory).toHaveLength(2);
		expect(game.aiThinking).toBe(false);
	});

	it('does not add a delay to searches that already exceed the minimum', async () => {
		requestMove.mockImplementation(
			() =>
				new Promise((resolve) => {
					setTimeout(() => resolve({ move: { row: 1, col: 0 } }), 1200);
				})
		);
		const game = controller();
		game.setOpponentMode('ai');
		game.playMove({ row: 0, col: 0 });
		await vi.advanceTimersByTimeAsync(1199);
		expect(game.game.moveHistory).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(game.game.moveHistory).toHaveLength(2);
		expect(game.aiThinking).toBe(false);
	});

	it.each(['undoMove', 'destroy', 'leaveAiSeries'] as const)(
		'cancels a ready but delayed reply on %s',
		async (action) => {
			const game = controller();
			game.setOpponentMode('ai');
			game.playMove({ row: 0, col: 0 });
			await vi.advanceTimersByTimeAsync(100);
			game[action]();
			const count = game.game.moveHistory.length;
			await vi.advanceTimersByTimeAsync(1000);
			expect(game.game.moveHistory).toHaveLength(count);
			expect(game.aiThinking).toBe(false);
		}
	);

	it('reset replaces the old reply with a separately paced AI opener', async () => {
		const game = controller();
		game.setOpponentMode('ai');
		game.playMove({ row: 0, col: 0 });
		await vi.advanceTimersByTimeAsync(100);
		game.resetGame();
		await vi.advanceTimersByTimeAsync(MIN_AI_TURN_MS - 1);
		expect(game.game.moveHistory).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(1);
		expect(game.game.moveHistory).toHaveLength(1);
		expect(game.game.lastMove?.player).toBe(2);
	});
});

describe('match duration', () => {
	function win(game: ReturnType<typeof controller>) {
		for (let col = 0; col < 4; col++) {
			game.playMove({ row: 0, col });
			if (col < 3) game.playMove({ row: 1, col });
		}
	}

	it('times first to last move across reload and freezes through review and redo', () => {
		const game = controller();
		vi.advanceTimersByTime(60_000);
		game.playMove({ row: 0, col: 0 });
		vi.advanceTimersByTime(90_000);
		const restored = controller();
		restored.hydrateFromStorage();
		restored.playMove({ row: 1, col: 0 });
		for (let col = 1; col < 4; col++) {
			restored.playMove({ row: 0, col });
			if (col < 3) restored.playMove({ row: 1, col });
		}
		expect(restored.game.status.state).toBe('won');
		expect(restored.matchDurationMs).toBe(90_000);
		vi.advanceTimersByTime(30_000);
		restored.rewindGame();
		while (restored.canRedo) restored.redoMove();
		expect(restored.matchDurationMs).toBe(90_000);
		const finished = controller();
		finished.hydrateFromStorage();
		expect(finished.matchDurationMs).toBe(90_000);
		finished.resetGame();
		expect(finished.matchDurationMs).toBeNull();
	});

	it('does not invent a duration for older saved matches', () => {
		const game = controller();
		win(game);
		const saved = JSON.parse(localStorage.getItem('axial-active-match')!);
		delete saved.matchStartedAt;
		delete saved.matchEndedAt;
		localStorage.setItem('axial-active-match', JSON.stringify(saved));
		const restored = controller();
		restored.hydrateFromStorage();
		expect(restored.game.status.state).toBe('won');
		expect(restored.matchDurationMs).toBeNull();
	});

	it('preserves a completed AI-opening match while reviewing its saved moves', async () => {
		const game = controller();
		win(game);
		const saved = JSON.parse(localStorage.getItem('axial-active-match')!);
		saved.startingPlayer = 2;
		saved.opponentMode = 'ai';
		saved.matchStartedAt = 1_000_000;
		saved.matchEndedAt = 1_090_000;
		localStorage.setItem('axial-active-match', JSON.stringify(saved));
		const restored = controller();
		restored.hydrateFromStorage();
		restored.rewindGame();
		await vi.advanceTimersByTimeAsync(1000);
		expect(requestMove).not.toHaveBeenCalled();
		expect(restored.game.moveHistory).toHaveLength(0);
		expect(restored.canRedo).toBe(true);
		while (restored.canRedo) restored.redoMove();
		expect(restored.game.status.state).toBe('won');
		expect(restored.matchDurationMs).toBe(90_000);
	});

	it('starts fresh timing when a new match begins', () => {
		const game = controller();
		win(game);
		game.resetGame();
		vi.advanceTimersByTime(60_000);
		win(game);
		expect(game.matchDurationMs).toBe(0);
	});
});
