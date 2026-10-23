import { readStorage, writeStorage, removeStorage } from '$lib/browserStorage';
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import type {
	ClientCommand,
	RoomCommandResponse,
	CreateRoomResponse,
	JoinRoomResponse,
	MultiplayerRules,
	PlayerCredentials,
	PrivateRoomSnapshot,
	RoomSyncResponse,
	RoomSnapshot,
	RoomErrorPayload,
	ServerEvent
} from '@axial/multiplayer-protocol';

const STORAGE_PREFIX = 'axial-room-credentials:';
const SNAPSHOT_PREFIX = 'axial-room-snapshot:';

export type MultiplayerClientConfig = {
	baseUrl?: string;
};

export type MultiplayerCredentials = PlayerCredentials;

export function multiplayerHttpBase(): string {
	const configured = (env.PUBLIC_AXIAL_MULTIPLAYER_API ?? '').trim().replace(/\/$/, '');
	if (configured) return configured;
	if (!browser) return '';
	if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
		return `${window.location.protocol}//${window.location.hostname}:8787`;
	}
	return window.location.origin;
}

export function multiplayerWsBase(): string {
	const base = multiplayerHttpBase();
	if (!base && browser) return window.location.origin.replace(/^http/, 'ws');
	return base.replace(/^http/, 'ws');
}

export async function createRoom(
	displayName: string,
	rules?: MultiplayerRules
): Promise<CreateRoomResponse> {
	return postJson<CreateRoomResponse>('/api/rooms', { displayName, ...(rules ? { rules } : {}) });
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
	onPong?: () => void;
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
		// The room answers a bare "ping" with a bare "pong" (setWebSocketAutoResponse), not JSON.
		if (event.data === ROOM_PONG) {
			input.onPong?.();
			return;
		}
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

export async function syncRoom(
	credentials: MultiplayerCredentials,
	lastSeenRevision?: number
): Promise<RoomSyncResponse> {
	return postJson<RoomSyncResponse>(`/api/rooms/${encodeURIComponent(credentials.roomCode)}/sync`, {
		playerId: credentials.playerId,
		reconnectToken: credentials.reconnectToken,
		...(typeof lastSeenRevision === 'number' ? { lastSeenRevision } : {})
	});
}

export async function submitRoomCommand(
	credentials: MultiplayerCredentials,
	command: ClientCommand
): Promise<RoomCommandResponse> {
	return postJson<RoomCommandResponse>(
		`/api/rooms/${encodeURIComponent(credentials.roomCode)}/commands`,
		{
			playerId: credentials.playerId,
			reconnectToken: credentials.reconnectToken,
			command
		}
	);
}

const ROOM_PING = 'ping';
const ROOM_PONG = 'pong';

export function sendRoomPing(socket: WebSocket | null): boolean {
	if (!socket || socket.readyState !== WebSocket.OPEN) return false;
	socket.send(ROOM_PING);
	return true;
}

export function sendRoomCommand(socket: WebSocket | null, command: ClientCommand): boolean {
	if (!socket || socket.readyState !== WebSocket.OPEN) return false;
	socket.send(JSON.stringify(command));
	return true;
}

export function saveCredentials(credentials: MultiplayerCredentials): void {
	if (!browser) return;
	const serialized = JSON.stringify(credentials);
	writeStorage('localStorage', storageKey(credentials.roomCode), serialized);
	writeStorage('sessionStorage', storageKey(credentials.roomCode), serialized);
}

export function loadCredentials(roomCode: string): MultiplayerCredentials | null {
	if (!browser) return null;
	const key = storageKey(roomCode);
	const raw = readStorage('localStorage', key) ?? readStorage('sessionStorage', key);
	if (!raw) return null;

	try {
		const parsed = JSON.parse(raw) as MultiplayerCredentials;
		if (
			normalizeRoomCode(parsed.roomCode) === normalizeRoomCode(roomCode) &&
			parsed.playerId &&
			parsed.reconnectToken &&
			(parsed.seat === 1 || parsed.seat === 2) &&
			typeof parsed.displayName === 'string'
		) {
			return parsed;
		}
	} catch {
		removeStorage('localStorage', key);
		removeStorage('sessionStorage', key);
	}

	return null;
}

export function clearCredentials(roomCode: string): void {
	if (!browser) return;
	const key = storageKey(roomCode);
	removeStorage('localStorage', key);
	removeStorage('sessionStorage', key);
}

export function saveRoomSnapshot(snapshot: PrivateRoomSnapshot): void {
	if (!browser) return;
	writeStorage('sessionStorage', snapshotKey(snapshot.roomCode), JSON.stringify(snapshot));
}

export function loadRoomSnapshot(
	roomCode: string,
	credentials?: MultiplayerCredentials | null
): PrivateRoomSnapshot | null {
	if (!browser) return null;
	const key = snapshotKey(roomCode);
	const raw = readStorage('sessionStorage', key);
	if (!raw) return null;

	try {
		const parsed = JSON.parse(raw) as PrivateRoomSnapshot;
		if (isPrivateRoomSnapshot(parsed, roomCode, credentials)) return parsed;
	} catch {
		removeStorage('sessionStorage', key);
	}

	return null;
}

export function clearRoomSnapshot(roomCode: string): void {
	if (!browser) return;
	removeStorage('sessionStorage', snapshotKey(roomCode));
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
	let response: Response;
	try {
		response = await fetch(`${multiplayerHttpBase()}${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
	} catch {
		// Browsers word this differently ("Failed to fetch", "Load failed"); say what it means.
		throw new Error('Could not reach the game server. Check your connection and try again.');
	}
	let payload: T | { error: RoomErrorPayload };
	try {
		payload = (await response.json()) as T | { error: RoomErrorPayload };
	} catch {
		// An outage or proxy error page is HTML, not the room's JSON.
		throw new Error('The game server had a problem. Try again in a moment.');
	}
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
	return `${STORAGE_PREFIX}${normalizeRoomCode(roomCode)}`;
}

function snapshotKey(roomCode: string): string {
	return `${SNAPSHOT_PREFIX}${normalizeRoomCode(roomCode)}`;
}

function normalizeRoomCode(roomCode: string): string {
	return roomCode.toUpperCase().replace(/[\s-]/g, '');
}

function isPrivateRoomSnapshot(
	value: PrivateRoomSnapshot,
	roomCode: string,
	credentials?: MultiplayerCredentials | null
): boolean {
	if (
		normalizeRoomCode(value.roomCode) !== normalizeRoomCode(roomCode) ||
		typeof value.revision !== 'number' ||
		!Array.isArray(value.players) ||
		!value.rules ||
		!value.game ||
		!value.you ||
		typeof value.you.playerId !== 'string' ||
		typeof value.inviteUrl !== 'string'
	) {
		return false;
	}

	return !credentials || value.you.playerId === credentials.playerId;
}

export class MultiplayerRequestError extends Error {
	readonly error: RoomErrorPayload;

	constructor(error: RoomErrorPayload) {
		super(error.message);
		this.name = 'MultiplayerRequestError';
		this.error = error;
	}
}
