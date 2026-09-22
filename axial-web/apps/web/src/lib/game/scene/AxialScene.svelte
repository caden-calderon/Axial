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
		guidedMove = null,
		previewLocked,
		labelsVisible,
		gridLayersVisible,
		uiTheme,
		boardColor,
		pieceShape,
		pieceColors,
		placementMode,
		doubleAdjacentAnchor,
		viewResetKey,
		onHover,
		onPlay,
		onCancelSelection,
		onRecoverableError,
		onLand,
		onSettle,
		onWinReveal,
		interactionLabel,
		inputEnabled = true
	}: {
		game: GameSnapshot;
		hoveredMove: Move | null;
		guidedMove?: Move | null;
		previewLocked: boolean;
		labelsVisible: boolean;
		gridLayersVisible: boolean;
		uiTheme: UiThemeName;
		boardColor: string;
		pieceShape: PieceShape;
		pieceColors: PieceColors;
		placementMode: PlacementMode;
		doubleAdjacentAnchor: PlacedMove | null;
		viewResetKey: number;
		onHover: (move: Move | null) => void;
		onPlay: (move: Move) => void;
		onCancelSelection: () => void;
		onRecoverableError?: (error: unknown) => void;
		onLand?: (move: PlacedMove) => void;
		onSettle?: (move: PlacedMove) => void;
		onWinReveal?: () => void;
		interactionLabel: string;
		inputEnabled?: boolean;
	} = $props();

	let sceneShell: HTMLButtonElement | null = null;
	let keyboardMove = $state<Move | null>(null);
	let keyboardActive = $state(false);
	let keyboardNotice = $state('');
	let noticeHistory: GameSnapshot['moveHistory'] | null = null;
	$effect(() => {
		if (noticeHistory !== game.moveHistory) {
			keyboardNotice = '';
			noticeHistory = game.moveHistory;
		}
	});
	const selectedHeight = $derived(
		keyboardMove ? getDropHeight(game.board, keyboardMove, game.dimensions) : -1
	);
	const selectedPosition = $derived(
		keyboardMove ? `Row ${keyboardMove.row + 1} · Col ${keyboardMove.col + 1}` : ''
	);
	const selectedDetail = $derived(
		!inputEnabled
			? interactionLabel
			: selectedHeight < 0
				? 'Column full'
				: `Layer ${selectedHeight + 1} · Enter to ${previewLocked ? 'confirm' : 'drop'}`
	);
	const lastMoveDescription = $derived(
		game.lastMove
			? `Player ${game.lastMove.player} placed at row ${game.lastMove.row + 1}, column ${game.lastMove.col + 1}, layer ${game.lastMove.height + 1}.`
			: 'Empty board.'
	);
	const keyboardStatus = $derived(
		`${lastMoveDescription} ${interactionLabel}. ${keyboardNotice || (keyboardMove ? `${selectedPosition}. ${selectedDetail}.` : 'Arrow keys choose a column. Enter selects. Escape cancels.')}`
	);

	$effect(() => {
		// A new board size or restored position must never leave an out-of-bounds cursor.
		if (
			keyboardMove &&
			(keyboardMove.row >= game.dimensions.rows || keyboardMove.col >= game.dimensions.columns)
		) {
			keyboardMove = null;
			onHover(null);
		}
	});

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
		keyboardActive = true;
		if (game.status.state !== 'playing') return;

		if (event.key === 'Escape') {
			event.preventDefault();
			keyboardMove = null;
			onHover(null);
			onCancelSelection();
			keyboardNotice = 'Selection cancelled.';
			return;
		}

		const isArrow = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key);
		if (isArrow) {
			event.preventDefault();
			if (previewLocked) onCancelSelection();
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
			if (event.repeat || !inputEnabled) return;
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
		keyboardNotice = '';
		const landingHeight = getDropHeight(game.board, move, game.dimensions);
		if (landingHeight < 0) {
			onHover(null);
			keyboardNotice = `Row ${move.row + 1}, column ${move.col + 1} is full.`;
			return;
		}
		if (!isKeyboardMovePlayable(move)) {
			onHover(null);
			keyboardNotice = `Row ${move.row + 1}, column ${move.col + 1} is not valid for this action.`;
			return;
		}

		onHover(move);
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
	onpointerdown={() => {
		keyboardActive = false;
	}}
	onblur={() => {
		keyboardActive = false;
	}}
>
	<Canvas dpr={[1, 2]} shadows={false}>
		<AxialWorld
			{game}
			{hoveredMove}
			{guidedMove}
			{previewLocked}
			{labelsVisible}
			{gridLayersVisible}
			{uiTheme}
			{boardColor}
			{pieceShape}
			{pieceColors}
			{placementMode}
			{doubleAdjacentAnchor}
			{viewResetKey}
			{onLand}
			{onSettle}
			{onWinReveal}
			{onHover}
			{onPlay}
		/>
	</Canvas>
</button>
<p id="board-keyboard-instructions" class="sr-only">
	Use arrow keys to choose a row and column. Press Enter or Space to select or confirm a move. Press
	Escape to cancel a selection.
</p>
<p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{keyboardStatus}</p>
{#if keyboardActive && keyboardMove && !previewLocked && game.status.state === 'playing'}
	<div class="keyboard-readout" aria-hidden="true">
		<strong>{selectedPosition}</strong>
		<span>{selectedDetail}</span>
		<small>↑ ↓ ← → move · Esc clear</small>
	</div>
{/if}

<style>
	.keyboard-readout {
		position: absolute;
		left: max(1rem, env(safe-area-inset-left));
		bottom: max(1rem, env(safe-area-inset-bottom));
		z-index: var(--z-contextual);
		display: grid;
		gap: 0.2rem;
		padding: 0.7rem 0.9rem;
		border-left: 2px solid var(--accent);
		border-radius: 0 0.5rem 0.5rem 0;
		background: color-mix(in oklab, var(--surface) 88%, transparent);
		backdrop-filter: blur(16px);
		color: var(--text);
		pointer-events: none;
		font-variant-numeric: tabular-nums;
	}
	.keyboard-readout strong {
		font-size: 0.82rem;
	}
	.keyboard-readout span {
		font-size: 0.76rem;
	}
	.keyboard-readout small {
		color: var(--muted);
		font-size: 0.66rem;
	}

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
