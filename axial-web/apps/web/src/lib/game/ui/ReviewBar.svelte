<script lang="ts">
	import { ChevronLeft, ChevronRight, History } from '@lucide/svelte';

	let {
		moveNumber,
		totalMoves,
		canStepBack,
		canStepForward,
		controlsExpanded,
		onStepBack,
		onStepForward
	}: {
		moveNumber: number;
		totalMoves: number;
		canStepBack: boolean;
		canStepForward: boolean;
		controlsExpanded: boolean;
		onStepBack: () => void;
		onStepForward: () => void;
	} = $props();

	const positionLabel = $derived(`Move ${moveNumber} of ${totalMoves}`);
</script>

<!-- Shown throughout "Review match", and after an undo while the panel is closed (the collapsed
     phone toolbar hides undo and redo). -->
<aside
	class="review-bar"
	class:panel-open={controlsExpanded}
	role="group"
	aria-label="Review moves"
>
	<div class="review-copy">
		<span><History size={14} strokeWidth={2.1} /> Review</span>
		<strong aria-live="polite">{positionLabel}</strong>
	</div>
	<div class="review-actions">
		<button type="button" aria-label="Back one move" disabled={!canStepBack} onclick={onStepBack}>
			<ChevronLeft size={18} strokeWidth={2.2} />
			<span>Back</span>
		</button>
		<button
			type="button"
			class="forward"
			aria-label="Next move"
			disabled={!canStepForward}
			onclick={onStepForward}
		>
			<span>Next</span>
			<ChevronRight size={18} strokeWidth={2.2} />
		</button>
	</div>
</aside>

<style>
	.review-bar {
		position: absolute;
		left: 50%;
		bottom: calc(env(safe-area-inset-bottom) + 1rem);
		z-index: var(--z-contextual);
		display: flex;
		align-items: center;
		gap: 0.7rem;
		max-width: calc(100vw - 2rem);
		padding: 0.42rem 0.46rem 0.42rem 0.72rem;
		border: 1px solid color-mix(in oklab, var(--accent) 34%, var(--border));
		border-radius: 1.2rem;
		background: color-mix(in oklab, var(--surface) 88%, transparent);
		color: var(--text);
		backdrop-filter: blur(20px) saturate(1.16);
		box-shadow:
			0 18px 52px var(--shadow),
			0 0 28px color-mix(in oklab, var(--accent) 11%, transparent);
		transform: translateX(-50%);
		animation: review-bar-in 240ms var(--ease-out) both;
	}

	.review-copy {
		display: grid;
		min-width: 0;
		gap: 0.08rem;
	}

	.review-copy span {
		display: inline-flex;
		align-items: center;
		gap: 0.24rem;
		color: var(--muted);
		font-size: 0.62rem;
		font-weight: 700;
		text-transform: uppercase;
	}

	.review-copy strong {
		font-size: 0.75rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.review-actions {
		display: flex;
		gap: 0.28rem;
	}

	.review-actions button {
		display: inline-flex;
		min-height: 2.4rem;
		align-items: center;
		justify-content: center;
		gap: 0.26rem;
		padding: 0 0.62rem;
		border: 1px solid color-mix(in oklab, var(--text) 13%, transparent);
		border-radius: 0.9rem;
		background: color-mix(in oklab, var(--surface) 48%, transparent);
		color: var(--text);
		cursor: pointer;
		font-size: 0.7rem;
		font-weight: 700;
	}

	.review-actions .forward {
		border-color: color-mix(in oklab, var(--accent) 48%, transparent);
		background: color-mix(in oklab, var(--accent) 24%, var(--surface));
	}

	.review-actions button:disabled {
		cursor: default;
		opacity: 0.45;
	}

	.review-actions button:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--accent) 58%, transparent);
		outline-offset: 2px;
	}

	@keyframes review-bar-in {
		from {
			opacity: 0;
			transform: translate(-50%, 0.5rem) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateX(-50%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.review-bar {
			animation: none;
		}
	}

	@media (max-width: 720px), (hover: none) and (pointer: coarse) {
		.review-bar {
			bottom: calc(env(safe-area-inset-bottom) + 0.5rem);
			width: min(26rem, calc(100vw - 1rem));
			justify-content: space-between;
		}

		.review-actions button {
			min-width: 2.75rem;
			min-height: 2.75rem;
		}
	}

	@media (max-width: 420px) {
		.review-bar {
			gap: 0.4rem;
			padding-left: 0.58rem;
		}

		.review-actions button span {
			display: none;
		}
	}
</style>
