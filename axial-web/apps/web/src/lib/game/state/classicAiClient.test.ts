import { describe, expect, it, vi } from 'vitest';
import { createGame } from '@axial/core';
import { createClassicAiClient, requestTimeoutMs } from './classicAiClient';
import type { ClassicAiWorkerRequest, ClassicAiWorkerResponse } from './classicAiMessages';

class FakeWorker {
	onmessage: ((event: MessageEvent<ClassicAiWorkerResponse>) => void) | null = null;
	onerror: ((event: ErrorEvent) => void) | null = null;
	messages: ClassicAiWorkerRequest[] = [];
	terminated = false;

	postMessage(message: ClassicAiWorkerRequest): void {
		this.messages.push(message);
	}

	terminate(): void {
		this.terminated = true;
	}

	send(response: ClassicAiWorkerResponse): void {
		this.onmessage?.({ data: response } as MessageEvent<ClassicAiWorkerResponse>);
	}

	fail(message: string): void {
		this.onerror?.({ message } as ErrorEvent);
	}
}

describe('Classic AI worker client', () => {
	it('bounds worker searches with room for the configured MCTS budget', () => {
		expect(requestTimeoutMs({ maxTimeMs: 100 })).toBe(4_000);
		expect(requestTimeoutMs({ maxTimeMs: 4_000 })).toBe(8_000);
		expect(requestTimeoutMs({ maxTimeMs: 20_000 })).toBe(20_000);
	});

	it('resolves a worker move response', async () => {
		const worker = new FakeWorker();
		const client = createClassicAiClient(() => worker);
		const request = client.requestMove(createGame(), { simulations: 12, seed: 4 });

		expect(worker.messages).toHaveLength(1);
		expect(worker.messages[0].options).toMatchObject({ simulations: 12, seed: 4 });

		worker.send({
			id: worker.messages[0].id,
			ok: true,
			move: { row: 2, col: 3 },
			moveIndex: 17,
			reason: 'search',
			simulations: 12,
			elapsedMs: 14,
			stats: []
		});

		await expect(request).resolves.toMatchObject({
			move: { row: 2, col: 3 },
			moveIndex: 17,
			reason: 'search',
			simulations: 12,
			elapsedMs: 14
		});
	});

	it('falls back to the request board width when a worker omits moveIndex', async () => {
		const worker = new FakeWorker();
		const client = createClassicAiClient(() => worker);
		const request = client.requestMove(createGame(undefined, { height: 7, rows: 8, columns: 9 }), {
			simulations: 12,
			seed: 4
		});

		worker.send({
			id: worker.messages[0].id,
			ok: true,
			move: { row: 7, col: 8 },
			moveIndex: null,
			reason: 'search',
			simulations: 12,
			elapsedMs: 14,
			stats: []
		});

		await expect(request).resolves.toMatchObject({
			move: { row: 7, col: 8 },
			moveIndex: 71
		});
	});

	it('rejects failed worker responses', async () => {
		const worker = new FakeWorker();
		const client = createClassicAiClient(() => worker);
		const request = client.requestMove(createGame(), { simulations: 1 });

		worker.send({
			id: worker.messages[0].id,
			ok: false,
			error: 'search failed'
		});

		await expect(request).rejects.toThrow('search failed');
	});

	it('cancels pending requests by terminating the worker', async () => {
		const worker = new FakeWorker();
		const client = createClassicAiClient(() => worker);
		const request = client.requestMove(createGame(), { simulations: 100 });

		client.cancelPending();

		await expect(request).rejects.toMatchObject({ name: 'AbortError' });
		expect(worker.terminated).toBe(true);
	});

	it('starts cleanly with a new worker after cancellation', async () => {
		const workers: FakeWorker[] = [];
		const client = createClassicAiClient(() => {
			const worker = new FakeWorker();
			workers.push(worker);
			return worker;
		});
		const cancelledRequest = client.requestMove(createGame(), { simulations: 100 });

		client.cancelPending();
		await expect(cancelledRequest).rejects.toMatchObject({ name: 'AbortError' });

		const retry = client.requestMove(createGame(), { simulations: 12 });
		const retryMessage = workers[1].messages[0];
		workers[1].send({
			id: retryMessage.id,
			ok: true,
			move: { row: 1, col: 2 },
			moveIndex: 9,
			reason: 'search',
			simulations: 12,
			elapsedMs: 8,
			stats: []
		});

		await expect(retry).resolves.toMatchObject({ move: { row: 1, col: 2 } });
		expect(workers).toHaveLength(2);
	});

	it('rejects pending requests on worker errors', async () => {
		const worker = new FakeWorker();
		const client = createClassicAiClient(() => worker);
		const request = client.requestMove(createGame(), { simulations: 100 });

		worker.fail('worker exploded');

		await expect(request).rejects.toThrow('worker exploded');
		expect(worker.terminated).toBe(true);
	});

	it('terminates and rejects a worker that stops responding', async () => {
		vi.useFakeTimers();
		try {
			const worker = new FakeWorker();
			const client = createClassicAiClient(() => worker);
			const request = client.requestMove(createGame(), { maxTimeMs: 100 });
			const rejection = expect(request).rejects.toThrow('timed out');

			await vi.advanceTimersByTimeAsync(4_000);

			await rejection;
			expect(worker.terminated).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});
});
