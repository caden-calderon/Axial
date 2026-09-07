import type { GameSnapshot } from '@axial/core';
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
	fallbackColumns: number;
	timeout: ReturnType<typeof setTimeout>;
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
		clearTimeout(request.timeout);

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
			moveIndex:
				response.moveIndex ?? response.move.row * request.fallbackColumns + response.move.col,
			reason: response.reason ?? 'search',
			simulations: response.simulations,
			elapsedMs: response.elapsedMs,
			maxDepth: response.maxDepth ?? 0,
			rootChildren: response.rootChildren ?? 0,
			lookaheadDepth: response.lookaheadDepth ?? 0,
			lookaheadCompletedDepth: response.lookaheadCompletedDepth ?? 0,
			lookaheadPartialDepth: response.lookaheadPartialDepth ?? 0,
			lookaheadComplete: response.lookaheadComplete ?? true,
			stopReason: response.stopReason ?? 'simulations',
			stats: response.stats,
			telemetry: response.telemetry ?? emptyTelemetry(response.elapsedMs)
		});
	}

	function rejectAll(error: unknown): void {
		for (const request of pending.values()) {
			clearTimeout(request.timeout);
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
				const timeout = setTimeout(() => {
					if (!pending.has(id)) return;

					rejectAll(new Error('Classic AI worker timed out'));
					resetWorker();
				}, requestTimeoutMs(options));
				pending.set(id, {
					resolve,
					reject,
					fallbackColumns: game.dimensions.columns,
					timeout
				});
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

export function requestTimeoutMs(options: MctsOptions): number {
	const searchBudgetMs = options.maxTimeMs ?? 2_500;
	return Math.min(20_000, Math.max(4_000, Math.ceil(searchBudgetMs * 1.75 + 1_000)));
}

function emptyTelemetry(totalMs: number): MctsMoveResult['telemetry'] {
	return {
		phaseMs: {
			stateConversionMs: 0,
			tacticalMs: 0,
			heuristicMs: 0,
			lookaheadMs: 0,
			treeSearchMs: totalMs,
			totalMs
		},
		lookaheadNodes: 0,
		lookaheadCandidates: 0,
		lookaheadCompletedCandidates: 0,
		treeNodes: 0,
		rolloutMoves: 0,
		maxRolloutMoves: 0,
		selectedMoveDepth: 0
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
