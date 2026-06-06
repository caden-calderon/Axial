<script lang="ts">
	import { BOARD_COLUMNS, BOARD_HEIGHT, BOARD_ROWS, type Player } from '@axial/core';

	let {
		currentLabel,
		currentPlayer
	}: {
		currentLabel: string;
		currentPlayer: Player | null;
	} = $props();

	const boardDimensions = `${BOARD_HEIGHT} x ${BOARD_ROWS} x ${BOARD_COLUMNS}`;
</script>

<header class="hud top-left">
	<div class="brand-lockup">
		<span class="brand-title">AXIAL</span>
		<span class="board-dimensions">{boardDimensions}</span>
	</div>
</header>

<div class="turn-chip top-center" data-player={currentPlayer ?? undefined} aria-live="polite">
	<span>{currentLabel}</span>
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
		font-size: clamp(1.7rem, 2.35vw, 2.35rem);
		font-weight: 300;
		line-height: 0.9;
		letter-spacing: 0.34em;
	}

	.board-dimensions {
		color: var(--brand-muted);
		font-size: clamp(0.88rem, 1.15vw, 1.1rem);
		font-weight: 350;
		letter-spacing: 0.2em;
	}

	.turn-chip {
		display: inline-flex;
		height: calc(2.4rem + 0.84rem + 2px);
		width: 13.8rem;
		inline-size: 13.8rem;
		min-width: 13.8rem;
		min-inline-size: 13.8rem;
		max-width: 13.8rem;
		max-inline-size: 13.8rem;
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
		font-size: 0.82rem;
		font-weight: 760;
		text-align: center;
		white-space: nowrap;
	}

	.turn-chip span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@media (max-width: 720px) {
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
