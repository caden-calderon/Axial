<script lang="ts">
	import { Box, Circle, Lock, Moon, Palette, Pipette, Sun } from '@lucide/svelte';
	import type { Player } from '@axial/core';
	import { PIECE_SHAPE_OPTIONS, type PieceColors, type PieceShape } from '../state/pieceAppearance';
	import type { UiThemeName } from '../theming/sceneThemes';

	let {
		soundEnabled,
		onToggleSound,
		boardColor,
		uiTheme,
		labelsVisible,
		gridLayersVisible,
		confirmDropEnabled,
		pieceShape,
		pieceColors,
		appearanceLocked,
		onPieceShapeChange,
		onPieceColorChange,
		onBoardColorChange,
		onToggleConfirmDrop,
		onToggleGridLayers,
		onToggleLabels,
		onToggleTheme
	}: {
		soundEnabled: boolean;
		onToggleSound: () => void;
		boardColor: string;
		uiTheme: UiThemeName;
		labelsVisible: boolean;
		gridLayersVisible: boolean;
		confirmDropEnabled: boolean;
		pieceShape: PieceShape;
		pieceColors: PieceColors;
		appearanceLocked: boolean;
		onPieceShapeChange: (shape: PieceShape) => void;
		onPieceColorChange: (player: Player, color: string) => void;
		onBoardColorChange: (color: string) => void;
		onToggleConfirmDrop: () => void;
		onToggleGridLayers: () => void;
		onToggleLabels: () => void;
		onToggleTheme: () => void;
	} = $props();

	const boardColorLabel = $derived(boardColor.toUpperCase());
	const pieceShapeLabel = $derived(
		PIECE_SHAPE_OPTIONS.find((option) => option.value === pieceShape)?.label ?? 'Piece'
	);
	const pieceColorsAreClose = $derived(
		colorDistance(pieceColors.playerOne, pieceColors.playerTwo) < 72
	);

	function colorValue(event: Event): string {
		return (event.currentTarget as HTMLInputElement).value;
	}

	function colorDistance(first: string, second: string): number {
		const a = rgb(first);
		const b = rgb(second);
		return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
	}

	function rgb(color: string): [number, number, number] {
		return [
			Number.parseInt(color.slice(1, 3), 16),
			Number.parseInt(color.slice(3, 5), 16),
			Number.parseInt(color.slice(5, 7), 16)
		];
	}
</script>

<section class="panel-section" data-tour-target="appearance-section">
	<div class="section-heading">
		<Palette size={15} strokeWidth={2} />
		<span>Appearance</span>
		{#if appearanceLocked}
			<span
				class="lock-indicator"
				aria-label="Piece appearance locked until a new match"
				data-tooltip="Start a new match to edit pieces"
			>
				<Lock size={12} strokeWidth={2.2} />
			</span>
		{/if}
	</div>

	<label
		class="board-color-picker"
		style={`--picked-color: ${boardColor}`}
		data-tooltip="Board color"
	>
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

	{#if appearanceLocked}
		<div class="locked-piece-summary">
			<div class="locked-piece-title">
				<Box size={15} strokeWidth={2} />
				<span>
					<strong>{pieceShapeLabel} pieces</strong>
					<small>Style locked for this match</small>
				</span>
			</div>
			<div class="locked-piece-colors" aria-label="Player piece colors">
				<span style={`--piece-color: ${pieceColors.playerOne}`}>
					<i></i>
					P1
				</span>
				<span style={`--piece-color: ${pieceColors.playerTwo}`}>
					<i></i>
					P2
				</span>
			</div>
		</div>
	{:else}
		<div class="appearance-control piece-customizer">
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
						data-tooltip={appearanceLocked
							? 'Start a new match to edit pieces'
							: `${option.label} pieces`}
						onclick={() => onPieceShapeChange(option.value)}
					>
						{#if option.value === 'cube'}
							<Box size={14} strokeWidth={2} />
						{:else}
							<Circle size={14} strokeWidth={2} />
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
					data-tooltip={appearanceLocked
						? 'Start a new match to edit pieces'
						: 'Player 1 piece color'}
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
					data-tooltip={appearanceLocked
						? 'Start a new match to edit pieces'
						: 'Player 2 piece color'}
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
			{#if pieceColorsAreClose}
				<p class="color-warning" role="status">
					These colors are close. Choose more distinct colors to tell the players apart.
				</p>
			{/if}
		</div>
	{/if}

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

		<div class="toggle-stack">
			<label class="toggle-row">
				<span>Grid layers</span>
				<input
					type="checkbox"
					checked={gridLayersVisible}
					aria-label="Toggle grid layers"
					onchange={() => onToggleGridLayers()}
				/>
			</label>

			<label class="toggle-row">
				<span>Axis numbers</span>
				<input
					type="checkbox"
					checked={labelsVisible}
					aria-label="Toggle axis numbers"
					onchange={() => onToggleLabels()}
				/>
			</label>

			<label class="toggle-row">
				<span>Confirm drop</span>
				<input
					type="checkbox"
					checked={confirmDropEnabled}
					aria-label="Toggle click to confirm drops"
					onchange={() => onToggleConfirmDrop()}
				/>
			</label>
			<label class="toggle-row">
				<span>Sound</span>
				<input
					type="checkbox"
					checked={soundEnabled}
					aria-label="Game sound"
					onchange={onToggleSound}
				/>
			</label>
		</div>
	</div>
</section>
