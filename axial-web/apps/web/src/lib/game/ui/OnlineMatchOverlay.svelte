<script lang="ts">
	import { Eye, LogOut, RotateCcw, Swords, Timer, Trophy } from '@lucide/svelte';
	import type { GameStatus, Player } from '@axial/core';
	import type { RoomPlayer } from '@axial/multiplayer-protocol';
	import type { OnlineController } from '$lib/multiplayer/onlineController.svelte';

	let { online }: { online: OnlineController } = $props();

	const snapshot = $derived(online.snapshot);
	const players = $derived(snapshot?.players ?? []);
	const resultTitle = $derived(
		snapshot ? titleFor(snapshot.game.status, players, snapshot.you.seat) : ''
	);
	const resultDetail = $derived(
		snapshot?.game.status.state === 'draw'
			? `Board filled in ${snapshot.game.moveHistory.length} moves`
			: `${snapshot?.game.moveHistory.length ?? 0} moves`
	);
	const rematchLabel = $derived(
		online.rematchExpired ? 'Closed' : online.self?.rematchReady ? 'Cancel' : 'Rematch'
	);

	function titleFor(status: GameStatus, players: RoomPlayer[], selfSeat: Player): string {
		if (status.state === 'draw') return 'Draw';
		if (status.state === 'playing') return 'Match in progress';
		const winner = players.find((player) => player.seat === status.winner);
		if (status.winner === selfSeat) return 'You win';
		return `${winner?.displayName ?? `P${status.winner}`} wins`;
	}
</script>

{#if online.showStartOverlay && snapshot}
	<div class="online-match-backdrop" data-mode="starting">
		<dialog class="online-match-dialog start-dialog" aria-labelledby="online-start-title" open>
			<p class="overlay-kicker">Match {snapshot.match.number}</p>
			<h2 id="online-start-title">Ready on axis</h2>

			<div class="versus-stage" aria-label="Players">
				{#each players as player (player.playerId)}
					<div class="versus-player" data-seat={player.seat}>
						<span>P{player.seat}</span>
						<strong>{player.displayName}</strong>
					</div>
					{#if player === players[0] && players.length > 1}
						<div class="versus-mark" aria-hidden="true"><Swords size={20} strokeWidth={1.8} /></div>
					{/if}
				{/each}
			</div>

			<div class="countdown-orb" aria-label={`Starting in ${online.startSeconds}`}>
				<span>{online.startSeconds}</span>
			</div>

			<div class="overlay-facts">
				<span>{online.matchSummary}</span>
				<strong
					>{online.startingPlayer?.displayName ?? `P${snapshot.match.startingPlayer}`} opens</strong
				>
			</div>
		</dialog>
	</div>
{:else if online.showResultOverlay && snapshot}
	<div class="online-match-backdrop" data-mode="result">
		<dialog class="online-match-dialog result-dialog" aria-labelledby="online-result-title" open>
			<div class="result-mark" data-result={snapshot.game.status.state}>
				<Trophy size={26} strokeWidth={1.7} />
			</div>

			<p class="overlay-kicker">Game over</p>
			<h2 id="online-result-title">{resultTitle}</h2>
			<p class="overlay-detail">{resultDetail}</p>

			<div class="rematch-meter" data-expired={online.rematchExpired}>
				<Timer size={15} strokeWidth={2} />
				<span>
					{#if online.rematchExpired}
						Rematch window closed
					{:else}
						{online.rematchSeconds}s to choose
					{/if}
				</span>
			</div>

			<div class="rematch-roster">
				{#each players as player (player.playerId)}
					<div class="rematch-player" data-self={player.playerId === snapshot.you.playerId}>
						<span>P{player.seat}</span>
						<strong>{player.displayName}</strong>
						<small>
							{#if player.rematchReady}
								Wants rematch
							{:else if online.rematchExpired}
								Timed out
							{:else}
								Choosing
							{/if}
						</small>
					</div>
				{/each}
			</div>

			<div class="online-overlay-actions">
				<button
					class="overlay-button primary"
					type="button"
					disabled={online.rematchExpired && !online.self?.rematchReady}
					onclick={online.rematch}
				>
					<span><RotateCcw size={17} strokeWidth={1.9} /></span>
					<strong>{rematchLabel}</strong>
				</button>
				<button class="overlay-button" type="button" onclick={online.dismissResultOverlay}>
					<span><Eye size={17} strokeWidth={1.9} /></span>
					<strong>Keep board</strong>
				</button>
				<button class="overlay-button" type="button" onclick={online.leaveRoom}>
					<span><LogOut size={17} strokeWidth={1.9} /></span>
					<strong>Leave</strong>
				</button>
			</div>
		</dialog>
	</div>
{/if}

<style>
	.online-match-backdrop {
		position: absolute;
		inset: 0;
		z-index: 5;
		display: grid;
		place-items: center;
		padding: 1rem;
		background:
			radial-gradient(
				circle at 50% 44%,
				color-mix(in oklab, var(--accent) 16%, transparent),
				transparent 22rem
			),
			color-mix(in oklab, #000 36%, transparent);
		backdrop-filter: blur(9px) saturate(1.08);
		animation: online-backdrop-in 260ms ease-out both;
	}

	.online-match-dialog {
		position: static;
		width: min(30rem, calc(100vw - 2rem));
		margin: 0;
		padding: 1.08rem;
		border: 1px solid color-mix(in oklab, var(--text) 20%, transparent);
		border-radius: 8px;
		background: color-mix(in oklab, var(--surface) 89%, transparent);
		color: var(--text);
		box-shadow: 0 24px 70px var(--shadow);
		text-align: center;
		transform-origin: 50% 54%;
		animation: online-dialog-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.overlay-kicker,
	.overlay-detail {
		margin: 0;
		color: var(--muted);
		font-weight: 780;
	}

	.overlay-kicker {
		font-size: 0.72rem;
		text-transform: uppercase;
	}

	.online-match-dialog h2 {
		margin: 0.12rem 0 0.8rem;
		font-size: 1.55rem;
		font-weight: 820;
		letter-spacing: 0;
	}

	.versus-stage,
	.rematch-roster {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		gap: 0.52rem;
	}

	.versus-player,
	.rematch-player {
		display: grid;
		min-width: 0;
		gap: 0.2rem;
		padding: 0.72rem 0.64rem;
		border: 1px solid color-mix(in oklab, var(--text) 12%, transparent);
		border-radius: 8px;
		background: color-mix(in oklab, var(--surface) 46%, transparent);
	}

	.versus-player[data-seat='1'],
	.rematch-player[data-self='true'] {
		border-color: color-mix(in oklab, var(--accent) 42%, transparent);
	}

	.versus-player[data-seat='2'] {
		border-color: color-mix(in oklab, var(--azure) 40%, transparent);
	}

	.versus-player span,
	.rematch-player span,
	.rematch-player small {
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.versus-player strong,
	.rematch-player strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 1rem;
		font-weight: 850;
	}

	.versus-mark {
		display: grid;
		width: 2.25rem;
		height: 2.25rem;
		place-items: center;
		border-radius: 999px;
		background: color-mix(in oklab, var(--accent) 16%, transparent);
		color: var(--accent);
	}

	.countdown-orb {
		display: grid;
		width: 5.5rem;
		height: 5.5rem;
		margin: 1rem auto 0.78rem;
		place-items: center;
		border: 1px solid color-mix(in oklab, var(--accent) 42%, transparent);
		border-radius: 999px;
		background:
			radial-gradient(
				circle at 50% 42%,
				color-mix(in oklab, var(--accent) 28%, transparent),
				transparent 68%
			),
			color-mix(in oklab, var(--surface) 58%, transparent);
		box-shadow:
			inset 0 1px 0 color-mix(in oklab, #fff 16%, transparent),
			0 0 34px color-mix(in oklab, var(--accent) 18%, transparent);
		animation: countdown-pulse 1000ms ease-in-out infinite;
	}

	.countdown-orb span {
		font-size: 2.3rem;
		font-weight: 880;
		line-height: 1;
	}

	.overlay-facts,
	.rematch-meter {
		display: grid;
		gap: 0.18rem;
		color: var(--muted);
		font-size: 0.78rem;
		font-weight: 760;
	}

	.overlay-facts strong {
		color: var(--text);
		font-size: 0.9rem;
	}

	.result-mark {
		display: inline-grid;
		width: 3.1rem;
		height: 3.1rem;
		margin: 0 auto 0.56rem;
		place-items: center;
		border: 1px solid color-mix(in oklab, var(--accent) 40%, transparent);
		border-radius: 999px;
		background: color-mix(in oklab, var(--accent) 16%, transparent);
		color: var(--accent);
		box-shadow: 0 0 28px color-mix(in oklab, var(--accent) 18%, transparent);
	}

	.result-mark[data-result='draw'] {
		color: var(--azure);
		border-color: color-mix(in oklab, var(--azure) 36%, transparent);
		background: color-mix(in oklab, var(--azure) 14%, transparent);
	}

	.rematch-meter {
		grid-template-columns: auto 1fr;
		align-items: center;
		justify-content: center;
		width: fit-content;
		margin: 0.82rem auto;
		padding: 0.34rem 0.56rem;
		border: 1px solid color-mix(in oklab, var(--text) 12%, transparent);
		border-radius: 999px;
		background: color-mix(in oklab, var(--surface) 42%, transparent);
	}

	.rematch-meter[data-expired='true'] {
		color: var(--solar);
	}

	.online-overlay-actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
		margin-top: 0.88rem;
	}

	.overlay-button.primary {
		grid-column: 1 / -1;
	}

	.overlay-button {
		display: inline-flex;
		min-width: 0;
		min-height: 3rem;
		align-items: center;
		justify-content: center;
		gap: 0.48rem;
		border: 1px solid color-mix(in oklab, var(--text) 14%, transparent);
		border-radius: 8px;
		background: color-mix(in oklab, var(--surface) 55%, transparent);
		color: var(--text);
		cursor: pointer;
		font-size: 0.82rem;
		font-weight: 820;
		transition:
			transform 160ms ease,
			background 160ms ease,
			border-color 160ms ease;
	}

	.overlay-button.primary {
		border-color: color-mix(in oklab, var(--accent) 42%, transparent);
		background: color-mix(in oklab, var(--accent) 24%, var(--surface));
	}

	.overlay-button:not(:disabled):hover {
		transform: translateY(-1px);
		border-color: color-mix(in oklab, var(--accent) 48%, transparent);
	}

	.overlay-button:disabled {
		cursor: not-allowed;
		opacity: 0.58;
	}

	.overlay-button span {
		display: inline-grid;
		width: 1.7rem;
		height: 1.7rem;
		place-items: center;
		border-radius: 999px;
		background: color-mix(in oklab, var(--surface) 48%, transparent);
		color: color-mix(in oklab, var(--text) 84%, var(--accent));
	}

	@keyframes online-backdrop-in {
		from {
			opacity: 0;
		}
	}

	@keyframes online-dialog-in {
		from {
			opacity: 0;
			transform: translateY(0.8rem) scale(0.96);
		}
	}

	@keyframes countdown-pulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.045);
		}
	}

	@media (max-width: 560px) {
		.versus-stage,
		.rematch-roster {
			grid-template-columns: minmax(0, 1fr);
		}

		.versus-mark {
			justify-self: center;
		}

		.online-match-dialog {
			padding: 0.92rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.online-match-backdrop,
		.online-match-dialog,
		.countdown-orb {
			animation: none;
		}
	}
</style>
