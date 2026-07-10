<script lang="ts">
	import { onMount } from 'svelte';
	import { Canvas } from '@threlte/core';
	import {
		getDropHeight,
		isLegalDoubleAdjacentMove,
		type GameSnapshot,
		type Move,
		type PlacedMove
	} from '@axial/core';
	import type { PlacementMode } from '../state/gameController.svelte';
	import type { PieceColors, PieceShape } from '../state/pieceAppearance';
	import type { UiThemeName } from '../theming/sceneThemes';
	import AxialWorld from './AxialWorld.svelte';

	let {
		game,
		hoveredMove,
		previewLocked,
		labelsVisible,
		gridLayersVisible,
		uiTheme,
		boardColor,
		pieceShape,
		pieceColors,
		placementMode,
		doubleAdjacentAnchor,
		controlsExpanded,
		viewResetKey,
		onHover,
		onPlay,
		onCancelSelection,
		onRecoverableError
	}: {
		game: GameSnapshot;
		hoveredMove: Move | null;
		previewLocked: boolean;
		labelsVisible: boolean;
		gridLayersVisible: boolean;
		uiTheme: UiThemeName;
		boardColor: string;
		pieceShape: PieceShape;
		pieceColors: PieceColors;
		placementMode: PlacementMode;
		doubleAdjacentAnchor: PlacedMove | null;
		controlsExpanded: boolean;
		viewResetKey: number;
		onHover: (move: Move | null) => void;
		onPlay: (move: Move) => void;
		onCancelSelection: () => void;
		onRecoverableError?: (error: unknown) => void;
	} = $props();

	let sceneShell: HTMLButtonElement | null = null;
	let keyboardMove = $state<Move | null>(null);
	let keyboardStatus = $state(
		'Use the arrow keys to choose a row and column, Enter to select, and Escape to cancel.'
	);

	onMount(() => {
		let frameId = 0;
		let canvas: HTMLCanvasElement | null = null;

		const handleContextLost = (event: Event) => {
			event.preventDefault();
			onRecoverableError?.(new Error('WebGL context was lost'));
		};

		frameId = requestAnimationFrame(() => {
			canvas = sceneShell?.querySelector('canvas') ?? null;
			canvas?.addEventListener('webglcontextlost', handleContextLost);
		});

		return () => {
			cancelAnimationFrame(frameId);
			canvas?.removeEventListener('webglcontextlost', handleContextLost);
		};
	});

	function handleBoardKeydown(event: KeyboardEvent): void {
		if (game.status.state !== 'playing') return;

		if (event.key === 'Escape') {
			event.preventDefault();
			keyboardMove = null;
			onHover(null);
			onCancelSelection();
			keyboardStatus = 'Selection cancelled.';
			return;
		}

		const isArrow = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key);
		if (isArrow) {
			event.preventDefault();
			const current = keyboardMove ?? {
				row: Math.floor(game.dimensions.rows / 2),
				col: Math.floor(game.dimensions.columns / 2)
			};
			const rowDelta = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
			const colDelta = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
			setKeyboardMove({
				row: clamp(current.row + rowDelta, 0, game.dimensions.rows - 1),
				col: clamp(current.col + colDelta, 0, game.dimensions.columns - 1)
			});
			return;
		}

		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			const move = keyboardMove ?? {
				row: Math.floor(game.dimensions.rows / 2),
				col: Math.floor(game.dimensions.columns / 2)
			};
			setKeyboardMove(move);
			if (isKeyboardMovePlayable(move)) onPlay(move);
		}
	}

	function setKeyboardMove(move: Move): void {
		keyboardMove = move;
		const landingHeight = getDropHeight(game.board, move, game.dimensions);
		if (landingHeight < 0) {
			onHover(null);
			keyboardStatus = `Row ${move.row + 1}, column ${move.col + 1} is full.`;
			return;
		}
		if (!isKeyboardMovePlayable(move)) {
			onHover(null);
			keyboardStatus = `Row ${move.row + 1}, column ${move.col + 1} is not valid for this action.`;
			return;
		}

		onHover(move);
		keyboardStatus = `Row ${move.row + 1}, column ${move.col + 1}, landing layer ${landingHeight + 1}. Press Enter to select.`;
	}

	function isKeyboardMovePlayable(move: Move): boolean {
		if (getDropHeight(game.board, move, game.dimensions) < 0) return false;
		return (
			placementMode !== 'double-adjacent' ||
			(doubleAdjacentAnchor !== null &&
				isLegalDoubleAdjacentMove(game.board, move, doubleAdjacentAnchor, game.dimensions))
		);
	}

	function clamp(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, value));
	}
</script>

<button
	type="button"
	class="scene-shell"
	bind:this={sceneShell}
	aria-label="Interactive 3D Axial board"
	aria-describedby="board-keyboard-instructions"
	data-tour-target="board"
	onkeydown={handleBoardKeydown}
>
	<Canvas dpr={[1, 2]} shadows={false}>
		<AxialWorld
			{game}
			{hoveredMove}
			{previewLocked}
			{labelsVisible}
			{gridLayersVisible}
			{uiTheme}
			{boardColor}
			{pieceShape}
			{pieceColors}
			{placementMode}
			{doubleAdjacentAnchor}
			{controlsExpanded}
			{viewResetKey}
			{onHover}
			{onPlay}
		/>
	</Canvas>
</button>
<p id="board-keyboard-instructions" class="sr-only">
	Use arrow keys to choose a row and column. Press Enter or Space to select or confirm a move. Press
	Escape to cancel a selection.
</p>
<p class="sr-only" aria-live="polite">{keyboardStatus}</p>

<style>
	.scene-shell {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		cursor: default;
	}

	.scene-shell:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--accent) 62%, transparent);
		outline-offset: -4px;
	}
</style>
