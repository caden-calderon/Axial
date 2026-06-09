<script lang="ts">
	import { onMount } from 'svelte';
	import { Canvas } from '@threlte/core';
	import type { GameSnapshot, Move, PlacedMove } from '@axial/core';
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
		onHover,
		onPlay,
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
		onHover: (move: Move | null) => void;
		onPlay: (move: Move) => void;
		onRecoverableError?: (error: unknown) => void;
	} = $props();

	let sceneShell: HTMLDivElement | null = null;

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
</script>

<div class="scene-shell" bind:this={sceneShell}>
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
			{onHover}
			{onPlay}
		/>
	</Canvas>
</div>

<style>
	.scene-shell {
		position: absolute;
		inset: 0;
	}
</style>
