<script lang="ts">
	import type { BoardDimensions, Player } from '@axial/core';
	import ShinyText from './ShinyText.svelte';

	let {
		currentLabel,
		currentPlayer,
		boardDimensions
	}: {
		currentLabel: string;
		currentPlayer: Player | null;
		boardDimensions: BoardDimensions;
	} = $props();

	const boardDimensionLabel = $derived(
		`${boardDimensions.height} x ${boardDimensions.rows} x ${boardDimensions.columns}`
	);
	const shineSpeed = 6.8;
	const shineDelay = 0.25;
</script>

<header class="hud top-left">
	<div class="brand-lockup">
		<span class="brand-title" aria-label="AXIAL">
			<ShinyText
				text="AXIAL"
				color="var(--brand)"
				shineColor="var(--accent)"
				speed={shineSpeed}
				delay={shineDelay}
				spread={108}
				ariaHidden
			/>
		</span>
		<span class="board-dimensions" aria-label={boardDimensionLabel}>
			<ShinyText
				text={boardDimensionLabel}
				color="var(--brand-muted)"
				shineColor="var(--accent)"
				speed={shineSpeed}
				delay={shineDelay}
				spread={108}
				ariaHidden
			/>
		</span>
	</div>
</header>

<div
	class="turn-chip top-center"
	data-player={currentPlayer ?? undefined}
	aria-label={currentLabel}
	aria-live="polite"
>
	<span class="turn-chip-label" aria-hidden="true">
		<ShinyText
			text={currentLabel}
			color="var(--text)"
			shineColor="var(--accent)"
			speed={shineSpeed}
			delay={shineDelay}
			spread={108}
			ariaHidden
		/>
	</span>
</div>

<style>
	.hud {
		position: absolute;
		z-index: 3;
		display: inline-flex;
		align-items: flex-start;
		gap: 0.85rem;
		padding: 0;
		border: 0;
		background: transparent;
		text-shadow: 0 1px 18px color-mix(in oklab, var(--field-a) 54%, transparent);
	}

	.top-left {
		top: 1.45rem;
		left: 1.6rem;
	}

	.top-center {
		position: absolute;
		top: 1rem;
		left: 50%;
		z-index: 3;
		transform: translateX(-50%);
	}

	.brand-lockup {
		display: grid;
		gap: 0.42rem;
		color: var(--brand);
	}

	.brand-title {
		display: inline-block;
		font-size: clamp(1.7rem, 2.35vw, 2.35rem);
		font-weight: 300;
		line-height: 0.9;
		letter-spacing: 0.34em;
		white-space: pre;
	}

	.board-dimensions {
		display: inline-block;
		color: var(--brand-muted);
		font-size: clamp(0.88rem, 1.15vw, 1.1rem);
		font-weight: 350;
		letter-spacing: 0.2em;
		white-space: pre;
	}

	.turn-chip {
		display: inline-flex;
		height: calc(2.4rem + 0.84rem + 2px);
		width: 11.8rem;
		inline-size: 11.8rem;
		min-width: 11.8rem;
		min-inline-size: 11.8rem;
		max-width: 11.8rem;
		max-inline-size: 11.8rem;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		padding: 0 0.82rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--panel);
		color: var(--text);
		backdrop-filter: blur(18px) saturate(1.1);
		box-shadow: 0 18px 48px var(--shadow);
		font-size: 0.98rem;
		font-weight: 820;
		text-align: center;
		white-space: nowrap;
	}

	.turn-chip-label {
		display: inline-block;
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: pre;
	}

	@media (max-width: 720px), (hover: none) and (pointer: coarse) {
		.hud {
			display: grid;
			gap: 0;
		}

		.top-left {
			top: 0.9rem;
			left: 1rem;
			right: auto;
			max-width: calc(100vw - 8.5rem);
		}

		.brand-title {
			font-size: 1.22rem;
			letter-spacing: 0.25em;
		}

		.board-dimensions {
			font-size: 0.68rem;
			letter-spacing: 0.13em;
		}

		.turn-chip {
			display: none;
		}
	}
</style>
