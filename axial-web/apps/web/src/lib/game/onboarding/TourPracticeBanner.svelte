<script lang="ts">
	import { ArrowRight, Check, Compass, X } from '@lucide/svelte';
	import type { Move } from '@axial/core';

	let {
		move,
		landingHeight,
		onContinue,
		onExit
	}: {
		move: Move | null;
		landingHeight: number;
		onContinue: () => void;
		onExit: () => void;
	} = $props();

	const selectionLabel = $derived(
		move && landingHeight >= 0
			? `Row ${move.row + 1}, column ${move.col + 1} lands on layer ${landingHeight + 1}.`
			: 'Drag to orbit, pinch or scroll to zoom, then choose a column.'
	);
</script>

<aside class="practice-banner" aria-labelledby="practice-title" aria-describedby="practice-copy">
	<div class="practice-mark" aria-hidden="true">
		{#if move}
			<Check size={19} strokeWidth={2.2} />
		{:else}
			<Compass size={19} strokeWidth={2} />
		{/if}
	</div>
	<div class="practice-copy">
		<span>Practice · no move committed</span>
		<strong id="practice-title">{move ? 'Drop staged' : 'Explore the board'}</strong>
		<small id="practice-copy">{selectionLabel}</small>
	</div>
	<div class="practice-actions">
		<button type="button" class="practice-exit" aria-label="Exit tutorial" onclick={onExit}>
			<X size={17} strokeWidth={2.2} />
		</button>
		<button
			type="button"
			class="practice-continue"
			aria-label="Continue tutorial"
			disabled={!move}
			onclick={onContinue}
		>
			<span>Continue</span>
			<ArrowRight size={17} strokeWidth={2.2} />
		</button>
	</div>
</aside>

<style>
	.practice-banner {
		position: absolute;
		left: 50%;
		bottom: max(1rem, env(safe-area-inset-bottom));
		z-index: var(--z-contextual);
		display: grid;
		width: min(40rem, calc(100vw - 2rem));
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.72rem;
		padding: 0.58rem;
		border: 1px solid color-mix(in oklab, var(--accent) 38%, var(--border));
		border-radius: 1.3rem;
		background: color-mix(in oklab, var(--surface) 88%, transparent);
		color: var(--text);
		backdrop-filter: blur(22px) saturate(1.14);
		box-shadow: 0 22px 62px var(--shadow);
		transform: translateX(-50%);
		animation: practice-in 260ms var(--ease-out) both;
	}

	.practice-mark {
		display: grid;
		width: 2.45rem;
		height: 2.45rem;
		place-items: center;
		border-radius: 0.9rem;
		background: color-mix(in oklab, var(--accent) 19%, var(--surface));
		color: color-mix(in oklab, var(--accent) 74%, var(--text));
	}

	.practice-copy {
		display: grid;
		min-width: 0;
		gap: 0.08rem;
	}

	.practice-copy span {
		color: color-mix(in oklab, var(--accent) 70%, var(--text));
		font-size: 0.6rem;
		font-weight: 840;
		text-transform: uppercase;
	}

	.practice-copy strong,
	.practice-copy small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.practice-copy strong {
		font-size: 0.82rem;
		font-weight: 830;
	}

	.practice-copy small {
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 680;
	}

	.practice-actions {
		display: flex;
		gap: 0.3rem;
	}

	.practice-actions button {
		display: inline-flex;
		min-height: 2.45rem;
		align-items: center;
		justify-content: center;
		border: 1px solid color-mix(in oklab, var(--text) 13%, transparent);
		border-radius: 0.9rem;
		background: color-mix(in oklab, var(--surface) 46%, transparent);
		color: var(--text);
		cursor: pointer;
	}

	.practice-exit {
		width: 2.45rem;
	}

	.practice-continue {
		gap: 0.3rem;
		padding: 0 0.74rem;
		border-color: color-mix(in oklab, var(--accent) 48%, transparent) !important;
		background: color-mix(in oklab, var(--accent) 23%, var(--surface)) !important;
		font-size: 0.72rem;
		font-weight: 820;
	}

	.practice-actions button:disabled {
		cursor: not-allowed;
		opacity: 0.44;
	}

	.practice-actions button:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--accent) 58%, transparent);
		outline-offset: 2px;
	}

	@keyframes practice-in {
		from {
			opacity: 0;
			transform: translate(-50%, 0.6rem) scale(0.98);
		}
	}

	@media (max-width: 720px), (hover: none) and (pointer: coarse) {
		.practice-banner {
			bottom: max(0.5rem, env(safe-area-inset-bottom));
			width: calc(100vw - 1rem);
			gap: 0.48rem;
			padding: 0.46rem;
		}

		.practice-actions button {
			min-height: 2.75rem;
		}

		.practice-exit {
			width: 2.75rem;
		}
	}

	@media (max-width: 430px) {
		.practice-banner {
			left: max(0.5rem, env(safe-area-inset-left));
			right: max(0.5rem, env(safe-area-inset-right));
			width: auto;
			grid-template-columns: minmax(0, 1fr) auto;
			transform: none;
		}

		.practice-mark {
			display: none;
		}

		.practice-copy small {
			white-space: normal;
		}

		.practice-continue {
			width: 2.75rem;
			padding: 0;
		}

		.practice-continue span {
			display: none;
		}
	}

	@media (max-width: 430px) and (prefers-reduced-motion: no-preference) {
		.practice-banner {
			animation-name: practice-in-mobile;
		}
	}

	@keyframes practice-in-mobile {
		from {
			opacity: 0;
			transform: translateY(0.6rem) scale(0.98);
		}
	}
</style>
