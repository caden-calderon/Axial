<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { Check, Copy, DoorOpen, RefreshCcw, RotateCcw, Wifi, WifiOff } from '@lucide/svelte';
	import {
		AXIAL_CLIENT_SOURCE,
		AXIAL_MULTIPLAYER_PROTOCOL_VERSION,
		type ClientCommand,
		type ConnectionState,
		type PlayerIdentity,
		type PrivateRoomSnapshot,
		type RoomSnapshot
	} from '@axial/multiplayer-protocol';
	import { summarizeColumns } from '$lib/multiplayer/board';
	import {
		MultiplayerRequestError,
		clearCredentials,
		eventError,
		eventSnapshot,
		joinRoom,
		loadCredentials,
		openRoomSocket,
		saveCredentials,
		sendRoomCommand,
		type MultiplayerCredentials
	} from '$lib/multiplayer/client';

	type PageData = { code: string };
	let { data }: { data: PageData } = $props();

	let credentials = $state<MultiplayerCredentials | null>(null);
	let snapshot = $state<PrivateRoomSnapshot | null>(null);
	let displayName = $state('');
	let error = $state('');
	let connectionState = $state<ConnectionState>('idle');
	let copied = $state(false);
	let rulesDraft = $state({
		height: 6,
		rows: 6,
		columns: 7,
		lineLength: 4,
		linesToWin: 1
	});

	let socket: WebSocket | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let manualClose = false;

	const roomCode = $derived(data.code.toUpperCase().replace(/[\s-]/g, ''));
	const self = $derived(
		snapshot?.players.find((player) => player.playerId === snapshot?.you.playerId) ?? null
	);
	const opponent = $derived(
		snapshot?.players.find((player) => player.playerId !== snapshot?.you.playerId) ?? null
	);
	const columns = $derived(snapshot ? summarizeColumns(snapshot.game) : []);
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
	const statusLabel = $derived(roomStatusLabel(snapshot, connectionState, opponent));
	const boardColumns = $derived(
		snapshot ? `repeat(${snapshot.rules.board.columns}, minmax(34px, 1fr))` : 'repeat(7, 1fr)'
	);

	onMount(() => {
		credentials = loadCredentials(roomCode);
		if (credentials) {
			displayName = credentials.displayName;
			connect('connecting');
		}
	});

	onDestroy(() => {
		manualClose = true;
		if (reconnectTimer) clearTimeout(reconnectTimer);
		socket?.close();
	});

	async function joinThisRoom(): Promise<void> {
		error = '';
		connectionState = 'joining';
		try {
			const joined = await joinRoom(roomCode, displayName);
			credentials = joined.player;
			saveCredentials(joined.player);
			applySnapshot(joined.snapshot);
			connect('connecting');
		} catch (reason) {
			connectionState = 'fatal-error';
			error =
				reason instanceof MultiplayerRequestError
					? reason.error.message
					: reason instanceof Error
						? reason.message
						: 'Could not join this room.';
		}
	}

	function connect(nextState: ConnectionState): void {
		if (!credentials) return;
		if (reconnectTimer) clearTimeout(reconnectTimer);
		connectionState = nextState;
		manualClose = false;
		socket?.close();
		socket = openRoomSocket({
			credentials,
			lastSeenRevision: snapshot?.revision ?? 0,
			onOpen: () => {
				connectionState = snapshot ? derivedConnectionState(snapshot, opponent) : 'connected';
			},
			onEvent: handleEvent,
			onClose: () => {
				socket = null;
				if (manualClose || connectionState === 'fatal-error' || connectionState === 'expired')
					return;
				connectionState = 'reconnecting';
				reconnectTimer = setTimeout(() => connect('reconnecting'), 1200);
			},
			onError: () => {
				if (connectionState !== 'fatal-error') connectionState = 'reconnecting';
			}
		});
	}

	function handleEvent(event: import('@axial/multiplayer-protocol').ServerEvent): void {
		const incoming = eventSnapshot(event);
		if (incoming) applySnapshot(incoming);

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

	function applySnapshot(incoming: RoomSnapshot | PrivateRoomSnapshot): void {
		const previous = snapshot;
		const retainedIdentity =
			'you' in incoming ? incoming.you : (previous?.you ?? credentialsToIdentity(credentials));
		if (!retainedIdentity) return;

		const inviteUrl =
			'inviteUrl' in incoming
				? incoming.inviteUrl
				: (previous?.inviteUrl ?? `${window.location.origin}/room/${roomCode}`);
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
		rulesDraft = {
			height: snapshot.rules.board.height,
			rows: snapshot.rules.board.rows,
			columns: snapshot.rules.board.columns,
			lineLength: snapshot.rules.winCondition.lineLength,
			linesToWin: snapshot.rules.winCondition.linesToWin
		};
	}

	function updateName(): void {
		if (!displayName.trim()) return;
		send(command('room:set-name', { displayName }));
	}

	function updateRules(): void {
		if (!snapshot) return;
		send(
			command('room:set-rules', {
				rules: {
					mode: 'classic',
					board: {
						height: Number(rulesDraft.height),
						rows: Number(rulesDraft.rows),
						columns: Number(rulesDraft.columns)
					},
					winCondition: {
						lineLength: Number(rulesDraft.lineLength),
						linesToWin: Number(rulesDraft.linesToWin)
					}
				},
				expectedRevision: snapshot.revision
			})
		);
	}

	function toggleReady(): void {
		send(command('room:ready', { ready: !self?.ready }));
	}

	function play(row: number, col: number): void {
		if (!snapshot || !yourTurn) return;
		send(
			command('game:play-move', {
				move: { row, col },
				expectedRevision: snapshot.revision
			})
		);
	}

	function rematch(): void {
		send(command('room:rematch-vote', { ready: true }));
	}

	function resync(): void {
		if (!snapshot) {
			connect('resyncing');
			return;
		}
		if (!send(command('room:resync', { lastSeenRevision: snapshot.revision }))) {
			connect('resyncing');
		} else {
			connectionState = 'resyncing';
		}
	}

	function leaveRoom(): void {
		manualClose = true;
		if (credentials) clearCredentials(credentials.roomCode);
		socket?.close();
		credentials = null;
		snapshot = null;
		connectionState = 'idle';
	}

	async function copyInvite(): Promise<void> {
		if (!snapshot) return;
		await navigator.clipboard.writeText(snapshot.inviteUrl);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 1600);
	}

	function send(commandToSend: ClientCommand): boolean {
		error = '';
		if (!sendRoomCommand(socket, commandToSend)) {
			error = 'Room connection is not ready.';
			connect('reconnecting');
			return false;
		}
		return true;
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
		nextOpponent: typeof opponent
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
		nextOpponent: typeof opponent
	): string {
		if (!nextSnapshot) return state === 'joining' ? 'Joining' : 'Ready to join';
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
</script>

<svelte:head>
	<title>Axial Room {roomCode}</title>
</svelte:head>

<main class="room-shell">
	<header class="topbar">
		<a href={resolve('/')} class="wordmark">AXIAL</a>
		<div class="connection" data-state={connectionState}>
			{#if connectionState === 'connected'}
				<Wifi size={16} aria-hidden="true" />
			{:else}
				<WifiOff size={16} aria-hidden="true" />
			{/if}
			<span>{statusLabel}</span>
		</div>
	</header>

	{#if !credentials || !snapshot}
		<section class="join-panel" aria-labelledby="join-title">
			<p>ROOM {roomCode}</p>
			<h1 id="join-title">Join private match</h1>
			<label>
				<span>Display name</span>
				<input
					bind:value={displayName}
					maxlength="24"
					placeholder="Player name"
					autocomplete="nickname"
				/>
			</label>
			<button type="button" class="primary" onclick={joinThisRoom}>
				<DoorOpen size={18} aria-hidden="true" />
				<span>Join room</span>
			</button>
			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}
		</section>
	{:else}
		<section class="room-grid">
			<aside class="side-panel">
				<div class="room-code">
					<span>Room</span>
					<strong>{roomCode.slice(0, 4)}-{roomCode.slice(4)}</strong>
				</div>
				<button type="button" onclick={copyInvite}>
					<Copy size={16} aria-hidden="true" />
					<span>{copied ? 'Copied' : 'Copy invite'}</span>
				</button>
				<div class="qr-payload">
					<span>QR payload</span>
					<code>{snapshot.qrPayload}</code>
				</div>

				<div class="players">
					{#each snapshot.players as player (player.playerId)}
						<div class="player-row" data-self={player.playerId === snapshot.you.playerId}>
							<span class="seat">P{player.seat}</span>
							<strong>{player.displayName}</strong>
							<span>{player.connected ? 'Online' : 'Away'}</span>
							{#if player.ready && snapshot.phase === 'waiting'}
								<Check size={16} aria-label="Ready" />
							{/if}
						</div>
					{/each}
				</div>

				<label>
					<span>Your name</span>
					<input bind:value={displayName} maxlength="24" onblur={updateName} />
				</label>

				{#if canEditRules}
					<div class="rules">
						<div class="rule-row">
							<label>
								<span>Height</span>
								<input type="number" min="6" max="10" bind:value={rulesDraft.height} />
							</label>
							<label>
								<span>Rows</span>
								<input type="number" min="6" max="10" bind:value={rulesDraft.rows} />
							</label>
							<label>
								<span>Columns</span>
								<input type="number" min="7" max="10" bind:value={rulesDraft.columns} />
							</label>
						</div>
						<div class="rule-row">
							<label>
								<span>Connect</span>
								<select bind:value={rulesDraft.lineLength}>
									<option value={4}>4</option>
									<option value={5}>5</option>
								</select>
							</label>
							<label>
								<span>Lines</span>
								<select bind:value={rulesDraft.linesToWin}>
									<option value={1}>1</option>
									<option value={2}>2</option>
									<option value={3}>3</option>
								</select>
							</label>
						</div>
						<button type="button" onclick={updateRules}>Apply rules</button>
					</div>
				{/if}

				<div class="panel-actions">
					{#if canReady}
						<button type="button" class="primary" onclick={toggleReady}>
							<Check size={16} aria-hidden="true" />
							<span>{self?.ready ? 'Unready' : 'Ready'}</span>
						</button>
					{/if}
					{#if snapshot.phase === 'ended'}
						<button type="button" class="primary" onclick={rematch}>
							<RotateCcw size={16} aria-hidden="true" />
							<span>{self?.rematchReady ? 'Waiting' : 'Rematch'}</span>
						</button>
					{/if}
					<button type="button" onclick={resync}>
						<RefreshCcw size={16} aria-hidden="true" />
						<span>Resync</span>
					</button>
					<button type="button" onclick={leaveRoom}>Leave</button>
				</div>

				{#if error}
					<p class="error" role="alert">{error}</p>
				{/if}
			</aside>

			<section class="board-panel" aria-label="Axial room board">
				<div class="board-heading">
					<p>
						{snapshot.rules.board.height} x {snapshot.rules.board.rows} x {snapshot.rules.board
							.columns}
					</p>
					<h1>{statusLabel}</h1>
				</div>
				<div class="board-grid" style={`grid-template-columns: ${boardColumns};`}>
					{#each columns as column (`${column.row}-${column.col}`)}
						<button
							type="button"
							class="column"
							data-owner={column.top}
							disabled={!yourTurn || column.full || snapshot.phase !== 'playing'}
							aria-label={`Row ${column.row + 1}, column ${column.col + 1}, height ${column.height}`}
							onclick={() => play(column.row, column.col)}
						>
							<span>{column.height}</span>
						</button>
					{/each}
				</div>
				<p class="move-count">
					{snapshot.game.moveHistory.length} moves · revision {snapshot.revision}
				</p>
			</section>
		</section>
	{/if}
</main>

<style>
	:global(body) {
		margin: 0;
		background: #101514;
		color: #f4f1e8;
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
	}

	.room-shell {
		min-height: 100svh;
		padding: 18px;
		background:
			linear-gradient(135deg, rgba(93, 199, 151, 0.14), transparent 34%),
			linear-gradient(315deg, rgba(228, 190, 103, 0.12), transparent 32%), #101514;
	}

	.topbar,
	.room-grid,
	.join-panel {
		width: min(1180px, 100%);
		margin: 0 auto;
	}

	.topbar {
		height: 48px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.wordmark {
		color: #f4f1e8;
		font-weight: 900;
		text-decoration: none;
		letter-spacing: 0;
	}

	.connection {
		min-height: 34px;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0 12px;
		border: 1px solid rgba(244, 241, 232, 0.14);
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.07);
		color: rgba(244, 241, 232, 0.82);
		font-size: 0.86rem;
		font-weight: 800;
	}

	.connection[data-state='opponent-disconnected'],
	.connection[data-state='reconnecting'],
	.connection[data-state='resyncing'] {
		color: #f0c76d;
	}

	.connection[data-state='fatal-error'],
	.connection[data-state='expired'] {
		color: #ff9f9f;
	}

	.join-panel {
		min-height: calc(100svh - 84px);
		display: grid;
		align-content: center;
		gap: 16px;
		max-width: 480px;
	}

	.room-grid {
		display: grid;
		grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
		gap: 18px;
		padding-top: 18px;
	}

	.side-panel,
	.board-panel,
	.join-panel {
		border: 1px solid rgba(244, 241, 232, 0.14);
		border-radius: 8px;
		background: rgba(18, 26, 24, 0.9);
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.26);
	}

	.side-panel,
	.board-panel {
		padding: 18px;
	}

	.side-panel {
		display: grid;
		align-content: start;
		gap: 14px;
	}

	.join-panel {
		padding: 24px;
	}

	p,
	h1 {
		margin: 0;
	}

	h1 {
		font-size: clamp(1.8rem, 5vw, 3.2rem);
		line-height: 1;
		letter-spacing: 0;
	}

	.join-panel > p,
	.board-heading p,
	.room-code span,
	.qr-payload span,
	label span {
		color: #72cfa1;
		font-size: 0.74rem;
		font-weight: 900;
		letter-spacing: 0;
	}

	label {
		display: grid;
		gap: 7px;
	}

	input,
	select {
		width: 100%;
		min-width: 0;
		min-height: 40px;
		box-sizing: border-box;
		border: 1px solid rgba(244, 241, 232, 0.14);
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.06);
		color: #f4f1e8;
		font: inherit;
		padding: 0 10px;
		outline: none;
	}

	input:focus,
	select:focus {
		border-color: #72cfa1;
		box-shadow: 0 0 0 3px rgba(114, 207, 161, 0.18);
	}

	button {
		min-height: 40px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		border: 1px solid rgba(244, 241, 232, 0.15);
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.08);
		color: #f4f1e8;
		font: inherit;
		font-weight: 850;
		cursor: pointer;
	}

	button.primary {
		background: #72cfa1;
		color: #0d1713;
		border-color: transparent;
	}

	button:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}

	.room-code {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
	}

	.room-code strong {
		font-size: 1.45rem;
		letter-spacing: 0;
	}

	.qr-payload {
		display: grid;
		gap: 7px;
	}

	code {
		display: block;
		overflow-wrap: anywhere;
		color: rgba(244, 241, 232, 0.72);
		font-size: 0.78rem;
	}

	.players,
	.panel-actions,
	.rules {
		display: grid;
		gap: 10px;
	}

	.player-row {
		min-height: 42px;
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		align-items: center;
		gap: 9px;
		padding: 0 10px;
		border: 1px solid rgba(244, 241, 232, 0.1);
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.045);
	}

	.player-row[data-self='true'] {
		border-color: rgba(114, 207, 161, 0.42);
	}

	.seat {
		color: #0d1713;
		background: #e8c66f;
		border-radius: 6px;
		padding: 3px 6px;
		font-size: 0.76rem;
		font-weight: 900;
	}

	.player-row > span:last-of-type {
		color: rgba(244, 241, 232, 0.62);
		font-size: 0.78rem;
		font-weight: 800;
	}

	.rule-row {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}

	.rule-row + .rule-row {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.board-panel {
		display: grid;
		align-content: start;
		gap: 18px;
	}

	.board-heading {
		display: grid;
		gap: 8px;
	}

	.board-grid {
		display: grid;
		gap: 8px;
	}

	.column {
		aspect-ratio: 1;
		min-height: 34px;
		padding: 0;
		border-color: rgba(244, 241, 232, 0.14);
		background: rgba(255, 255, 255, 0.055);
	}

	.column span {
		width: 72%;
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		border-radius: 7px;
		background: rgba(244, 241, 232, 0.08);
		color: rgba(244, 241, 232, 0.72);
		font-size: 0.78rem;
		font-weight: 900;
	}

	.column[data-owner='1'] span {
		background: linear-gradient(135deg, #8ef0ba, #4aa978);
		color: #06120d;
	}

	.column[data-owner='2'] span {
		background: linear-gradient(135deg, #f2d078, #c98d3e);
		color: #1a1004;
	}

	.move-count {
		color: rgba(244, 241, 232, 0.58);
		font-size: 0.86rem;
		font-weight: 750;
	}

	.error {
		padding: 10px 12px;
		border-radius: 8px;
		background: rgba(255, 107, 107, 0.12);
		color: #ffb5b5;
		font-size: 0.9rem;
	}

	@media (max-width: 820px) {
		.room-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 560px) {
		.room-shell {
			padding: 12px;
		}

		.topbar {
			height: auto;
			align-items: flex-start;
			flex-direction: column;
		}

		.rule-row,
		.rule-row + .rule-row {
			grid-template-columns: 1fr;
		}

		.board-grid {
			gap: 5px;
		}
	}
</style>
