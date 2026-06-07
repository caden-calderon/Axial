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
		<div class="result-header">
			<div class="result-mark" data-result={status.state}>
				<Trophy size={26} strokeWidth={1.7} />
			</div>

			<p class="result-kicker">Game over</p>
			<h2 id="game-over-title">{title}</h2>
			<p class="result-detail">{resultDetail}</p>
		</div>

		<div class="modal-actions">
			<button
				class="modal-button primary"
				type="button"
				aria-label="Start a new match with an empty board"
				onclick={onNewMatch}
			>
				<span class="button-icon"><RotateCcw size={17} strokeWidth={1.9} /></span>
				<span class="button-copy">
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
				<span class="button-icon"><Play size={17} strokeWidth={1.9} /></span>
				<span class="button-copy">
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
				<span class="button-icon"><Eye size={17} strokeWidth={1.9} /></span>
				<span class="button-copy">
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
		animation: result-backdrop-in 260ms ease-out both;
	}

	.game-over-dialog {
		position: static;
		width: min(28rem, calc(100vw - 2rem));
		margin: 0;
		padding: 1.1rem;
		border: 1px solid color-mix(in oklab, var(--text) 20%, transparent);
		border-radius: 8px;
		background: color-mix(in oklab, var(--surface) 88%, transparent);
		color: var(--text);
		box-shadow: 0 24px 70px var(--shadow);
		text-align: center;
		transform-origin: 50% 54%;
		animation: result-dialog-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.result-header {
		display: grid;
		justify-items: center;
		gap: 0.22rem;
		margin-bottom: 1rem;
	}

	.result-mark {
		display: inline-grid;
		width: 3.2rem;
		height: 3.2rem;
		margin-bottom: 0.5rem;
		place-items: center;
		border: 1px solid color-mix(in oklab, var(--accent) 40%, transparent);
		border-radius: 999px;
		background: color-mix(in oklab, var(--accent) 16%, transparent);
		color: var(--accent);
		box-shadow: 0 0 28px color-mix(in oklab, var(--accent) 18%, transparent);
		animation: result-mark-in 560ms cubic-bezier(0.16, 1, 0.3, 1) 90ms both;
	}

	.result-mark[data-result='draw'] {
		color: var(--azure);
		border-color: color-mix(in oklab, var(--azure) 36%, transparent);
		background: color-mix(in oklab, var(--azure) 14%, transparent);
		box-shadow: 0 0 28px color-mix(in oklab, var(--azure) 16%, transparent);
	}

	.result-kicker {
		margin: 0;
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
		margin: 0.14rem 0 0;
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
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		min-width: 0;
		min-height: 3.1rem;
		align-items: center;
		justify-content: stretch;
		gap: 0.52rem;
		padding: 0 0.78rem;
		border: 1px solid color-mix(in oklab, var(--text) 14%, transparent);
		border-radius: 8px;
		background: color-mix(in oklab, var(--surface) 58%, transparent);
		color: var(--text);
		cursor: pointer;
		font-size: 0.82rem;
		font-weight: 760;
		text-align: left;
		transition:
			transform 160ms ease,
			background 160ms ease,
			border-color 160ms ease;
	}

	.button-icon {
		display: inline-grid;
		width: 1.7rem;
		height: 1.7rem;
		place-items: center;
		border-radius: 999px;
		background: color-mix(in oklab, var(--surface) 48%, transparent);
		color: color-mix(in oklab, var(--text) 84%, var(--accent));
	}

	.button-copy {
		display: grid;
		min-width: 0;
		gap: 0.1rem;
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

	.modal-button.primary .button-icon {
		color: var(--text);
		background: color-mix(in oklab, var(--accent) 30%, transparent);
	}

	@media (max-width: 440px) {
		.modal-actions {
			grid-template-columns: 1fr;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.game-over-backdrop,
		.game-over-dialog,
		.result-mark {
			animation: none;
		}
	}

	@keyframes result-backdrop-in {
		from {
			opacity: 0;
			backdrop-filter: blur(0);
		}
		to {
			opacity: 1;
			backdrop-filter: blur(8px);
		}
	}

	@keyframes result-dialog-in {
		from {
			opacity: 0;
			transform: translateY(0.9rem) scale(0.965);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes result-mark-in {
		0% {
			opacity: 0;
			transform: scale(0.82);
		}
		62% {
			opacity: 1;
			transform: scale(1.08);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
