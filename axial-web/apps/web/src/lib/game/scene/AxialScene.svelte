<script lang="ts">
	import { Canvas } from '@threlte/core';
	import type { GameSnapshot, Move } from '@axial/core';
	import type { SceneThemeName, UiThemeName } from '../theming/sceneThemes';
	import AxialWorld from './AxialWorld.svelte';

	let {
		game,
		hoveredMove,
		labelsVisible,
		uiTheme,
		sceneTheme,
		onHover,
		onPlay
	}: {
		game: GameSnapshot;
		hoveredMove: Move | null;
		labelsVisible: boolean;
		uiTheme: UiThemeName;
		sceneTheme: SceneThemeName;
		onHover: (move: Move | null) => void;
		onPlay: (move: Move) => void;
	} = $props();
</script>

<div class="scene-shell">
	<Canvas dpr={[1, 2]} shadows={false}>
		<AxialWorld {game} {hoveredMove} {labelsVisible} {uiTheme} {sceneTheme} {onHover} {onPlay} />
	</Canvas>
</div>

<style>
	.scene-shell {
		position: absolute;
		inset: 0;
	}
</style>
