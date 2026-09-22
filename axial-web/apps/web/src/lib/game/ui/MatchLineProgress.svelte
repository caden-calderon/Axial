<script lang="ts">
	import type { GameSnapshot, Player } from '@axial/core';
	import type { PieceColors } from '../state/pieceAppearance';
	import { completedLineCounts } from './linePresentation';

	let {
		game,
		pieceColors,
		playerNames
	}: {
		game: GameSnapshot;
		pieceColors: PieceColors;
		playerNames: Record<Player, string>;
	} = $props();
	const counts = $derived(completedLineCounts(game));
	const target = $derived(game.winCondition.linesToWin);
	const players = [1, 2] as const;
</script>

{#if target > 1}
	<div class="match-line-progress" role="status" aria-live="polite" aria-atomic="true">
		<span class="sr-only">Line score. First to {target} lines.</span>
		<div class="score-heading" aria-hidden="true">
			<span>Line score</span><span>First to {target}</span>
		</div>
		<div class="player-scores">
			{#each players as player (player)}
				<div
					class="player-score"
					style:--player-color={player === 1 ? pieceColors.playerOne : pieceColors.playerTwo}
				>
					<span class="sr-only"
						>{playerNames[player]}: {counts[player]} completed {counts[player] === 1
							? 'line'
							: 'lines'}.</span
					>
					<div class="score-value" aria-hidden="true">
						<span><i></i>{playerNames[player]}</span><strong>{counts[player]}</strong>
					</div>
					<div class="score-marks" aria-hidden="true">
						{#each Array.from({ length: target }, (_, index) => index) as index (index)}<span
								class:earned={index < counts[player]}
							></span>{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.match-line-progress {
		padding: 0.9rem 0.1rem 0.25rem;
	}
	.score-heading {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		color: var(--muted);
		font-size: 0.67rem;
	}
	.player-scores {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.4rem;
		margin-top: 0.55rem;
	}
	.player-score {
		min-width: 0;
	}
	.score-value {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.score-value > span {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--text);
		font-size: 0.76rem;
		font-weight: 600;
	}
	.score-value i {
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 50%;
		background: var(--player-color);
	}
	.score-value strong {
		font-size: 1.15rem;
		line-height: 1.2;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.score-marks {
		display: flex;
		gap: 0.25rem;
		margin-top: 0.45rem;
	}
	.score-marks span {
		flex: 1;
		height: 3px;
		border-radius: 2px;
		background: color-mix(in oklab, var(--text) 12%, transparent);
	}
	.score-marks .earned {
		background: var(--player-color);
	}
</style>
