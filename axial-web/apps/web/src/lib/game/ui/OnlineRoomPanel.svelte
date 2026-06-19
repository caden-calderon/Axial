<script lang="ts">
	import QRCode from 'qrcode';
	import {
		Check,
		Copy,
		DoorOpen,
		LogOut,
		Play,
		QrCode,
		RefreshCcw,
		RotateCcw,
		Wifi
	} from '@lucide/svelte';
	import type { OnlineController } from '$lib/multiplayer/onlineController.svelte';

	let { online }: { online: OnlineController } = $props();

	let qrDataUrl = $state('');

	$effect(() => {
		const payload = online.qrPayload;
		if (!online.showQr || !payload) {
			qrDataUrl = '';
			return;
		}

		let active = true;
		void QRCode.toDataURL(payload, {
			margin: 1,
			width: 164,
			color: {
				dark: '#10231b',
				light: '#eef8f1'
			}
		}).then((dataUrl) => {
			if (active) qrDataUrl = dataUrl;
		});

		return () => {
			active = false;
		};
	});
</script>

<section class="panel-section online-section">
	<div class="section-heading">
		<Wifi size={15} strokeWidth={2} />
		<span>Online</span>
		<small class="online-state" data-state={online.connectionState}>{online.connectionLabel}</small>
	</div>

	{#if online.snapshot}
		<div class="online-code-row">
			<div>
				<span>Room</span>
				<strong>{online.formattedRoomCode}</strong>
			</div>
			<div class="online-code-actions">
				<button
					type="button"
					class="mini-icon-button"
					title="Copy invite"
					onclick={online.copyInvite}
				>
					<Copy size={14} strokeWidth={2} />
					<span>{online.copied ? 'Copied' : 'Copy'}</span>
				</button>
				<button
					type="button"
					class="mini-icon-button"
					class:active={online.showQr}
					title="Show QR code"
					aria-pressed={online.showQr}
					onclick={online.toggleQr}
				>
					<QrCode size={14} strokeWidth={2} />
					<span>QR</span>
				</button>
			</div>
		</div>

		{#if online.showQr}
			<div class="qr-card" aria-label="Invite QR code">
				{#if qrDataUrl}
					<img src={qrDataUrl} alt="Invite QR code" />
				{:else}
					<span>Generating</span>
				{/if}
			</div>
		{/if}

		<div class="online-players">
			{#each online.snapshot.players as player (player.playerId)}
				<div class="online-player" data-self={player.playerId === online.snapshot.you.playerId}>
					<span class="online-seat">P{player.seat}</span>
					<strong>{player.displayName}</strong>
					<small>{player.connected ? 'Online' : 'Away'}</small>
					{#if player.ready && online.snapshot.phase === 'waiting'}
						<Check size={14} strokeWidth={2.2} aria-label="Ready" />
					{/if}
					{#if player.rematchReady && online.snapshot.phase === 'ended'}
						<RotateCcw size={14} strokeWidth={2.2} aria-label="Rematch ready" />
					{/if}
				</div>
			{/each}
		</div>

		<label class="online-field">
			<span>Your name</span>
			<input
				bind:value={online.displayName}
				maxlength="24"
				autocomplete="nickname"
				onblur={online.updateDisplayName}
			/>
		</label>

		<div class="online-actions">
			{#if online.canStart}
				<button type="button" class="primary-action" onclick={online.startGame}>
					<Play size={15} strokeWidth={2.1} />
					<span>Start game</span>
				</button>
			{/if}
			{#if online.canReady}
				<button type="button" class="primary-action" onclick={online.toggleReady}>
					<Check size={15} strokeWidth={2.1} />
					<span>{online.self?.ready ? 'Unready' : 'Ready'}</span>
				</button>
			{/if}
			{#if online.snapshot.phase === 'ended'}
				<button type="button" class="primary-action" onclick={online.rematch}>
					<RotateCcw size={15} strokeWidth={2.1} />
					<span>{online.self?.rematchReady ? 'Waiting' : 'Rematch'}</span>
				</button>
			{/if}
			<button type="button" onclick={online.resync}>
				<RefreshCcw size={15} strokeWidth={2.1} />
				<span>Resync</span>
			</button>
			<button type="button" onclick={online.leaveRoom}>
				<LogOut size={15} strokeWidth={2.1} />
				<span>Leave</span>
			</button>
		</div>
	{:else}
		<label class="online-field">
			<span>Your name</span>
			<input bind:value={online.displayName} maxlength="24" autocomplete="nickname" />
		</label>

		<button type="button" class="primary-action" onclick={online.createPrivateRoom}>
			<QrCode size={15} strokeWidth={2.1} />
			<span>Create room</span>
		</button>

		<div class="online-join-row">
			<label class="online-field">
				<span>Join code</span>
				<input
					bind:value={online.joinCodeDraft}
					maxlength="9"
					autocomplete="off"
					inputmode="text"
					placeholder="ABCD-EFGH"
				/>
			</label>
			<button type="button" title="Join room" onclick={online.joinPrivateRoom}>
				<DoorOpen size={15} strokeWidth={2.1} />
				<span>Join</span>
			</button>
		</div>
	{/if}

	{#if online.error}
		<p class="move-error" role="alert">{online.error}</p>
	{/if}
</section>
