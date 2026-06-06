<script lang="ts">
	import { onMount } from 'svelte';
	import AxialScene from '$lib/game/scene/AxialScene.svelte';
	import { createGameController } from '$lib/game/state/gameController.svelte';
	import GameOverModal from '$lib/game/ui/GameOverModal.svelte';
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
		pieceShape={controller.pieceShape}
		pieceColors={controller.pieceColors}
		placementMode={controller.placementMode}
		doubleAdjacentAnchor={controller.pendingDoubleAdjacentOrigin}
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
		opponentMode={controller.opponentMode}
		matchMode={controller.matchMode}
		aiThinking={controller.aiThinking}
		pieceShape={controller.pieceShape}
		pieceColors={controller.pieceColors}
		setupLocked={controller.setupLocked}
		appearanceLocked={controller.appearanceLocked}
		activeSpecialCharges={controller.activeSpecialCharges}
		activeSpecialCounts={controller.activeSpecialCounts}
		specialLoadoutSlots={controller.specialLoadoutSlots}
		selectedSpecial={controller.selectedSpecial}
		canUseBlockerCombo={controller.canUseBlockerCombo}
		canUseDoubleAdjacent={controller.canUseDoubleAdjacent}
		mustCompleteBlockerCombo={controller.mustCompleteBlockerCombo}
		mustCompleteDoubleAdjacent={controller.mustCompleteDoubleAdjacent}
		sessionRecord={controller.sessionRecord}
		moveError={controller.moveError}
		canUndo={controller.canUndo}
		canRedo={controller.canRedo}
		onReset={controller.resetGame}
		onUndo={controller.undoMove}
		onRedo={controller.redoMove}
		onOpponentModeChange={controller.setOpponentMode}
		onMatchModeChange={controller.setMatchMode}
		onToggleBlockerCombo={controller.toggleBlockerCombo}
		onToggleDoubleAdjacent={controller.toggleDoubleAdjacent}
		onPieceShapeChange={controller.setPieceShape}
		onPieceColorChange={controller.setPieceColor}
		onSceneThemeChange={controller.setSceneTheme}
		onToggleLabels={controller.toggleLabels}
		onToggleTheme={controller.toggleTheme}
	/>

	{#if controller.showGameOverModal}
		<GameOverModal
			status={controller.game.status}
			moveCount={controller.game.moveHistory.length}
			winnerLabel={controller.winnerLabel}
			onNewMatch={controller.resetGame}
			onReviewFromStart={controller.rewindGame}
			onKeepBoard={controller.dismissGameOver}
		/>
	{/if}
</main>
