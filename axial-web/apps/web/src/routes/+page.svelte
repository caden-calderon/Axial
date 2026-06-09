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
	let sceneEpoch = $state(0);
	let recoveryMessage = $state('');
	let sceneBoundaryRecoveries = 0;
	let lastRecoveryAt = 0;
	let recoveryMessageTimeout: number | null = null;

	onMount(() => {
		controller.hydrateFromStorage();

		const updateFullscreenState = () => {
			fullscreenAvailable = isFullscreenSupported();
			fullscreenActive = getFullscreenElement() !== null;
		};

		updateFullscreenState();
		document.addEventListener('fullscreenchange', updateFullscreenState);
		document.addEventListener('webkitfullscreenchange', updateFullscreenState);
		window.addEventListener('error', handleGlobalError);
		window.addEventListener('unhandledrejection', handleUnhandledRejection);

		return () => {
			document.removeEventListener('fullscreenchange', updateFullscreenState);
			document.removeEventListener('webkitfullscreenchange', updateFullscreenState);
			window.removeEventListener('error', handleGlobalError);
			window.removeEventListener('unhandledrejection', handleUnhandledRejection);
			if (recoveryMessageTimeout) clearTimeout(recoveryMessageTimeout);
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

	function handleSceneBoundaryError(error: unknown, reset: () => void): void {
		console.error('Axial scene failed.', error);

		if (sceneBoundaryRecoveries >= 2) {
			showRecoveryMessage('Board paused. Match preserved.');
			return;
		}

		sceneBoundaryRecoveries += 1;
		window.setTimeout(() => restartScene(reset), 0);
	}

	function handleRecoverableSceneError(error: unknown): void {
		console.warn('Axial scene recovered from a rendering issue.', error);
		restartScene();
	}

	function handleGlobalError(event: ErrorEvent): void {
		if (isIgnoredRuntimeError(event.error)) return;
		restartSceneFromUnexpected(event.error);
	}

	function handleUnhandledRejection(event: PromiseRejectionEvent): void {
		if (isIgnoredRuntimeError(event.reason)) return;
		restartSceneFromUnexpected(event.reason);
	}

	function restartSceneFromUnexpected(error: unknown): void {
		const now = Date.now();
		if (now - lastRecoveryAt < 1500) return;

		lastRecoveryAt = now;
		console.error('Axial recovered after an unexpected runtime issue.', error);
		restartScene();
	}

	function restartScene(reset?: () => void): void {
		sceneEpoch += 1;
		reset?.();
		showRecoveryMessage('Board recovered. Match preserved.');
	}

	function showRecoveryMessage(message: string): void {
		recoveryMessage = message;
		if (recoveryMessageTimeout) clearTimeout(recoveryMessageTimeout);
		recoveryMessageTimeout = window.setTimeout(() => {
			recoveryMessage = '';
			recoveryMessageTimeout = null;
		}, 4200);
	}

	function isIgnoredRuntimeError(error: unknown): boolean {
		return error instanceof Error && error.name === 'AbortError';
	}

	function recoveryErrorLabel(error: unknown): string {
		return error instanceof Error ? error.message : 'Board renderer error';
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
	<svelte:boundary onerror={handleSceneBoundaryError}>
		{#key sceneEpoch}
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
				onRecoverableError={handleRecoverableSceneError}
			/>
		{/key}

		{#snippet failed(error, reset)}
			<div
				class="scene-recovery"
				role="status"
				aria-live="polite"
				aria-label={recoveryErrorLabel(error)}
			>
				<strong>Board paused</strong>
				<button type="button" onclick={() => restartScene(reset)}>Restart board</button>
			</div>
		{/snippet}
	</svelte:boundary>

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

	{#if recoveryMessage}
		<div class="recovery-toast" role="status" aria-live="polite">{recoveryMessage}</div>
	{/if}
</main>

<style>
	.scene-recovery,
	.recovery-toast {
		position: absolute;
		z-index: 5;
		border: 1px solid var(--border);
		background: var(--panel);
		color: var(--text);
		backdrop-filter: blur(18px) saturate(1.1);
		box-shadow: 0 18px 48px var(--shadow);
	}

	.scene-recovery {
		inset: 50% auto auto 50%;
		display: inline-flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.72rem 0.82rem;
		border-radius: 1rem;
		transform: translate(-50%, -50%);
	}

	.scene-recovery strong {
		font-size: 0.82rem;
		font-weight: 820;
		white-space: nowrap;
	}

	.scene-recovery button {
		min-height: 2rem;
		border: 1px solid color-mix(in oklab, var(--accent) 42%, transparent);
		border-radius: 999px;
		background: color-mix(in oklab, var(--accent) 18%, var(--surface));
		color: var(--text);
		cursor: pointer;
		font-size: 0.72rem;
		font-weight: 800;
		padding: 0 0.72rem;
	}

	.recovery-toast {
		left: 50%;
		bottom: 1rem;
		max-width: min(22rem, calc(100vw - 2rem));
		padding: 0.62rem 0.78rem;
		border-radius: 999px;
		font-size: 0.76rem;
		font-weight: 760;
		text-align: center;
		transform: translateX(-50%);
	}
</style>
