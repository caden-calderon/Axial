import { browser } from '$app/environment';
import {
	createGame,
	normalizeBoardDimensions,
	normalizeWinCondition,
	type BoardDimensions,
	type GameSnapshot,
	type MatchMode,
	type Move,
	type WinCondition
} from '@axial/core';
import {
	AXIAL_CLIENT_SOURCE,
	AXIAL_MULTIPLAYER_PROTOCOL_VERSION,
	type ClientCommand,
	type ConnectionState,
	type MultiplayerRules,
	type PlayerIdentity,
	type PrivateRoomSnapshot,
	type RoomSnapshot,
	type SerializableGameSnapshot
} from '@axial/multiplayer-protocol';
import {
	MultiplayerRequestError,
	clearCredentials,
	clearRoomSnapshot,
	createRoom,
	eventError,
	eventSnapshot,
	joinRoom,
	loadCredentials,
	loadRoomSnapshot,
	openRoomSocket,
	saveCredentials,
	saveRoomSnapshot,
	sendRoomCommand,
	submitRoomCommand,
	syncRoom,
	type MultiplayerCredentials
} from './client';

const STORAGE_KEYS = {
	displayName: 'axial-online-display-name'
} as const;

const FALLBACK_SYNC_INTERVAL_MS = 2500;
const SOCKET_RETRY_WITH_FALLBACK_MS = 30000;
const TRANSPORT_HEALTH_GRACE_MS = 7000;

export type BoardDimensionKey = keyof BoardDimensions;
export type OnlineController = ReturnType<typeof createOnlineController>;
type RoomSearchParams = {
	get(name: string): string | null;
};

export function createOnlineController() {
	let credentials = $state<MultiplayerCredentials | null>(null);
	let snapshot = $state<PrivateRoomSnapshot | null>(null);
	let displayName = $state('Caden');
	let joinCodeDraft = $state('');
	let error = $state('');
	let connectionState = $state<ConnectionState>('idle');
	let copied = $state(false);
	let showQr = $state(false);
	let hoveredMove = $state<Move | null>(null);
	let lockedMove = $state<Move | null>(null);
	let rulesDraft = $state<MultiplayerRules>(defaultRules());
	let socket: WebSocket | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let fallbackTimer: ReturnType<typeof setInterval> | null = null;
	let manualClose = false;
	let lastHealthyAt = 0;

	const self = $derived(
		snapshot?.players.find((player) => player.playerId === snapshot?.you.playerId) ?? null
	);
	const opponent = $derived(
		snapshot?.players.find((player) => player.playerId !== snapshot?.you.playerId) ?? null
	);
	const rules = $derived(snapshot?.rules ?? rulesDraft);
	const game = $derived(snapshot ? toGameSnapshot(snapshot.game) : createGameForRules(rulesDraft));
	const canEditRules = $derived(Boolean(snapshot?.you.isHost && snapshot.phase === 'waiting'));
	const canReady = $derived(
		Boolean(snapshot && snapshot.phase === 'waiting' && snapshot.players.length === 2)
	);
	const yourTurn = $derived(
		Boolean(
			snapshot?.phase === 'playing' &&
			snapshot.game.status.state === 'playing' &&
			snapshot.game.currentPlayer === snapshot.you.seat
		)
	);
	const setupLocked = $derived(Boolean(snapshot && !canEditRules));
	const previewMove = $derived(lockedMove ?? hoveredMove);
	const statusTitle = $derived(roomStatusLabel(snapshot, connectionState, opponent));
	const currentLabel = $derived(statusTitle);
	const statusTone = $derived(
		game.status.state === 'won' ? `player-${game.status.winner}` : game.status.state
	);
	const winnerLabel = $derived(winnerLabelFor(game, snapshot));
	const formattedRoomCode = $derived(
		formatRoomCode(snapshot?.roomCode ?? credentials?.roomCode ?? joinCodeDraft)
	);

	function hydrateFromBrowser(searchParams?: RoomSearchParams): boolean {
		if (!browser) return false;

		const savedName = localStorage.getItem(STORAGE_KEYS.displayName);
		if (savedName) displayName = savedName;

		const onlineRequested = searchParams?.get('online') !== null;
		const roomCode = normalizeRoomCode(
			searchParams?.get('room') ?? searchParams?.get('code') ?? ''
		);
		if (!roomCode) return onlineRequested;

		joinCodeDraft = formatRoomCode(roomCode);
		const savedCredentials = loadCredentials(roomCode);
		if (!savedCredentials) return true;

		credentials = savedCredentials;
		displayName = savedCredentials.displayName;
		const storedSnapshot = loadRoomSnapshot(roomCode, savedCredentials);
		if (storedSnapshot) applySnapshot(storedSnapshot, { networkHealthy: false });
		connect('connecting');
		return true;
	}

	function useRules(nextRules: MultiplayerRules): void {
		if (snapshot) return;
		rulesDraft = cloneRules(nextRules);
	}

	async function createPrivateRoom(): Promise<void> {
		const name = normalizedDisplayName();
		if (!name) return;

		error = '';
		connectionState = 'creating';
		try {
			const room = await createRoom(name, rulesDraft);
			credentials = room.player;
			joinCodeDraft = formatRoomCode(room.roomCode);
			saveCredentials(room.player);
			applySnapshot(room.snapshot, { networkHealthy: true });
			connect('connecting');
		} catch (reason) {
			failRequest(reason, 'Could not create a room.');
		}
	}

	async function joinPrivateRoom(): Promise<void> {
		const roomCode = normalizeRoomCode(joinCodeDraft);
		const name = normalizedDisplayName();
		if (!roomCode || !name) return;

		error = '';
		connectionState = 'joining';
		try {
			const joined = await joinRoom(roomCode, name);
			credentials = joined.player;
			joinCodeDraft = formatRoomCode(joined.roomCode);
			saveCredentials(joined.player);
			applySnapshot(joined.snapshot, { networkHealthy: true });
			connect('connecting');
		} catch (reason) {
			failRequest(reason, 'Could not join this room.');
		}
	}

	function connect(nextState: ConnectionState): void {
		if (!credentials) return;
		if (reconnectTimer) clearTimeout(reconnectTimer);
		setTransportState(nextState);
		manualClose = false;
		socket?.close();
		socket = openRoomSocket({
			credentials,
			lastSeenRevision: snapshot?.revision ?? 0,
			onOpen: () => {
				markHealthy();
				stopHttpFallback();
				connectionState = snapshot ? derivedConnectionState(snapshot, opponent) : 'connected';
			},
			onEvent: handleEvent,
			onClose: () => {
				socket = null;
				if (manualClose || connectionState === 'fatal-error' || connectionState === 'expired')
					return;
				startHttpFallback();
				surfaceTransportIssue();
				scheduleReconnect(SOCKET_RETRY_WITH_FALLBACK_MS);
			},
			onError: () => {
				if (connectionState === 'fatal-error') return;
				startHttpFallback();
				surfaceTransportIssue();
			}
		});
	}

	function startHttpFallback(): void {
		if (!credentials || fallbackTimer) return;
		void syncFallback();
		fallbackTimer = setInterval(() => {
			void syncFallback();
		}, FALLBACK_SYNC_INTERVAL_MS);
	}

	function stopHttpFallback(): void {
		if (!fallbackTimer) return;
		clearInterval(fallbackTimer);
		fallbackTimer = null;
	}

	async function syncFallback(): Promise<void> {
		if (!credentials || manualClose) return;
		try {
			const result = await syncRoom(credentials, snapshot?.revision);
			applySnapshot(result.snapshot, { networkHealthy: true });
			error = '';
			connectionState = derivedConnectionState(result.snapshot, opponent);
		} catch (reason) {
			failRequest(reason, 'Room sync failed.', { transportOnly: true });
		}
	}

	async function submitFallback(commandToSend: ClientCommand): Promise<void> {
		if (!credentials) return;
		try {
			const result = await submitRoomCommand(credentials, commandToSend);
			applySnapshot(result.snapshot, { networkHealthy: true });
			error = '';
			connectionState = derivedConnectionState(result.snapshot, opponent);
		} catch (reason) {
			failRequest(reason, 'Room command failed.', { transportOnly: true });
			startHttpFallback();
		}
	}

	function handleEvent(event: import('@axial/multiplayer-protocol').ServerEvent): void {
		markHealthy();
		const incoming = eventSnapshot(event);
		if (incoming) applySnapshot(incoming, { networkHealthy: true });

		const roomError = eventError(event);
		if (roomError) {
			error = roomError.message;
			if (roomError.code === 'duplicate-connection') {
				connectionState = 'fatal-error';
				manualClose = true;
				socket?.close();
				return;
			}
		}

		if (snapshot?.phase === 'expired') {
			connectionState = 'expired';
		} else if (snapshot) {
			connectionState = derivedConnectionState(snapshot, opponent);
		}
	}

	function applySnapshot(
		incoming: RoomSnapshot | PrivateRoomSnapshot,
		options: { networkHealthy: boolean }
	): void {
		const previous = snapshot;
		const retainedIdentity =
			'you' in incoming ? incoming.you : (previous?.you ?? credentialsToIdentity(credentials));
		if (!retainedIdentity) return;

		const inviteUrl =
			'inviteUrl' in incoming
				? incoming.inviteUrl
				: (previous?.inviteUrl ?? roomInviteUrl(incoming.roomCode));
		const updatedSelf = incoming.players.find(
			(player) => player.playerId === retainedIdentity.playerId
		);
		snapshot = {
			...incoming,
			you: {
				...retainedIdentity,
				...(updatedSelf ? { displayName: updatedSelf.displayName } : {})
			},
			inviteUrl,
			qrPayload: 'qrPayload' in incoming ? incoming.qrPayload : inviteUrl
		};
		saveRoomSnapshot(snapshot);
		joinCodeDraft = formatRoomCode(snapshot.roomCode);
		rulesDraft = cloneRules(snapshot.rules);
		if (options.networkHealthy) markHealthy();
	}

	function updateDisplayName(): void {
		const name = normalizedDisplayName();
		if (!name || !snapshot) return;
		send(command('room:set-name', { displayName: name }));
	}

	function setBoardDimension(key: BoardDimensionKey, value: number): void {
		let board: BoardDimensions;
		try {
			board = normalizeBoardDimensions({
				...rules.board,
				[key]: value
			});
		} catch (reason) {
			error = reason instanceof Error ? reason.message : 'Unsupported board size.';
			return;
		}

		setRules({ ...rules, board });
	}

	function setWinLineLength(lineLength: number): void {
		setWinCondition({ ...rules.winCondition, lineLength });
	}

	function setLinesToWin(linesToWin: number): void {
		setWinCondition({ ...rules.winCondition, linesToWin });
	}

	function setWinCondition(nextWinCondition: WinCondition): void {
		try {
			setRules({
				...rules,
				winCondition: normalizeWinCondition(nextWinCondition)
			});
		} catch (reason) {
			error = reason instanceof Error ? reason.message : 'Unsupported win condition.';
		}
	}

	function setMatchMode(nextMode: MatchMode): void {
		if (nextMode === 'classic') return;
		error = 'Online rooms use Classic rules in v1.';
	}

	function setRules(nextRules: MultiplayerRules): void {
		error = '';
		const normalized = cloneRules(nextRules);
		rulesDraft = normalized;
		lockedMove = null;
		hoveredMove = null;

		if (!snapshot) return;
		if (!canEditRules) {
			error = snapshot.you.isHost
				? 'Rules lock once the match starts.'
				: 'Only the host can change online rules.';
			return;
		}

		send(
			command('room:set-rules', {
				rules: normalized,
				expectedRevision: snapshot.revision
			})
		);
	}

	function toggleReady(): void {
		if (!snapshot) return;
		send(command('room:ready', { ready: !self?.ready }));
	}

	function rematch(): void {
		if (!snapshot) return;
		send(command('room:rematch-vote', { ready: !self?.rematchReady }));
	}

	function selectOrPlayMove(move: Move, confirmDropEnabled: boolean): void {
		if (!confirmDropEnabled) {
			playMove(move);
			return;
		}

		if (!yourTurn) {
			playMove(move);
			return;
		}

		if (lockedMove && lockedMove.row === move.row && lockedMove.col === move.col) {
			const confirmed = lockedMove;
			lockedMove = null;
			playMove(confirmed);
			return;
		}

		error = '';
		lockedMove = { ...move };
		hoveredMove = { ...move };
	}

	function playMove(move: Move): void {
		if (!snapshot || !yourTurn) {
			error =
				snapshot?.phase === 'playing' ? 'Waiting for opponent.' : 'Start the online match first.';
			return;
		}

		error = '';
		lockedMove = null;
		hoveredMove = null;
		send(
			command('game:play-move', {
				move,
				expectedRevision: snapshot.revision
			})
		);
	}

	function setHover(move: Move | null): void {
		hoveredMove = move;
	}

	function resync(): void {
		if (!credentials) return;
		if (socket?.readyState === WebSocket.OPEN && snapshot) {
			send(command('room:resync', { lastSeenRevision: snapshot.revision }));
			connectionState = 'resyncing';
			return;
		}

		connectionState = 'resyncing';
		startHttpFallback();
		void syncFallback();
	}

	function leaveRoom(): void {
		manualClose = true;
		if (credentials) {
			void submitRoomCommand(credentials, command('room:leave', {})).catch(() => undefined);
			clearCredentials(credentials.roomCode);
			clearRoomSnapshot(credentials.roomCode);
		}
		if (reconnectTimer) clearTimeout(reconnectTimer);
		stopHttpFallback();
		socket?.close();
		socket = null;
		credentials = null;
		snapshot = null;
		connectionState = 'idle';
		error = '';
		copied = false;
		showQr = false;
		lockedMove = null;
		hoveredMove = null;
	}

	async function copyInvite(): Promise<void> {
		const value = snapshot?.inviteUrl;
		if (!value) return;
		await navigator.clipboard.writeText(value);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 1600);
	}

	function toggleQr(): void {
		showQr = !showQr;
	}

	function destroy(): void {
		manualClose = true;
		if (reconnectTimer) clearTimeout(reconnectTimer);
		stopHttpFallback();
		socket?.close();
		socket = null;
	}

	function send(commandToSend: ClientCommand): boolean {
		error = '';
		if (!sendRoomCommand(socket, commandToSend)) {
			if (!credentials) {
				error = 'Room connection is not ready.';
				return false;
			}
			startHttpFallback();
			void submitFallback(commandToSend);
			return false;
		}
		return true;
	}

	function normalizedDisplayName(): string {
		const name = displayName.trim().replace(/\s+/g, ' ');
		if (!name) {
			error = 'Choose a display name.';
			return '';
		}
		displayName = name;
		if (browser) localStorage.setItem(STORAGE_KEYS.displayName, name);
		return name;
	}

	function failRequest(
		reason: unknown,
		fallbackMessage: string,
		options: { transportOnly?: boolean } = {}
	): void {
		if (
			options.transportOnly &&
			!(reason instanceof MultiplayerRequestError) &&
			hasRecentHealth()
		) {
			return;
		}

		error =
			reason instanceof MultiplayerRequestError
				? reason.error.message
				: reason instanceof Error
					? reason.message
					: fallbackMessage;
		if (options.transportOnly) {
			surfaceTransportIssue();
			return;
		}
		connectionState = 'fatal-error';
	}

	function scheduleReconnect(delayMs: number): void {
		if (reconnectTimer) clearTimeout(reconnectTimer);
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			connect('reconnecting');
		}, delayMs);
	}

	function setTransportState(nextState: ConnectionState): void {
		if ((nextState === 'connecting' || nextState === 'reconnecting') && hasRecentHealth()) return;
		connectionState = nextState;
	}

	function surfaceTransportIssue(): void {
		if (hasRecentHealth()) return;
		connectionState = 'reconnecting';
	}

	function markHealthy(): void {
		lastHealthyAt = Date.now();
	}

	function hasRecentHealth(): boolean {
		return Date.now() - lastHealthyAt < TRANSPORT_HEALTH_GRACE_MS;
	}

	function command<T extends ClientCommand['type']>(
		type: T,
		payload: Extract<ClientCommand, { type: T }>['payload']
	): Extract<ClientCommand, { type: T }> {
		return {
			source: AXIAL_CLIENT_SOURCE,
			version: AXIAL_MULTIPLAYER_PROTOCOL_VERSION,
			id: crypto.randomUUID(),
			type,
			payload
		} as Extract<ClientCommand, { type: T }>;
	}

	return {
		get boardDimensions() {
			return rules.board;
		},
		get canEditRules() {
			return canEditRules;
		},
		get canReady() {
			return canReady;
		},
		get connectionLabel() {
			return connectionLabel(connectionState);
		},
		get connectionState() {
			return connectionState;
		},
		get copied() {
			return copied;
		},
		get currentLabel() {
			return currentLabel;
		},
		get currentPlayer() {
			return game.status.state === 'playing' ? game.currentPlayer : null;
		},
		get displayName() {
			return displayName;
		},
		set displayName(value: string) {
			displayName = value;
		},
		get error() {
			return error;
		},
		get formattedRoomCode() {
			return formattedRoomCode;
		},
		get game() {
			return game;
		},
		get hasRoom() {
			return Boolean(snapshot || credentials);
		},
		get inviteUrl() {
			return snapshot?.inviteUrl ?? '';
		},
		get joinCodeDraft() {
			return joinCodeDraft;
		},
		set joinCodeDraft(value: string) {
			joinCodeDraft = value.toUpperCase();
		},
		get lockedMove() {
			return lockedMove;
		},
		get matchMode(): MatchMode {
			return 'classic';
		},
		get moveError() {
			return error;
		},
		get opponent() {
			return opponent;
		},
		get previewMove() {
			return previewMove;
		},
		get qrPayload() {
			return snapshot?.qrPayload ?? snapshot?.inviteUrl ?? '';
		},
		get roomCode() {
			return snapshot?.roomCode ?? credentials?.roomCode ?? normalizeRoomCode(joinCodeDraft);
		},
		get self() {
			return self;
		},
		get setupLocked() {
			return setupLocked;
		},
		get showQr() {
			return showQr;
		},
		get snapshot() {
			return snapshot;
		},
		get statusTitle() {
			return statusTitle;
		},
		get statusTone() {
			return statusTone;
		},
		get winCondition() {
			return rules.winCondition;
		},
		get winnerLabel() {
			return winnerLabel;
		},
		get yourTurn() {
			return yourTurn;
		},
		copyInvite,
		createPrivateRoom,
		destroy,
		hydrateFromBrowser,
		joinPrivateRoom,
		leaveRoom,
		rematch,
		resync,
		selectOrPlayMove,
		setBoardDimension,
		setHover,
		setLinesToWin,
		setMatchMode,
		setWinLineLength,
		toggleQr,
		toggleReady,
		updateDisplayName,
		useRules
	};
}

function defaultRules(): MultiplayerRules {
	return {
		mode: 'classic',
		board: { height: 6, rows: 6, columns: 7 },
		winCondition: { lineLength: 4, linesToWin: 1 }
	};
}

function createGameForRules(rules: MultiplayerRules): GameSnapshot {
	return createGame(rules.winCondition, rules.board);
}

function toGameSnapshot(game: SerializableGameSnapshot): GameSnapshot {
	return {
		board: Uint8Array.from(game.board),
		dimensions: { ...game.dimensions },
		currentPlayer: game.currentPlayer,
		winCondition: { ...game.winCondition },
		completedLines: game.completedLines.map((line) => ({
			...line,
			cells: [...line.cells],
			direction: [...line.direction] as [number, number, number]
		})),
		lastMove: game.lastMove ? { ...game.lastMove } : null,
		moveHistory: game.moveHistory.map((move) => ({ ...move })),
		status: cloneStatus(game.status)
	};
}

function cloneStatus(status: GameSnapshot['status']): GameSnapshot['status'] {
	if (status.state === 'playing') return { state: 'playing', currentPlayer: status.currentPlayer };
	if (status.state === 'draw') return { state: 'draw' };
	return {
		state: 'won',
		winner: status.winner,
		line: [...status.line],
		lines: status.lines.map((line) => [...line]),
		lineCount: status.lineCount
	};
}

function winnerLabelFor(game: GameSnapshot, snapshot: PrivateRoomSnapshot | null): string | null {
	if (game.status.state !== 'won') return null;
	const winner = game.status.winner;
	return (
		snapshot?.players.find((player) => player.seat === winner)?.displayName ?? `Player ${winner}`
	);
}

function cloneRules(rules: MultiplayerRules): MultiplayerRules {
	return {
		mode: 'classic',
		board: { ...rules.board },
		winCondition: { ...rules.winCondition }
	};
}

function credentialsToIdentity(value: MultiplayerCredentials | null): PlayerIdentity | null {
	if (!value) return null;
	return {
		playerId: value.playerId,
		seat: value.seat,
		isHost: value.isHost,
		displayName: value.displayName
	};
}

function derivedConnectionState(
	nextSnapshot: PrivateRoomSnapshot,
	nextOpponent: PrivateRoomSnapshot['players'][number] | null
): ConnectionState {
	if (nextSnapshot.phase === 'expired') return 'expired';
	if (nextSnapshot.phase === 'playing' && nextOpponent && !nextOpponent.connected) {
		return 'opponent-disconnected';
	}
	return 'connected';
}

function roomStatusLabel(
	nextSnapshot: PrivateRoomSnapshot | null,
	state: ConnectionState,
	nextOpponent: PrivateRoomSnapshot['players'][number] | null
): string {
	if (!nextSnapshot) {
		if (state === 'creating') return 'Creating room';
		if (state === 'joining') return 'Joining room';
		if (state === 'connecting') return 'Connecting';
		if (state === 'reconnecting') return 'Reconnecting';
		if (state === 'resyncing') return 'Resyncing';
		if (state === 'fatal-error') return 'Connection failed';
		return 'Online room';
	}
	if (state === 'reconnecting') return 'Reconnecting';
	if (state === 'resyncing') return 'Resyncing';
	if (state === 'opponent-disconnected')
		return `${nextOpponent?.displayName ?? 'Opponent'} disconnected`;
	if (nextSnapshot.phase === 'waiting') {
		if (nextSnapshot.players.length < 2) return 'Waiting for friend';
		return nextSnapshot.players.every((player) => player.ready) ? 'Starting' : 'Ready check';
	}
	if (nextSnapshot.phase === 'ended') {
		const status = nextSnapshot.game.status;
		if (status.state === 'won') {
			const winner = nextSnapshot.players.find((player) => player.seat === status.winner);
			return `${winner?.displayName ?? 'Player'} wins`;
		}
		return 'Draw';
	}
	if (nextSnapshot.game.status.state === 'playing') {
		const active = nextSnapshot.players.find(
			(player) => player.seat === nextSnapshot.game.currentPlayer
		);
		return active?.playerId === nextSnapshot.you.playerId
			? 'Your turn'
			: `${active?.displayName ?? 'Opponent'} turn`;
	}
	return 'Connected';
}

function connectionLabel(state: ConnectionState): string {
	if (state === 'connected') return 'Online';
	if (state === 'opponent-disconnected') return 'Opponent away';
	if (state === 'reconnecting') return 'Syncing';
	if (state === 'resyncing') return 'Resyncing';
	if (state === 'fatal-error') return 'Error';
	if (state === 'expired') return 'Expired';
	if (state === 'creating') return 'Creating';
	if (state === 'joining') return 'Joining';
	if (state === 'connecting') return 'Connecting';
	return 'Idle';
}

function roomInviteUrl(roomCode: string): string {
	if (!browser) return `/?room=${roomCode}`;
	return `${window.location.origin}/?room=${roomCode}`;
}

function normalizeRoomCode(roomCode: string): string {
	return roomCode.toUpperCase().replace(/[\s-]/g, '');
}

function formatRoomCode(roomCode: string): string {
	const normalized = normalizeRoomCode(roomCode);
	if (normalized.length <= 4) return normalized;
	return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`;
}
