import { BOARD_COLUMNS, type GameSnapshot } from '@axial/core';
import type { MctsMoveResult, MctsOptions } from '@axial/ai';
import type { ClassicAiWorkerRequest, ClassicAiWorkerResponse } from './classicAiMessages';

export type ClassicAiClient = {
	requestMove(game: GameSnapshot, options: MctsOptions): Promise<MctsMoveResult | null>;
	cancelPending(): void;
	terminate(): void;
};

type WorkerLike = {
	onmessage: ((event: MessageEvent<ClassicAiWorkerResponse>) => void) | null;
	onerror: ((event: ErrorEvent) => void) | null;
	postMessage(message: ClassicAiWorkerRequest): void;
	terminate(): void;
};

type PendingRequest = {
	resolve: (result: MctsMoveResult | null) => void;
	reject: (error: unknown) => void;
};

export type ClassicAiWorkerFactory = () => WorkerLike;

export function createClassicAiClient(
	createWorker: ClassicAiWorkerFactory = createClassicAiWorker
): ClassicAiClient {
	let worker: WorkerLike | null = null;
	let nextRequestId = 1;
	const pending = new Map<number, PendingRequest>();

	function getWorker(): WorkerLike {
		if (worker) return worker;

		worker = createWorker();
		worker.onmessage = ({ data }) => handleMessage(data);
		worker.onerror = (event) => {
			const message = event.message || 'Classic AI worker error';
			rejectAll(new Error(message));
			resetWorker();
		};

		return worker;
	}

	function handleMessage(response: ClassicAiWorkerResponse): void {
		const request = pending.get(response.id);
		if (!request) return;

		pending.delete(response.id);

		if (!response.ok) {
			request.reject(new Error(response.error));
			return;
		}

		if (!response.move) {
			request.resolve(null);
			return;
		}

		request.resolve({
			move: response.move,
			moveIndex: response.moveIndex ?? response.move.row * BOARD_COLUMNS + response.move.col,
			reason: response.reason ?? 'search',
			simulations: response.simulations,
			elapsedMs: response.elapsedMs,
			stats: response.stats
		});
	}

	function rejectAll(error: unknown): void {
		for (const request of pending.values()) {
			request.reject(error);
		}
		pending.clear();
	}

	function resetWorker(): void {
		if (!worker) return;
		worker.onmessage = null;
		worker.onerror = null;
		worker.terminate();
		worker = null;
	}

	return {
		requestMove(game, options) {
			const id = nextRequestId;
			nextRequestId += 1;

			return new Promise((resolve, reject) => {
				pending.set(id, { resolve, reject });
				getWorker().postMessage({ id, game, options });
			});
		},
		cancelPending() {
			if (pending.size === 0) return;
			rejectAll(createAbortError());
			resetWorker();
		},
		terminate() {
			rejectAll(createAbortError());
			resetWorker();
		}
	};
}

function createClassicAiWorker(): WorkerLike {
	return new Worker(new URL('./classicAi.worker.ts', import.meta.url), {
		type: 'module'
	});
}

function createAbortError(): Error {
	const error = new Error('Classic AI request was cancelled');
	error.name = 'AbortError';
	return error;
}
