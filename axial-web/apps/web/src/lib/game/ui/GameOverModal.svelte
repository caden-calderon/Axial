<script lang="ts">
	import { Eye, Play, RotateCcw, Trophy, Equal } from '@lucide/svelte';
	import type { GameStatus } from '@axial/core';
	import DialogShell from './DialogShell.svelte';

	let {
		status,
		moveCount,
		matchDurationMs = null,
		winnerLabel,
		onNewMatch,
		onReviewFromStart,
		onKeepBoard
	}: {
		status: GameStatus;
		moveCount: number;
		matchDurationMs?: number | null;
		winnerLabel: string | null;
		onNewMatch: () => void;
		onReviewFromStart: () => void;
		onKeepBoard: () => void;
	} = $props();

	const title = $derived(
		status.state === 'won'
			? winnerLabel === 'You'
				? 'You win'
				: `${winnerLabel ?? `Player ${status.winner}`} wins`
			: 'An even match'
	);
	const durationLabel = $derived(matchDurationMs === null ? null : formatDuration(matchDurationMs));

	function formatDuration(milliseconds: number): string {
		const seconds = Math.floor(milliseconds / 1000);
		const minutes = Math.floor(seconds / 60);
		const remainder = String(seconds % 60).padStart(2, '0');
		if (minutes < 60) return `${minutes}:${remainder}`;
		return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${remainder}`;
	}
</script>

<DialogShell
	labelledby="game-over-title"
	describedby="game-over-detail"
	initialFocusSelector=".modal-button.primary"
	onEscape={onKeepBoard}
>
	<div class="game-over-backdrop">
		<section class="game-over-dialog">
			<div class="result-header">
				<div class="result-kicker">
					{#if status.state === 'won'}<Trophy size={16} strokeWidth={1.7} />{:else}<Equal
							size={16}
							strokeWidth={1.7}
						/>{/if}
					<span>{status.state === 'won' ? 'Match complete' : 'Draw'}</span>
				</div>
				<h2 id="game-over-title">{title}</h2>
				<dl id="game-over-detail" class="result-stats">
					<div>
						<dt>Moves</dt>
						<dd>{moveCount}</dd>
					</div>
					{#if durationLabel !== null}
						<div>
							<dt>Match time</dt>
							<dd>{durationLabel}</dd>
						</div>
					{/if}
				</dl>
			</div>
			<div class="modal-actions">
				<button
					class="modal-button primary"
					type="button"
					aria-label="Start a new match with an empty board"
					onclick={onNewMatch}
				>
					<RotateCcw size={17} strokeWidth={1.9} /><span>New match</span>
				</button>
				<div class="secondary-actions">
					<button
						class="modal-button"
						type="button"
						aria-label="Rewind this match to the start and step through it with redo"
						onclick={onReviewFromStart}
					>
						<Play size={15} strokeWidth={1.9} /><span>Review match</span>
					</button>
					<button
						class="modal-button"
						type="button"
						aria-label="Dismiss the result and keep the final board visible"
						onclick={onKeepBoard}
					>
						<Eye size={16} strokeWidth={1.9} /><span>Keep board</span>
					</button>
				</div>
			</div>
		</section>
	</div>
</DialogShell>

<style>
	.game-over-backdrop {
		position: absolute;
		inset: 0;
		z-index: 5;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: color-mix(in oklab, #000 38%, transparent);
		backdrop-filter: blur(6px);
		animation: result-in 220ms ease-out both;
	}
	.game-over-dialog {
		width: min(24rem, calc(100vw - 2rem));
		max-height: calc(100dvh - 2rem);
		overflow: auto;
		margin: 0;
		padding: 1.75rem;
		border: 1px solid color-mix(in oklab, var(--text) 15%, transparent);
		border-radius: 1.1rem;
		background: color-mix(in oklab, var(--surface) 96%, transparent);
		color: var(--text);
		box-shadow: 0 24px 70px var(--shadow);
		animation: result-rise 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	.result-header {
		margin-bottom: 1.75rem;
	}
	.result-kicker {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--muted);
		font-size: 0.7rem;
		font-weight: 600;
	}
	.result-kicker :global(svg) {
		color: var(--accent);
	}
	.game-over-dialog h2 {
		margin: 0.8rem 0 0;
		font-size: clamp(1.9rem, 6vw, 2.5rem);
		line-height: 1.1;
		font-weight: 600;
		letter-spacing: -0.035em;
		text-wrap: balance;
	}
	.result-stats {
		display: flex;
		gap: 2rem;
		margin: 1.25rem 0 0;
	}
	.result-stats dt {
		color: var(--muted);
		font-size: 0.72rem;
	}
	.result-stats dd {
		margin: 0.3rem 0 0;
		font-size: 1.15rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.modal-actions {
		display: grid;
		gap: 0.45rem;
	}
	.secondary-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.45rem;
	}
	.modal-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		min-width: 0;
		min-height: 2.8rem;
		padding: 0.6rem 0.35rem;
		border: 1px solid transparent;
		border-radius: 0.6rem;
		background: transparent;
		color: var(--muted);
		cursor: pointer;
		font-size: 0.76rem;
		font-weight: 600;
		transition:
			background 150ms ease,
			color 150ms ease;
	}
	.modal-button.primary {
		min-height: 3rem;
		background: color-mix(in oklab, var(--accent) 18%, var(--surface));
		border-color: color-mix(in oklab, var(--accent) 35%, transparent);
		color: var(--text);
		font-size: 0.88rem;
	}
	.modal-button:hover {
		background: color-mix(in oklab, var(--accent) 12%, var(--surface));
		color: var(--text);
	}
	.modal-button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}
	@media (max-width: 380px) {
		.game-over-dialog {
			padding: 1.25rem;
		}
		.modal-button {
			gap: 0.3rem;
			font-size: 0.7rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.game-over-backdrop,
		.game-over-dialog {
			animation: none;
		}
	}
	@keyframes result-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes result-rise {
		from {
			opacity: 0;
			transform: translateY(0.5rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
