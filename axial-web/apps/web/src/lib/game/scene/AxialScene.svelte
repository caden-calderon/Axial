<script lang="ts">
	import { Canvas } from '@threlte/core';
	import type { GameSnapshot, Move, PlacedMove } from '@axial/core';
	import type { PlacementMode } from '../state/gameController.svelte';
	import type { PieceColors, PieceShape } from '../state/pieceAppearance';
	import type { SceneThemeName, UiThemeName } from '../theming/sceneThemes';
	import AxialWorld from './AxialWorld.svelte';

	let {
		game,
		hoveredMove,
		labelsVisible,
		uiTheme,
		sceneTheme,
		pieceShape,
		pieceColors,
		placementMode,
		doubleAdjacentAnchor,
		onHover,
		onPlay
	}: {
		game: GameSnapshot;
		hoveredMove: Move | null;
		labelsVisible: boolean;
		uiTheme: UiThemeName;
		sceneTheme: SceneThemeName;
		pieceShape: PieceShape;
		pieceColors: PieceColors;
		placementMode: PlacementMode;
		doubleAdjacentAnchor: PlacedMove | null;
		onHover: (move: Move | null) => void;
		onPlay: (move: Move) => void;
	} = $props();
</script>

<div class="scene-shell">
	<Canvas dpr={[1, 2]} shadows={false}>
		<AxialWorld
			{game}
			{hoveredMove}
			{labelsVisible}
			{uiTheme}
			{sceneTheme}
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
