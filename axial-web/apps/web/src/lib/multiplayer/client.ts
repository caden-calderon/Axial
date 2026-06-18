import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import type {
	ClientCommand,
	CreateRoomResponse,
	JoinRoomResponse,
	PlayerCredentials,
	PrivateRoomSnapshot,
	RoomSnapshot,
	RoomErrorPayload,
	ServerEvent
} from '@axial/multiplayer-protocol';

const STORAGE_PREFIX = 'axial-room-credentials:';

export type MultiplayerClientConfig = {
	baseUrl?: string;
};

export type MultiplayerCredentials = PlayerCredentials;

export function multiplayerHttpBase(): string {
	const configured = (env.PUBLIC_AXIAL_MULTIPLAYER_API ?? '').trim().replace(/\/$/, '');
	if (configured) return configured;
	if (!browser) return '';
	if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
		return 'http://localhost:8787';
	}
	return window.location.origin;
}

export function multiplayerWsBase(): string {
	const base = multiplayerHttpBase();
	if (!base && browser) return window.location.origin.replace(/^http/, 'ws');
	return base.replace(/^http/, 'ws');
}

export async function createRoom(displayName: string): Promise<CreateRoomResponse> {
	return postJson<CreateRoomResponse>('/api/rooms', { displayName });
}

export async function joinRoom(roomCode: string, displayName: string): Promise<JoinRoomResponse> {
	return postJson<JoinRoomResponse>(`/api/rooms/${encodeURIComponent(roomCode)}/join`, {
		displayName
	});
}

export function openRoomSocket(input: {
	credentials: MultiplayerCredentials;
	lastSeenRevision: number;
	onEvent: (event: ServerEvent) => void;
	onOpen?: () => void;
	onClose?: (event: CloseEvent) => void;
	onError?: () => void;
}): WebSocket {
	const url = new URL(
		`/api/rooms/${encodeURIComponent(input.credentials.roomCode)}/socket`,
		multiplayerWsBase()
	);
	url.searchParams.set('playerId', input.credentials.playerId);
	url.searchParams.set('reconnectToken', input.credentials.reconnectToken);
	url.searchParams.set('lastSeenRevision', String(input.lastSeenRevision));

	const socket = new WebSocket(url);
	socket.addEventListener('open', () => input.onOpen?.());
	socket.addEventListener('close', (event) => input.onClose?.(event));
	socket.addEventListener('error', () => input.onError?.());
	socket.addEventListener('message', (event) => {
		try {
			input.onEvent(JSON.parse(String(event.data)) as ServerEvent);
		} catch {
			input.onEvent({
				source: 'axial-room',
				version: 1,
				id: crypto.randomUUID(),
				revision: input.lastSeenRevision,
				type: 'room:error',
				payload: {
					error: {
						code: 'invalid-message',
						message: 'Room sent a message the client could not read.'
					}
				}
			});
		}
	});
	return socket;
}

export function sendRoomCommand(socket: WebSocket | null, command: ClientCommand): boolean {
	if (!socket || socket.readyState !== WebSocket.OPEN) return false;
	socket.send(JSON.stringify(command));
	return true;
}

export function saveCredentials(credentials: MultiplayerCredentials): void {
	if (!browser) return;
	localStorage.setItem(storageKey(credentials.roomCode), JSON.stringify(credentials));
}

export function loadCredentials(roomCode: string): MultiplayerCredentials | null {
	if (!browser) return null;
	const raw = localStorage.getItem(storageKey(roomCode));
	if (!raw) return null;

	try {
		const parsed = JSON.parse(raw) as MultiplayerCredentials;
		if (
			parsed.roomCode &&
			parsed.playerId &&
			parsed.reconnectToken &&
			(parsed.seat === 1 || parsed.seat === 2)
		) {
			return parsed;
		}
	} catch {
		localStorage.removeItem(storageKey(roomCode));
	}

	return null;
}

export function clearCredentials(roomCode: string): void {
	if (!browser) return;
	localStorage.removeItem(storageKey(roomCode));
}

export function eventSnapshot(event: ServerEvent): RoomSnapshot | PrivateRoomSnapshot | null {
	if ('snapshot' in event.payload) {
		return event.payload.snapshot;
	}
	return null;
}

export function eventError(event: ServerEvent): RoomErrorPayload | null {
	if ('error' in event.payload) return event.payload.error as RoomErrorPayload;
	return null;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
	const response = await fetch(`${multiplayerHttpBase()}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	const payload = (await response.json()) as T | { error: RoomErrorPayload };
	if (!response.ok) {
		const error =
			typeof payload === 'object' && payload !== null && 'error' in payload
				? payload.error
				: { code: 'internal-error' as const, message: 'Room request failed.' };
		throw new MultiplayerRequestError(error);
	}
	return payload as T;
}

function storageKey(roomCode: string): string {
	return `${STORAGE_PREFIX}${roomCode.toUpperCase().replace(/[\s-]/g, '')}`;
}

export class MultiplayerRequestError extends Error {
	readonly error: RoomErrorPayload;

	constructor(error: RoomErrorPayload) {
		super(error.message);
		this.name = 'MultiplayerRequestError';
		this.error = error;
	}
}
