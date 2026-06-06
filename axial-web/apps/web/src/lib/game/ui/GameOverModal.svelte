<script lang="ts">
	import { Eye, Play, RotateCcw, Trophy } from '@lucide/svelte';
	import type { GameStatus } from '@axial/core';

	let {
		status,
		moveCount,
		winnerLabel,
		onNewMatch,
		onReviewFromStart,
		onKeepBoard
	}: {
		status: GameStatus;
		moveCount: number;
		winnerLabel: string | null;
		onNewMatch: () => void;
		onReviewFromStart: () => void;
		onKeepBoard: () => void;
	} = $props();

	const title = $derived(
		status.state === 'won' && winnerLabel
			? winnerLabel === 'You'
				? 'You win'
				: `${winnerLabel} wins`
			: 'Draw'
	);
	const resultDetail = $derived(
		status.state === 'won' ? `${moveCount} moves` : `Board filled in ${moveCount} moves`
	);
</script>

<div class="game-over-backdrop">
	<dialog class="game-over-dialog" aria-labelledby="game-over-title" open>
		<div class="result-mark" data-result={status.state}>
			<Trophy size={26} strokeWidth={1.7} />
		</div>

		<p class="result-kicker">Game over</p>
		<h2 id="game-over-title">{title}</h2>
		<p class="result-detail">{resultDetail}</p>

		<div class="modal-actions">
			<button
				class="modal-button primary"
				type="button"
				aria-label="Start a new match with an empty board"
				onclick={onNewMatch}
			>
				<RotateCcw size={17} strokeWidth={1.9} />
				<span>
					<strong>New match</strong>
					<small>Clear the board</small>
				</span>
			</button>
			<button
				class="modal-button"
				type="button"
				aria-label="Rewind this match to the start and step through it with redo"
				onclick={onReviewFromStart}
			>
				<Play size={17} strokeWidth={1.9} />
				<span>
					<strong>Review from start</strong>
					<small>Step with redo</small>
				</span>
			</button>
			<button
				class="modal-button"
				type="button"
				aria-label="Dismiss the result and keep the final board visible"
				onclick={onKeepBoard}
			>
				<Eye size={17} strokeWidth={1.9} />
				<span>
					<strong>Keep board</strong>
					<small>Dismiss result</small>
				</span>
			</button>
		</div>
	</dialog>
</div>

<style>
	.game-over-backdrop {
		position: absolute;
		inset: 0;
		z-index: 5;
		display: grid;
		place-items: center;
		padding: 1rem;
		background:
			radial-gradient(
				circle at 50% 42%,
				color-mix(in oklab, var(--accent) 15%, transparent),
				transparent 22rem
			),
			color-mix(in oklab, #000 34%, transparent);
		backdrop-filter: blur(8px);
	}

	.game-over-dialog {
		position: static;
		width: min(24rem, calc(100vw - 2rem));
		margin: 0;
		padding: 1.1rem;
		border: 1px solid color-mix(in oklab, var(--text) 20%, transparent);
		border-radius: 8px;
		background: color-mix(in oklab, var(--surface) 88%, transparent);
		color: var(--text);
		box-shadow: 0 24px 70px var(--shadow);
		text-align: center;
	}

	.result-mark {
		display: inline-grid;
		width: 3.2rem;
		height: 3.2rem;
		margin-bottom: 0.85rem;
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
		box-shadow: 0 0 28px color-mix(in oklab, var(--azure) 16%, transparent);
	}

	.result-kicker {
		margin: 0 0 0.2rem;
		color: var(--muted);
		font-size: 0.72rem;
		font-weight: 760;
		text-transform: uppercase;
	}

	.game-over-dialog h2 {
		margin: 0;
		font-size: 1.55rem;
		font-weight: 790;
		letter-spacing: 0;
	}

	.result-detail {
		margin: 0.35rem 0 1rem;
		color: var(--muted);
		font-size: 0.88rem;
		font-weight: 650;
	}

	.modal-actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
	}

	.modal-button.primary {
		grid-column: 1 / -1;
	}

	.modal-button {
		display: inline-flex;
		min-width: 0;
		min-height: 3.1rem;
		align-items: center;
		justify-content: center;
		gap: 0.42rem;
		padding: 0 0.7rem;
		border: 1px solid color-mix(in oklab, var(--text) 14%, transparent);
		border-radius: 8px;
		background: color-mix(in oklab, var(--surface) 58%, transparent);
		color: var(--text);
		cursor: pointer;
		font-size: 0.82rem;
		font-weight: 760;
		transition:
			transform 160ms ease,
			background 160ms ease,
			border-color 160ms ease;
	}

	.modal-button span {
		display: grid;
		min-width: 0;
		gap: 0.1rem;
		text-align: left;
	}

	.modal-button strong,
	.modal-button small {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.modal-button strong {
		font-size: 0.82rem;
		font-weight: 780;
	}

	.modal-button small {
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 680;
	}

	.modal-button:hover {
		transform: translateY(-1px);
		border-color: color-mix(in oklab, var(--accent) 46%, transparent);
		background: color-mix(in oklab, var(--accent) 13%, var(--surface));
	}

	.modal-button.primary {
		border-color: color-mix(in oklab, var(--accent) 52%, transparent);
		background: color-mix(in oklab, var(--accent) 22%, var(--surface));
	}

	@media (max-width: 440px) {
		.modal-actions {
			grid-template-columns: 1fr;
		}
	}
</style>
