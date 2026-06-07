<script lang="ts">
	import { onMount } from 'svelte';
	import AxialScene from '$lib/game/scene/AxialScene.svelte';
	import { createGameController } from '$lib/game/state/gameController.svelte';
	import GameOverModal from '$lib/game/ui/GameOverModal.svelte';
	import GameHud from '$lib/game/ui/GameHud.svelte';
	import GameStatusPanel from '$lib/game/ui/GameStatusPanel.svelte';

	const controller = createGameController();
	let fullscreenAvailable = $state(false);
	let fullscreenActive = $state(false);

	onMount(() => {
		controller.hydrateFromStorage();

		const updateFullscreenState = () => {
			fullscreenAvailable = isFullscreenSupported();
			fullscreenActive = getFullscreenElement() !== null;
		};

		updateFullscreenState();
		document.addEventListener('fullscreenchange', updateFullscreenState);
		document.addEventListener('webkitfullscreenchange', updateFullscreenState);

		return () => {
			document.removeEventListener('fullscreenchange', updateFullscreenState);
			document.removeEventListener('webkitfullscreenchange', updateFullscreenState);
		};
	});

	async function toggleFullscreen(): Promise<void> {
		if (!fullscreenAvailable) return;

		try {
			if (getFullscreenElement()) {
				await exitFullscreen();
				return;
			}

			const target = document.querySelector('.game-shell') ?? document.documentElement;
			await requestFullscreen(target);
		} catch (error) {
			console.warn('Fullscreen request was rejected by the browser.', error);
		}
	}

	function getFullscreenElement(): Element | null {
		const doc = document as WebkitFullscreenDocument;
		return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
	}

	function isFullscreenSupported(): boolean {
		const element = document.documentElement as WebkitFullscreenElement;
		return Boolean(element.requestFullscreen ?? element.webkitRequestFullscreen);
	}

	function requestFullscreen(element: Element): Promise<void> | void {
		const target = element as WebkitFullscreenElement;
		return target.requestFullscreen?.() ?? target.webkitRequestFullscreen?.();
	}

	function exitFullscreen(): Promise<void> | void {
		const doc = document as WebkitFullscreenDocument;
		return document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.();
	}

	type WebkitFullscreenDocument = Document & {
		webkitExitFullscreen?: () => Promise<void> | void;
		webkitFullscreenElement?: Element | null;
	};

	type WebkitFullscreenElement = Element & {
		webkitRequestFullscreen?: () => Promise<void> | void;
	};
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
	data-status={controller.statusTone}
	style:--accent={controller.boardColor}
>
	<div class="aurora"></div>
	<AxialScene
		game={controller.game}
		hoveredMove={controller.previewMove}
		previewLocked={controller.lockedMove !== null}
		labelsVisible={controller.labelsVisible}
		gridLayersVisible={controller.gridLayersVisible}
		uiTheme={controller.uiTheme}
		boardColor={controller.boardColor}
		pieceShape={controller.pieceShape}
		pieceColors={controller.pieceColors}
		placementMode={controller.placementMode}
		doubleAdjacentAnchor={controller.pendingDoubleAdjacentOrigin}
		onHover={controller.setHover}
		onPlay={controller.selectOrPlayMove}
	/>

	<GameHud
		currentLabel={controller.currentLabel}
		currentPlayer={controller.currentPlayer}
		boardDimensions={controller.boardDimensions}
	/>

	<GameStatusPanel
		statusTitle={controller.statusTitle}
		moveCount={controller.game.moveHistory.length}
		boardColor={controller.boardColor}
		uiTheme={controller.uiTheme}
		labelsVisible={controller.labelsVisible}
		gridLayersVisible={controller.gridLayersVisible}
		confirmDropEnabled={controller.confirmDropEnabled}
		opponentMode={controller.opponentMode}
		aiDifficulty={controller.aiDifficulty}
		matchMode={controller.matchMode}
		boardDimensions={controller.boardDimensions}
		winCondition={controller.winCondition}
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
		{fullscreenAvailable}
		{fullscreenActive}
		onReset={controller.resetGame}
		onUndo={controller.undoMove}
		onRedo={controller.redoMove}
		onToggleFullscreen={toggleFullscreen}
		onOpponentModeChange={controller.setOpponentMode}
		onAiDifficultyChange={controller.setAiDifficulty}
		onMatchModeChange={controller.setMatchMode}
		onBoardDimensionChange={controller.setBoardDimension}
		onWinLineLengthChange={controller.setWinLineLength}
		onLinesToWinChange={controller.setLinesToWin}
		onToggleBlockerCombo={controller.toggleBlockerCombo}
		onToggleDoubleAdjacent={controller.toggleDoubleAdjacent}
		onPieceShapeChange={controller.setPieceShape}
		onPieceColorChange={controller.setPieceColor}
		onBoardColorChange={controller.setBoardColor}
		onToggleConfirmDrop={controller.toggleConfirmDrop}
		onToggleGridLayers={controller.toggleGridLayers}
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
