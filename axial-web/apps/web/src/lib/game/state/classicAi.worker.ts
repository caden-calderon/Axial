/// <reference lib="webworker" />

import { analyzeMctsMove } from '@axial/ai';
import type { ClassicAiWorkerRequest, ClassicAiWorkerResponse } from './classicAiMessages';

const worker = self as DedicatedWorkerGlobalScope;

worker.onmessage = ({ data }: MessageEvent<ClassicAiWorkerRequest>) => {
	try {
		const result = analyzeMctsMove(data.game, data.options);
		const response: ClassicAiWorkerResponse = {
			id: data.id,
			ok: true,
			move: result?.move ?? null,
			moveIndex: result?.moveIndex ?? null,
			reason: result?.reason ?? null,
			simulations: result?.simulations ?? 0,
			elapsedMs: result?.elapsedMs ?? 0,
			stats: result?.stats ?? []
		};
		worker.postMessage(response);
	} catch (error) {
		const response: ClassicAiWorkerResponse = {
			id: data.id,
			ok: false,
			error: error instanceof Error ? error.message : 'Classic AI worker failed'
		};
		worker.postMessage(response);
	}
};
