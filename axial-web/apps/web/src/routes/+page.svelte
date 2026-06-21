<script lang="ts">
	import { onMount } from 'svelte';
	import type { MatchMode, Move } from '@axial/core';
	import { createAxialBridgeController } from '$lib/game/bridge/bridgeController';
	import AxialScene from '$lib/game/scene/AxialScene.svelte';
	import WelcomeTourOverlay from '$lib/game/onboarding/WelcomeTourOverlay.svelte';
	import {
		clearWelcomeTourSeen,
		hasSeenWelcomeTour,
		markWelcomeTourSeen,
		shouldStartWelcomeTour
	} from '$lib/game/onboarding/welcomeTour';
	import { createGameController, type PlayMode } from '$lib/game/state/gameController.svelte';
	import GameOverModal from '$lib/game/ui/GameOverModal.svelte';
	import GameHud from '$lib/game/ui/GameHud.svelte';
	import OnlineMatchOverlay from '$lib/game/ui/OnlineMatchOverlay.svelte';
	import GameStatusPanel from '$lib/game/ui/GameStatusPanel.svelte';
	import {
		createOnlineController,
		type BoardDimensionKey
	} from '$lib/multiplayer/onlineController.svelte';

	const controller = createGameController();
	const online = createOnlineController();
	const bridge = createAxialBridgeController(controller);
	let playMode = $state<PlayMode>('local');
	let embedMode = $state(false);
	let bridgeEnabled = $state(false);
	let fullscreenAvailable = $state(false);
	let fullscreenActive = $state(false);
	let welcomeTourActive = $state(false);
	let welcomeTourPanelExpanded = $state<boolean | null>(null);
	let welcomeTourPanelResetTimeout: number | null = null;
	let sceneEpoch = $state(0);
	let recoveryMessage = $state('');
	let sceneBoundaryRecoveries = 0;
	let lastRecoveryAt = 0;
	let recoveryMessageTimeout: number | null = null;
	const activeGame = $derived(playMode === 'online' ? online.game : controller.game);
	const activeStatusTitle = $derived(
		playMode === 'online' ? online.statusTitle : controller.statusTitle
	);
	const activeCurrentLabel = $derived(
		playMode === 'online' ? online.currentLabel : controller.currentLabel
	);
	const activeCurrentPlayer = $derived(
		playMode === 'online' ? online.currentPlayer : controller.currentPlayer
	);
	const activeBoardDimensions = $derived(
		playMode === 'online' ? online.boardDimensions : controller.boardDimensions
	);
	const activeWinCondition = $derived(
		playMode === 'online' ? online.winCondition : controller.winCondition
	);
	const activeMatchMode = $derived(playMode === 'online' ? online.matchMode : controller.matchMode);
	const activeSetupLocked = $derived(
		playMode === 'online' ? online.setupLocked : controller.setupLocked
	);
	const activeMoveError = $derived(playMode === 'online' ? online.moveError : controller.moveError);
	const activePreviewMove = $derived(
		playMode === 'online' ? online.previewMove : controller.previewMove
	);
	const activeLockedMove = $derived(
		playMode === 'online' ? online.lockedMove : controller.lockedMove
	);

	onMount(() => {
		controller.hydrateFromStorage();
		const url = new URL(window.location.href);
		const searchParams = url.searchParams;
		embedMode = searchParams.get('embed') === '1';
		if (online.hydrateFromBrowser(searchParams)) {
			online.useRules({
				mode: 'classic',
				board: controller.boardDimensions,
				winCondition: controller.winCondition
			});
			playMode = 'online';
		}
		if (searchParams.get('tour')?.toLowerCase() === 'reset') {
			clearWelcomeTourSeen(localStorage);
		}
		if (
			shouldStartWelcomeTour({
				searchParams,
				embedMode,
				hasActiveMatch: controller.game.moveHistory.length > 0,
				hasOnlineIntent: searchParams.has('room') || searchParams.get('online') === '1',
				hasSeenTour: hasSeenWelcomeTour(localStorage)
			})
		) {
			welcomeTourActive = true;
			welcomeTourPanelExpanded = false;
		}
		bridgeEnabled = bridge.start();

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
			online.destroy();
			bridge.stop();
			if (recoveryMessageTimeout) clearTimeout(recoveryMessageTimeout);
			if (welcomeTourPanelResetTimeout) clearTimeout(welcomeTourPanelResetTimeout);
		};
	});

	$effect(() => {
		if (!bridgeEnabled) return;
		bridge.publishState();
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

	function setPlayMode(nextMode: PlayMode): void {
		if (nextMode === playMode) return;

		if (playMode !== 'online' && controller.setupLocked) {
			controller.setOpponentMode(nextMode === 'online' ? controller.opponentMode : nextMode);
			return;
		}

		if (nextMode === 'online') {
			online.useRules({
				mode: 'classic',
				board: controller.boardDimensions,
				winCondition: controller.winCondition
			});
			playMode = 'online';
			return;
		}

		if (playMode === 'online' && online.hasRoom) online.leaveRoom();
		playMode = nextMode;
		controller.setOpponentMode(nextMode);
	}

	function setSceneHover(move: Move | null): void {
		if (playMode === 'online') {
			online.setHover(move);
			return;
		}
		controller.setHover(move);
	}

	function playSceneMove(move: Move): void {
		if (playMode === 'online') {
			online.selectOrPlayMove(move, controller.confirmDropEnabled);
			return;
		}
		controller.selectOrPlayMove(move);
	}

	function setActiveMatchMode(mode: MatchMode): void {
		if (playMode === 'online') {
			online.setMatchMode(mode);
			return;
		}
		controller.setMatchMode(mode);
	}

	function setActiveBoardDimension(key: BoardDimensionKey, value: number): void {
		if (playMode === 'online') {
			online.setBoardDimension(key, value);
			return;
		}
		controller.setBoardDimension(key, value);
	}

	function setActiveWinLineLength(lineLength: number): void {
		if (playMode === 'online') {
			online.setWinLineLength(lineLength);
			return;
		}
		controller.setWinLineLength(lineLength);
	}

	function setActiveLinesToWin(linesToWin: number): void {
		if (playMode === 'online') {
			online.setLinesToWin(linesToWin);
			return;
		}
		controller.setLinesToWin(linesToWin);
	}

	function setWelcomeTourPanelExpanded(expanded: boolean | null): void {
		if (welcomeTourPanelResetTimeout) {
			clearTimeout(welcomeTourPanelResetTimeout);
			welcomeTourPanelResetTimeout = null;
		}
		welcomeTourPanelExpanded = expanded;
	}

	function completeWelcomeTour(): void {
		markWelcomeTourSeen(localStorage);
		closeWelcomeTour();
	}

	function skipWelcomeTour(): void {
		markWelcomeTourSeen(localStorage);
		closeWelcomeTour();
	}

	function closeWelcomeTour(): void {
		welcomeTourActive = false;
		welcomeTourPanelExpanded = false;
		welcomeTourPanelResetTimeout = window.setTimeout(() => {
			welcomeTourPanelExpanded = null;
			welcomeTourPanelResetTimeout = null;
		}, 320);
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
	data-status={playMode === 'online' ? online.statusTone : controller.statusTone}
	data-embed={embedMode ? 'true' : undefined}
	style:--accent={controller.boardColor}
>
	<div class="aurora"></div>
	<svelte:boundary onerror={handleSceneBoundaryError}>
		{#key sceneEpoch}
			<AxialScene
				game={activeGame}
				hoveredMove={activePreviewMove}
				previewLocked={activeLockedMove !== null}
				labelsVisible={controller.labelsVisible}
				gridLayersVisible={controller.gridLayersVisible}
				uiTheme={controller.uiTheme}
				boardColor={controller.boardColor}
				pieceShape={controller.pieceShape}
				pieceColors={controller.pieceColors}
				placementMode={playMode === 'online' ? 'piece' : controller.placementMode}
				doubleAdjacentAnchor={playMode === 'online' ? null : controller.pendingDoubleAdjacentOrigin}
				onHover={setSceneHover}
				onPlay={playSceneMove}
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
		currentLabel={activeCurrentLabel}
		currentPlayer={activeCurrentPlayer}
		boardDimensions={activeBoardDimensions}
	/>

	<GameStatusPanel
		statusTitle={activeStatusTitle}
		moveCount={activeGame.moveHistory.length}
		boardColor={controller.boardColor}
		uiTheme={controller.uiTheme}
		labelsVisible={controller.labelsVisible}
		gridLayersVisible={controller.gridLayersVisible}
		confirmDropEnabled={controller.confirmDropEnabled}
		{playMode}
		{online}
		opponentMode={controller.opponentMode}
		aiDifficulty={controller.aiDifficulty}
		matchMode={activeMatchMode}
		boardDimensions={activeBoardDimensions}
		winCondition={activeWinCondition}
		aiThinking={controller.aiThinking}
		pieceShape={controller.pieceShape}
		pieceColors={controller.pieceColors}
		setupLocked={activeSetupLocked}
		playModeLocked={playMode !== 'online' && controller.setupLocked}
		onlineRulesLocked={playMode === 'online'}
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
		moveError={activeMoveError}
		canUndo={playMode === 'online' ? false : controller.canUndo}
		canRedo={playMode === 'online' ? false : controller.canRedo}
		{fullscreenAvailable}
		{fullscreenActive}
		forcedExpanded={welcomeTourPanelExpanded}
		onReset={playMode === 'online' ? online.resync : controller.resetGame}
		onUndo={controller.undoMove}
		onRedo={controller.redoMove}
		onToggleFullscreen={toggleFullscreen}
		onPlayModeChange={setPlayMode}
		onOpponentModeChange={controller.setOpponentMode}
		onAiDifficultyChange={controller.setAiDifficulty}
		onMatchModeChange={setActiveMatchMode}
		onBoardDimensionChange={setActiveBoardDimension}
		onWinLineLengthChange={setActiveWinLineLength}
		onLinesToWinChange={setActiveLinesToWin}
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

	{#if playMode !== 'online' && controller.showGameOverModal}
		<GameOverModal
			status={controller.game.status}
			moveCount={controller.game.moveHistory.length}
			winnerLabel={controller.winnerLabel}
			onNewMatch={controller.resetGame}
			onReviewFromStart={controller.rewindGame}
			onKeepBoard={controller.dismissGameOver}
		/>
	{/if}

	{#if playMode === 'online'}
		<OnlineMatchOverlay {online} />
	{/if}

	{#if recoveryMessage}
		<div class="recovery-toast" role="status" aria-live="polite">{recoveryMessage}</div>
	{/if}

	{#if welcomeTourActive}
		<WelcomeTourOverlay
			onComplete={completeWelcomeTour}
			onSkip={skipWelcomeTour}
			onPanelExpandedChange={setWelcomeTourPanelExpanded}
		/>
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
