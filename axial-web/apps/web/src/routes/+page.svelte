<script lang="ts">
	import { onMount } from 'svelte';
	import AxialScene from '$lib/game/scene/AxialScene.svelte';
	import { createGameController } from '$lib/game/state/gameController.svelte';
	import GameHud from '$lib/game/ui/GameHud.svelte';
	import GameStatusPanel from '$lib/game/ui/GameStatusPanel.svelte';

	const controller = createGameController();

	onMount(() => {
		controller.hydrateFromStorage();
	});
</script>

<svelte:head>
	<title>Axial</title>
	<meta
		name="description"
		content="Axial is a browser-native 3D gravity strategy game rebuilt with SvelteKit and Three.js."
	/>
</svelte:head>

<main
	class="game-shell"
	data-theme={controller.uiTheme}
	data-scene={controller.sceneTheme}
	data-status={controller.statusTone}
>
	<div class="aurora"></div>
	<AxialScene
		game={controller.game}
		hoveredMove={controller.hoveredMove}
		labelsVisible={controller.labelsVisible}
		uiTheme={controller.uiTheme}
		sceneTheme={controller.sceneTheme}
		onHover={controller.setHover}
		onPlay={controller.playMove}
	/>

	<GameHud currentLabel={controller.currentLabel} currentPlayer={controller.currentPlayer} />

	<GameStatusPanel
		arenaLabel={controller.arenaLabel}
		statusTitle={controller.statusTitle}
		moveCount={controller.game.moveHistory.length}
		sceneTheme={controller.sceneTheme}
		uiTheme={controller.uiTheme}
		labelsVisible={controller.labelsVisible}
		moveError={controller.moveError}
		onReset={controller.resetGame}
		onSceneThemeChange={controller.setSceneTheme}
		onToggleLabels={controller.toggleLabels}
		onToggleTheme={controller.toggleTheme}
	/>
</main>
