<script lang="ts">
	import { Check, MapPin, X } from '@lucide/svelte';
	import type { Move } from '@axial/core';

	let {
		move,
		landingHeight,
		controlsExpanded,
		onConfirm,
		onCancel
	}: {
		move: Move;
		landingHeight: number;
		controlsExpanded: boolean;
		onConfirm: () => void;
		onCancel: () => void;
	} = $props();

	const locationLabel = $derived(
		`Row ${move.row + 1}, column ${move.col + 1}, landing layer ${landingHeight + 1}`
	);
</script>

<aside
	class="move-confirm-bar"
	class:panel-open={controlsExpanded}
	role="group"
	aria-label="Confirm selected move"
>
	<div class="move-confirm-copy">
		<span><MapPin size={14} strokeWidth={2.1} /> Selected drop</span>
		<strong>{locationLabel}</strong>
	</div>
	<div class="move-confirm-actions">
		<button type="button" class="cancel" aria-label="Cancel selected move" onclick={onCancel}>
			<X size={18} strokeWidth={2.2} />
			<span>Cancel</span>
		</button>
		<button type="button" class="confirm" aria-label="Confirm selected move" onclick={onConfirm}>
			<Check size={18} strokeWidth={2.2} />
			<span>Drop</span>
		</button>
	</div>
</aside>

<style>
	.move-confirm-bar {
		position: absolute;
		left: 50%;
		bottom: max(1rem, env(safe-area-inset-bottom));
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
		animation: confirm-bar-in 240ms var(--ease-out) both;
	}

	.move-confirm-copy {
		display: grid;
		min-width: 0;
		gap: 0.08rem;
	}

	.move-confirm-copy span {
		display: inline-flex;
		align-items: center;
		gap: 0.24rem;
		color: var(--muted);
		font-size: 0.62rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.move-confirm-copy strong {
		overflow: hidden;
		font-size: 0.75rem;
		font-weight: 790;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.move-confirm-actions {
		display: flex;
		gap: 0.28rem;
	}

	.move-confirm-actions button {
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
		font-weight: 820;
	}

	.move-confirm-actions .confirm {
		border-color: color-mix(in oklab, var(--accent) 48%, transparent);
		background: color-mix(in oklab, var(--accent) 24%, var(--surface));
	}

	.move-confirm-actions button:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--accent) 58%, transparent);
		outline-offset: 2px;
	}

	@keyframes confirm-bar-in {
		from {
			opacity: 0;
			transform: translate(-50%, 0.5rem) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateX(-50%);
		}
	}

	@media (max-width: 720px), (hover: none) and (pointer: coarse) {
		.move-confirm-bar {
			bottom: calc(max(0.5rem, env(safe-area-inset-bottom)) + 3.7rem);
			width: min(26rem, calc(100vw - 1rem));
			justify-content: space-between;
		}

		.move-confirm-actions button {
			min-width: 2.75rem;
			min-height: 2.75rem;
		}
	}

	@media (max-width: 420px) {
		.move-confirm-bar {
			gap: 0.4rem;
			padding-left: 0.58rem;
		}

		.move-confirm-copy strong {
			font-size: 0.68rem;
		}

		.move-confirm-actions button {
			padding: 0 0.55rem;
		}

		.move-confirm-actions button span {
			display: none;
		}
	}
</style>
