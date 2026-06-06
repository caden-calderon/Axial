import { describe, expect, it } from 'vitest';
import { createGame } from '@axial/core';
import { createClassicAiClient } from './classicAiClient';
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

	it('rejects pending requests on worker errors', async () => {
		const worker = new FakeWorker();
		const client = createClassicAiClient(() => worker);
		const request = client.requestMove(createGame(), { simulations: 100 });

		worker.fail('worker exploded');

		await expect(request).rejects.toThrow('worker exploded');
		expect(worker.terminated).toBe(true);
	});
});
