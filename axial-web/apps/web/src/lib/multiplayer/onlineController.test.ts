import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '@axial/core';
import type { PrivateRoomSnapshot, RoomErrorCode, ServerEvent } from '@axial/multiplayer-protocol';
import { createOnlineController, type OnlineController } from './onlineController.svelte';
import * as client from './client';

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('./client', async (importOriginal) => ({
	...(await importOriginal<typeof client>()),
	createRoom: vi.fn(),
	joinRoom: vi.fn(),
	openRoomSocket: vi.fn(),
	sendRoomCommand: vi.fn(() => true),
	submitRoomCommand: vi.fn(),
	syncRoom: vi.fn(),
	saveCredentials: vi.fn(),
	saveRoomSnapshot: vi.fn(),
	clearCredentials: vi.fn(),
	clearRoomSnapshot: vi.fn()
}));

const roomCode = 'ABCD2345';
const credentials = {
	roomCode,
	playerId: 'host',
	reconnectToken: 'host-token',
	seat: 1 as const,
	isHost: true,
	displayName: 'Host'
};

type SocketHandlers = Parameters<typeof client.openRoomSocket>[0];
let handlers: SocketHandlers;
let socket: WebSocket;
let controller: OnlineController;

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	vi.stubGlobal('WebSocket', { OPEN: 1 });
	vi.stubGlobal('localStorage', { setItem: vi.fn(), getItem: vi.fn(() => null) });
	vi.stubGlobal('window', {
		location: { href: 'https://axial.test/', origin: 'https://axial.test' },
		history: { state: {}, replaceState: vi.fn() }
	});
	socket = { readyState: 1, close: vi.fn() } as unknown as WebSocket;
	vi.mocked(client.openRoomSocket).mockImplementation((input) => {
		handlers = input;
		return socket;
	});
	vi.mocked(client.createRoom).mockResolvedValue({
		roomCode,
		player: credentials,
		inviteUrl: 'https://axial.test/?room=ABCD2345',
		qrPayload: 'https://axial.test/?room=ABCD2345',
		snapshot: snapshot()
	});
	vi.mocked(client.sendRoomCommand).mockReturnValue(true);
	vi.mocked(client.syncRoom).mockResolvedValue({ snapshot: snapshot() });
	controller = createOnlineController();
});

afterEach(() => {
	controller.destroy();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('online room recovery', () => {
	it.each([
		['room-expired', 'expired'],
		['room-not-found', 'expired'],
		['auth-failed', 'fatal-error'],
		['unsupported-version', 'fatal-error']
	] as const)('stops HTTP retries after %s and ignores late socket events', async (code, state) => {
		await connect();
		expect(controller.yourTurn).toBe(true);
		vi.mocked(client.syncRoom).mockRejectedValue(
			new client.MultiplayerRequestError({ code, message: 'This session is unavailable.' })
		);
		handlers.onClose?.({} as CloseEvent);
		await vi.advanceTimersByTimeAsync(0);

		expect(controller.connectionState).toBe(state);
		expect(controller.statusTitle).toBe(state === 'expired' ? 'Room expired' : 'Connection failed');
		expect(controller.yourTurn).toBe(false);
		expect(controller.currentPlayer).toBeNull();
		const calls = vi.mocked(client.syncRoom).mock.calls.length;
		handlers.onEvent(snapshotEvent(snapshot({ revision: 99 })));
		handlers.onOpen?.();
		await vi.advanceTimersByTimeAsync(90_000);
		expect(client.syncRoom).toHaveBeenCalledTimes(calls);
		expect(client.openRoomSocket).toHaveBeenCalledTimes(1);
		expect(controller.snapshot?.revision).toBe(5);
		expect(controller.connectionState).toBe(state);
	});

	it('stops fallback timers when a duplicate tab takes over without clearing shared credentials', async () => {
		await connect();
		handlers.onError?.();
		await vi.advanceTimersByTimeAsync(0);
		handlers.onEvent(errorEvent('duplicate-connection'));
		const calls = vi.mocked(client.syncRoom).mock.calls.length;
		await vi.advanceTimersByTimeAsync(30_000);

		expect(controller.connectionState).toBe('fatal-error');
		expect(client.syncRoom).toHaveBeenCalledTimes(calls);
		expect(client.clearCredentials).not.toHaveBeenCalled();
		expect(socket.close).toHaveBeenCalledOnce();
	});

	it('does not send setup actions or resync after a terminal failure', async () => {
		await connect();
		handlers.onEvent(snapshotEvent(snapshot({ phase: 'waiting' })));
		expect(controller.canReady).toBe(true);
		expect(controller.canEditRules).toBe(true);
		expect(controller.canStart).toBe(true);
		handlers.onEvent(errorEvent('auth-failed'));

		controller.toggleReady();
		controller.startGame();
		controller.updateDisplayName();
		controller.setWinLineLength(5);
		controller.resync();
		controller.rematch();
		controller.selectOrPlayMove({ row: 0, col: 0 }, false);
		expect(controller.canReady).toBe(false);
		expect(controller.canEditRules).toBe(false);
		expect(controller.canStart).toBe(false);
		expect(client.sendRoomCommand).not.toHaveBeenCalled();
		expect(client.submitRoomCommand).not.toHaveBeenCalled();
		expect(client.clearCredentials).toHaveBeenCalledWith(roomCode);
	});

	it('closes an expired websocket session and retains its final board for display', async () => {
		await connect();
		handlers.onEvent(snapshotEvent(snapshot({ phase: 'expired', revision: 6 })));

		expect(controller.statusTitle).toBe('Room expired');
		expect(controller.connectionState).toBe('expired');
		expect(controller.snapshot?.revision).toBe(6);
		expect(controller.yourTurn).toBe(false);
		expect(socket.close).toHaveBeenCalledOnce();
		expect(client.clearCredentials).toHaveBeenCalledWith(roomCode);
	});

	it('requests a fresh websocket snapshot after a stale move without replaying the move', async () => {
		await connect();
		controller.selectOrPlayMove({ row: 0, col: 0 }, false);
		handlers.onEvent(errorEvent('stale-revision'));

		expect(controller.connectionState).toBe('resyncing');
		expect(controller.yourTurn).toBe(false);
		expect(client.sendRoomCommand).toHaveBeenLastCalledWith(
			socket,
			expect.objectContaining({ type: 'room:resync', payload: { lastSeenRevision: 5 } })
		);
		handlers.onEvent(snapshotEvent(snapshot({ revision: 6 })));
		expect(controller.connectionState).toBe('connected');
		expect(controller.yourTurn).toBe(true);
		expect(client.sendRoomCommand).toHaveBeenCalledTimes(2);
	});

	it('refreshes stale HTTP commands and leaves the rejected move for the player to choose again', async () => {
		await connect();
		vi.mocked(client.sendRoomCommand).mockReturnValue(false);
		vi.mocked(client.submitRoomCommand).mockRejectedValue(
			new client.MultiplayerRequestError({ code: 'stale-revision', message: 'Room changed.' })
		);
		Object.defineProperty(socket, 'readyState', { value: 3 });
		vi.mocked(client.syncRoom).mockResolvedValue({ snapshot: snapshot({ revision: 6 }) });
		controller.selectOrPlayMove({ row: 0, col: 0 }, false);
		await vi.advanceTimersByTimeAsync(2500);

		expect(controller.snapshot?.revision).toBe(6);
		expect(controller.connectionState).toBe('connected');
		expect(client.submitRoomCommand).toHaveBeenCalledOnce();
	});

	it('cannot revive a failed session with an in-flight HTTP response', async () => {
		await connect();
		let finishSync!: (value: { snapshot: PrivateRoomSnapshot }) => void;
		vi.mocked(client.syncRoom).mockReturnValue(
			new Promise((resolve) => {
				finishSync = resolve;
			})
		);
		handlers.onError?.();
		handlers.onEvent(errorEvent('duplicate-connection'));
		finishSync({ snapshot: snapshot({ revision: 99 }) });
		await vi.advanceTimersByTimeAsync(0);

		expect(controller.connectionState).toBe('fatal-error');
		expect(controller.snapshot?.revision).toBe(5);
	});

	it('stops HTTP fallback after a command reports expiry', async () => {
		await connect();
		vi.mocked(client.sendRoomCommand).mockReturnValue(false);
		vi.mocked(client.submitRoomCommand).mockRejectedValue(
			new client.MultiplayerRequestError({ code: 'room-expired', message: 'Room expired.' })
		);
		Object.defineProperty(socket, 'readyState', { value: 3 });
		controller.selectOrPlayMove({ row: 0, col: 0 }, false);
		await vi.advanceTimersByTimeAsync(0);
		const syncCalls = vi.mocked(client.syncRoom).mock.calls.length;
		await vi.advanceTimersByTimeAsync(30_000);

		expect(controller.connectionState).toBe('expired');
		expect(controller.snapshot?.phase).toBe('expired');
		expect(client.syncRoom).toHaveBeenCalledTimes(syncCalls);
		expect(client.submitRoomCommand).toHaveBeenCalledOnce();
	});

	it('keeps retrying a temporary network failure and recovers when the room responds', async () => {
		await connect();
		vi.mocked(client.syncRoom).mockRejectedValueOnce(new Error('Network unavailable'));
		handlers.onClose?.({} as CloseEvent);
		await vi.advanceTimersByTimeAsync(2500);

		expect(client.syncRoom).toHaveBeenCalledTimes(2);
		expect(controller.connectionState).toBe('connected');
		expect(controller.yourTurn).toBe(true);
		expect(client.clearCredentials).not.toHaveBeenCalled();
	});
});

async function connect() {
	await controller.createPrivateRoom();
	handlers.onOpen?.();
}

function snapshot(overrides: Partial<PrivateRoomSnapshot> = {}): PrivateRoomSnapshot {
	const game = createGame();
	return {
		roomCode,
		phase: 'playing',
		revision: 5,
		createdAt: 0,
		updatedAt: 0,
		expiresAt: Date.now() + 60_000,
		hostPlayerId: 'host',
		rules: { mode: 'classic', board: game.dimensions, winCondition: game.winCondition },
		players: [1, 2].map((seat) => ({
			playerId: seat === 1 ? 'host' : 'friend',
			seat: seat as 1 | 2,
			displayName: seat === 1 ? 'Host' : 'Friend',
			isHost: seat === 1,
			ready: true,
			connected: true,
			joinedAt: 0,
			lastSeenAt: 0,
			disconnectedAt: null,
			rematchReady: false
		})),
		game: { ...game, board: Array.from(game.board) },
		match: { number: 1, startingPlayer: 1, startedAt: 0, playableAt: 0 },
		rematch: { readyPlayerIds: [], deadlineAt: null },
		you: credentials,
		inviteUrl: 'https://axial.test/?room=ABCD2345',
		qrPayload: 'https://axial.test/?room=ABCD2345',
		...overrides
	};
}

function snapshotEvent(value: PrivateRoomSnapshot): ServerEvent {
	return {
		source: 'axial-room',
		version: 1,
		id: 'snapshot',
		revision: value.revision,
		type: 'room:snapshot',
		payload: { snapshot: value }
	};
}

function errorEvent(code: RoomErrorCode): ServerEvent {
	return {
		source: 'axial-room',
		version: 1,
		id: 'error',
		revision: 5,
		type: 'room:error',
		payload: { error: { code, message: code } }
	};
}
