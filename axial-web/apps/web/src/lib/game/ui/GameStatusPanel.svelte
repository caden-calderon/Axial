<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Boxes,
		ChevronUp,
		CopyPlus,
		HelpCircle,
		Maximize2,
		MessageSquareText,
		Minimize2,
		Moon,
		Redo2,
		RotateCcw,
		Shield,
		Sun,
		Undo2
	} from '@lucide/svelte';
	import type {
		GameSnapshot,
		BoardDimensions,
		MatchMode,
		TacticalSpecialId,
		WinCondition
	} from '@axial/core';
	import type { PieceColors, PieceShape } from '../state/pieceAppearance';
	import type {
		AiDifficulty,
		OpponentMode,
		BoardDimensionKey,
		PlayMode,
		TacticalSpecialCounts
	} from '../state/gameController.svelte';
	import type { OnlineController } from '$lib/multiplayer/onlineController.svelte';
	import type { SessionRecord } from '../state/sessionRecord';
	import type { UiThemeName } from '../theming/sceneThemes';
	import AppearancePanel from './AppearancePanel.svelte';
	import MatchSettingsPanel from './MatchSettingsPanel.svelte';
	import OnlineRoomPanel from './OnlineRoomPanel.svelte';
	import PanelLiveStrip from './PanelLiveStrip.svelte';
	import SessionRecordPanel from './SessionRecordPanel.svelte';
	import TacticalLoadoutPanel from './TacticalLoadoutPanel.svelte';

	let {
		game,
		soundEnabled,
		onToggleSound,
		statusTitle,
		moveCount,
		boardColor,
		uiTheme,
		labelsVisible,
		gridLayersVisible,
		confirmDropEnabled,
		playMode,
		online,
		opponentMode,
		aiDifficulty,
		matchMode,
		boardDimensions,
		winCondition,
		aiThinking,
		aiError,
		onRetryAi,
		pieceShape,
		pieceColors,
		setupLocked,
		playModeLocked,
		appearanceLocked,
		activeSpecialCharges,
		activeSpecialCounts,
		specialLoadoutSlots,
		selectedSpecial,
		canUseBlockerCombo,
		canUseDoubleAdjacent,
		mustCompleteBlockerCombo,
		mustCompleteDoubleAdjacent,
		sessionRecord,
		moveError,
		canUndo,
		canRedo,
		fullscreenAvailable,
		fullscreenActive,
		forcedExpanded = null,
		onReset,
		onUndo,
		onRedo,
		onToggleFullscreen,
		onPlayModeChange,
		onAiDifficultyChange,
		onMatchModeChange,
		onBoardDimensionChange,
		onWinLineLengthChange,
		onLinesToWinChange,
		onToggleBlockerCombo,
		onToggleDoubleAdjacent,
		onPieceShapeChange,
		onPieceColorChange,
		onBoardColorChange,
		onToggleConfirmDrop,
		onToggleGridLayers,
		onToggleLabels,
		onToggleTheme,
		onExpandedChange,
		onShowHelp,
		onShowFeedback,
		helpLocked = false
	}: {
		game: GameSnapshot;
		soundEnabled: boolean;
		onToggleSound: () => void;
		statusTitle: string;
		moveCount: number;
		boardColor: string;
		uiTheme: UiThemeName;
		labelsVisible: boolean;
		gridLayersVisible: boolean;
		confirmDropEnabled: boolean;
		playMode: PlayMode;
		online: OnlineController;
		opponentMode: OpponentMode;
		aiDifficulty: AiDifficulty;
		matchMode: MatchMode;
		boardDimensions: BoardDimensions;
		winCondition: WinCondition;
		aiThinking: boolean;
		aiError: string;
		onRetryAi: () => void;
		pieceShape: PieceShape;
		pieceColors: PieceColors;
		setupLocked: boolean;
		playModeLocked: boolean;
		appearanceLocked: boolean;
		activeSpecialCharges: number;
		activeSpecialCounts: TacticalSpecialCounts;
		specialLoadoutSlots: number;
		selectedSpecial: TacticalSpecialId | null;
		canUseBlockerCombo: boolean;
		canUseDoubleAdjacent: boolean;
		mustCompleteBlockerCombo: boolean;
		mustCompleteDoubleAdjacent: boolean;
		sessionRecord: SessionRecord;
		moveError: string;
		canUndo: boolean;
		canRedo: boolean;
		fullscreenAvailable: boolean;
		fullscreenActive: boolean;
		forcedExpanded?: boolean | null;
		onReset: () => void;
		onUndo: () => void;
		onRedo: () => void;
		onToggleFullscreen: () => void;
		onPlayModeChange: (mode: PlayMode) => void;
		onAiDifficultyChange: (difficulty: AiDifficulty) => void;
		onMatchModeChange: (mode: MatchMode) => void;
		onBoardDimensionChange: (key: BoardDimensionKey, value: number) => void;
		onWinLineLengthChange: (lineLength: number) => void;
		onLinesToWinChange: (linesToWin: number) => void;
		onToggleBlockerCombo: () => void;
		onToggleDoubleAdjacent: () => void;
		onPieceShapeChange: (shape: PieceShape) => void;
		onPieceColorChange: (player: 1 | 2, color: string) => void;
		onBoardColorChange: (color: string) => void;
		onToggleConfirmDrop: () => void;
		onToggleGridLayers: () => void;
		onToggleLabels: () => void;
		onToggleTheme: () => void;
		onExpandedChange?: (expanded: boolean) => void;
		onShowHelp: () => void;
		onShowFeedback: () => void;
		/** The tour replaces the board, so it waits until a live online match is over. */
		helpLocked?: boolean;
	} = $props();

	let expanded = $state(true);
	let piecesMode = $state(false);
	let sheetFull = $state(false);
	let panelElement: HTMLElement | undefined = $state();
	/** Live height while the phone sheet's handle is dragged; null lets the CSS state decide. */
	let dragHeight = $state<number | null>(null);
	let sheetDrag: SheetDrag | null = null;
	let suppressHandleClick = false;
	const panelExpanded = $derived(forcedExpanded ?? expanded);
	const moveLabel = $derived(`${moveCount} ${moveCount === 1 ? 'move' : 'moves'}`);
	const specialStatus = $derived(
		matchMode === 'tactical'
			? `${activeSpecialCharges}/${specialLoadoutSlots}`
			: `${specialLoadoutSlots}`
	);

	onMount(() => {
		expanded = !isCompactViewport();
	});

	$effect(() => {
		if (playMode === 'online') expanded = true;
	});

	$effect(() => {
		if (forcedExpanded !== null) expanded = forcedExpanded;
	});

	$effect(() => {
		onExpandedChange?.(panelExpanded);
	});

	function toggleExpanded(): void {
		if (forcedExpanded !== null) return;
		expanded = !expanded;
		if (!expanded) sheetFull = false;
	}

	function toggleSheetSize(): void {
		if (suppressHandleClick) {
			suppressHandleClick = false;
			return;
		}
		sheetFull = !sheetFull;
	}

	type SheetDrag = {
		pointerId: number;
		startY: number;
		startHeight: number;
		startStop: SheetStop;
		moved: boolean;
		lastY: number;
		lastTime: number;
		/** Pixels per millisecond, positive downward, smoothed over the last few moves. */
		velocity: number;
	};
	type SheetStop = 'collapsed' | 'half' | 'full';
	const SHEET_STOPS: SheetStop[] = ['collapsed', 'half', 'full'];
	const SHEET_TAP_SLOP_PX = 6;
	const SHEET_FLICK_SPEED = 0.45;
	const SHEET_FLICK_MAX_AGE_MS = 120;
	const SHEET_MIN_DRAG_HEIGHT = 72;

	function startSheetDrag(event: PointerEvent): void {
		suppressHandleClick = false;
		if (forcedExpanded !== null || !panelExpanded || !panelElement) return;
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		sheetDrag = {
			pointerId: event.pointerId,
			startY: event.clientY,
			startHeight: panelElement.getBoundingClientRect().height,
			startStop: sheetFull ? 'full' : 'half',
			moved: false,
			lastY: event.clientY,
			lastTime: event.timeStamp,
			velocity: 0
		};
		// Keep receiving moves once the finger leaves the thin handle. Capture can throw for a
		// pointer that already ended; the drag still works while the finger stays on the handle.
		try {
			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		} catch {
			/* see above */
		}
	}

	function moveSheetDrag(event: PointerEvent): void {
		const drag = sheetDrag;
		if (!drag || event.pointerId !== drag.pointerId) return;
		const offset = event.clientY - drag.startY;
		if (!drag.moved && Math.abs(offset) < SHEET_TAP_SLOP_PX) return;
		drag.moved = true;

		const elapsed = event.timeStamp - drag.lastTime;
		if (elapsed > 0) {
			drag.velocity = 0.7 * ((event.clientY - drag.lastY) / elapsed) + 0.3 * drag.velocity;
		}
		drag.lastY = event.clientY;
		drag.lastTime = event.timeStamp;
		dragHeight = Math.min(
			window.innerHeight,
			Math.max(SHEET_MIN_DRAG_HEIGHT, drag.startHeight + offset)
		);
	}

	function endSheetDrag(event: PointerEvent): void {
		const drag = sheetDrag;
		if (!drag || event.pointerId !== drag.pointerId) return;
		sheetDrag = null;
		const height = dragHeight;
		dragHeight = null;
		// A tap falls through to the click handler, which toggles half and full.
		if (!drag.moved || height === null || event.type === 'pointercancel') return;

		suppressHandleClick = true;
		const stale = event.timeStamp - drag.lastTime > SHEET_FLICK_MAX_AGE_MS;
		settleSheet(height, stale ? 0 : drag.velocity, drag.startStop);
	}

	/** Snap to the nearest stop, or one stop past where the drag began when it ends in a flick. */
	function settleSheet(height: number, velocity: number, startStop: SheetStop): void {
		const halfHeight = halfSheetHeight();
		const fullHeight = window.innerHeight;
		let index = height < halfHeight * 0.6 ? 0 : height > (halfHeight + fullHeight) / 2 ? 2 : 1;
		const startIndex = SHEET_STOPS.indexOf(startStop);
		if (velocity > SHEET_FLICK_SPEED && index <= startIndex) index = Math.min(2, startIndex + 1);
		if (velocity < -SHEET_FLICK_SPEED && index >= startIndex) index = Math.max(0, startIndex - 1);

		const stop = SHEET_STOPS[index];
		sheetFull = stop === 'full';
		if (stop === 'collapsed') expanded = false;
	}

	/** Mirrors the half sheet's CSS height, min(50dvh, 30rem). */
	function halfSheetHeight(): number {
		const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
		return Math.min(window.innerHeight * 0.5, 30 * rem);
	}

	function togglePiecesMode(): void {
		if (matchMode !== 'tactical') return;
		piecesMode = !piecesMode;
	}

	function isCompactViewport(): boolean {
		return (
			window.innerWidth < 720 || window.matchMedia('(hover: none) and (pointer: coarse)').matches
		);
	}
</script>

<section
	bind:this={panelElement}
	class="control-panel"
	class:collapsed={!panelExpanded}
	class:sheet-full={sheetFull}
	class:sheet-dragging={dragHeight !== null}
	style:height={dragHeight === null ? undefined : `${dragHeight}px`}
	class:tactical-panel={matchMode === 'tactical'}
	class:tour-controlled={forcedExpanded !== null}
	data-sheet-state={panelExpanded ? (sheetFull ? 'full' : 'half') : 'collapsed'}
	data-tour-target="control-panel"
>
	<div class="panel-scroll">
		<div
			class="panel-toolbar"
			class:pieces-mode={piecesMode && matchMode === 'tactical'}
			class:tactical-toolbar={matchMode === 'tactical'}
		>
			{#if matchMode === 'tactical'}
				<button
					class="icon-button pieces-toggle"
					class:active={piecesMode}
					type="button"
					aria-label={piecesMode ? 'Show match controls' : 'Show pieces'}
					aria-pressed={piecesMode}
					data-tooltip="Pieces"
					onclick={togglePiecesMode}
				>
					<Boxes size={18} strokeWidth={1.9} />
				</button>
			{/if}
			{#if piecesMode && matchMode === 'tactical'}
				<button
					class="toolbar-piece-button"
					class:armed={selectedSpecial === 'blocker-combo' || mustCompleteBlockerCombo}
					type="button"
					disabled={!canUseBlockerCombo && selectedSpecial !== 'blocker-combo'}
					aria-label="Use blocker"
					data-tooltip={selectedSpecial === 'blocker-combo'
						? 'Cancel blocker placement'
						: mustCompleteBlockerCombo
							? 'Place your regular piece to finish the combo'
							: 'Place a blocker, then your regular piece'}
					onclick={onToggleBlockerCombo}
				>
					<Shield size={15} strokeWidth={2.1} />
					<span>Blocker</span>
					<small>{mustCompleteBlockerCombo ? '!' : activeSpecialCounts['blocker-combo']}</small>
				</button>
				<button
					class="toolbar-piece-button"
					class:armed={selectedSpecial === 'double-adjacent' || mustCompleteDoubleAdjacent}
					type="button"
					disabled={!canUseDoubleAdjacent && selectedSpecial !== 'double-adjacent'}
					aria-label="Use double adjacent"
					data-tooltip={selectedSpecial === 'double-adjacent'
						? 'Cancel double placement'
						: mustCompleteDoubleAdjacent
							? 'Place the second piece next to the first'
							: 'Place two adjacent pieces in one turn'}
					onclick={onToggleDoubleAdjacent}
				>
					<CopyPlus size={15} strokeWidth={2.1} />
					<span>Double</span>
					<small>{mustCompleteDoubleAdjacent ? '!' : activeSpecialCounts['double-adjacent']}</small>
				</button>
			{:else}
				<button
					class="icon-button toolbar-history-action"
					type="button"
					aria-label="Undo move"
					data-tooltip="Undo move"
					disabled={!canUndo}
					onclick={onUndo}
				>
					<Undo2 size={18} strokeWidth={1.9} />
				</button>
				<button
					class="icon-button toolbar-history-action"
					type="button"
					aria-label="Redo move"
					data-tooltip="Redo move"
					disabled={!canRedo}
					onclick={onRedo}
				>
					<Redo2 size={18} strokeWidth={1.9} />
				</button>
				{#if fullscreenAvailable}
					<button
						class="icon-button toolbar-fullscreen-action"
						type="button"
						aria-label={fullscreenActive ? 'Exit fullscreen' : 'Enter fullscreen'}
						aria-pressed={fullscreenActive}
						data-tooltip={fullscreenActive ? 'Exit fullscreen' : 'Fullscreen'}
						onclick={onToggleFullscreen}
					>
						{#if fullscreenActive}
							<Minimize2 size={18} strokeWidth={1.9} />
						{:else}
							<Maximize2 size={18} strokeWidth={1.9} />
						{/if}
					</button>
				{/if}
				<button
					class="icon-button toolbar-reset-action"
					type="button"
					aria-label={playMode === 'online' ? 'Resync room' : 'Reset game'}
					data-tooltip={playMode === 'online' ? 'Resync room' : 'Reset game'}
					onclick={onReset}
				>
					<RotateCcw size={18} strokeWidth={1.9} />
				</button>
				<button
					class="icon-button toolbar-theme-action"
					type="button"
					aria-label={uiTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
					data-tooltip={uiTheme === 'dark' ? 'Light mode' : 'Dark mode'}
					onclick={onToggleTheme}
				>
					{#if uiTheme === 'dark'}
						<Sun size={18} strokeWidth={1.9} />
					{:else}
						<Moon size={18} strokeWidth={1.9} />
					{/if}
				</button>
			{/if}
			<button
				class="icon-button collapse-button"
				type="button"
				data-tour-target="panel-toggle"
				aria-label={panelExpanded
					? 'Collapse settings'
					: piecesMode
						? 'Expand piece details'
						: 'Expand settings'}
				aria-expanded={panelExpanded}
				data-tooltip={panelExpanded ? 'Collapse' : piecesMode ? 'Piece details' : 'Expand'}
				onclick={toggleExpanded}
			>
				<ChevronUp size={18} strokeWidth={1.9} />
			</button>
		</div>

		<div class="panel-body-shell" aria-hidden={!panelExpanded} inert={!panelExpanded}>
			<div class="panel-body-clip">
				<div class="panel-body">
					{#if piecesMode && matchMode === 'tactical'}
						<TacticalLoadoutPanel
							{statusTitle}
							{specialStatus}
							{activeSpecialCounts}
							{selectedSpecial}
							{canUseBlockerCombo}
							{canUseDoubleAdjacent}
							{mustCompleteBlockerCombo}
							{mustCompleteDoubleAdjacent}
							{onToggleBlockerCombo}
							{onToggleDoubleAdjacent}
						/>
					{:else}
						<PanelLiveStrip label="Now" title={statusTitle} meta={moveLabel} />
						{#if aiError}
							<div class="ai-recovery" role="alert">
								<span>{aiError}</span>
								<button type="button" onclick={onRetryAi}>Retry AI turn</button>
							</div>
						{/if}

						<div class="panel-quick-actions" aria-label="Board help">
							<button
								type="button"
								disabled={helpLocked}
								data-tooltip={helpLocked ? 'Available after this match' : undefined}
								onclick={onShowHelp}
							>
								<HelpCircle size={15} strokeWidth={2} />
								<span>How to play</span>
							</button>
							<button type="button" onclick={onShowFeedback}>
								<MessageSquareText size={15} strokeWidth={2} />
								<span>Feedback</span>
							</button>
						</div>

						<MatchSettingsPanel
							{game}
							{pieceColors}
							{playMode}
							{aiDifficulty}
							{matchMode}
							{boardDimensions}
							{winCondition}
							{aiThinking}
							{setupLocked}
							{playModeLocked}
							{onPlayModeChange}
							{onAiDifficultyChange}
							{onMatchModeChange}
							{onBoardDimensionChange}
							{onWinLineLengthChange}
							{onLinesToWinChange}
						>
							{#snippet onlineControls()}
								<OnlineRoomPanel {online} />
							{/snippet}
						</MatchSettingsPanel>

						<AppearancePanel
							{soundEnabled}
							{onToggleSound}
							{boardColor}
							{uiTheme}
							{labelsVisible}
							{gridLayersVisible}
							{confirmDropEnabled}
							{pieceShape}
							{pieceColors}
							{appearanceLocked}
							{onPieceShapeChange}
							{onPieceColorChange}
							{onBoardColorChange}
							{onToggleConfirmDrop}
							{onToggleGridLayers}
							{onToggleLabels}
							{onToggleTheme}
						/>

						{#if playMode !== 'online'}
							<SessionRecordPanel {sessionRecord} {opponentMode} />
						{/if}
					{/if}

					{#if moveError}
						<p class="move-error">{moveError}</p>
					{/if}
				</div>
			</div>
		</div>
	</div>
	{#if panelExpanded && forcedExpanded === null}
		<!-- Phone portrait only (see layout.css): drag between half and full, or up to tuck away. -->
		<button
			class="sheet-handle"
			type="button"
			aria-label={sheetFull ? 'Half sheet' : 'Full sheet'}
			onpointerdown={startSheetDrag}
			onpointermove={moveSheetDrag}
			onpointerup={endSheetDrag}
			onpointercancel={endSheetDrag}
			onclick={toggleSheetSize}
		>
			<span class="sheet-grabber" aria-hidden="true"></span>
		</button>
	{/if}
</section>
