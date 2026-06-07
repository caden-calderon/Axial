<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Boxes,
		ChevronUp,
		CopyPlus,
		Maximize2,
		Minimize2,
		Moon,
		Redo2,
		RotateCcw,
		Shield,
		Sun,
		Undo2
	} from '@lucide/svelte';
	import type { BoardDimensions, MatchMode, TacticalSpecialId, WinCondition } from '@axial/core';
	import type { PieceColors, PieceShape } from '../state/pieceAppearance';
	import type {
		AiDifficulty,
		OpponentMode,
		BoardDimensionKey,
		TacticalSpecialCounts
	} from '../state/gameController.svelte';
	import type { SessionRecord } from '../state/sessionRecord';
	import type { UiThemeName } from '../theming/sceneThemes';
	import AppearancePanel from './AppearancePanel.svelte';
	import MatchSettingsPanel from './MatchSettingsPanel.svelte';
	import PanelLiveStrip from './PanelLiveStrip.svelte';
	import SessionRecordPanel from './SessionRecordPanel.svelte';
	import TacticalLoadoutPanel from './TacticalLoadoutPanel.svelte';

	let {
		statusTitle,
		moveCount,
		boardColor,
		uiTheme,
		labelsVisible,
		opponentMode,
		aiDifficulty,
		matchMode,
		boardDimensions,
		winCondition,
		aiThinking,
		pieceShape,
		pieceColors,
		setupLocked,
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
		onReset,
		onUndo,
		onRedo,
		onToggleFullscreen,
		onOpponentModeChange,
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
		onToggleLabels,
		onToggleTheme
	}: {
		statusTitle: string;
		moveCount: number;
		boardColor: string;
		uiTheme: UiThemeName;
		labelsVisible: boolean;
		opponentMode: OpponentMode;
		aiDifficulty: AiDifficulty;
		matchMode: MatchMode;
		boardDimensions: BoardDimensions;
		winCondition: WinCondition;
		aiThinking: boolean;
		pieceShape: PieceShape;
		pieceColors: PieceColors;
		setupLocked: boolean;
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
		onReset: () => void;
		onUndo: () => void;
		onRedo: () => void;
		onToggleFullscreen: () => void;
		onOpponentModeChange: (mode: OpponentMode) => void;
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
		onToggleLabels: () => void;
		onToggleTheme: () => void;
	} = $props();

	let expanded = $state(true);
	let piecesMode = $state(false);
	const moveLabel = $derived(`${moveCount} ${moveCount === 1 ? 'move' : 'moves'}`);
	const specialStatus = $derived(
		matchMode === 'tactical'
			? `${activeSpecialCharges}/${specialLoadoutSlots}`
			: `${specialLoadoutSlots}`
	);

	onMount(() => {
		expanded = window.innerWidth >= 720;
	});

	function togglePiecesMode(): void {
		if (matchMode !== 'tactical') return;
		piecesMode = !piecesMode;
	}
</script>

<section class="control-panel" class:collapsed={!expanded}>
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
				title="Pieces"
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
				title={selectedSpecial === 'blocker-combo'
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
				title={selectedSpecial === 'double-adjacent'
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
				class="icon-button"
				type="button"
				aria-label="Undo move"
				title="Undo move"
				disabled={!canUndo}
				onclick={onUndo}
			>
				<Undo2 size={18} strokeWidth={1.9} />
			</button>
			<button
				class="icon-button"
				type="button"
				aria-label="Redo move"
				title="Redo move"
				disabled={!canRedo}
				onclick={onRedo}
			>
				<Redo2 size={18} strokeWidth={1.9} />
			</button>
			<button
				class="icon-button"
				type="button"
				aria-label="Reset game"
				title="Reset game"
				onclick={onReset}
			>
				<RotateCcw size={18} strokeWidth={1.9} />
			</button>
			{#if fullscreenAvailable}
				<button
					class="icon-button"
					type="button"
					aria-label={fullscreenActive ? 'Exit fullscreen' : 'Enter fullscreen'}
					aria-pressed={fullscreenActive}
					title={fullscreenActive ? 'Exit fullscreen' : 'Fullscreen'}
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
				class="icon-button"
				type="button"
				aria-label={uiTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
				title={uiTheme === 'dark' ? 'Light mode' : 'Dark mode'}
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
			aria-label={expanded
				? 'Collapse settings'
				: piecesMode
					? 'Expand piece details'
					: 'Expand settings'}
			aria-expanded={expanded}
			title={expanded ? 'Collapse' : piecesMode ? 'Piece details' : 'Expand'}
			onclick={() => (expanded = !expanded)}
		>
			<ChevronUp size={18} strokeWidth={1.9} />
		</button>
	</div>

	<div class="panel-body-shell" aria-hidden={!expanded} inert={!expanded}>
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

					<MatchSettingsPanel
						{opponentMode}
						{aiDifficulty}
						{matchMode}
						{boardDimensions}
						{winCondition}
						{aiThinking}
						{setupLocked}
						{onOpponentModeChange}
						{onAiDifficultyChange}
						{onMatchModeChange}
						{onBoardDimensionChange}
						{onWinLineLengthChange}
						{onLinesToWinChange}
					/>

					<AppearancePanel
						{boardColor}
						{uiTheme}
						{labelsVisible}
						{pieceShape}
						{pieceColors}
						{appearanceLocked}
						{onPieceShapeChange}
						{onPieceColorChange}
						{onBoardColorChange}
						{onToggleLabels}
						{onToggleTheme}
					/>

					<SessionRecordPanel {sessionRecord} {opponentMode} />
				{/if}

				{#if moveError}
					<p class="move-error">{moveError}</p>
				{/if}
			</div>
		</div>
	</div>
</section>
