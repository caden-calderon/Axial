<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ArrowLeft, CopyPlus, DoorOpen } from '@lucide/svelte';
	import {
		MultiplayerRequestError,
		createRoom,
		joinRoom,
		saveCredentials,
		saveRoomSnapshot
	} from '$lib/multiplayer/client';

	let displayName = $state('');
	let roomCode = $state('');
	let busy = $state(false);
	let error = $state('');

	async function createPrivateRoom(): Promise<void> {
		await run(async () => {
			const room = await createRoom(displayName);
			saveCredentials(room.player);
			saveRoomSnapshot(room.snapshot);
			await goto(resolve('/room/[code]', { code: room.roomCode }));
		});
	}

	async function joinPrivateRoom(): Promise<void> {
		await run(async () => {
			const room = await joinRoom(roomCode, displayName);
			saveCredentials(room.player);
			saveRoomSnapshot(room.snapshot);
			await goto(resolve('/room/[code]', { code: room.roomCode }));
		});
	}

	async function run(action: () => Promise<void>): Promise<void> {
		error = '';
		busy = true;
		try {
			await action();
		} catch (reason) {
			error =
				reason instanceof MultiplayerRequestError
					? reason.error.message
					: reason instanceof Error
						? reason.message
						: 'Room request failed.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Axial Rooms</title>
	<meta name="description" content="Create or join a private Axial online room." />
</svelte:head>

<main class="room-shell">
	<section class="room-panel" aria-labelledby="room-title">
		<div class="room-heading">
			<p>AXIAL ONLINE</p>
			<h1 id="room-title">Private Classic rooms</h1>
		</div>

		<label>
			<span>Display name</span>
			<input
				bind:value={displayName}
				maxlength="24"
				placeholder="Player name"
				autocomplete="nickname"
			/>
		</label>

		<div class="actions">
			<button type="button" class="primary" disabled={busy} onclick={createPrivateRoom}>
				<CopyPlus size={18} aria-hidden="true" />
				<span>Create room</span>
			</button>
		</div>

		<div class="join-row">
			<label>
				<span>Room code</span>
				<input
					bind:value={roomCode}
					maxlength="9"
					placeholder="ABCD-EFGH"
					autocomplete="off"
					inputmode="text"
				/>
			</label>
			<button type="button" disabled={busy || !roomCode.trim()} onclick={joinPrivateRoom}>
				<DoorOpen size={18} aria-hidden="true" />
				<span>Join</span>
			</button>
		</div>

		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}
	</section>

	<a class="back-link" href={resolve('/')}>
		<ArrowLeft size={16} aria-hidden="true" />
		<span>Local game</span>
	</a>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #111615;
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
		display: grid;
		place-items: center;
		padding: 24px;
		background:
			linear-gradient(135deg, rgba(114, 207, 161, 0.16), transparent 34%),
			linear-gradient(315deg, rgba(235, 193, 91, 0.13), transparent 30%), #111615;
	}

	.room-panel {
		width: min(100%, 520px);
		display: grid;
		gap: 18px;
		padding: 24px;
		border: 1px solid rgba(244, 241, 232, 0.14);
		border-radius: 8px;
		background: rgba(20, 27, 26, 0.9);
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.3);
	}

	.room-heading {
		display: grid;
		gap: 8px;
	}

	p,
	h1 {
		margin: 0;
	}

	.room-heading p {
		color: #72cfa1;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0;
	}

	h1 {
		font-size: clamp(2rem, 7vw, 3.6rem);
		line-height: 0.95;
		letter-spacing: 0;
	}

	label {
		display: grid;
		gap: 8px;
		color: rgba(244, 241, 232, 0.74);
		font-size: 0.82rem;
		font-weight: 700;
	}

	input {
		min-height: 46px;
		border: 1px solid rgba(244, 241, 232, 0.16);
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.06);
		color: #f4f1e8;
		font: inherit;
		font-size: 1rem;
		padding: 0 13px;
		outline: none;
	}

	input:focus {
		border-color: #72cfa1;
		box-shadow: 0 0 0 3px rgba(114, 207, 161, 0.18);
	}

	.actions,
	.join-row {
		display: grid;
		gap: 12px;
	}

	.join-row {
		grid-template-columns: 1fr auto;
		align-items: end;
	}

	button,
	.back-link {
		min-height: 46px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		border: 1px solid rgba(244, 241, 232, 0.16);
		border-radius: 8px;
		color: #f4f1e8;
		background: rgba(255, 255, 255, 0.08);
		font: inherit;
		font-weight: 800;
		text-decoration: none;
		cursor: pointer;
	}

	button.primary {
		background: #72cfa1;
		color: #0d1713;
		border-color: transparent;
	}

	button:disabled {
		opacity: 0.48;
		cursor: not-allowed;
	}

	.error {
		padding: 10px 12px;
		border-radius: 8px;
		background: rgba(255, 107, 107, 0.12);
		color: #ffb5b5;
		font-size: 0.9rem;
	}

	.back-link {
		position: fixed;
		left: 20px;
		bottom: 20px;
		padding: 0 14px;
	}

	@media (max-width: 560px) {
		.join-row {
			grid-template-columns: 1fr;
		}

		.back-link {
			position: static;
			margin-top: 18px;
		}
	}
</style>
