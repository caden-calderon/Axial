import type { GameSnapshot, Move } from '@axial/core';
import type { MctsMoveStat, MctsOptions } from '@axial/ai';

export type ClassicAiWorkerRequest = {
	id: number;
	game: GameSnapshot;
	options: MctsOptions;
};

export type ClassicAiWorkerSuccess = {
	id: number;
	ok: true;
	move: Move | null;
	moveIndex: number | null;
	reason: 'tactical' | 'search' | 'heuristic' | null;
	simulations: number;
	elapsedMs: number;
	stats: MctsMoveStat[];
};

export type ClassicAiWorkerFailure = {
	id: number;
	ok: false;
	error: string;
};

export type ClassicAiWorkerResponse = ClassicAiWorkerSuccess | ClassicAiWorkerFailure;
