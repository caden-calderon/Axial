<script lang="ts">
	import { Box, Circle, Gem, Lock, Moon, Palette, Pipette, Sun } from '@lucide/svelte';
	import type { Player } from '@axial/core';
	import { PIECE_SHAPE_OPTIONS, type PieceColors, type PieceShape } from '../state/pieceAppearance';
	import type { UiThemeName } from '../theming/sceneThemes';

	let {
		boardColor,
		uiTheme,
		labelsVisible,
		pieceShape,
		pieceColors,
		appearanceLocked,
		onPieceShapeChange,
		onPieceColorChange,
		onBoardColorChange,
		onToggleLabels,
		onToggleTheme
	}: {
		boardColor: string;
		uiTheme: UiThemeName;
		labelsVisible: boolean;
		pieceShape: PieceShape;
		pieceColors: PieceColors;
		appearanceLocked: boolean;
		onPieceShapeChange: (shape: PieceShape) => void;
		onPieceColorChange: (player: Player, color: string) => void;
		onBoardColorChange: (color: string) => void;
		onToggleLabels: () => void;
		onToggleTheme: () => void;
	} = $props();

	const boardColorLabel = $derived(boardColor.toUpperCase());

	function colorValue(event: Event): string {
		return (event.currentTarget as HTMLInputElement).value;
	}
</script>

<section class="panel-section">
	<div class="section-heading">
		<Palette size={15} strokeWidth={2} />
		<span>Appearance</span>
		{#if appearanceLocked}
			<span
				class="lock-indicator"
				aria-label="Piece appearance locked until a new match"
				title="Start a new match to edit pieces"
			>
				<Lock size={12} strokeWidth={2.2} />
			</span>
		{/if}
	</div>

	<label class="board-color-picker" style={`--picked-color: ${boardColor}`} title="Board color">
		<span class="color-dot"></span>
		<span>{boardColorLabel}</span>
		<Pipette size={12} strokeWidth={2.1} />
		<input
			type="color"
			value={boardColor}
			aria-label="Board color"
			oninput={(event) => onBoardColorChange(colorValue(event))}
		/>
	</label>

	<div class="appearance-control piece-customizer" class:locked={appearanceLocked}>
		<div class="control-label">
			<Box size={13} strokeWidth={2} />
			<span>Piece look</span>
		</div>

		<div class="mode-switch shape-switch" role="group" aria-label="Piece shape">
			{#each PIECE_SHAPE_OPTIONS as option (option.value)}
				<button
					type="button"
					class:selected={pieceShape === option.value}
					aria-pressed={pieceShape === option.value}
					disabled={appearanceLocked}
					title={appearanceLocked ? 'Start a new match to edit pieces' : `${option.label} pieces`}
					onclick={() => onPieceShapeChange(option.value)}
				>
					{#if option.value === 'cube'}
						<Box size={14} strokeWidth={2} />
					{:else if option.value === 'orb'}
						<Circle size={14} strokeWidth={2} />
					{:else}
						<Gem size={14} strokeWidth={2} />
					{/if}
					<span>{option.label}</span>
				</button>
			{/each}
		</div>

		<div class="piece-color-switch" role="group" aria-label="Piece colors">
			<label
				class="piece-color"
				class:locked={appearanceLocked}
				style={`--piece-color: ${pieceColors.playerOne}`}
				title={appearanceLocked ? 'Start a new match to edit pieces' : 'Player 1 piece color'}
			>
				<span class="color-dot"></span>
				<span>P1</span>
				<Pipette size={12} strokeWidth={2.1} />
				<input
					type="color"
					value={pieceColors.playerOne}
					aria-label="Player 1 piece color"
					disabled={appearanceLocked}
					oninput={(event) => onPieceColorChange(1, colorValue(event))}
				/>
			</label>
			<label
				class="piece-color"
				class:locked={appearanceLocked}
				style={`--piece-color: ${pieceColors.playerTwo}`}
				title={appearanceLocked ? 'Start a new match to edit pieces' : 'Player 2 piece color'}
			>
				<span class="color-dot"></span>
				<span>P2</span>
				<Pipette size={12} strokeWidth={2.1} />
				<input
					type="color"
					value={pieceColors.playerTwo}
					aria-label="Player 2 piece color"
					disabled={appearanceLocked}
					oninput={(event) => onPieceColorChange(2, colorValue(event))}
				/>
			</label>
		</div>
	</div>

	<div class="appearance-control">
		<div class="control-label">
			<Moon size={13} strokeWidth={2} />
			<span>Theme</span>
		</div>

		<div class="mode-switch two-tone" role="group" aria-label="Interface theme">
			<button
				type="button"
				class:selected={uiTheme === 'dark'}
				aria-pressed={uiTheme === 'dark'}
				onclick={() => uiTheme !== 'dark' && onToggleTheme()}
			>
				<Moon size={14} strokeWidth={2} />
				<span>Dark</span>
			</button>
			<button
				type="button"
				class:selected={uiTheme === 'light'}
				aria-pressed={uiTheme === 'light'}
				onclick={() => uiTheme !== 'light' && onToggleTheme()}
			>
				<Sun size={14} strokeWidth={2} />
				<span>Light</span>
			</button>
		</div>

		<label class="toggle-row">
			<span>Axis numbers</span>
			<input
				type="checkbox"
				checked={labelsVisible}
				aria-label="Toggle axis numbers"
				onchange={() => onToggleLabels()}
			/>
		</label>
	</div>
</section>
